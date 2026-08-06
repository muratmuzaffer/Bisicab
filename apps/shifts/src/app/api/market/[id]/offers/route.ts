import { NextResponse } from 'next/server';
import { createOffer } from '@/lib/market-server';
import type { CreateOfferInput } from '@/lib/market-types';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as CreateOfferInput;

    if (!body.bidderName?.trim()) {
      return NextResponse.json({ error: 'Teklif için adınızı seçin' }, { status: 400 });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Geçerli bir tutar girin' }, { status: 400 });
    }

    const listing = await createOffer(params.id, {
      bidderName: body.bidderName,
      amount,
      note: body.note ?? null,
    });

    return NextResponse.json({ listing });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Teklif kaydedilemedi';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
