import type { LatLng } from '@bisicab/shared';
import { supabase } from './supabase';

/** Sürücünün anlık konumunu drivers_profiles tablosuna yazar (admin canlı takip). */
export async function pushDriverLocation(
  driverId: string,
  point: LatLng,
  isActive = true
): Promise<void> {
  await supabase.rpc('ensure_driver_profile');

  await supabase
    .from('drivers_profiles')
    .update({
      current_lat: point.lat,
      current_lng: point.lng,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', driverId);
}

/** Yolculuk bitiminde sürücüyü pasife çeker. */
export async function setDriverInactive(driverId: string): Promise<void> {
  await supabase
    .from('drivers_profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', driverId);
}
