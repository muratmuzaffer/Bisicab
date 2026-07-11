import type { ReactNode } from 'react';
import { View, Text, Pressable, ActivityIndicator, type ViewProps } from 'react-native';

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`flex-1 bg-canvas ${className}`}>{children}</View>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`rounded-2xl bg-white p-4 shadow-sm shadow-black/5 ${className}`}>
      {children}
    </View>
  );
}

export function DarkCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`rounded-2xl bg-surface/90 p-4 ${className}`}>{children}</View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-deep">
      {children}
    </Text>
  );
}

export function PrimaryButton({
  label,
  sublabel,
  onPress,
  disabled,
  loading,
  variant = 'brand',
  className = '',
}: {
  label: string;
  sublabel?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'brand' | 'success' | 'danger' | 'dark';
  className?: string;
}) {
  const bg =
    variant === 'success'
      ? 'bg-success'
      : variant === 'danger'
        ? 'bg-danger'
        : variant === 'dark'
          ? 'bg-brand-dark'
          : 'bg-brand';
  const textColor =
    variant === 'brand' ? 'text-brand-dark' : 'text-white';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`items-center justify-center rounded-2xl px-6 py-4 active:opacity-90 ${
        disabled ? 'opacity-50' : ''
      } ${bg} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'brand' ? '#0B0F0C' : '#fff'} />
      ) : (
        <>
          <Text className={`text-lg font-extrabold ${textColor}`}>{label}</Text>
          {sublabel ? (
            <Text className={`mt-1 text-sm ${variant === 'brand' ? 'text-brand-dark/70' : 'text-white/80'}`}>
              {sublabel}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  className = '',
}: {
  label: string;
  onPress: () => void;
  className?: string;
}) {
  return (
    <Pressable onPress={onPress} className={`items-center py-3 ${className}`}>
      <Text className="text-base font-semibold text-brand-light">{label}</Text>
    </Pressable>
  );
}

export function MetricPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View className={`flex-1 items-center rounded-xl px-2 py-3 ${accent ? 'bg-brand/15' : 'bg-white/10'}`}>
      <Text className="text-xs font-semibold uppercase text-brand-light">{label}</Text>
      <Text className="mt-1 text-xl font-extrabold text-white">{value}</Text>
    </View>
  );
}

export function Row({ children, className = '', ...props }: ViewProps & { children: ReactNode; className?: string }) {
  return (
    <View className={`flex-row items-center ${className}`} {...props}>
      {children}
    </View>
  );
}
