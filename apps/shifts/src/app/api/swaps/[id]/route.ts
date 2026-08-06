import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/admin-auth';
import { approveSwapCancel, deleteSwap, rejectSwapCancel } from '@/lib/swap-server';

/** Yalnızca admin — değişimi kalıcı siler (iptal onayı). */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  try {
    await deleteSwap(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Değişim iptal edilemedi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
