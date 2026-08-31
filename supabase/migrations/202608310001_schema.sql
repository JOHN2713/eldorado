-- El Dorado v0.1. Run once in a NEW Supabase project, before 002 and 003.
begin;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.business_settings (
  id integer primary key default 1 check (id = 1),
  name text not null check (length(name) between 2 and 120),
  address text not null check (length(address) between 2 and 250),
  timezone text not null default 'America/Guayaquil',
  currency text not null default 'USD' check (currency = 'USD'),
  booking_enabled boolean not null default false,
  slot_step_minutes integer not null default 5 check (slot_step_minutes between 5 and 60),
  min_notice_minutes integer not null default 0 check (min_notice_minutes between 0 and 10080),
  horizon_days integer not null default 30 check (horizon_days between 1 and 180),
  cancellation_minutes integer not null default 30 check (cancellation_minutes = 30),
  grace_minutes integer not null default 5 check (grace_minutes = 5),
  reminder_minutes integer not null default 10 check (reminder_minutes = 10)
);
create table public.user_roles (
  user_id uuid primary key references auth.users(id),
  role text not null check (role in ('admin','barber')),
  active boolean not null default true
);
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id),
  name text not null check (length(name) between 1 and 100),
  phone text check (length(phone) <= 25),
  created_at timestamptz not null default now()
);
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 100),
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  estimated_min_minutes integer not null check (estimated_min_minutes > 0),
  estimated_max_minutes integer not null check (estimated_max_minutes >= estimated_min_minutes),
  duration_minutes integer not null check (duration_minutes between 5 and 240),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 60),
  active boolean not null default true,
  sort_order integer not null default 0
);
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id),
  name text not null check (length(name) between 2 and 100),
  active boolean not null default false,
  check (not active or user_id is not null)
);
create table public.professional_services (
  professional_id uuid references public.professionals(id),
  service_id uuid references public.services(id),
  primary key (professional_id, service_id)
);
create table public.business_hours (
  weekday integer primary key check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create table public.working_intervals (
  professional_id uuid references public.professionals(id),
  weekday integer check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  primary key (professional_id, weekday),
  check (end_time > start_time)
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  professional_id uuid not null references public.professionals(id),
  service_id uuid not null references public.services(id),
  service_name text not null,
  quoted_price numeric(12,2) not null check (quoted_price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  buffer_minutes integer not null check (buffer_minutes >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  occupied_until timestamptz not null,
  cancellation_deadline timestamptz not null,
  arrival_deadline timestamptz not null,
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id),
  status text not null default 'confirmed' check (status in ('confirmed','checked_in','in_progress','completed','cancelled','no_show')),
  origin text not null default 'online' check (origin in ('online','staff','walk_in')),
  revision integer not null default 1,
  schedule_version integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (starts_at < ends_at and ends_at <= occupied_until),
  check (origin <> 'online' or customer_id is not null)
);
create table public.calendar_allocations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id),
  appointment_id uuid unique references public.appointments(id),
  kind text not null check (kind in ('appointment','break')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  reason text check (length(reason) <= 200),
  created_by uuid references auth.users(id),
  check (starts_at < ends_at),
  check ((kind = 'appointment') = (appointment_id is not null)),
  exclude using gist (professional_id with =, tstzrange(starts_at, ends_at, '[)') with &&) where (active)
);
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid unique references public.appointments(id),
  customer_id uuid references public.customers(id),
  professional_id uuid not null references public.professionals(id),
  origin text not null check (origin in ('appointment','walk_in','retrospective')),
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null check (status in ('in_progress','completed')),
  recorded_by uuid references auth.users(id),
  reason text,
  created_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= started_at)
);
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references public.visits(id),
  sold_at timestamptz not null,
  currency text not null default 'USD' check (currency = 'USD'),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  payment_method text not null check (payment_method in ('cash','bank_transfer','deuna')),
  status text not null default 'posted' check (status in ('posted','voided')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  check (status <> 'voided' or (voided_at is not null and voided_by is not null and length(void_reason) >= 5))
);
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  service_id uuid not null references public.services(id),
  service_name_snapshot text not null,
  quantity integer not null check (quantity between 1 and 10),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) generated always as (quantity * unit_price) stored
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id),
  appointment_id uuid not null references public.appointments(id),
  schedule_version integer not null,
  visible_from timestamptz not null,
  expires_at timestamptz not null,
  active boolean not null default true,
  presented_at timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,
  claim_token uuid,
  claim_until timestamptz,
  unique (recipient_user_id, appointment_id, schedule_version)
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table private.requests (
  actor_id uuid not null references auth.users(id),
  operation text not null,
  key uuid not null,
  body jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, operation, key)
);
create index appointments_staff_date on public.appointments(professional_id, starts_at);
create index appointments_customer_date on public.appointments(customer_id, starts_at);
create index sales_period on public.sales(sold_at, status);
create index notifications_recipient on public.notifications(recipient_user_id, active, visible_from);

create function private.actor_role() returns text language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then 'anon'
    when exists(select 1 from public.user_roles r where r.user_id = auth.uid() and not r.active) then 'disabled'
    else coalesce((select role from public.user_roles where user_id = auth.uid() and active), 'customer') end;
$$;
create function private.require_role(p_roles text[]) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
  if not (private.actor_role() = any(p_roles)) then raise exception 'NOT_AUTHORIZED'; end if;
end; $$;
create function private.can_manage(p_professional uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.actor_role() = 'admin' or (private.actor_role() = 'barber' and exists(select 1 from public.professionals where id = p_professional and user_id = auth.uid() and active));
$$;
create function private.lock_agenda() returns void language sql set search_path = '' as $$ select pg_advisory_xact_lock(17083101); $$;
create function private.replay(p_operation text, p_key uuid, p_body jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r private.requests;
begin
  perform private.require_role(array['customer','barber','admin']);
  if p_key is null then raise exception 'INVALID_INPUT'; end if;
  perform private.lock_agenda();
  select * into r from private.requests where actor_id = auth.uid() and operation = p_operation and key = p_key;
  if found then
    if r.body <> p_body then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return r.result;
  end if;
  return null;
end; $$;
create function private.remember(p_operation text, p_key uuid, p_body jsonb, p_result jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
begin insert into private.requests(actor_id,operation,key,body,result) values(auth.uid(),p_operation,p_key,p_body,p_result); return p_result; end; $$;
create function private.audit(p_action text, p_id uuid, p_detail jsonb default '{}') returns void language sql security definer set search_path = '' as $$
 insert into public.audit_log(actor_id,action,entity_id,detail) values(auth.uid(),p_action,p_id,p_detail);
$$;
create function private.new_customer() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.customers(auth_user_id,name,phone) values(new.id, coalesce(nullif(left(new.raw_user_meta_data->>'full_name',100),''),'Cliente'), left(new.raw_user_meta_data->>'phone',25));
  return new;
end; $$;
create trigger el_dorado_new_customer after insert on auth.users for each row execute function private.new_customer();

create function private.appointment_changed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.calendar_allocations(professional_id,appointment_id,kind,starts_at,ends_at,active,created_by)
    values(new.professional_id,new.id,'appointment',new.starts_at,new.occupied_until,new.status not in ('cancelled','no_show'),auth.uid());
  else
    update public.calendar_allocations set professional_id=new.professional_id, starts_at=new.starts_at, ends_at=new.occupied_until, active=new.status not in ('cancelled','no_show') where appointment_id=new.id;
    if new.schedule_version <> old.schedule_version or new.status in ('cancelled','no_show','completed') then
      update public.notifications set active=false where appointment_id=new.id;
    end if;
  end if;
  if new.origin <> 'walk_in' and new.status in ('confirmed','checked_in') and new.starts_at > clock_timestamp() then
    insert into public.notifications(recipient_user_id,appointment_id,schedule_version,visible_from,expires_at)
    select distinct r.user_id,new.id,new.schedule_version,greatest(clock_timestamp(),new.starts_at - interval '10 minutes'),new.starts_at
    from public.user_roles r where r.active and (r.role='admin' or (r.role='barber' and r.user_id=(select user_id from public.professionals where id=new.professional_id)))
    on conflict (recipient_user_id,appointment_id,schedule_version) do nothing;
  end if;
  perform private.audit('appointment.'||new.status,new.id,jsonb_build_object('revision',new.revision,'starts_at',new.starts_at,'origin',new.origin));
  return new;
end; $$;
create trigger el_dorado_appointment_changed after insert or update on public.appointments for each row execute function private.appointment_changed();

create function private.expire_no_shows() returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform private.lock_agenda();
  update public.appointments set status='no_show',revision=revision+1
   where status='confirmed' and checked_in_at is null and arrival_deadline < clock_timestamp();
  get diagnostics n = row_count;
  return n;
end; $$;

create function private.slot_available(p_professional uuid,p_start timestamptz,p_minutes integer,p_buffer integer,p_ignore uuid default null) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare b public.business_settings; local_start timestamp; local_end timestamp; w integer;
begin
  select * into b from public.business_settings where id=1;
  if p_professional is null or p_start is null or p_minutes < 1 or p_buffer < 0 then return false; end if;
  local_start := p_start at time zone b.timezone;
  local_end := (p_start + make_interval(mins=>p_minutes+p_buffer)) at time zone b.timezone;
  w := extract(dow from local_start);
  return local_start::date=local_end::date
    and exists(select 1 from public.professionals p join public.user_roles r on r.user_id=p.user_id where p.id=p_professional and p.active and r.active and r.role='barber')
    and exists(select 1 from public.business_hours h where h.weekday=w and local_start::time>=h.start_time and local_end::time<=h.end_time)
    and exists(select 1 from public.working_intervals h where h.professional_id=p_professional and h.weekday=w and local_start::time>=h.start_time and local_end::time<=h.end_time)
    and not exists(select 1 from public.calendar_allocations a where a.professional_id=p_professional and a.active and (p_ignore is null or a.appointment_id is distinct from p_ignore)
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_start,p_start+make_interval(mins=>p_minutes+p_buffer),'[)'));
end; $$;

create function private.require_service_professional(p_service uuid,p_professional uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.professional_services ps join public.services s on s.id=ps.service_id where ps.service_id=p_service and ps.professional_id=p_professional and s.active) then raise exception 'INVALID_INPUT'; end if;
end; $$;

-- Deny table mutations from the API. Every business write is an authorized RPC.
do $$ declare t text; begin
 foreach t in array array['business_settings','user_roles','customers','services','professionals','professional_services','business_hours','working_intervals','appointments','calendar_allocations','visits','sales','sale_items','notifications','audit_log'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy own_role on public.user_roles for select to authenticated using(user_id=auth.uid() or private.actor_role()='admin');
create policy admin_settings on public.business_settings for select to authenticated using(private.actor_role()='admin');
create policy own_customer on public.customers for select to authenticated using(auth_user_id=auth.uid() or private.actor_role()='admin' or exists(select 1 from public.appointments a where a.customer_id=customers.id and private.can_manage(a.professional_id)));
create policy read_services on public.services for select to authenticated using(active or private.actor_role()='admin');
create policy staff_professionals on public.professionals for select to authenticated using(private.can_manage(id));
create policy staff_professional_services on public.professional_services for select to authenticated using(private.can_manage(professional_id));
create policy staff_hours on public.working_intervals for select to authenticated using(private.can_manage(professional_id));
create policy read_business_hours on public.business_hours for select to authenticated using(true);
-- Customer ownership helper avoids recursive policies between customers and appointments.
create function private.owns_customer(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.customers where id=p_id and auth_user_id=auth.uid()); $$;
create policy allowed_appointment on public.appointments for select to authenticated using(private.owns_customer(customer_id) or private.can_manage(professional_id));
create policy staff_allocations on public.calendar_allocations for select to authenticated using(private.can_manage(professional_id));
create policy staff_visits on public.visits for select to authenticated using(private.can_manage(professional_id));
create policy admin_sales on public.sales for select to authenticated using(private.actor_role()='admin');
create policy admin_items on public.sale_items for select to authenticated using(private.actor_role()='admin');
create policy own_notifications on public.notifications for select to authenticated using(recipient_user_id=auth.uid() and private.actor_role() in ('admin','barber') and exists(select 1 from public.appointments a where a.id=appointment_id and private.can_manage(a.professional_id)));
create policy admin_audit on public.audit_log for select to authenticated using(private.actor_role()='admin');
revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.actor_role(),private.can_manage(uuid),private.owns_customer(uuid) to authenticated;
commit;
