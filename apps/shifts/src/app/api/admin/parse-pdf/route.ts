import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { detectMonthYearFromText, parseShiftText } from '@/lib/schedule-data';
import { isAdminAuthed } from '@/lib/admin-auth';
import { parseBisiCabPdfWithPositions } from '@/lib/pdf-grid-parser';
import { dedupeParsedRows } from '@/lib/dedupe';

function isBisiCabVardiyaPdf(text: string): boolean {
  return /BisiCab\s*(Personel\s*)?Vardiya/i.test(text);
}

export async function POST(request: Request) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const formYear = parseInt(String(form.get('year')), 10);
  const formMonth = parseInt(String(form.get('month')), 10);

  if (!file) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdf(buffer);
    const detected = detectMonthYearFromText(parsed.text);
    const year = detected?.year ?? formYear ?? new Date().getFullYear();
    const month = detected?.month ?? formMonth ?? new Date().getMonth() + 1;

    const rawRows = isBisiCabVardiyaPdf(parsed.text)
      ? await parseBisiCabPdfWithPositions(buffer, year, month)
      : parseShiftText(parsed.text, year, month);
    const rows = dedupeParsedRows(rawRows);

    return NextResponse.json({
      rows,
      year,
      month,
      detectedFromPdf: Boolean(detected),
      driverCount: new Set(rows.map((r) => r.driverName)).size,
      removedDuplicates: rawRows.length - rows.length,
      parser: isBisiCabVardiyaPdf(parsed.text) ? 'grid' : 'text',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF parse failed' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
