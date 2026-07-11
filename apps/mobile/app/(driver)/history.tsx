import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Trip } from '@bisicab/shared';
import { routeSummary, passengersSummary } from '@bisicab/shared';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { resolveReceiptUrl } from '@/lib/receipts';
import { formatKm, formatTL } from '@/lib/format';

type TripRow = Trip & { receiptDisplayUrl?: string | null };
type Tab = 'completed' | 'cancelled';

export default function HistoryScreen() {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const driverId = profile?.id ?? session?.user?.id ?? null;

  const [tab, setTab] = useState<Tab>('completed');
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uid = user?.id ?? driverId;
    if (!uid) {
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);

    const rpc = await supabase.rpc('get_my_trip_history', { p_limit: 100 });

    let rowsRaw: Trip[] | null = null;
    let qErr = rpc.error;

    if (
      rpc.error &&
      (rpc.error.code === 'PGRST202' ||
        rpc.error.message?.includes('get_my_trip_history'))
    ) {
      const fallback = await supabase
        .from('trips')
        .select('*')
        .eq('driver_id', uid)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(100);
      rowsRaw = (fallback.data as Trip[]) ?? null;
      qErr = fallback.error;
    } else {
      rowsRaw = (rpc.data as Trip[]) ?? null;
    }

    if (qErr) {
      setError(qErr.message);
      setTrips([]);
    } else {
      const rows = (rowsRaw as Trip[]) ?? [];
      const withUrls: TripRow[] = await Promise.all(
        rows.map(async (t) => ({
          ...t,
          receiptDisplayUrl: await resolveReceiptUrl(t.receipt_image_url),
        }))
      );
      setTrips(withUrls);
    }
    setRefreshing(false);
    setLoading(false);
  }, [driverId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(
    () => trips.filter((t) => t.status === tab),
    [trips, tab]
  );

  const completedCount = trips.filter((t) => t.status === 'completed').length;
  const cancelledCount = trips.filter((t) => t.status === 'cancelled').length;

  if (loading && trips.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#F5C518" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['bottom']}>
      {/* Üst seçim çubuğu */}
      <View className="mx-4 mt-3 mb-1 flex-row rounded-2xl bg-slate-200 p-1">
        <Pressable
          onPress={() => setTab('completed')}
          className={`flex-1 items-center rounded-xl py-3 ${
            tab === 'completed' ? 'bg-white' : ''
          }`}
        >
          <Text
            className={`text-sm font-bold ${
              tab === 'completed' ? 'text-brand-dark' : 'text-slate-500'
            }`}
          >
            Tamamlanan ({completedCount})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('cancelled')}
          className={`flex-1 items-center rounded-xl py-3 ${
            tab === 'cancelled' ? 'bg-white' : ''
          }`}
        >
          <Text
            className={`text-sm font-bold ${
              tab === 'cancelled' ? 'text-brand-dark' : 'text-slate-500'
            }`}
          >
            İptal ({cancelledCount})
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        contentContainerClassName="p-4 pt-2"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        ListEmptyComponent={
          <View className="mt-20 px-6">
            <Text className="text-center text-slate-400">
              {error
                ? `Yüklenemedi: ${error}`
                : tab === 'completed'
                  ? 'Henüz tamamlanmış sürüş yok.'
                  : 'İptal edilmiş sürüş yok.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="mb-3 flex-row rounded-2xl bg-white p-3 shadow-sm">
            {item.receiptDisplayUrl ? (
              <Image
                source={{ uri: item.receiptDisplayUrl }}
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
              {(item.route_stops?.length || item.start_stop || item.end_stop) ? (
                <Text className="mt-0.5 text-sm font-medium text-brand-dark">
                  {item.route_stops?.length
                    ? routeSummary(item.start_stop, item.end_stop, item.route_stops)
                    : item.start_stop || item.end_stop
                      ? routeSummary(item.start_stop, item.end_stop)
                      : `${item.start_zone ?? '—'} → ${item.end_zone ?? '—'}`}
                </Text>
              ) : null}
              <Text className="mt-1 text-xs text-slate-500">
                {passengersSummary({
                  male: item.passenger_male ?? 0,
                  female: item.passenger_female ?? 0,
                  child: item.passenger_child ?? 0,
                  childMale: item.passenger_child_male ?? 0,
                  childFemale: item.passenger_child_female ?? 0,
                })}
              </Text>
              <Text className="mt-1 text-base font-semibold text-slate-900">
                {formatKm(Number(item.total_distance ?? 0))} ·{' '}
                {Number(item.total_duration ?? 0).toFixed(0)} dk
              </Text>
              <Text
                className={`mt-1 text-lg font-extrabold ${
                  item.status === 'cancelled' ? 'text-slate-400' : 'text-success'
                }`}
              >
                {formatTL(Number(item.total_amount ?? 0))}
                {item.status === 'cancelled' ? ' (iptal)' : ''}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
