-- GPS rota izi + fiş storage upsert politikaları

alter table public.trips
  add column if not exists route_path jsonb default null;

comment on column public.trips.route_path is
  'Sürüş GPS izi: [{"lat": number, "lng": number}, ...]';

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
