import type { ShiftMarketListing, ShiftMarketOffer } from './market-types';
import type { ShiftDuration, ShiftScheduleEntry } from './types';
import { DAY_NAMES_TR, MONTH_NAMES_TR, namesMatch } from './utils';

export const POSTIT_TONES = ['yellow', 'pink', 'blue', 'green', 'orange'] as const;
export type PostitTone = (typeof POSTIT_TONES)[number];

/** Form placeholder — gerçek hesap numarası değil. */
export const IBAN_PLACEHOLDER = 'TR00 0000 0000 0000 0000 0000 00';

export function normalizeIban(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, '').toUpperCase();
}

export function formatIbanDisplay(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, '$1 ').trim();
}

/** İlandaki satıcı IBAN’ı; yoksa boş. */
export function resolveListingIban(listing: { iban?: string | null }): string {
  return normalizeIban(listing.iban);
}

/** Post-it renkleri ve eğimleri ilan id'sinden türetilir; sunucu ve tarayıcı aynı sonucu üretir. */
export function postitToneFor(id: string): PostitTone {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return POSTIT_TONES[sum % POSTIT_TONES.length]!;
}

const TILT_STEPS = [-3.2, 2.1, -1.6, 3.4, -2.6, 1.3, 3.8, -0.9] as const;

export function postitTiltFor(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i) * (i + 1);
  return TILT_STEPS[sum % TILT_STEPS.length]!;
}

/** Post-it üzerinde satır kaydırmayı azaltan kısa tarih: "17 Ağustos · Pzt". */
export function formatDateCompactTr(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return `${date.getDate()} ${MONTH_NAMES_TR[date.getMonth()]} · ${DAY_NAMES_TR[date.getDay()]}`;
}

export function formatPrice(amount: number): string {
  return `${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)} ₺`;
}

export function shiftLabel(listing: {
  slotLabel: string | null;
  startTime: string | null;
  endTime: string | null;
  durationHours: ShiftDuration;
}): string {
  const slot = listing.slotLabel?.trim() || `${listing.durationHours}s`;
  const times =
    listing.startTime && listing.endTime
      ? `${listing.startTime.slice(0, 5)}–${listing.endTime.slice(0, 5)}`
      : '';
  return times ? `${slot} · ${times}` : slot;
}

export function shiftsForDriver(
  entries: ShiftScheduleEntry[],
  driverName: string
): ShiftScheduleEntry[] {
  if (!driverName.trim()) return [];
  return entries
    .filter((e) => namesMatch(e.driverName, driverName))
    .sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));
}

export function highestOffer(offers: ShiftMarketOffer[]): ShiftMarketOffer | null {
  if (offers.length === 0) return null;
  return offers.reduce((best, offer) => (offer.amount > best.amount ? offer : best));
}

/** En son teklif veren (kronolojik) — otomatik satışta kazanan. */
export function lastOffer(offers: ShiftMarketOffer[]): ShiftMarketOffer | null {
  if (offers.length === 0) return null;
  return [...offers].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function sortOffersByAmount(offers: ShiftMarketOffer[]): ShiftMarketOffer[] {
  return [...offers].sort(
    (a, b) => b.amount - a.amount || a.createdAt.localeCompare(b.createdAt)
  );
}

/** Avrupa/İstanbul takvim günü YYYY-MM-DD. */
export function todayIsoTurkey(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

type ListingSchedule = {
  shiftDate: string;
  startTime?: string | null;
};

/** İlanın kapanış anı: vardiya başlangıcı (saat yoksa günün 00:00’ı, TR). */
export function listingEndsAt(listing: ListingSchedule): Date {
  const time = (listing.startTime?.trim() || '00:00').slice(0, 5);
  const normalized = /^\d{2}:\d{2}$/.test(time) ? time : '00:00';
  // Türkiye yıl boyu UTC+3
  return new Date(`${listing.shiftDate}T${normalized}:00+03:00`);
}

/** Vardiya tarihi/saati geldiyse ilan pasifleşir. */
export function isListingExpired(listing: ListingSchedule, now = new Date()): boolean {
  return now.getTime() >= listingEndsAt(listing).getTime();
}

/** Post-it / detayda gösterilen kapanış metni. */
export function formatListingDeadline(listing: ListingSchedule): string {
  const time = (listing.startTime?.trim() || '').slice(0, 5);
  const datePart = formatDateCompactTr(listing.shiftDate);
  return time && /^\d{2}:\d{2}$/.test(time) ? `${datePart} · ${time}` : datePart;
}

export function marketSalesForMonth(
  listings: ShiftMarketListing[],
  year: number,
  month: number
): ShiftMarketListing[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return listings.filter(
    (listing) => listing.status === 'sold' && listing.shiftDate.startsWith(prefix) && listing.soldToName
  );
}

/** Satılan pazar ilanlarını çizelgeye uygular: vardiya alıcıya geçer. */
export function applyMarketSalesToEntries(
  entries: ShiftScheduleEntry[],
  listings: ShiftMarketListing[]
): ShiftScheduleEntry[] {
  const sold = [...listings]
    .filter((listing) => listing.status === 'sold' && listing.soldToName)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const result = entries.map((entry) => ({ ...entry }));

  for (const listing of sold) {
    const candidates = result
      .map((entry, index) => ({ entry, index }))
      .filter(
        ({ entry }) =>
          namesMatch(entry.driverName, listing.sellerName) && entry.shiftDate === listing.shiftDate
      );

    if (candidates.length === 0) continue;

    let pick = candidates[0]!;
    if (candidates.length > 1) {
      const byHours = candidates.find(
        ({ entry }) => entry.durationHours === listing.durationHours
      );
      if (byHours) pick = byHours;
      else if (listing.slotLabel) {
        const bySlot = candidates.find(({ entry }) => entry.slotLabel === listing.slotLabel);
        if (bySlot) pick = bySlot;
      }
    }

    result[pick.index] = {
      ...result[pick.index]!,
      driverName: listing.soldToName!,
    };
  }

  return result;
}

export function parsePriceInput(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

/** Teklif kurallarını doğrular; hata varsa Türkçe mesaj döner. */
export function validateOffer(
  listing: ShiftMarketListing,
  bidderName: string,
  amount: number
): string | null {
  if (!bidderName.trim()) return 'Teklif için adınızı seçin';
  if (listing.status !== 'open') return 'Bu ilan artık teklife açık değil';
  if (isListingExpired(listing)) {
    return 'İlan süresi doldu — vardiya saati geçti';
  }
  if (namesMatch(listing.sellerName, bidderName)) {
    return 'Kendi ilanınıza teklif veremezsiniz';
  }
  if (!Number.isFinite(amount) || amount <= 0) return 'Geçerli bir tutar girin';
  if (amount < listing.minPrice) {
    return `Teklif taban fiyatın altında olamaz: en az ${formatPrice(listing.minPrice)}`;
  }
  return null;
}

export function validateListingInput(input: {
  sellerName: string;
  shiftDate: string;
  minPrice: number | null;
  startTime?: string | null;
  iban?: string | null;
}): string | null {
  if (!input.sellerName.trim()) return 'İlan için adınızı seçin';
  if (!input.shiftDate) return 'Vardiya tarihi seçin';
  if (isListingExpired({ shiftDate: input.shiftDate, startTime: input.startTime })) {
    return 'Vardiya saati geçmiş ilan açılamaz';
  }
  if (input.minPrice === null || !Number.isFinite(input.minPrice)) {
    return 'Taban fiyat girin';
  }
  if (input.minPrice <= 0) return 'Taban fiyat sıfırdan büyük olmalı';
  const iban = normalizeIban(input.iban);
  if (!iban) return 'IBAN girin';
  if (!/^TR\d{24}$/.test(iban)) {
    return 'Geçerli bir TR IBAN girin (TR + 24 rakam)';
  }
  return null;
}
