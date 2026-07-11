import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BILLING_TRACKER_OPTIONS,
  DistanceTracker,
  calculateFare,
  roundDistanceKm,
  type RawPing,
  type TrackerSnapshot,
} from '@bisicab/shared';
import { supabase } from './supabase';

const ACTIVE_TRIP_KEY = 'bisicab.activeTrip';
const DISTANCE_WRITER_KEY = 'bisicab.distanceWriter';
const MAX_PATH_POINTS = 400;

export type DistanceWriter = 'foreground' | 'background';

export async function setDistanceWriter(writer: DistanceWriter): Promise<void> {
  await AsyncStorage.setItem(DISTANCE_WRITER_KEY, writer);
}

export async function getDistanceWriter(): Promise<DistanceWriter> {
  const v = await AsyncStorage.getItem(DISTANCE_WRITER_KEY);
  return v === 'background' ? 'background' : 'foreground';
}

/** Arka plan / yeniden açılış için aktif yolculuk anlık görüntüsü. */
export interface ActiveTripSnapshot {
  tripId: string;
  driverId: string;
  vehicleId: string;
  shiftId: string;
  startedAtMs: number;
  distanceKm: number;
  lastLat: number;
  lastLng: number;
  lastTs: number;
  phase: 'tracking' | 'payment';
  /** Tam mesafe sayacı durumu (ön/arka plan aynı mantık). */
  trackerState?: TrackerSnapshot;
  /** Harita rotası — son ~400 nokta. */
  path?: Array<{ lat: number; lng: number }>;
}

function appendPath(
  path: Array<{ lat: number; lng: number }> | undefined,
  point: { lat: number; lng: number }
): Array<{ lat: number; lng: number }> {
  const next = [...(path ?? []), point];
  if (next.length <= MAX_PATH_POINTS) return next;
  return next.slice(-MAX_PATH_POINTS);
}

export async function getActiveTrip(): Promise<ActiveTripSnapshot | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveTripSnapshot;
  } catch {
    return null;
  }
}

export async function saveActiveTrip(snap: ActiveTripSnapshot): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(snap));
}

export async function clearActiveTrip(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
}

/** Devam eden yolculuğun km/tutar ve GPS izini DB'ye yazar. */
export async function syncOngoingTripProgress(params: {
  tripId: string;
  distanceKm: number;
  startedAtMs: number;
  routePath?: Array<{ lat: number; lng: number }>;
}): Promise<void> {
  const km = roundDistanceKm(params.distanceKm);
  const fare = calculateFare(km);
  const durationMinutes = (Date.now() - params.startedAtMs) / 60_000;
  const payload: Record<string, unknown> = {
    total_distance: km,
    total_duration: Number(durationMinutes.toFixed(2)),
    total_amount: fare.total,
  };
  if (params.routePath?.length) {
    payload.route_path = params.routePath;
  }
  await supabase
    .from('trips')
    .update(payload)
    .eq('id', params.tripId)
    .eq('status', 'ongoing');
}

function trackerFromSnapshot(snap: ActiveTripSnapshot): DistanceTracker {
  const tracker = new DistanceTracker(BILLING_TRACKER_OPTIONS);
  if (snap.trackerState) {
    tracker.restore(snap.trackerState);
    return tracker;
  }
  tracker.hydrate({
    totalKm: snap.distanceKm,
    lastPoint: { lat: snap.lastLat, lng: snap.lastLng },
    lastTimestamp: snap.lastTs,
  });
  return tracker;
}

/**
 * Arka plan GPS ping'i — ön plandaki sayaçla aynı filtreyi uygular.
 * (Yalnızca headless görevden çağrılır; ön planda hook doğrudan tracker kullanır.)
 */
export async function processTripLocationPing(
  ping: RawPing
): Promise<ActiveTripSnapshot | null> {
  if ((await getDistanceWriter()) === 'foreground') {
    return getActiveTrip();
  }

  const snap = await getActiveTrip();
  if (!snap || snap.phase !== 'tracking') return null;
  if (ping.timestamp <= snap.lastTs) return snap;

  const tracker = trackerFromSnapshot(snap);
  const result = tracker.add(ping);
  const distanceKm = roundDistanceKm(tracker.totalDistanceKm);

  const next: ActiveTripSnapshot = {
    ...snap,
    distanceKm,
    lastLat: result.point.lat,
    lastLng: result.point.lng,
    lastTs: ping.timestamp,
    trackerState: tracker.snapshot(),
    path:
      result.accepted && result.segmentKm > 0
        ? appendPath(snap.path, result.point)
        : snap.path,
  };

  await saveActiveTrip(next);

  if (result.accepted && result.segmentKm > 0) {
    await syncOngoingTripProgress({
      tripId: snap.tripId,
      distanceKm,
      startedAtMs: snap.startedAtMs,
      routePath: next.path,
    });
  }

  return next;
}

/** Ön plandaki sayacı depoya yazar (her kabul edilen ping sonrası). */
export async function persistForegroundTracker(params: {
  trackerState: TrackerSnapshot;
  point: { lat: number; lng: number };
  timestamp: number;
  segmentKm: number;
}): Promise<void> {
  if ((await getDistanceWriter()) !== 'foreground') return;

  const snap = await getActiveTrip();
  if (!snap || snap.phase !== 'tracking') return;
  if (params.timestamp <= snap.lastTs) return;

  const distanceKm = roundDistanceKm(params.trackerState.totalKm);
  const next: ActiveTripSnapshot = {
    ...snap,
    distanceKm,
    lastLat: params.point.lat,
    lastLng: params.point.lng,
    lastTs: params.timestamp,
    trackerState: params.trackerState,
    path:
      params.segmentKm > 0
        ? appendPath(snap.path, params.point)
        : snap.path,
  };
  await saveActiveTrip(next);
}

export async function readPersistedTripDistance(): Promise<{
  distanceKm: number;
  lastPoint: { lat: number; lng: number };
  lastTimestamp: number;
  trackerState?: TrackerSnapshot;
  path?: Array<{ lat: number; lng: number }>;
} | null> {
  const snap = await getActiveTrip();
  if (!snap || snap.phase !== 'tracking') return null;
  return {
    distanceKm: snap.distanceKm,
    lastPoint: { lat: snap.lastLat, lng: snap.lastLng },
    lastTimestamp: snap.lastTs,
    trackerState: snap.trackerState,
    path: snap.path,
  };
}
