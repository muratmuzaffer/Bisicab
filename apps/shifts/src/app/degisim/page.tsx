import { SwapClient } from '@/components/swap-client';
import { fetchDriverNamesForMonth, fetchSwaps } from '@/lib/swap-server';
import { fetchAvailableMonths } from '@/lib/supabase-server';

export default async function SwapPage() {
  const available = await fetchAvailableMonths();
  const now = new Date();
  const year = available[0]?.year ?? now.getFullYear();
  const month = available[0]?.month ?? now.getMonth() + 1;

  const [swaps, driverNames] = await Promise.all([
    fetchSwaps(100),
    fetchDriverNamesForMonth(year, month),
  ]);

  return (
    <SwapClient
      driverNames={driverNames}
      initialSwaps={swaps}
      year={year}
      month={month}
    />
  );
}
