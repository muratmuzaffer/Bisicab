import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useAppModeStore, type AppMode } from '@/store/appModeStore';
import { useT, useLocaleStore } from '@/i18n';
import { PrimaryButton } from '@/components/ui';

interface Props {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: Props) {
  const signIn = useAuthStore((s) => s.signIn);
  const loading = useAuthStore((s) => s.loading);
  const mode = useAppModeStore((s) => s.mode);
  const setMode = useAppModeStore((s) => s.setMode);
  const { t, locale } = useT();
  const setLocale = useLocaleStore((s) => s.setLocale);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError(t('emailPasswordRequired'));
      return;
    }
    const { error: err } = await signIn(email.trim(), password);
    if (err) {
      setError(err);
      return;
    }
    setDone(true);
    setTimeout(onSuccess, 400);
  };

  const pickMode = (next: AppMode) => {
    void setMode(next);
  };

  const toggleLang = () => {
    void setLocale(locale === 'tr' ? 'en' : 'tr');
  };

  if (done) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-dark">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-success">
          <Text className="text-4xl font-extrabold text-white">✓</Text>
        </View>
        <Text className="mt-5 text-2xl font-extrabold text-white">
          {t('loginSuccess')}
        </Text>
        <ActivityIndicator color="#F5C518" className="mt-6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-8"
      >
        <View className="absolute right-6 top-4">
          <Pressable
            onPress={toggleLang}
            className="rounded-full bg-white/10 px-4 py-2"
          >
            <Text className="font-bold text-white">
              {locale === 'tr' ? 'EN' : 'TR'}
            </Text>
          </Pressable>
        </View>

        <View className="mb-8 items-center">
          <Image
            source={require('../../assets/logo-sm.png')}
            className="mb-4 h-24 w-24 rounded-3xl"
          />
          <Text className="text-4xl font-extrabold text-white">{t('appName')}</Text>
          <Text className="mt-2 text-center text-brand-light">
            {mode === 'driver' ? t('driverLoginHint') : t('passengerLoginHint')}
          </Text>
        </View>

        <View className="mb-6 flex-row rounded-2xl bg-white/10 p-1">
          <ModeTab
            label={t('driverMode')}
            active={mode === 'driver'}
            onPress={() => pickMode('driver')}
          />
          <ModeTab
            label={t('passengerMode')}
            active={mode === 'passenger'}
            onPress={() => pickMode('passenger')}
          />
        </View>

        <Text className="mb-2 text-sm font-semibold text-white">{t('email')}</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="surucu01@izulas.com"
          placeholderTextColor="#A8B5AD"
          className="mb-4 rounded-2xl bg-white/10 px-4 py-4 text-base text-white"
        />

        <Text className="mb-2 text-sm font-semibold text-white">{t('password')}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••"
          placeholderTextColor="#A8B5AD"
          className="mb-4 rounded-2xl bg-white/10 px-4 py-4 text-base text-white"
        />

        {error ? (
          <Text className="mb-4 text-center text-sm text-danger">{error}</Text>
        ) : null}

        <PrimaryButton
          label={t('signIn')}
          onPress={onSubmit}
          loading={loading}
          disabled={loading}
          className="py-4"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ModeTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-xl py-3 ${active ? 'bg-brand' : ''}`}
    >
      <Text
        className={`text-center text-sm font-extrabold ${
          active ? 'text-brand-dark' : 'text-white/80'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
