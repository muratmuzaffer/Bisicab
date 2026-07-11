import Link from 'next/link';
import { LayoutDashboard, MapPin, ListChecks, Bike, History } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase-server';
import { SignOutButton } from '@/components/sign-out-button';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/live', label: 'Canlı Takip', icon: MapPin },
  { href: '/vehicles', label: 'Araçlar', icon: Bike },
  { href: '/usage', label: 'Araç Kullanımı', icon: History },
  { href: '/trips', label: 'Sürüş Denetimi', icon: ListChecks },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let name = user?.email ?? '';
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single();
    if (data?.full_name) name = data.full_name;
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="flex w-60 shrink-0 flex-col bg-brand-dark text-white">
        <div className="p-6">
          <span className="text-2xl font-extrabold text-brand">BisiCab</span>
          <p className="text-xs text-soft/70">Yönetim Paneli</p>
        </div>
        <nav className="flex-1 px-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-soft hover:bg-white/10 hover:text-brand"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <p className="mb-2 px-3 text-xs text-soft/60">{name}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
