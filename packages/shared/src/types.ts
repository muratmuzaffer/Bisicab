/** BisiCab veritabanı ve alan modelleri (Supabase şemasıyla birebir). */

export type UserRole = 'driver' | 'admin';

export type TripStatus = 'ongoing' | 'completed' | 'cancelled';

export type VehicleStatus = 'available' | 'in_use' | 'maintenance';

export type ShiftEndReason = 'driver' | 'admin_force' | 'auto_21h';

export type AssignmentReleaseReason =
  | 'driver'
  | 'admin_force'
  | 'auto_21h'
  | 'shift_end';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface DriverProfile {
  user_id: string;
  total_rides: number;
  total_earnings: number;
  is_active: boolean;
  current_lat: number | null;
  current_lng: number | null;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  label: string | null;
  status: VehicleStatus;
  current_driver_id: string | null;
  active_shift_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string | null;
  end_reason: ShiftEndReason | null;
  planned_duration_hours: number | null;
  planned_end_at: string | null;
  created_at: string;
}

/** Mesai içinde araç alma/bırakma kaydı. */
export interface VehicleAssignment {
  id: string;
  shift_id: string;
  driver_id: string;
  vehicle_id: string;
  assigned_at: string;
  released_at: string | null;
  release_reason: AssignmentReleaseReason | null;
  created_at: string;
}

export interface Trip {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  shift_id: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  /** Toplam mesafe (km). */
  total_distance: number;
  /** Toplam süre (dakika). */
  total_duration: number;
  /** Toplam tutar (TL). */
  total_amount: number;
  status: TripStatus;
  receipt_image_url: string | null;
  /** Güzergah: başlangıç bölgesi id (örn. alsancak). */
  start_zone: string | null;
  /** Güzergah: varış bölgesi id. */
  end_zone: string | null;
  /** Başlangıç durağı id. */
  start_stop: string | null;
  /** Varış durağı id. */
  end_stop: string | null;
  passenger_male: number;
  passenger_female: number;
  passenger_child: number;
  passenger_child_male: number;
  passenger_child_female: number;
  /** Sıralı durak id listesi (en fazla 6). */
  route_stops: string[] | null;
  /** GPS izi (yolculuk tamamlanınca kaydedilir). */
  route_path: Array<{ lat: number; lng: number }> | null;
  has_tourist: boolean;
  created_at: string;
  ended_at: string | null;
}

/** Yolcu tabletine Realtime üzerinden yayınlanan canlı sürüş durumu. */
export interface LiveTripState {
  trip_id: string;
  driver_id: string;
  status: TripStatus;
  distance_km: number;
  duration_seconds: number;
  amount: number;
  updated_at: string;
}
