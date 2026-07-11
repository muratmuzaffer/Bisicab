-- =============================================================================
-- BisiCab - Mesai süresi (4/8 saat), araç atama geçmişi, 21:00 otomatik kapanış
-- Mesai ≠ araç: şarj bitince araç bırakılıp başka araç alınabilir.
-- =============================================================================

-- shift_end_reason: otomatik 21:00 kapanışı
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'shift_end_reason' and e.enumlabel = 'auto_21h'
  ) then
    alter type public.shift_end_reason add value 'auto_21h';
  end if;
end$$;

-- Araç bırakma nedeni
do $$
begin
  if not exists (select 1 from pg_type where typname = 'assignment_release_reason') then
    create type public.assignment_release_reason as enum (
      'driver', 'admin_force', 'auto_21h', 'shift_end'
    );
  end if;
end$$;

-- shifts: süre planı; vehicle_id artık opsiyonel (araç atamaları ayrı tabloda)
alter table public.shifts
  add column if not exists planned_duration_hours smallint,
  add column if not exists planned_end_at timestamptz;

alter table public.shifts
  alter column vehicle_id drop not null;

-- Araç kullanım kayıtları: kim, hangi araç, ne zaman aldı, ne zaman bıraktı
create table if not exists public.vehicle_assignments (
  id              uuid primary key default gen_random_uuid(),
  shift_id        uuid not null references public.shifts (id) on delete cascade,
  driver_id       uuid not null references public.users (id) on delete cascade,
  vehicle_id      uuid not null references public.vehicles (id) on delete cascade,
  assigned_at     timestamptz not null default now(),
  released_at     timestamptz,
  release_reason  public.assignment_release_reason,
  created_at      timestamptz not null default now()
);

comment on table public.vehicle_assignments is
  'Mesai içinde araç alma/bırakma geçmişi; admin denetimi için.';

create index if not exists va_shift_idx    on public.vehicle_assignments (shift_id);
create index if not exists va_driver_idx   on public.vehicle_assignments (driver_id);
create index if not exists va_vehicle_idx  on public.vehicle_assignments (vehicle_id);
create index if not exists va_assigned_idx on public.vehicle_assignments (assigned_at desc);
create index if not exists va_active_idx   on public.vehicle_assignments (driver_id)
  where released_at is null;

-- Mevcut aktif mesaileri atama tablosuna taşı
insert into public.vehicle_assignments (shift_id, driver_id, vehicle_id, assigned_at)
select s.id, s.driver_id, s.vehicle_id, s.started_at
from public.shifts s
where s.ended_at is null
  and s.vehicle_id is not null
  and not exists (
    select 1 from public.vehicle_assignments va
    where va.shift_id = s.id and va.released_at is null
  );

update public.shifts
set planned_duration_hours = coalesce(planned_duration_hours, 8),
    planned_end_at = coalesce(
      planned_end_at,
      started_at + interval '8 hours'
    )
where ended_at is null;

-- -----------------------------------------------------------------------------
-- Yardımcı: planlanan mesai bitişi (süre ile 21:00 arasından erken olan)
-- -----------------------------------------------------------------------------
create or replace function public.calc_planned_shift_end(
  p_start timestamptz,
  p_duration_hours smallint
)
returns timestamptz
language sql
immutable
as $$
  select least(
    p_start + make_interval(hours => p_duration_hours),
    (
      date_trunc('day', timezone('Europe/Istanbul', p_start))
      + interval '21 hours'
    ) at time zone 'Europe/Istanbul'
  );
$$;

-- Aktif mesaiyi getir (yardımcı)
create or replace function public._active_shift_id(p_driver uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.shifts
  where driver_id = p_driver and ended_at is null
  order by started_at desc
  limit 1;
$$;

-- Açık araç atamasını kapat + aracı serbest bırak
create or replace function public._release_assignment(
  p_assignment_id uuid,
  p_reason public.assignment_release_reason
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle uuid;
begin
  update public.vehicle_assignments
    set released_at = now(), release_reason = p_reason
    where id = p_assignment_id and released_at is null
    returning vehicle_id into v_vehicle;

  if v_vehicle is not null then
    update public.vehicles
      set status = 'available',
          current_driver_id = null,
          active_shift_id = null,
          updated_at = now()
      where id = v_vehicle;
  end if;
end;
$$;

-- Mesaiye başla (süre seçimi: 4 veya 8 saat). Araç henüz seçilmez.
create or replace function public.begin_shift(p_duration_hours smallint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := auth.uid();
  v_shift  uuid;
  v_start  timestamptz := now();
begin
  if v_driver is null then
    raise exception 'Giriş gerekli.';
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

  update public.drivers_profiles
    set is_active = true, updated_at = now()
    where user_id = v_driver;

  return v_shift;
end;
$$;

-- Aktif mesaide araç al
create or replace function public.take_vehicle(p_vehicle_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver     uuid := auth.uid();
  v_shift      uuid;
  v_status     public.vehicle_status;
  v_assignment uuid;
begin
  if v_driver is null then
    raise exception 'Giriş gerekli.';
  end if;

  v_shift := public._active_shift_id(v_driver);
  if v_shift is null then
    raise exception 'Önce mesaiye başlamalısınız.';
  end if;

  if exists (
    select 1 from public.vehicle_assignments
    where shift_id = v_shift and released_at is null
  ) then
    raise exception 'Zaten bir aracınız var. Önce aracı bırakın.';
  end if;

  select status into v_status from public.vehicles where id = p_vehicle_id for update;
  if v_status is null then
    raise exception 'Araç bulunamadı.';
  end if;
  if v_status <> 'available' then
    raise exception 'Araç şu an müsait değil.';
  end if;

  insert into public.vehicle_assignments (shift_id, driver_id, vehicle_id)
  values (v_shift, v_driver, p_vehicle_id)
  returning id into v_assignment;

  update public.shifts set vehicle_id = p_vehicle_id where id = v_shift;

  update public.vehicles
    set status = 'in_use',
        current_driver_id = v_driver,
        active_shift_id = v_shift,
        updated_at = now()
    where id = p_vehicle_id;

  return v_assignment;
end;
$$;

-- Sadece aracı bırak (mesai devam eder)
create or replace function public.release_vehicle()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver     uuid := auth.uid();
  v_shift      uuid;
  v_assignment uuid;
begin
  if v_driver is null then
    raise exception 'Giriş gerekli.';
  end if;

  v_shift := public._active_shift_id(v_driver);
  if v_shift is null then
    raise exception 'Aktif mesainiz yok.';
  end if;

  select id into v_assignment
  from public.vehicle_assignments
  where shift_id = v_shift and released_at is null
  order by assigned_at desc
  limit 1;

  if v_assignment is null then
    raise exception 'Bırakılacak aktif araç yok.';
  end if;

  perform public._release_assignment(v_assignment, 'driver');
  update public.shifts set vehicle_id = null where id = v_shift;
end;
$$;

-- Mesaiyi bitir (varsa aracı da bırakır)
create or replace function public.end_shift()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver     uuid := auth.uid();
  v_shift      uuid;
  v_assignment uuid;
begin
  if v_driver is null then
    raise exception 'Giriş gerekli.';
  end if;

  v_shift := public._active_shift_id(v_driver);
  if v_shift is null then
    return;
  end if;

  select id into v_assignment
  from public.vehicle_assignments
  where shift_id = v_shift and released_at is null
  limit 1;

  if v_assignment is not null then
    perform public._release_assignment(v_assignment, 'shift_end');
  end if;

  update public.shifts
    set ended_at = now(), end_reason = 'driver', vehicle_id = null
    where id = v_shift;

  update public.drivers_profiles
    set is_active = false, updated_at = now()
    where user_id = v_driver;
end;
$$;

-- Eski API uyumluluğu: tek adımda mesai + araç (8 saat varsayılan)
create or replace function public.start_shift(p_vehicle_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift uuid;
begin
  v_shift := public.begin_shift(8);
  perform public.take_vehicle(p_vehicle_id);
  return v_shift;
end;
$$;

-- Admin: aracı zorla geri al (mesaiyi bitirmez)
create or replace function public.admin_release_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment uuid;
  v_shift      uuid;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz işlem.';
  end if;

  select va.id, va.shift_id into v_assignment, v_shift
  from public.vehicle_assignments va
  where va.vehicle_id = p_vehicle_id and va.released_at is null
  order by va.assigned_at desc
  limit 1;

  if v_assignment is not null then
    perform public._release_assignment(v_assignment, 'admin_force');
    update public.shifts set vehicle_id = null where id = v_shift;
  else
    update public.vehicles
      set status = 'available', current_driver_id = null, active_shift_id = null, updated_at = now()
      where id = p_vehicle_id;
  end if;
end;
$$;

-- Her akşam 21:00: tüm aktif mesaileri ve araçları kapat
create or replace function public.auto_close_all_shifts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift record;
  v_count integer := 0;
  v_assignment uuid;
begin
  for v_shift in
    select id, driver_id from public.shifts where ended_at is null
  loop
    select id into v_assignment
    from public.vehicle_assignments
    where shift_id = v_shift.id and released_at is null
    limit 1;

    if v_assignment is not null then
      perform public._release_assignment(v_assignment, 'auto_21h');
    end if;

    update public.shifts
      set ended_at = now(), end_reason = 'auto_21h', vehicle_id = null
      where id = v_shift.id;

    update public.drivers_profiles
      set is_active = false, updated_at = now()
      where user_id = v_shift.driver_id;

    v_count := v_count + 1;
  end loop;

  -- Yetim in_use araçları da serbest bırak
  update public.vehicles
    set status = 'available', current_driver_id = null, active_shift_id = null, updated_at = now()
    where status = 'in_use';

  return v_count;
end;
$$;

-- Aktif mesai + güncel araç bilgisi
-- Dönüş tipi değiştiği için önce drop gerekir.
drop function if exists public.get_my_active_shift();

create or replace function public.get_my_active_shift()
returns table (
  shift_id uuid,
  vehicle_id uuid,
  plate text,
  label text,
  started_at timestamptz,
  planned_duration_hours smallint,
  planned_end_at timestamptz,
  has_vehicle boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    va.vehicle_id,
    v.plate,
    v.label,
    s.started_at,
    s.planned_duration_hours,
    s.planned_end_at,
    (va.id is not null) as has_vehicle
  from public.shifts s
  left join lateral (
    select va2.id, va2.vehicle_id
    from public.vehicle_assignments va2
    where va2.shift_id = s.id and va2.released_at is null
    order by va2.assigned_at desc
    limit 1
  ) va on true
  left join public.vehicles v on v.id = va.vehicle_id
  where s.driver_id = auth.uid()
    and s.ended_at is null
  order by s.started_at desc
  limit 1;
$$;

grant execute on function public.begin_shift(smallint) to authenticated;
grant execute on function public.take_vehicle(uuid) to authenticated;
grant execute on function public.release_vehicle() to authenticated;
grant execute on function public.auto_close_all_shifts() to authenticated;

-- RLS: vehicle_assignments
alter table public.vehicle_assignments enable row level security;

drop policy if exists va_select on public.vehicle_assignments;
create policy va_select on public.vehicle_assignments
  for select to authenticated
  using (driver_id = auth.uid() or public.is_admin());

-- Realtime (opsiyonel)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vehicle_assignments'
  ) then
    alter publication supabase_realtime add table public.vehicle_assignments;
  end if;
end$$;

alter table public.vehicle_assignments replica identity full;

-- pg_cron: her gün 21:00 Türkiye saati (18:00 UTC)
-- Supabase Dashboard → Database → Extensions → pg_cron etkinleştirin.
do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception
  when others then
    raise notice 'pg_cron etkinleştirilemedi; 21:00 otomatik kapanış için Dashboard''dan pg_cron açın.';
end$$;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'bisicab-auto-close-21';

  perform cron.schedule(
    'bisicab-auto-close-21',
    '0 18 * * *',
    $cron$select public.auto_close_all_shifts();$cron$
  );
exception
  when others then
    raise notice 'pg_cron zamanlayıcısı kurulamadı. auto_close_all_shifts() elle veya Edge Function ile çağrılabilir.';
end$$;
