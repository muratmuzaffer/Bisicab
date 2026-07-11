import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useTripStore } from '@/store/tripStore';
import { useShiftStore } from '@/store/shiftStore';
import { PrimaryButton, Card } from '@/components/ui';
import { formatTL, formatDateTime } from '@/lib/format';

interface Props {
  onSignOut?: () => void;
}

export default function DriverHome({ onSignOut }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const todaySummary = useTripStore((s) => s.todaySummary);
  const loadTodaySummary = useTripStore((s) => s.loadTodaySummary);
  const loadOngoingTrip = useTripStore((s) => s.loadOngoingTrip);
  const ongoingTrip = useTripStore((s) => s.ongoingTrip);
  const activeShift = useShiftStore((s) => s.activeShift);
  const loadActiveShift = useShiftStore((s) => s.loadActiveShift);
  const releaseVehicle = useShiftStore((s) => s.releaseVehicle);
  const endShift = useShiftStore((s) => s.endShift);

  const [releasing, setReleasing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const driverId = profile?.id ?? session?.user?.id ?? null;
  const inShift = !!activeShift;
  const hasVehicle = activeShift?.hasVehicle ?? false;
  const displayName = profile?.full_name ?? session?.user?.email ?? 'Sürücü';

  useEffect(() => {
    void loadActiveShift().catch(() => {});
    void loadOngoingTrip().catch(() => {});
    if (driverId) void loadTodaySummary(driverId).catch(() => {});
  }, [driverId, loadActiveShift, loadOngoingTrip, loadTodaySummary]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadActiveShift();
      await loadOngoingTrip();
      if (driverId) await loadTodaySummary(driverId);
    } finally {
      setRefreshing(false);
    }
  };

  const onReleaseVehicle = () => {
    Alert.alert(
      'Aracı Bırak',
      'Aracı bırakıp başka bir bisiklete geçebilirsiniz. Mesainiz devam eder.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Aracı Bırak',
          onPress: async () => {
            setReleasing(true);
            const { error } = await releaseVehicle();
            setReleasing(false);
            if (error) Alert.alert('Hata', error);
          },
        },
      ]
    );
  };

  const onEndShift = () => {
    if (ongoingTrip) {
      Alert.alert(
        'Aktif yolculuk var',
        'Önce yolculuğu fiş yükleyerek tamamlayın veya iptal edin.'
      );
      return;
    }
    Alert.alert('Mesaiyi Bitir', 'Mesainizi sonlandırmak istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Mesaiyi Bitir',
        style: 'destructive',
        onPress: async () => {
          setEnding(true);
          const { error } = await endShift();
          setEnding(false);
          if (error) Alert.alert('Hata', error);
        },
      },
    ]);
  };

  const handleSignOut = async () => {
    await signOut();
    onSignOut?.();
  };

  const shiftEndLabel =
    activeShift?.plannedEndAt != null
      ? formatDateTime(activeShift.plannedEndAt)
      : '—';

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-10 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="mb-6 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-sm text-slate-500">Hoş geldin</Text>
            <Text className="text-2xl font-extrabold text-brand-dark">{displayName}</Text>
          </View>
          <Pressable onPress={handleSignOut} hitSlop={12} className="rounded-full bg-white px-4 py-2">
            <Text className="font-semibold text-danger">Çıkış</Text>
          </Pressable>
        </View>

        <View className="mb-6 overflow-hidden rounded-3xl bg-brand-dark p-5">
          <View className="flex-row items-center gap-4">
            <Image
              source={require('../../assets/logo-sm.png')}
              className="h-14 w-14 rounded-2xl"
            />
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-white">BisiCab Sürücü</Text>
              <Text className="text-sm text-brand-light">İZULAŞ · Alsancak–Konak hattı</Text>
            </View>
          </View>

          {inShift ? (
            <View className="mt-5 rounded-2xl bg-white/10 p-4">
              <Text className="text-xs font-bold uppercase tracking-widest text-brand">
                Aktif mesai · {activeShift!.plannedDurationHours} saat
              </Text>
              <Text className="mt-1 text-sm text-brand-light">Bitiş: {shiftEndLabel}</Text>
              {hasVehicle ? (
                <>
                  <Text className="mt-4 text-xs uppercase text-brand-light">Aktif araç</Text>
                  <Text className="text-3xl font-extrabold text-white">
                    {activeShift!.plate}
                  </Text>
                  {activeShift!.label ? (
                    <Text className="text-sm text-brand-light">{activeShift!.label}</Text>
                  ) : null}
                </>
              ) : (
                <Text className="mt-3 text-base font-semibold text-white">
                  Henüz araç almadınız
                </Text>
              )}
            </View>
          ) : (
            <Text className="mt-5 text-sm text-brand-light">
              Mesaide değilsiniz. Mesaiye başlamak için süre seçin.
            </Text>
          )}
        </View>

        <View className="mb-6 flex-row gap-3">
          <Card className="flex-1">
            <Text className="text-xs font-semibold uppercase text-slate-500">Bugün</Text>
            <Text className="mt-1 text-3xl font-extrabold text-brand-dark">
              {todaySummary?.rides ?? 0}
            </Text>
            <Text className="text-sm text-slate-500">sürüş</Text>
          </Card>
          <Card className="flex-1">
            <Text className="text-xs font-semibold uppercase text-slate-500">Kazanç</Text>
            <Text className="mt-1 text-3xl font-extrabold text-success">
              {formatTL(todaySummary?.earnings ?? 0)}
            </Text>
            <Text className="text-sm text-slate-500">bugün</Text>
          </Card>
        </View>

        {ongoingTrip ? (
          <PrimaryButton
            label="Devam Eden Yolculuk"
            sublabel={`${ongoingTrip.distanceKm.toFixed(2)} km · devam et`}
            onPress={() => router.push('/(driver)/trip')}
            className="mb-4 py-5"
          />
        ) : null}

        {!inShift ? (
          <PrimaryButton
            label="Mesaiye Başla"
            sublabel="4 veya 8 saat seçin"
            onPress={() => router.push('/(driver)/start-shift')}
            variant="success"
            className="py-5"
          />
        ) : hasVehicle ? (
          <>
            {!ongoingTrip ? (
              <PrimaryButton
                label="Yolculuğu Başlat"
                sublabel="Canlı takip ve ücret hesabı"
                onPress={() => router.push('/(driver)/trip')}
                className="py-6"
              />
            ) : null}

            <Pressable
              onPress={onReleaseVehicle}
              disabled={releasing || !!ongoingTrip}
              className="mt-3 items-center rounded-2xl border border-brand/40 bg-white py-4"
            >
              {releasing ? (
                <ActivityIndicator color="#D4A017" />
              ) : (
                <Text className="font-bold text-brand-deep">Aracı Bırak</Text>
              )}
            </Pressable>

            <Pressable
              onPress={onEndShift}
              disabled={ending}
              className="mt-3 items-center rounded-2xl border border-danger/30 py-4"
            >
              {ending ? (
                <ActivityIndicator color="#EF4444" />
              ) : (
                <Text className="font-bold text-danger">Mesaiyi Bitir</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <PrimaryButton
              label="Araç Al"
              sublabel="Müsait bisiklet seçin"
              onPress={() => router.push('/(driver)/select-vehicle')}
              className="py-5"
            />
            <Pressable
              onPress={onEndShift}
              disabled={ending}
              className="mt-3 items-center rounded-2xl border border-danger/30 py-4"
            >
              {ending ? (
                <ActivityIndicator color="#EF4444" />
              ) : (
                <Text className="font-bold text-danger">Mesaiyi Bitir</Text>
              )}
            </Pressable>
          </>
        )}

        <Pressable
          onPress={() => router.push('/(driver)/history')}
          className="mt-6 flex-row items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-sm"
        >
          <View>
            <Text className="font-bold text-brand-dark">Sürüş Geçmişi</Text>
            <Text className="text-sm text-slate-500">Tamamlanan ve iptal kayıtları</Text>
          </View>
          <Text className="text-xl text-brand-deep">→</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
