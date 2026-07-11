import { View, Text, Pressable } from 'react-native';
import { PASSENGER_LIMITS } from '@bisicab/shared';
import { Card, SectionTitle } from '@/components/ui';

function Stepper({
  label,
  value,
  onChange,
  canDec,
  canInc,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  canDec: boolean;
  canInc: boolean;
}) {
  return (
    <View className="mb-2 flex-row items-center justify-between rounded-xl bg-canvas px-4 py-3">
      <Text className="flex-1 text-base font-semibold text-brand-dark">{label}</Text>
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => onChange(Math.max(0, value - 1))}
          disabled={!canDec}
          className={`h-10 w-10 items-center justify-center rounded-full ${
            canDec ? 'bg-white' : 'bg-slate-100'
          }`}
        >
          <Text className="text-xl font-bold text-brand-dark">−</Text>
        </Pressable>
        <Text className="w-6 text-center text-xl font-bold text-brand-dark">{value}</Text>
        <Pressable
          onPress={() => onChange(value + 1)}
          disabled={!canInc}
          className={`h-10 w-10 items-center justify-center rounded-full ${
            canInc ? 'bg-brand' : 'bg-slate-100'
          }`}
        >
          <Text className={`text-xl font-bold ${canInc ? 'text-brand-dark' : 'text-slate-400'}`}>
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

interface Props {
  male: number;
  female: number;
  childMale: number;
  childFemale: number;
  hasTourist: boolean;
  onMale: (n: number) => void;
  onFemale: (n: number) => void;
  onChildMale: (n: number) => void;
  onChildFemale: (n: number) => void;
  onTourist: (v: boolean) => void;
}

export function PassengerSelector({
  male,
  female,
  childMale,
  childFemale,
  hasTourist,
  onMale,
  onFemale,
  onChildMale,
  onChildFemale,
  onTourist,
}: Props) {
  const adults = male + female;
  const children = childMale + childFemale;
  const total = adults + children;

  const canAddAdult = adults < PASSENGER_LIMITS.maxAdults && total < PASSENGER_LIMITS.maxTotal;
  const canAddChild =
    children < PASSENGER_LIMITS.maxChildren && total < PASSENGER_LIMITS.maxTotal;

  return (
    <Card>
      <View className="mb-3 flex-row items-center justify-between">
        <SectionTitle>Yolcular</SectionTitle>
        <Text className="text-sm font-semibold text-brand-dark">
          {total}/{PASSENGER_LIMITS.maxTotal}
        </Text>
      </View>

      <Text className="mb-2 text-xs text-slate-500">
        Yetişkin (en fazla {PASSENGER_LIMITS.maxAdults})
      </Text>
      <Stepper
        label="Erkek"
        value={male}
        onChange={onMale}
        canDec={male > 0}
        canInc={canAddAdult && male < PASSENGER_LIMITS.adultMale}
      />
      <Stepper
        label="Kadın"
        value={female}
        onChange={onFemale}
        canDec={female > 0}
        canInc={canAddAdult && female < PASSENGER_LIMITS.adultFemale}
      />

      <Text className="mb-2 mt-2 text-xs text-slate-500">
        Çocuk (en fazla {PASSENGER_LIMITS.maxChildren})
      </Text>
      <Stepper
        label="Erkek çocuk"
        value={childMale}
        onChange={onChildMale}
        canDec={childMale > 0}
        canInc={canAddChild && childMale < PASSENGER_LIMITS.childMale}
      />
      <Stepper
        label="Kız çocuk"
        value={childFemale}
        onChange={onChildFemale}
        canDec={childFemale > 0}
        canInc={canAddChild && childFemale < PASSENGER_LIMITS.childFemale}
      />

      <Text className="mb-2 mt-3 text-xs text-slate-500">Turist var mı?</Text>
      <View className="flex-row gap-3">
        <Pressable
          onPress={() => onTourist(true)}
          className={`flex-1 items-center rounded-xl py-3 ${
            hasTourist ? 'bg-brand' : 'bg-canvas'
          }`}
        >
          <Text className={`font-bold ${hasTourist ? 'text-brand-dark' : 'text-slate-600'}`}>
            Evet
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onTourist(false)}
          className={`flex-1 items-center rounded-xl py-3 ${
            !hasTourist ? 'bg-brand' : 'bg-canvas'
          }`}
        >
          <Text className={`font-bold ${!hasTourist ? 'text-brand-dark' : 'text-slate-600'}`}>
            Hayır
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
