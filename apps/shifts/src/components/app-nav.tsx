'use client';

import {
  ArrowLeftRight,
  CalendarDays,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface AppNavItem {
  href: string;
  label: string;
  /** Mobil alt menüde kısa etiket */
  shortLabel?: string;
  icon: LucideIcon;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: '/', label: 'Çizelge', shortLabel: 'Çizelge', icon: CalendarDays },
  { href: '/ortak', label: 'Ortak mesai', shortLabel: 'Ortak', icon: Users },
  { href: '/degisim', label: 'Değişim', shortLabel: 'Değişim', icon: ArrowLeftRight },
  { href: '/pazar', label: 'Pazar', shortLabel: 'Pazar', icon: Store },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
