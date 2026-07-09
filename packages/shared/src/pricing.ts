/**
 * BisiCab ücret motoru.
 *
 * İş kuralları (İZULAŞ - Alsancak Limanı / Konak Saat Kulesi hattı):
 *  - Açılış ücreti: 35 TL (her yolculukta sabit alınır).
 *  - Sabit / minimum mesafe ücreti: 2.5 km'ye kadar tüm yolculuklar 150 TL'dir.
 *    Açılış ücreti bu 150 TL'ye DAHİL DEĞİLDİR.
 *  - 2.5 km üzeri: 2.5 km'nin üstündeki her km için +45 TL.
 *
 * Örnekler:
 *  - 1.8 km  -> 35 + 150                       = 185.00 TL
 *  - 2.5 km  -> 35 + 150                       = 185.00 TL
 *  - 4.0 km  -> 35 + 150 + (1.5 * 45)          = 252.50 TL
 */

export const PRICING = {
  /** Açılış ücreti (TL). */
  OPENING_FEE: 35,
  /** 2.5 km'ye kadar sabit ücret (TL). */
  FLAT_FEE: 150,
  /** Sabit ücretin kapsadığı mesafe (km). */
  FLAT_DISTANCE_KM: 2.5,
  /** 2.5 km üzeri her km için ek ücret (TL/km). */
  PER_KM_FEE: 45,
  /** Para birimi kodu. */
  CURRENCY: 'TRY',
} as const;

export interface FareBreakdown {
  /** Açılış ücreti (TL). */
  openingFee: number;
  /** Sabit minimum ücret (TL). */
  flatFee: number;
  /** 2.5 km üzeri mesafe için hesaplanan ek ücret (TL). */
  distanceFee: number;
  /** Ek ücrete konu olan (2.5 km üzeri) mesafe (km). */
  chargeableExtraKm: number;
  /** Toplam ücret (TL), 2 ondalık basamağa yuvarlanmış. */
  total: number;
  /** Ücretin hesaplandığı toplam mesafe (km). */
  distanceKm: number;
}

/** İki ondalık basamağa (kuruş) güvenli yuvarlama. */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Verilen mesafeye (km) göre ücret dökümünü hesaplar.
 * Negatif ya da NaN mesafeler 0 kabul edilir.
 */
export function calculateFare(distanceKm: number): FareBreakdown {
  const distance =
    Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;

  const openingFee = PRICING.OPENING_FEE;
  const flatFee = PRICING.FLAT_FEE;

  const chargeableExtraKm =
    distance > PRICING.FLAT_DISTANCE_KM
      ? distance - PRICING.FLAT_DISTANCE_KM
      : 0;

  const distanceFee = roundCurrency(chargeableExtraKm * PRICING.PER_KM_FEE);
  const total = roundCurrency(openingFee + flatFee + distanceFee);

  return {
    openingFee,
    flatFee,
    distanceFee,
    chargeableExtraKm: roundCurrency(chargeableExtraKm),
    total,
    distanceKm: roundCurrency(distance),
  };
}

/** Tutarı "185.00 TL" biçiminde okunabilir metne çevirir. */
export function formatFare(amount: number, currency = '₺'): string {
  return `${roundCurrency(amount).toFixed(2)} ${currency}`;
}
