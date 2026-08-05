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
