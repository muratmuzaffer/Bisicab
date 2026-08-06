import { NextResponse } from 'next/server';
import { acceptOffer, cancelListing, updateListingDetails } from '@/lib/market-server';
import type { UpdateListingInput } from '@/lib/market-types';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as { offerId?: string; actorName?: string };

    if (!body.offerId?.trim() || !body.actorName?.trim()) {
      return NextResponse.json({ error: 'Teklif ve ilan sahibi gerekli' }, { status: 400 });
    }

    const listing = await acceptOffer(params.id, body.offerId, body.actorName);
    return NextResponse.json({ listing });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Teklif kabul edilemedi';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as UpdateListingInput;

    if (!body.actorName?.trim()) {
      return NextResponse.json({ error: 'İlan sahibinin adı gerekli' }, { status: 400 });
    }

    const listing = await updateListingDetails(params.id, body);
    return NextResponse.json({ listing });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'İlan güncellenemedi';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const actorName = searchParams.get('actorName');

    if (!actorName?.trim()) {
      return NextResponse.json({ error: 'İlan sahibinin adı gerekli' }, { status: 400 });
    }

    await cancelListing(params.id, actorName);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'İlan kaldırılamadı';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
