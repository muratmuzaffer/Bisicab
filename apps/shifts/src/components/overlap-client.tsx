'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Calendar,
  Search,
  User,
  Users,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { useDriverIdentity } from '@/components/driver-identity';
import { MonthNavigator } from '@/components/month-navigator';
import type { ScheduleData, ShiftScheduleEntry } from '@/lib/types';
import { findCommonShiftDays } from '@/lib/overlap-utils';
import { shiftSummary } from '@/lib/swap-utils';
import { getShiftVisualKind, shiftAccentHex, shiftKindShortLabel } from '@/lib/shift-styles';
import { cn, formatDateTr, formatMonthYear, formatTime, namesMatch } from '@/lib/utils';

interface OverlapClientProps {
  initialData: ScheduleData | null;
  driverNames: string[];
  initialYear: number;
  initialMonth: number;
}

function DriverSlot({
  index,
  value,
  onChange,
  driverNames,
  placeholder,
  onClear,
  locked,
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  driverNames: string[];
  placeholder: string;
  onClear?: () => void;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => {
    if (!value.trim()) return driverNames;
    const q = value.toLowerCase();
    return driverNames.filter((n) => n.toLowerCase().includes(q));
  }, [value, driverNames]);

  if (locked) {
    return (
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          Ben
        </label>
        <div className="input-field flex items-center gap-3 bg-brand/10 font-semibold text-foreground">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/25 text-sm font-black text-brand-dark">
            {value.charAt(0) || '?'}
          </span>
          {value || '—'}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <User className="h-3.5 w-3.5" />
        Kişi {index}
        {index === 3 && (
          <span className="font-normal normal-case text-muted-foreground/80">(isteğe bağlı)</span>
        )}
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="input-field w-full pl-9 pr-9"
          autoComplete="off"
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Temizle"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-lg">
          {suggestions.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-brand/10"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ShiftChip({ entry }: { entry: ShiftScheduleEntry }) {
  const kind = getShiftVisualKind(entry.slotLabel, entry.durationHours);
  const accent = shiftAccentHex(kind);
  return (
    <div
      className="rounded-xl border border-border/60 bg-white px-3 py-2 text-sm shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <div className="font-bold">{shiftKindShortLabel(kind)}</div>
      <div className="text-xs text-muted-foreground">
        {shiftSummary(entry)}
        {entry.startTime && entry.endTime && (
          <span className="ml-1">
            · {formatTime(entry.startTime)}–{formatTime(entry.endTime)}
          </span>
        )}
      </div>
    </div>
  );
}

export function OverlapClient({
  initialData,
  driverNames,
  initialYear,
  initialMonth,
}: OverlapClientProps) {
  const { name: person1 } = useDriverIdentity();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [person2, setPerson2] = useState('');
  const [person3, setPerson3] = useState('');

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

  const selectedNames = useMemo(() => {
    const names = [person1, person2, person3].map((n) => n.trim()).filter(Boolean);
    const unique: string[] = [];
    for (const name of names) {
      if (!unique.some((u) => namesMatch(u, name))) unique.push(name);
    }
    return unique;
  }, [person1, person2, person3]);

  const commonDays = useMemo(() => {
    if (!data || selectedNames.length < 2) return [];
    return findCommonShiftDays(data.entries, selectedNames);
  }, [data, selectedNames]);

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
          <span className="text-brand">Ortak</span> Mesai
        </>
      }
      subtitle={formatMonthYear(year, month)}
      maxWidth="3xl"
      actions={monthNav}
    >
      <div className="animate-slide-up space-y-6">
        <section className="card overflow-visible p-5 sm:p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/20">
              <Users className="h-6 w-6 text-brand-dark" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Kimlerle aynı gün mesaideyiz?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                En fazla 3 kişi seçin. Hepsinin aynı gün vardiyası olan günler listelenir.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <DriverSlot
              index={1}
              value={person1}
              onChange={() => undefined}
              driverNames={driverNames}
              placeholder="1. kişi…"
              locked
            />
            <DriverSlot
              index={2}
              value={person2}
              onChange={setPerson2}
              driverNames={driverNames.filter((n) => !person1 || !namesMatch(n, person1))}
              placeholder="Arkadaşını seç…"
              onClear={() => setPerson2('')}
            />
            <DriverSlot
              index={3}
              value={person3}
              onChange={setPerson3}
              driverNames={driverNames.filter(
                (n) =>
                  (!person1 || !namesMatch(n, person1)) &&
                  (!person2 || !namesMatch(n, person2))
              )}
              placeholder="3. kişi (opsiyonel)…"
              onClear={() => setPerson3('')}
            />
          </div>

          {selectedNames.length >= 2 && (
            <p className="mt-4 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{selectedNames.join(' · ')}</span>
              {loading ? ' — yükleniyor…' : ` — ${commonDays.length} ortak gün`}
            </p>
          )}
        </section>

        <section className="card p-5 sm:p-8">
          {selectedNames.length < 2 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              En az iki kişi seçin.
            </div>
          ) : commonDays.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              {formatMonthYear(year, month)} ayında{' '}
              <span className="font-semibold text-foreground">{selectedNames.join(', ')}</span>{' '}
              için ortak vardiya günü yok.
            </div>
          ) : (
            <ul className="space-y-4">
              {commonDays.map((day) => (
                <li
                  key={day.date}
                  className="rounded-2xl border border-border/60 bg-canvas/40 p-4 sm:p-5"
                >
                  <div className="mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-brand-dark" />
                    <h3 className="font-bold">{formatDateTr(day.date)}</h3>
                    <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                      {selectedNames.length} kişi
                    </span>
                  </div>
                  <div
                    className={cn(
                      'grid gap-3',
                      day.byDriver.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
                    )}
                  >
                    {day.byDriver.map(({ driverName, shifts }) => (
                      <div key={driverName} className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          {driverName}
                        </p>
                        {shifts.map((entry) => (
                          <ShiftChip key={entry.id} entry={entry} />
                        ))}
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
