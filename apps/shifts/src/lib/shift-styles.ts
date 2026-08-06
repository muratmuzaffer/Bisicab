import type { ShiftDuration } from './types';

/** BisiCab PDF özet sayfasındaki vardiya başlangıç saatleri. */
export const SLOT_START_TIMES: Record<string, string> = {
  S: '08:00',
  S1: '08:30',
  D: '09:30',
  B: '12:00',
  B1: '12:30',
  O: '13:30',
  F1: '16:30',
  F: '16:30',
};

export const SLOT_TOKEN = /^[FB]\d+$|^S1$|^S\*?$|^D$|^O$|^B\*?$/;

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h! * 60 + m! + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export function defaultHoursForSlot(slot: string): ShiftDuration {
  const base = slot.replace('*', '');
  if (base === 'O' || base === 'F1' || base === 'F') return 4;
  return 8;
}

export function slotFromToken(token: string): { slot: string; hours: ShiftDuration } | null {
  if (!SLOT_TOKEN.test(token)) return null;
  return { slot: token, hours: defaultHoursForSlot(token) };
}

export function resolveShiftTimes(
  slot: string,
  hours: ShiftDuration
): { start: string; end: string; hours: ShiftDuration } {
  const base = slot.replace('*', '');
  const start = SLOT_START_TIMES[base] ?? SLOT_START_TIMES[slot] ?? (hours === 4 ? '16:30' : '12:30');
  return {
    start,
    end: addMinutesToTime(start, hours * 60),
    hours,
  };
}

export function buildSlotLabel(slot: string, hours: ShiftDuration): string {
  const bayram = slot.includes('*');
  const base = `${slot} ${hours}s`;
  return bayram ? `${base} · Bayram` : base;
}

export type ShiftVisualKind =
  | 'standard4'
  | 'standard8'
  | 'slotS'
  | 'slotD'
  | 'slotB'
  | 'slotO'
  | 'slotSStar'
  | 'slotBStar';

/** Gün detayı ve takvimde gösterim sırası. */
export const SHIFT_KIND_ORDER: ShiftVisualKind[] = [
  'slotSStar',
  'slotBStar',
  'slotS',
  'slotD',
  'slotB',
  'slotO',
  'standard8',
  'standard4',
];

export function getShiftVisualKind(
  slotLabel: string | null | undefined,
  durationHours: ShiftDuration
): ShiftVisualKind {
  const label = slotLabel ?? '';
  const slot = label.split(' ')[0] ?? '';
  if (slot === 'S*') return 'slotSStar';
  if (slot === 'B*') return 'slotBStar';
  if (label.includes('Bayram')) {
    if (slot.startsWith('B')) return 'slotBStar';
    return 'slotSStar';
  }
  if (slot === 'F1') return 'standard4';
  if (slot === 'B1') return 'standard8';
  if (slot === 'S' || slot === 'S1') return 'slotS';
  if (slot === 'D') return 'slotD';
  if (slot === 'B') return 'slotB';
  if (slot === 'O') return 'slotO';
  return durationHours === 4 ? 'standard4' : 'standard8';
}

export function shiftKindLabel(kind: ShiftVisualKind): string {
  switch (kind) {
    case 'slotSStar':
      return 'S* bayram vardiyası (08:00)';
    case 'slotBStar':
      return 'B* bayram vardiyası (12:00)';
    case 'slotS':
      return 'S vardiyası (08:00)';
    case 'slotD':
      return 'D vardiyası (09:30)';
    case 'slotB':
      return 'B vardiyası (12:00)';
    case 'slotO':
      return 'O vardiyası (13:30)';
    case 'standard4':
      return '4 saat (F1)';
    case 'standard8':
      return '8 saat (B1)';
  }
}

export function shiftKindShortLabel(kind: ShiftVisualKind): string {
  switch (kind) {
    case 'slotSStar':
      return 'S*';
    case 'slotBStar':
      return 'B*';
    case 'slotS':
      return 'S';
    case 'slotD':
      return 'D';
    case 'slotB':
      return 'B';
    case 'slotO':
      return 'O';
    case 'standard4':
      return 'F1';
    case 'standard8':
      return 'B1';
  }
}

export function shiftAccentHex(kind: ShiftVisualKind): string {
  switch (kind) {
    case 'standard4':
      return '#2563EB';
    case 'standard8':
      return '#059669';
    case 'slotS':
      return '#D97706';
    case 'slotD':
      return '#7C3AED';
    case 'slotB':
      return '#EA580C';
    case 'slotO':
      return '#0891B2';
    case 'slotSStar':
      return '#DB2777';
    case 'slotBStar':
      return '#E11D48';
  }
}

/** slotLabel ile start/end tutarsızsa (eski yayın) doğru saatleri hesapla. */
export function normalizeShiftTimes<T extends {
  slotLabel?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationHours: ShiftDuration;
}>(entry: T): T {
  const slotPart = entry.slotLabel?.split(' ')[0];
  if (!slotPart) return entry;

  const info = slotFromToken(slotPart);
  if (!info) return entry;

  const base = slotPart.replace('*', '');
  if (base === 'F1' || base === 'B1') return entry;

  const times = resolveShiftTimes(slotPart, entry.durationHours);
  if (entry.startTime === times.start && entry.endTime === times.end) return entry;

  return {
    ...entry,
    startTime: times.start,
    endTime: times.end,
  };
}
