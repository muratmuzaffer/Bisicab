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
import { PrimaryButton } from '@/components/ui';

interface Props {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: Props) {
  const signIn = useAuthStore((s) => s.signIn);
  const loading = useAuthStore((s) => s.loading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('E-posta ve şifre gerekli.');
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

  if (done) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-dark">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-success">
          <Text className="text-4xl font-extrabold text-white">✓</Text>
        </View>
        <Text className="mt-5 text-2xl font-extrabold text-white">Giriş başarılı</Text>
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
        <View className="mb-10 items-center">
          <Image
            source={require('../../assets/logo-sm.png')}
            className="mb-4 h-24 w-24 rounded-3xl"
          />
          <Text className="text-4xl font-extrabold text-white">BisiCab</Text>
          <Text className="mt-2 text-brand-light">Sürücü girişi</Text>
        </View>

        <Text className="mb-2 text-sm font-semibold text-white">E-posta</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="surucu01@izulas.com"
          placeholderTextColor="#A8B5AD"
          className="mb-4 rounded-2xl bg-white/10 px-4 py-4 text-base text-white"
        />

        <Text className="mb-2 text-sm font-semibold text-white">Şifre</Text>
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
          label="Giriş Yap"
          onPress={onSubmit}
          loading={loading}
          disabled={loading}
          className="py-4"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
