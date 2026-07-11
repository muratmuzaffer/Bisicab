import { create } from 'zustand';

import type { Vehicle } from '@bisicab/shared';

import { supabase } from '@/lib/supabase';



export interface ActiveShift {

  shiftId: string;

  vehicleId: string | null;

  plate: string | null;

  label: string | null;

  startedAt: string;

  plannedDurationHours: number;

  plannedEndAt: string;

  hasVehicle: boolean;

}



interface ShiftState {

  activeShift: ActiveShift | null;

  availableVehicles: Vehicle[];

  loading: boolean;



  loadActiveShift: () => Promise<void>;

  loadAvailableVehicles: () => Promise<void>;

  reset: () => void;

  beginShift: (hours: 4 | 8) => Promise<{ error?: string; recovered?: boolean }>;

  takeVehicle: (vehicle: Vehicle) => Promise<{ error?: string }>;

  releaseVehicle: () => Promise<{ error?: string }>;

  endShift: () => Promise<{ error?: string }>;

}



function mapRpcRow(row: {

  shift_id: string;

  vehicle_id: string | null;

  plate: string | null;

  label: string | null;

  started_at: string;

  planned_duration_hours: number | null;

  planned_end_at: string | null;

  has_vehicle: boolean;

}): ActiveShift {

  return {

    shiftId: row.shift_id,

    vehicleId: row.vehicle_id,

    plate: row.plate,

    label: row.label,

    startedAt: row.started_at,

    plannedDurationHours: row.planned_duration_hours ?? 8,

    plannedEndAt: row.planned_end_at ?? row.started_at,

    hasVehicle: row.has_vehicle,

  };

}



async function fetchActiveShift(): Promise<ActiveShift | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    'get_my_active_shift'
  );

  if (!rpcError && rpcRows && rpcRows.length > 0) {
    return mapRpcRow(rpcRows[0]);
  }

  // Yedek sorgu: yalnızca oturum açmış sürücünün mesaisi (admin RLS tüm mesaileri görür).
  const { data: shift } = await supabase
    .from('shifts')
    .select('id, vehicle_id, started_at, planned_duration_hours, planned_end_at')
    .eq('driver_id', user.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();



  if (!shift) return null;



  let plate: string | null = null;

  let label: string | null = null;

  if (shift.vehicle_id) {

    const { data: vehicle } = await supabase

      .from('vehicles')

      .select('plate, label')

      .eq('id', shift.vehicle_id)

      .maybeSingle();

    plate = vehicle?.plate ?? null;

    label = vehicle?.label ?? null;

  }



  return {

    shiftId: shift.id,

    vehicleId: shift.vehicle_id,

    plate,

    label,

    startedAt: shift.started_at,

    plannedDurationHours: shift.planned_duration_hours ?? 8,

    plannedEndAt: shift.planned_end_at ?? shift.started_at,

    hasVehicle: !!shift.vehicle_id,

  };

}



export const useShiftStore = create<ShiftState>((set, get) => ({

  activeShift: null,

  availableVehicles: [],

  loading: false,



  loadActiveShift: async () => {

    const shift = await fetchActiveShift();

    set({ activeShift: shift });

  },



  reset: () =>
    set({ activeShift: null, availableVehicles: [], loading: false }),

  loadAvailableVehicles: async () => {
    set({ loading: true });

    const { data } = await supabase

      .from('vehicles')

      .select('*')

      .eq('status', 'available')

      .order('plate');

    set({ availableVehicles: (data as Vehicle[]) ?? [], loading: false });

  },



  beginShift: async (hours) => {

    const { data, error } = await supabase.rpc('begin_shift', {

      p_duration_hours: hours,

    });

    console.log('[BisiCab] begin_shift', { hours, data, error });

    if (error) {
      // Takılı mesai: UI'ya yükle; yüklenirse recovered say.
      if (error.message.includes('Zaten aktif')) {
        await get().loadActiveShift();
        if (get().activeShift) {
          return { error: 'Zaten aktif bir mesainiz var.', recovered: true };
        }
      }
      return { error: error.message };
    }

    const now = new Date().toISOString();

    set({

      activeShift: {

        shiftId: data as string,

        vehicleId: null,

        plate: null,

        label: null,

        startedAt: now,

        plannedDurationHours: hours,

        plannedEndAt: now,

        hasVehicle: false,

      },

    });

    await get().loadActiveShift();

    return {};

  },



  takeVehicle: async (vehicle) => {

    const { error } = await supabase.rpc('take_vehicle', {

      p_vehicle_id: vehicle.id,

    });

    if (error) return { error: error.message };

    const current = get().activeShift;

    if (current) {

      set({

        activeShift: {

          ...current,

          vehicleId: vehicle.id,

          plate: vehicle.plate,

          label: vehicle.label,

          hasVehicle: true,

        },

      });

    }

    await get().loadActiveShift();

    return {};

  },



  releaseVehicle: async () => {

    const { error } = await supabase.rpc('release_vehicle');

    if (error) return { error: error.message };

    const current = get().activeShift;

    if (current) {

      set({

        activeShift: {

          ...current,

          vehicleId: null,

          plate: null,

          label: null,

          hasVehicle: false,

        },

      });

    }

    await get().loadActiveShift();

    return {};

  },



  endShift: async () => {

    const { error } = await supabase.rpc('end_shift');

    if (error) return { error: error.message };

    set({ activeShift: null });

    return {};

  },

}));


