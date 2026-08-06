import { NextResponse } from 'next/server';
import { fetchAllDriverNames, fetchAvailableMonths } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const available = await fetchAvailableMonths();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const hasCurrent = available.some((m) => m.year === currentYear && m.month === currentMonth);
  const year = hasCurrent ? currentYear : available[0]?.year ?? currentYear;
  const month = hasCurrent ? currentMonth : available[0]?.month ?? currentMonth;

  const names = await fetchAllDriverNames(year, month);
  return NextResponse.json({ names, year, month });
}
