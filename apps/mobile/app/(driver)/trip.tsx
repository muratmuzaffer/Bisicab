import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LiveTripState } from '@bisicab/shared';
import { useLocationTracker } from '@/hooks/useLocationTracker';
import { useAuthStore } from '@/store/authStore';
import { useTripStore } from '@/store/tripStore';
import { createLivePublisher } from '@/lib/liveTrip';
import { pushDriverLocation, setDriverInactive } from '@/lib/driverLocation';
import { uploadReceipt } from '@/lib/receipts';
import { ReceiptCapture } from '@/components/ReceiptCapture';
import { formatDuration, formatKm, formatTL } from '@/lib/format';

type Phase = 'starting' | 'tracking' | 'payment';

export default function TripScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { startTrip, finalizeTrip, cancelTrip } = useTripStore();
  const tracker = useLocationTracker();

  const [phase, setPhase] = useState<Phase>('starting');
  const [tripId, setTripId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const publisherRef = useRef<ReturnType<typeof createLivePublisher> | null>(null);
  const lastLocationPush = useRef(0);

  // Yolculuğu başlat: izin + takip + trip kaydı + canlı yayın.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile) return;
      const start = await tracker.start();
      if (cancelled) return;
      const id = await startTrip(profile.id, start);
      if (!id) {
        Alert.alert('Hata', 'Yolculuk başlatılamadı.');
        router.back();
        return;
      }
      setTripId(id);
      publisherRef.current = createLivePublisher(profile.id);
      setPhase('tracking');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Canlı veriyi yolcu tabletine yayınla + sürücü konumunu güncelle.
  useEffect(() => {
    if (phase !== 'tracking' || !tripId || !profile) return;

    const live: LiveTripState = {
      trip_id: tripId,
      driver_id: profile.id,
      status: 'ongoing',
      distance_km: tracker.distanceKm,
      duration_seconds: tracker.durationSeconds,
      amount: tracker.fare.total,
      updated_at: new Date().toISOString(),
    };
    publisherRef.current?.publish(live);

    // Konumu en fazla 5 sn'de bir DB'ye yaz (admin canlı takip).
    const now = Date.now();
    if (tracker.currentPoint && now - lastLocationPush.current > 5000) {
      lastLocationPush.current = now;
      void pushDriverLocation(profile.id, tracker.currentPoint);
    }
  }, [
    phase,
    tripId,
    profile,
    tracker.distanceKm,
    tracker.durationSeconds,
    tracker.fare.total,
    tracker.currentPoint,
  ]);

  const onEndTrip = () => {
    tracker.stop();
    setPhase('payment');
  };

  const onComplete = async () => {
    if (!tripId || !profile || !receiptUri) return;
    setSubmitting(true);
    try {
      const upload = await uploadReceipt({
        driverId: profile.id,
        tripId,
        fileUri: receiptUri,
      });
      if (upload.error || !upload.url) {
        Alert.alert('Fiş yüklenemedi', upload.error ?? 'Bilinmeyen hata');
        return;
      }
      const { error } = await finalizeTrip({
        tripId,
        end: tracker.currentPoint,
        distanceKm: Number(tracker.distanceKm.toFixed(3)),
        durationMinutes: Number((tracker.durationSeconds / 60).toFixed(2)),
        amount: tracker.fare.total,
        receiptUrl: upload.url,
      });
      if (error) {
        Alert.alert('Hata', error);
        return;
      }
      await setDriverInactive(profile.id);
      publisherRef.current?.close();
      router.replace('/(driver)/home');
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
          if (profile) await setDriverInactive(profile.id);
          publisherRef.current?.close();
          router.replace('/(driver)/home');
        },
      },
    ]);
  };

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
      <View className="flex-1 items-center justify-center bg-brand-dark">
        <ActivityIndicator color="#fff" />
        <Text className="mt-4 text-white">Konum alınıyor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-dark">
      <View className="flex-1 px-6 pt-6">
        {/* Canlı metrikler */}
        <View className="flex-1 items-center justify-center">
          <Text className="mb-2 text-base text-brand-light">GÜNCEL TUTAR</Text>
          <Text className="text-7xl font-extrabold text-white">
            {formatTL(tracker.fare.total)}
          </Text>

          <View className="mt-12 w-full flex-row justify-around">
            <View className="items-center">
              <Text className="text-sm text-brand-light">MESAFE</Text>
              <Text className="mt-1 text-3xl font-bold text-white">
                {formatKm(tracker.distanceKm)}
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-sm text-brand-light">SÜRE</Text>
              <Text className="mt-1 text-3xl font-bold text-white">
                {formatDuration(tracker.durationSeconds)}
              </Text>
            </View>
          </View>

          {tracker.rejectedPings > 0 ? (
            <Text className="mt-6 text-xs text-brand-light/70">
              {tracker.rejectedPings} hatalı GPS sinyali filtrelendi
            </Text>
          ) : null}
        </View>

        {phase === 'tracking' ? (
          <View className="pb-6">
            <Pressable
              onPress={onEndTrip}
              className="items-center rounded-3xl bg-danger py-8 active:opacity-90"
            >
              <Text className="text-3xl font-extrabold text-white">
                YOLCULUĞU BİTİR
              </Text>
            </Pressable>
            <Pressable onPress={onCancelTrip} className="mt-3 items-center py-2">
              <Text className="text-brand-light">Yolculuğu İptal Et</Text>
            </Pressable>
          </View>
        ) : (
          // Ödeme / fiş aşaması
          <View className="pb-6">
            <View className="mb-4 rounded-2xl bg-white/10 p-4">
              <Text className="mb-2 text-center text-white">
                POS'tan {formatTL(tracker.fare.total)} çekim yapın, ardından fişi
                fotoğraflayın.
              </Text>
              {receiptUri ? (
                <Image
                  source={{ uri: receiptUri }}
                  className="mt-2 h-40 w-full rounded-xl"
                  resizeMode="cover"
                />
              ) : null}
            </View>

            <Pressable
              onPress={() => setShowCamera(true)}
              className="mb-3 items-center rounded-2xl bg-brand py-4 active:opacity-90"
            >
              <Text className="text-lg font-bold text-white">
                {receiptUri ? 'Fişi Yeniden Çek' : 'Fiş Fotoğrafı Çek/Yükle'}
              </Text>
            </Pressable>

            <Pressable
              onPress={onComplete}
              disabled={!receiptUri || submitting}
              className={`items-center rounded-2xl py-5 ${
                receiptUri ? 'bg-success' : 'bg-slate-600'
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-xl font-extrabold text-white">
                  Yolculuğu Tamamla
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
