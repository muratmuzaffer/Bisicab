import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

/**
 * Açılış / yönlendirme ekranı.
 * Oturum ve role göre kullanıcıyı ilgili akışa yönlendirir.
 * (Yolcu tableti moduna manuel olarak /passenger/tablet üzerinden girilir.)
 */
export default function Index() {
  const { initialized, session, profile } = useAuthStore();

  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      router.replace('/(auth)/login');
      return;
    }
    // Rol yüklenene kadar bekle; sürücü ana ekrana git.
    if (profile) {
      router.replace('/(driver)/home');
    }
  }, [initialized, session, profile]);

  return (
    <View className="flex-1 items-center justify-center bg-brand-dark">
      <Text className="mb-4 text-3xl font-extrabold text-white">BisiCab</Text>
      <ActivityIndicator color="#fff" />
    </View>
  );
}
