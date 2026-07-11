import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  BILLING_TRACKER_OPTIONS,
  DistanceTracker,
  calculateFare,
  roundDistanceKm,
  type FareBreakdown,
  type LatLng,
  type TrackerOptions,
  type TrackerSnapshot,
} from '@bisicab/shared';
import { persistForegroundTracker } from '@/lib/activeTrip';

/** Konum alma sıklığı (ms). */
const SAMPLE_INTERVAL_MS = 2500;
/** OS minimum yer değiştirme (m). */
const DISTANCE_INTERVAL_M = 4;

const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: SAMPLE_INTERVAL_MS,
  distanceInterval: DISTANCE_INTERVAL_M,
};

export interface LocationTrackerState {
  isTracking: boolean;
  distanceKm: number;
  durationSeconds: number;
  speedKmh: number;
  currentPoint: LatLng | null;
  startPoint: LatLng | null;
  path: LatLng[];
  fare: FareBreakdown;
  permissionGranted: boolean;
  rejectedPings: number;
  error: string | null;
}

export interface UseLocationTrackerResult extends LocationTrackerState {
  start: () => Promise<LatLng | null>;
  resume: (seed: {
    distanceKm: number;
    lastPoint: LatLng;
    lastTimestamp: number;
    startedAtMs: number;
    path?: LatLng[];
    trackerState?: TrackerSnapshot;
  }) => Promise<boolean>;
  mergePersisted: (seed: {
    distanceKm: number;
    lastPoint: LatLng;
    lastTimestamp: number;
    trackerState?: TrackerSnapshot;
    path?: LatLng[];
  }) => void;
  snapshot: () => TrackerSnapshot;
  stop: () => {
    distanceKm: number;
    durationSeconds: number;
    fare: FareBreakdown;
    endPoint: LatLng | null;
  };
  reset: () => void;
}

export function useLocationTracker(
  options: TrackerOptions = {}
): UseLocationTrackerResult {
  const trackerRef = useRef<DistanceTracker>(
    new DistanceTracker({ ...BILLING_TRACKER_OPTIONS, ...options })
  );
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
    path: [],
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
    const ping = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy ?? undefined,
      timestamp: location.timestamp,
      speedMps: location.coords.speed,
    };

    const result = trackerRef.current.add(ping);
    const distanceKm = roundDistanceKm(trackerRef.current.totalDistanceKm);

    if (result.accepted && result.segmentKm > 0) {
      void persistForegroundTracker({
        trackerState: trackerRef.current.snapshot(),
        point: result.point,
        timestamp: ping.timestamp,
        segmentKm: result.segmentKm,
      });
    }

    setState((prev) => {
      if (!result.accepted) {
        return {
          ...prev,
          rejectedPings: prev.rejectedPings + 1,
          speedKmh: result.speedKmh,
          currentPoint: result.point,
          distanceKm: Math.max(prev.distanceKm, distanceKm),
        };
      }
      return {
        ...prev,
        distanceKm,
        speedKmh: result.speedKmh,
        currentPoint: result.point,
        startPoint: prev.startPoint ?? result.point,
        path:
          result.segmentKm > 0
            ? [...prev.path, result.point]
            : prev.path.length === 0
              ? [result.point]
              : prev.path,
        fare: calculateFare(distanceKm),
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

      await Location.enableNetworkProviderAsync().catch(() => {});

      trackerRef.current.reset();
      startTimeRef.current = Date.now();

      let initial: Location.LocationObject | null = null;
      try {
        initial = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
            mayShowUserSettingsDialog: true,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 8000)
          ),
        ]);
      } catch {
        initial = await Location.getLastKnownPositionAsync({
          maxAge: 60_000,
          requiredAccuracy: 200,
        });
      }

      if (!initial) {
        setState((p) => ({
          ...p,
          error: 'Konum alınamadı. Açık alanda tekrar deneyin.',
        }));
        return null;
      }

      handlePing(initial);
      const startPoint: LatLng = {
        lat: initial.coords.latitude,
        lng: initial.coords.longitude,
      };

      subscriptionRef.current = await Location.watchPositionAsync(
        WATCH_OPTIONS,
        handlePing
      );

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

  const resume = useCallback(
    async (seed: {
      distanceKm: number;
      lastPoint: LatLng;
      lastTimestamp: number;
      startedAtMs: number;
      path?: LatLng[];
      trackerState?: TrackerSnapshot;
    }): Promise<boolean> => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return false;

        clearTimers();
        if (seed.trackerState) {
          trackerRef.current.restore(seed.trackerState);
        } else {
          trackerRef.current.hydrate({
            totalKm: seed.distanceKm,
            lastPoint: seed.lastPoint,
            lastTimestamp: seed.lastTimestamp,
          });
        }
        startTimeRef.current = seed.startedAtMs;

        subscriptionRef.current = await Location.watchPositionAsync(
          WATCH_OPTIONS,
          handlePing
        );

        tickRef.current = setInterval(() => {
          if (startTimeRef.current == null) return;
          const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setState((p) => ({ ...p, durationSeconds: seconds }));
        }, 1000);

        const elapsed = Math.floor((Date.now() - seed.startedAtMs) / 1000);
        const km = roundDistanceKm(trackerRef.current.totalDistanceKm);
        const restoredPath =
          seed.path && seed.path.length > 0 ? seed.path : [seed.lastPoint];
        setState((p) => ({
          ...p,
          isTracking: true,
          permissionGranted: true,
          distanceKm: km,
          durationSeconds: elapsed,
          currentPoint: seed.lastPoint,
          startPoint: restoredPath[0] ?? seed.lastPoint,
          path: restoredPath,
          fare: calculateFare(km),
          speedKmh: 0,
          error: null,
        }));
        return true;
      } catch {
        return false;
      }
    },
    [clearTimers, handlePing]
  );

  const mergePersisted = useCallback(
    (seed: {
      distanceKm: number;
      lastPoint: LatLng;
      lastTimestamp: number;
      trackerState?: TrackerSnapshot;
      path?: LatLng[];
    }) => {
      const storedKm = roundDistanceKm(seed.distanceKm);
      const localKm = roundDistanceKm(trackerRef.current.totalDistanceKm);
      if (storedKm <= localKm && !seed.trackerState) return;

      if (seed.trackerState && storedKm >= localKm) {
        trackerRef.current.restore(seed.trackerState);
      } else if (storedKm > localKm) {
        trackerRef.current.hydrate({
          totalKm: storedKm,
          lastPoint: seed.lastPoint,
          lastTimestamp: seed.lastTimestamp,
        });
      }

      const km = roundDistanceKm(trackerRef.current.totalDistanceKm);
      setState((p) => ({
        ...p,
        distanceKm: km,
        currentPoint: seed.lastPoint,
        fare: calculateFare(km),
        path:
          seed.path && seed.path.length > p.path.length
            ? seed.path.map((pt) => ({ lat: pt.lat, lng: pt.lng }))
            : p.path,
      }));
    },
    []
  );

  const snapshot = useCallback(() => trackerRef.current.snapshot(), []);

  const stop = useCallback(() => {
    clearTimers();
    const distanceKm = roundDistanceKm(trackerRef.current.totalDistanceKm);
    const durationSeconds =
      startTimeRef.current != null
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : 0;
    const fare = calculateFare(distanceKm);
    let endPoint: LatLng | null = null;

    setState((p) => {
      endPoint = p.currentPoint;
      return { ...p, isTracking: false, durationSeconds, fare, speedKmh: 0 };
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
      path: [],
      fare: calculateFare(0),
      permissionGranted: false,
      rejectedPings: 0,
      error: null,
    });
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  return { ...state, start, resume, mergePersisted, snapshot, stop, reset };
}
