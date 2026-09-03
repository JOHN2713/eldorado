-- Staff management and administrator-professionals. Run after 004.
begin;

create or replace function public.get_bootstrap() returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
  'business',(select to_jsonb(b) from public.business_settings b where id=1),
  'business_hours',coalesce((select jsonb_agg(to_jsonb(h) order by h.weekday) from public.business_hours h),'[]'::jsonb),
  'services',coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order) from public.services s where active),'[]'::jsonb),
  'professionals',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) from public.professionals p join public.user_roles r on r.user_id=p.user_id where p.active and r.active and r.role in ('barber','admin')),'[]'::jsonb));
$$;

create or replace function private.slot_available(p_professional uuid,p_start timestamptz,p_minutes integer,p_buffer integer,p_ignore uuid default null) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare b public.business_settings; local_start timestamp; local_end timestamp; w integer;
begin
  select * into b from public.business_settings where id=1;
  if p_professional is null or p_start is null or p_minutes < 1 or p_buffer < 0 then return false; end if;
  local_start := p_start at time zone b.timezone;
  local_end := (p_start + make_interval(mins=>p_minutes+p_buffer)) at time zone b.timezone;
  w := extract(dow from local_start);
  return local_start::date=local_end::date
    and exists(select 1 from public.professionals p join public.user_roles r on r.user_id=p.user_id where p.id=p_professional and p.active and r.active and r.role in ('barber','admin'))
    and exists(select 1 from public.business_hours h where h.weekday=w and local_start::time>=h.start_time and local_end::time<=h.end_time)
    and exists(select 1 from public.working_intervals h where h.professional_id=p_professional and h.weekday=w and local_start::time>=h.start_time and local_end::time<=h.end_time)
    and not exists(select 1 from public.calendar_allocations a where a.professional_id=p_professional and a.active and (p_ignore is null or a.appointment_id is distinct from p_ignore)
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_start,p_start+make_interval(mins=>p_minutes+p_buffer),'[)'));
end; $$;

create or replace function public.update_settings(p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; b public.business_settings; enabled boolean;
begin
 perform private.require_role(array['admin']);
 result:=private.replay('update_settings',p_key,p_data); if result is not null then return result; end if;
 select * into b from public.business_settings where id=1;
 if not exists(select 1 from pg_timezone_names where name=p_data->>'timezone') then raise exception 'INVALID_INPUT'; end if;
 if p_data->>'timezone'<>b.timezone and exists(select 1 from public.appointments where starts_at>clock_timestamp() and status in ('confirmed','checked_in','in_progress')) then raise exception 'INVALID_STATE'; end if;
 enabled:=coalesce((p_data->>'booking_enabled')::boolean,false);
 if enabled and (
  not exists(select 1 from public.professionals p join public.user_roles r on r.user_id=p.user_id where p.active and r.active and r.role in ('barber','admin'))
  or exists(select 1 from public.professionals p left join public.user_roles r on r.user_id=p.user_id where p.active and (r.user_id is null or not r.active or r.role not in ('barber','admin') or p.name like 'Peluquero % —%' or not exists(select 1 from public.working_intervals h where h.professional_id=p.id) or not exists(select 1 from public.professional_services ps where ps.professional_id=p.id)))
  or not exists(select 1 from public.user_roles where role='admin' and active)
 ) then raise exception 'SETUP_INCOMPLETE'; end if;
 update public.business_settings set name=btrim(p_data->>'name'),address=btrim(p_data->>'address'),timezone=p_data->>'timezone',slot_step_minutes=(p_data->>'slot_step_minutes')::integer,min_notice_minutes=(p_data->>'min_notice_minutes')::integer,horizon_days=(p_data->>'horizon_days')::integer,booking_enabled=enabled where id=1;
 perform private.audit('settings.update',null,p_data);
 return private.remember('update_settings',p_key,p_data,jsonb_build_object('ok',true));
end; $$;

create or replace function public.update_professional(p_id uuid,p_name text,p_active boolean,p_hours jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_id,p_name,p_active,p_hours); result jsonb; h jsonb; z text;
begin
 perform private.require_role(array['admin']);
 result:=private.replay('update_professional',p_key,body); if result is not null then return result; end if;
 if p_active is null or coalesce(length(btrim(p_name)),0) not between 2 and 100 or p_hours is null or jsonb_typeof(p_hours)<>'array' or jsonb_array_length(p_hours)>7 then raise exception 'INVALID_INPUT'; end if;
 if not exists(select 1 from public.professionals where id=p_id) then raise exception 'INVALID_INPUT'; end if;
 if p_active and not exists(select 1 from public.professionals p join public.user_roles r on r.user_id=p.user_id where p.id=p_id and r.active and r.role in ('barber','admin')) then raise exception 'SETUP_INCOMPLETE'; end if;
 if p_active and (jsonb_array_length(p_hours)=0 or not exists(select 1 from public.professional_services ps join public.services s on s.id=ps.service_id where ps.professional_id=p_id and s.active)) then raise exception 'SETUP_INCOMPLETE'; end if;
 perform private.expire_no_shows();
 delete from public.working_intervals where professional_id=p_id;
 for h in select value from jsonb_array_elements(p_hours) loop
  insert into public.working_intervals(professional_id,weekday,start_time,end_time) values(p_id,(h->>'weekday')::integer,(h->>'start_time')::time,(h->>'end_time')::time);
 end loop;
 select timezone into z from public.business_settings where id=1;
 if exists(select 1 from public.appointments a where a.professional_id=p_id and a.occupied_until>clock_timestamp() and a.status not in ('cancelled','no_show') and
  (not p_active or not exists(select 1 from public.working_intervals w where w.professional_id=p_id and w.weekday=extract(dow from a.starts_at at time zone z) and (a.starts_at at time zone z)::time>=w.start_time and (a.occupied_until at time zone z)::time<=w.end_time))) then raise exception 'SLOT_UNAVAILABLE'; end if;
 update public.professionals set name=btrim(p_name),active=p_active where id=p_id;
 if not p_active and not exists(select 1 from public.professionals p join public.user_roles r on r.user_id=p.user_id where p.active and r.active and r.role in ('barber','admin')) then update public.business_settings set booking_enabled=false where id=1; end if;
 perform private.audit('professional.update',p_id,body);
 return private.remember('update_professional',p_key,body,jsonb_build_object('id',p_id));
end; $$;

-- Called only by the server after it verifies the administrator's access token.
create function public.staff_management_version() returns integer language sql immutable set search_path = '' as $$ select 1; $$;
revoke execute on function public.staff_management_version() from public,anon,authenticated;
grant execute on function public.staff_management_version() to service_role;

create function public.provision_staff(p_actor uuid,p_user uuid,p_role text,p_name text,p_professional boolean,p_services uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_professional_id uuid; distinct_service_count integer;
begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='admin' and active) then raise exception 'NOT_AUTHORIZED'; end if;
 if p_user is null or p_role not in ('admin','barber') or coalesce(length(btrim(p_name)),0) not between 2 and 100 then raise exception 'INVALID_INPUT'; end if;
 if exists(select 1 from public.user_roles where user_id=p_user) then raise exception 'STAFF_EXISTS'; end if;
 p_professional:=coalesce(p_professional,false) or p_role='barber';
 if p_professional then
  if coalesce(cardinality(p_services),0)=0 then raise exception 'SERVICES_REQUIRED'; end if;
  select count(distinct s.id) into distinct_service_count from public.services s where s.active and s.id=any(p_services);
  if distinct_service_count<>cardinality(p_services) then raise exception 'INVALID_INPUT'; end if;
 end if;
 insert into public.user_roles(user_id,role,active) values(p_user,p_role,true)
 on conflict(user_id) do nothing;
 if not found then raise exception 'STAFF_EXISTS'; end if;
 if p_professional then
  insert into public.professionals(user_id,name,active) values(p_user,btrim(p_name),false)
  on conflict(user_id) do update set name=excluded.name,active=false returning id into v_professional_id;
  delete from public.professional_services where professional_id=v_professional_id;
  insert into public.professional_services(professional_id,service_id) select v_professional_id,unnest(p_services);
 end if;
 insert into public.audit_log(actor_id,action,entity_id,detail) values(p_actor,'staff.provision',p_user,jsonb_build_object('role',p_role,'professional',p_professional));
 return jsonb_build_object('user_id',p_user,'role',p_role,'professional_id',v_professional_id);
end; $$;

revoke execute on function public.provision_staff(uuid,uuid,text,text,boolean,uuid[]) from public,anon,authenticated;
grant execute on function public.provision_staff(uuid,uuid,text,text,boolean,uuid[]) to service_role;

commit;
