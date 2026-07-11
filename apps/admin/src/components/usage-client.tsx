'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bike,
  ChevronRight,
  Clock,
  Mail,
  User,
} from 'lucide-react';

export interface UsageRow {
  id: string;
  vehicle_id: string;
  driver_name: string | null;
  driver_email: string;
  plate: string;
  vehicle_label: string | null;
  shift_started_at: string;
  shift_planned_end_at: string | null;
  shift_duration_hours: number | null;
  assigned_at: string;
  released_at: string | null;
  release_reason: string | null;
  is_active: boolean;
}

export interface VehicleInfo {
  id: string;
  plate: string;
  label: string | null;
}

const REASON_LABELS: Record<string, string> = {
  driver: 'Sürücü bıraktı',
  admin_force: 'Admin geri aldı',
  auto_21h: '21:00 otomatik',
  shift_end: 'Mesai bitti',
};

type DayBucket = 'today' | 'yesterday' | 'older';

const DAY_LABELS: Record<DayBucket, string> = {
  today: 'Bugün',
  yesterday: 'Dün',
  older: 'Daha eski',
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function durationBetween(start: string, end: string | null): string {
  const a = new Date(start).getTime();
  const b = end ? new Date(end).getTime() : Date.now();
  const mins = Math.max(0, Math.floor((b - a) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h} sa ${m} dk`;
  return `${m} dk`;
}

function driverLabel(row: UsageRow): string {
  return row.driver_name?.trim() || row.driver_email;
}

function dayBucket(iso: string): DayBucket {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);

  if (d >= startToday) return 'today';
  if (d >= startYesterday) return 'yesterday';
  return 'older';
}

interface VehicleSummary {
  vehicle: VehicleInfo;
  rows: UsageRow[];
  active: UsageRow | null;
  todayCount: number;
  yesterdayCount: number;
  totalCount: number;
}

function buildSummaries(
  vehicles: VehicleInfo[],
  rows: UsageRow[]
): VehicleSummary[] {
  const byVehicle = new Map<string, UsageRow[]>();
  for (const row of rows) {
    const list = byVehicle.get(row.vehicle_id) ?? [];
    list.push(row);
    byVehicle.set(row.vehicle_id, list);
  }

  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

  const ids = new Set([
    ...vehicles.map((v) => v.id),
    ...rows.map((r) => r.vehicle_id),
  ]);

  return Array.from(ids)
    .map((id) => {
      const vehicle = vehicleMap.get(id) ?? {
        id,
        plate: rows.find((r) => r.vehicle_id === id)?.plate ?? '—',
        label: rows.find((r) => r.vehicle_id === id)?.vehicle_label ?? null,
      };
      const vehicleRows = (byVehicle.get(id) ?? []).sort(
        (a, b) =>
          new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime()
      );
      return {
        vehicle,
        rows: vehicleRows,
        active: vehicleRows.find((r) => r.is_active) ?? null,
        todayCount: vehicleRows.filter((r) => dayBucket(r.assigned_at) === 'today')
          .length,
        yesterdayCount: vehicleRows.filter(
          (r) => dayBucket(r.assigned_at) === 'yesterday'
        ).length,
        totalCount: vehicleRows.length,
      };
    })
    .sort((a, b) => a.vehicle.plate.localeCompare(b.vehicle.plate, 'tr'));
}

function AssignmentRow({ row }: { row: UsageRow }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        row.is_active
          ? 'border-brand/30 bg-brand/5'
          : 'border-border bg-white'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-brand-deep" />
            <span className="font-semibold">{driverLabel(row)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{row.driver_email}</span>
          </div>
        </div>
        {row.is_active ? (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
            Aktif
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <span className="text-xs text-muted-foreground">Alındı</span>
          <p className="font-medium">{fmt(row.assigned_at)}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Bırakıldı</span>
          <p className="font-medium">
            {row.released_at ? fmt(row.released_at) : '—'}
          </p>
          {row.release_reason ? (
            <p className="text-xs text-muted-foreground">
              {REASON_LABELS[row.release_reason] ?? row.release_reason}
            </p>
          ) : null}
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Süre</span>
          <p className="flex items-center gap-1 font-medium">
            <Clock className="h-3.5 w-3.5 text-brand" />
            {durationBetween(row.assigned_at, row.released_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

function VehicleDetail({
  summary,
  onBack,
}: {
  summary: VehicleSummary;
  onBack: () => void;
}) {
  const grouped = useMemo(() => {
    const buckets: Record<DayBucket, UsageRow[]> = {
      today: [],
      yesterday: [],
      older: [],
    };
    for (const row of summary.rows) {
      buckets[dayBucket(row.assigned_at)].push(row);
    }
    return buckets;
  }, [summary.rows]);

  const { vehicle, active } = summary;

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-2 text-sm font-medium text-brand-deep hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Tüm bisikletler
      </button>

      <div className="mb-6 rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand/20 p-3">
              <Bike className="h-6 w-6 text-brand-deep" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-brand-dark">
                {vehicle.plate}
              </h2>
              {vehicle.label ? (
                <p className="text-sm text-muted-foreground">{vehicle.label}</p>
              ) : null}
            </div>
          </div>
          {active ? (
            <span className="rounded-full bg-success/15 px-3 py-1 text-sm font-semibold text-success">
              Şu an kullanımda
            </span>
          ) : null}
        </div>

        {active ? (
          <div className="mt-4 rounded-lg border border-brand/30 bg-brand/5 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Şu anki sürücü
            </p>
            <p className="mt-1 font-semibold">{driverLabel(active)}</p>
            <p className="text-sm text-muted-foreground">{active.driver_email}</p>
            <p className="mt-2 text-sm">
              Alındı: {fmt(active.assigned_at)} ·{' '}
              {durationBetween(active.assigned_at, null)} süredir
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-brand/15 px-3 py-1 font-medium text-brand-deep">
            Bugün: {summary.todayCount} kullanım
          </span>
          <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">
            Dün: {summary.yesterdayCount} kullanım
          </span>
          <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">
            Toplam: {summary.totalCount} kayıt
          </span>
        </div>
      </div>

      <div className="space-y-8">
        {(['today', 'yesterday', 'older'] as DayBucket[]).map((bucket) => {
          const items = grouped[bucket];
          if (items.length === 0) return null;
          return (
            <section key={bucket}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-deep">
                {DAY_LABELS[bucket]} ({items.length})
              </h3>
              <div className="space-y-3">
                {items.map((row) => (
                  <AssignmentRow key={row.id} row={row} />
                ))}
              </div>
            </section>
          );
        })}

        {summary.totalCount === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center text-muted-foreground">
            Bu bisiklet için henüz kullanım kaydı yok.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function VehicleListItem({
  summary,
  onSelect,
}: {
  summary: VehicleSummary;
  onSelect: () => void;
}) {
  const { vehicle, active, todayCount, yesterdayCount, totalCount } = summary;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-4 rounded-xl border border-border bg-white p-4 text-left shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/5"
    >
      <div
        className={`shrink-0 rounded-full p-2.5 ${
          active ? 'bg-brand/20' : 'bg-muted'
        }`}
      >
        <Bike
          className={`h-5 w-5 ${
            active ? 'text-brand-deep' : 'text-muted-foreground'
          }`}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-extrabold text-brand-dark">
            {vehicle.plate}
          </span>
          {vehicle.label ? (
            <span className="text-sm text-muted-foreground">{vehicle.label}</span>
          ) : null}
          {active ? (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
              Kullanımda
            </span>
          ) : null}
        </div>

        {active ? (
          <p className="mt-1 truncate text-sm text-foreground">
            {driverLabel(active)} · {active.driver_email}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Müsait</p>
        )}

        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-brand/10 px-2 py-0.5 font-medium text-brand-deep">
            Bugün {todayCount}
          </span>
          <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
            Dün {yesterdayCount}
          </span>
          {totalCount > 0 ? (
            <span className="text-muted-foreground">{totalCount} kayıt</span>
          ) : (
            <span className="text-muted-foreground">Kayıt yok</span>
          )}
        </div>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function UsageClient({
  rows,
  vehicles,
}: {
  rows: UsageRow[];
  vehicles: VehicleInfo[];
}) {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const summaries = useMemo(
    () => buildSummaries(vehicles, rows),
    [vehicles, rows]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return summaries;
    return summaries.filter(
      (s) =>
        s.vehicle.plate.toLowerCase().includes(needle) ||
        (s.vehicle.label?.toLowerCase().includes(needle) ?? false) ||
        s.rows.some(
          (r) =>
            (r.driver_name?.toLowerCase().includes(needle) ?? false) ||
            r.driver_email.toLowerCase().includes(needle)
        )
    );
  }, [summaries, q]);

  const selected = selectedId
    ? summaries.find((s) => s.vehicle.id === selectedId)
    : null;

  const activeCount = summaries.filter((s) => s.active).length;

  if (selected) {
    return <VehicleDetail summary={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Araç Kullanımı</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Bisiklete tıklayın; bugünkü ve dünkü kullanımları ayrı ayrı görün.
          </p>
        </div>
        <span className="rounded-full bg-brand/20 px-3 py-1 text-sm font-medium text-brand-deep">
          {activeCount} bisiklet kullanımda
        </span>
      </div>

      <input
        type="search"
        placeholder="Plaka, sürücü adı veya e-posta ara..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-6 w-full max-w-md rounded-lg border border-border bg-white px-3 py-2 text-sm"
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-16 text-center text-muted-foreground">
          Bisiklet bulunamadı.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((summary) => (
            <VehicleListItem
              key={summary.vehicle.id}
              summary={summary}
              onSelect={() => setSelectedId(summary.vehicle.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
