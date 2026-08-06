-- Vardiya değişimini iptal etme (kayıt silme)

drop policy if exists "shift_swaps_public_delete" on public.shift_swaps;
create policy "shift_swaps_public_delete"
  on public.shift_swaps for delete
  using (true);
