'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Gavel,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useDriverIdentity } from '@/components/driver-identity';
import styles from '@/components/market.module.css';
import type {
  ShiftMarketListing,
  ShiftMarketOffer,
} from '@/lib/market-types';
import type { ShiftDuration, ShiftScheduleEntry } from '@/lib/types';
import {
  formatDateCompactTr,
  formatIbanDisplay,
  formatListingDeadline,
  formatPrice,
  highestOffer,
  IBAN_PLACEHOLDER,
  lastOffer,
  normalizeIban,
  parsePriceInput,
  postitTiltFor,
  postitToneFor,
  resolveListingIban,
  shiftLabel,
  shiftsForDriver,
  sortOffersByAmount,
  validateListingInput,
  validateOffer,
} from '@/lib/market-utils';
import { cn, formatDateTr, formatMonthYear, namesMatch } from '@/lib/utils';

const IBAN_STORAGE_PREFIX = 'bisicab-market-iban:';

function ibanStorageKey(driverName: string): string {
  return `${IBAN_STORAGE_PREFIX}${driverName.trim().toLocaleLowerCase('tr')}`;
}

function readStoredIban(driverName: string): string {
  if (!driverName.trim() || typeof window === 'undefined') return '';
  const byName = localStorage.getItem(ibanStorageKey(driverName));
  if (byName?.trim()) return normalizeIban(byName);
  // Eski tek-anahtar kaydı (geçiş)
  const legacy = localStorage.getItem('bisicab-market-iban');
  return legacy?.trim() ? normalizeIban(legacy) : '';
}

function writeStoredIban(driverName: string, iban: string): void {
  if (!driverName.trim()) return;
  localStorage.setItem(ibanStorageKey(driverName), normalizeIban(iban));
}

type BoardFilter = 'open' | 'all' | 'mine' | 'sold';

const TONE_CLASS: Record<string, string> = {
  yellow: styles.toneYellow!,
  pink: styles.tonePink!,
  blue: styles.toneBlue!,
  green: styles.toneGreen!,
  orange: styles.toneOrange!,
};

interface MarketClientProps {
  initialListings: ShiftMarketListing[];
  driverNames: string[];
  entries: ShiftScheduleEntry[];
  year: number;
  month: number;
}

export function MarketClient({
  initialListings,
  entries,
  year,
  month,
}: MarketClientProps) {
  const { name: myName } = useDriverIdentity();
  const [listings, setListings] = useState(initialListings);
  const [showForm, setShowForm] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilter>('all');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const myShifts = useMemo(() => shiftsForDriver(entries, myName), [entries, myName]);

  const openCount = useMemo(
    () => listings.filter((listing) => listing.status === 'open').length,
    [listings]
  );
  const soldCount = useMemo(
    () => listings.filter((listing) => listing.status === 'sold').length,
    [listings]
  );

  const boardListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...listings]
      .filter((listing) => {
        if (filter === 'open' && listing.status !== 'open') return false;
        if (filter === 'sold' && listing.status !== 'sold') return false;
        if (filter === 'mine') {
          if (!myName.trim() || !namesMatch(listing.sellerName, myName)) return false;
        }
        if (!q) return true;
        return (
          listing.sellerName.toLowerCase().includes(q) ||
          listing.shiftDate.includes(q) ||
          (listing.slotLabel ?? '').toLowerCase().includes(q) ||
          (listing.note ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const dateCmp = a.shiftDate.localeCompare(b.shiftDate);
        if (dateCmp !== 0) return dateCmp;
        const timeA = (a.startTime ?? '99:99').slice(0, 5);
        const timeB = (b.startTime ?? '99:99').slice(0, 5);
        const timeCmp = timeA.localeCompare(timeB);
        if (timeCmp !== 0) return timeCmp;
        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [listings, filter, query, myName]);

  const activeListing = useMemo(
    () => listings.find((listing) => listing.id === activeId) ?? null,
    [listings, activeId]
  );

  const upsertListing = useCallback((listing: ShiftMarketListing) => {
    setListings((prev) => {
      const index = prev.findIndex((item) => item.id === listing.id);
      if (index < 0) return [listing, ...prev];
      const next = [...prev];
      next[index] = listing;
      return next;
    });
  }, []);

  const handleCreated = (listing: ShiftMarketListing) => {
    upsertListing(listing);
    setShowForm(false);
    setFilter('all');
    setMessage('İlanınız panoya asıldı.');
    setError('');
  };

  const handleRemoved = (id: string) => {
    setListings((prev) => prev.filter((listing) => listing.id !== id));
    setActiveId(null);
    setMessage('İlan panodan kaldırıldı.');
  };

  const filters: { id: BoardFilter; label: string }[] = [
    { id: 'all', label: `Tümü (${listings.length})` },
    { id: 'open', label: `Açık (${openCount})` },
    { id: 'sold', label: `Satılan (${soldCount})` },
    { id: 'mine', label: 'Benim' },
  ];

  return (
    <AppShell
      title={
        <>
          <span className="text-brand">Vardiya</span> Pazarı
        </>
      }
      subtitle={`${formatMonthYear(year, month)} · ${openCount} açık ilan`}
    >
      <div className="animate-slide-up space-y-5">
        <section className={styles.hero}>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            BisiCab · Vardiya Pazarı
          </p>
          <h2 className={styles.heroTitle}>
            Para <span className={styles.heroAccent}>dosttan</span> kazanılır
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            İhtiyacın olmayan vardiyayı taban fiyatla panoya as; arkadaşların teklif versin.
            Vardiya saati gelene kadar ilan açık kalır — son teklif veren alır, vardiya ona geçer.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <HowStep
            step="1"
            title="İlan ver"
            text="Satmak istediğin vardiyayı ve taban fiyatı gir. Not ekleyebilirsin."
          />
          <HowStep
            step="2"
            title="Teklif gelince"
            text="Diğer sürücüler panodaki nota dokunup teklif verir. Taban fiyatın altına inilemez."
          />
          <HowStep
            step="3"
            title="Otomatik satış"
            text="Vardiya tarihi ve saati gelince son teklif veren “satıldı” olur; çizelgede vardiya ona geçer."
          />
        </section>

        <section className="card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-border/50 bg-gradient-to-br from-brand/10 to-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/20">
                <Store className="h-5 w-5 text-brand-dark" />
              </div>
              <div>
                <h3 className="text-lg font-bold">İlan ver</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {myName
                    ? `${myName} olarak ilan açıyorsun · vardiya saati gelene kadar teklif alınır.`
                    : 'Vardiya saati gelene kadar ilan açabilir ve teklif alabilirsiniz.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForm((prev) => !prev);
                setMessage('');
                setError('');
              }}
              className="btn-primary shrink-0"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? 'Vazgeç' : 'İlan ver'}
            </button>
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            {message && (
              <p className="flex items-center gap-2 rounded-xl bg-shift8-light px-4 py-3 text-sm font-medium text-shift8-dark">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {message}
              </p>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger">
                {error}
              </p>
            )}

            {showForm && (
              <ListingForm
                myName={myName}
                myShifts={myShifts}
                onCreated={handleCreated}
                onError={setError}
              />
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    'shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition',
                    filter === item.id
                      ? 'bg-brand-dark text-brand'
                      : 'bg-white text-muted-foreground ring-1 ring-border hover:bg-muted'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="relative block w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="İsim, tarih veya vardiya ara…"
                className="input-field bg-white py-2.5 pl-9 text-sm"
              />
            </label>
          </div>

          <div className={styles.board}>
            {boardListings.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-black/10 bg-white/40 py-14 text-center">
                <p className="text-sm font-semibold text-foreground/80">
                  {listings.length === 0 ? 'Panoda henüz ilan yok.' : 'Bu filtreye uyan ilan yok.'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {listings.length === 0
                    ? 'İlk post-it’i sen as — “İlan ver”e dokun.'
                    : 'Filtreyi veya aramayı değiştirmeyi dene.'}
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {boardListings.map((listing) => (
                  <PostitCard
                    key={listing.id}
                    listing={listing}
                    onOpen={() => setActiveId(listing.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {activeListing && (
        <ListingDetail
          listing={activeListing}
          myName={myName}
          onClose={() => setActiveId(null)}
          onUpdated={upsertListing}
          onRemoved={handleRemoved}
        />
      )}
    </AppShell>
  );
}

function HowStep({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div className={styles.howCard}>
      <p className="text-[11px] font-black uppercase tracking-wider text-brand-deep">Adım {step}</p>
      <p className="mt-1 text-sm font-bold">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function ListingForm({
  myName,
  myShifts,
  onCreated,
  onError,
}: {
  myName: string;
  myShifts: ShiftScheduleEntry[];
  onCreated: (listing: ShiftMarketListing) => void;
  onError: (message: string) => void;
}) {
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [manual, setManual] = useState(myShifts.length === 0);
  const [manualDate, setManualDate] = useState('');
  const [manualSlot, setManualSlot] = useState('');
  const [manualDuration, setManualDuration] = useState<ShiftDuration>(8);
  const [price, setPrice] = useState('');
  const [iban, setIban] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setManual(myShifts.length === 0);
    setSelectedShiftId('');
  }, [myShifts.length, myName]);

  useEffect(() => {
    setIban(readStoredIban(myName));
  }, [myName]);

  const selectedShift = myShifts.find((shift) => shift.id === selectedShiftId) ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError('');

    const minPrice = parsePriceInput(price);
    const shiftDate = manual ? manualDate : (selectedShift?.shiftDate ?? '');

    const startTime = manual ? null : selectedShift?.startTime ?? null;
    const validationError = validateListingInput({
      sellerName: myName,
      shiftDate,
      startTime,
      minPrice,
      iban,
    });
    if (validationError) {
      onError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerName: myName,
          shiftDate,
          slotLabel: manual ? manualSlot || null : selectedShift?.slotLabel ?? null,
          startTime,
          endTime: manual ? null : selectedShift?.endTime ?? null,
          durationHours: manual ? manualDuration : selectedShift?.durationHours ?? 8,
          minPrice,
          iban,
          note: note || null,
        }),
      });

      const text = await res.text();
      const json = text ? (JSON.parse(text) as { error?: string; listing?: ShiftMarketListing }) : {};
      if (!res.ok) throw new Error(json.error ?? 'İlan kaydedilemedi');
      if (!json.listing) throw new Error('Sunucudan geçersiz yanıt alındı');

      writeStoredIban(myName, iban);
      onCreated(json.listing);
      setPrice('');
      setNote('');
      setSelectedShiftId('');
      setManualDate('');
      setManualSlot('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'İlan kaydedilemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5 rounded-2xl border border-border/70 bg-canvas/40 p-4 sm:p-5"
    >
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Satılacak vardiya
          </p>
          {myShifts.length > 0 && (
            <button
              type="button"
              onClick={() => setManual((prev) => !prev)}
              className="text-xs font-semibold text-brand-dark underline underline-offset-2"
            >
              {manual ? 'Çizelgeden seç' : 'Elle gir'}
            </button>
          )}
        </div>

        {manual ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="input-field bg-white text-sm"
              aria-label="Vardiya tarihi"
            />
            <input
              value={manualSlot}
              onChange={(e) => setManualSlot(e.target.value)}
              placeholder="Örn: F1 veya 16:30–20:30"
              className="input-field bg-white text-sm"
              aria-label="Vardiya etiketi"
            />
            <select
              value={manualDuration}
              onChange={(e) => setManualDuration(Number(e.target.value) === 4 ? 4 : 8)}
              className="input-field bg-white text-sm"
              aria-label="Vardiya süresi"
            >
              <option value={4}>4 saat</option>
              <option value={8}>8 saat</option>
            </select>
          </div>
        ) : myShifts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
            Bu ay için çizelgede vardiyanız görünmüyor. “Elle gir” ile ekleyebilirsiniz.
          </p>
        ) : (
          <ul className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {myShifts.map((shift) => {
              const selected = shift.id === selectedShiftId;
              return (
                <li key={shift.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedShiftId(shift.id)}
                    className={cn(
                      'w-full rounded-xl border px-3 py-2.5 text-left transition',
                      selected
                        ? 'border-brand bg-brand/15 shadow-glow'
                        : 'border-border bg-white hover:border-brand/40'
                    )}
                  >
                    <p className="text-sm font-semibold">{formatDateTr(shift.shiftDate)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{shiftLabel(shift)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="market-price"
            className="mb-2 flex items-center gap-2 text-sm font-bold"
          >
            <Tag className="h-4 w-4 text-muted-foreground" />
            Taban fiyat (₺)
          </label>
          <input
            id="market-price"
            type="number"
            inputMode="decimal"
            min={1}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Örn: 250"
            className="input-field bg-white"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Teklifler bu tutarın altında olamaz. Vardiya saati gelince son teklif satılır.
          </p>
        </div>

        <div>
          <label htmlFor="market-iban" className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Coins className="h-4 w-4 text-muted-foreground" />
            Senin IBAN’ın
          </label>
          <input
            id="market-iban"
            value={formatIbanDisplay(iban)}
            onChange={(e) => setIban(normalizeIban(e.target.value))}
            placeholder={IBAN_PLACEHOLDER}
            className="input-field bg-white font-mono text-sm tracking-wide"
            autoComplete="off"
            spellCheck={false}
            required
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Her satıcı kendi IBAN’ını girer — post-itte sadece o görünür ve kopyalanır.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="market-note" className="mb-2 flex items-center gap-2 text-sm font-bold">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Not (isteğe bağlı)
        </label>
        <textarea
          id="market-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Kısa açıklama…"
          className="input-field resize-none bg-white"
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        Panoya as
      </button>
    </form>
  );
}

function IbanCopyRow({
  iban,
  compact,
  stopPropagation,
}: {
  iban: string;
  compact?: boolean;
  stopPropagation?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const raw = normalizeIban(iban);
  const display = formatIbanDisplay(raw);

  if (!raw) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'relative z-10 flex w-full items-center gap-1.5 rounded-lg border border-black/10 bg-white/50 text-left transition hover:bg-white/80 active:scale-[0.99]',
        compact ? 'px-2 py-1.5' : 'px-3 py-2.5'
      )}
      title="IBAN kopyala"
    >
      <span className="min-w-0 flex-1">
        {!compact && (
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide opacity-55">
            IBAN
          </span>
        )}
        <span
          className={cn(
            'block font-mono font-bold leading-tight tracking-wide',
            compact ? 'truncate text-[10px]' : 'break-[break-all] text-xs sm:text-sm'
          )}
        >
          {display}
        </span>
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-bold',
          copied ? 'bg-shift8 text-white' : 'bg-black/10'
        )}
      >
        {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? 'Kopyalandı' : 'Kopyala'}
      </span>
    </button>
  );
}

function PostitCard({
  listing,
  onOpen,
}: {
  listing: ShiftMarketListing;
  onOpen: () => void;
}) {
  const tone = TONE_CLASS[postitToneFor(listing.id)] ?? styles.toneYellow;
  const tilt = postitTiltFor(listing.id);
  const latest = lastOffer(listing.offers);
  const sold = listing.status === 'sold';
  const cancelled = listing.status === 'cancelled';
  const deadlineLabel = formatListingDeadline(listing);
  const iban = resolveListingIban(listing);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        style={{ '--tilt': `${tilt}deg` } as CSSProperties}
        className={cn(
          styles.postit,
          'w-full [transform:rotate(var(--tilt))]',
          'hover:[transform:rotate(0deg)_translateY(-4px)]',
          'focus-visible:[transform:rotate(0deg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand',
          tone,
          (sold || cancelled) && 'saturate-50'
        )}
      >
        <span className={styles.pushpin} aria-hidden />

        <div className="relative z-10 mb-2 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[11px] font-black tracking-wide shadow-sm',
              listing.durationHours === 4
                ? 'bg-shift4 text-white'
                : 'bg-shift8 text-white'
            )}
          >
            {listing.durationHours === 4 ? '4s' : '8s'}
          </span>
          {(sold || cancelled) && (
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow',
                sold ? 'bg-red-600' : 'bg-muted-foreground'
              )}
            >
              {sold ? 'Satıldı' : 'Kapandı'}
            </span>
          )}
        </div>

        <p className="truncate text-[13px] font-black leading-tight sm:text-sm">
          {listing.sellerName}
        </p>
        <p className="mt-1.5 truncate text-[11px] font-semibold leading-tight opacity-80 sm:text-xs">
          {formatDateCompactTr(listing.shiftDate)}
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-tight opacity-70 sm:text-xs">
          {shiftLabel(listing)}
        </p>

        <p className="mt-3 text-lg font-black leading-none sm:text-xl">
          {formatPrice(
            sold ? (listing.soldPrice ?? listing.minPrice) : listing.minPrice
          )}
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-60">
          {sold ? 'satış fiyatı' : 'taban fiyat'}
        </p>

        <div
          className={cn(styles.postitSafe, 'mt-2')}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <IbanCopyRow iban={iban} compact stopPropagation />
        </div>

        <div
          className={cn(
            styles.postitSafe,
            'mt-2 border-t border-black/10 pt-2 text-[11px] font-semibold leading-tight opacity-80'
          )}
        >
          {sold && listing.soldToName ? (
            <span>Alan: {listing.soldToName}</span>
          ) : latest ? (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Son: {latest.bidderName}
            </span>
          ) : (
            <span>Henüz teklif yok</span>
          )}
        </div>

        {listing.status === 'open' && (
          <p className={cn(styles.postitSafe, 'mt-1 text-[10px] font-bold opacity-55')}>
            Kapanış {deadlineLabel}
          </p>
        )}

        {listing.note && listing.status === 'open' && (
          <p
            className={cn(
              styles.postitSafe,
              'mt-2 line-clamp-2 text-[11px] italic leading-tight opacity-70'
            )}
          >
            {listing.note}
          </p>
        )}

        {sold && (
          <span className={styles.soldStamp} aria-hidden>
            <span>Satıldı</span>
          </span>
        )}
        {cancelled && (
          <span className={cn(styles.soldStamp, styles.expiredStamp)} aria-hidden>
            <span>Kapandı</span>
          </span>
        )}
      </button>
    </li>
  );
}

function suggestedAmounts(minPrice: number, bestAmount: number | null): number[] {
  const floor = bestAmount != null ? Math.max(minPrice, bestAmount) : minPrice;
  const next = bestAmount != null && bestAmount >= minPrice ? bestAmount + 50 : minPrice;
  const bumps = [floor, next, floor + 100, floor + 200];
  return [...new Set(bumps.map((n) => Math.round(n)))].filter((n) => n >= minPrice).slice(0, 4);
}

function ListingDetail({
  listing,
  myName,
  onClose,
  onUpdated,
  onRemoved,
}: {
  listing: ShiftMarketListing;
  myName: string;
  onClose: () => void;
  onUpdated: (listing: ShiftMarketListing) => void;
  onRemoved: (id: string) => void;
}) {
  const best = highestOffer(listing.offers);
  const latest = lastOffer(listing.offers);
  const minRequired = listing.minPrice;
  const [amount, setAmount] = useState(String(minRequired));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [editPrice, setEditPrice] = useState(String(listing.minPrice));
  const [editIban, setEditIban] = useState(resolveListingIban(listing));
  const [editNote, setEditNote] = useState(listing.note ?? '');
  const [editDate, setEditDate] = useState(listing.shiftDate);
  const [editSlot, setEditSlot] = useState(listing.slotLabel ?? '');
  const [editDuration, setEditDuration] = useState<ShiftDuration>(listing.durationHours);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setAmount(String(minRequired));
    setNote('');
    setError('');
    setSuccess('');
    setEditing(false);
    setEditPrice(String(listing.minPrice));
    setEditIban(resolveListingIban(listing));
    setEditNote(listing.note ?? '');
    setEditDate(listing.shiftDate);
    setEditSlot(listing.slotLabel ?? '');
    setEditDuration(listing.durationHours);
  }, [listing, minRequired]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const isSeller = Boolean(myName.trim()) && namesMatch(listing.sellerName, myName);
  const offers = sortOffersByAmount(listing.offers);
  const chronological = [...listing.offers].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const parsedAmount = parsePriceInput(amount);
  const chips = suggestedAmounts(listing.minPrice, best?.amount ?? null);
  const canBid = listing.status === 'open' && !isSeller;
  const offerError =
    parsedAmount == null || !myName.trim()
      ? null
      : validateOffer(listing, myName, parsedAmount);
  const offerReady = Boolean(myName.trim() && parsedAmount != null && !offerError);
  const deadlineLabel = formatListingDeadline(listing);

  const liveHint = (() => {
    if (parsedAmount == null) return `En az ${formatPrice(listing.minPrice)} girmelisiniz.`;
    if (offerError) return offerError;
    if (latest && namesMatch(latest.bidderName, myName)) {
      return 'Şu an son teklifi siz verdiniz — vardiya saati gelince siz alırsınız.';
    }
    return 'Son teklif veren, vardiya saati gelince satışı alır.';
  })();

  const handleOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const parsed = parsePriceInput(amount);
    if (parsed === null) {
      setError('Geçerli bir tutar girin');
      return;
    }

    const validationError = validateOffer(listing, myName, parsed);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/market/${listing.id}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidderName: myName, amount: parsed, note: note || null }),
      });
      const text = await res.text();
      const json = text ? (JSON.parse(text) as { error?: string; listing?: ShiftMarketListing }) : {};
      if (!res.ok) throw new Error(json.error ?? 'Teklif kaydedilemedi');
      if (!json.listing) throw new Error('Sunucudan geçersiz yanıt alındı');

      onUpdated(json.listing);
      setSuccess(`Teklifiniz alındı: ${formatPrice(parsed)}. Son teklif sizde.`);
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Teklif kaydedilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (offer: ShiftMarketOffer) => {
    if (
      !window.confirm(
        `${offer.bidderName} — ${formatPrice(offer.amount)} teklifini şimdi kabul ediyor musunuz?`
      )
    ) {
      return;
    }

    setAcceptingId(offer.id);
    setError('');
    try {
      const res = await fetch(`/api/market/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id, actorName: myName }),
      });
      const text = await res.text();
      const json = text ? (JSON.parse(text) as { error?: string; listing?: ShiftMarketListing }) : {};
      if (!res.ok) throw new Error(json.error ?? 'Teklif kabul edilemedi');
      if (json.listing) onUpdated(json.listing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Teklif kabul edilemedi');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Bu ilanı panodan kaldırmak istediğinize emin misiniz?')) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/market/${listing.id}?actorName=${encodeURIComponent(myName)}`,
        { method: 'DELETE' }
      );
      const text = await res.text();
      const json = text ? (JSON.parse(text) as { error?: string }) : {};
      if (!res.ok) throw new Error(json.error ?? 'İlan kaldırılamadı');
      onRemoved(listing.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İlan kaldırılamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const minPrice = parsePriceInput(editPrice);
    const validationError = validateListingInput({
      sellerName: myName,
      shiftDate: editDate,
      startTime: listing.startTime,
      minPrice,
      iban: editIban,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/market/${listing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorName: myName,
          shiftDate: editDate,
          slotLabel: editSlot || null,
          startTime: listing.startTime,
          endTime: listing.endTime,
          durationHours: editDuration,
          minPrice,
          iban: editIban,
          note: editNote || null,
        }),
      });
      const text = await res.text();
      const json = text ? (JSON.parse(text) as { error?: string; listing?: ShiftMarketListing }) : {};
      if (!res.ok) throw new Error(json.error ?? 'İlan güncellenemedi');
      if (!json.listing) throw new Error('Sunucudan geçersiz yanıt alındı');

      writeStoredIban(myName, editIban);
      onUpdated(json.listing);
      setEditing(false);
      setSuccess('İlan güncellendi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İlan güncellenemedi');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${listing.sellerName} ilanı`}
      onClick={onClose}
    >
      <div className={styles.offerSheet} onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 border-b border-border/60 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-lg font-bold">{listing.sellerName}</p>
                <span
                  className={cn(
                    'inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black text-white',
                    listing.durationHours === 4 ? 'bg-shift4' : 'bg-shift8'
                  )}
                >
                  {listing.durationHours === 4 ? '4s' : '8s'}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatDateTr(listing.shiftDate)} · {shiftLabel(listing)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted"
              aria-label="Kapat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-canvas/80 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Taban
              </p>
              <p className="mt-1 text-base font-black">{formatPrice(listing.minPrice)}</p>
            </div>
            <div className="rounded-2xl bg-brand/15 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-brand-dark/70">
                Son teklif
              </p>
              <p className="mt-1 truncate text-base font-black text-brand-dark">
                {latest ? formatPrice(latest.amount) : '—'}
              </p>
            </div>
            <div className="rounded-2xl bg-canvas/80 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Kapanış
              </p>
              <p className="mt-1 text-xs font-black leading-snug">{deadlineLabel}</p>
            </div>
          </div>

          {listing.status === 'open' && latest && (
            <p className="mt-3 rounded-xl bg-brand/10 px-3 py-2 text-xs font-semibold text-brand-dark">
              Şu an önde: {latest.bidderName} — süre dolunca vardiya ona geçer.
            </p>
          )}

          <div className="mt-3">
            <IbanCopyRow iban={resolveListingIban(listing)} />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {!editing && listing.note && (
            <p className="flex items-start gap-2 rounded-xl bg-canvas/60 px-4 py-3 text-sm italic text-muted-foreground">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
              {listing.note}
            </p>
          )}

          {listing.status === 'sold' && (
            <p className="rounded-xl bg-shift8-light px-4 py-3 text-sm font-semibold text-shift8-dark">
              Satıldı — {listing.soldToName} · {formatPrice(listing.soldPrice ?? listing.minPrice)}.
              Vardiya çizelgede alıcıya geçer.
            </p>
          )}
          {listing.status === 'cancelled' && (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground">
              Süre doldu, teklif gelmedi — ilan kapandı.
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          {success && (
            <p className="flex items-center gap-2 rounded-xl bg-shift8-light px-4 py-3 text-sm font-medium text-shift8-dark">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {success}
            </p>
          )}

          {isSeller && listing.status === 'open' && editing && (
            <form
              onSubmit={handleSaveEdit}
              noValidate
              className="space-y-4 rounded-2xl border border-brand/30 bg-brand/8 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <Pencil className="h-4 w-4 text-brand-dark" />
                  İlanı düzenle
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError('');
                  }}
                  className="text-xs font-semibold text-muted-foreground underline underline-offset-2"
                >
                  Vazgeç
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Vardiya tarihi
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="input-field bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Süre
                  </label>
                  <select
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value) === 4 ? 4 : 8)}
                    className="input-field bg-white text-sm"
                  >
                    <option value={4}>4 saat</option>
                    <option value={8}>8 saat</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Slot / etiket
                </label>
                <input
                  value={editSlot}
                  onChange={(e) => setEditSlot(e.target.value)}
                  placeholder="Örn: F1 veya 16:30–20:30"
                  className="input-field bg-white text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Taban fiyat (₺)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step="1"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="input-field bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    IBAN
                  </label>
                  <input
                    value={formatIbanDisplay(editIban)}
                    onChange={(e) => setEditIban(normalizeIban(e.target.value))}
                    placeholder={IBAN_PLACEHOLDER}
                    className="input-field bg-white font-mono text-sm tracking-wide"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Not
                </label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={2}
                  placeholder="Kısa açıklama…"
                  className="input-field resize-none bg-white text-sm"
                />
              </div>

              <button type="submit" disabled={savingEdit} className="btn-primary w-full py-3">
                {savingEdit ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Kaydet
              </button>
            </form>
          )}

          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Gavel className="h-4 w-4 text-muted-foreground" />
              Teklifler
              <span className="font-normal text-muted-foreground">({offers.length})</span>
            </p>

            {chronological.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Henüz teklif yok. İlk teklifi siz verin.
              </p>
            ) : (
              <ul className="space-y-2">
                {chronological.map((offer, index) => (
                  <li
                    key={offer.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3',
                      index === 0 && listing.status === 'open'
                        ? 'border-brand/50 bg-brand/10'
                        : 'border-border/60 bg-canvas/40'
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold">{offer.bidderName}</p>
                        {index === 0 && listing.status === 'open' && (
                          <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                            Son
                          </span>
                        )}
                      </div>
                      {offer.note && (
                        <p className="mt-0.5 truncate text-xs italic text-muted-foreground">
                          {offer.note}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black">{formatPrice(offer.amount)}</span>
                      {isSeller && listing.status === 'open' && (
                        <button
                          type="button"
                          onClick={() => handleAccept(offer)}
                          disabled={acceptingId === offer.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-shift8 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-shift8-dark disabled:opacity-50"
                        >
                          {acceptingId === offer.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Şimdi sat
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isSeller && listing.status === 'open' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setError('');
                    setSuccess('');
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm font-semibold text-brand-dark transition hover:bg-brand/20"
                >
                  <Pencil className="h-4 w-4" />
                  Düzenle
                </button>
              )}
              <button
                type="button"
                onClick={handleRemove}
                disabled={loading}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-danger transition hover:bg-red-50 disabled:opacity-50',
                  editing && 'sm:col-span-2'
                )}
              >
                <Trash2 className="h-4 w-4" />
                İlanı panodan kaldır
              </button>
            </div>
          )}
        </div>

        {canBid && (
          <form
            onSubmit={handleOffer}
            noValidate
            className="shrink-0 space-y-3 border-t border-border/70 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Coins className="h-4 w-4 text-muted-foreground" />
                Teklif ver
              </p>
              <p className="text-[11px] font-semibold text-muted-foreground">
                min. {formatPrice(listing.minPrice)}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Teklif veren: <span className="font-semibold text-foreground">{myName}</span>
            </p>

            <div className="flex flex-wrap gap-1.5">
              {chips.map((value) => {
                const active = parsedAmount === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmount(String(value))}
                    className={cn(styles.quickChip, active && styles.quickChipActive)}
                  >
                    {formatPrice(value)}
                  </button>
                );
              })}
            </div>

            <div className={styles.amountField}>
              <span className="text-lg font-bold text-muted-foreground">₺</span>
              <input
                type="number"
                inputMode="decimal"
                min={listing.minPrice}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(listing.minPrice)}
                aria-label="Teklif tutarı"
              />
            </div>

            <p
              className={cn(
                'text-xs font-medium',
                offerReady ? 'text-shift8-dark' : 'text-muted-foreground'
              )}
            >
              {liveHint}
            </p>

            <details>
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline">
                Not ekle (isteğe bağlı)
              </summary>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Kısa bir not…"
                className="input-field mt-2 resize-none bg-canvas/50 text-sm"
              />
            </details>

            <button
              type="submit"
              disabled={loading || !myName.trim()}
              className="btn-primary w-full py-3.5 text-base"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Gavel className="h-4 w-4" />
              )}
              {parsedAmount != null ? `${formatPrice(parsedAmount)} teklif et` : 'Teklif et'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
