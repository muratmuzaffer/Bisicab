'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get('error') === 'forbidden'
      ? 'Bu hesabın yönetici (admin) yetkisi yok.'
      : null
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError || !data.user) {
        setError(signInError?.message ?? 'Giriş başarısız.');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profile?.role !== 'admin') {
        await supabase.auth.signOut();
        setError('Bu hesabın yönetici (admin) yetkisi yok.');
        return;
      }

      router.replace('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-white/10 bg-surface p-8 shadow-lg"
      >
        <h1 className="text-2xl font-extrabold text-brand">BisiCab</h1>
        <p className="mb-6 text-sm text-soft/70">Yönetim Paneli Girişi</p>

        <label className="mb-1 block text-sm font-medium text-soft">E-posta</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-4 h-10 w-full rounded-md border border-white/15 bg-brand-dark px-3 text-sm text-white placeholder:text-soft/40"
          placeholder="admin@izulas.com"
        />

        <label className="mb-1 block text-sm font-medium text-soft">Şifre</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-6 h-10 w-full rounded-md border border-white/15 bg-brand-dark px-3 text-sm text-white placeholder:text-soft/40"
          placeholder="••••••••"
        />

        {error ? (
          <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
