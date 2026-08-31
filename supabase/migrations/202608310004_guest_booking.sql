-- v0.2: guests do NOT create Auth users. Apply after 001, 002 and 003.
begin;
alter table public.customers add column email text check (email is null or length(email) <= 254);
create index customers_email_lookup on public.customers(email);
create index customers_phone_lookup on public.customers(phone);
alter table public.business_settings add column guest_max_upcoming integer not null default 3 check (guest_max_upcoming between 1 and 10);
-- Force a deliberate review of the new public gateway before reopening bookings.
update public.business_settings set booking_enabled=false where id=1;

create table private.guest_access (
 token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
 appointment_id uuid not null unique references public.appointments(id),
 request_id uuid not null unique,
 request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
create table private.guest_rate_limits (
 key text primary key,
 requests integer not null,
 expires_at timestamptz not null
);
create index guest_limits_expiry on private.guest_rate_limits(expires_at);
revoke all on private.guest_access,private.guest_rate_limits from public,anon,authenticated,service_role;

-- Disabling signup in Auth settings is ALSO required; removing UI alone is insufficient.
-- Existing records are retained. Former customer Auth sessions cannot use business RPCs.
create or replace function private.require_role(p_roles text[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 if private.actor_role() not in ('barber','admin') or not (private.actor_role()=any(p_roles)) then raise exception 'NOT_AUTHORIZED'; end if;
end; $$;
create or replace function private.owns_customer(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select false; $$;
drop policy own_customer on public.customers;
create policy staff_customers on public.customers for select to authenticated using(private.actor_role()='admin' or exists(select 1 from public.appointments a where a.customer_id=customers.id and private.can_manage(a.professional_id)));
revoke execute on function public.create_booking(uuid,uuid,timestamptz,uuid) from public,anon,authenticated,service_role;
revoke execute on function public.get_available_slots(uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.get_available_slots(uuid,date,uuid) to service_role;

create or replace function public.list_appointments(p_date date default null,p_professional uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare z text; result jsonb;
begin
 perform private.require_role(array['barber','admin']);
 perform private.expire_no_shows();
 select timezone into z from public.business_settings where id=1;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at),'[]') into result from (
  select a.*,p.name as professional_name,c.name as customer_name,c.phone as customer_phone,c.email as customer_email,v.id as visit_id,s.id as sale_id
  from public.appointments a join public.professionals p on p.id=a.professional_id
  left join public.customers c on c.id=a.customer_id left join public.visits v on v.appointment_id=a.id left join public.sales s on s.visit_id=v.id
  where private.can_manage(a.professional_id) and (p_date is null or (a.starts_at at time zone z)::date=p_date)
   and (p_professional is null or a.professional_id=p_professional)
  order by a.starts_at desc limit 250
 ) q;
 return result;
end; $$;

-- Called only by the trusted HTTP server, in its own transaction (failed attempts count).
create function public.guest_request_gate(p_subject text,p_kind text) returns boolean language plpgsql security definer set search_path='' as $$
declare k text; n integer; cap integer;
begin
 if p_subject is null or p_subject !~ '^[a-f0-9]{64}$' or p_kind not in ('create','manage') or p_kind is null then raise exception 'INVALID_INPUT'; end if;
 perform private.lock_agenda();
 delete from private.guest_rate_limits where expires_at<clock_timestamp();
 k:=p_kind||':'||p_subject||':'||floor(extract(epoch from clock_timestamp())/600)::text;
 cap:=case when p_kind='create' then 10 else 120 end;
 insert into private.guest_rate_limits(key,requests,expires_at) values(k,1,clock_timestamp()+interval '20 minutes')
 on conflict(key) do update set requests=least(private.guest_rate_limits.requests+1,1000000) returning requests into n;
 return n<=cap;
end; $$;

create function private.guest_appointment(p_hash text) returns public.appointments language plpgsql security definer set search_path='' as $$
declare a public.appointments;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'RESERVATION_NOT_FOUND'; end if;
 select x.* into a from public.appointments x join private.guest_access g on g.appointment_id=x.id where g.token_hash=p_hash and x.starts_at>clock_timestamp()-interval '30 days';
 if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
 return a;
end; $$;
create function public.view_guest_booking(p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments;
begin
 perform private.expire_no_shows();
 a:=private.guest_appointment(p_token_hash);
 return jsonb_build_object('id',a.id,'starts_at',a.starts_at,'ends_at',a.ends_at,'status',a.status,'service_name',a.service_name,'quoted_price',a.quoted_price,'cancellation_deadline',a.cancellation_deadline,'origin',a.origin,
 'professional_name',(select name from public.professionals where id=a.professional_id),
 'customer_name',(select name from public.customers where id=a.customer_id));
end; $$;
create function public.create_guest_booking(p_service uuid,p_professional uuid,p_start timestamptz,p_name text,p_phone text,p_email text,p_token_hash text,p_request_id uuid,p_request_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare g private.guest_access; b public.business_settings; s public.services; h public.business_hours; t timestamp; c uuid; a public.appointments;
begin
 perform private.lock_agenda();
 if p_request_id is null or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$'
  or coalesce(length(btrim(p_name)),0) not between 2 and 100
  or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$'
  or p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_INPUT'; end if;
 select * into g from private.guest_access where request_id=p_request_id;
 if found then
  if g.token_hash<>p_token_hash or g.request_hash<>p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return public.view_guest_booking(p_token_hash);
 end if;
 if exists(select 1 from private.guest_access where token_hash=p_token_hash) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 perform private.expire_no_shows();
 select * into b from public.business_settings where id=1;
 if not b.booking_enabled then raise exception 'BOOKING_DISABLED'; end if;
 perform private.require_service_professional(p_service,p_professional);
 select * into s from public.services where id=p_service;
 t:=p_start at time zone b.timezone;
 select * into h from public.business_hours where weekday=extract(dow from t);
 if p_start is null or p_start<clock_timestamp()+make_interval(mins=>b.min_notice_minutes)
  or t::date>(clock_timestamp() at time zone b.timezone)::date+b.horizon_days
  or extract(epoch from (t::time-h.start_time))::numeric % (b.slot_step_minutes*60)<>0 then raise exception 'INVALID_INPUT'; end if;
 if not private.slot_available(p_professional,p_start,s.duration_minutes,s.buffer_minutes) then raise exception 'SLOT_UNAVAILABLE'; end if;
 if (select count(*) from public.appointments x join public.customers y on y.id=x.customer_id
     where x.status in ('confirmed','checked_in') and x.starts_at>clock_timestamp() and (y.phone=p_phone or y.email=lower(btrim(p_email))))>=b.guest_max_upcoming then raise exception 'CONTACT_LIMIT'; end if;
 -- Unverified contact is NOT a shared identity. Never merge or expose someone else's history.
 insert into public.customers(name,phone,email) values(btrim(p_name),p_phone,lower(btrim(p_email))) returning id into c;
 a:=private.make_appointment(p_service,p_professional,p_start,c,'online','confirmed');
 insert into private.guest_access(token_hash,appointment_id,request_id,request_hash) values(p_token_hash,a.id,p_request_id,p_request_hash);
 perform private.audit('guest.booking',a.id);
 return public.view_guest_booking(p_token_hash);
end; $$;
create function public.cancel_guest_booking(p_token_hash text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments;
begin
 perform private.lock_agenda();
 a:=private.guest_appointment(p_token_hash);
 if a.status='cancelled' then return public.view_guest_booking(p_token_hash); end if;
 if a.status<>'confirmed' then raise exception 'INVALID_STATE'; end if;
 if clock_timestamp()>a.cancellation_deadline then raise exception 'CANCELLATION_CLOSED'; end if;
 if length(coalesce(p_reason,''))>200 then raise exception 'INVALID_INPUT'; end if;
 update public.appointments set status='cancelled',revision=revision+1 where id=a.id;
 perform private.audit('guest.cancel',a.id,jsonb_build_object('reason',p_reason));
 return public.view_guest_booking(p_token_hash);
end; $$;

revoke all on function private.guest_appointment(text) from public,anon,authenticated,service_role;
revoke all on function public.guest_request_gate(text,text),public.view_guest_booking(text),public.create_guest_booking(uuid,uuid,timestamptz,text,text,text,text,uuid,text),public.cancel_guest_booking(text,text) from public,anon,authenticated,service_role;
grant execute on function public.guest_request_gate(text,text),public.view_guest_booking(text),public.create_guest_booking(uuid,uuid,timestamptz,text,text,text,text,uuid,text),public.cancel_guest_booking(text,text) to service_role;
commit;
