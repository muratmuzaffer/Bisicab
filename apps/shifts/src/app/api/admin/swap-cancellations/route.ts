import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-auth';
import {
  approveSwapCancel,
  fetchPendingCancelRequests,
  rejectSwapCancel,
} from '@/lib/swap-server';

export async function GET() {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const requests = await fetchPendingCancelRequests(50);
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: string; action?: 'approve' | 'reject' };
    if (!body.id?.trim()) {
      return NextResponse.json({ error: 'Kayıt id gerekli' }, { status: 400 });
    }

    if (body.action === 'approve') {
      await approveSwapCancel(body.id);
      return NextResponse.json({ ok: true, approved: true });
    }

    if (body.action === 'reject') {
      const swap = await rejectSwapCancel(body.id);
      return NextResponse.json({ ok: true, swap });
    }

    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'İşlem başarısız';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
