-- Fiş yükleme (upsert) + GPS rota kaydı + durak kolonları
-- Supabase SQL Editor'da TEK SEFERDE çalıştırın.

-- -----------------------------------------------------------------------------
-- 1) trips kolonları
-- -----------------------------------------------------------------------------
alter table public.trips
  add column if not exists route_stops text[] default null,
  add column if not exists passenger_child_male smallint not null default 0,
  add column if not exists passenger_child_female smallint not null default 0,
  add column if not exists route_path jsonb default null;

comment on column public.trips.route_stops is 'Sıralı durak id listesi (en fazla 6).';
comment on column public.trips.route_path is
  'Sürüş GPS izi: [{"lat": number, "lng": number}, ...]';

-- -----------------------------------------------------------------------------
-- 2) Fiş storage RLS — upsert için UPDATE (+ gerekirse DELETE)
-- -----------------------------------------------------------------------------
drop policy if exists receipts_driver_update on storage.objects;
create policy receipts_driver_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists receipts_driver_delete on storage.objects;
create policy receipts_driver_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- INSERT politikasını yeniden oluştur (eksikse)
drop policy if exists receipts_driver_insert on storage.objects;
create policy receipts_driver_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

notify pgrst, 'reload schema';
