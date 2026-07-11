import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShiftStore } from '@/store/shiftStore';

export default function StartShiftScreen() {
  const beginShift = useShiftStore((s) => s.beginShift);
  const loadActiveShift = useShiftStore((s) => s.loadActiveShift);
  const endShift = useShiftStore((s) => s.endShift);
  const [loading, setLoading] = useState<4 | 8 | null>(null);

  const onSelect = async (hours: 4 | 8) => {
    setLoading(hours);
    const { error, recovered } = await beginShift(hours);
    setLoading(null);

    if (recovered) {
      router.replace('/');
      return;
    }

    if (error) {
      if (error.includes('Zaten aktif')) {
        Alert.alert('Aktif mesainiz var', 'Ana ekrandan devam edebilir veya mesaiyi kapatabilirsiniz.', [
          {
            text: 'Ana Ekran',
            onPress: async () => {
              await loadActiveShift();
              router.replace('/');
            },
          },
          {
            text: 'Mesaiyi Kapat',
            style: 'destructive',
            onPress: async () => {
              const res = await endShift();
              if (res.error) Alert.alert('Hata', res.error);
            },
          },
        ]);
        return;
      }
      Alert.alert('Mesai başlatılamadı', error);
      return;
    }
    router.replace('/(driver)/select-vehicle');
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1 justify-center px-8">
        <Text className="text-center text-xs font-bold uppercase tracking-widest text-brand-deep">
          Mesai
        </Text>
        <Text className="mb-2 text-center text-3xl font-extrabold text-brand-dark">
          Süre Seçin
        </Text>
        <Text className="mb-10 text-center leading-6 text-slate-500">
          Bugünkü mesainiz ne kadar sürecek? Her akşam 21:00&apos;da tüm araçlar otomatik
          geri alınır.
        </Text>

        <Pressable
          onPress={() => onSelect(4)}
          disabled={loading !== null}
          className="mb-4 overflow-hidden rounded-3xl bg-brand shadow-lg active:opacity-90"
        >
          <View className="items-center px-6 py-10">
            {loading === 4 ? (
              <ActivityIndicator color="#0B0F0C" />
            ) : (
              <>
                <Text className="text-5xl font-extrabold text-brand-dark">4</Text>
                <Text className="text-xl font-bold text-brand-dark">Saat</Text>
                <Text className="mt-2 text-brand-dark/70">Kısa vardiya</Text>
              </>
            )}
          </View>
        </Pressable>

        <Pressable
          onPress={() => onSelect(8)}
          disabled={loading !== null}
          className="overflow-hidden rounded-3xl bg-brand-dark shadow-lg active:opacity-90"
        >
          <View className="items-center px-6 py-10">
            {loading === 8 ? (
              <ActivityIndicator color="#F5C518" />
            ) : (
              <>
                <Text className="text-5xl font-extrabold text-white">8</Text>
                <Text className="text-xl font-bold text-white">Saat</Text>
                <Text className="mt-2 text-brand">Tam vardiya</Text>
              </>
            )}
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
