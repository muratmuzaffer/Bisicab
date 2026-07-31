import { NextResponse } from 'next/server';
import { parseCsv } from '@/lib/schedule-data';
import { isAdminAuthed } from '@/lib/admin-auth';

export async function POST(request: Request) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { csv } = await request.json();
  if (!csv) {
    return NextResponse.json({ error: 'csv required' }, { status: 400 });
  }

  const rows = parseCsv(csv);
  return NextResponse.json({ rows });
}
