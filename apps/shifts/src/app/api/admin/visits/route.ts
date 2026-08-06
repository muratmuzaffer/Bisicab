import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-auth';
import { fetchDriverVisits } from '@/lib/visit-server';

export async function GET() {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  try {
    const visits = await fetchDriverVisits(150);
    return NextResponse.json({ visits });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Girişler yüklenemedi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
