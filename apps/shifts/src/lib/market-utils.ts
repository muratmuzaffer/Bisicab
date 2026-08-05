import type {
  ShiftDuration,
  ShiftMarketListing,
  ShiftMarketOffer,
  ShiftScheduleEntry,
} from './types';
import { namesMatch } from './utils';

export const POSTIT_TONES = ['yellow', 'pink', 'blue', 'green', 'orange'] as const;
export type PostitTone = (typeof POSTIT_TONES)[number];

/** Post-it renkleri ve eğimleri ilan id'sinden türetilir; sunucu ve tarayıcı aynı sonucu üretir. */
export function postitToneFor(id: string): PostitTone {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return POSTIT_TONES[sum % POSTIT_TONES.length]!;
}

const TILT_STEPS = [-2.4, 1.6, -1.1, 2.2, -1.9, 0.9, 2.6, -0.6] as const;

export function postitTiltFor(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i) * (i + 1);
  return TILT_STEPS[sum % TILT_STEPS.length]!;
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

export function sortOffersByAmount(offers: ShiftMarketOffer[]): ShiftMarketOffer[] {
  return [...offers].sort(
    (a, b) => b.amount - a.amount || a.createdAt.localeCompare(b.createdAt)
  );
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
}): string | null {
  if (!input.sellerName.trim()) return 'İlan için adınızı seçin';
  if (!input.shiftDate) return 'Vardiya tarihi seçin';
  if (input.minPrice === null || !Number.isFinite(input.minPrice)) {
    return 'Taban fiyat girin';
  }
  if (input.minPrice <= 0) return 'Taban fiyat sıfırdan büyük olmalı';
  return null;
}
