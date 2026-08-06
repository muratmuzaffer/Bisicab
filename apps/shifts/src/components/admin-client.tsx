'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileUp,
  Loader2,
  Lock,
  Plus,
  Trash2,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import { formatPrice } from '@/lib/market-utils';
import type { ParsedShiftRow, ShiftSwap } from '@/lib/types';
import type { DriverVisit } from '@/lib/visit-types';
import { isMarketSwap } from '@/lib/swap-utils';
import { cn, formatDateTr, formatMonthYear, MONTH_NAMES_TR } from '@/lib/utils';

function formatVisitWhen(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  const [cancelRequests, setCancelRequests] = useState<ShiftSwap[]>([]);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelActionId, setCancelActionId] = useState<string | null>(null);
  const [visits, setVisits] = useState<DriverVisit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState('');

  const loadCancelRequests = useCallback(async () => {
    setCancelLoading(true);
    try {
      const res = await fetch('/api/admin/swap-cancellations');
      const json = (await res.json()) as { error?: string; requests?: ShiftSwap[] };
      if (!res.ok) {
        setError(json.error ?? 'İptal talepleri yüklenemedi');
        setCancelRequests([]);
        return;
      }
      setCancelRequests(json.requests ?? []);
    } catch {
      setError('İptal talepleri yüklenemedi');
      setCancelRequests([]);
    } finally {
      setCancelLoading(false);
    }
  }, []);

  const loadVisits = useCallback(async () => {
    setVisitsLoading(true);
    setVisitsError('');
    try {
      const res = await fetch('/api/admin/visits');
      const json = (await res.json()) as { error?: string; visits?: DriverVisit[] };
      if (!res.ok) {
        setVisitsError(json.error ?? 'Girişler yüklenemedi');
        setVisits([]);
        return;
      }
      setVisits(json.visits ?? []);
    } catch {
      setVisitsError('Girişler yüklenemedi');
      setVisits([]);
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      loadCancelRequests();
      loadVisits();
    }
  }, [authed, loadCancelRequests, loadVisits]);

  const handleCancelDecision = async (id: string, action: 'approve' | 'reject') => {
    const label = action === 'approve' ? 'onaylamak' : 'reddetmek';
    if (!window.confirm(`Bu iptal talebini ${label} istediğinize emin misiniz?`)) return;

    setCancelActionId(id);
    setError('');
    try {
      const res = await fetch('/api/admin/swap-cancellations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'İşlem başarısız');
      setMessage(
        action === 'approve'
          ? 'Değişim iptal edildi, çizelge güncellenecek.'
          : 'İptal talebi reddedildi.'
      );
      await loadCancelRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setCancelActionId(null);
    }
  };

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

        <section className="rounded-2xl bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-dark" />
              <h2 className="text-lg font-bold">Site girişleri</h2>
            </div>
            <button
              type="button"
              onClick={loadVisits}
              disabled={visitsLoading}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-canvas disabled:opacity-50"
            >
              {visitsLoading ? 'Yükleniyor…' : 'Yenile'}
            </button>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Sürücü isim seçip “Devam et” dediğinde kaydedilir. Son 150 giriş.
          </p>
          {visitsError && (
            <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {visitsError}
            </p>
          )}
          {visits.length === 0 && !visitsError ? (
            <p className="text-sm text-muted-foreground">
              {visitsLoading ? 'Yükleniyor…' : 'Henüz giriş kaydı yok.'}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas/80 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Sürücü</th>
                    <th className="px-4 py-2.5">Giriş zamanı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {visits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-canvas/40">
                      <td className="px-4 py-2.5 font-semibold">{visit.driverName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {formatVisitWhen(visit.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Değişim iptal talepleri</h2>
            <button
              type="button"
              onClick={loadCancelRequests}
              disabled={cancelLoading}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-canvas disabled:opacity-50"
            >
              {cancelLoading ? 'Yükleniyor…' : 'Yenile'}
            </button>
          </div>
          {cancelRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bekleyen iptal talebi yok.</p>
          ) : (
            <ul className="space-y-3">
              {cancelRequests.map((swap) => (
                <li
                  key={swap.id}
                  className={cn(
                    'rounded-xl border p-4',
                    isMarketSwap(swap)
                      ? 'border-orange-300 bg-orange-50/70'
                      : 'border-amber-200/80 bg-amber-50/50'
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {isMarketSwap(swap) ? (
                          <>
                            <span className="mr-2 inline-flex rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                              Pazar
                            </span>
                            {swap.partnerName} → {swap.requesterName}
                            {swap.soldPrice != null && (
                              <span className="ml-2 text-sm font-bold text-orange-900">
                                {formatPrice(swap.soldPrice)}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            {swap.requesterName}
                            {swap.requesterShifts.length > 0 && <> ↔ {swap.partnerName}</>}
                            {swap.requesterShifts.length === 0 && (
                              <span className="text-muted-foreground"> ← {swap.partnerName}</span>
                            )}
                          </>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Talep eden:{' '}
                        <span className="font-medium text-foreground">
                          {swap.cancelRequestedBy ?? '—'}
                        </span>
                        {swap.cancelRequestedAt && (
                          <>
                            {' '}
                            ·{' '}
                            {new Date(swap.cancelRequestedAt).toLocaleString('tr-TR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {swap.partnerShifts.map((s) => formatDateTr(s.date)).join(', ')}
                        {swap.requesterShifts.length > 0 &&
                          ` · verilen: ${swap.requesterShifts.map((s) => formatDateTr(s.date)).join(', ')}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCancelDecision(swap.id, 'approve')}
                        disabled={cancelActionId === swap.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-shift8 px-3 py-2 text-xs font-semibold text-white hover:bg-shift8-dark disabled:opacity-50"
                      >
                        {cancelActionId === swap.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Onayla
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelDecision(swap.id, 'reject')}
                        disabled={cancelActionId === swap.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold hover:bg-canvas disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reddet
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

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
