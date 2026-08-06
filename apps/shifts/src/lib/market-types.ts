import type { ShiftDuration } from './types';

export type MarketListingStatus = 'open' | 'sold' | 'cancelled';

export interface ShiftMarketOffer {
  id: string;
  listingId: string;
  bidderName: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface ShiftMarketListing {
  id: string;
  sellerName: string;
  shiftDate: string;
  slotLabel: string | null;
  startTime: string | null;
  endTime: string | null;
  durationHours: ShiftDuration;
  /** Taban fiyat — teklifler bunun altında olamaz. */
  minPrice: number;
  /** Satıcının IBAN’ı (ödeme için). */
  iban: string | null;
  note: string | null;
  status: MarketListingStatus;
  soldToName: string | null;
  soldPrice: number | null;
  createdAt: string;
  offers: ShiftMarketOffer[];
}

export interface CreateListingInput {
  sellerName: string;
  shiftDate: string;
  slotLabel?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationHours?: ShiftDuration;
  minPrice: number;
  iban?: string | null;
  note?: string | null;
}

/** Satıcının açık ilanı güncellemesi. */
export interface UpdateListingInput {
  actorName: string;
  shiftDate?: string;
  slotLabel?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationHours?: ShiftDuration;
  minPrice?: number;
  iban?: string | null;
  note?: string | null;
}

export interface CreateOfferInput {
  bidderName: string;
  amount: number;
  note?: string | null;
}
