import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { PASSENGER_TIPS, type PassengerTip } from '@/lib/passengerTips';
import { useT } from '@/i18n';
import { C } from '@/lib/colors';

interface Props {
  compact?: boolean;
  autoAdvanceMs?: number;
}

export function PassengerTipsCarousel({
  compact = false,
  autoAdvanceMs = 8000,
}: Props) {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const panelWidth = compact ? Math.min(width * 0.38, 420) : width * 0.46;
  const cardWidth = Math.max(panelWidth - 32, 260);

  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (compact) return;
    const timer = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % PASSENGER_TIPS.length;
        scrollRef.current?.scrollTo({ x: next * cardWidth, animated: true });
        return next;
      });
    }, autoAdvanceMs);
    return () => clearInterval(timer);
  }, [autoAdvanceMs, cardWidth, compact]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / cardWidth);
    if (i >= 0 && i < PASSENGER_TIPS.length) setIndex(i);
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {!compact ? (
        <Text style={styles.sectionTitle}>{t('tipsTitle')}</Text>
      ) : (
        <Text style={styles.compactTitle}>{t('tipsShort')}</Text>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        decelerationRate="fast"
        snapToInterval={cardWidth}
      >
        {PASSENGER_TIPS.map((tip) => (
          <TipCard
            key={tip.id}
            tip={tip}
            width={cardWidth}
            compact={compact}
            title={t(tip.titleKey)}
            body={t(tip.bodyKey)}
          />
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {PASSENGER_TIPS.map((tip, i) => (
          <Pressable
            key={tip.id}
            onPress={() => {
              setIndex(i);
              scrollRef.current?.scrollTo({ x: i * cardWidth, animated: true });
            }}
            style={[
              styles.dot,
              i === index && styles.dotActive,
              {
                backgroundColor:
                  i === index ? C.brand : 'rgba(255,255,255,0.25)',
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function TipCard({
  tip,
  width,
  compact,
  title,
  body,
}: {
  tip: PassengerTip;
  width: number;
  compact: boolean;
  title: string;
  body: string;
}) {
  return (
    <View style={[styles.card, { width }, compact && styles.cardCompact]}>
      <View style={[styles.emojiRing, { borderColor: tip.accent }]}>
        <Text style={styles.emoji}>{tip.emoji}</Text>
      </View>
      <Text
        style={[styles.cardTitle, compact && styles.cardTitleCompact]}
        numberOfLines={2}
      >
        {title}
      </Text>
      <Text
        style={[styles.cardBody, compact && styles.cardBodyCompact]}
        numberOfLines={compact ? 3 : 5}
      >
        {body}
      </Text>
      <View style={[styles.accentBar, { backgroundColor: tip.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  wrapCompact: { marginTop: 8 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.white,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 220,
    overflow: 'hidden',
  },
  cardCompact: {
    minHeight: 140,
    padding: 16,
    borderRadius: 18,
  },
  emojiRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  emoji: { fontSize: 28 },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.white,
    marginBottom: 10,
    lineHeight: 26,
  },
  cardTitleCompact: { fontSize: 16, marginBottom: 6 },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.78)',
    flex: 1,
  },
  cardBodyCompact: { fontSize: 13, lineHeight: 18 },
  accentBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 22,
  },
});
