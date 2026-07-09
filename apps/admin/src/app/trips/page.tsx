'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { exportToExcel, exportToPdf, type ExportRow } from '@/lib/export';

interface TripRow {
  id: string;
  created_at: string;
  total_distance: number;
  total_duration: number;
  total_amount: number;
  status: string;
  receipt_image_url: string | null;
  users: { full_name: string | null } | null;
}

type StatusFilter = 'all' | 'completed' | 'ongoing' | 'cancelled';

export default function TripsPage() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      let query = supabase
        .from('trips')
        .select(
          'id, created_at, total_distance, total_duration, total_amount, status, receipt_image_url, users:driver_id(full_name)'
        )
        .order('created_at', { ascending: false })
        .limit(500);
      if (status !== 'all') query = query.eq('status', status);
      const { data } = await query;
      setTrips((data as unknown as TripRow[]) ?? []);
    };
    void load();
  }, [status]);

  const filtered = useMemo(() => {
    if (!search.trim()) return trips;
    const q = search.toLowerCase();
    return trips.filter((t) =>
      (t.users?.full_name ?? '').toLowerCase().includes(q)
    );
  }, [trips, search]);

  const exportRows: ExportRow[] = filtered.map((t) => ({
    driver: t.users?.full_name ?? '—',
    date: new Date(t.created_at).toLocaleString('tr-TR'),
    distanceKm: Number(t.total_distance),
    durationMin: Number(t.total_duration),
    amount: Number(t.total_amount),
    status: t.status,
    receiptUrl: t.receipt_image_url ?? '',
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Sürüş Denetimi</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToExcel(exportRows)}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToPdf(exportRows)}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sürücü ara..."
          className="h-10 rounded-md border border-border px-3 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="h-10 rounded-md border border-border px-3 text-sm"
        >
          <option value="all">Tüm Durumlar</option>
          <option value="completed">Tamamlandı</option>
          <option value="ongoing">Devam Ediyor</option>
          <option value="cancelled">İptal</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted text-muted-foreground">
            <tr>
              <th className="p-3">Fiş</th>
              <th className="p-3">Sürücü</th>
              <th className="p-3">Tarih</th>
              <th className="p-3">Süre</th>
              <th className="p-3">KM</th>
              <th className="p-3">Tutar</th>
              <th className="p-3">Durum</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="p-3">
                  {t.receipt_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.receipt_image_url}
                      alt="Fiş"
                      onClick={() => setPreview(t.receipt_image_url)}
                      className="h-14 w-14 cursor-pointer rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                      Yok
                    </div>
                  )}
                </td>
                <td className="p-3 font-medium">{t.users?.full_name ?? '—'}</td>
                <td className="p-3 text-muted-foreground">
                  {new Date(t.created_at).toLocaleString('tr-TR')}
                </td>
                <td className="p-3">{Number(t.total_duration).toFixed(0)} dk</td>
                <td className="p-3">{Number(t.total_distance).toFixed(2)}</td>
                <td className="p-3 font-semibold text-success">
                  {Number(t.total_amount).toFixed(2)} ₺
                </td>
                <td className="p-3">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Kayıt bulunamadı.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Fiş büyük önizleme */}
      {preview ? (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Fiş" className="max-h-full max-w-full rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}
