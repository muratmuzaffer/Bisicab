import { View, Text, Pressable } from 'react-native';
import { formatDuration, formatKm, formatTL } from '@/lib/format';
import { PrimaryButton } from '@/components/ui';

interface Props {
  amount: number;
  distanceKm: number;
  durationSeconds: number;
  speedKmh: number;
  onEnd: () => void;
  onCancel: () => void;
}

/** Canlı yolculuk — açık tema alt panel. */
export function TripLivePanel({
  amount,
  distanceKm,
  durationSeconds,
  speedKmh,
  onEnd,
  onCancel,
}: Props) {
  const moving = speedKmh >= 1;

  return (
    <View className="rounded-t-3xl bg-white px-6 pb-2 pt-5 shadow-lg shadow-black/10">
      <View className="mb-1 h-1 w-10 self-center rounded-full bg-slate-200" />

      <View className="mb-4 flex-row items-end justify-between">
        <View>
          <Text className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Güncel tutar
          </Text>
          <Text className="text-5xl font-extrabold text-brand-dark">
            {formatTL(amount)}
          </Text>
        </View>
        <View
          className={`rounded-full px-3 py-1 ${moving ? 'bg-success/15' : 'bg-slate-100'}`}
        >
          <Text
            className={`text-xs font-bold ${moving ? 'text-success' : 'text-slate-500'}`}
          >
            {moving ? 'Hareket' : 'Durdu'}
          </Text>
        </View>
      </View>

      <View className="mb-5 flex-row gap-2">
        <View className="flex-1 rounded-2xl bg-canvas px-3 py-3">
          <Text className="text-xs font-semibold text-slate-500">Mesafe</Text>
          <Text className="text-xl font-extrabold text-brand-dark">
            {formatKm(distanceKm)}
          </Text>
        </View>
        <View className="flex-1 rounded-2xl bg-canvas px-3 py-3">
          <Text className="text-xs font-semibold text-slate-500">Süre</Text>
          <Text className="text-xl font-extrabold text-brand-dark">
            {formatDuration(durationSeconds)}
          </Text>
        </View>
        <View className="flex-1 rounded-2xl bg-brand/15 px-3 py-3">
          <Text className="text-xs font-semibold text-brand-deep">Hız</Text>
          <Text className="text-xl font-extrabold text-brand-dark">
            {speedKmh.toFixed(0)} km/s
          </Text>
        </View>
      </View>

      <PrimaryButton
        label="Yolculuğu Bitir"
        sublabel="Ödeme ve fiş adımı"
        onPress={onEnd}
        variant="brand"
        className="py-5"
      />
      <Pressable onPress={onCancel} className="mt-2 items-center py-3">
        <Text className="text-sm font-semibold text-danger">Yolculuğu iptal et</Text>
      </Pressable>
    </View>
  );
}
