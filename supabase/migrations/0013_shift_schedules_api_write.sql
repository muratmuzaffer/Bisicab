-- Shifts admin API uses app-level password (not Supabase Auth).
-- Allow server-side writes with the anon key (same pattern as shift_swaps).

create policy "shift_schedule_months_api_insert"
  on public.shift_schedule_months for insert
  to anon, authenticated
  with check (true);

create policy "shift_schedule_months_api_update"
  on public.shift_schedule_months for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "shift_schedule_months_api_delete"
  on public.shift_schedule_months for delete
  to anon, authenticated
  using (true);

create policy "shift_schedule_entries_api_insert"
  on public.shift_schedule_entries for insert
  to anon, authenticated
  with check (true);

create policy "shift_schedule_entries_api_update"
  on public.shift_schedule_entries for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "shift_schedule_entries_api_delete"
  on public.shift_schedule_entries for delete
  to anon, authenticated
  using (true);
