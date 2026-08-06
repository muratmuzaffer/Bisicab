-- Değişim iptali admin onayı ile: kullanıcı talep gönderir, admin onaylar/reddeder

alter table public.shift_swaps
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists cancel_requested_by text;

comment on column public.shift_swaps.cancel_requested_at is 'İptal talebi zamanı; null = talep yok';
comment on column public.shift_swaps.cancel_requested_by is 'İptali talep eden sürücü adı';

-- Talep kaydı UPDATE ile yazılır; SELECT/INSERT yeterli değil.
drop policy if exists "shift_swaps_public_update" on public.shift_swaps;
create policy "shift_swaps_public_update"
  on public.shift_swaps for update
  using (true)
  with check (true);
