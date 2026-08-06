-- İptal talebi UPDATE ile yazılır; RLS'de update politikası yoksa talep kaydedilemez.

alter table public.shift_swaps
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists cancel_requested_by text;

drop policy if exists "shift_swaps_public_update" on public.shift_swaps;
create policy "shift_swaps_public_update"
  on public.shift_swaps for update
  using (true)
  with check (true);
