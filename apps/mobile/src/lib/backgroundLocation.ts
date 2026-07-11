import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushDriverLocation } from './driverLocation';
import { processTripLocationPing } from './activeTrip';

/**
 * Arka plan konum takibi.
 *
 * Sürücü mesaideyken (uygulama arka planda / telefon kilitli olsa bile)
 * konumu düzenli olarak drivers_profiles'a yazar; admin canlı haritada
 * sürücüyü kesintisiz takip eder.
 *
 * NOT: expo-task-manager native modülü içermeyen (eski) derlemelerde statik
 * import çökeceği için modülü güvenli/opsiyonel şekilde yüklüyoruz. Modül yoksa
 * arka plan sessizce devre dışı kalır (ön plan akışı çalışmaya devam eder).
 */

export const SHIFT_LOCATION_TASK = 'bisicab-shift-location';
const DRIVER_ID_KEY = 'bisicab.shift.driverId';

/** Konum yayınlama aralığı (ms). */
const INTERVAL_MS = 8000;
/** Minimum yer değiştirme (metre). */
const DISTANCE_M = 10;

// Opsiyonel yükleme: native modül yoksa require patlar → yakalayıp null bırakırız.
let TaskManager: typeof import('expo-task-manager') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
} catch {
  TaskManager = null;
}

/** Bu derlemede arka plan konum servisi kullanılabilir mi? */
export function isBackgroundLocationAvailable(): boolean {
  return TaskManager != null;
}

if (TaskManager) {
  try {
    TaskManager.defineTask(SHIFT_LOCATION_TASK, async ({ data, error }) => {
      if (error) return;
      const { locations } = (data ?? {}) as {
        locations?: Location.LocationObject[];
      };
      const loc = locations?.[locations.length - 1];
      if (!loc) return;

      // Zustand state headless bağlamda yok; sürücü kimliğini kalıcı depodan al.
      const driverId = await AsyncStorage.getItem(DRIVER_ID_KEY);
      if (!driverId) return;

      await pushDriverLocation(driverId, {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });

      // Aktif yolculukta km sayacı arka planda da aynı filtreyle birikir.
      await processTripLocationPing({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? undefined,
        timestamp: loc.timestamp,
        speedMps: loc.coords.speed,
      });
    });
  } catch {
    // Görev tanımlanamadıysa yoksay; arka plan devre dışı kalır.
  }
}

export interface StartBackgroundResult {
  /** Ön plan izni verildi mi? */
  granted: boolean;
  /** "Her zaman" (arka plan) izni verildi mi? Verilmezse yalnızca ön planda çalışır. */
  background: boolean;
  /** Beklenmedik durum / bu derlemede modül yok gibi bilgilendirici hata. */
  error?: string;
}

/** Mesai başlarken çağrılır: izinleri ister, konum servisini başlatır. */
export async function startBackgroundLocation(
  driverId: string
): Promise<StartBackgroundResult> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      return { granted: false, background: false, error: 'Konum izni verilmedi.' };
    }

    if (!isBackgroundLocationAvailable()) {
      // Eski/uyumsuz derleme: arka plan modülü yok. Ön plan akışı çalışır.
      return {
        granted: true,
        background: false,
        error: 'Arka plan konum modülü bu derlemede yok.',
      };
    }

    // Arka plan izni reddedilse bile ön plan takibiyle devam edebiliriz.
    const bg = await Location.requestBackgroundPermissionsAsync();

    await AsyncStorage.setItem(DRIVER_ID_KEY, driverId);

    const already = await Location.hasStartedLocationUpdatesAsync(
      SHIFT_LOCATION_TASK
    ).catch(() => false);
    if (already) {
      return { granted: true, background: bg.status === 'granted' };
    }

    await Location.startLocationUpdatesAsync(SHIFT_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: INTERVAL_MS,
      distanceInterval: DISTANCE_M,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      // Android'de kalıcı bildirim + foreground service (arka planda öldürülmeyi önler).
      foregroundService: {
        notificationTitle: 'BisiCab mesai aktif',
        notificationBody: 'Konumunuz mesai boyunca paylaşılıyor.',
        notificationColor: '#F5C518',
      },
    });

    return { granted: true, background: bg.status === 'granted' };
  } catch (e) {
    // Çökmek yerine ön plan takibiyle sınırlı kal; hatayı üst katmana bildir.
    return {
      granted: true,
      background: false,
      error:
        e instanceof Error ? e.message : 'Arka plan konum servisi başlatılamadı.',
    };
  }
}

/** Mesai biterken çağrılır: konum servisini durdurur, kimliği temizler. */
export async function stopBackgroundLocation(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRIVER_ID_KEY);
    if (!isBackgroundLocationAvailable()) return;
    const started = await Location.hasStartedLocationUpdatesAsync(
      SHIFT_LOCATION_TASK
    ).catch(() => false);
    if (started) {
      await Location.stopLocationUpdatesAsync(SHIFT_LOCATION_TASK);
    }
  } catch {
    // yoksay
  }
}
