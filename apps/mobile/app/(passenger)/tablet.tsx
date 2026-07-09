import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LiveTripState } from '@bisicab/shared';
import { subscribeLive } from '@/lib/liveTrip';
import { formatDuration, formatKm, formatTL } from '@/lib/format';

/**
 * Yolcu Tableti (kiosk) ekranı.
 * Bisikletin arkasına sabitlenir; eşlendiği sürücünün canlı yolculuk
 * verisini Supabase Realtime broadcast üzerinden dinler.
 */
export default function PassengerTablet() {
  const [driverId, setDriverId] = useState(
    process.env.EXPO_PUBLIC_PAIRED_DRIVER_ID ?? ''
  );
  const [paired, setPaired] = useState(!!process.env.EXPO_PUBLIC_PAIRED_DRIVER_ID);
  const [live, setLive] = useState<LiveTripState | null>(null);

  useEffect(() => {
    if (!paired || !driverId) return;
    const unsubscribe = subscribeLive(driverId, setLive);
    return unsubscribe;
  }, [paired, driverId]);

  if (!paired) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-dark px-10">
        <Text className="mb-6 text-3xl font-extrabold text-white">
          Tablet Eşleştirme
        </Text>
        <Text className="mb-2 text-brand-light">Sürücü Kimliği (driver_id)</Text>
        <TextInput
          value={driverId}
          onChangeText={setDriverId}
          autoCapitalize="none"
          placeholder="uuid..."
          placeholderTextColor="#94a3b8"
          className="mb-6 w-full rounded-xl bg-white/10 px-4 py-3 text-center text-white"
        />
        <Pressable
          onPress={() => setPaired(true)}
          disabled={!driverId}
          className="rounded-xl bg-brand px-8 py-4"
        >
          <Text className="text-lg font-bold text-white">Eşleştir</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isActive = live?.status === 'ongoing';

  return (
    <SafeAreaView className="flex-1 bg-brand-dark">
      <View className="flex-1 items-center justify-center px-8">
        {!isActive ? (
          <>
            <Text className="text-center text-5xl font-extrabold text-white">
              BisiCab'a{'\n'}Hoş Geldiniz!
            </Text>
            <Text className="mt-6 text-center text-xl text-brand-light">
              Yolculuğunuz başladığında bilgiler burada görünecek.
            </Text>
          </>
        ) : (
          <>
            <Text className="mb-4 text-2xl text-brand-light">GÜNCEL TUTAR</Text>
            <Text className="text-8xl font-extrabold text-white">
              {formatTL(live!.amount)}
            </Text>

            <View className="mt-20 w-full flex-row justify-around">
              <View className="items-center">
                <Text className="text-xl text-brand-light">Gidilen Mesafe</Text>
                <Text className="mt-2 text-5xl font-bold text-white">
                  {formatKm(live!.distance_km)}
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-xl text-brand-light">Geçen Süre</Text>
                <Text className="mt-2 text-5xl font-bold text-white">
                  {formatDuration(live!.duration_seconds)}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
