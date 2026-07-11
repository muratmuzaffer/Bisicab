import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Vehicle } from '@bisicab/shared';
import { useShiftStore } from '@/store/shiftStore';

export default function SelectVehicleScreen() {
  const { availableVehicles, loading, loadActiveShift, loadAvailableVehicles, takeVehicle } =
    useShiftStore();
  const [starting, setStarting] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setChecking(true);
        await loadActiveShift();
        const shift = useShiftStore.getState().activeShift;
        setChecking(false);
        if (!shift) {
          router.replace('/(driver)/start-shift');
          return;
        }
        void loadAvailableVehicles();
      })();
    }, [loadActiveShift, loadAvailableVehicles])
  );

  const onSelect = async (vehicle: Vehicle) => {
    setStarting(vehicle.id);
    const { error } = await takeVehicle(vehicle);
    setStarting(null);
    if (error) {
      Alert.alert('Araç alınamadı', error);
      void loadAvailableVehicles();
      return;
    }
    router.replace('/');
  };

  if (checking) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#F5C518" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="border-b border-slate-100 bg-white px-6 pb-4 pt-2">
        <Text className="text-xs font-bold uppercase tracking-widest text-brand-deep">
          Filo
        </Text>
        <Text className="text-2xl font-extrabold text-brand-dark">Araç Seç</Text>
        <Text className="mt-1 text-sm text-slate-500">
          Mesainiz aktif. Kullanmak istediğiniz müsait aracı seçin.
        </Text>
      </View>

      <FlatList
        data={availableVehicles}
        keyExtractor={(v) => v.id}
        contentContainerClassName="p-6 pt-2"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadAvailableVehicles} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text className="mt-20 text-center text-slate-400">
              Şu an müsait araç yok.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            disabled={starting !== null}
            className="mb-3 flex-row items-center justify-between rounded-2xl bg-white p-5 shadow-sm active:opacity-80"
          >
            <View>
              <Text className="text-xl font-extrabold text-brand-dark">
                {item.plate}
              </Text>
              {item.label ? (
                <Text className="text-sm text-slate-500">{item.label}</Text>
              ) : null}
            </View>
            {starting === item.id ? (
              <ActivityIndicator color="#F5C518" />
            ) : (
              <Text className="font-semibold text-brand-deep">Al →</Text>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
