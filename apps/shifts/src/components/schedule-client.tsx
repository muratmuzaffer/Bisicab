'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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
import type { ScheduleData, ShiftScheduleEntry, ViewMode } from '@/lib/types';
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

const STORAGE_KEY = 'bisicab-shift-name';

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
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [savedName, setSavedName] = useState('');
  const [view, setView] = useState<ViewMode>('calendar');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSavedName(stored);
      setSearch(stored);
    }
  }, []);

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
    if (!search.trim()) return driverNames.slice(0, 8);
    const q = search.toLowerCase();
    return driverNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 8);
  }, [search, driverNames]);

  const activeName = search.trim() || savedName;

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

  const saveMyName = (name: string) => {
    setSearch(name);
    setSavedName(name);
    localStorage.setItem(STORAGE_KEY, name);
    setShowSuggestions(false);
  };

  const clearName = () => {
    setSearch('');
    setSavedName('');
    localStorage.removeItem(STORAGE_KEY);
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
    <div className="flex items-center rounded-xl bg-white/8 p-1">
      <button
        type="button"
        onClick={() => navigateMonth(-1)}
        className="rounded-lg p-2 text-white/80 transition hover:bg-white/12 hover:text-white"
        aria-label="Önceki ay"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="min-w-[7.5rem] px-2 text-center text-sm font-bold text-white">
        {formatMonthYear(year, month)}
      </span>
      <button
        type="button"
        onClick={() => navigateMonth(1)}
        className="rounded-lg p-2 text-white/80 transition hover:bg-white/12 hover:text-white"
        aria-label="Sonraki ay"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );

  return (
    <AppShell
      title={
        <>
          <span className="text-brand">Bisi</span>Cab Vardiya
        </>
      }
      subtitle="Sürücü mesai çizelgesi"
      nav={[
        {
          href: '/degisim',
          label: 'Değişimler',
          icon: <ArrowLeftRight className="h-4 w-4" />,
        },
      ]}
      actions={monthNav}
    >
      {/* Hero search */}
      <section className="animate-slide-up mb-8">
        <div className="card overflow-hidden">
          <div className="border-b border-border/50 bg-gradient-to-br from-brand/8 via-white to-shift4-light/30 px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-md">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-dark">
                  <Sparkles className="h-3.5 w-3.5" />
                  Kişisel görünüm
                </div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Adınızı yazın,
                  <br />
                  <span className="text-muted-foreground">vardiyalarınızı görün</span>
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Takvimde sizin günleriniz vurgulanır; sadece kendi vardiyalarınızı listelemeniz de mümkün.
                </p>
              </div>

              <div className="relative w-full lg:max-w-md">
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
                  placeholder="Sürücü adı ara…"
                  className="input-field pl-12 pr-12 shadow-inset"
                  autoComplete="off"
                />
                {activeName && (
                  <button
                    type="button"
                    onClick={clearName}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-muted"
                    aria-label="Temizle"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-elevated">
                    {suggestions.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onMouseDown={() => saveMyName(name)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-muted"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand-dark">
                            {name.charAt(0)}
                          </span>
                          <span className="font-medium">{name}</span>
                          {savedName && namesMatch(name, savedName) && (
                            <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                              Kayıtlı
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
              <LegendChip hours={4} label="4 saat · F1 (16:30–20:30)" />
              <LegendChip hours={8} label="8 saat · B1 (12:30–20:30)" />
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

function LegendChip({ hours, label }: { hours: 4 | 8; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span
        className={cn(
          'inline-flex h-7 min-w-[2rem] items-center justify-center rounded-lg px-2 text-[11px] font-bold',
          hours === 4 ? 'bg-shift4-muted text-shift4-dark' : 'bg-shift8-muted text-shift8-dark'
        )}
      >
        {durationLabel(hours)}
      </span>
      {label}
    </span>
  );
}

function ShiftBadge({ hours, size = 'sm' }: { hours: 4 | 8; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-bold',
        size === 'md' ? 'rounded-lg px-2.5 py-1 text-xs' : 'rounded-md px-2 py-0.5 text-[10px]',
        hours === 4 ? 'bg-shift4-muted text-shift4-dark' : 'bg-shift8-muted text-shift8-dark'
      )}
    >
      {durationLabel(hours)}
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
  const hours = shift.durationHours;

  return (
    <article
      className={cn(
        'card relative overflow-hidden p-5 transition hover:shadow-elevated',
        highlighted && 'border-brand/30 ring-1 ring-brand/20',
        today && 'ring-2 ring-brand/40'
      )}
    >
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-1',
          hours === 4 ? 'bg-shift4' : 'bg-shift8'
        )}
      />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div>
          <p className="text-lg font-bold leading-tight">{formatDateTr(shift.shiftDate)}</p>
          {!highlighted && (
            <p className="mt-1 text-sm text-muted-foreground">{shift.driverName}</p>
          )}
        </div>
        <ShiftBadge hours={hours} size="md" />
      </div>
      {(shift.startTime || shift.endTime) && (
        <p className="mt-3 flex items-center gap-2 pl-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="font-medium text-foreground">
            {formatTime(shift.startTime)}
            {shift.endTime && ` – ${formatTime(shift.endTime)}`}
          </span>
          <span className="text-xs">({durationDescription(hours)})</span>
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
}: {
  cells: Array<{ day: number | null; date: string | null }>;
  entriesByDate: Map<string, ShiftScheduleEntry[]>;
  activeName: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/60">
        {DAY_NAMES_TR.map((d, i) => (
          <div
            key={d}
            className={cn(
              'py-3 text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground',
              (i === 0 || i === 6) && 'text-muted-foreground/70'
            )}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if (!cell.day || !cell.date) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[7rem] border-b border-r border-border/30 bg-canvas/80 sm:min-h-[8.5rem]"
              />
            );
          }

          const entries = entriesByDate.get(cell.date) ?? [];
          const today = isToday(cell.date);
          const hasMine = activeName && entries.some((e) => namesMatch(e.driverName, activeName));
          const count4 = entries.filter((e) => e.durationHours === 4).length;
          const count8 = entries.filter((e) => e.durationHours === 8).length;

          return (
            <div
              key={cell.date}
              className={cn(
                'group min-h-[7rem] border-b border-r border-border/30 p-2 transition sm:min-h-[8.5rem] sm:p-2.5',
                today && 'bg-brand/5',
                hasMine && 'bg-brand/8 ring-1 ring-inset ring-brand/25'
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                    today
                      ? 'bg-brand text-brand-dark shadow-glow'
                      : 'text-foreground group-hover:bg-muted'
                  )}
                >
                  {cell.day}
                </span>
                {entries.length > 0 && (
                  <div className="flex gap-0.5">
                    {count4 > 0 && (
                      <span className="rounded bg-shift4-muted px-1 text-[9px] font-bold text-shift4-dark">
                        {count4}
                      </span>
                    )}
                    {count8 > 0 && (
                      <span className="rounded bg-shift8-muted px-1 text-[9px] font-bold text-shift8-dark">
                        {count8}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                {entries.slice(0, 4).map((e) => {
                  const isMine = activeName && namesMatch(e.driverName, activeName);
                  const firstName = e.driverName.split(' ')[0];
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] leading-tight sm:text-[11px]',
                        e.durationHours === 4
                          ? 'bg-shift4-light text-shift4-dark'
                          : 'bg-shift8-light text-shift8-dark',
                        isMine && 'font-bold ring-1 ring-brand-dark/20',
                        !isMine && activeName && 'opacity-35'
                      )}
                      title={`${e.driverName} · ${formatTime(e.startTime)}–${formatTime(e.endTime)}`}
                    >
                      <span className="shrink-0 font-bold">{durationLabel(e.durationHours)}</span>
                      <span className="truncate">{isMine ? 'Siz' : firstName}</span>
                    </div>
                  );
                })}
                {entries.length > 4 && (
                  <p className="px-1 text-[10px] font-medium text-muted-foreground">
                    +{entries.length - 4} kişi
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
              <p className="text-xs text-muted-foreground">
                {dayEntries.length} sürücü ·{' '}
                {dayEntries.filter((e) => e.durationHours === 4).length}×4s ·{' '}
                {dayEntries.filter((e) => e.durationHours === 8).length}×8s
              </p>
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
                return (
                  <div
                    key={e.id}
                    className={cn(
                      'flex items-center gap-4 px-5 py-4 transition hover:bg-muted/40',
                      isMine && 'bg-brand/5'
                    )}
                  >
                    <div
                      className={cn(
                        'h-10 w-1 shrink-0 rounded-full',
                        e.durationHours === 4 ? 'bg-shift4' : 'bg-shift8'
                      )}
                    />
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
                      </p>
                    </div>
                    <ShiftBadge hours={e.durationHours} size="md" />
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
