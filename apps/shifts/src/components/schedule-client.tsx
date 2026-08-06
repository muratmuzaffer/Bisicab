'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock,
  FileText,
  LayoutGrid,
  List,
  Search,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useDriverIdentity } from '@/components/driver-identity';
import { MonthNavigator } from '@/components/month-navigator';
import type { ScheduleData, ShiftScheduleEntry, ViewMode } from '@/lib/types';
import {
  getShiftVisualKind,
  shiftAccentHex,
  shiftKindLabel,
  shiftKindShortLabel,
  SHIFT_KIND_ORDER,
  type ShiftVisualKind,
} from '@/lib/shift-styles';
import {
  cn,
  DAY_NAMES_TR,
  durationDescription,
  durationLabel,
  formatDateTr,
  formatMonthYear,
  formatTime,
  getDaysInMonth,
  isToday,
  namesMatch,
  toIsoDate,
} from '@/lib/utils';

interface ScheduleClientProps {
  initialData: ScheduleData | null;
  availableMonths: Array<{ year: number; month: number }>;
  initialYear: number;
  initialMonth: number;
}

export function ScheduleClient({
  initialData,
  availableMonths,
  initialYear,
  initialMonth,
}: ScheduleClientProps) {
  const { name: myName } = useDriverIdentity();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('calendar');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule?year=${y}&month=${m}`);
      const json = await res.json();
      setData(json.data);
      setYear(y);
      setMonth(m);
    } finally {
      setLoading(false);
    }
  }, []);

  const navigateMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    loadMonth(newYear, newMonth);
  };

  const driverNames = useMemo(() => {
    if (!data) return [];
    const names = new Set(data.entries.map((e) => e.driverName));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [data]);

  const suggestions = useMemo(() => {
    if (!search.trim()) return driverNames;
    const q = search.toLowerCase();
    return driverNames.filter((n) => n.toLowerCase().includes(q));
  }, [search, driverNames]);

  /** Arama doluysa o sürücü; yoksa girişte seçilen isim. */
  const activeName = search.trim() || myName;

  const myShifts = useMemo(() => {
    if (!data || !activeName) return [];
    return data.entries
      .filter((e) => namesMatch(e.driverName, activeName))
      .sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));
  }, [data, activeName]);

  const stats = useMemo(() => {
    if (!data) return null;
    const shifts4 = data.entries.filter((e) => e.durationHours === 4).length;
    const shifts8 = data.entries.filter((e) => e.durationHours === 8).length;
    return {
      drivers: driverNames.length,
      total: data.entries.length,
      shifts4,
      shifts8,
      mine: myShifts.length,
    };
  }, [data, driverNames.length, myShifts.length]);

  const pickLookupName = (name: string) => {
    setSearch(name);
    setShowSuggestions(false);
  };

  const clearLookup = () => {
    setSearch('');
  };

  const entriesByDate = useMemo(() => {
    if (!data) return new Map<string, ShiftScheduleEntry[]>();
    const map = new Map<string, ShiftScheduleEntry[]>();
    data.entries.forEach((e) => {
      const list = map.get(e.shiftDate) ?? [];
      list.push(e);
      map.set(e.shiftDate, list);
    });
    return map;
  }, [data]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = new Date(year, month - 1, 1).getDay();
  const calendarCells: Array<{ day: number | null; date: string | null }> = [];
  for (let i = 0; i < firstDow; i++) calendarCells.push({ day: null, date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push({ day: d, date: toIsoDate(year, month, d) });
  }

  const monthNav = (
    <MonthNavigator
      label={formatMonthYear(year, month)}
      onPrev={() => navigateMonth(-1)}
      onNext={() => navigateMonth(1)}
    />
  );

  return (
    <AppShell
      title={
        <>
          <span className="text-brand">Bisi</span>Cab Vardiya
        </>
      }
      subtitle="Sürücü mesai çizelgesi"
      actions={monthNav}
    >
      {/* Hero */}
      <section className="animate-slide-up mb-8">
        <div className="card">
          <div className="relative overflow-visible border-b border-border/50 bg-gradient-to-br from-brand/8 via-white to-shift4-light/30 px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-md">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-dark">
                  <Sparkles className="h-3.5 w-3.5" />
                  Kişisel görünüm
                </div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {myName ? (
                    <>
                      Merhaba {myName},
                      <br />
                      <span className="text-muted-foreground">vardiyaların burada</span>
                    </>
                  ) : (
                    <>
                      Vardiya çizelgesi
                      <br />
                      <span className="text-muted-foreground">günleriniz vurgulanır</span>
                    </>
                  )}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Takvimde sizin günleriniz vurgulanır. İsterseniz başka bir sürücüyü de arayabilirsiniz.
                </p>
              </div>

              <div className="relative z-20 w-full lg:max-w-md">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="name-search"
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Başka sürücü ara…"
                  className="input-field pl-12 pr-12 shadow-inset"
                  autoComplete="off"
                />
                {search && (
                  <button
                    type="button"
                    onClick={clearLookup}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-muted"
                    aria-label="Temizle"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-[100] mt-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-elevated">
                    {suggestions.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onMouseDown={() => pickLookupName(name)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-muted"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand-dark">
                            {name.charAt(0)}
                          </span>
                          <span className="font-medium">{name}</span>
                          {myName && namesMatch(name, myName) && (
                            <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                              Sen
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Legend + stats */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <div className="flex flex-wrap gap-3">
              <LegendChip kind="standard8" label="B1 · 12:30–20:30" />
              <LegendChip kind="standard4" label="F1 · 16:30–20:30" />
              <LegendChip kind="slotS" label="S · 08:00–16:00" />
              <LegendChip kind="slotD" label="D · 09:30–17:30" />
              <LegendChip kind="slotB" label="B · 12:00–16:00" />
              <LegendChip kind="slotO" label="O · 13:30–17:30" />
              <LegendChip kind="slotSStar" label="S* · Bayram" />
              <LegendChip kind="slotBStar" label="B* · Bayram" />
            </div>
            {stats && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="stat-pill">
                  <Users className="h-3.5 w-3.5" />
                  {stats.drivers} sürücü
                </span>
                <span className="stat-pill">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {stats.total} vardiya
                </span>
                {activeName && stats.mine > 0 && (
                  <span className="stat-pill bg-brand/15 text-brand-dark">
                    <User className="h-3.5 w-3.5" />
                    {stats.mine} sizin
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {loading && (
        <div className="card flex items-center justify-center gap-3 p-12 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          Çizelge yükleniyor…
        </div>
      )}

      {!loading && !data && (
        <div className="card p-12 text-center animate-fade-in">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h2 className="text-xl font-bold">{formatMonthYear(year, month)} için çizelge yok</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Bu ayın vardiya çizelgesi henüz yayınlanmadı. Başka bir ay seçebilirsiniz.
          </p>
          {availableMonths.length > 0 && (
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {availableMonths.map(({ year: y, month: m }) => (
                <button
                  key={`${y}-${m}`}
                  type="button"
                  onClick={() => loadMonth(y, m)}
                  className="btn-primary"
                >
                  {formatMonthYear(y, m)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && data && (
        <div className="animate-fade-in space-y-6">
          {/* My shifts */}
          {activeName && (
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Sizin vardiyalarınız</h2>
                  <p className="text-sm text-muted-foreground">{activeName}</p>
                </div>
                {myShifts.length > 0 && (
                  <span className="rounded-full bg-brand/15 px-3 py-1 text-sm font-bold text-brand-dark">
                    {myShifts.length} gün
                  </span>
                )}
              </div>

              {myShifts.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
                  {myShifts.map((shift) => (
                    <div key={shift.id} className="min-w-[240px] sm:min-w-0">
                      <ShiftCard shift={shift} highlighted />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card border-dashed p-6 text-center text-sm text-muted-foreground">
                  Bu ay için kayıtlı vardiya bulunamadı. Adınızı veya ayı kontrol edin.
                </div>
              )}
            </section>
          )}

          {/* View switcher */}
          <div className="flex gap-1 rounded-2xl bg-white p-1.5 shadow-card">
            {([
              { id: 'calendar' as const, label: 'Takvim', icon: LayoutGrid },
              { id: 'list' as const, label: 'Liste', icon: List },
              ...(data.month.pdfUrl
                ? [{ id: 'pdf' as const, label: 'PDF', icon: FileText }]
                : []),
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition',
                  view === id
                    ? 'bg-brand-dark text-brand shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {view === 'calendar' && (
            <CalendarView
              cells={calendarCells}
              entriesByDate={entriesByDate}
              activeName={activeName}
              year={year}
              month={month}
              myShiftDates={myShifts.map((s) => s.shiftDate)}
            />
          )}

          {view === 'list' && (
            <ListView entries={data.entries} activeName={activeName} />
          )}

          {view === 'pdf' && data.month.pdfUrl && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <p className="text-sm font-semibold">Orijinal PDF</p>
                <a
                  href={data.month.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-shift4-dark hover:underline"
                >
                  Yeni sekmede aç →
                </a>
              </div>
              <iframe
                src={data.month.pdfUrl}
                title="Vardiya PDF"
                className="h-[75vh] w-full bg-muted"
              />
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function legendClasses(kind: ShiftVisualKind): string {
  switch (kind) {
    case 'standard4':
      return 'bg-shift4-muted text-shift4-dark';
    case 'standard8':
      return 'bg-shift8-muted text-shift8-dark';
    case 'slotS':
      return 'bg-shiftS-muted text-shiftS-dark';
    case 'slotD':
      return 'bg-shiftD-muted text-shiftD-dark';
    case 'slotB':
      return 'bg-shiftB-muted text-shiftB-dark';
    case 'slotO':
      return 'bg-shiftO-muted text-shiftO-dark';
    case 'slotSStar':
      return 'bg-shiftSStar-muted text-shiftSStar-dark';
    case 'slotBStar':
      return 'bg-shiftBStar-muted text-shiftBStar-dark';
  }
}

function accentClasses(kind: ShiftVisualKind): string {
  switch (kind) {
    case 'standard4':
      return 'bg-shift4';
    case 'standard8':
      return 'bg-shift8';
    case 'slotS':
      return 'bg-shiftS';
    case 'slotD':
      return 'bg-shiftD';
    case 'slotB':
      return 'bg-shiftB';
    case 'slotO':
      return 'bg-shiftO';
    case 'slotSStar':
      return 'bg-shiftSStar';
    case 'slotBStar':
      return 'bg-shiftBStar';
  }
}

function surfaceClasses(kind: ShiftVisualKind, highlighted = false): string {
  switch (kind) {
    case 'standard4':
      return highlighted ? 'border-shift4-muted bg-shift4-light/70' : 'border-shift4-muted/60 bg-shift4-light/40';
    case 'standard8':
      return highlighted ? 'border-shift8-muted bg-shift8-light/70' : 'border-shift8-muted/60 bg-shift8-light/40';
    case 'slotS':
      return highlighted ? 'border-shiftS-muted bg-shiftS-light/80' : 'border-shiftS-muted/60 bg-shiftS-light/50';
    case 'slotD':
      return highlighted ? 'border-shiftD-muted bg-shiftD-light/80' : 'border-shiftD-muted/60 bg-shiftD-light/50';
    case 'slotB':
      return highlighted ? 'border-shiftB-muted bg-shiftB-light/80' : 'border-shiftB-muted/60 bg-shiftB-light/50';
    case 'slotO':
      return highlighted ? 'border-shiftO-muted bg-shiftO-light/80' : 'border-shiftO-muted/60 bg-shiftO-light/50';
    case 'slotSStar':
      return highlighted ? 'border-shiftSStar-muted bg-shiftSStar-light/80' : 'border-shiftSStar-muted/60 bg-shiftSStar-light/50';
    case 'slotBStar':
      return highlighted ? 'border-shiftBStar-muted bg-shiftBStar-light/80' : 'border-shiftBStar-muted/60 bg-shiftBStar-light/50';
  }
}

function LegendChip({ kind, label }: { kind: ShiftVisualKind; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span
        className={cn(
          'inline-flex h-7 min-w-[2rem] items-center justify-center rounded-lg px-2 text-[11px] font-bold',
          legendClasses(kind)
        )}
      >
        {shiftKindShortLabel(kind)}
      </span>
      {label}
    </span>
  );
}

function ShiftBadge({
  entry,
  size = 'sm',
}: {
  entry: Pick<ShiftScheduleEntry, 'durationHours' | 'slotLabel'>;
  size?: 'sm' | 'md';
}) {
  const kind = getShiftVisualKind(entry.slotLabel, entry.durationHours);
  const slotCode = entry.slotLabel?.split(' ')[0] ?? durationLabel(entry.durationHours);

  return (
    <span
      className={cn(
        'inline-flex items-center font-bold',
        size === 'md' ? 'rounded-lg px-2.5 py-1 text-xs' : 'rounded-md px-2 py-0.5 text-[10px]',
        legendClasses(kind)
      )}
      title={entry.slotLabel ?? shiftKindLabel(kind)}
    >
      {slotCode}
    </span>
  );
}

function ShiftCard({
  shift,
  highlighted = false,
}: {
  shift: ShiftScheduleEntry;
  highlighted?: boolean;
}) {
  const today = isToday(shift.shiftDate);
  const kind = getShiftVisualKind(shift.slotLabel, shift.durationHours);

  return (
    <article
      className={cn(
        'card relative overflow-hidden p-5 transition hover:shadow-elevated',
        highlighted && 'border-brand/30 ring-1 ring-brand/20',
        today && 'ring-2 ring-brand/40',
        surfaceClasses(kind, highlighted)
      )}
    >
      <div className={cn('absolute left-0 top-0 h-full w-1', accentClasses(kind))} />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div>
          <p className="text-lg font-bold leading-tight">{formatDateTr(shift.shiftDate)}</p>
          {!highlighted && (
            <p className="mt-1 text-sm text-muted-foreground">{shift.driverName}</p>
          )}
          {shift.slotLabel && (
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{shift.slotLabel}</p>
          )}
        </div>
        <ShiftBadge entry={shift} size="md" />
      </div>
      {(shift.startTime || shift.endTime) && (
        <p className="mt-3 flex items-center gap-2 pl-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="font-medium text-foreground">
            {formatTime(shift.startTime)}
            {shift.endTime && ` – ${formatTime(shift.endTime)}`}
          </span>
          <span className="text-xs">({durationDescription(shift.durationHours)})</span>
        </p>
      )}
      {today && (
        <span className="mt-3 ml-2 inline-flex items-center rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark">
          Bugün
        </span>
      )}
    </article>
  );
}

function CalendarView({
  cells,
  entriesByDate,
  activeName,
  year,
  month,
  myShiftDates,
}: {
  cells: Array<{ day: number | null; date: string | null }>;
  entriesByDate: Map<string, ShiftScheduleEntry[]>;
  activeName: string;
  year: number;
  month: number;
  myShiftDates: string[];
}) {
  const pickDefaultDate = useCallback((): string | null => {
    const now = new Date();
    if (now.getFullYear() === year && now.getMonth() + 1 === month) {
      const today = toIsoDate(year, month, now.getDate());
      if ((entriesByDate.get(today)?.length ?? 0) > 0) return today;
    }
    if (activeName && myShiftDates.length > 0) return myShiftDates[0]!;
    for (const cell of cells) {
      if (cell.date && (entriesByDate.get(cell.date)?.length ?? 0) > 0) return cell.date;
    }
    return null;
  }, [activeName, cells, entriesByDate, month, myShiftDates, year]);

  const [selectedDate, setSelectedDate] = useState<string | null>(pickDefaultDate);

  useEffect(() => {
    setSelectedDate(pickDefaultDate());
  }, [pickDefaultDate]);

  const selectedEntries = selectedDate ? entriesByDate.get(selectedDate) ?? [] : [];
  const selectedDayNum = selectedDate
    ? parseInt(selectedDate.split('-')[2]!, 10)
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
      {/* Month grid */}
      <div className="card overflow-hidden p-3 sm:p-4">
        <div className="mb-3 grid grid-cols-7 gap-1">
          {DAY_NAMES_TR.map((d, i) => (
            <div
              key={d}
              className={cn(
                'py-1 text-center text-[10px] font-bold uppercase tracking-wide sm:text-xs',
                i === 0 ? 'text-shift4-dark/70' : i === 6 ? 'text-shift8-dark/70' : 'text-muted-foreground'
              )}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {cells.map((cell, idx) => {
            if (!cell.day || !cell.date) {
              return <div key={`empty-${idx}`} className="aspect-square" aria-hidden />;
            }

            const entries = entriesByDate.get(cell.date) ?? [];
            const today = isToday(cell.date);
            const isSelected = selectedDate === cell.date;
            const hasMine = activeName && entries.some((e) => namesMatch(e.driverName, activeName));
            const kindCounts = entries.reduce(
              (acc, e) => {
                const k = getShiftVisualKind(e.slotLabel, e.durationHours);
                acc[k] = (acc[k] ?? 0) + 1;
                return acc;
              },
              {} as Partial<Record<ShiftVisualKind, number>>
            );
            const dotKinds = SHIFT_KIND_ORDER.filter((k) => (kindCounts[k] ?? 0) > 0);
            const dow = new Date(cell.date + 'T12:00:00').getDay();
            const isWeekend = dow === 0 || dow === 6;

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => setSelectedDate(cell.date)}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-start rounded-xl p-1 transition sm:rounded-2xl sm:p-1.5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                  entries.length === 0
                    ? 'bg-canvas/80 hover:bg-muted/60'
                    : 'bg-white hover:bg-muted/30 shadow-sm',
                  isWeekend && entries.length > 0 && 'bg-canvas/40',
                  isSelected && 'ring-2 ring-brand-dark ring-offset-1',
                  hasMine && !isSelected && 'bg-brand/10',
                  today && !isSelected && 'ring-1 ring-brand/40'
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:h-7 sm:w-7 sm:text-sm',
                    today && 'bg-brand text-brand-dark',
                    isSelected && !today && 'bg-brand-dark text-brand',
                    !today && !isSelected && 'text-foreground'
                  )}
                >
                  {cell.day}
                </span>

                {entries.length > 0 && (
                  <div className="mt-auto flex w-full flex-col items-center gap-0.5 pb-0.5">
                    <div className="flex max-w-full flex-wrap items-center justify-center gap-0.5">
                      {dotKinds.map((k) => (
                        <span
                          key={k}
                          className={cn('h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2', accentClasses(k))}
                          title={`${kindCounts[k]}× ${shiftKindShortLabel(k)}`}
                        />
                      ))}
                      {hasMine && (
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-dark sm:h-2 sm:w-2" title="Sizin vardiyanız" />
                      )}
                    </div>
                    <span className="hidden text-[9px] font-semibold text-muted-foreground sm:block">
                      {entries.length}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          {SHIFT_KIND_ORDER.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', accentClasses(k))} />
              {shiftKindShortLabel(k)}
              {k === 'standard8' && ' · B1'}
              {k === 'standard4' && ' · F1'}
              {k === 'slotS' && ' · 08:00–16:00'}
              {k === 'slotD' && ' · 09:30–17:30'}
              {k === 'slotB' && ' · 12:00–16:00'}
              {k === 'slotO' && ' · 13:30–17:30'}
              {k === 'slotSStar' && ' · Bayram'}
              {k === 'slotBStar' && ' · Bayram'}
            </span>
          ))}
          {activeName && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-dark" /> Sizin gününüz
            </span>
          )}
          <span className="ml-auto hidden sm:inline">Gün seçerek detayları görün</span>
        </div>
      </div>

      {/* Day detail panel */}
      <div className="card overflow-hidden lg:sticky lg:top-24">
        {selectedDate && selectedDayNum ? (
          <>
            <div
              className={cn(
                'border-b border-border/60 px-4 py-4 sm:px-5',
                isToday(selectedDate) ? 'bg-brand/10' : 'bg-muted/30'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl',
                    isToday(selectedDate) ? 'bg-brand text-brand-dark shadow-glow' : 'bg-white shadow-sm'
                  )}
                >
                  <span className="text-2xl font-bold leading-none">{selectedDayNum}</span>
                  <span className="mt-0.5 text-[10px] font-bold uppercase">
                    {DAY_NAMES_TR[new Date(selectedDate + 'T12:00:00').getDay()]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold leading-tight">{formatDateTr(selectedDate)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{daySummary(selectedEntries)}</p>
                  {isToday(selectedDate) && (
                    <span className="mt-2 inline-block rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                      BUGÜN
                    </span>
                  )}
                </div>
              </div>
            </div>

            {selectedEntries.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Bu tarihte kayıtlı vardiya bulunmuyor.
              </p>
            ) : (
              <div className="max-h-[420px] overflow-y-auto p-3 sm:p-4">
                <DayShiftGroups entries={selectedEntries} activeName={activeName} />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium">Bir gün seçin</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Takvimden bir güne dokunarak o günkü vardiyaları görün.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function daySummary(entries: ShiftScheduleEntry[]): string {
  if (entries.length === 0) return 'Bu gün vardiya yok';
  const kinds = entries.reduce(
    (acc, e) => {
      const k = getShiftVisualKind(e.slotLabel, e.durationHours);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<ShiftVisualKind, number>>
  );
  const parts: string[] = [`${entries.length} sürücü`];
  for (const k of SHIFT_KIND_ORDER) {
    const n = kinds[k];
    if (n) parts.push(`${n}×${shiftKindShortLabel(k)}`);
  }
  return parts.join(' · ');
}

function DayShiftGroups({
  entries,
  activeName,
}: {
  entries: ShiftScheduleEntry[];
  activeName: string;
}) {
  const sorted = [...entries].sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

  const groups = SHIFT_KIND_ORDER.map((kind) => ({ kind, entries: [] as ShiftScheduleEntry[] }));

  for (const entry of sorted) {
    const kind = getShiftVisualKind(entry.slotLabel, entry.durationHours);
    groups.find((g) => g.kind === kind)!.entries.push(entry);
  }

  const groupLabels: Record<ShiftVisualKind, string> = {
    slotSStar: 'S* · Bayram vardiyası',
    slotBStar: 'B* · Bayram vardiyası',
    slotS: 'S vardiyası · 08:00–16:00',
    slotD: 'D vardiyası · 09:30–17:30',
    slotB: 'B vardiyası · 12:00–16:00',
    slotO: 'O vardiyası · 13:30–17:30',
    standard8: 'B1 · 12:30–20:30',
    standard4: 'F1 · 16:30–20:30',
  };

  return (
    <div className="space-y-4">
      {groups
        .filter((g) => g.entries.length > 0)
        .map((g) => (
          <ShiftKindGroup
            key={g.kind}
            kind={g.kind}
            label={groupLabels[g.kind]}
            entries={g.entries}
            activeName={activeName}
          />
        ))}
    </div>
  );
}

function ShiftKindGroup({
  kind,
  label,
  entries,
  activeName,
}: {
  kind: ShiftVisualKind;
  label: string;
  entries: ShiftScheduleEntry[];
  activeName: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn('h-2 w-2 rounded-full', accentClasses(kind))} />
        <span className={cn('text-xs font-bold uppercase tracking-wide', legendClasses(kind).split(' ').slice(1).join(' '))}>
          {label}
        </span>
        <span className="text-xs text-muted-foreground">({entries.length})</span>
      </div>
      <ul className="space-y-2">
        {entries.map((e) => {
          const isMine = activeName && namesMatch(e.driverName, activeName);
          return (
            <li
              key={e.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-l-[3px] px-3 py-2.5 transition',
                isMine ? 'border-brand/40 bg-brand/10 shadow-sm' : 'border-border/50 bg-white'
              )}
              style={{ borderLeftColor: shiftAccentHex(kind) }}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  isMine ? 'bg-brand text-brand-dark' : legendClasses(kind)
                )}
              >
                {e.driverName.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {e.driverName}
                  {isMine && <span className="ml-1.5 text-xs font-bold text-brand-dark">· Siz</span>}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatTime(e.startTime)}
                  {e.endTime && ` – ${formatTime(e.endTime)}`}
                  {e.slotLabel && <span className="ml-1 font-medium">· {e.slotLabel}</span>}
                </p>
              </div>
              <ShiftBadge entry={e} size="md" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ListView({
  entries,
  activeName,
}: {
  entries: ShiftScheduleEntry[];
  activeName: string;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, ShiftScheduleEntry[]>();
    entries.forEach((e) => {
      const list = map.get(e.shiftDate) ?? [];
      list.push(e);
      map.set(e.shiftDate, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  const filteredGroups = useMemo(() => {
    if (!activeName) return grouped;
    return grouped
      .map(([date, dayEntries]) => [
        date,
        dayEntries.filter((e) => namesMatch(e.driverName, activeName)),
      ] as const)
      .filter(([, dayEntries]) => dayEntries.length > 0);
  }, [grouped, activeName]);

  const displayGroups = activeName ? filteredGroups : grouped;

  return (
    <div className="space-y-4">
      {activeName && filteredGroups.length === 0 && (
        <div className="card border-dashed p-6 text-center text-sm text-muted-foreground">
          {activeName} için bu ayda vardiya kaydı yok.
        </div>
      )}

      {displayGroups.map(([date, dayEntries]) => (
        <section key={date} className="card overflow-hidden">
          <div
            className={cn(
              'flex items-center gap-3 border-b border-border px-5 py-4',
              isToday(date) && 'bg-brand/5'
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-center',
                isToday(date) ? 'bg-brand text-brand-dark' : 'bg-muted'
              )}
            >
              <span className="text-lg font-bold leading-none">
                {new Date(date + 'T12:00:00').getDate()}
              </span>
            </div>
            <div>
              <h3 className="font-bold">{formatDateTr(date)}</h3>
              <p className="text-xs text-muted-foreground">{daySummary(dayEntries)}</p>
            </div>
            {isToday(date) && (
              <span className="ml-auto rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold text-brand-dark">
                BUGÜN
              </span>
            )}
          </div>

          <div className="divide-y divide-border/60">
            {dayEntries
              .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
              .map((e) => {
                const isMine = activeName && namesMatch(e.driverName, activeName);
                const kind = getShiftVisualKind(e.slotLabel, e.durationHours);
                return (
                  <div
                    key={e.id}
                    className={cn(
                      'flex items-center gap-4 px-5 py-4 transition hover:bg-muted/40',
                      isMine && 'bg-brand/5'
                    )}
                  >
                    <div className={cn('h-10 w-1 shrink-0 rounded-full', accentClasses(kind))} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {e.driverName}
                        {isMine && (
                          <span className="ml-2 text-xs font-bold text-brand-dark">(Siz)</span>
                        )}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(e.startTime)}
                        {e.endTime && ` – ${formatTime(e.endTime)}`}
                        {e.slotLabel && <span className="text-xs font-medium">· {e.slotLabel}</span>}
                      </p>
                    </div>
                    <ShiftBadge entry={e} size="md" />
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
