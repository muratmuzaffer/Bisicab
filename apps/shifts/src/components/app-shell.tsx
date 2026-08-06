'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import { APP_NAV_ITEMS, isNavActive } from '@/components/app-nav';
import { useOptionalDriverIdentity } from '@/components/driver-identity';
import { cn } from '@/lib/utils';

interface AppShellProps {
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: '3xl' | '5xl' | '6xl';
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  maxWidth = '6xl',
}: AppShellProps) {
  const pathname = usePathname();
  const identity = useOptionalDriverIdentity();
  const widthClass = {
    '3xl': 'max-w-3xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
  }[maxWidth];

  return (
    <div className="flex min-h-screen flex-col bg-mesh pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-surface/95 backdrop-blur-xl">
        <div className={cn('mx-auto px-4 sm:px-6', widthClass)}>
          <div className="py-3 sm:py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-xl">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-0.5 truncate text-[11px] text-white/55 sm:text-sm">{subtitle}</p>
                )}
                {identity?.name && (
                  <button
                    type="button"
                    onClick={identity.reopenWelcome}
                    className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-brand transition hover:bg-white/15"
                    title="İsmi değiştir"
                  >
                    <UserRound className="h-3 w-3 shrink-0" />
                    <span className="truncate">{identity.name}</span>
                    <span className="text-white/45">· değiştir</span>
                  </button>
                )}
              </div>

              <nav
                className="hidden shrink-0 items-center gap-1.5 md:flex"
                aria-label="Ana menü"
              >
                {APP_NAV_ITEMS.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
                        active
                          ? 'bg-brand text-brand-dark shadow-glow'
                          : 'text-white/75 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {actions && (
              <div className="mt-3 flex justify-center sm:mt-4 md:justify-end">{actions}</div>
            )}
          </div>
        </div>
      </header>

      <main className={cn('mx-auto w-full flex-1 px-4 py-5 sm:px-6 sm:py-8', widthClass)}>
        {children}
      </main>

      <footer className="hidden border-t border-border/40 py-6 text-center md:block">
        <p className="text-xs text-muted-foreground">
          BisiCab · İZULAŞ Alsancak Limanı – Konak Saat Kulesi
        </p>
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_32px_rgba(10,15,12,0.08)] backdrop-blur-md md:hidden"
        aria-label="Mobil menü"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1.5 px-3 py-2">
          {APP_NAV_ITEMS.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition active:scale-[0.97]',
                  active
                    ? 'bg-brand text-brand-dark shadow-glow'
                    : 'text-muted-foreground hover:bg-canvas active:bg-muted'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
                <span
                  className={cn(
                    'max-w-full truncate text-[10px] font-bold leading-tight sm:text-[11px]',
                    active ? 'text-brand-dark' : 'text-muted-foreground'
                  )}
                >
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
