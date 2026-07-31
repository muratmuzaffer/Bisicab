import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE_NAME } from '@/lib/admin-auth';

export async function POST(request: Request) {
  const { password } = await request.json();
  const expected = process.env.SHIFTS_ADMIN_PASSWORD ?? 'bisicab2026';

  if (password !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  cookies().set(ADMIN_COOKIE_NAME, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
  });

  return NextResponse.json({ ok: true });
}
