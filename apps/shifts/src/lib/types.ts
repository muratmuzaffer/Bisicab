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

export interface SwapShiftItem {
  date: string;
  slot: string;
  hours: 4 | 8;
}

export type ShiftSwapSource = 'swap' | 'market';

export interface ShiftSwap {
  id: string;
  requesterName: string;
  partnerName: string;
  /** @deprecated İlk verilen vardiya — geriye uyumluluk */
  requesterDate: string | null;
  /** @deprecated İlk alınan vardiya — geriye uyumluluk */
  partnerDate: string;
  requesterSlot: string | null;
  partnerSlot: string | null;
  requesterShifts: SwapShiftItem[];
  partnerShifts: SwapShiftItem[];
  note: string | null;
  createdAt: string;
  cancelRequestedAt: string | null;
  cancelRequestedBy: string | null;
  /** swap = manuel değişim; market = vardiya pazarı satışı */
  source: ShiftSwapSource;
  marketListingId: string | null;
  soldPrice: number | null;
}

export type MarketListingStatus = 'open' | 'closed';

export interface MarketBid {
  id: string;
  listingId: string;
  bidderName: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface MarketListing {
  id: string;
  sellerName: string;
  shiftDate: string;
  slot: string;
  hours: ShiftDuration;
  /** Asgari fiyat — teklifler bunun altında olamaz */
  minPrice: number;
  note: string | null;
  status: MarketListingStatus;
  createdAt: string;
  bids: MarketBid[];
}

export interface CreateMarketListingInput {
  sellerName: string;
  shiftDate: string;
  slot: string;
  hours: ShiftDuration;
  minPrice: number;
  note?: string;
}

export interface CreateMarketBidInput {
  bidderName: string;
  amount: number;
  note?: string;
}

export interface CreateShiftSwapInput {
  requesterName: string;
  partnerName: string;
  requesterShifts?: SwapShiftItem[];
  partnerShifts?: SwapShiftItem[];
  /** @deprecated Tek vardiya API — requesterShifts kullanın */
  requesterDate?: string | null;
  partnerDate?: string;
  requesterSlot?: string;
  partnerSlot?: string;
  note?: string;
  oneWay?: boolean;
  source?: ShiftSwapSource;
  marketListingId?: string | null;
  soldPrice?: number | null;
}
