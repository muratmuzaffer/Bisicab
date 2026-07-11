'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bike,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  FileText,
  Globe,
  Mail,
  MapPin,
  Receipt,
  Route,
  Search,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { formatFare } from '@bisicab/shared';
import { Button } from '@/components/ui/button';
import { exportToExcel, exportToPdf, type ExportRow } from '@/lib/export';
import { supabase } from '@/lib/supabase';
import { TripRouteMap } from '@/components/trip-route-map';

export interface TripRow {
  id: string;
  created_at: string;
  total_distance: number;
  total_duration: number;
  total_amount: number;
  status: string;
  receipt_image_url: string | null;
  start_zone: string | null;
  end_zone: string | null;
  start_stop: string | null;
  end_stop: string | null;
  route_stops: string[] | null;
  route_path: Array<{ lat: number; lng: number }> | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  route_label: string;
  passengers_label: string;
  has_tourist: boolean;
  users: { full_name: string | null; email?: string | null } | null;
  vehicles: { plate: string | null } | null;
}

type StatusFilter = 'all' | 'ongoing' | 'completed' | 'cancelled';
type DayBucket = 'today' | 'yesterday' | 'older';

const DAY_LABELS: Record<DayBucket, string> = {
  today: 'Bugün',
  yesterday: 'Dün',
  older: 'Daha eski',
};

const STATUS_LABEL: Record<string, string> = {
  ongoing: 'Devam ediyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
};

const STATUS_STYLE: Record<string, string> = {
  ongoing: 'bg-brand/20 text-brand-deep',
  completed: 'bg-success/15 text-success',
  cancelled: 'bg-muted text-muted-foreground',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function driverLabel(t: TripRow): string {
  return t.users?.full_name?.trim() || t.users?.email?.trim() || '—';
}

function matchesSearch(t: TripRow, needle: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  return (
    (t.users?.full_name?.toLowerCase().includes(n) ?? false) ||
    (t.users?.email?.toLowerCase().includes(n) ?? false) ||
    (t.vehicles?.plate?.toLowerCase().includes(n) ?? false) ||
    t.route_label.toLowerCase().includes(n)
  );
}

function groupByDay(trips: TripRow[]): Record<DayBucket, TripRow[]> {
  const buckets: Record<DayBucket, TripRow[]> = {
    today: [],
    yesterday: [],
    older: [],
  };
  for (const t of trips) {
    buckets[dayBucket(t.created_at)].push(t);
  }
  return buckets;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        STATUS_STYLE[status] ?? 'bg-muted text-muted-foreground'
      }`}
    >
      {status === 'ongoing' ? (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-deep" />
      ) : null}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function ReceiptThumb({
  url,
  onClick,
}: {
  url: string | null;
  onClick?: () => void;
}) {
  if (!url) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Receipt className="h-5 w-5" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Fiş"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="h-16 w-16 shrink-0 cursor-pointer rounded-lg border border-border object-cover transition hover:ring-2 hover:ring-brand/40"
    />
  );
}

function TripListItem({
  trip,
  onSelect,
  onPreview,
}: {
  trip: TripRow;
  onSelect: () => void;
  onPreview: (url: string) => void;
}) {
  const isOngoing = trip.status === 'ongoing';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/5 ${
        isOngoing ? 'border-brand/40 ring-1 ring-brand/20' : 'border-border'
      }`}
    >
      <ReceiptThumb
        url={trip.receipt_image_url}
        onClick={
          trip.receipt_image_url
            ? () => onPreview(trip.receipt_image_url!)
            : undefined
        }
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Route className="h-4 w-4 shrink-0 text-brand-deep" />
          <span className="truncate font-semibold text-foreground">
            {trip.route_label}
          </span>
          <StatusBadge status={trip.status} />
          {trip.has_tourist ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              Turist
            </span>
          ) : null}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {driverLabel(trip)}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-brand-dark">
            <Bike className="h-3.5 w-3.5" />
            {trip.vehicles?.plate ?? '—'}
          </span>
          {trip.passengers_label !== '—' ? (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {trip.passengers_label}
            </span>
          ) : null}
        </div>

        <p className="mt-1 text-xs text-muted-foreground">{fmt(trip.created_at)}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-lg font-extrabold text-success">
          {formatFare(Number(trip.total_amount))}
        </p>
        {isOngoing ? (
          <span className="text-xs font-medium text-brand-deep">canlı</span>
        ) : (
          <p className="text-xs text-muted-foreground">
            {Number(trip.total_distance).toFixed(2)} km ·{' '}
            {Number(trip.total_duration).toFixed(0)} dk
          </p>
        )}
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function TripDetail({
  trip,
  onBack,
  onPreview,
}: {
  trip: TripRow;
  onBack: () => void;
  onPreview: (url: string) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-2 text-sm font-medium text-brand-deep hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Tüm sürüşler
      </button>

      <div
        className={`mb-6 rounded-xl border bg-white p-5 shadow-sm ${
          trip.status === 'ongoing'
            ? 'border-brand/40 ring-1 ring-brand/20'
            : 'border-border'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={trip.status} />
              {trip.has_tourist ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  Turist yolcu
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 text-xl font-extrabold text-brand-dark">
              {trip.route_label}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {fmt(trip.created_at)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold text-success">
              {formatFare(Number(trip.total_amount))}
            </p>
            {trip.status === 'ongoing' ? (
              <span className="text-sm font-medium text-brand-deep">canlı güncelleniyor</span>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-canvas/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sürücü
            </p>
            <div className="mt-1 flex items-center gap-2">
              <User className="h-4 w-4 text-brand-deep" />
              <span className="font-semibold">{driverLabel(trip)}</span>
            </div>
            {trip.users?.email ? (
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{trip.users.email}</span>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg bg-canvas/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Araç
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Bike className="h-4 w-4 text-brand-deep" />
              <span className="text-lg font-extrabold text-brand-dark">
                {trip.vehicles?.plate ?? '—'}
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-canvas/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mesafe & süre
            </p>
            <p className="mt-1 flex items-center gap-2 font-semibold">
              <MapPin className="h-4 w-4 text-brand" />
              {Number(trip.total_distance).toFixed(2)} km
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {Number(trip.total_duration).toFixed(0)} dakika
            </p>
          </div>

          <div className="rounded-lg bg-canvas/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Yolcular
            </p>
            <p className="mt-1 flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4 text-brand-deep" />
              {trip.passengers_label}
            </p>
          </div>
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-deep">
          <MapPin className="h-4 w-4" />
          Gerçek sürüş rotası (GPS)
          {trip.status === 'ongoing' ? (
            <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-semibold normal-case text-brand-deep">
              canlı
            </span>
          ) : null}
        </h3>
        <TripRouteMap trip={trip} />
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-deep">
          <Receipt className="h-4 w-4" />
          Ödeme fişi
        </h3>
        {trip.receipt_image_url ? (
          <button
            type="button"
            onClick={() => onPreview(trip.receipt_image_url!)}
            className="block w-full max-w-md overflow-hidden rounded-lg border border-border transition hover:ring-2 hover:ring-brand/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trip.receipt_image_url}
              alt="Fiş"
              className="max-h-96 w-full object-contain bg-muted/30"
            />
          </button>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-muted-foreground">
            <Receipt className="mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">Fiş fotoğrafı yüklenmemiş</p>
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: typeof Wallet;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-brand-dark">{value}</p>
          {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
        </div>
        <div className={`rounded-full p-2.5 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function TripsClient({
  trips,
  queryError = null,
}: {
  trips: TripRow[];
  queryError?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel('admin-trips')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        () => router.refresh()
      )
      .subscribe();
    const t = setInterval(() => router.refresh(), 8000);
    return () => {
      clearInterval(t);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const counts = useMemo(
    () => ({
      all: trips.length,
      ongoing: trips.filter((t) => t.status === 'ongoing').length,
      completed: trips.filter((t) => t.status === 'completed').length,
      cancelled: trips.filter((t) => t.status === 'cancelled').length,
    }),
    [trips]
  );

  const todayStats = useMemo(() => {
    const todayTrips = trips.filter(
      (t) => t.status === 'completed' && dayBucket(t.created_at) === 'today'
    );
    return {
      count: todayTrips.length,
      revenue: todayTrips.reduce((s, t) => s + Number(t.total_amount), 0),
      km: todayTrips.reduce((s, t) => s + Number(t.total_distance), 0),
    };
  }, [trips]);

  const filtered = useMemo(() => {
    return trips.filter((t) => {
      const okStatus = status === 'all' || t.status === status;
      return okStatus && matchesSearch(t, search.trim());
    });
  }, [trips, status, search]);

  const ongoing = useMemo(
    () => filtered.filter((t) => t.status === 'ongoing'),
    [filtered]
  );

  const rest = useMemo(
    () => filtered.filter((t) => t.status !== 'ongoing'),
    [filtered]
  );

  const groupedRest = useMemo(() => groupByDay(rest), [rest]);

  const exportRows: ExportRow[] = filtered.map((t) => ({
    driver: driverLabel(t),
    plate: t.vehicles?.plate ?? '—',
    route: t.route_label,
    passengers: t.passengers_label,
    tourist: t.has_tourist ? 'Evet' : 'Hayır',
    date: new Date(t.created_at).toLocaleString('tr-TR'),
    distanceKm: Number(t.total_distance),
    durationMin: Number(t.total_duration),
    amount: Number(t.total_amount),
    status: t.status,
    receiptUrl: t.receipt_image_url ?? '',
  }));

  const selected = selectedId ? trips.find((t) => t.id === selectedId) : null;

  const tabs: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Tümü', count: counts.all },
    { id: 'ongoing', label: 'Devam eden', count: counts.ongoing },
    { id: 'completed', label: 'Tamamlanan', count: counts.completed },
    { id: 'cancelled', label: 'İptal', count: counts.cancelled },
  ];

  if (selected) {
    return (
      <>
        <TripDetail
          trip={selected}
          onBack={() => setSelectedId(null)}
          onPreview={setPreview}
        />
        {preview ? (
          <div
            onClick={() => setPreview(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Fiş"
              className="max-h-full max-w-full rounded-lg shadow-2xl"
            />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sürüş Denetimi</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Sürüş kayıtları, fişler ve günlük özet. Sürüşe tıklayarak detayı görün.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToExcel(exportRows)}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToPdf(exportRows)}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Bugün tamamlanan"
          value={String(todayStats.count)}
          sub={`${formatFare(todayStats.revenue)} gelir`}
          icon={Route}
          accent="bg-brand/20 text-brand-deep"
        />
        <KpiCard
          title="Bugün km"
          value={`${todayStats.km.toFixed(1)} km`}
          icon={MapPin}
          accent="bg-muted text-muted-foreground"
        />
        <KpiCard
          title="Devam eden"
          value={String(counts.ongoing)}
          sub={counts.ongoing > 0 ? 'Canlı güncelleniyor' : undefined}
          icon={Clock}
          accent="bg-brand/20 text-brand-deep"
        />
        <KpiCard
          title="Filtrelenen"
          value={String(filtered.length)}
          sub={`${counts.all} toplam kayıt`}
          icon={Wallet}
          accent="bg-success/15 text-success"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sürücü, plaka veya güzergah ara..."
            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap rounded-lg border border-border bg-white p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatus(tab.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                status === tab.id
                  ? 'bg-brand-dark text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {queryError ? (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {queryError}
        </div>
      ) : null}

      {counts.all === 0 && !queryError ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-16 text-center">
          <p className="font-semibold text-brand-dark">Henüz sürüş kaydı yok</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Sürücüler yolculuk tamamladıkça burada görünür. Devam eden sürüşler için
            &quot;Devam eden&quot; sekmesine bakın.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-16 text-center text-muted-foreground">
          Bu filtreye uygun sürüş bulunamadı.
        </div>
      ) : (
        <div className="space-y-8">
          {ongoing.length > 0 && status !== 'completed' && status !== 'cancelled' ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-deep">
                Devam eden ({ongoing.length})
              </h2>
              <div className="space-y-3">
                {ongoing.map((t) => (
                  <TripListItem
                    key={t.id}
                    trip={t}
                    onSelect={() => setSelectedId(t.id)}
                    onPreview={setPreview}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {(['today', 'yesterday', 'older'] as DayBucket[]).map((bucket) => {
            const items = groupedRest[bucket];
            if (items.length === 0) return null;
            return (
              <section key={bucket}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-deep">
                  {DAY_LABELS[bucket]} ({items.length})
                </h2>
                <div className="space-y-3">
                  {items.map((t) => (
                    <TripListItem
                      key={t.id}
                      trip={t}
                      onSelect={() => setSelectedId(t.id)}
                      onPreview={setPreview}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {preview ? (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Fiş"
            className="max-h-full max-w-full rounded-lg shadow-2xl"
          />
        </div>
      ) : null}
    </div>
  );
}
