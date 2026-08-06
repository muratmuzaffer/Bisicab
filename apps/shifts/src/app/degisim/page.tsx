import { SwapClient } from '@/components/swap-client';
import { fetchDriverNamesForMonth, fetchSwaps } from '@/lib/swap-server';
import { fetchAvailableMonths, fetchScheduleWithSwaps } from '@/lib/supabase-server';

export default async function SwapPage() {
  const available = await fetchAvailableMonths();
  const now = new Date();
  const year = available[0]?.year ?? now.getFullYear();
  const month = available[0]?.month ?? now.getMonth() + 1;

  const [swaps, schedule] = await Promise.all([
    fetchSwaps(100),
    fetchScheduleWithSwaps(year, month),
  ]);
  const driverNames = schedule
    ? Array.from(new Set(schedule.entries.map((e) => e.driverName))).sort((a, b) =>
        a.localeCompare(b, 'tr')
      )
    : await fetchDriverNamesForMonth(year, month);

  return (
    <SwapClient
      driverNames={driverNames}
      entries={schedule?.entries ?? []}
      initialSwaps={swaps}
      year={year}
      month={month}
    />
  );
}
