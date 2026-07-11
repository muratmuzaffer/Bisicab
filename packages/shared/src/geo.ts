/**
 * Coğrafi hesaplama yardımcıları (Haversine).
 * Tüm mesafeler kilometre, hızlar km/s cinsindendir.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Dünya'nın ortalama yarıçapı (km). */
export const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * İki koordinat arasındaki büyük daire (great-circle) mesafesini
 * Haversine formülü ile km olarak döndürür.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * İki nokta arasındaki hızı km/s cinsinden hesaplar.
 * @param distanceKm Kat edilen mesafe (km)
 * @param deltaMs    Geçen süre (milisaniye)
 */
export function speedKmh(distanceKm: number, deltaMs: number): number {
  if (deltaMs <= 0) return 0;
  const hours = deltaMs / 3_600_000;
  return distanceKm / hours;
}

/** Faturalandırma için km — 1 metre hassasiyet (0.001 km). */
export function roundDistanceKm(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  return Math.round(distanceKm * 1000) / 1000;
}
