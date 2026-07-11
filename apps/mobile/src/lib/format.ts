/** Saniyeyi "DK:SN" biçimine çevirir (örn. 125 -> "02:05"). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Km'yi "X.XX km" biçiminde gösterir. */
export function formatKm(km: number): string {
  return `${km.toFixed(2)} km`;
}

/** TL tutarını "XXX.XX ₺" biçiminde gösterir. */
export function formatTL(amount: number): string {
  return `${amount.toFixed(2)} ₺`;
}

/** ISO tarihini yerel saat diliminde kısa gösterir. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
