import { NextResponse } from 'next/server';
import { logDriverVisit } from '@/lib/visit-server';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { driverName?: string };
    if (!body.driverName?.trim()) {
      return NextResponse.json({ error: 'İsim gerekli' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent');
    const visit = await logDriverVisit(body.driverName, userAgent);
    return NextResponse.json({ visit });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Giriş kaydedilemedi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
