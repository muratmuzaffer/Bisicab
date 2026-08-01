import fs from 'node:fs';
import path from 'node:path';
import pdf from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { parseBisiCabPdfWithPositions } from '../src/lib/pdf-grid-parser';
import { detectMonthYear } from '../src/lib/month-detect';
import { dedupeParsedRows } from '../src/lib/dedupe';
import { saveLocalSchedule } from '../src/lib/local-schedule-store';

config({ path: path.join(process.cwd(), '.env.local') });

const pdfPath =
  process.argv[2] ??
  'C:/Users/ma727/OneDrive/Masaüstü/BisiCab Agustos 2026 Vardiya Listesi.pdf';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing Supabase env vars in apps/shifts/.env.local');
    process.exit(1);
  }

  const filename = path.basename(pdfPath);
  const buffer = fs.readFileSync(pdfPath);
  const parsed = await pdf(buffer);
  const detected = detectMonthYear(parsed.text, filename);

  if (!detected) {
    console.error('Could not detect month/year from PDF');
    process.exit(1);
  }

  const { year, month } = detected;
  console.log(`Detected: ${year}-${month} (${detected.source}) from ${filename}`);

  const rawRows = await parseBisiCabPdfWithPositions(buffer, year, month);
  const rows = dedupeParsedRows(rawRows);
  console.log(`Parsed ${rows.length} shifts, ${new Set(rows.map((r) => r.driverName)).size} drivers`);

  const title = `Ağustos ${year} Vardiya Çizelgesi`;
  await saveLocalSchedule(year, month, title, rows, true, buffer, filename);
  console.log('Saved locally');

  const supabase = createClient(url, key);
  let pdfUrl: string | null = null;

  const storagePath = `${year}/${month}/${Date.now()}-${filename}`;
  const { error: uploadError } = await supabase.storage
    .from('shift-schedules')
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    console.warn('PDF upload warning:', uploadError.message);
  } else {
    pdfUrl = supabase.storage.from('shift-schedules').getPublicUrl(storagePath).data.publicUrl;
  }

  const { data: existing, error: existingError } = await supabase
    .from('shift_schedule_months')
    .select('id')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  let monthId: string;

  if (existing) {
    monthId = existing.id;
    const { error } = await supabase
      .from('shift_schedule_months')
      .update({
        title,
        pdf_url: pdfUrl,
        pdf_filename: filename,
        published: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', monthId);
    if (error) throw new Error(error.message);

    const { error: deleteError } = await supabase
      .from('shift_schedule_entries')
      .delete()
      .eq('schedule_month_id', monthId);
    if (deleteError) throw new Error(deleteError.message);
  } else {
    const { data: inserted, error } = await supabase
      .from('shift_schedule_months')
      .insert({
        year,
        month,
        title,
        pdf_url: pdfUrl,
        pdf_filename: filename,
        published: true,
      })
      .select('id')
      .single();
    if (error || !inserted) throw new Error(error?.message ?? 'insert failed');
    monthId = inserted.id;
  }

  const payload = rows.map((e) => ({
    schedule_month_id: monthId,
    driver_name: e.driverName,
    shift_date: e.shiftDate,
    start_time: e.startTime ?? null,
    end_time: e.endTime ?? null,
    duration_hours: e.durationHours,
    slot_label: e.slotLabel ?? (e.durationHours === 4 ? '4s' : '8s'),
  }));

  const { error: insertError } = await supabase.from('shift_schedule_entries').insert(payload);
  if (insertError) throw new Error(insertError.message);

  console.log(`Published ${year}-${month} to Supabase (${rows.length} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
