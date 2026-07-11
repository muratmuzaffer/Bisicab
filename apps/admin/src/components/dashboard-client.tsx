'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bike,
  Clock,
  History,
  ListChecks,
  MapPin,
  Route,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { formatFare } from '@bisicab/shared';
import { supabase } from '@/lib/supabase';

export interface OnShiftDriver {
  name: string;
  email: string;
  started_at: string;
  plate: string | null;
}

export interface DashboardStats {
  activeBikes: number;
  onShift: number;
  totalVehicles: number;
  availableVehicles: number;
  maintenanceVehicles: number;
  ongoingTrips: number;
  todayRevenue: number;
  todayKm: number;
  todayRides: number;
  yesterdayRevenue: number;
  yesterdayKm: number;
  yesterdayRides: number;
}

export interface ActiveVehicle {
  plate: string;
  label: string | null;
  driver_name: string | null;
  driver_email: string | null;
}

export interface RecentTrip {
  id: string;
  created_at: string;
  total_amount: number;
  total_distance: number;
  status: string;
  driver_name: string | null;
  plate: string | null;
  route_label: string;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDateHeader(): string {
  return new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function deltaLabel(today: number, yesterday: number, suffix = ''): string {
  const diff = today - yesterday;
  if (diff === 0) return 'Dünle aynı';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${suffix === '₺' ? formatFare(diff) : `${diff.toFixed(suffix === 'km' ? 2 : 0)}${suffix ? ` ${suffix}` : ''}`} düne göre`;
}

function DeltaBadge({
  today,
  yesterday,
  suffix = '',
}: {
  today: number;
  yesterday: number;
  suffix?: string;
}) {
  const diff = today - yesterday;
  if (diff === 0) {
    return (
      <span className="text-xs text-muted-foreground">Dünle aynı</span>
    );
  }
  const up = diff > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        up ? 'text-success' : 'text-danger'
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {deltaLabel(today, yesterday, suffix)}
    </span>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  accent,
  today,
  yesterday,
  deltaSuffix = '',
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  today?: number;
  yesterday?: number;
  deltaSuffix?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={`rounded-lg p-2 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-brand-dark">
        {value}
      </p>
      {today !== undefined && yesterday !== undefined ? (
        <div className="mt-2">
          <DeltaBadge today={today} yesterday={yesterday} suffix={deltaSuffix} />
        </div>
      ) : null}
    </div>
  );
}

const QUICK_LINKS = [
  { href: '/live', label: 'Canlı Takip', icon: MapPin, desc: 'Haritada sürücüleri gör' },
  { href: '/vehicles', label: 'Araçlar', icon: Bike, desc: 'Filo durumu' },
  { href: '/usage', label: 'Araç Kullanımı', icon: History, desc: 'Kim hangi aracı aldı' },
  { href: '/trips', label: 'Sürüş Denetimi', icon: ListChecks, desc: 'Fiş ve sürüş kayıtları' },
];

export function DashboardClient({
  stats,
  activeVehicles,
  onShiftDrivers,
  recentTrips,
  adminName,
}: {
  stats: DashboardStats;
  activeVehicles: ActiveVehicle[];
  onShiftDrivers: OnShiftDriver[];
  recentTrips: RecentTrip[];
  adminName: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-trips')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trips' },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trips' },
        () => router.refresh()
      )
      .subscribe();

    const t = setInterval(() => router.refresh(), 8000);

    return () => {
      clearInterval(t);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const fleetUsedPct =
    stats.totalVehicles > 0
      ? Math.round((stats.activeBikes / stats.totalVehicles) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{fmtDateHeader()}</p>
          <h1 className="mt-1 text-2xl font-bold text-brand-dark">
            Hoş geldin, {adminName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Günlük özet ve operasyon durumu
          </p>
        </div>
        <Link
          href="/live"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-dark shadow-sm hover:bg-brand-light"
        >
          <MapPin className="h-4 w-4" />
          Canlı haritayı aç
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Aktif BisiCab"
          value={String(stats.activeBikes)}
          icon={Bike}
          accent="bg-brand/20 text-brand-deep"
        />
        <KpiCard
          title="Günlük Ciro"
          value={formatFare(stats.todayRevenue)}
          icon={Wallet}
          accent="bg-success/15 text-success"
          today={stats.todayRevenue}
          yesterday={stats.yesterdayRevenue}
          deltaSuffix="₺"
        />
        <KpiCard
          title="Günlük KM"
          value={`${stats.todayKm.toFixed(2)} km`}
          icon={Route}
          accent="bg-brand/15 text-brand-deep"
          today={stats.todayKm}
          yesterday={stats.yesterdayKm}
          deltaSuffix="km"
        />
        <KpiCard
          title="Günlük Sürüş"
          value={String(stats.todayRides)}
          icon={ListChecks}
          accent="bg-muted text-muted-foreground"
          today={stats.todayRides}
          yesterday={stats.yesterdayRides}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Filo durumu
          </h2>
          <div className="mt-4 flex flex-wrap gap-6">
            <div>
              <p className="text-3xl font-extrabold text-brand-dark">
                {stats.totalVehicles}
              </p>
              <p className="text-sm text-muted-foreground">Toplam araç</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-success">
                {stats.availableVehicles}
              </p>
              <p className="text-sm text-muted-foreground">Müsait</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-brand-deep">
                {stats.activeBikes}
              </p>
              <p className="text-sm text-muted-foreground">Kullanımda</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-muted-foreground">
                {stats.maintenanceVehicles}
              </p>
              <p className="text-sm text-muted-foreground">Bakımda</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Doluluk</span>
              <span>{fleetUsedPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${fleetUsedPct}%` }}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4 text-brand-deep" />
              {stats.onShift} sürücü mesaide
            </span>
            {stats.ongoingTrips > 0 ? (
              <span className="flex items-center gap-1.5 font-medium text-brand-deep">
                <Clock className="h-4 w-4" />
                {stats.ongoingTrips} devam eden yolculuk
              </span>
            ) : null}
          </div>
          {onShiftDrivers.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-border pt-4">
              {onShiftDrivers.map((d) => (
                <li
                  key={d.email}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-brand-dark">{d.name}</span>
                    <span className="ml-2 text-muted-foreground">{d.email}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {d.plate ? `${d.plate} · ` : ''}
                    {fmtTime(d.started_at)}’den beri
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-brand-dark p-5 text-white shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-soft/70">
            Hızlı erişim
          </h2>
          <ul className="mt-4 space-y-2">
            {QUICK_LINKS.map(({ href, label, icon: Icon, desc }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/10"
                >
                  <Icon className="h-4 w-4 shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="truncate text-xs text-soft/60">{desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-soft/40" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold text-brand-dark">Şu an kullanımda</h2>
            <Link
              href="/vehicles"
              className="text-sm font-medium text-brand-deep hover:underline"
            >
              Tüm araçlar
            </Link>
          </div>
          {activeVehicles.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Şu an kullanımda bisiklet yok.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {activeVehicles.map((v) => (
                <li key={v.plate} className="flex items-center gap-4 px-5 py-4">
                  <div className="rounded-full bg-brand/20 p-2">
                    <Bike className="h-4 w-4 text-brand-deep" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-brand-dark">{v.plate}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {v.driver_name ?? 'Sürücü'}
                      {v.driver_email ? ` · ${v.driver_email}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                    Aktif
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold text-brand-dark">Son sürüşler</h2>
            <Link
              href="/trips"
              className="text-sm font-medium text-brand-deep hover:underline"
            >
              Tümünü gör
            </Link>
          </div>
          {recentTrips.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Henüz sürüş kaydı yok.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentTrips.map((t) => (
                <li key={t.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-brand-dark">
                        {t.driver_name ?? 'Sürücü'}
                        {t.plate ? (
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            · {t.plate}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {t.route_label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {fmtTime(t.created_at)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`font-bold ${
                          t.status === 'ongoing' ? 'text-brand-deep' : 'text-success'
                        }`}
                      >
                        {formatFare(t.total_amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Number(t.total_distance).toFixed(2)} km
                        {t.status === 'ongoing' ? ' · canlı' : ''}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${
                          t.status === 'completed'
                            ? 'bg-success/10 text-success'
                            : t.status === 'ongoing'
                              ? 'bg-brand/20 text-brand-deep'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {t.status === 'completed'
                          ? 'Tamamlandı'
                          : t.status === 'ongoing'
                            ? 'Devam ediyor'
                            : t.status === 'cancelled'
                              ? 'İptal'
                              : t.status}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
