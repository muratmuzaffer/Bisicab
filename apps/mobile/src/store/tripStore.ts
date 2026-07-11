import { create } from 'zustand';
import type { LatLng, Trip } from '@bisicab/shared';
import { roundDistanceKm } from '@bisicab/shared';
import { supabase } from '@/lib/supabase';
import {
  clearActiveTrip,
  getActiveTrip,
  saveActiveTrip,
  type ActiveTripSnapshot,
} from '@/lib/activeTrip';


interface DaySummary {
  rides: number;
  earnings: number;
}

interface TripState {
  activeTripId: string | null;
  receiptUrl: string | null;
  todaySummary: DaySummary;
  ongoingTrip: ActiveTripSnapshot | null;

  loadOngoingTrip: () => Promise<ActiveTripSnapshot | null>;
  resetSession: () => Promise<void>;
  startTrip: (
    driverId: string,
    start: LatLng | null,
    vehicleId: string,
    shiftId: string
  ) => Promise<string | null>;
  finalizeTrip: (params: {
    tripId: string;
    end: LatLng | null;
    distanceKm: number;
    durationMinutes: number;
    amount: number;
    receiptUrl: string;
    startZone: string;
    endZone: string;
    startStop: string;
    endStop: string;
    routeStops: string[];
    routePath: Array<{ lat: number; lng: number }>;
    passengerMale: number;
    passengerFemale: number;
    passengerChildMale: number;
    passengerChildFemale: number;
    hasTourist: boolean;
  }) => Promise<{ error?: string }>;
  cancelTrip: (tripId: string) => Promise<void>;
  setReceiptUrl: (url: string | null) => void;
  loadTodaySummary: (driverId: string) => Promise<void>;
  clearActive: () => void;
}

export const useTripStore = create<TripState>((set) => ({
  activeTripId: null,
  receiptUrl: null,
  todaySummary: { rides: 0, earnings: 0 },
  ongoingTrip: null,

  loadOngoingTrip: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      set({ ongoingTrip: null, activeTripId: null });
      return null;
    }

    const local = await getActiveTrip();
    if (local) {
      if (local.driverId === user.id) {
        set({ ongoingTrip: local, activeTripId: local.tripId });
        return local;
      }
      await clearActiveTrip();
    }

    const { data } = await supabase
      .from('trips')
      .select('id, vehicle_id, shift_id, start_lat, start_lng, total_distance, created_at')
      .eq('driver_id', user.id)
      .eq('status', 'ongoing')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      set({ ongoingTrip: null, activeTripId: null });
      return null;
    }

    const snap: ActiveTripSnapshot = {
      tripId: data.id,
      driverId: user.id,
      vehicleId: data.vehicle_id ?? '',
      shiftId: data.shift_id ?? '',
      startedAtMs: new Date(data.created_at).getTime(),
      distanceKm: Number(data.total_distance ?? 0),
      lastLat: data.start_lat ?? 0,
      lastLng: data.start_lng ?? 0,
      lastTs: Date.now(),
      phase: 'tracking',
    };
    await saveActiveTrip(snap);
    set({ ongoingTrip: snap, activeTripId: snap.tripId });
    return snap;
  },

  startTrip: async (driverId, start, vehicleId, shiftId) => {
    const existing = await getActiveTrip();
    if (existing) {
      if (existing.driverId === driverId) {
        set({ activeTripId: existing.tripId, ongoingTrip: existing });
        return existing.tripId;
      }
      await clearActiveTrip();
    }

    const { data: open } = await supabase
      .from('trips')
      .select('id')
      .eq('driver_id', driverId)
      .eq('status', 'ongoing')
      .limit(1)
      .maybeSingle();

    if (open?.id) {
      const snap: ActiveTripSnapshot = {
        tripId: open.id,
        driverId,
        vehicleId,
        shiftId,
        startedAtMs: Date.now(),
        distanceKm: 0,
        lastLat: start?.lat ?? 0,
        lastLng: start?.lng ?? 0,
        lastTs: Date.now(),
        phase: 'tracking',
      };
      await saveActiveTrip(snap);
      set({ activeTripId: open.id, ongoingTrip: snap, receiptUrl: null });
      return open.id;
    }

    const { data, error } = await supabase
      .from('trips')
      .insert({
        driver_id: driverId,
        vehicle_id: vehicleId,
        shift_id: shiftId,
        start_lat: start?.lat ?? null,
        start_lng: start?.lng ?? null,
        status: 'ongoing',
      })
      .select('id')
      .single();

    if (error || !data) return null;

    const snap: ActiveTripSnapshot = {
      tripId: data.id,
      driverId,
      vehicleId,
      shiftId,
      startedAtMs: Date.now(),
      distanceKm: 0,
      lastLat: start?.lat ?? 0,
      lastLng: start?.lng ?? 0,
      lastTs: Date.now(),
      phase: 'tracking',
    };
    await saveActiveTrip(snap);
    set({ activeTripId: data.id, receiptUrl: null, ongoingTrip: snap });
    return data.id;
  },

  finalizeTrip: async ({
    tripId,
    end,
    distanceKm,
    durationMinutes,
    amount,
    receiptUrl,
    startZone,
    endZone,
    startStop,
    endStop,
    routeStops,
    routePath,
    passengerMale,
    passengerFemale,
    passengerChildMale,
    passengerChildFemale,
    hasTourist,
  }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Oturum bulunamadı.' };

    const childTotal = passengerChildMale + passengerChildFemale;

    const basePayload = {
      end_lat: end?.lat ?? null,
      end_lng: end?.lng ?? null,
      total_distance: roundDistanceKm(distanceKm),
      total_duration: durationMinutes,
      total_amount: amount,
      receipt_image_url: receiptUrl,
      start_zone: startZone,
      end_zone: endZone,
      start_stop: startStop,
      end_stop: endStop,
      passenger_male: passengerMale,
      passenger_female: passengerFemale,
      passenger_child: childTotal,
      has_tourist: hasTourist,
      status: 'completed' as const,
      ended_at: new Date().toISOString(),
    };

    const extendedPayload = {
      ...basePayload,
      route_stops: routeStops,
      route_path: routePath.length > 0 ? routePath : null,
      passenger_child_male: passengerChildMale,
      passenger_child_female: passengerChildFemale,
    };

    const { error: baseError } = await supabase
      .from('trips')
      .update(basePayload)
      .eq('id', tripId)
      .eq('driver_id', user.id);

    if (baseError) return { error: baseError.message };

    const { error: metaError } = await supabase
      .from('trips')
      .update(extendedPayload)
      .eq('id', tripId)
      .eq('driver_id', user.id);

    if (
      metaError &&
      !(
        metaError.code === 'PGRST204' ||
        metaError.message.includes('schema cache') ||
        metaError.message.includes('passenger_child') ||
        metaError.message.includes('route_stops') ||
        metaError.message.includes('route_path')
      )
    ) {
      return { error: metaError.message };
    }

    if (metaError && routePath.length > 0) {
      await supabase
        .from('trips')
        .update({ route_path: routePath })
        .eq('id', tripId)
        .eq('driver_id', user.id);
    }

    await clearActiveTrip();
    set({ activeTripId: null, receiptUrl: null, ongoingTrip: null });
    return {};
  },

  cancelTrip: async (tripId) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('trips')
      .update({ status: 'cancelled', ended_at: new Date().toISOString() })
      .eq('id', tripId)
      .eq('driver_id', user.id);
    await clearActiveTrip();
    set({ activeTripId: null, receiptUrl: null, ongoingTrip: null });
  },

  setReceiptUrl: (url) => set({ receiptUrl: url }),

  loadTodaySummary: async (driverId) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uid = user?.id ?? driverId;
    if (!uid) {
      set({ todaySummary: { rides: 0, earnings: 0 } });
      return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('trips')
      .select('total_amount')
      .eq('driver_id', uid)
      .eq('status', 'completed')
      .gte('created_at', startOfDay.toISOString());

    const rows = (data as Pick<Trip, 'total_amount'>[]) ?? [];
    const earnings = rows.reduce((sum, r) => sum + Number(r.total_amount), 0);
    set({ todaySummary: { rides: rows.length, earnings } });
  },

  clearActive: () => set({ activeTripId: null, receiptUrl: null, ongoingTrip: null }),

  resetSession: async () => {
    await clearActiveTrip();
    set({
      activeTripId: null,
      receiptUrl: null,
      ongoingTrip: null,
      todaySummary: { rides: 0, earnings: 0 },
    });
  },
}));
