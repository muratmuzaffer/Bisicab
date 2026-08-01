'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  FileUp,
  Loader2,
  Lock,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ParsedShiftRow } from '@/lib/types';
import { formatMonthYear, MONTH_NAMES_TR } from '@/lib/utils';

export function AdminClient() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [title, setTitle] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedShiftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
    } else {
      setAuthError('Yanlış şifre');
    }
  };

  const handlePdfUpload = async () => {
    if (!pdfFile) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', pdfFile);
      form.append('year', String(year));
      form.append('month', String(month));

      const res = await fetch('/api/admin/parse-pdf', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'PDF okunamadı');
      if (json.year) setYear(json.year);
      if (json.month) setMonth(json.month);
      if (json.year && json.month) {
        setTitle(`${formatMonthYear(json.year, json.month)} Vardiya Çizelgesi`);
      }
      setParsedRows(json.rows ?? []);
      const monthLabel = json.month ? formatMonthYear(json.year, json.month) : '';
      const dupNote =
        json.removedDuplicates > 0 ? ` (${json.removedDuplicates} tekrar temizlendi)` : '';
      setMessage(
        `${json.rows?.length ?? 0} vardiya, ${json.driverCount ?? 0} sürücü PDF'den çıkarıldı` +
          dupNote +
          (json.detectedFromPdf && monthLabel
            ? ` (${monthLabel} otomatik algılandı${json.detectedSource === 'filename' ? ', dosya adından' : ''})`
            : '') +
          '. Kontrol edip yayınlayın.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleCsvParse = () => {
    setError('');
    const rows = csvText
      .split(/\r?\n/)
      .filter(Boolean);
    if (rows.length < 2) {
      setError('CSV en az başlık + 1 satır olmalı');
      return;
    }
    fetch('/api/admin/parse-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText }),
    })
      .then((r) => r.json())
      .then((json) => {
        setParsedRows(json.rows ?? []);
        setMessage(`${json.rows?.length ?? 0} satır CSV'den yüklendi.`);
      });
  };

  const addManualRow = () => {
    setParsedRows((prev) => [
      ...prev,
      {
        driverName: '',
        shiftDate: `${year}-${String(month).padStart(2, '0')}-01`,
        startTime: '09:00',
        endTime: '13:00',
        durationHours: 4,
        slotLabel: '4s',
      },
    ]);
  };

  const updateRow = (idx: number, field: keyof ParsedShiftRow, value: string | number) => {
    setParsedRows((prev) => {
      const next = [...prev];
      const row = { ...next[idx]! };
      if (field === 'durationHours') {
        row.durationHours = Number(value) === 8 ? 8 : 4;
        row.slotLabel = row.durationHours === 4 ? '4s' : '8s';
      } else if (field === 'driverName') {
        row.driverName = String(value);
      } else if (field === 'shiftDate') {
        row.shiftDate = String(value);
      } else if (field === 'startTime') {
        row.startTime = String(value);
      } else if (field === 'endTime') {
        row.endTime = String(value);
      }
      next[idx] = row;
      return next;
    });
  };

  const removeRow = (idx: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePublish = async (publish: boolean) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      form.append('year', String(year));
      form.append('month', String(month));
      form.append('title', title || `${formatMonthYear(year, month)} Vardiya Çizelgesi`);
      form.append('published', String(publish));
      form.append('entries', JSON.stringify(parsedRows));
      if (pdfFile) form.append('pdf', pdfFile);

      const res = await fetch('/api/admin/publish', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Kayıt başarısız');
      setMessage(
        publish
          ? `${formatMonthYear(json.year ?? year, json.month ?? month)} çizelgesi yayınlandı!` +
              (json.removedDuplicates > 0 ? ` (${json.removedDuplicates} tekrar silindi)` : '') +
              ' Ana sayfada görmek için sayfayı yenileyin.'
          : 'Taslak kaydedildi.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-card"
        >
          <div className="mb-6 text-center">
            <Lock className="mx-auto mb-3 h-10 w-10 text-brand-dark" />
            <h1 className="text-xl font-bold">Vardiya Yönetimi</h1>
            <p className="mt-1 text-sm text-muted-foreground">Yönetici girişi</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            className="mb-4 w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
          {authError && <p className="mb-3 text-sm text-danger">{authError}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-dark py-3 font-semibold text-brand hover:bg-surface"
          >
            Giriş
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-brand-dark px-6 py-4 text-white">
        <h1 className="text-xl font-bold">
          <span className="text-brand">Bisi</span>Cab Vardiya Yönetimi
        </h1>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        {message && (
          <div className="flex items-center gap-2 rounded-xl bg-shift8-light px-4 py-3 text-shift8-dark">
            <CheckCircle2 className="h-5 w-5" />
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-danger">{error}</div>
        )}

        {/* Month selection */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="mb-4 text-lg font-bold">Ay Seçimi</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Yıl</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ay</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-border px-3 py-2"
              >
                {MONTH_NAMES_TR.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Başlık</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${formatMonthYear(year, month)} Vardiya`}
                className="w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
          </div>
        </section>

        {/* PDF Upload */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <FileUp className="h-5 w-5" />
            PDF Yükle
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Vardiya PDF&apos;ini yükleyin. Sistem metin çıkarmayı dener; sonucu tabloda düzenleyebilirsiniz.
          </p>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            className="mb-4 block w-full text-sm"
          />
          <button
            type="button"
            onClick={handlePdfUpload}
            disabled={!pdfFile || loading}
            className="flex items-center gap-2 rounded-xl bg-shift4 px-4 py-2.5 text-sm font-semibold text-white hover:bg-shift4-dark disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            PDF&apos;den Oku
          </button>
        </section>

        {/* CSV Import */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="mb-4 text-lg font-bold">CSV / Excel İçe Aktar</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            Format: <code className="rounded bg-canvas px-1">isim,tarih,başlangıç,bitiş,süre</code>
          </p>
          <p className="mb-4 text-xs text-muted-foreground">
            Örnek: Ahmet Yılmaz,2026-01-15,09:00,13:00,4s
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={5}
            placeholder="driver_name,date,start_time,end_time,duration&#10;Ahmet Yılmaz,2026-01-05,09:00,13:00,4s"
            className="mb-4 w-full rounded-lg border border-border px-3 py-2 font-mono text-sm"
          />
          <button
            type="button"
            onClick={handleCsvParse}
            className="rounded-xl bg-brand-dark px-4 py-2.5 text-sm font-semibold text-brand"
          >
            CSV Yükle
          </button>
        </section>

        {/* Entries table */}
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Vardiya Kayıtları ({parsedRows.length})</h2>
            <button
              type="button"
              onClick={addManualRow}
              className="flex items-center gap-1 rounded-lg bg-canvas px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              Satır Ekle
            </button>
          </div>

          {parsedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz kayıt yok. PDF, CSV yükleyin veya manuel ekleyin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="pb-2 pr-2">Sürücü</th>
                    <th className="pb-2 pr-2">Tarih</th>
                    <th className="pb-2 pr-2">Başlangıç</th>
                    <th className="pb-2 pr-2">Bitiş</th>
                    <th className="pb-2 pr-2">Süre</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-border/40">
                      <td className="py-2 pr-2">
                        <input
                          value={row.driverName}
                          onChange={(e) => updateRow(idx, 'driverName', e.target.value)}
                          className="w-full min-w-[120px] rounded border border-border px-2 py-1"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="date"
                          value={row.shiftDate}
                          onChange={(e) => updateRow(idx, 'shiftDate', e.target.value)}
                          className="rounded border border-border px-2 py-1"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="time"
                          value={row.startTime ?? ''}
                          onChange={(e) => updateRow(idx, 'startTime', e.target.value)}
                          className="rounded border border-border px-2 py-1"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="time"
                          value={row.endTime ?? ''}
                          onChange={(e) => updateRow(idx, 'endTime', e.target.value)}
                          className="rounded border border-border px-2 py-1"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          value={row.durationHours}
                          onChange={(e) => updateRow(idx, 'durationHours', e.target.value)}
                          className="rounded border border-border px-2 py-1"
                        >
                          <option value={4}>4s</option>
                          <option value={8}>8s</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="rounded p-1 text-danger hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handlePublish(true)}
              disabled={loading || parsedRows.length === 0}
              className="flex items-center gap-2 rounded-xl bg-shift8 px-6 py-3 font-semibold text-white hover:bg-shift8-dark disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Yayınla
            </button>
            <button
              type="button"
              onClick={() => handlePublish(false)}
              disabled={loading}
              className="rounded-xl border border-border px-6 py-3 font-semibold hover:bg-canvas disabled:opacity-50"
            >
              Taslak Kaydet
            </button>
            <a
              href="/"
              className="rounded-xl px-6 py-3 font-semibold text-muted-foreground hover:bg-canvas"
            >
              Siteyi Gör →
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
