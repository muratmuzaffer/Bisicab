'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  MessageSquare,
  Store,
  User,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import type { ShiftSwap } from '@/lib/types';
import { cn, formatDateTr, formatMonthYear } from '@/lib/utils';

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
    <AppShell
      title={
        <>
          <span className="text-brand">Vardiya</span> Değişimi
        </>
      }
      subtitle={formatMonthYear(year, month)}
      maxWidth="3xl"
      nav={[
        {
          href: '/',
          label: 'Çizelge',
          icon: <Calendar className="h-4 w-4" />,
        },
        {
          href: '/pazar',
          label: 'Pazar',
          icon: <Store className="h-4 w-4" />,
        },
      ]}
    >
      <div className="animate-slide-up space-y-6">
        {/* Form */}
        <section className="card overflow-hidden">
          <div className="border-b border-border/50 bg-gradient-to-br from-brand/8 to-white px-5 py-6 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/20">
                <ArrowLeftRight className="h-6 w-6 text-brand-dark" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Değişim kaydet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Kimin hangi günkü vardiyasını kiminle değiştirdiğinizi yazın. Tüm sürücüler bu
                  sayfadan görebilir.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            {message && (
              <div className="mb-5 flex items-center gap-3 rounded-xl bg-shift8-light px-4 py-3 text-sm font-medium text-shift8-dark">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                {message}
              </div>
            )}
            {error && (
              <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ben (değişimi yapan)" icon={<User className="h-4 w-4" />}>
                  <input
                    list="requester-names"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="Adınız"
                    required
                    className="input-field"
                  />
                  <datalist id="requester-names">
                    {suggestions.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Değişim yaptığım kişi" icon={<User className="h-4 w-4" />}>
                  <input
                    list="partner-names"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder="Arkadaşınızın adı"
                    required
                    className="input-field"
                  />
                  <datalist id="partner-names">
                    {partnerSuggestions.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </Field>
              </div>

              {/* Visual swap cards */}
              <div className="relative grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                <SwapSideCard
                  title="Benim vardiyam"
                  accent="shift4"
                  date={requesterDate}
                  onDateChange={setRequesterDate}
                  slot={requesterSlot}
                  onSlotChange={setRequesterSlot}
                  name={requesterName || 'Siz'}
                />

                <div className="hidden items-center justify-center sm:flex">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/20">
                    <ArrowLeftRight className="h-5 w-5 text-brand-dark" />
                  </div>
                </div>

                <SwapSideCard
                  title="Onun vardiyası"
                  accent="shift8"
                  date={partnerDate}
                  onDateChange={setPartnerDate}
                  slot={partnerSlot}
                  onSlotChange={setPartnerSlot}
                  name={partnerName || 'Partner'}
                />
              </div>

              <Field label="Not (isteğe bağlı)" icon={<MessageSquare className="h-4 w-4" />}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Kısa açıklama…"
                  className="input-field resize-none"
                />
              </Field>

              <button type="submit" disabled={loading} className="btn-primary w-full py-4">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowLeftRight className="h-5 w-5" />
                )}
                Değişimi kaydet
              </button>
            </form>
          </div>
        </section>

        {/* History */}
        <section className="card p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-bold">Değişim geçmişi</h2>
                <p className="text-xs text-muted-foreground">{swaps.length} kayıt</p>
              </div>
            </div>
          </div>

          {swaps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              Henüz kayıtlı değişim yok.
            </div>
          ) : (
            <ul className="space-y-4">
              {swaps.map((swap, i) => (
                <SwapCard key={swap.id} swap={swap} index={i} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

function SwapSideCard({
  title,
  accent,
  date,
  onDateChange,
  slot,
  onSlotChange,
  name,
}: {
  title: string;
  accent: 'shift4' | 'shift8';
  date: string;
  onDateChange: (v: string) => void;
  slot: string;
  onSlotChange: (v: string) => void;
  name: string;
}) {
  const isBlue = accent === 'shift4';
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        isBlue ? 'border-shift4-muted bg-shift4-light/50' : 'border-shift8-muted bg-shift8-light/50'
      )}
    >
      <p
        className={cn(
          'mb-3 text-xs font-bold uppercase tracking-wider',
          isBlue ? 'text-shift4-dark' : 'text-shift8-dark'
        )}
      >
        {title}
      </p>
      <p className="mb-3 truncate text-sm font-semibold">{name}</p>
      <input
        type="date"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        required
        className="input-field mb-2 bg-white text-sm"
      />
      <input
        value={slot}
        onChange={(e) => onSlotChange(e.target.value)}
        placeholder="Örn: F1 4s veya 12:30–20:30"
        className="input-field bg-white text-sm"
      />
    </div>
  );
}

function SwapCard({ swap, index }: { swap: ShiftSwap; index: number }) {
  const created = new Date(swap.createdAt);
  const dateStr = created.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li
      className="animate-fade-in rounded-2xl border border-border/60 bg-canvas/50 p-5 transition hover:border-brand/25 hover:shadow-card"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-bold shadow-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {swap.requesterName}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-bold shadow-sm">
            {swap.partnerName}
          </span>
        </div>
        <time className="text-xs font-medium text-muted-foreground">{dateStr}</time>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-shift4-muted bg-shift4-light/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-shift4-dark/70">
            {swap.requesterName}
          </p>
          <p className="mt-2 flex items-center gap-2 font-semibold text-shift4-dark">
            <Calendar className="h-4 w-4" />
            {formatDateTr(swap.requesterDate)}
          </p>
          {swap.requesterSlot && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-shift4-dark/80">
              <Clock className="h-3.5 w-3.5" />
              {swap.requesterSlot}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-shift8-muted bg-shift8-light/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-shift8-dark/70">
            {swap.partnerName}
          </p>
          <p className="mt-2 flex items-center gap-2 font-semibold text-shift8-dark">
            <Calendar className="h-4 w-4" />
            {formatDateTr(swap.partnerDate)}
          </p>
          {swap.partnerSlot && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-shift8-dark/80">
              <Clock className="h-3.5 w-3.5" />
              {swap.partnerSlot}
            </p>
          )}
        </div>
      </div>

      {swap.note && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm italic text-muted-foreground">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {swap.note}
        </p>
      )}
    </li>
  );
}
