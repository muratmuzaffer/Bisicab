import type { Metadata } from 'next';
import Link from 'next/link';
import { LayoutDashboard, MapPin, ListChecks } from 'lucide-react';
import './globals.css';

export const metadata: Metadata = {
  title: 'BisiCab Yönetim Paneli',
  description: 'İZULAŞ BisiCab sürücü ve sürüş yönetimi',
};

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/live', label: 'Canlı Takip', icon: MapPin },
  { href: '/trips', label: 'Sürüş Denetimi', icon: ListChecks },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <div className="flex min-h-screen">
          <aside className="w-60 shrink-0 border-r border-border bg-white">
            <div className="p-6">
              <span className="text-2xl font-extrabold text-brand-dark">
                BisiCab
              </span>
              <p className="text-xs text-muted-foreground">Yönetim Paneli</p>
            </div>
            <nav className="px-3">
              {nav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
