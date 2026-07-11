import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import type { LiveTripState } from '@bisicab/shared';
import { useAuthStore } from '@/store/authStore';
import { useT, useLocaleStore } from '@/i18n';
import { subscribeLive } from '@/lib/liveTrip';
import { TripMap } from '@/components/TripMap';
import { PassengerTipsCarousel } from '@/components/PassengerTipsCarousel';
import { formatDuration, formatKm, formatTL } from '@/lib/format';
import { C } from '@/lib/colors';

interface Props {
  onSignOut: () => void;
}

export default function PassengerLiveScreen({ onSignOut }: Props) {
  const { t, locale } = useT();
  const setLocale = useLocaleStore((s) => s.setLocale);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const driverId = profile?.id ?? session?.user?.id ?? null;
  const [live, setLive] = useState<LiveTripState | null>(null);

  useEffect(() => {
    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE
    );
    return () => {
      void ScreenOrientation.unlockAsync();
    };
  }, []);

  useEffect(() => {
    if (!driverId) return;
    const unsub = subscribeLive(driverId, setLive);
    return unsub;
  }, [driverId]);

  const isActive = live?.status === 'ongoing';

  const mapPath = useMemo(() => {
    if (!live?.path?.length) return [];
    return live.path.map((p) => ({ lat: p.lat, lng: p.lng }));
  }, [live?.path]);

  const currentPoint = useMemo(() => {
    if (live?.current_lat == null || live?.current_lng == null) return null;
    return { lat: live.current_lat, lng: live.current_lng };
  }, [live?.current_lat, live?.current_lng]);

  const toggleLang = () => {
    void setLocale(locale === 'tr' ? 'en' : 'tr');
  };

  const handleSignOut = async () => {
    await signOut();
    onSignOut();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBottom} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/logo-sm.png')}
            style={styles.logo}
          />
          <View>
            <Text style={styles.brand}>{t('appName')}</Text>
            <Text style={styles.sub}>{t('izulas')}</Text>
          </View>
        </View>

        <View style={styles.headerCenter}>
          {isActive ? (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{t('tripActive')}</Text>
            </View>
          ) : (
            <Text style={styles.routeTag}>{t('routeLabel')}</Text>
          )}
        </View>

        <View style={styles.headerRight}>
          <Pressable onPress={toggleLang} style={styles.langBtn}>
            <Text style={styles.langBtnText}>
              {locale === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR'}
            </Text>
          </Pressable>
          <Pressable onPress={handleSignOut} hitSlop={12}>
            <Text style={styles.staffLink}>{t('signOut')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.body, !isLandscape && styles.bodyPortrait]}>
        {!isActive ? (
          <>
            <View style={[styles.heroPanel, !isLandscape && styles.panelFull]}>
              <View style={styles.heroInner}>
                <Text style={styles.welcome}>{t('welcomePassenger')}</Text>
                <Text style={styles.enjoy}>{t('enjoyRide')}</Text>
                <View style={styles.chipRow}>
                  <Chip label={t('chipZero')} />
                  <Chip label={t('chipKordon')} />
                  <Chip label={t('chipLive')} />
                </View>
              </View>
              <View style={styles.heroDecor}>
                <Text style={styles.heroEmoji}>🚲</Text>
              </View>
            </View>

            <View style={[styles.tipsPanel, !isLandscape && styles.panelFull]}>
              <PassengerTipsCarousel />
            </View>
          </>
        ) : (
          <>
            <View style={[styles.mapPanel, !isLandscape && styles.panelFull]}>
              <TripMap path={mapPath} current={currentPoint} />
              <View style={styles.mapOverlay}>
                <Text style={styles.mapOverlayText}>{t('routeLabel')}</Text>
              </View>
            </View>

            <View style={[styles.livePanel, !isLandscape && styles.panelFull]}>
              <View style={styles.fareCard}>
                <Text style={styles.fareLabel}>{t('currentFare')}</Text>
                <Text style={styles.fareValue}>{formatTL(live!.amount)}</Text>
                <Text style={styles.fareNote}>{t('flatRateNote')}</Text>
              </View>

              <View style={styles.metricsRow}>
                <MetricCard
                  icon="📍"
                  label={t('distance')}
                  value={formatKm(live!.distance_km)}
                />
                <MetricCard
                  icon="⏱"
                  label={t('duration')}
                  value={formatDuration(live!.duration_seconds)}
                />
                <MetricCard
                  icon="💨"
                  label={t('speed')}
                  value={`${(live!.speed_kmh ?? 0).toFixed(0)}`}
                  unit={t('kmh')}
                />
              </View>

              <PassengerTipsCarousel compact autoAdvanceMs={10000} />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: string;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060908',
  },
  bgGlowTop: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(245,197,24,0.12)',
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logo: { width: 44, height: 44, borderRadius: 12 },
  brand: { fontSize: 20, fontWeight: '800', color: C.white },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  headerCenter: { flex: 1.2, alignItems: 'center' },
  routeTag: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.success,
  },
  liveText: { color: C.success, fontWeight: '800', fontSize: 12 },
  headerRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  langBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  langBtnText: { color: C.white, fontWeight: '700', fontSize: 13 },
  staffLink: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  bodyPortrait: { flexDirection: 'column' },
  panelFull: { flex: 1, minHeight: 200 },
  heroPanel: {
    flex: 1.05,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  heroInner: {
    flex: 1,
    padding: 28,
    justifyContent: 'center',
  },
  welcome: {
    fontSize: 34,
    fontWeight: '800',
    color: C.white,
    lineHeight: 40,
  },
  enjoy: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.65)',
    maxWidth: 420,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
  },
  chip: {
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.25)',
  },
  chipText: {
    color: C.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  heroDecor: {
    width: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,197,24,0.06)',
  },
  heroEmoji: { fontSize: 72 },
  tipsPanel: {
    flex: 1,
    borderRadius: 28,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  mapPanel: {
    flex: 1.35,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0f1411',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  mapOverlayText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '600',
  },
  livePanel: {
    flex: 0.85,
    gap: 12,
  },
  fareCard: {
    backgroundColor: C.brand,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(11,15,12,0.55)',
    letterSpacing: 1.2,
  },
  fareValue: {
    fontSize: 44,
    fontWeight: '900',
    color: C.dark,
    marginTop: 4,
  },
  fareNote: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(11,15,12,0.5)',
    textAlign: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIcon: { fontSize: 20, marginBottom: 6 },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: C.white,
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },
});
