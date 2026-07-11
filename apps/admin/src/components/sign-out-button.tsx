'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function SignOutButton() {
  const router = useRouter();

  const onSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <button
      onClick={onSignOut}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-danger hover:bg-danger/20"
    >
      <LogOut className="h-4 w-4" />
      Çıkış Yap
    </button>
  );
}
