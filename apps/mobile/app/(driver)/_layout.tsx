import { Stack } from 'expo-router';
import { C } from '@/lib/colors';

/** Alt ekranlar (trip, mesai, araç, geçmiş). Ana ekran app/index → AppBootstrap. */
export default function DriverLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { flex: 1, backgroundColor: C.canvas },
        headerStyle: { backgroundColor: C.dark },
        headerTintColor: C.brand,
        headerTitleStyle: { color: C.white, fontWeight: '700' },
      }}
    >
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="start-shift" options={{ headerShown: true, title: 'Mesai Süresi' }} />
      <Stack.Screen name="select-vehicle" options={{ headerShown: true, title: 'Araç Seç' }} />
      <Stack.Screen name="trip" options={{ gestureEnabled: false }} />
      <Stack.Screen name="history" options={{ headerShown: true, title: 'Sürüş Geçmişi' }} />
    </Stack>
  );
}
