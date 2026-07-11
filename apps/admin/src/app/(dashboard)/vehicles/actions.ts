'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase-server';

/** Admin: aracı zorla geri al (sürücü bırakmadıysa). */
export async function releaseVehicle(vehicleId: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServer();
  const { error } = await supabase.rpc('admin_release_vehicle', {
    p_vehicle_id: vehicleId,
  });
  if (error) return { error: error.message };
  revalidatePath('/vehicles');
  revalidatePath('/live');
  return {};
}
