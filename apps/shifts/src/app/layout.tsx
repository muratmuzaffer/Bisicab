import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BisiCab Vardiya',
  description: 'BisiCab sürücü aylık mesai çizelgesi — isminizi yazın, vardiyalarınızı görün',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
