import { NextResponse } from 'next/server';
import { createSwap, fetchSwaps } from '@/lib/swap-server';
import { normalizeCreateSwapInput } from '@/lib/swap-utils';
import type { CreateShiftSwapInput } from '@/lib/types';

export async function GET() {
  const swaps = await fetchSwaps(100);
  return NextResponse.json({ swaps });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateShiftSwapInput;

    if (!body.requesterName?.trim() || !body.partnerName?.trim()) {
      return NextResponse.json({ error: 'İsimler gerekli' }, { status: 400 });
    }
    if (body.requesterName.trim().toLowerCase() === body.partnerName.trim().toLowerCase()) {
      return NextResponse.json({ error: 'Kendinizle değişim yapamazsınız' }, { status: 400 });
    }

    const { requesterShifts, partnerShifts, oneWay } = normalizeCreateSwapInput(body);

    if (partnerShifts.length === 0) {
      return NextResponse.json({ error: 'En az bir alınacak vardiya seçin' }, { status: 400 });
    }
    if (!oneWay && requesterShifts.length === 0) {
      return NextResponse.json(
        { error: 'Vermek istediğiniz vardiyayı seçin veya karşılıksız alın' },
        { status: 400 }
      );
    }
    if (!body.oneWay && body.requesterShifts?.length) {
      const { fetchSchedule } = await import('@/lib/supabase-server');
      const { shiftDatesForDriver, validateGiveShifts } = await import('@/lib/swap-utils');
      const { namesMatch } = await import('@/lib/utils');
      const now = new Date();
      const schedule = await fetchSchedule(now.getFullYear(), now.getMonth() + 1);
      if (schedule) {
        const partnerDates = shiftDatesForDriver(schedule.entries, body.partnerName.trim());
        const giveEntries = schedule.entries.filter((e) =>
          body.requesterShifts!.some(
            (g) => g.date === e.shiftDate && namesMatch(e.driverName, body.requesterName)
          )
        );
        const takeEntries = schedule.entries.filter((e) =>
          partnerShifts.some(
            (t) => t.date === e.shiftDate && namesMatch(e.driverName, body.partnerName)
          )
        );
        const err = validateGiveShifts(giveEntries, takeEntries, partnerDates);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
    }

    const swap = await createSwap({
      ...body,
      requesterShifts,
      partnerShifts,
      oneWay,
    });
    return NextResponse.json({ swap });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vardiya değişimi kaydedilemedi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
