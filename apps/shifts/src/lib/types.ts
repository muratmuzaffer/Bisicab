export type ShiftDuration = 4 | 8;

export interface ShiftScheduleMonth {
  id: string;
  year: number;
  month: number;
  title: string | null;
  pdfUrl: string | null;
  pdfFilename: string | null;
  published: boolean;
}

export interface ShiftScheduleEntry {
  id: string;
  scheduleMonthId: string;
  driverName: string;
  shiftDate: string;
  startTime: string | null;
  endTime: string | null;
  durationHours: ShiftDuration;
  slotLabel: string | null;
  notes: string | null;
}

export interface ScheduleData {
  month: ShiftScheduleMonth;
  entries: ShiftScheduleEntry[];
}

export type ViewMode = 'calendar' | 'list' | 'pdf';

export interface ParsedShiftRow {
  driverName: string;
  shiftDate: string;
  startTime?: string;
  endTime?: string;
  durationHours: ShiftDuration;
  slotLabel?: string;
}

export interface ShiftSwap {
  id: string;
  requesterName: string;
  partnerName: string;
  requesterDate: string;
  partnerDate: string;
  requesterSlot: string | null;
  partnerSlot: string | null;
  note: string | null;
  createdAt: string;
}

export interface CreateShiftSwapInput {
  requesterName: string;
  partnerName: string;
  requesterDate: string;
  partnerDate: string;
  requesterSlot?: string;
  partnerSlot?: string;
  note?: string;
}

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
  note?: string | null;
}

export interface CreateOfferInput {
  bidderName: string;
  amount: number;
  note?: string | null;
}
