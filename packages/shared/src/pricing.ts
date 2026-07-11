/**
 * BisiCab ücret motoru.
 *
 * İş kuralları (İZULAŞ - Alsancak Limanı / Konak Saat Kulesi hattı):
 *  - Başlangıç / minimum ücret: 2.5 km'ye kadar tüm yolculuklar 150 TL.
 *    (Açılış ücreti bu tutara dahildir; ayrıca eklenmez.)
 *  - 2.5 km üzeri: 2.5 km'nin üstündeki her km için +45 TL.
 *
 * Örnekler:
 *  - 0 km    -> 150.00 TL
 *  - 1.8 km  -> 150.00 TL
 *  - 2.5 km  -> 150.00 TL
 *  - 4.0 km  -> 150 + (1.5 * 45) = 217.50 TL
 */

export const PRICING = {
  /**
   * Ayrı açılış ücreti yok; 150 TL başlangıç ücretine dahildir.
   * Alan geriye dönük uyumluluk için 0 tutulur.
   */
  OPENING_FEE: 0,
  /** 2.5 km'ye kadar sabit / başlangıç ücreti (TL). */
  FLAT_FEE: 150,
  /** Sabit ücretin kapsadığı mesafe (km). */
  FLAT_DISTANCE_KM: 2.5,
  /** 2.5 km üzeri her km için ek ücret (TL/km). */
  PER_KM_FEE: 45,
  /** Para birimi kodu. */
  CURRENCY: 'TRY',
} as const;

export interface FareBreakdown {
  /** Açılış ücreti (TL) — sabit ücrete dahil, ayrı eklenmez. */
  openingFee: number;
  /** Sabit minimum / başlangıç ücreti (TL). */
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
  // Başlangıç 150 TL; açılış ayrıca eklenmez.
  const total = roundCurrency(flatFee + distanceFee);

  return {
    openingFee,
    flatFee,
    distanceFee,
    chargeableExtraKm: roundCurrency(chargeableExtraKm),
    total,
    distanceKm: roundCurrency(distance),
  };
}

/** Tutarı "150.00 TL" biçiminde okunabilir metne çevirir. */
export function formatFare(amount: number, currency = '₺'): string {
  return `${roundCurrency(amount).toFixed(2)} ${currency}`;
}
