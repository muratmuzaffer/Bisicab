import { Stack } from 'expo-router';

export default function DriverLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="trip" options={{ gestureEnabled: false }} />
      <Stack.Screen name="history" options={{ headerShown: true, title: 'Sürüş Geçmişi' }} />
    </Stack>
  );
}
