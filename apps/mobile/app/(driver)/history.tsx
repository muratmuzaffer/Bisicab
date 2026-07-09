import { useCallback, useState } from 'react';
import { View, Text, FlatList, Image, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Trip } from '@bisicab/shared';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatKm, formatTL } from '@/lib/format';

export default function HistoryScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setRefreshing(true);
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('driver_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setTrips((data as Trip[]) ?? []);
    setRefreshing(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['bottom']}>
      <FlatList
        data={trips}
        keyExtractor={(t) => t.id}
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        ListEmptyComponent={
          <Text className="mt-20 text-center text-slate-400">
            Henüz sürüş kaydı yok.
          </Text>
        }
        renderItem={({ item }) => (
          <View className="mb-3 flex-row rounded-2xl bg-white p-3 shadow-sm">
            {item.receipt_image_url ? (
              <Image
                source={{ uri: item.receipt_image_url }}
                className="mr-3 h-20 w-20 rounded-xl bg-slate-100"
                resizeMode="cover"
              />
            ) : (
              <View className="mr-3 h-20 w-20 items-center justify-center rounded-xl bg-slate-100">
                <Text className="text-xs text-slate-400">Fiş yok</Text>
              </View>
            )}
            <View className="flex-1 justify-center">
              <Text className="text-xs text-slate-500">
                {new Date(item.created_at).toLocaleString('tr-TR')}
              </Text>
              <Text className="mt-1 text-base font-semibold text-slate-900">
                {formatKm(Number(item.total_distance))} ·{' '}
                {Number(item.total_duration).toFixed(0)} dk
              </Text>
              <Text
                className={`mt-1 text-lg font-extrabold ${
                  item.status === 'cancelled' ? 'text-slate-400' : 'text-success'
                }`}
              >
                {formatTL(Number(item.total_amount))}
                {item.status === 'cancelled' ? ' (iptal)' : ''}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
