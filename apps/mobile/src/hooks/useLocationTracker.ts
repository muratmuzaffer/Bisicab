import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  DistanceTracker,
  calculateFare,
  type FareBreakdown,
  type LatLng,
  type TrackerOptions,
} from '@bisicab/shared';

/** Konum alma sıklığı (ms). İş kuralı: her 3 saniyede bir ping. */
const SAMPLE_INTERVAL_MS = 3000;
/** Konumlar arası minimum mesafe eşiği (metre). */
const DISTANCE_INTERVAL_M = 2;

export interface LocationTrackerState {
  /** Takip aktif mi? */
  isTracking: boolean;
  /** Kümülatif mesafe (km). */
  distanceKm: number;
  /** Geçen süre (saniye). */
  durationSeconds: number;
  /** Anlık hız (km/s). */
  speedKmh: number;
  /** Filtrelenmiş güncel konum. */
  currentPoint: LatLng | null;
  /** Başlangıç konumu. */
  startPoint: LatLng | null;
  /** Güncel ücret dökümü. */
  fare: FareBreakdown;
  /** Konum izni verildi mi? */
  permissionGranted: boolean;
  /** Elenen (hatalı/hızlı) ping sayısı. */
  rejectedPings: number;
  error: string | null;
}

export interface UseLocationTrackerResult extends LocationTrackerState {
  /** İzin ister, takibi başlatır. Başarılıysa başlangıç konumunu döndürür. */
  start: () => Promise<LatLng | null>;
  /** Takibi durdurur. Son durumu döndürür. */
  stop: () => {
    distanceKm: number;
    durationSeconds: number;
    fare: FareBreakdown;
    endPoint: LatLng | null;
  };
  /** Sayaçları sıfırlar (yeni yolculuğa hazırlık). */
  reset: () => void;
}

/**
 * Hassas mesafe/süre/ücret takibi için custom hook.
 *
 * - expo-location ile 3 saniyede bir konum örneği alır.
 * - Ham veriyi Kalman filtresinden geçirir (jitter yumuşatma).
 * - Ardışık noktalar arasını Haversine ile ölçer, kümülatif toplar.
 * - 30 km/s üzeri (mantıksız) segmentleri eler.
 * - Anlık ücreti @bisicab/shared ücret motoruyla hesaplar.
 */
export function useLocationTracker(
  options: TrackerOptions = {}
): UseLocationTrackerResult {
  const trackerRef = useRef<DistanceTracker>(new DistanceTracker(options));
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<LocationTrackerState>(() => ({
    isTracking: false,
    distanceKm: 0,
    durationSeconds: 0,
    speedKmh: 0,
    currentPoint: null,
    startPoint: null,
    fare: calculateFare(0),
    permissionGranted: false,
    rejectedPings: 0,
    error: null,
  }));

  const clearTimers = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const handlePing = useCallback((location: Location.LocationObject) => {
    const result = trackerRef.current.add({
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy ?? undefined,
      timestamp: location.timestamp,
    });

    setState((prev) => {
      if (!result.accepted) {
        return { ...prev, rejectedPings: prev.rejectedPings + 1 };
      }
      return {
        ...prev,
        distanceKm: result.totalDistanceKm,
        speedKmh: result.speedKmh,
        currentPoint: result.point,
        startPoint: prev.startPoint ?? result.point,
        fare: calculateFare(result.totalDistanceKm),
      };
    });
  }, []);

  const start = useCallback(async (): Promise<LatLng | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState((p) => ({
          ...p,
          permissionGranted: false,
          error: 'Konum izni reddedildi.',
        }));
        return null;
      }

      trackerRef.current.reset();
      startTimeRef.current = Date.now();

      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      handlePing(initial);
      const startPoint: LatLng = {
        lat: initial.coords.latitude,
        lng: initial.coords.longitude,
      };

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: SAMPLE_INTERVAL_MS,
          distanceInterval: DISTANCE_INTERVAL_M,
        },
        handlePing
      );

      // Süre sayacı (her saniye).
      tickRef.current = setInterval(() => {
        if (startTimeRef.current == null) return;
        const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState((p) => ({ ...p, durationSeconds: seconds }));
      }, 1000);

      setState((p) => ({
        ...p,
        isTracking: true,
        permissionGranted: true,
        startPoint,
        error: null,
      }));

      return startPoint;
    } catch (e) {
      setState((p) => ({
        ...p,
        error: e instanceof Error ? e.message : 'Konum takibi başlatılamadı.',
      }));
      return null;
    }
  }, [handlePing]);

  const stop = useCallback(() => {
    clearTimers();
    const distanceKm = trackerRef.current.totalDistanceKm;
    const durationSeconds =
      startTimeRef.current != null
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : 0;
    const fare = calculateFare(distanceKm);
    let endPoint: LatLng | null = null;

    setState((p) => {
      endPoint = p.currentPoint;
      return { ...p, isTracking: false, durationSeconds, fare };
    });

    return { distanceKm, durationSeconds, fare, endPoint };
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    trackerRef.current.reset();
    startTimeRef.current = null;
    setState({
      isTracking: false,
      distanceKm: 0,
      durationSeconds: 0,
      speedKmh: 0,
      currentPoint: null,
      startPoint: null,
      fare: calculateFare(0),
      permissionGranted: false,
      rejectedPings: 0,
      error: null,
    });
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  return { ...state, start, stop, reset };
}
