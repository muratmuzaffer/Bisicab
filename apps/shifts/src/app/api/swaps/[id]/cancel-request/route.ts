import { NextResponse } from 'next/server';
import { requestSwapCancel } from '@/lib/swap-server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await request.json()) as { requestedBy?: string };
    const swap = await requestSwapCancel(params.id, body.requestedBy?.trim());
    return NextResponse.json({ swap });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'İptal talebi gönderilemedi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
