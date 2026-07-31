import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ParsedShiftRow } from '@/lib/types';
import { isAdminAuthed } from '@/lib/admin-auth';
import { saveLocalSchedule } from '@/lib/local-schedule-store';
import { dedupeParsedRows } from '@/lib/dedupe';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function POST(request: Request) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const year = parseInt(String(form.get('year')), 10);
  const month = parseInt(String(form.get('month')), 10);
  const title = String(form.get('title') ?? '');
  const published = form.get('published') === 'true';
  const entriesJson = String(form.get('entries') ?? '[]');
  const pdfFile = form.get('pdf') as File | null;

  let entries: ParsedShiftRow[];
  try {
    entries = JSON.parse(entriesJson);
  } catch {
    return NextResponse.json({ error: 'Invalid entries JSON' }, { status: 400 });
  }

  const uniqueEntries = dedupeParsedRows(entries);
  const removedDuplicates = entries.length - uniqueEntries.length;

  let pdfBuffer: Buffer | undefined;
  let pdfFilename: string | undefined;
  if (pdfFile) {
    pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    pdfFilename = pdfFile.name;
  }

  const saved = await saveLocalSchedule(
    year,
    month,
    title,
    uniqueEntries,
    published,
    pdfBuffer,
    pdfFilename
  );

  if (isSupabaseConfigured()) {
    try {
      const supabase = getServiceClient();
      let pdfUrl: string | null = saved.month.pdfUrl;

      if (pdfBuffer && pdfFilename) {
        const storagePath = `${year}/${month}/${Date.now()}-${pdfFilename}`;
        const { error: uploadError } = await supabase.storage
          .from('shift-schedules')
          .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('shift-schedules').getPublicUrl(storagePath);
          pdfUrl = urlData.publicUrl;
        }
      }

      const { data: existing } = await supabase
        .from('shift_schedule_months')
        .select('id')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      let monthId: string;

      if (existing) {
        monthId = existing.id;
        await supabase
          .from('shift_schedule_months')
          .update({
            title: title || `${year}-${month} Vardiya`,
            pdf_url: pdfUrl,
            pdf_filename: pdfFilename ?? null,
            published,
            updated_at: new Date().toISOString(),
          })
          .eq('id', monthId);

        await supabase.from('shift_schedule_entries').delete().eq('schedule_month_id', monthId);
      } else {
        const { data: inserted, error } = await supabase
          .from('shift_schedule_months')
          .insert({
            year,
            month,
            title: title || `${year}-${month} Vardiya`,
            pdf_url: pdfUrl,
            pdf_filename: pdfFilename ?? null,
            published,
          })
          .select('id')
          .single();

        if (error || !inserted) {
          throw new Error(error?.message ?? 'Insert failed');
        }
        monthId = inserted.id;
      }

      if (uniqueEntries.length > 0) {
        const rows = uniqueEntries.map((e: ParsedShiftRow) => ({
          schedule_month_id: monthId!,
          driver_name: e.driverName,
          shift_date: e.shiftDate,
          start_time: e.startTime ?? null,
          end_time: e.endTime ?? null,
          duration_hours: e.durationHours,
          slot_label: e.slotLabel ?? (e.durationHours === 4 ? '4s' : '8s'),
        }));

        await supabase.from('shift_schedule_entries').insert(rows);
      }
    } catch {
      /* Supabase opsiyonel — yerel kayıt zaten yapıldı */
    }
  }

  return NextResponse.json({
    ok: true,
    count: uniqueEntries.length,
    removedDuplicates,
    year,
    month,
    storage: 'local',
    message: `${year}-${String(month).padStart(2, '0')} çizelgesi kaydedildi.`,
  });
}

export const runtime = 'nodejs';
