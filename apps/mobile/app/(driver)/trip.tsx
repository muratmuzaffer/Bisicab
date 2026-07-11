import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
  AppState,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LiveTripState } from '@bisicab/shared';
import { MAX_ROUTE_STOPS, zoneIdForStop } from '@bisicab/shared';
import { useLocationTracker } from '@/hooks/useLocationTracker';
import { useAuthStore } from '@/store/authStore';
import { useTripStore } from '@/store/tripStore';
import { useShiftStore } from '@/store/shiftStore';
import { createLivePublisher } from '@/lib/liveTrip';
import { pushDriverLocation } from '@/lib/driverLocation';
import { uploadReceipt } from '@/lib/receipts';
import {
  getActiveTrip,
  readPersistedTripDistance,
  saveActiveTrip,
  setDistanceWriter,
  syncOngoingTripProgress,
} from '@/lib/activeTrip';
import { ReceiptCapture } from '@/components/ReceiptCapture';
import { ZonePicker } from '@/components/ZonePicker';
import { TripMap } from '@/components/TripMap';
import { RouteStopBuilder, type RouteSelection } from '@/components/RouteStopBuilder';
import { PassengerSelector } from '@/components/PassengerSelector';
import {
  TripCompleteScreen,
  type TripCompleteSummary,
} from '@/components/TripCompleteScreen';
import { TripLivePanel } from '@/components/TripLivePanel';
import { PrimaryButton, Card } from '@/components/ui';
import { formatDuration, formatKm, formatTL } from '@/lib/format';
import type { LatLng } from '@bisicab/shared';

type Phase = 'starting' | 'tracking' | 'payment' | 'complete';

function trimPath(path: LatLng[], max = 400): Array<{ lat: number; lng: number }> {
  if (path.length <= max) return path.map((p) => ({ lat: p.lat, lng: p.lng }));
  return path.slice(-max).map((p) => ({ lat: p.lat, lng: p.lng }));
}

export default function TripScreen() {
  const session = useAuthStore((s) => s.session);
  const activeShift = useShiftStore((s) => s.activeShift);
  const driverId = useAuthStore((s) => s.profile)?.id ?? session?.user?.id ?? null;
  const { startTrip, finalizeTrip, cancelTrip } = useTripStore();
  const tracker = useLocationTracker();

  const [phase, setPhase] = useState<Phase>('starting');
  const [tripId, setTripId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [routeStops, setRouteStops] = useState<RouteSelection[]>([]);
  /** null = kapalı, -1 = yeni durak, >=0 = düzenle */
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const [male, setMale] = useState(0);
  const [female, setFemale] = useState(0);
  const [childMale, setChildMale] = useState(0);
  const [childFemale, setChildFemale] = useState(0);
  const [hasTourist, setHasTourist] = useState(false);
  const [completeSummary, setCompleteSummary] = useState<TripCompleteSummary | null>(
    null
  );

  const passengerTotal = male + female + childMale + childFemale;
  const routeReady = routeStops.length >= 2;
  const passengersReady = passengerTotal > 0;
  const canComplete = Boolean(receiptUri && routeReady && passengersReady && !submitting);

  const publisherRef = useRef<ReturnType<typeof createLivePublisher> | null>(null);
  const lastLocationPush = useRef(0);
  const lastDbSync = useRef(0);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!driverId) return;
      if (!activeShift) {
        Alert.alert('Mesai gerekli', 'Önce mesaiye başlayın.');
        router.back();
        return;
      }
      if (!activeShift.hasVehicle || !activeShift.vehicleId) {
        Alert.alert('Araç gerekli', 'Yolculuk için önce bir araç almalısınız.');
        router.back();
        return;
      }

      const existing = await getActiveTrip();
      if (cancelled) return;

      if (existing && existing.driverId === driverId) {
        startedAtRef.current = existing.startedAtMs;
        const ok = await tracker.resume({
          distanceKm: existing.distanceKm,
          lastPoint: { lat: existing.lastLat, lng: existing.lastLng },
          lastTimestamp: existing.lastTs,
          startedAtMs: existing.startedAtMs,
          path: existing.path?.map((p) => ({ lat: p.lat, lng: p.lng })),
          trackerState: existing.trackerState,
        });
        if (cancelled) return;
        if (!ok) {
          Alert.alert('Konum', 'Yolculuk devam ettirilemedi.');
          router.back();
          return;
        }
        setTripId(existing.tripId);
        publisherRef.current = createLivePublisher(driverId);
        setPhase(existing.phase === 'payment' ? 'payment' : 'tracking');
        return;
      }

      const start = await tracker.start();
      if (cancelled) return;
      if (!start) {
        Alert.alert(
          'Konum alınamadı',
          tracker.error ??
            'Konum izni verin, GPS açık olsun ve mümkünse açık alanda deneyin.'
        );
        router.back();
        return;
      }
      startedAtRef.current = Date.now();
      const id = await startTrip(
        driverId,
        start,
        activeShift.vehicleId,
        activeShift.shiftId
      );
      if (!id) {
        Alert.alert('Hata', 'Yolculuk başlatılamadı.');
        router.back();
        return;
      }
      setTripId(id);
      publisherRef.current = createLivePublisher(driverId);
      setPhase('tracking');

      const snap = await getActiveTrip();
      if (snap) {
        await saveActiveTrip({
          ...snap,
          distanceKm: tracker.distanceKm,
          lastLat: tracker.currentPoint?.lat ?? snap.lastLat,
          lastLng: tracker.currentPoint?.lng ?? snap.lastLng,
          trackerState: tracker.snapshot(),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  useEffect(() => {
    void setDistanceWriter('foreground');
    const sub = AppState.addEventListener('change', (next) => {
      void setDistanceWriter(next === 'active' ? 'foreground' : 'background');
      if (next === 'active' && phase === 'tracking') {
        void readPersistedTripDistance().then((stored) => {
          if (stored) tracker.mergePersisted(stored);
        });
      }
    });
    return () => sub.remove();
  }, [phase, tracker]);

  useEffect(() => {
    if (phase !== 'tracking' || !tripId || !driverId) return;

    const live: LiveTripState = {
      trip_id: tripId,
      driver_id: driverId,
      status: 'ongoing',
      distance_km: tracker.distanceKm,
      duration_seconds: tracker.durationSeconds,
      amount: tracker.fare.total,
      updated_at: new Date().toISOString(),
    };
    publisherRef.current?.publish(live);

    const now = Date.now();
    if (tracker.currentPoint && now - lastLocationPush.current > 5000) {
      lastLocationPush.current = now;
      void pushDriverLocation(driverId, tracker.currentPoint);
      void saveActiveTrip({
        tripId,
        driverId,
        vehicleId: activeShift?.vehicleId ?? '',
        shiftId: activeShift?.shiftId ?? '',
        startedAtMs: startedAtRef.current,
        distanceKm: tracker.distanceKm,
        lastLat: tracker.currentPoint.lat,
        lastLng: tracker.currentPoint.lng,
        lastTs: now,
        phase: 'tracking',
        path: trimPath(tracker.path),
      });
    }

    if (now - lastDbSync.current > 5000) {
      lastDbSync.current = now;
      void syncOngoingTripProgress({
        tripId,
        distanceKm: tracker.distanceKm,
        startedAtMs: startedAtRef.current,
        routePath: trimPath(tracker.path),
      });
    }
  }, [
    phase,
    tripId,
    driverId,
    activeShift?.vehicleId,
    activeShift?.shiftId,
    tracker.distanceKm,
    tracker.durationSeconds,
    tracker.fare.total,
    tracker.currentPoint,
    tracker.path,
  ]);

  const onEndTrip = () => {
    tracker.stop();
    setPhase('payment');
    if (tripId && driverId && tracker.currentPoint) {
      void saveActiveTrip({
        tripId,
        driverId,
        vehicleId: activeShift?.vehicleId ?? '',
        shiftId: activeShift?.shiftId ?? '',
        startedAtMs: startedAtRef.current,
        distanceKm: tracker.distanceKm,
        lastLat: tracker.currentPoint.lat,
        lastLng: tracker.currentPoint.lng,
        lastTs: Date.now(),
        phase: 'payment',
        path: trimPath(tracker.path),
      });
      void syncOngoingTripProgress({
        tripId,
        distanceKm: tracker.distanceKm,
        startedAtMs: startedAtRef.current,
        routePath: trimPath(tracker.path),
      });
    }
  };

  const onSelectStop = (pick: RouteSelection) => {
    if (pickingIndex === null) return;
    if (pickingIndex === -1) {
      setRouteStops((prev) => [...prev, pick]);
    } else {
      setRouteStops((prev) => {
        const next = [...prev];
        next[pickingIndex] = pick;
        return next;
      });
    }
    setPickingIndex(null);
  };

  const onComplete = async () => {
    if (!tripId || !driverId || !receiptUri) return;
    if (!routeReady) {
      Alert.alert('Güzergah gerekli', 'En az 2 durak ekleyin.');
      return;
    }
    if (!passengersReady) {
      Alert.alert('Yolcu gerekli', 'En az bir yolcu seçin.');
      return;
    }

    const stopIds = routeStops.map((s) => s.stop.id);
    const startZone = zoneIdForStop(stopIds[0]) ?? routeStops[0].zone.id;
    const endZone =
      zoneIdForStop(stopIds[stopIds.length - 1]) ??
      routeStops[routeStops.length - 1].zone.id;

    setSubmitting(true);
    try {
      const upload = await uploadReceipt({
        tripId,
        fileUri: receiptUri,
      });
      if (upload.error || !upload.path) {
        Alert.alert('Fiş yüklenemedi', upload.error ?? 'Bilinmeyen hata');
        return;
      }
      const { error } = await finalizeTrip({
        tripId,
        end: tracker.currentPoint,
        distanceKm: Number(tracker.distanceKm.toFixed(3)),
        durationMinutes: Number((tracker.durationSeconds / 60).toFixed(2)),
        amount: tracker.fare.total,
        receiptUrl: upload.path,
        startZone,
        endZone,
        startStop: stopIds[0],
        endStop: stopIds[stopIds.length - 1],
        routeStops: stopIds,
        routePath: trimPath(tracker.path),
        passengerMale: male,
        passengerFemale: female,
        passengerChildMale: childMale,
        passengerChildFemale: childFemale,
        hasTourist,
      });
      if (error) {
        Alert.alert('Hata', error);
        return;
      }
      publisherRef.current?.close();
      setCompleteSummary({
        amount: tracker.fare.total,
        distanceKm: tracker.distanceKm,
        durationSeconds: tracker.durationSeconds,
        routeStops: stopIds,
        male,
        female,
        childMale,
        childFemale,
        hasTourist,
        receiptUri,
      });
      setPhase('complete');
    } finally {
      setSubmitting(false);
    }
  };

  const onCancelTrip = () => {
    Alert.alert('Yolculuğu iptal et', 'Bu yolculuk iptal edilsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'İptal Et',
        style: 'destructive',
        onPress: async () => {
          tracker.stop();
          if (tripId) await cancelTrip(tripId);
          publisherRef.current?.close();
          router.replace('/');
        },
      },
    ]);
  };

  if (phase === 'complete' && completeSummary) {
    return (
      <TripCompleteScreen
        summary={completeSummary}
        onHome={() => router.replace('/')}
      />
    );
  }

  if (pickingIndex !== null) {
    const isEdit = pickingIndex >= 0;
    return (
      <ZonePicker
        title={isEdit ? `DURAK ${pickingIndex + 1}` : 'YENİ DURAK'}
        onClose={() => setPickingIndex(null)}
        onSelect={onSelectStop}
      />
    );
  }

  if (showCamera) {
    return (
      <ReceiptCapture
        onCaptured={(uri) => {
          setReceiptUri(uri);
          setShowCamera(false);
        }}
        onCancel={() => setShowCamera(false)}
      />
    );
  }

  if (phase === 'starting') {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-8">
        <ActivityIndicator color="#F5C518" size="large" />
        <Text className="mt-6 text-xl font-bold text-brand-dark">Yolculuk hazırlanıyor</Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          Konum alınıyor… GPS açık olsun.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-8 px-4 py-2">
          <Text className="font-semibold text-brand-deep">Vazgeç</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'tracking') {
    return (
      <View className="flex-1 bg-canvas">
        <View className="flex-[1.15]">
          <TripMap path={tracker.path} current={tracker.currentPoint} />
        </View>
        <SafeAreaView edges={['bottom']}>
          <TripLivePanel
            amount={tracker.fare.total}
            distanceKm={tracker.distanceKm}
            durationSeconds={tracker.durationSeconds}
            speedKmh={tracker.speedKmh}
            onEnd={onEndTrip}
            onCancel={onCancelTrip}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-8 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 items-center rounded-3xl bg-white p-5 shadow-sm">
          <Text className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Yolculuğu tamamla
          </Text>
          <Text className="mt-1 text-5xl font-extrabold text-success">
            {formatTL(tracker.fare.total)}
          </Text>
          <View className="mt-4 w-full flex-row gap-2">
            <View className="flex-1 rounded-xl bg-canvas px-3 py-2">
              <Text className="text-xs text-slate-500">Mesafe</Text>
              <Text className="font-bold text-brand-dark">{formatKm(tracker.distanceKm)}</Text>
            </View>
            <View className="flex-1 rounded-xl bg-canvas px-3 py-2">
              <Text className="text-xs text-slate-500">Süre</Text>
              <Text className="font-bold text-brand-dark">
                {formatDuration(tracker.durationSeconds)}
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-6">
          <RouteStopBuilder
            stops={routeStops}
            onAdd={() => {
              if (routeStops.length >= MAX_ROUTE_STOPS) return;
              setPickingIndex(-1);
            }}
            onEdit={(i) => setPickingIndex(i)}
            onRemove={(i) =>
              setRouteStops((prev) => prev.filter((_, idx) => idx !== i))
            }
            onMoveUp={(i) =>
              setRouteStops((prev) => {
                if (i <= 0) return prev;
                const next = [...prev];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                return next;
              })
            }
            onMoveDown={(i) =>
              setRouteStops((prev) => {
                if (i >= prev.length - 1) return prev;
                const next = [...prev];
                [next[i], next[i + 1]] = [next[i + 1], next[i]];
                return next;
              })
            }
          />
        </View>

        <View className="mt-4">
          <PassengerSelector
            male={male}
            female={female}
            childMale={childMale}
            childFemale={childFemale}
            hasTourist={hasTourist}
            onMale={setMale}
            onFemale={setFemale}
            onChildMale={setChildMale}
            onChildFemale={setChildFemale}
            onTourist={setHasTourist}
          />
        </View>

        <View className="mt-4">
          <Card className="p-4">
            <Text className="mb-3 text-center text-sm text-slate-600">
              POS&apos;tan {formatTL(tracker.fare.total)} tahsil edin, ardından fişi
              fotoğraflayın.
            </Text>
            {receiptUri ? (
              <Image
                source={{ uri: receiptUri }}
                className="h-44 w-full rounded-xl bg-slate-100"
                resizeMode="cover"
              />
            ) : (
              <View className="h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-canvas">
                <Text className="text-slate-500">Henüz fiş yok</Text>
              </View>
            )}
            <Pressable
              onPress={() => setShowCamera(true)}
              className="mt-3 items-center rounded-xl bg-brand py-3 active:opacity-90"
            >
              <Text className="font-bold text-brand-dark">
                {receiptUri ? 'Fişi yeniden çek' : 'Fiş fotoğrafı çek'}
              </Text>
            </Pressable>
          </Card>
        </View>

        <View className="mt-4">
          <PrimaryButton
            label="Yolculuğu Tamamla"
            onPress={onComplete}
            disabled={!canComplete}
            loading={submitting}
            variant="success"
            className="py-5"
          />
          {!routeReady ? (
            <Text className="mt-2 text-center text-xs text-slate-500">
              En az 2 durak ekleyin
            </Text>
          ) : null}
          <Pressable onPress={onCancelTrip} className="mt-2 items-center py-3">
            <Text className="text-sm font-semibold text-danger">Yolculuğu iptal et</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
