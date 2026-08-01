import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NavLink {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
}

interface AppShellProps {
  title: ReactNode;
  subtitle?: string;
  nav?: NavLink[];
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: '3xl' | '5xl' | '6xl';
}

export function AppShell({
  title,
  subtitle,
  nav,
  actions,
  children,
  maxWidth = '6xl',
}: AppShellProps) {
  const widthClass = {
    '3xl': 'max-w-3xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
  }[maxWidth];

  return (
    <div className="min-h-screen bg-mesh">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-surface/95 backdrop-blur-xl">
        <div className={cn('mx-auto px-4 sm:px-6', widthClass)}>
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-white sm:text-xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 truncate text-xs text-white/50 sm:text-sm">{subtitle}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {nav?.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:text-sm',
                    item.active
                      ? 'bg-brand text-brand-dark shadow-glow'
                      : 'bg-white/8 text-white/80 hover:bg-white/14 hover:text-white'
                  )}
                >
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              ))}
              {actions}
            </div>
          </div>
        </div>
      </header>
      <main className={cn('mx-auto px-4 py-6 sm:px-6 sm:py-8', widthClass)}>{children}</main>
      <footer className="border-t border-border/40 py-8 text-center">
        <p className="text-xs text-muted-foreground">BisiCab · İZULAŞ Alsancak Limanı – Konak Saat Kulesi</p>
      </footer>
    </div>
  );
}
