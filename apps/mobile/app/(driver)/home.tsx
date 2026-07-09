import { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useTripStore } from '@/store/tripStore';
import { formatTL } from '@/lib/format';

export default function DriverHome() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const { todaySummary, loadTodaySummary } = useTripStore();

  useFocusEffect(
    useCallback(() => {
      if (profile) void loadTodaySummary(profile.id);
    }, [profile, loadTodaySummary])
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="flex-grow px-6 pt-4 pb-10">
        <View className="mb-8 flex-row items-center justify-between">
          <View>
            <Text className="text-sm text-slate-500">Hoş geldin,</Text>
            <Text className="text-2xl font-bold text-slate-900">
              {profile?.full_name ?? 'Sürücü'}
            </Text>
          </View>
          <Pressable onPress={signOut}>
            <Text className="text-danger">Çıkış</Text>
          </Pressable>
        </View>

        {/* Bugünün özeti */}
        <View className="mb-8 flex-row gap-4">
          <View className="flex-1 rounded-2xl bg-white p-5 shadow-sm">
            <Text className="text-sm text-slate-500">Bugünkü Sürüş</Text>
            <Text className="mt-1 text-3xl font-extrabold text-brand-dark">
              {todaySummary.rides}
            </Text>
          </View>
          <View className="flex-1 rounded-2xl bg-white p-5 shadow-sm">
            <Text className="text-sm text-slate-500">Bugünkü Kazanç</Text>
            <Text className="mt-1 text-3xl font-extrabold text-success">
              {formatTL(todaySummary.earnings)}
            </Text>
          </View>
        </View>

        <View className="flex-1" />

        {/* Yolculuğu başlat */}
        <Pressable
          onPress={() => router.push('/(driver)/trip')}
          className="items-center justify-center rounded-3xl bg-brand py-10 shadow-lg active:opacity-90"
        >
          <Text className="text-3xl font-extrabold tracking-wide text-white">
            YOLCULUĞU BAŞLAT
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(driver)/history')}
          className="mt-4 items-center py-3"
        >
          <Text className="text-base font-semibold text-brand-dark">
            Sürüş Geçmişi →
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
