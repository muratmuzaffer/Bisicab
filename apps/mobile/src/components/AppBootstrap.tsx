import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { config } from '@/lib/config';
import { C } from '@/lib/colors';
import { LoginForm } from '@/components/LoginForm';
import DriverHome from '@/screens/DriverHome';
import { ShiftLocationBeacon } from '@/components/ShiftLocationBeacon';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';

type Phase = 'boot' | 'login' | 'home';

/**
 * Tek giriş kapısı: router Redirect kullanmaz.
 * APK'da iç içe Stack / Redirect beyaz ekrana yol açıyordu.
 */
export function AppBootstrap() {
  const init = useAuthStore((s) => s.init);
  const session = useAuthStore((s) => s.session);
  const initialized = useAuthStore((s) => s.initialized);
  const [phase, setPhase] = useState<Phase>('boot');
  const [bootMsg, setBootMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      setBootMsg('Supabase ayarları APK içinde tanımlı değil.');
      setPhase('login');
      return;
    }
    void init().catch((e) => {
      setBootMsg(e instanceof Error ? e.message : 'Başlatma hatası');
      setPhase('login');
    });
  }, [init]);

  useEffect(() => {
    if (!initialized) return;
    setPhase(session ? 'home' : 'login');
  }, [initialized, session]);

  if (phase === 'boot') {
    return (
      <View style={styles.boot}>
        <Text style={styles.bootTitle}>BisiCab</Text>
        <ActivityIndicator color={C.brand} size="large" />
        {bootMsg ? <Text style={styles.bootErr}>{bootMsg}</Text> : null}
      </View>
    );
  }

  if (phase === 'login') {
    return (
      <LoginForm
        onSuccess={() => setPhase('home')}
      />
    );
  }

  return (
    <ScreenErrorBoundary>
      <ShiftLocationBeacon />
      <DriverHome onSignOut={() => setPhase('login')} />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: C.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: C.white,
    marginBottom: 20,
  },
  bootErr: {
    marginTop: 16,
    color: C.danger,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
