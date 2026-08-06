'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Gift,
  History,
  Loader2,
  MessageSquare,
  Store,
  Undo2,
  User,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useDriverIdentity } from '@/components/driver-identity';
import { formatPrice } from '@/lib/market-utils';
import type { ShiftScheduleEntry, ShiftSwap } from '@/lib/types';
import { getShiftVisualKind, shiftAccentHex, shiftKindShortLabel } from '@/lib/shift-styles';
import {
  canGiveShiftOnDate,
  entryToSwapItem,
  filterPartnerShiftsNonConflicting,
  formatHoursTotal,
  isMarketSwap,
  shiftDatesForDriver,
  shiftSummary,
  shiftsForDriver,
  totalSwapHours,
  validateGiveShifts,
} from '@/lib/swap-utils';
import { cn, formatDateTr, formatMonthYear, formatTime, namesMatch } from '@/lib/utils';

interface SwapClientProps {
  driverNames: string[];
  entries: ShiftScheduleEntry[];
  initialSwaps: ShiftSwap[];
  year: number;
  month: number;
}

export function SwapClient({ driverNames, entries: initialEntries, initialSwaps, year, month }: SwapClientProps) {
  const { name: requesterName } = useDriverIdentity();
  const [swaps, setSwaps] = useState(initialSwaps);
  const [entries, setEntries] = useState(initialEntries);
  const [partnerName, setPartnerName] = useState('');
  const [hideConflicts, setHideConflicts] = useState(true);
  const [oneWay, setOneWay] = useState(false);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(new Set());
  const [selectedRequesterIds, setSelectedRequesterIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelErrorById, setCancelErrorById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refreshSchedule = async () => {
    const res = await fetch(`/api/schedule?year=${year}&month=${month}`);
    const json = await res.json();
    if (json.data?.entries) setEntries(json.data.entries);
  };

  const myShifts = useMemo(
    () => (requesterName ? shiftsForDriver(entries, requesterName) : []),
    [entries, requesterName]
  );

  const partnerShiftsAll = useMemo(
    () => (partnerName ? shiftsForDriver(entries, partnerName) : []),
    [entries, partnerName]
  );

  const myDates = useMemo(
    () => (requesterName ? shiftDatesForDriver(entries, requesterName) : new Set<string>()),
    [entries, requesterName]
  );

  const partnerDates = useMemo(
    () => (partnerName ? shiftDatesForDriver(entries, partnerName) : new Set<string>()),
    [entries, partnerName]
  );

  const visiblePartnerShifts = useMemo(
    () => filterPartnerShiftsNonConflicting(partnerShiftsAll, myDates, hideConflicts),
    [partnerShiftsAll, myDates, hideConflicts]
  );

  const giveableMyShifts = myShifts;

  const selectedPartnerShifts = visiblePartnerShifts.filter((s) => selectedPartnerIds.has(s.id));
  const selectedRequesterShifts = giveableMyShifts.filter((s) => selectedRequesterIds.has(s.id));

  const giveHours = totalSwapHours(selectedRequesterShifts.map(entryToSwapItem));
  const takeHours = totalSwapHours(selectedPartnerShifts.map(entryToSwapItem));

  useEffect(() => {
    setSelectedPartnerIds(new Set());
    setSelectedRequesterIds(new Set());
  }, [partnerName, requesterName, hideConflicts, oneWay]);

  useEffect(() => {
    if (oneWay) setSelectedRequesterIds(new Set());
  }, [oneWay]);

  const togglePartner = (id: string) => {
    setSelectedPartnerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRequester = (id: string) => {
    setSelectedRequesterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const giveValidationError = useMemo(
    () =>
      oneWay || selectedRequesterShifts.length === 0
        ? null
        : validateGiveShifts(selectedRequesterShifts, selectedPartnerShifts, partnerDates),
    [oneWay, selectedRequesterShifts, selectedPartnerShifts, partnerDates]
  );

  const canSubmit =
    requesterName.trim() &&
    partnerName.trim() &&
    selectedPartnerShifts.length > 0 &&
    (oneWay || selectedRequesterShifts.length > 0) &&
    !giveValidationError &&
    !namesMatch(requesterName, partnerName);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || selectedPartnerShifts.length === 0) return;

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
          requesterShifts: oneWay
            ? []
            : selectedRequesterShifts.map(entryToSwapItem),
          partnerShifts: selectedPartnerShifts.map(entryToSwapItem),
          note: note || undefined,
          oneWay,
        }),
      });
      const text = await res.text();
      const json = text ? (JSON.parse(text) as { error?: string; swap?: ShiftSwap }) : {};
      if (!res.ok) throw new Error(json.error ?? 'Kayıt başarısız');
      const swap = json.swap;
      if (!swap) throw new Error('Sunucudan geçersiz yanıt alındı');

      setSwaps((prev) => [swap, ...prev]);
      await refreshSchedule();
      setMessage(oneWay ? 'Karşılıksız vardiya alımı kaydedildi!' : 'Vardiya değişimi kaydedildi!');
      setSelectedPartnerIds(new Set());
      setSelectedRequesterIds(new Set());
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCancel = async (id: string) => {
    if (
      !window.confirm(
        'Bu değişim için iptal talebi gönderilsin mi? Admin onayından sonra çizelge eski haline döner.'
      )
    ) {
      return;
    }

    setCancellingId(id);
    setError('');
    setMessage('');
    setCancelErrorById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    try {
      const res = await fetch(`/api/swaps/${id}/cancel-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedBy: requesterName.trim() || undefined,
        }),
      });
      const text = await res.text();
      const json = text ? (JSON.parse(text) as { error?: string; swap?: ShiftSwap }) : {};
      if (!res.ok) throw new Error(json.error ?? 'Talep gönderilemedi');
      if (!json.swap) throw new Error('Sunucudan geçersiz yanıt alındı');

      setSwaps((prev) => prev.map((swap) => (swap.id === id ? json.swap! : swap)));
      setMessage('İptal talebiniz gönderildi. Admin onayı bekleniyor.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Talep gönderilemedi';
      setError(msg);
      setCancelErrorById((prev) => ({ ...prev, [id]: msg }));
    } finally {
      setCancellingId(null);
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
    >
      <div className="animate-slide-up space-y-6">
        <section className="card overflow-visible">
          <div className="border-b border-border/50 bg-gradient-to-br from-brand/8 to-white px-5 py-6 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/20">
                <ArrowLeftRight className="h-6 w-6 text-brand-dark" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Vardiya değişimi</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Toplam saatlerin eşit olması gerekmez (ör. 8s verip 4s almak). Aynı gün takas da
                  mümkün — partnerin o günkü vardiyasını alıp kendi vardiyanızı verebilirsiniz.
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

            {entries.length === 0 && (
              <div className="mb-5 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                Bu ay için yayınlanmış çizelge yok. Değişim kaydı için önce vardiya listesi yüklenmeli.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Ben
                  </label>
                  <div className="input-field flex items-center gap-3 bg-brand/10 font-semibold text-foreground">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/25 text-sm font-black text-brand-dark">
                      {requesterName.charAt(0)}
                    </span>
                    {requesterName}
                  </div>
                </div>
                <PersonSelect
                  label="Değişim partneri"
                  value={partnerName}
                  onChange={setPartnerName}
                  options={driverNames.filter((n) => !requesterName || !namesMatch(n, requesterName))}
                  placeholder="Arkadaşınızı seçin"
                />
              </div>

              {requesterName && partnerName && (
                <>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-canvas/50 px-4 py-3 transition hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={hideConflicts}
                      onChange={(e) => setHideConflicts(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border accent-brand-dark"
                    />
                    <div>
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        Sadece benim vardiyalarımla çakışmayanları göster
                      </span>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Partnerin, sizin zaten vardiyalı olduğunuz günlerdeki kayıtları gizlenir.
                      </p>
                    </div>
                  </label>

                  <MultiShiftPicker
                    title={`${partnerName} — almak istediğim vardiya(lar)`}
                    subtitle={
                      selectedPartnerShifts.length > 0
                        ? `Seçili: ${formatHoursTotal(takeHours)}`
                        : `${visiblePartnerShifts.length} uygun vardiya`
                    }
                    shifts={visiblePartnerShifts}
                    selectedIds={selectedPartnerIds}
                    onToggle={togglePartner}
                    multi
                    emptyMessage={
                      hideConflicts
                        ? 'Çakışmayan vardiya bulunamadı. Filtreyi kapatmayı deneyin.'
                        : 'Bu ay için vardiya kaydı yok.'
                    }
                  />

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 transition hover:bg-brand/10">
                    <input
                      type="checkbox"
                      checked={oneWay}
                      onChange={(e) => setOneWay(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border accent-brand-dark"
                    />
                    <div>
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Gift className="h-4 w-4 text-brand-dark" />
                        Karşılıksız vardiya al (vermeden)
                      </span>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Partnerin vardiyasını alırsınız; karşılığında vardiya vermezsiniz.
                      </p>
                    </div>
                  </label>

                  {!oneWay && (
                    <>
                      <div className="flex items-center justify-center py-1">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/20">
                          <ArrowDown className="h-4 w-4 text-brand-dark" />
                        </div>
                      </div>

                      <MultiShiftPicker
                        title={`${requesterName} — vereceğim vardiya(lar)`}
                        subtitle={
                          selectedRequesterShifts.length > 0
                            ? `Seçili: ${formatHoursTotal(giveHours)} · ${myShifts.length} vardiya`
                            : `${myShifts.length} vardiyanız`
                        }
                        shifts={giveableMyShifts}
                        selectedIds={selectedRequesterIds}
                        onToggle={toggleRequester}
                        getDisabled={(entry) =>
                          canGiveShiftOnDate(entry.shiftDate, partnerDates, selectedPartnerShifts)
                        }
                        multi
                        emptyMessage="Bu ay için vardiya kaydınız yok."
                      />

                      {giveValidationError && (
                        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
                          {giveValidationError}
                        </p>
                      )}
                    </>
                  )}

                  {selectedPartnerShifts.length > 0 && (oneWay || selectedRequesterShifts.length > 0) && (
                    <div className="rounded-2xl border border-border/60 bg-canvas/40 p-4">
                      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Özet
                      </p>
                      {!oneWay && giveHours > 0 && takeHours > 0 && (
                        <HoursBalance give={giveHours} take={takeHours} className="mb-3" />
                      )}
                      <div className={cn('grid gap-3', oneWay ? 'grid-cols-1' : 'sm:grid-cols-2')}>
                        {!oneWay && selectedRequesterShifts.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-shift4-dark">Verilen · {requesterName}</p>
                            {selectedRequesterShifts.map((entry) => (
                              <SummaryCard key={entry.id} entry={entry} name={requesterName} role="verilen" compact />
                            ))}
                          </div>
                        )}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-shift8-dark">
                            Alınan · {partnerName}
                          </p>
                          {selectedPartnerShifts.map((entry) => (
                            <SummaryCard key={entry.id} entry={entry} name={partnerName} role="alınan" compact />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <Field label="Not (isteğe bağlı)" icon={<MessageSquare className="h-4 w-4" />}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Kısa açıklama…"
                  className="input-field resize-none"
                />
              </Field>

              <button type="submit" disabled={loading || !canSubmit} className="btn-primary w-full py-4">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowLeftRight className="h-5 w-5" />
                )}
                {oneWay ? 'Karşılıksız alımı kaydet' : 'Değişimi kaydet'}
              </button>
            </form>
          </div>
        </section>

        <section className="card p-5 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <History className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-bold">Değişim geçmişi</h2>
              <p className="text-xs text-muted-foreground">{swaps.length} kayıt</p>
            </div>
          </div>

          {swaps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              Henüz kayıtlı değişim yok.
            </div>
          ) : (
            <ul className="space-y-4">
              {swaps.map((swap, i) => (
                <SwapHistoryCard
                  key={swap.id}
                  swap={swap}
                  index={i}
                  onRequestCancel={handleRequestCancel}
                  requesting={cancellingId === swap.id}
                  requestError={cancelErrorById[swap.id]}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function PersonSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((n) => n.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <User className="h-4 w-4 text-muted-foreground" />
        {label}
      </label>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            const exact = options.find((n) => n.toLowerCase() === query.trim().toLowerCase());
            if (exact) {
              onChange(exact);
              setQuery(exact);
            }
            setTimeout(() => setOpen(false), 150);
          }}
          placeholder={placeholder}
          required
          className="input-field"
          autoComplete="off"
        />
        {open && filtered.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-[100] mt-2 max-h-56 overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-elevated">
            {filtered.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onMouseDown={() => {
                    onChange(name);
                    setQuery(name);
                    setOpen(false);
                  }}
                  className="flex w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-muted"
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MultiShiftPicker({
  title,
  subtitle,
  shifts,
  selectedIds,
  onToggle,
  emptyMessage,
  multi = true,
  getDisabled,
}: {
  title: string;
  subtitle: string;
  shifts: ShiftScheduleEntry[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  emptyMessage: string;
  multi?: boolean;
  getDisabled?: (entry: ShiftScheduleEntry) => { ok: boolean; reason?: string };
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      {multi && (
        <p className="mb-2 text-xs text-muted-foreground">
          Birden fazla seçmek için listeden işaretleyin.
          {getDisabled && ' Gri günler: partner o tarihte başka vardiyada (önce onun o günkü vardiyasını alın).'}
        </p>
      )}
      {shifts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {shifts.map((entry) => {
            const disabled = getDisabled?.(entry);
            return (
              <ShiftOption
                key={entry.id}
                entry={entry}
                selected={selectedIds.has(entry.id)}
                disabled={disabled?.ok === false}
                disabledHint={
                  disabled?.reason === 'partner_busy'
                    ? 'Partner o gün vardiyalı — önce onun o günkü vardiyasını seçin'
                    : undefined
                }
                onSelect={() => onToggle(entry.id)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function HoursBalance({
  give,
  take,
  className,
}: {
  give: number;
  take: number;
  className?: string;
}) {
  const balanced = give === take;
  return (
    <div
      className={cn(
        'rounded-xl bg-canvas/60 px-4 py-3 text-sm font-medium text-muted-foreground',
        className
      )}
    >
      {balanced ? (
        <span>Toplam: {give}s verilen = {take}s alınan</span>
      ) : (
        <span>
          Toplam: {give}s verilen, {take}s alınan
        </span>
      )}
    </div>
  );
}

function ShiftOption({
  entry,
  selected,
  disabled = false,
  disabledHint,
  onSelect,
}: {
  entry: ShiftScheduleEntry;
  selected: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onSelect: () => void;
}) {
  const kind = getShiftVisualKind(entry.slotLabel, entry.durationHours);
  const accent = shiftAccentHex(kind);
  const code = entry.slotLabel?.split(' ')[0] ?? shiftKindShortLabel(kind);

  return (
    <li>
      <button
        type="button"
        onClick={() => !disabled && onSelect()}
        disabled={disabled}
        title={disabled ? disabledHint : undefined}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
          disabled && 'cursor-not-allowed opacity-50',
          !disabled && selected
            ? 'border-brand bg-brand/10 ring-2 ring-brand/30'
            : !disabled && 'border-border/60 bg-white hover:border-brand/30 hover:bg-muted/30',
          disabled && 'border-border/40 bg-muted/30'
        )}
      >
        <span
          className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{ backgroundColor: accent }}
        >
          {code}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{formatDateTr(entry.shiftDate)}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(entry.startTime)}
            {entry.endTime && ` – ${formatTime(entry.endTime)}`}
            <span className="font-medium">· {shiftSummary(entry)}</span>
          </p>
        </div>
        {selected && (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-dark" />
        )}
      </button>
    </li>
  );
}

function SummaryCard({
  entry,
  name,
  role,
  compact = false,
}: {
  entry: ShiftScheduleEntry;
  name: string;
  role: 'verilen' | 'alınan';
  compact?: boolean;
}) {
  const kind = getShiftVisualKind(entry.slotLabel, entry.durationHours);
  return (
    <div
      className={cn('rounded-xl border bg-white', compact ? 'p-3' : 'p-4')}
      style={{ borderLeftWidth: 3, borderLeftColor: shiftAccentHex(kind) }}
    >
      {!compact && (
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {role === 'verilen' ? 'Verilen' : 'Alınan'} · {name}
        </p>
      )}
      <p className={cn('font-semibold', !compact && 'mt-1')}>{formatDateTr(entry.shiftDate)}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{shiftSummary(entry)}</p>
    </div>
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

function SwapHistoryCard({
  swap,
  index,
  onRequestCancel,
  requesting,
  requestError,
}: {
  swap: ShiftSwap;
  index: number;
  onRequestCancel: (id: string) => void;
  requesting: boolean;
  requestError?: string;
}) {
  const created = new Date(swap.createdAt);
  const dateStr = created.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const fromMarket = isMarketSwap(swap);
  const isOneWay = swap.requesterShifts.length === 0;
  const giveShifts = swap.requesterShifts;
  const takeShifts = swap.partnerShifts;
  const pendingCancel = Boolean(swap.cancelRequestedAt);
  const noteDisplay = swap.note?.replace(/\s·\s#[0-9a-f-]{36}$/i, '') ?? null;
  // Pazar: partner = satıcı, requester = alıcı
  const sellerName = fromMarket ? swap.partnerName : null;
  const buyerName = fromMarket ? swap.requesterName : null;

  return (
    <li
      className={cn(
        'animate-fade-in rounded-2xl border p-5 transition hover:shadow-card',
        fromMarket
          ? 'border-amber-300/80 bg-gradient-to-br from-amber-50/90 to-orange-50/50 hover:border-amber-400'
          : 'border-border/60 bg-canvas/50 hover:border-brand/25'
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {fromMarket ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                <Store className="h-3.5 w-3.5" />
                Pazar
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-bold shadow-sm">
                {sellerName}
              </span>
              <ArrowRight className="h-4 w-4 text-amber-700" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-bold shadow-sm">
                {buyerName}
              </span>
              {swap.soldPrice != null && (
                <span className="rounded-full bg-amber-200/80 px-2.5 py-1 text-xs font-black text-amber-950">
                  {formatPrice(swap.soldPrice)}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-bold shadow-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {swap.requesterName}
              </span>
              {isOneWay ? (
                <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                  Karşılıksız
                </span>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-bold shadow-sm">
                    {swap.partnerName}
                  </span>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <time className="text-xs font-medium text-muted-foreground">{dateStr}</time>
          {pendingCancel ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900"
              title={
                swap.cancelRequestedBy
                  ? `Talep eden: ${swap.cancelRequestedBy}`
                  : 'Admin onayı bekleniyor'
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              İptal talebi gönderildi
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onRequestCancel(swap.id)}
              disabled={requesting}
              className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-white px-2.5 py-1 text-xs font-semibold text-danger transition hover:border-danger/30 hover:bg-red-50 disabled:opacity-50"
            >
              {requesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              {requesting ? 'Gönderiliyor…' : 'İptal talebi gönder'}
            </button>
          )}
        </div>
      </div>

      {fromMarket ? (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-amber-900/70">Satılan vardiya</p>
          {takeShifts.map((item, i) => (
            <HistoryShiftBlock key={`m-${i}`} item={item} variant="take" />
          ))}
          <p className="text-xs text-amber-900/70">
            {sellerName} sattı · {buyerName} aldı
          </p>
        </div>
      ) : (
        <div className={cn('grid gap-3', isOneWay ? 'grid-cols-1' : 'sm:grid-cols-2')}>
          {!isOneWay && giveShifts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase text-shift4-dark/70">Verilen</p>
              {giveShifts.map((item, i) => (
                <HistoryShiftBlock key={`g-${i}`} item={item} variant="give" />
              ))}
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-shift8-dark/70">
              {isOneWay ? `${swap.partnerName}'den alınan` : 'Alınan'}
            </p>
            {takeShifts.map((item, i) => (
              <HistoryShiftBlock key={`t-${i}`} item={item} variant="take" />
            ))}
          </div>
        </div>
      )}

      {noteDisplay && !fromMarket && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm italic text-muted-foreground">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {noteDisplay}
        </p>
      )}

      {requestError && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-danger">
          {requestError}
        </p>
      )}
    </li>
  );
}

function HistoryShiftBlock({
  item,
  variant,
}: {
  item: { date: string; slot: string; hours: 4 | 8 };
  variant: 'give' | 'take';
}) {
  const isGive = variant === 'give';
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        isGive ? 'border-shift4-muted bg-shift4-light/60' : 'border-shift8-muted bg-shift8-light/60'
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        <Calendar className="h-4 w-4" />
        {formatDateTr(item.date)}
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold">
          {item.hours}s
        </span>
      </p>
      {item.slot && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {item.slot}
        </p>
      )}
    </div>
  );
}
