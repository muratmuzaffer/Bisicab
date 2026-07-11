-- Admin panelinin tüm sürüşleri görebilmesini garanti eder.
-- fix_driver_trip_history.sql yalnızca sürücü politikasını bıraktıysa admin boş görür.

drop policy if exists trips_driver_select on public.trips;
drop policy if exists trips_admin_select on public.trips;

-- Sürücü: yalnızca kendi kayıtları
create policy trips_driver_select on public.trips
  for select to authenticated
  using (
    driver_id = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'driver'
    )
  );

-- Admin: tüm kayıtlar
create policy trips_admin_select on public.trips
  for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Admin hesabını doğrula (e-postayı kendi admininizle değiştirin)
update public.users
set role = 'admin'
where email = 'murat.muzaffer@izulas.com';
