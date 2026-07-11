import { View, Text, Pressable } from 'react-native';
import { MAX_ROUTE_STOPS, stopLabel } from '@bisicab/shared';
import type { RoutePick } from '@/components/ZonePicker';
import { Card, SectionTitle } from '@/components/ui';

export type RouteSelection = RoutePick;

interface Props {
  stops: RouteSelection[];
  onAdd: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export function RouteStopBuilder({
  stops,
  onAdd,
  onEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
}: Props) {
  const canAdd = stops.length < MAX_ROUTE_STOPS;

  return (
    <Card>
      <View className="mb-3 flex-row items-center justify-between">
        <SectionTitle>Güzergah</SectionTitle>
        <Text className="text-xs font-semibold text-slate-500">
          {stops.length}/{MAX_ROUTE_STOPS} durak
        </Text>
      </View>

      {stops.length === 0 ? (
        <Text className="mb-3 text-center text-sm text-slate-500">
          En az 2 durak ekleyin. Örn: Cumhuriyet Meydanı → Vasıf Çınar → Cumhuriyet Meydanı
        </Text>
      ) : (
        <View className="mb-3">
          {stops.map((s, i) => (
            <View key={`${s.stop.id}-${i}`} className="mb-2 flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-brand">
                <Text className="text-sm font-extrabold text-brand-dark">{i + 1}</Text>
              </View>
              <Pressable
                onPress={() => onEdit(i)}
                className="min-h-[52px] flex-1 rounded-xl bg-canvas px-3 py-2 active:bg-soft"
              >
                <Text className="text-xs text-slate-500">{s.zone.name}</Text>
                <Text className="text-base font-semibold text-brand-dark">
                  {stopLabel(s.stop.id)}
                </Text>
              </Pressable>
              <View className="gap-1">
                {i > 0 ? (
                  <Pressable
                    onPress={() => onMoveUp(i)}
                    className="h-7 w-7 items-center justify-center rounded-lg bg-canvas"
                  >
                    <Text className="text-brand-dark">↑</Text>
                  </Pressable>
                ) : (
                  <View className="h-7 w-7" />
                )}
                {i < stops.length - 1 ? (
                  <Pressable
                    onPress={() => onMoveDown(i)}
                    className="h-7 w-7 items-center justify-center rounded-lg bg-canvas"
                  >
                    <Text className="text-brand-dark">↓</Text>
                  </Pressable>
                ) : (
                  <View className="h-7 w-7" />
                )}
              </View>
              <Pressable
                onPress={() => onRemove(i)}
                className="h-8 w-8 items-center justify-center rounded-full bg-danger/10"
              >
                <Text className="font-bold text-danger">×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {canAdd ? (
        <Pressable
          onPress={onAdd}
          className="items-center rounded-xl border border-dashed border-brand/50 bg-brand/10 py-3 active:bg-brand/20"
        >
          <Text className="font-bold text-brand-deep">+ Durak Ekle</Text>
        </Pressable>
      ) : (
        <Text className="text-center text-xs text-slate-500">
          En fazla {MAX_ROUTE_STOPS} durak
        </Text>
      )}

      {stops.length >= 2 ? (
        <Text className="mt-3 text-center text-sm text-slate-600">
          {stops.map((s) => stopLabel(s.stop.id)).join(' → ')}
        </Text>
      ) : null}
    </Card>
  );
}
