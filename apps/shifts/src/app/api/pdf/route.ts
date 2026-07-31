import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { getLocalPdfPath } from '@/lib/local-schedule-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '', 10);
  const month = parseInt(searchParams.get('month') ?? '', 10);

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month required' }, { status: 400 });
  }

  const pdfPath = await getLocalPdfPath(year, month);
  if (!pdfPath) {
    return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
  }

  const buffer = await fs.readFile(pdfPath);
  const filename = pdfPath.split(/[/\\]/).pop() ?? 'vardiya.pdf';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}

export const runtime = 'nodejs';
