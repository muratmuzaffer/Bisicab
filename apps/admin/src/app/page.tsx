'use client';

import { useEffect, useState } from 'react';
import { Bike, Wallet, Route } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { formatFare } from '@bisicab/shared';

interface Stats {
  activeBikes: number;
  todayRevenue: number;
  todayKm: number;
  todayRides: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    activeBikes: 0,
    todayRevenue: 0,
    todayKm: 0,
    todayRides: 0,
  });

  useEffect(() => {
    const load = async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [{ count: activeBikes }, { data: trips }] = await Promise.all([
        supabase
          .from('drivers_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase
          .from('trips')
          .select('total_amount, total_distance')
          .eq('status', 'completed')
          .gte('created_at', startOfDay.toISOString()),
      ]);

      const rows = trips ?? [];
      setStats({
        activeBikes: activeBikes ?? 0,
        todayRevenue: rows.reduce((s, r) => s + Number(r.total_amount), 0),
        todayKm: rows.reduce((s, r) => s + Number(r.total_distance), 0),
        todayRides: rows.length,
      });
    };
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const cards = [
    {
      title: 'Aktif BisiCab',
      value: String(stats.activeBikes),
      icon: Bike,
      color: 'text-brand-dark',
    },
    {
      title: 'Günlük Ciro',
      value: formatFare(stats.todayRevenue),
      icon: Wallet,
      color: 'text-success',
    },
    {
      title: 'Günlük Toplam KM',
      value: `${stats.todayKm.toFixed(2)} km`,
      icon: Route,
      color: 'text-brand',
    },
    {
      title: 'Günlük Sürüş',
      value: String(stats.todayRides),
      icon: Route,
      color: 'text-foreground',
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ title, value, icon: Icon, color }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{title}</CardTitle>
              <Icon className={`h-5 w-5 ${color}`} />
            </CardHeader>
            <CardContent>
              <span className={`text-3xl font-extrabold ${color}`}>{value}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
