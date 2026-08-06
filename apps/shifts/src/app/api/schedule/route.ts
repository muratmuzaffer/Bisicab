import { NextResponse } from 'next/server';
import { fetchScheduleWithSwaps } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '', 10);
  const month = parseInt(searchParams.get('month') ?? '', 10);

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month required' }, { status: 400 });
  }

  const data = await fetchScheduleWithSwaps(year, month);
  return NextResponse.json({ data });
}
