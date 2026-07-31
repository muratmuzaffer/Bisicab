import type { ParsedShiftRow, ShiftScheduleEntry } from './types';
import { normalizeName } from './utils';

function entryKey(
  driverName: string,
  shiftDate: string,
  startTime: string | null | undefined,
  durationHours: number
): string {
  return [
    normalizeName(driverName),
    shiftDate,
    startTime ?? '',
    String(durationHours),
  ].join('|');
}

export function dedupeParsedRows(rows: ParsedShiftRow[]): ParsedShiftRow[] {
  const seen = new Set<string>();
  const result: ParsedShiftRow[] = [];

  for (const row of rows) {
    const key = entryKey(row.driverName, row.shiftDate, row.startTime, row.durationHours);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

export function dedupeScheduleEntries(entries: ShiftScheduleEntry[]): ShiftScheduleEntry[] {
  const seen = new Set<string>();
  const result: ShiftScheduleEntry[] = [];

  for (const entry of entries) {
    const key = entryKey(entry.driverName, entry.shiftDate, entry.startTime, entry.durationHours);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }

  return result;
}
