import { create } from 'zustand';
import type { LatLng, Trip } from '@bisicab/shared';
import { supabase } from '@/lib/supabase';

interface DaySummary {
  rides: number;
  earnings: number;
}

interface TripState {
  activeTripId: string | null;
  receiptUrl: string | null;
  todaySummary: DaySummary;

  startTrip: (driverId: string, start: LatLng | null) => Promise<string | null>;
  finalizeTrip: (params: {
    tripId: string;
    end: LatLng | null;
    distanceKm: number;
    durationMinutes: number;
    amount: number;
    receiptUrl: string;
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

  startTrip: async (driverId, start) => {
    const { data, error } = await supabase
      .from('trips')
      .insert({
        driver_id: driverId,
        start_lat: start?.lat ?? null,
        start_lng: start?.lng ?? null,
        status: 'ongoing',
      })
      .select('id')
      .single();

    if (error || !data) return null;
    set({ activeTripId: data.id, receiptUrl: null });
    return data.id;
  },

  finalizeTrip: async ({
    tripId,
    end,
    distanceKm,
    durationMinutes,
    amount,
    receiptUrl,
  }) => {
    const { error } = await supabase
      .from('trips')
      .update({
        end_lat: end?.lat ?? null,
        end_lng: end?.lng ?? null,
        total_distance: distanceKm,
        total_duration: durationMinutes,
        total_amount: amount,
        receipt_image_url: receiptUrl,
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (error) return { error: error.message };
    set({ activeTripId: null, receiptUrl: null });
    return {};
  },

  cancelTrip: async (tripId) => {
    await supabase
      .from('trips')
      .update({ status: 'cancelled', ended_at: new Date().toISOString() })
      .eq('id', tripId);
    set({ activeTripId: null, receiptUrl: null });
  },

  setReceiptUrl: (url) => set({ receiptUrl: url }),

  loadTodaySummary: async (driverId) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('trips')
      .select('total_amount')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .gte('created_at', startOfDay.toISOString());

    const rows = (data as Pick<Trip, 'total_amount'>[]) ?? [];
    const earnings = rows.reduce((sum, r) => sum + Number(r.total_amount), 0);
    set({ todaySummary: { rides: rows.length, earnings } });
  },

  clearActive: () => set({ activeTripId: null, receiptUrl: null }),
}));
