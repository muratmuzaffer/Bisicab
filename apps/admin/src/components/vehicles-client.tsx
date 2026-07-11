'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, Mail, Search, User, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { releaseVehicle } from '@/app/(dashboard)/vehicles/actions';

export interface VehicleRow {
  id: string;
  plate: string;
  label: string | null;
  status: 'available' | 'in_use' | 'maintenance';
  driver_name: string | null;
  driver_email: string | null;
  updated_at: string;
}

type StatusFilter = 'all' | 'in_use' | 'available' | 'maintenance';

const STATUS_LABEL: Record<VehicleRow['status'], string> = {
  available: 'Müsait',
  in_use: 'Kullanımda',
  maintenance: 'Bakımda',
};

const STATUS_STYLE: Record<VehicleRow['status'], string> = {
  available: 'bg-success/15 text-success',
  in_use: 'bg-brand/25 text-brand-deep',
  maintenance: 'bg-muted text-muted-foreground',
};

const CARD_RING: Record<VehicleRow['status'], string> = {
  available: 'border-border',
  in_use: 'border-brand/40 ring-1 ring-brand/20',
  maintenance: 'border-border opacity-90',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function VehicleCard({
  vehicle,
  busy,
  onRelease,
}: {
  vehicle: VehicleRow;
  busy: boolean;
  onRelease: () => void;
}) {
  const hasDriver = Boolean(vehicle.driver_name || vehicle.driver_email);

  return (
    <article
      className={`rounded-xl border bg-white p-5 shadow-sm ${CARD_RING[vehicle.status]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-full p-2.5 ${
              vehicle.status === 'in_use' ? 'bg-brand/20' : 'bg-muted'
            }`}
          >
            <Bike
              className={`h-5 w-5 ${
                vehicle.status === 'in_use' ? 'text-brand-deep' : 'text-muted-foreground'
              }`}
            />
          </div>
          <div>
            <p className="text-xl font-extrabold tracking-tight text-brand-dark">
              {vehicle.plate}
            </p>
            {vehicle.label ? (
              <p className="text-sm text-muted-foreground">{vehicle.label}</p>
            ) : null}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[vehicle.status]}`}
        >
          {STATUS_LABEL[vehicle.status]}
        </span>
      </div>

      {vehicle.status === 'in_use' ? (
        <div className="mt-4 rounded-lg bg-canvas/80 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kullanan sürücü
          </p>
          {hasDriver ? (
            <>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-brand-deep" />
                <span className="font-semibold text-foreground">
                  {vehicle.driver_name ?? vehicle.driver_email}
                </span>
              </div>
              {vehicle.driver_email && vehicle.driver_name ? (
                <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{vehicle.driver_email}</span>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-danger">
              Sürücü bilgisi eksik — araç kullanımda görünüyor ama atama kaydı
              bulunamadı.
            </p>
          )}
        </div>
      ) : vehicle.status === 'maintenance' ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          <Wrench className="h-4 w-4" />
          Bakım / servis dışı
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Müsait — sürücü atanmadı
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Son güncelleme: {fmt(vehicle.updated_at)}
        </p>
        {vehicle.status === 'in_use' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onRelease}
            className="shrink-0 border-danger/40 text-danger hover:bg-danger/10"
          >
            {busy ? 'İşleniyor...' : 'Aracı Geri Al'}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function VehiclesClient({ vehicles }: { vehicles: VehicleRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    const channel = supabase
      .channel('admin-vehicles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicles' },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_assignments' },
        () => router.refresh()
      )
      .subscribe();
    const t = setInterval(() => router.refresh(), 10000);
    return () => {
      clearInterval(t);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const counts = useMemo(
    () => ({
      in_use: vehicles.filter((v) => v.status === 'in_use').length,
      available: vehicles.filter((v) => v.status === 'available').length,
      maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
    }),
    [vehicles]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (filter !== 'all' && v.status !== filter) return false;
      if (!needle) return true;
      return (
        v.plate.toLowerCase().includes(needle) ||
        (v.label?.toLowerCase().includes(needle) ?? false) ||
        (v.driver_name?.toLowerCase().includes(needle) ?? false) ||
        (v.driver_email?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [vehicles, q, filter]);

  const onRelease = (v: VehicleRow) => {
    const who = v.driver_name ?? v.driver_email ?? 'sürücü';
    if (
      !confirm(
        `${v.plate} plakalı aracı ${who} üzerinden geri almak istediğinize emin misiniz?`
      )
    )
      return;
    setBusyId(v.id);
    startTransition(async () => {
      const { error } = await releaseVehicle(v.id);
      setBusyId(null);
      if (error) alert(`Hata: ${error}`);
      else router.refresh();
    });
  };

  const tabs: { id: StatusFilter; label: string; count?: number }[] = [
    { id: 'all', label: 'Tümü', count: vehicles.length },
    { id: 'in_use', label: 'Kullanımda', count: counts.in_use },
    { id: 'available', label: 'Müsait', count: counts.available },
    { id: 'maintenance', label: 'Bakımda', count: counts.maintenance },
  ];

  const inUse = filtered.filter((v) => v.status === 'in_use');
  const available = filtered.filter((v) => v.status === 'available');
  const maintenance = filtered.filter((v) => v.status === 'maintenance');

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Araçlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Filo durumu, kullanan sürücü ve zorla geri alma
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-brand/20 px-3 py-1 font-medium text-brand-deep">
            {counts.in_use} kullanımda
          </span>
          <span className="rounded-full bg-success/15 px-3 py-1 font-medium text-success">
            {counts.available} müsait
          </span>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Plaka, sürücü adı veya e-posta..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap rounded-lg border border-border bg-white p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-brand-dark text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.count !== undefined ? ` (${tab.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-16 text-center text-muted-foreground">
          Araç bulunamadı.
        </div>
      ) : (
        <div className="space-y-8">
          {inUse.length > 0 && filter !== 'available' && filter !== 'maintenance' ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-deep">
                Kullanımda ({inUse.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {inUse.map((v) => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    busy={pending && busyId === v.id}
                    onRelease={() => onRelease(v)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {available.length > 0 && filter !== 'in_use' && filter !== 'maintenance' ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-success">
                Müsait ({available.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {available.map((v) => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    busy={false}
                    onRelease={() => {}}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {maintenance.length > 0 && filter !== 'in_use' && filter !== 'available' ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Bakımda ({maintenance.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {maintenance.map((v) => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    busy={false}
                    onRelease={() => {}}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
