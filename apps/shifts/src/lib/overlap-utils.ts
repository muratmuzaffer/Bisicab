import type { ShiftScheduleEntry } from './types';
import { shiftsForDriver } from './swap-utils';

export interface CommonShiftDay {
  date: string;
  byDriver: Array<{ driverName: string; shifts: ShiftScheduleEntry[] }>;
}

/** Seçilen sürücülerin hepsinin vardiyalı olduğu günleri döndürür. */
export function findCommonShiftDays(
  entries: ShiftScheduleEntry[],
  driverNames: string[]
): CommonShiftDay[] {
  const names = driverNames.map((n) => n.trim()).filter(Boolean);
  if (names.length < 2) return [];

  const shiftsByDriver = names.map((name) => ({
    driverName: name,
    shifts: shiftsForDriver(entries, name),
  }));

  const dateSets = shiftsByDriver.map((d) => new Set(d.shifts.map((s) => s.shiftDate)));
  const firstDates = [...dateSets[0]!];
  const commonDates = firstDates
    .filter((date) => dateSets.every((set) => set.has(date)))
    .sort((a, b) => a.localeCompare(b));

  return commonDates.map((date) => ({
    date,
    byDriver: shiftsByDriver.map(({ driverName, shifts }) => ({
      driverName,
      shifts: shifts.filter((s) => s.shiftDate === date),
    })),
  }));
}
