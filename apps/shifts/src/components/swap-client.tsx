'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, ArrowRight, Calendar, CheckCircle2, Loader2, User } from 'lucide-react';
import type { ShiftSwap } from '@/lib/types';
import { formatDateTr, formatMonthYear } from '@/lib/utils';

interface SwapClientProps {
  driverNames: string[];
  initialSwaps: ShiftSwap[];
  year: number;
  month: number;
}

export function SwapClient({ driverNames, initialSwaps, year, month }: SwapClientProps) {
  const [swaps, setSwaps] = useState(initialSwaps);
  const [requesterName, setRequesterName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [requesterDate, setRequesterDate] = useState('');
  const [partnerDate, setPartnerDate] = useState('');
  const [requesterSlot, setRequesterSlot] = useState('');
  const [partnerSlot, setPartnerSlot] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('bisicab-shift-name');
    if (stored) setRequesterName(stored);
  }, []);

  const suggestions = useMemo(() => {
    const q = requesterName.toLowerCase();
    if (!q) return driverNames.slice(0, 8);
    return driverNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 8);
  }, [requesterName, driverNames]);

  const partnerSuggestions = useMemo(() => {
    return driverNames.filter((n) => n !== requesterName).slice(0, 12);
  }, [driverNames, requesterName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterName,
          partnerName,
          requesterDate,
          partnerDate,
          requesterSlot: requesterSlot || undefined,
          partnerSlot: partnerSlot || undefined,
          note: note || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Kayıt başarısız');

      setSwaps((prev) => [json.swap, ...prev]);
      localStorage.setItem('bisicab-shift-name', requesterName);
      setMessage('Vardiya değişimi kaydedildi!');
      setPartnerDate('');
      setPartnerSlot('');
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-brand-dark text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-extrabold">
              <span className="text-brand">Vardiya</span> Değişimi
            </h1>
            <p className="text-xs text-soft/60">{formatMonthYear(year, month)}</p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20"
          >
            ← Çizelge
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-brand/20 bg-white p-5 shadow-card sm:p-6">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <ArrowLeftRight className="h-5 w-5 text-brand-dark" />
            Değişim Kaydet
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Kimin hangi günkü vardiyasını kiminle değiştirdiğinizi kaydedin. Herkes bu sayfadan görebilir.
          </p>

          {message && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-shift8-light px-4 py-3 text-sm text-shift8-dark">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Ben (değişimi yapan)</label>
                <input
                  list="requester-names"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  placeholder="Adınız"
                  required
                  className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
                <datalist id="requester-names">
                  {suggestions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Değişim yaptığım kişi</label>
                <input
                  list="partner-names"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Arkadaşınızın adı"
                  required
                  className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
                <datalist id="partner-names">
                  {partnerSuggestions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid gap-4 rounded-xl bg-canvas p-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Benim vardiyam
                </p>
                <input
                  type="date"
                  value={requesterDate}
                  onChange={(e) => setRequesterDate(e.target.value)}
                  required
                  className="mb-2 w-full rounded-lg border border-border px-3 py-2"
                />
                <input
                  value={requesterSlot}
                  onChange={(e) => setRequesterSlot(e.target.value)}
                  placeholder="Örn: F1 4s veya 12:30-20:30"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Onun vardiyası
                </p>
                <input
                  type="date"
                  value={partnerDate}
                  onChange={(e) => setPartnerDate(e.target.value)}
                  required
                  className="mb-2 w-full rounded-lg border border-border px-3 py-2"
                />
                <input
                  value={partnerSlot}
                  onChange={(e) => setPartnerSlot(e.target.value)}
                  placeholder="Örn: B1 8s veya 16:30-20:30"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Not (isteğe bağlı)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Kısa açıklama..."
                className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-dark py-3.5 font-semibold text-brand hover:bg-surface disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowLeftRight className="h-5 w-5" />}
              Değişimi Kaydet
            </button>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-card sm:p-6">
          <h2 className="mb-4 text-lg font-bold">Değişim Geçmişi ({swaps.length})</h2>

          {swaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kayıtlı değişim yok.</p>
          ) : (
            <ul className="space-y-3">
              {swaps.map((swap) => (
                <SwapCard key={swap.id} swap={swap} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function SwapCard({ swap }: { swap: ShiftSwap }) {
  const created = new Date(swap.createdAt);
  const dateStr = created.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li className="rounded-xl border border-border/60 p-4 transition hover:border-brand/30 hover:bg-canvas/50">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4 text-brand-dark" />
          {swap.requesterName}
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          {swap.partnerName}
        </div>
        <time className="shrink-0 text-xs text-muted-foreground">{dateStr}</time>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-shift4-light/50 px-3 py-2 text-sm">
          <p className="font-medium text-shift4-dark">{swap.requesterName}</p>
          <p className="flex items-center gap-1 text-shift4-dark/80">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateTr(swap.requesterDate)}
          </p>
          {swap.requesterSlot && (
            <p className="mt-0.5 text-xs text-shift4-dark/70">{swap.requesterSlot}</p>
          )}
        </div>
        <div className="rounded-lg bg-shift8-light/50 px-3 py-2 text-sm">
          <p className="font-medium text-shift8-dark">{swap.partnerName}</p>
          <p className="flex items-center gap-1 text-shift8-dark/80">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateTr(swap.partnerDate)}
          </p>
          {swap.partnerSlot && (
            <p className="mt-0.5 text-xs text-shift8-dark/70">{swap.partnerSlot}</p>
          )}
        </div>
      </div>

      {swap.note && (
        <p className="mt-2 text-sm italic text-muted-foreground">&ldquo;{swap.note}&rdquo;</p>
      )}
    </li>
  );
}
