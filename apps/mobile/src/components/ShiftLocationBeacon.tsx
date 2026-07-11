import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { useAuthStore } from '@/store/authStore';
import { useShiftStore } from '@/store/shiftStore';
import { pushDriverLocation } from '@/lib/driverLocation';
import {
  startBackgroundLocation,
  stopBackgroundLocation,
} from '@/lib/backgroundLocation';

/**
 * Görünmez bileşen: sürücü mesaide (aktif vardiya) olduğu sürece telefonun
 * konumunu arka plan konum servisiyle düzenli olarak drivers_profiles'a yazar.
 * Admin canlı haritada sürücüyü yolculuk yapmasa ve uygulama arka planda /
 * telefon kilitli olsa bile kesintisiz takip eder.
 *
 * Sürücü akışının kök layout'unda bir kez mount edilir.
 */
export function ShiftLocationBeacon() {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const activeShift = useShiftStore((s) => s.activeShift);
  const driverId = profile?.id ?? session?.user?.id ?? null;
  const warnedBackground = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (driverId && activeShift) {
        const res = await startBackgroundLocation(driverId);
        if (cancelled) return;
        if (!res.granted) {
          Alert.alert(
            'Konum izni gerekli',
            'Mesai boyunca konum paylaşımı için konum izni vermelisiniz.'
          );
          return;
        }
        // "Her zaman" izni yoksa yalnızca uygulama açıkken takip edilir; bir kez uyar.
        // (res.error varsa modül bu derlemede yok demektir; yanıltıcı uyarı gösterme.)
        if (!res.background && !res.error && !warnedBackground.current) {
          warnedBackground.current = true;
          Alert.alert(
            'Arka plan konumu kapalı',
            'Telefon kilitliyken de takip için konum iznini "Her zaman izin ver" yapın. Aksi halde yalnızca uygulama açıkken konum paylaşılır.'
          );
        }
      } else {
        await stopBackgroundLocation();
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [driverId, activeShift]);

  // Uygulama açıkken de konum gönder (arka plan görevi gecikebilir).
  useEffect(() => {
    if (!driverId || !activeShift) return;

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 8000,
          distanceInterval: 10,
        },
        (loc) => {
          void pushDriverLocation(driverId, {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        }
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [driverId, activeShift]);

  return null;
}
