/** Yolcu tableti — İzmir kordon hattı turist tavsiyeleri (i18n anahtarları). */
export interface PassengerTip {
  id: string;
  emoji: string;
  titleKey:
    | 'tipKordonTitle'
    | 'tipClockTitle'
    | 'tipFareTitle'
    | 'tipSafetyTitle'
    | 'tipAlsancakTitle'
    | 'tipKonakPierTitle';
  bodyKey:
    | 'tipKordonBody'
    | 'tipClockBody'
    | 'tipFareBody'
    | 'tipSafetyBody'
    | 'tipAlsancakBody'
    | 'tipKonakPierBody';
  accent: string;
}

export const PASSENGER_TIPS: PassengerTip[] = [
  {
    id: 'kordon',
    emoji: '🌊',
    titleKey: 'tipKordonTitle',
    bodyKey: 'tipKordonBody',
    accent: '#0EA5E9',
  },
  {
    id: 'clock',
    emoji: '🕐',
    titleKey: 'tipClockTitle',
    bodyKey: 'tipClockBody',
    accent: '#F59E0B',
  },
  {
    id: 'alsancak',
    emoji: '⚓',
    titleKey: 'tipAlsancakTitle',
    bodyKey: 'tipAlsancakBody',
    accent: '#22C55E',
  },
  {
    id: 'konak-pier',
    emoji: '🛥️',
    titleKey: 'tipKonakPierTitle',
    bodyKey: 'tipKonakPierBody',
    accent: '#8B5CF6',
  },
  {
    id: 'fare',
    emoji: '💳',
    titleKey: 'tipFareTitle',
    bodyKey: 'tipFareBody',
    accent: '#F5C518',
  },
  {
    id: 'safety',
    emoji: '🪑',
    titleKey: 'tipSafetyTitle',
    bodyKey: 'tipSafetyBody',
    accent: '#EF4444',
  },
];
