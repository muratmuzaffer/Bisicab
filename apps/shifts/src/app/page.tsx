import { ScheduleClient } from '@/components/schedule-client';
import { fetchAvailableMonths, fetchSchedule } from '@/lib/supabase-server';

export default async function HomePage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const availableMonths = await fetchAvailableMonths();

  let year: number;
  let month: number;

  if (searchParams.y && searchParams.m) {
    year = parseInt(searchParams.y, 10);
    month = parseInt(searchParams.m, 10);
  } else {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const hasCurrent = availableMonths.some(
      (m) => m.year === currentYear && m.month === currentMonth
    );

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
  }

  const data = await fetchSchedule(year, month);

  return (
    <ScheduleClient
      initialData={data}
      availableMonths={availableMonths}
      initialYear={year}
      initialMonth={month}
    />
  );
}
