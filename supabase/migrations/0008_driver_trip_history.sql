-- Sürücüler mobil uygulamada yalnızca kendi sürüş geçmişini görsün.
-- Admin paneli ayrı politika ile tüm kayıtları okumaya devam eder.

-- SELECT: sürücü → yalnızca kendi satırları
drop policy if exists trips_driver_select on public.trips;
create policy trips_driver_select on public.trips
  for select to authenticated
  using (
    driver_id = auth.uid()
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'driver'
    )
  );

-- SELECT: admin → tüm kayıtlar
drop policy if exists trips_admin_select on public.trips;
create policy trips_admin_select on public.trips
  for select to authenticated
  using (public.is_admin());

-- Mobil geçmiş ekranı: oturum açmış sürücünün kayıtları (sunucu tarafı filtre)
create or replace function public.get_my_trip_history(p_limit int default 100)
returns setof public.trips
language sql
stable
security invoker
set search_path = public
as $$
  select t.*
  from public.trips t
  where t.driver_id = auth.uid()
    and t.status in ('completed', 'cancelled')
  order by t.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

grant execute on function public.get_my_trip_history(int) to authenticated;
