/**
 * Platformdan bağımsız mesafe biriktirici.
 *
 * Ham GPS ping'lerini alır, Kalman filtresinden geçirir, Haversine ile mesafe
 * ölçer. Dururken oluşan jitter'ı (sahte 5–10 km/s) ve kötü doğruluklu
 * ölçümleri eleyerek kümülatif mesafeyi biriktirir.
 */

import { haversineKm, speedKmh, type LatLng } from './geo';
import { GpsKalmanFilter, type KalmanOptions } from './kalman';

export interface RawPing extends LatLng {
  /** Yatay doğruluk (metre), varsa. */
  accuracy?: number;
  /** Zaman damgası (ms). */
  timestamp: number;
  /**
   * Cihazın raporladığı anlık hız (m/s). Varsa Haversine hızıyla
   * harmanlanır; yoksa yalnızca konumdan türetilir.
   */
  speedMps?: number | null;
}

export interface AcceptedPing {
  /** Filtrelenmiş konum. */
  point: LatLng;
  /** Bu ping ile eklenen mesafe (km). */
  segmentKm: number;
  /** UI için yumuşatılmış hız (km/s); dururken 0. */
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
   * Bu değerden kısa segmentler (km) yok sayılır (taban eşik).
   * Varsayılan ~3 m.
   */
  minSegmentKm?: number;
  /**
   * Segment, accuracy (m) × bu faktörden kısaysa yok sayılır.
   * Örn. accuracy=10 m, factor=0.5 → 5 m altı hareket sayılmaz.
   */
  accuracyDistanceFactor?: number;
  /** Bu doğruluktan kötü ölçümler mesafeye katılmaz (metre). */
  maxAccuracyM?: number;
  /**
   * Bu hızın altında (km/s) durağan kabul edilir: UI hızı 0, mesafe kilitlenir.
   */
  stationarySpeedKmh?: number;
  /** Durağan kilitten çıkmak için gereken minimum yer değiştirme (km). */
  unlockDistanceKm?: number;
  /** Hız EMA katsayısı (0–1). Düşük = daha yumuşak. */
  speedEmaAlpha?: number;
}

export type RejectReason =
  | 'over_speed'
  | 'below_min_segment'
  | 'poor_accuracy'
  | 'stationary';

export interface RejectedPing {
  reason: RejectReason;
  speedKmh: number;
  segmentKm: number;
  timestamp: number;
  point: LatLng;
  totalDistanceKm: number;
}

export type PingResult =
  | ({ accepted: true } & AcceptedPing)
  | ({ accepted: false } & RejectedPing);

/**
 * Faturalandırma odaklı takip ayarları (fayton / düşük hız, şehir içi GPS).
 * Dururken jitter bastırır; yavaş hareketi eksik saymaz; araba hızı sıçramalarını reddeder.
 */
export const BILLING_TRACKER_OPTIONS: TrackerOptions = {
  maxSpeedKmh: 22,
  minSegmentKm: 0.004,
  accuracyDistanceFactor: 0.4,
  maxAccuracyM: 45,
  stationarySpeedKmh: 2,
  unlockDistanceKm: 0.009,
  processNoise: 0.55,
  defaultAccuracy: 8,
  minAccuracy: 3,
  speedEmaAlpha: 0.25,
};

/** Ön/arka plan senkronu için tam sayaç durumu. */
export interface TrackerSnapshot {
  totalKm: number;
  lastPoint: LatLng | null;
  lastTimestamp: number;
  speedEma: number;
  stationaryLocked: boolean;
  kalman: {
    variance: number;
    timestamp: number;
    lat: number;
    lng: number;
  };
}

export class DistanceTracker {
  private readonly kalman: GpsKalmanFilter;
  private readonly maxSpeedKmh: number;
  private readonly minSegmentKm: number;
  private readonly accuracyDistanceFactor: number;
  private readonly maxAccuracyM: number;
  private readonly stationarySpeedKmh: number;
  private readonly unlockDistanceKm: number;
  private readonly speedEmaAlpha: number;

  private totalKm = 0;
  private lastPoint: LatLng | null = null;
  private lastTimestamp = 0;
  private speedEma = 0;
  private stationaryLocked = true;

  constructor(options: TrackerOptions = {}) {
    this.kalman = new GpsKalmanFilter({
      processNoise: options.processNoise ?? 0.8,
      defaultAccuracy: options.defaultAccuracy ?? 10,
      minAccuracy: options.minAccuracy ?? 3,
    });
    this.maxSpeedKmh = options.maxSpeedKmh ?? 30;
    this.minSegmentKm = options.minSegmentKm ?? 0.003; // 3 m
    this.accuracyDistanceFactor = options.accuracyDistanceFactor ?? 0.55;
    this.maxAccuracyM = options.maxAccuracyM ?? 35;
    this.stationarySpeedKmh = options.stationarySpeedKmh ?? 2.2;
    this.unlockDistanceKm = options.unlockDistanceKm ?? 0.008; // 8 m
    this.speedEmaAlpha = options.speedEmaAlpha ?? 0.3;
  }

  reset(): void {
    this.kalman.reset();
    this.totalKm = 0;
    this.lastPoint = null;
    this.lastTimestamp = 0;
    this.speedEma = 0;
    this.stationaryLocked = true;
  }

  get totalDistanceKm(): number {
    return this.totalKm;
  }

  get displaySpeedKmh(): number {
    return this.speedEma < this.stationarySpeedKmh ? 0 : this.speedEma;
  }

  get isStationary(): boolean {
    return this.stationaryLocked;
  }

  /**
   * Arka plandan / yeniden açılışta birikmiş mesafeyi yükler.
   * Yolculuk devam ederken uygulama öldüyse veya arka plandaysa kullanılır.
   */
  hydrate(state: {
    totalKm: number;
    lastPoint: LatLng;
    lastTimestamp: number;
  }): void {
    this.kalman.reset();
    this.kalman.process({
      lat: state.lastPoint.lat,
      lng: state.lastPoint.lng,
      accuracy: 10,
      timestamp: state.lastTimestamp,
    });
    this.totalKm = Math.max(0, state.totalKm);
    this.lastPoint = state.lastPoint;
    this.lastTimestamp = state.lastTimestamp;
    this.speedEma = 0;
    this.stationaryLocked = true;
  }

  /** Ön/arka plan geçişinde sayacı birebir devralır. */
  restore(snapshot: TrackerSnapshot): void {
    this.totalKm = Math.max(0, snapshot.totalKm);
    this.lastPoint = snapshot.lastPoint;
    this.lastTimestamp = snapshot.lastTimestamp;
    this.speedEma = snapshot.speedEma;
    this.stationaryLocked = snapshot.stationaryLocked;
    if (snapshot.kalman.variance >= 0) {
      this.kalman.importState(snapshot.kalman);
    } else {
      this.kalman.reset();
    }
  }

  snapshot(): TrackerSnapshot {
    return {
      totalKm: this.totalKm,
      lastPoint: this.lastPoint,
      lastTimestamp: this.lastTimestamp,
      speedEma: this.speedEma,
      stationaryLocked: this.stationaryLocked,
      kalman: this.kalman.exportState(),
    };
  }

  /** Bir ham ping'i işler ve kabul/ret sonucunu döndürür. */
  add(ping: RawPing): PingResult {
    const accuracy =
      ping.accuracy != null && Number.isFinite(ping.accuracy)
        ? ping.accuracy
        : 12;

    const filtered = this.kalman.process({
      lat: ping.lat,
      lng: ping.lng,
      accuracy,
      timestamp: ping.timestamp,
    });

    // İlk nokta: referans; mesafe/hız yok.
    if (!this.lastPoint) {
      this.lastPoint = filtered;
      this.lastTimestamp = ping.timestamp;
      this.speedEma = 0;
      this.stationaryLocked = true;
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
    const deltaMs = Math.max(0, ping.timestamp - this.lastTimestamp);
    const derivedSpeed = speedKmh(segmentKm, deltaMs);

    // Cihaz hızı (m/s → km/s) varsa Haversine ile harmanla.
    let instantSpeed = derivedSpeed;
    if (
      ping.speedMps != null &&
      Number.isFinite(ping.speedMps) &&
      ping.speedMps >= 0
    ) {
      const deviceKmh = ping.speedMps * 3.6;
      // Kısa aralıkta Haversine şişer; cihaz hızına daha çok güven.
      instantSpeed = derivedSpeed * 0.35 + deviceKmh * 0.65;
    }

    const reject = (reason: RejectReason): PingResult => {
      // Ret durumunda hızı sıfıra doğru yumuşat (UI'da 8 km/s takılı kalmasın).
      this.speedEma =
        this.speedEma * (1 - this.speedEmaAlpha) + 0 * this.speedEmaAlpha;
      if (this.speedEma < this.stationarySpeedKmh) {
        this.speedEma = 0;
        this.stationaryLocked = true;
      }
      this.lastTimestamp = ping.timestamp;
      return {
        accepted: false,
        reason,
        speedKmh: this.displaySpeedKmh,
        segmentKm,
        timestamp: ping.timestamp,
        point: filtered,
        totalDistanceKm: this.totalKm,
      };
    };

    // Kötü doğruluk: mesafe ekleme (şehir içi GPS zıplaması).
    if (accuracy > this.maxAccuracyM) {
      return reject('poor_accuracy');
    }

    if (derivedSpeed > this.maxSpeedKmh) {
      return reject('over_speed');
    }

    // Accuracy'ye göre dinamik minimum segment.
    const accuracyFloorKm = (accuracy * this.accuracyDistanceFactor) / 1000;
    const effectiveMinKm = Math.max(this.minSegmentKm, accuracyFloorKm);

    // Durağan kilit: küçük salınımlar mesafeye yazılmaz.
    if (this.stationaryLocked) {
      if (segmentKm < this.unlockDistanceKm) {
        return reject('stationary');
      }
      this.stationaryLocked = false;
    }

    if (segmentKm < effectiveMinKm) {
      return reject('below_min_segment');
    }

    // Kabul: mesafe ekle, hızı yumuşat.
    this.totalKm += segmentKm;
    this.lastPoint = filtered;
    this.lastTimestamp = ping.timestamp;
    this.speedEma =
      this.speedEma * (1 - this.speedEmaAlpha) +
      instantSpeed * this.speedEmaAlpha;

    if (this.speedEma < this.stationarySpeedKmh) {
      this.speedEma = 0;
      this.stationaryLocked = true;
    }

    return {
      accepted: true,
      point: filtered,
      segmentKm,
      speedKmh: this.displaySpeedKmh,
      totalDistanceKm: this.totalKm,
      timestamp: ping.timestamp,
    };
  }
}
