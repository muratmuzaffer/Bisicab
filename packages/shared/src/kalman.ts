/**
 * GPS konumları için Kalman filtresi.
 *
 * Yüksek binaların/ağaçların altından geçerken oluşan GPS sıçramalarını
 * (jitter) yumuşatmak için kullanılır. Ölçüm gürültüsü, cihazın raporladığı
 * konum doğruluğuna (accuracy, metre) göre belirlenir; süreç gürültüsü ise
 * aracın gerçek hareketini ne kadar hızlı takip edeceğimizi ayarlar.
 *
 * Uyarlama: her eksen (lat/lng) için tek boyutlu, doğrulukla ölçeklenen
 * skaler varyanslı, yaygın kullanılan "GeoKalmanFilter" tasarımı.
 */

export interface KalmanPoint {
  lat: number;
  lng: number;
}

export interface KalmanInput extends KalmanPoint {
  /** Cihazın raporladığı yatay doğruluk (metre). Bilinmiyorsa varsayılan kullanılır. */
  accuracy?: number;
  /** Ölçüm zaman damgası (ms). */
  timestamp: number;
}

export interface KalmanOptions {
  /**
   * Süreç gürültüsü (metre/saniye). Düşük değer daha fazla yumuşatma
   * (yavaş tepki), yüksek değer daha çevik takip demektir.
   * Elektrikli fayton bisiklet düşük hızlı olduğundan varsayılan küçüktür.
   */
  processNoise?: number;
  /** accuracy raporlanmadığında kullanılacak varsayılan doğruluk (metre). */
  defaultAccuracy?: number;
  /** Minimum doğruluk tabanı (metre); 0'a bölünmeyi ve aşırı güveni engeller. */
  minAccuracy?: number;
}

export class GpsKalmanFilter {
  private readonly processNoise: number;
  private readonly defaultAccuracy: number;
  private readonly minAccuracy: number;

  /** Negatif ise filtre henüz başlatılmamış demektir. */
  private variance = -1;
  private timestamp = 0;
  private lat = 0;
  private lng = 0;

  constructor(options: KalmanOptions = {}) {
    this.processNoise = options.processNoise ?? 1.2;
    this.defaultAccuracy = options.defaultAccuracy ?? 8;
    this.minAccuracy = options.minAccuracy ?? 1;
  }

  /** Filtreyi sıfırlar (yeni yolculuk başında çağrılmalı). */
  reset(): void {
    this.variance = -1;
    this.timestamp = 0;
    this.lat = 0;
    this.lng = 0;
  }

  /** Filtre en az bir ölçüm işledi mi? */
  get initialized(): boolean {
    return this.variance >= 0;
  }

  /**
   * Ham bir GPS ölçümünü işler ve filtrelenmiş konumu döndürür.
   */
  process(input: KalmanInput): KalmanPoint {
    let accuracy = input.accuracy ?? this.defaultAccuracy;
    if (!Number.isFinite(accuracy) || accuracy < this.minAccuracy) {
      accuracy = this.minAccuracy;
    }

    if (this.variance < 0) {
      // İlk ölçüm: durumu doğrudan başlat.
      this.timestamp = input.timestamp;
      this.lat = input.lat;
      this.lng = input.lng;
      this.variance = accuracy * accuracy;
      return { lat: this.lat, lng: this.lng };
    }

    // Öngörü (predict): geçen süreye göre belirsizliği artır.
    const dtSeconds = (input.timestamp - this.timestamp) / 1000;
    if (dtSeconds > 0) {
      this.variance += dtSeconds * this.processNoise * this.processNoise;
      this.timestamp = input.timestamp;
    }

    // Güncelleme (update): Kalman kazancı.
    const kalmanGain = this.variance / (this.variance + accuracy * accuracy);
    this.lat += kalmanGain * (input.lat - this.lat);
    this.lng += kalmanGain * (input.lng - this.lng);
    this.variance = (1 - kalmanGain) * this.variance;

    return { lat: this.lat, lng: this.lng };
  }

  /** Filtrelenmiş anlık konum (başlatılmadıysa null). */
  get current(): KalmanPoint | null {
    return this.initialized ? { lat: this.lat, lng: this.lng } : null;
  }
}
