'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MonthNavigator({
  label,
  onPrev,
  onNext,
  className,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex w-full max-w-[17rem] items-center rounded-2xl border border-white/10 bg-white/8 p-1 sm:max-w-none',
        className
      )}
    >
      <button
        type="button"
        onClick={onPrev}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/85 transition hover:bg-white/12 active:scale-95"
        aria-label="Önceki ay"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="min-w-0 flex-1 truncate px-2 text-center text-sm font-bold text-white">
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/85 transition hover:bg-white/12 active:scale-95"
        aria-label="Sonraki ay"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
