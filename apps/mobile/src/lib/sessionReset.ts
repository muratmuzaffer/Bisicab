import { clearActiveTrip } from '@/lib/activeTrip';
import { stopBackgroundLocation } from '@/lib/backgroundLocation';
import { useShiftStore } from '@/store/shiftStore';
import { useTripStore } from '@/store/tripStore';

/** Hesap değişince veya çıkışta önceki sürücünün mesai/araç/yolculuk verisini sil. */
export async function resetSessionState(): Promise<void> {
  useShiftStore.getState().reset();
  await useTripStore.getState().resetSession();
  await clearActiveTrip();
  await stopBackgroundLocation();
}
