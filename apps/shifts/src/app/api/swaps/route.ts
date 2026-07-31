import { NextResponse } from 'next/server';
import { createSwap, fetchSwaps } from '@/lib/swap-server';
import type { CreateShiftSwapInput } from '@/lib/types';

export async function GET() {
  const swaps = await fetchSwaps(100);
  return NextResponse.json({ swaps });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateShiftSwapInput;

  if (!body.requesterName?.trim() || !body.partnerName?.trim()) {
    return NextResponse.json({ error: 'İsimler gerekli' }, { status: 400 });
  }
  if (!body.requesterDate || !body.partnerDate) {
    return NextResponse.json({ error: 'Tarihler gerekli' }, { status: 400 });
  }
  if (body.requesterName.trim().toLowerCase() === body.partnerName.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Kendinizle değişim yapamazsınız' }, { status: 400 });
  }

  const swap = await createSwap(body);
  return NextResponse.json({ swap });
}
