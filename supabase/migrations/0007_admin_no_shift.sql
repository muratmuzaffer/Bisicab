-- Admin hesapları mesaiye başlayamasın; mevcut açık admin mesailerini kapat.

create or replace function public.begin_shift(p_duration_hours smallint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := auth.uid();
  v_role   public.user_role;
  v_shift  uuid;
  v_start  timestamptz := now();
begin
  if v_driver is null then
    raise exception 'Giriş gerekli.';
  end if;

  select role into v_role from public.users where id = v_driver;
  if v_role is distinct from 'driver' then
    raise exception 'Yalnızca sürücü hesapları mesaiye başlayabilir.';
  end if;

  if p_duration_hours not in (4, 8) then
    raise exception 'Mesai süresi 4 veya 8 saat olmalıdır.';
  end if;

  if exists (select 1 from public.shifts where driver_id = v_driver and ended_at is null) then
    raise exception 'Zaten aktif bir mesainiz var.';
  end if;

  insert into public.shifts (
    driver_id, planned_duration_hours, planned_end_at, started_at
  )
  values (
    v_driver,
    p_duration_hours,
    public.calc_planned_shift_end(v_start, p_duration_hours),
    v_start
  )
  returning id into v_shift;

  insert into public.drivers_profiles (user_id)
  values (v_driver)
  on conflict (user_id) do nothing;

  update public.drivers_profiles
    set is_active = true, updated_at = now()
    where user_id = v_driver;

  return v_shift;
end;
$$;

-- Mevcut admin mesailerini kapat
update public.shifts s
set
  ended_at = now(),
  end_reason = 'shift_end'
from public.users u
where s.driver_id = u.id
  and u.role = 'admin'
  and s.ended_at is null;

update public.drivers_profiles dp
set is_active = false, updated_at = now()
from public.users u
where dp.user_id = u.id
  and u.role = 'admin';
