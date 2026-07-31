import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MONTH_NAMES_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

export const DAY_NAMES_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] as const;
export const DAY_NAMES_FULL_TR = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
] as const;

export function formatMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES_TR[month - 1]} ${year}`;
}

export function formatDateTr(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  const day = d.getDate();
  const month = MONTH_NAMES_TR[d.getMonth()];
  const weekday = DAY_NAMES_FULL_TR[d.getDay()];
  return `${day} ${month}, ${weekday}`;
}

export function formatTime(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

export function normalizeName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

export function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isToday(isoDate: string): boolean {
  const today = new Date();
  const d = new Date(isoDate + 'T12:00:00');
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export function durationLabel(hours: 4 | 8): string {
  return hours === 4 ? '4s' : '8s';
}

export function durationDescription(hours: 4 | 8): string {
  return hours === 4 ? '4 saatlik vardiya' : '8 saatlik vardiya';
}
