import { MarketClient } from '@/components/market-client';
import { fetchListings } from '@/lib/market-server';
import * as scheduleServer from '@/lib/supabase-server';
import type { ScheduleData } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Değişimleri çizelgeye uygulayan sürüm varsa onu kullan; böylece pazarda
 * takas sonrası vardiyanın gerçek sahibi görünür.
 */
function loadSchedule(year: number, month: number): Promise<ScheduleData | null> {
  const server = scheduleServer as typeof scheduleServer & {
    fetchScheduleWithSwaps?: (year: number, month: number) => Promise<ScheduleData | null>;
  };
  return (server.fetchScheduleWithSwaps ?? server.fetchSchedule)(year, month);
}

export default async function MarketPage() {
  const availableMonths = await scheduleServer.fetchAvailableMonths();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const hasCurrent = availableMonths.some(
    (m) => m.year === currentYear && m.month === currentMonth
  );

  const year = hasCurrent ? currentYear : availableMonths[0]?.year ?? currentYear;
  const month = hasCurrent ? currentMonth : availableMonths[0]?.month ?? currentMonth;

  const [listings, schedule] = await Promise.all([fetchListings(100), loadSchedule(year, month)]);

  const entries = schedule?.entries ?? [];
  const driverNames = Array.from(new Set(entries.map((entry) => entry.driverName))).sort((a, b) =>
    a.localeCompare(b, 'tr')
  );

  return (
    <MarketClient
      initialListings={listings}
      driverNames={driverNames}
      entries={entries}
      year={year}
      month={month}
    />
  );
}
