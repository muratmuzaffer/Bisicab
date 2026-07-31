'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  List,
  Search,
  Star,
  User,
  X,
} from 'lucide-react';
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

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-brand-dark text-white shadow-lg">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                <span className="text-brand">Bisi</span>Cab Vardiya
              </h1>
              <p className="text-xs text-soft/60 sm:text-sm">Sürücü mesai çizelgesi</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/degisim"
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20 sm:text-sm"
              >
                <ArrowLeftRight className="h-4 w-4" />
                <span className="hidden sm:inline">Değişimler</span>
              </Link>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <button
                type="button"
                onClick={() => navigateMonth(-1)}
                className="rounded-lg p-1.5 hover:bg-white/10"
                aria-label="Önceki ay"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[120px] text-center text-sm font-semibold sm:min-w-[140px] sm:text-base">
                {formatMonthYear(year, month)}
              </span>
              <button
                type="button"
                onClick={() => navigateMonth(1)}
                className="rounded-lg p-1.5 hover:bg-white/10"
                aria-label="Sonraki ay"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Search */}
        <section className="relative mb-6">
          <div className="rounded-2xl border border-brand/20 bg-white p-4 shadow-search sm:p-6">
            <label htmlFor="name-search" className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              Adınızı yazın, vardiyalarınızı görün
            </label>
            <div className="relative">
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
                placeholder="Örn: Ahmet Yılmaz"
                className="w-full rounded-xl border border-border bg-canvas py-3.5 pl-12 pr-24 text-base font-medium outline-none ring-brand/30 transition focus:border-brand focus:ring-2"
                autoComplete="off"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                {activeName && (
                  <button
                    type="button"
                    onClick={clearName}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                    aria-label="Temizle"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-4 right-4 z-50 mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-white py-1 shadow-card sm:left-6 sm:right-6">
                {suggestions.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => saveMyName(name)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-canvas"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      {name}
                      {savedName && namesMatch(name, savedName) && (
                        <Star className="ml-auto h-3.5 w-3.5 fill-brand text-brand" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Legend */}
        <div className="mb-6 flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md bg-shift4-light px-2 text-xs font-bold text-shift4-dark">
              4s
            </span>
            4 saatlik vardiya
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md bg-shift8-light px-2 text-xs font-bold text-shift8-dark">
              8s
            </span>
            8 saatlik vardiya
          </span>
        </div>

        {loading && (
          <div className="mb-6 rounded-xl bg-white p-8 text-center text-muted-foreground shadow-card">
            Yükleniyor…
          </div>
        )}

        {!loading && !data && (
          <div className="rounded-2xl bg-white p-12 text-center shadow-card">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold">Bu ay için çizelge yok</h2>
            <p className="mt-2 text-muted-foreground">
              {formatMonthYear(year, month)} vardiya çizelgesi henüz yayınlanmadı.
            </p>
            {availableMonths.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {availableMonths.map(({ year: y, month: m }) => (
                  <button
                    key={`${y}-${m}`}
                    type="button"
                    onClick={() => loadMonth(y, m)}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-deep"
                  >
                    {formatMonthYear(y, m)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && data && (
          <>
            {/* My shifts highlight */}
            {activeName && (
              <section className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                  <Star className="h-5 w-5 fill-brand text-brand" />
                  {myShifts.length > 0
                    ? `${activeName} — ${myShifts.length} vardiya`
                    : `${activeName} — bu ay vardiya bulunamadı`}
                </h2>
                {myShifts.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {myShifts.map((shift) => (
                      <ShiftCard key={shift.id} shift={shift} highlighted />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-white p-4 text-sm text-muted-foreground shadow-card">
                    Farklı bir ay seçmeyi veya adınızı kontrol etmeyi deneyin.
                  </p>
                )}
              </section>
            )}

            {/* View tabs */}
            <div className="mb-4 flex gap-1 rounded-xl bg-white p-1 shadow-card">
              {([
                { id: 'calendar' as const, label: 'Takvim', icon: Calendar },
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
                    'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition',
                    view === id
                      ? 'bg-brand-dark text-brand'
                      : 'text-muted-foreground hover:bg-canvas'
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
              <div className="overflow-hidden rounded-2xl bg-white shadow-card">
                <div className="border-b border-border px-4 py-3">
                  <a
                    href={data.month.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-shift4-dark hover:underline"
                  >
                    PDF&apos;yi yeni sekmede aç →
                  </a>
                </div>
                <iframe
                  src={data.month.pdfUrl}
                  title="Vardiya PDF"
                  className="h-[70vh] w-full"
                />
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        BisiCab · İZULAŞ Alsancak Limanı – Konak Saat Kulesi
      </footer>
    </div>
  );
}

function ShiftBadge({ hours }: { hours: 4 | 8 }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none',
        hours === 4
          ? 'bg-shift4-light text-shift4-dark'
          : 'bg-shift8-light text-shift8-dark'
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
  return (
    <article
      className={cn(
        'rounded-xl border p-4 transition',
        highlighted
          ? 'border-brand/40 bg-brand/5 shadow-search'
          : 'border-border/60 bg-white shadow-card',
        today && 'ring-2 ring-brand/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{formatDateTr(shift.shiftDate)}</p>
          {!highlighted && (
            <p className="mt-0.5 text-sm text-muted-foreground">{shift.driverName}</p>
          )}
        </div>
        <ShiftBadge hours={shift.durationHours} />
      </div>
      {(shift.startTime || shift.endTime) && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {formatTime(shift.startTime)}
          {shift.endTime && ` – ${formatTime(shift.endTime)}`}
          <span className="text-xs">({durationDescription(shift.durationHours)})</span>
        </p>
      )}
      {today && (
        <span className="mt-2 inline-block rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark">
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
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      <div className="grid grid-cols-7 border-b border-border bg-canvas">
        {DAY_NAMES_TR.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if (!cell.day || !cell.date) {
            return <div key={`empty-${idx}`} className="min-h-[100px] border-b border-r border-border/40 bg-canvas/50" />;
          }

          const entries = entriesByDate.get(cell.date) ?? [];
          const today = isToday(cell.date);
          const hasMine = activeName && entries.some((e) => namesMatch(e.driverName, activeName));

          return (
            <div
              key={cell.date}
              className={cn(
                'min-h-[100px] border-b border-r border-border/40 p-1.5 sm:p-2',
                today && 'bg-brand/5',
                hasMine && 'bg-brand/10 ring-1 ring-inset ring-brand/30'
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                    today ? 'bg-brand text-brand-dark' : 'text-foreground'
                  )}
                >
                  {cell.day}
                </span>
                {entries.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{entries.length}</span>
                )}
              </div>
              <div className="space-y-0.5">
                {entries.slice(0, 3).map((e) => {
                  const isMine = activeName && namesMatch(e.driverName, activeName);
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        'truncate rounded px-1 py-0.5 text-[10px] leading-tight sm:text-[11px]',
                        e.durationHours === 4
                          ? 'bg-shift4-light text-shift4-dark'
                          : 'bg-shift8-light text-shift8-dark',
                        isMine && 'font-bold ring-1 ring-brand-dark/30',
                        !isMine && activeName && 'opacity-40'
                      )}
                      title={`${e.driverName} ${formatTime(e.startTime)}-${formatTime(e.endTime)}`}
                    >
                      <span className="font-bold">{durationLabel(e.durationHours)}</span>{' '}
                      {isMine ? 'Sen' : e.driverName.split(' ')[0]}
                    </div>
                  );
                })}
                {entries.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{entries.length - 3} daha</p>
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

  return (
    <div className="space-y-4">
      {grouped.map(([date, dayEntries]) => (
        <section key={date} className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
          <h3 className="mb-3 flex items-center gap-2 font-bold">
            {formatDateTr(date)}
            {isToday(date) && (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                BUGÜN
              </span>
            )}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {dayEntries
              .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
              .map((e) => {
                const isMine = activeName && namesMatch(e.driverName, activeName);
                if (activeName && !isMine) return null;
                return (
                  <div
                    key={e.id}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-4 py-3',
                      isMine ? 'border-brand/40 bg-brand/5' : 'border-border/60'
                    )}
                  >
                    <div>
                      <p className="font-medium">{e.driverName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(e.startTime)}
                        {e.endTime && ` – ${formatTime(e.endTime)}`}
                      </p>
                    </div>
                    <ShiftBadge hours={e.durationHours} />
                  </div>
                );
              })}
            {activeName &&
              dayEntries.every((e) => !namesMatch(e.driverName, activeName)) && (
                <p className="text-sm text-muted-foreground">Vardiya yok</p>
              )}
          </div>
        </section>
      ))}
    </div>
  );
}
