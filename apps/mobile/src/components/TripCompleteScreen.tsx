import { View, Text, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { routeSummaryFromStops, passengersSummary, stopLabel } from '@bisicab/shared';
import { PrimaryButton, Card } from '@/components/ui';
import { formatDuration, formatKm, formatTL } from '@/lib/format';

export interface TripCompleteSummary {
  amount: number;
  distanceKm: number;
  durationSeconds: number;
  routeStops: string[];
  male: number;
  female: number;
  childMale: number;
  childFemale: number;
  hasTourist: boolean;
  receiptUri?: string | null;
}

interface Props {
  summary: TripCompleteSummary;
  onHome: () => void;
}

export function TripCompleteScreen({ summary, onHome }: Props) {
  const routeLabel =
    summary.routeStops.length >= 2
      ? routeSummaryFromStops(summary.routeStops)
      : summary.routeStops[0]
        ? stopLabel(summary.routeStops[0])
        : '—';

  return (
    <SafeAreaView className="flex-1 bg-brand-dark">
      <View className="flex-1 px-6 pt-8">
        <View className="items-center">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-success">
            <Text className="text-4xl font-extrabold text-white">✓</Text>
          </View>
          <Text className="text-3xl font-extrabold text-white">Yolculuk Tamamlandı</Text>
          <Text className="mt-2 text-center text-brand-light">
            Fiş kaydedildi. İyi mesailer!
          </Text>
        </View>

        <Card className="mt-8">
          <Text className="text-center text-xs font-bold uppercase tracking-widest text-slate-500">
            Tahsil edilen tutar
          </Text>
          <Text className="mt-1 text-center text-5xl font-extrabold text-success">
            {formatTL(summary.amount)}
          </Text>

          <View className="mt-6 flex-row gap-3">
            <View className="flex-1 rounded-xl bg-canvas px-3 py-3">
              <Text className="text-xs text-slate-500">Mesafe</Text>
              <Text className="text-lg font-bold text-brand-dark">
                {formatKm(summary.distanceKm)}
              </Text>
            </View>
            <View className="flex-1 rounded-xl bg-canvas px-3 py-3">
              <Text className="text-xs text-slate-500">Süre</Text>
              <Text className="text-lg font-bold text-brand-dark">
                {formatDuration(summary.durationSeconds)}
              </Text>
            </View>
          </View>

          <View className="mt-4 rounded-xl bg-canvas px-4 py-3">
            <Text className="text-xs font-semibold uppercase text-slate-500">Güzergah</Text>
            <Text className="mt-1 text-base font-semibold text-brand-dark">{routeLabel}</Text>
          </View>

          <View className="mt-3 rounded-xl bg-canvas px-4 py-3">
            <Text className="text-xs font-semibold uppercase text-slate-500">Yolcular</Text>
            <Text className="mt-1 text-base font-semibold text-brand-dark">
              {passengersSummary({
                male: summary.male,
                female: summary.female,
                childMale: summary.childMale,
                childFemale: summary.childFemale,
              })}
              {summary.hasTourist ? ' · Turist' : ''}
            </Text>
          </View>

          {summary.receiptUri ? (
            <Image
              source={{ uri: summary.receiptUri }}
              className="mt-4 h-36 w-full rounded-xl bg-slate-100"
              resizeMode="cover"
            />
          ) : null}
        </Card>

        <View className="mt-auto pb-6">
          <PrimaryButton label="Ana Sayfaya Dön" onPress={onHome} variant="brand" className="py-5" />
        </View>
      </View>
    </SafeAreaView>
  );
}
