import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';

export default function LoginScreen() {
  const { signIn, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(error);
      return;
    }
    router.replace('/(driver)/home');
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-8"
      >
        <Text className="mb-2 text-4xl font-extrabold text-white">BisiCab</Text>
        <Text className="mb-10 text-base text-brand-light">
          Sürücü (Öğrenci) Girişi
        </Text>

        <Text className="mb-1 text-sm text-white">E-posta</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="ogrenci@izulas.com"
          placeholderTextColor="#94a3b8"
          className="mb-4 rounded-xl bg-white/10 px-4 py-3 text-white"
        />

        <Text className="mb-1 text-sm text-white">Şifre</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#94a3b8"
          className="mb-6 rounded-xl bg-white/10 px-4 py-3 text-white"
        />

        {error ? (
          <Text className="mb-4 text-center text-danger">{error}</Text>
        ) : null}

        <Pressable
          onPress={onSubmit}
          disabled={loading}
          className="items-center rounded-xl bg-brand py-4 active:opacity-80"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-lg font-bold text-white">Giriş Yap</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push('/(passenger)/tablet')}
          className="mt-6 items-center"
        >
          <Text className="text-brand-light underline">
            Yolcu Tableti Modu →
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
