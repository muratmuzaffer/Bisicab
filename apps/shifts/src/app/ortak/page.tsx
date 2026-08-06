import { OverlapClient } from '@/components/overlap-client';
import { fetchAvailableMonths, fetchScheduleWithSwaps } from '@/lib/supabase-server';

export default async function OverlapPage() {
  const availableMonths = await fetchAvailableMonths();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const hasCurrent = availableMonths.some(
    (m) => m.year === currentYear && m.month === currentMonth
  );

  let year: number;
  let month: number;

  if (hasCurrent) {
    year = currentYear;
    month = currentMonth;
  } else if (availableMonths.length > 0) {
    year = availableMonths[0]!.year;
    month = availableMonths[0]!.month;
  } else {
    year = currentYear;
    month = currentMonth;
  }

  const data = await fetchScheduleWithSwaps(year, month);
  const driverNames = data
    ? Array.from(new Set(data.entries.map((e) => e.driverName))).sort((a, b) =>
        a.localeCompare(b, 'tr')
      )
    : [];

  return (
    <OverlapClient
      initialData={data}
      driverNames={driverNames}
      initialYear={year}
      initialMonth={month}
    />
  );
}
