import { NextResponse } from 'next/server';
import { createListing, fetchListings } from '@/lib/market-server';
import { normalizeIban, validateListingInput } from '@/lib/market-utils';
import type { CreateListingInput } from '@/lib/market-types';

export async function GET() {
  const listings = await fetchListings(100);
  return NextResponse.json({ listings });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateListingInput;

    const minPrice = Number(body.minPrice);
    const iban = normalizeIban(body.iban);
    const validationError = validateListingInput({
      sellerName: body.sellerName ?? '',
      shiftDate: body.shiftDate ?? '',
      startTime: body.startTime ?? null,
      minPrice: Number.isFinite(minPrice) ? minPrice : null,
      iban,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const listing = await createListing({
      sellerName: body.sellerName,
      shiftDate: body.shiftDate,
      slotLabel: body.slotLabel ?? null,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      durationHours: body.durationHours === 4 ? 4 : 8,
      minPrice,
      iban,
      note: body.note ?? null,
    });

    return NextResponse.json({ listing });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'İlan kaydedilemedi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
