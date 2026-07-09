/** BisiCab veritabanı ve alan modelleri (Supabase şemasıyla birebir). */

export type UserRole = 'driver' | 'admin';

export type TripStatus = 'ongoing' | 'completed' | 'cancelled';

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

export interface Trip {
  id: string;
  driver_id: string;
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
