import type { ShiftMarketListing } from './market-types';
import type {
  CreateShiftSwapInput,
  ShiftScheduleEntry,
  ShiftSwap,
  SwapShiftItem,
} from './types';
import { namesMatch } from './utils';

export function isMarketSwap(swap: Pick<ShiftSwap, 'source' | 'marketListingId' | 'note'>): boolean {
  return (
    swap.source === 'market' ||
    Boolean(swap.marketListingId) ||
    Boolean(swap.note?.startsWith('Pazar ·'))
  );
}

export function marketSaleNote(price: number | null | undefined, listingId: string): string {
  const pricePart =
    price != null && Number.isFinite(price)
      ? `${new Intl.NumberFormat('tr-TR', {
          maximumFractionDigits: 2,
        }).format(price)} ₺`
      : 'satış';
  return `Pazar · ${pricePart} · #${listingId}`;
}

export function parseMarketListingIdFromNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const match = note.match(/#([0-9a-f-]{36})\s*$/i);
  return match?.[1] ?? null;
}

/** Pazar satışını değişim geçmişine yazmak için girdi (alıcı ← satıcı). */
export function marketListingToSwapInput(listing: ShiftMarketListing): CreateShiftSwapInput | null {
  if (listing.status !== 'sold' || !listing.soldToName?.trim()) return null;
  const hours = listing.durationHours === 4 ? 4 : 8;
  const slot =
    listing.slotLabel?.trim() ||
    [listing.startTime?.slice(0, 5), listing.endTime?.slice(0, 5)].filter(Boolean).join('–') ||
    `${hours}s`;

  return {
    requesterName: listing.soldToName.trim(),
    partnerName: listing.sellerName.trim(),
    requesterShifts: [],
    partnerShifts: [{ date: listing.shiftDate, slot, hours }],
    oneWay: true,
    source: 'market',
    marketListingId: listing.id,
    soldPrice: listing.soldPrice,
    note: marketSaleNote(listing.soldPrice, listing.id),
  };
}

export function shiftsForDriver(
  entries: ShiftScheduleEntry[],
  driverName: string
): ShiftScheduleEntry[] {
  return entries
    .filter((e) => namesMatch(e.driverName, driverName))
    .sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));
}

export function shiftDatesForDriver(
  entries: ShiftScheduleEntry[],
  driverName: string
): Set<string> {
  return new Set(shiftsForDriver(entries, driverName).map((e) => e.shiftDate));
}

/** Partner vardiyası, benim o gün vardiyam yoksa çakışmaz. */
export function filterPartnerShiftsNonConflicting(
  partnerShifts: ShiftScheduleEntry[],
  requesterDates: Set<string>,
  enabled: boolean
): ShiftScheduleEntry[] {
  if (!enabled) return partnerShifts;
  return partnerShifts.filter((s) => !requesterDates.has(s.shiftDate));
}

/** Partner o gün başka vardiyada; seçili alınan vardiya o günse aynı gün takas mümkün. */
export function canGiveShiftOnDate(
  date: string,
  partnerDates: Set<string>,
  selectedPartnerShifts: ShiftScheduleEntry[]
): { ok: boolean; reason?: 'free' | 'same_day_swap' | 'partner_busy' } {
  if (!partnerDates.has(date)) return { ok: true, reason: 'free' };
  if (selectedPartnerShifts.some((s) => s.shiftDate === date)) {
    return { ok: true, reason: 'same_day_swap' };
  }
  return { ok: false, reason: 'partner_busy' };
}

export function validateGiveShifts(
  giveShifts: ShiftScheduleEntry[],
  takeShifts: ShiftScheduleEntry[],
  partnerDates: Set<string>
): string | null {
  for (const g of giveShifts) {
    const check = canGiveShiftOnDate(g.shiftDate, partnerDates, takeShifts);
    if (!check.ok) {
      return `Partnerin ${g.shiftDate.split('-').reverse().join('.')} tarihinde zaten vardiyası var. O gün için partnerin vardiyasını da “alınan” listesine ekleyin (aynı gün takas) veya başka bir gün seçin.`;
    }
  }
  return null;
}

/** @deprecated Tüm vardiyalar gösteriliyor; canGiveShiftOnDate kullanın */
export function filterRequesterShiftsGiveable(
  requesterShifts: ShiftScheduleEntry[],
  partnerDates: Set<string>
): ShiftScheduleEntry[] {
  return requesterShifts.filter((s) => !partnerDates.has(s.shiftDate));
}

export function shiftSummary(entry: ShiftScheduleEntry): string {
  const slot = entry.slotLabel ?? `${entry.durationHours}s`;
  const times =
    entry.startTime && entry.endTime
      ? `${entry.startTime.slice(0, 5)}–${entry.endTime.slice(0, 5)}`
      : '';
  return times ? `${slot} · ${times}` : slot;
}

export function entryToSwapItem(entry: ShiftScheduleEntry): SwapShiftItem {
  return {
    date: entry.shiftDate,
    slot: shiftSummary(entry),
    hours: entry.durationHours,
  };
}

export function totalSwapHours(items: SwapShiftItem[]): number {
  return items.reduce((sum, item) => sum + item.hours, 0);
}

export function formatHoursTotal(hours: number): string {
  return `${hours}s`;
}

export function normalizeCreateSwapInput(input: CreateShiftSwapInput): {
  requesterShifts: SwapShiftItem[];
  partnerShifts: SwapShiftItem[];
  oneWay: boolean;
} {
  const partnerShifts =
    input.partnerShifts ??
    (input.partnerDate
      ? [{ date: input.partnerDate, slot: input.partnerSlot ?? '', hours: 4 as const }]
      : []);

  const oneWay = Boolean(input.oneWay);
  const requesterShifts =
    input.requesterShifts ??
    (input.requesterDate
      ? [{ date: input.requesterDate, slot: input.requesterSlot ?? '', hours: 8 as const }]
      : []);

  return { requesterShifts: oneWay ? [] : requesterShifts, partnerShifts, oneWay };
}

export function parseSwapShiftsJson(value: unknown): SwapShiftItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is SwapShiftItem => {
      if (!item || typeof item !== 'object') return false;
      const row = item as SwapShiftItem;
      return Boolean(row.date && row.slot && (row.hours === 4 || row.hours === 8));
    })
    .map((item) => ({
      date: item.date,
      slot: item.slot,
      hours: item.hours,
    }));
}

function findEntryIndexForSwapItem(
  entries: ShiftScheduleEntry[],
  driverName: string,
  item: SwapShiftItem
): number {
  const candidates = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => namesMatch(entry.driverName, driverName) && entry.shiftDate === item.date);

  if (candidates.length === 0) return -1;
  if (candidates.length === 1) return candidates[0]!.index;

  const byHours = candidates.find(({ entry }) => entry.durationHours === item.hours);
  if (byHours) return byHours.index;

  const slotToken = item.slot.split(/[\s·]/)[0]?.trim();
  if (slotToken) {
    const bySlot = candidates.find(({ entry }) => entry.slotLabel === slotToken);
    if (bySlot) return bySlot.index;
  }

  return candidates[0]!.index;
}

/** Kayıtlı değişimleri çizelgeye uygular (orijinal PDF verisi değişmez). */
export function applySwapsToEntries(
  entries: ShiftScheduleEntry[],
  swaps: ShiftSwap[]
): ShiftScheduleEntry[] {
  const ordered = [...swaps].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const result = entries.map((entry) => ({ ...entry }));

  for (const swap of ordered) {
    // Pazar satışları çizelgede applyMarketSalesToEntries ile uygulanır — çift uygulama olmasın.
    if (isMarketSwap(swap)) continue;

    for (const item of swap.requesterShifts) {
      const index = findEntryIndexForSwapItem(result, swap.requesterName, item);
      if (index >= 0) {
        result[index] = { ...result[index]!, driverName: swap.partnerName };
      }
    }
    for (const item of swap.partnerShifts) {
      const index = findEntryIndexForSwapItem(result, swap.partnerName, item);
      if (index >= 0) {
        result[index] = { ...result[index]!, driverName: swap.requesterName };
      }
    }
  }

  return result;
}

export function swapsForMonth(swaps: ShiftSwap[], year: number, month: number): ShiftSwap[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return swaps.filter((swap) =>
    [...swap.requesterShifts, ...swap.partnerShifts].some((item) => item.date.startsWith(prefix))
  );
}
