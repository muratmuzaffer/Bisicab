/**
 * Platformdan bağımsız mesafe biriktirici.
 *
 * Ham GPS ping'lerini alır, Kalman filtresinden geçirir, ardışık noktalar
 * arasındaki mesafeyi Haversine ile ölçer ve mantıksız (hız sınırını aşan)
 * ping'leri eleyerek kümülatif mesafeyi biriktirir.
 *
 * React'e bağımlı olmadığından hem `useLocationTracker` hook'u hem de birim
 * testleri tarafından kullanılabilir.
 */

import { haversineKm, speedKmh, type LatLng } from './geo';
import { GpsKalmanFilter, type KalmanOptions } from './kalman';

export interface RawPing extends LatLng {
  /** Yatay doğruluk (metre), varsa. */
  accuracy?: number;
  /** Zaman damgası (ms). */
  timestamp: number;
}

export interface AcceptedPing {
  /** Filtrelenmiş konum. */
  point: LatLng;
  /** Bu ping ile eklenen mesafe (km). */
  segmentKm: number;
  /** Bu segmentte ölçülen hız (km/s). */
  speedKmh: number;
  /** Güncel kümülatif mesafe (km). */
  totalDistanceKm: number;
  timestamp: number;
}

export interface TrackerOptions extends KalmanOptions {
  /**
   * Mantıksal üst hız sınırı (km/s). Bunu aşan segmentler GPS hatası kabul
   * edilip mesafeye katılmaz. Fayton bisikleti için varsayılan 30 km/s.
   */
  maxSpeedKmh?: number;
  /**
   * Bu değerden kısa segmentler (km) "duruyor" kabul edilip yok sayılır;
   * dururken oluşan mikro-jitter birikimini engeller.
   */
  minSegmentKm?: number;
}

export interface RejectedPing {
  reason: 'over_speed' | 'below_min_segment';
  speedKmh: number;
  segmentKm: number;
  timestamp: number;
}

export type PingResult =
  | ({ accepted: true } & AcceptedPing)
  | ({ accepted: false } & RejectedPing);

export class DistanceTracker {
  private readonly kalman: GpsKalmanFilter;
  private readonly maxSpeedKmh: number;
  private readonly minSegmentKm: number;

  private totalKm = 0;
  private lastPoint: LatLng | null = null;
  private lastTimestamp = 0;

  constructor(options: TrackerOptions = {}) {
    this.kalman = new GpsKalmanFilter(options);
    this.maxSpeedKmh = options.maxSpeedKmh ?? 30;
    this.minSegmentKm = options.minSegmentKm ?? 0.0015; // ~1.5 m
  }

  reset(): void {
    this.kalman.reset();
    this.totalKm = 0;
    this.lastPoint = null;
    this.lastTimestamp = 0;
  }

  get totalDistanceKm(): number {
    return this.totalKm;
  }

  /** Bir ham ping'i işler ve kabul/ret sonucunu döndürür. */
  add(ping: RawPing): PingResult {
    const filtered = this.kalman.process({
      lat: ping.lat,
      lng: ping.lng,
      accuracy: ping.accuracy,
      timestamp: ping.timestamp,
    });

    // İlk nokta: referans olarak sakla, mesafe ekleme.
    if (!this.lastPoint) {
      this.lastPoint = filtered;
      this.lastTimestamp = ping.timestamp;
      return {
        accepted: true,
        point: filtered,
        segmentKm: 0,
        speedKmh: 0,
        totalDistanceKm: this.totalKm,
        timestamp: ping.timestamp,
      };
    }

    const segmentKm = haversineKm(this.lastPoint, filtered);
    const deltaMs = ping.timestamp - this.lastTimestamp;
    const segmentSpeed = speedKmh(segmentKm, deltaMs);

    // Doğruluk kontrolü: hız sınırını aşan ping'i ele.
    if (segmentSpeed > this.maxSpeedKmh) {
      return {
        accepted: false,
        reason: 'over_speed',
        speedKmh: segmentSpeed,
        segmentKm,
        timestamp: ping.timestamp,
      };
    }

    // Durağan mikro-jitter'ı ele.
    if (segmentKm < this.minSegmentKm) {
      // Zaman referansını ilerlet ama konumu koru (drift önlemi).
      this.lastTimestamp = ping.timestamp;
      return {
        accepted: false,
        reason: 'below_min_segment',
        speedKmh: segmentSpeed,
        segmentKm,
        timestamp: ping.timestamp,
      };
    }

    this.totalKm += segmentKm;
    this.lastPoint = filtered;
    this.lastTimestamp = ping.timestamp;

    return {
      accepted: true,
      point: filtered,
      segmentKm,
      speedKmh: segmentSpeed,
      totalDistanceKm: this.totalKm,
      timestamp: ping.timestamp,
    };
  }
}
