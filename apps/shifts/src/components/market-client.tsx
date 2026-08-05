'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowLeftRight,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Gavel,
  Loader2,
  MessageSquare,
  Plus,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import type {
  ShiftDuration,
  ShiftMarketListing,
  ShiftMarketOffer,
  ShiftScheduleEntry,
} from '@/lib/types';
import {
  formatDateCompactTr,
  formatPrice,
  highestOffer,
  parsePriceInput,
  postitTiltFor,
  postitToneFor,
  shiftLabel,
  shiftsForDriver,
  sortOffersByAmount,
  validateListingInput,
  validateOffer,
} from '@/lib/market-utils';
import { cn, formatDateTr, formatMonthYear, namesMatch } from '@/lib/utils';

const NAME_STORAGE_KEY = 'bisicab-shift-name';

const TONE_CLASS: Record<string, string> = {
  yellow: 'postit-yellow',
  pink: 'postit-pink',
  blue: 'postit-blue',
  green: 'postit-green',
  orange: 'postit-orange',
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
  driverNames,
  entries,
  year,
  month,
}: MarketClientProps) {
  const [listings, setListings] = useState(initialListings);
  const [myName, setMyName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(NAME_STORAGE_KEY);
    if (stored) setMyName(stored);
  }, []);

  const saveMyName = (name: string) => {
    setMyName(name);
    if (name.trim()) localStorage.setItem(NAME_STORAGE_KEY, name.trim());
  };

  const myShifts = useMemo(() => shiftsForDriver(entries, myName), [entries, myName]);

  const openListings = useMemo(
    () => listings.filter((listing) => listing.status === 'open'),
    [listings]
  );

  /** Açık ilanlar önce; satılanlar panonun altında damgalı kalır. */
  const boardListings = useMemo(
    () =>
      [...listings].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      }),
    [listings]
  );

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
    setMessage('İlanınız panoya asıldı.');
    setError('');
  };

  const handleRemoved = (id: string) => {
    setListings((prev) => prev.filter((listing) => listing.id !== id));
    setActiveId(null);
    setMessage('İlan panodan kaldırıldı.');
  };

  return (
    <AppShell
      title={
        <>
          <span className="text-brand">Vardiya</span> Pazarı
        </>
      }
      subtitle={`${formatMonthYear(year, month)} · ${openListings.length} açık ilan`}
      nav={[
        {
          href: '/',
          label: 'Çizelge',
          icon: <Calendar className="h-4 w-4" />,
        },
        {
          href: '/degisim',
          label: 'Değişimler',
          icon: <ArrowLeftRight className="h-4 w-4" />,
        },
      ]}
    >
      <div className="animate-slide-up space-y-6">
        <section className="card overflow-hidden">
          <div className="border-b border-border/50 bg-gradient-to-br from-brand/10 to-white px-5 py-6 sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/20">
                  <Store className="h-6 w-6 text-brand-dark" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Vardiya pazarı</h2>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                    Vardiyanızı bir taban fiyatla panoya asın. Diğer sürücüler kendilerini seçip
                    teklif verir — teklifler taban fiyatın altına düşemez.
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
          </div>

          <div className="space-y-5 p-5 sm:p-8">
            <NamePicker value={myName} onChange={saveMyName} driverNames={driverNames} />

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

        <section className="corkboard rounded-3xl p-4 sm:p-7">
          {boardListings.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-white/40 bg-white/10 py-16 text-center">
              <p className="text-sm font-semibold text-white/90">Panoda henüz ilan yok.</p>
              <p className="mt-1 text-xs text-white/70">
                İlk ilanı siz asın — “İlan ver” butonuna dokunun.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {boardListings.map((listing) => (
                <PostitCard
                  key={listing.id}
                  listing={listing}
                  onOpen={() => setActiveId(listing.id)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {activeListing && (
        <ListingDetail
          listing={activeListing}
          myName={myName}
          driverNames={driverNames}
          onNameChange={saveMyName}
          onClose={() => setActiveId(null)}
          onUpdated={upsertListing}
          onRemoved={handleRemoved}
        />
      )}
    </AppShell>
  );
}

function NamePicker({
  value,
  onChange,
  driverNames,
}: {
  value: string;
  onChange: (name: string) => void;
  driverNames: string[];
}) {
  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/8 p-4">
      <label
        htmlFor="market-my-name"
        className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground"
      >
        <User className="h-4 w-4 text-brand-dark" />
        Ben
        <span className="font-normal text-muted-foreground">
          — ilan ve tekliflerde bu isim kullanılır
        </span>
      </label>
      <input
        id="market-my-name"
        list="market-driver-names"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Adınızı seçin veya yazın"
        className="input-field bg-white"
        autoComplete="off"
      />
      <datalist id="market-driver-names">
        {driverNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
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
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setManual(myShifts.length === 0);
    setSelectedShiftId('');
  }, [myShifts.length, myName]);

  const selectedShift = myShifts.find((shift) => shift.id === selectedShiftId) ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError('');

    const minPrice = parsePriceInput(price);
    const shiftDate = manual ? manualDate : (selectedShift?.shiftDate ?? '');

    const validationError = validateListingInput({ sellerName: myName, shiftDate, minPrice });
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
          startTime: manual ? null : selectedShift?.startTime ?? null,
          endTime: manual ? null : selectedShift?.endTime ?? null,
          durationHours: manual ? manualDuration : selectedShift?.durationHours ?? 8,
          minPrice,
          note: note || null,
        }),
      });

      const text = await res.text();
      const json = text ? (JSON.parse(text) as { error?: string; listing?: ShiftMarketListing }) : {};
      if (!res.ok) throw new Error(json.error ?? 'İlan kaydedilemedi');
      if (!json.listing) throw new Error('Sunucudan geçersiz yanıt alındı');

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
            {myName.trim()
              ? 'Bu ay için çizelgede vardiyanız görünmüyor. “Elle gir” ile ekleyebilirsiniz.'
              : 'Önce yukarıdan adınızı seçin.'}
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
            Teklifler bu tutarın altında olamaz.
          </p>
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
            rows={3}
            placeholder="Kısa açıklama…"
            className="input-field resize-none bg-white"
          />
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        Panoya as
      </button>
    </form>
  );
}

function PostitCard({
  listing,
  onOpen,
}: {
  listing: ShiftMarketListing;
  onOpen: () => void;
}) {
  const tone = TONE_CLASS[postitToneFor(listing.id)] ?? 'postit-yellow';
  const tilt = postitTiltFor(listing.id);
  const best = highestOffer(listing.offers);
  const sold = listing.status === 'sold';

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        style={{ '--tilt': `${tilt}deg` } as CSSProperties}
        className={cn(
          'postit w-full [transform:rotate(var(--tilt))]',
          'hover:[transform:rotate(0deg)_translateY(-4px)]',
          'focus-visible:[transform:rotate(0deg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white',
          tone,
          sold && 'saturate-50'
        )}
      >
        <span className="pushpin" aria-hidden />

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
          {formatPrice(listing.minPrice)}
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-60">
          taban fiyat
        </p>

        <div className="postit-safe mt-3 border-t border-black/10 pt-2 text-[11px] font-semibold leading-tight opacity-80">
          {best ? (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {formatPrice(best.amount)} · {listing.offers.length} teklif
            </span>
          ) : (
            <span>Henüz teklif yok</span>
          )}
        </div>

        {listing.note && (
          <p className="postit-safe mt-2 line-clamp-2 text-[11px] italic leading-tight opacity-70">
            {listing.note}
          </p>
        )}

        {sold && (
          <span className="sold-stamp" aria-hidden>
            <span>Satıldı</span>
          </span>
        )}
      </button>
    </li>
  );
}

function ListingDetail({
  listing,
  myName,
  driverNames,
  onNameChange,
  onClose,
  onUpdated,
  onRemoved,
}: {
  listing: ShiftMarketListing;
  myName: string;
  driverNames: string[];
  onNameChange: (name: string) => void;
  onClose: () => void;
  onUpdated: (listing: ShiftMarketListing) => void;
  onRemoved: (id: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState('');

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
  const best = highestOffer(listing.offers);

  const handleOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
      setAmount('');
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
        `${offer.bidderName} — ${formatPrice(offer.amount)} teklifini kabul ediyor musunuz?`
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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${listing.sellerName} ilanı`}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-elevated sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-border/60 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{listing.sellerName}</p>
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

        <div className="space-y-5 px-5 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-canvas/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Taban fiyat
              </p>
              <p className="mt-1 text-xl font-black">{formatPrice(listing.minPrice)}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-canvas/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                En yüksek teklif
              </p>
              <p className="mt-1 text-xl font-black">
                {best ? formatPrice(best.amount) : '—'}
              </p>
            </div>
          </div>

          {listing.note && (
            <p className="flex items-start gap-2 rounded-xl bg-canvas/60 px-4 py-3 text-sm italic text-muted-foreground">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
              {listing.note}
            </p>
          )}

          {listing.status === 'sold' && (
            <p className="rounded-xl bg-shift8-light px-4 py-3 text-sm font-semibold text-shift8-dark">
              Satıldı — {listing.soldToName} · {formatPrice(listing.soldPrice ?? listing.minPrice)}
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Gavel className="h-4 w-4 text-muted-foreground" />
              Teklifler
              <span className="font-normal text-muted-foreground">({offers.length})</span>
            </p>

            {offers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Henüz teklif yok.
              </p>
            ) : (
              <ul className="space-y-2">
                {offers.map((offer, index) => (
                  <li
                    key={offer.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3',
                      index === 0
                        ? 'border-brand/50 bg-brand/10'
                        : 'border-border/60 bg-canvas/40'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{offer.bidderName}</p>
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
                          Kabul
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {listing.status === 'open' && !isSeller && (
            <form
              onSubmit={handleOffer}
              noValidate
              className="space-y-3 rounded-2xl border border-border/70 bg-canvas/40 p-4"
            >
              <p className="flex items-center gap-2 text-sm font-bold">
                <Coins className="h-4 w-4 text-muted-foreground" />
                Teklif ver
              </p>

              <div>
                <label
                  htmlFor="offer-name"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  Ben
                </label>
                <input
                  id="offer-name"
                  list="market-offer-names"
                  value={myName}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Adınızı seçin"
                  className="input-field bg-white"
                  autoComplete="off"
                />
                <datalist id="market-offer-names">
                  {driverNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label
                  htmlFor="offer-amount"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  Tutar (₺) — en az {formatPrice(listing.minPrice)}
                </label>
                <input
                  id="offer-amount"
                  type="number"
                  inputMode="decimal"
                  min={listing.minPrice}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={String(listing.minPrice)}
                  className="input-field bg-white"
                />
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Not (isteğe bağlı)…"
                className="input-field resize-none bg-white text-sm"
              />

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Gavel className="h-4 w-4" />
                )}
                Teklifi gönder
              </button>
            </form>
          )}

          {isSeller && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-danger transition hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              İlanı panodan kaldır
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
