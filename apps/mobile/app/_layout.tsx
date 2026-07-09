import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(driver)" />
          <Stack.Screen name="(passenger)" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
