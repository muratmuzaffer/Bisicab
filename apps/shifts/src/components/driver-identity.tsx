'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, Loader2, Sparkles, UserRound } from 'lucide-react';
import {
  clearDriverSession,
  hasCompletedDriverSession,
  markDriverSessionComplete,
  readStoredDriverName,
  writeStoredDriverName,
} from '@/lib/driver-identity';
import { cn } from '@/lib/utils';

interface DriverIdentityValue {
  name: string;
  ready: boolean;
  setName: (name: string) => void;
  reopenWelcome: () => void;
}

const DriverIdentityContext = createContext<DriverIdentityValue | null>(null);

export function useDriverIdentity(): DriverIdentityValue {
  const ctx = useContext(DriverIdentityContext);
  if (!ctx) {
    throw new Error('useDriverIdentity, DriverIdentityProvider içinde kullanılmalı');
  }
  return ctx;
}

/** Provider yoksa boş kimlik (admin vb.). */
export function useOptionalDriverIdentity(): DriverIdentityValue | null {
  return useContext(DriverIdentityContext);
}

const SKIP_PREFIXES = ['/yonetim'];

function shouldSkipGate(pathname: string): boolean {
  return SKIP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function DriverIdentityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const skip = shouldSkipGate(pathname);

  const [name, setNameState] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);
  const [driverNames, setDriverNames] = useState<string[]>([]);
  const [namesLoading, setNamesLoading] = useState(true);

  useEffect(() => {
    setNameState(readStoredDriverName());
    setSessionOk(hasCompletedDriverSession());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (skip) {
      setNamesLoading(false);
      return;
    }

    let cancelled = false;
    setNamesLoading(true);
    fetch('/api/drivers')
      .then(async (res) => {
        const json = (await res.json()) as { names?: string[] };
        if (!cancelled) setDriverNames(json.names ?? []);
      })
      .catch(() => {
        if (!cancelled) setDriverNames([]);
      })
      .finally(() => {
        if (!cancelled) setNamesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [skip]);

  const setName = useCallback((next: string) => {
    const trimmed = next.trim();
    setNameState(trimmed);
    writeStoredDriverName(trimmed);
  }, []);

  const reopenWelcome = useCallback(() => {
    clearDriverSession();
    setSessionOk(false);
  }, []);

  const completeWelcome = useCallback(
    (selected: string) => {
      setName(selected);
      markDriverSessionComplete();
      setSessionOk(true);
      // Admin paneli için giriş kaydı — sessizce; başarısız olsa da site açılır.
      void fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverName: selected }),
      }).catch(() => undefined);
    },
    [setName]
  );

  const value = useMemo(
    () => ({
      name,
      ready: hydrated && (skip || (sessionOk && Boolean(name))),
      setName,
      reopenWelcome,
    }),
    [name, hydrated, skip, sessionOk, setName, reopenWelcome]
  );

  const showGate = hydrated && !skip && !(sessionOk && name);

  return (
    <DriverIdentityContext.Provider value={value}>
      {showGate ? (
        <WelcomeGate
          storedName={name}
          driverNames={driverNames}
          loading={namesLoading}
          onContinue={completeWelcome}
        />
      ) : (
        children
      )}
    </DriverIdentityContext.Provider>
  );
}

function WelcomeGate({
  storedName,
  driverNames,
  loading,
  onContinue,
}: {
  storedName: string;
  driverNames: string[];
  loading: boolean;
  onContinue: (name: string) => void;
}) {
  const returning = Boolean(storedName);
  const [selected, setSelected] = useState(storedName);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSelected(storedName);
  }, [storedName]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return driverNames;
    return driverNames.filter((n) => n.toLowerCase().includes(q));
  }, [driverNames, query]);

  const canContinue = Boolean(selected.trim());

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-mesh px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(245,197,24,0.28), transparent 60%), radial-gradient(ellipse 40% 30% at 100% 80%, rgba(5,150,105,0.1), transparent)',
        }}
      />

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand shadow-glow">
            <Sparkles className="h-8 w-8 text-brand-dark" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            BisiCab Vardiya
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {returning ? (
              <>
                Tekrar hoş geldin
                <span className="mt-1 block text-xl font-bold text-brand-deep sm:text-2xl">
                  {storedName}
                </span>
              </>
            ) : (
              'Hoş geldin'
            )}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Devam etmek için açılır listeden adını seç. İlan, teklif ve kendi vardiyaların bu isimle
            açılır.
          </p>
        </div>

        <div className="rounded-3xl border border-border/70 bg-white/90 p-5 shadow-elevated backdrop-blur sm:p-7">
          <label className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <UserRound className="h-4 w-4 text-brand-dark" />
            Ben kimim?
          </label>

          <div className="relative">
            <button
              type="button"
              disabled={loading}
              onClick={() => setOpen((prev) => !prev)}
              className={cn(
                'input-field flex items-center justify-between gap-3 text-left',
                !selected && 'text-muted-foreground'
              )}
            >
              <span className="truncate font-semibold">
                {loading ? 'Sürücü listesi yükleniyor…' : selected || 'Adını seç'}
              </span>
              {loading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              )}
            </button>

            {open && !loading && (
              <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-border bg-white shadow-elevated">
                <div className="border-b border-border/60 p-2">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ara…"
                    className="input-field py-2.5 text-sm"
                  />
                </div>
                <ul className="max-h-64 overflow-y-auto py-1">
                  {options.length === 0 ? (
                    <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Eşleşen isim yok
                    </li>
                  ) : (
                    options.map((option) => (
                      <li key={option}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(option);
                            setQuery('');
                            setOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-brand/10',
                            selected === option && 'bg-brand/15 font-bold'
                          )}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-sm font-black text-brand-dark">
                            {option.charAt(0)}
                          </span>
                          {option}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!canContinue || loading}
            onClick={() => onContinue(selected)}
            className="btn-primary mt-5 w-full py-3.5 text-base"
          >
            Devam et
          </button>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Her oturumda bir kez sorulur. İstediğin zaman üst menüden değiştirebilirsin.
          </p>
        </div>
      </div>
    </div>
  );
}
