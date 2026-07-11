import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ROUTE_ZONES,
  type RouteStop,
  type RouteZone,
} from '@bisicab/shared';

const ICON_COLOR: Record<RouteZone['icon'], string> = {
  anchor: '#F5C518',
  museum: '#22C55E',
  wave: '#FFE566',
  tower: '#D4A017',
  tree: '#22C55E',
};

const ICON_GLYPH: Record<RouteZone['icon'], string> = {
  anchor: '⚓',
  museum: '🏛',
  wave: '🌊',
  tower: '🕌',
  tree: '🌳',
};

export interface RoutePick {
  zone: RouteZone;
  stop: RouteStop;
}

interface Props {
  title: string;
  onSelect: (pick: RoutePick) => void;
  onClose: () => void;
}

/** Bölge seç → durak seç (Figma). */
export function ZonePicker({ title, onSelect, onClose }: Props) {
  const [zone, setZone] = useState<RouteZone | null>(null);

  if (zone) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="bg-brand-dark px-4 pb-4 pt-2">
          <Pressable onPress={() => setZone(null)} className="mb-2 self-start py-1">
            <Text className="text-lg text-white">←</Text>
          </Pressable>
          <Text className="text-xs font-bold uppercase tracking-widest text-brand">
            {title} · {zone.name}
          </Text>
          <Text className="mt-1 text-2xl font-extrabold text-white">Durak Seç</Text>
        </View>

        <ScrollView contentContainerClassName="p-4">
          {zone.stops.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => onSelect({ zone, stop: s })}
              className="mb-3 flex-row items-center rounded-2xl bg-white p-4 shadow-sm active:opacity-80"
            >
              <View className="flex-1">
                <Text className="text-lg font-extrabold text-brand-dark">{s.name}</Text>
                {s.tag ? (
                  <Text className="mt-0.5 text-sm font-medium text-brand-deep">
                    {s.tag}
                  </Text>
                ) : (
                  <Text className="mt-0.5 text-sm font-medium text-success">Durak</Text>
                )}
              </View>
              <Text className="ml-2 text-xl text-slate-300">›</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="bg-brand-dark px-4 pb-4 pt-2">
        <Pressable onPress={onClose} className="mb-2 self-start py-1">
          <Text className="text-lg text-white">←</Text>
        </Pressable>
        <Text className="text-xs font-bold uppercase tracking-widest text-brand">
          {title}
        </Text>
        <Text className="mt-1 text-2xl font-extrabold text-white">Bölge Seç</Text>
      </View>

      <ScrollView contentContainerClassName="p-4">
        {ROUTE_ZONES.map((z) => (
          <Pressable
            key={z.id}
            onPress={() => setZone(z)}
            className="mb-3 flex-row items-center rounded-2xl bg-white p-4 shadow-sm active:opacity-80"
          >
            <View
              className="mr-4 h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: `${ICON_COLOR[z.icon]}22` }}
            >
              <Text style={{ fontSize: 22 }}>{ICON_GLYPH[z.icon]}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-brand-dark">{z.name}</Text>
              <Text className="mt-0.5 text-sm text-slate-500" numberOfLines={2}>
                {z.stops
                  .map((s) => (s.tag ? `${s.name} (${s.tag})` : s.name))
                  .join(' · ')}
              </Text>
            </View>
            <Text className="ml-2 text-xl text-slate-300">›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
