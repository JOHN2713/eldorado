-- Business API: run after 001. All mutations are atomic and authorized.
begin;
create function public.get_bootstrap() returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
  'business',(select to_jsonb(b) from public.business_settings b where id=1),
  'business_hours',coalesce((select jsonb_agg(to_jsonb(h) order by h.weekday) from public.business_hours h),'[]'::jsonb),
  'services',coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order) from public.services s where active),'[]'::jsonb),
  'professionals',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) from public.professionals p join public.user_roles r on r.user_id=p.user_id where p.active and r.active and r.role='barber'),'[]'::jsonb));
$$;
create function public.get_identity() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_role(array['customer','barber','admin']);
 return jsonb_build_object('user_id',auth.uid(),'role',private.actor_role(),'name',(select name from public.customers where auth_user_id=auth.uid()),'professional_id',(select id from public.professionals where user_id=auth.uid() and active));
end; $$;
create function public.get_available_slots(p_service uuid,p_date date,p_professional uuid default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.business_settings; s public.services; result jsonb;
begin
 perform private.expire_no_shows();
 select * into b from public.business_settings where id=1;
 select * into s from public.services where id=p_service and active;
 if not found or p_date is null then raise exception 'INVALID_INPUT'; end if;
 if not b.booking_enabled then return '[]'; end if;
 if p_date < (clock_timestamp() at time zone b.timezone)::date or p_date > (clock_timestamp() at time zone b.timezone)::date + b.horizon_days then return '[]'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('starts_at',q.starts_at,'professional_id',q.professional_id) order by q.starts_at),'[]') into result
 from (
  select distinct on (t.slot) t.slot as starts_at,p.id as professional_id
  from public.business_hours h
  cross join lateral generate_series((p_date+h.start_time) at time zone b.timezone,(p_date+h.end_time) at time zone b.timezone,make_interval(mins=>b.slot_step_minutes)) t(slot)
  cross join public.professionals p
  join public.professional_services ps on ps.professional_id=p.id and ps.service_id=p_service
  where h.weekday=extract(dow from p_date) and (p_professional is null or p.id=p_professional)
   and t.slot >= clock_timestamp()+make_interval(mins=>b.min_notice_minutes)
   and private.slot_available(p.id,t.slot,s.duration_minutes,s.buffer_minutes)
  order by t.slot,p.id
 ) q;
 return result;
end; $$;
create function private.make_appointment(p_service uuid,p_professional uuid,p_start timestamptz,p_customer uuid,p_origin text,p_status text) returns public.appointments language plpgsql security definer set search_path = '' as $$
declare s public.services; a public.appointments;
begin
 select * into s from public.services where id=p_service and active;
 if not found then raise exception 'INVALID_INPUT'; end if;
 insert into public.appointments(customer_id,professional_id,service_id,service_name,quoted_price,duration_minutes,buffer_minutes,starts_at,ends_at,occupied_until,cancellation_deadline,arrival_deadline,origin,status,created_by,checked_in_at,checked_in_by)
 values(p_customer,p_professional,s.id,s.name,s.price,s.duration_minutes,s.buffer_minutes,p_start,p_start+make_interval(mins=>s.duration_minutes),p_start+make_interval(mins=>s.duration_minutes+s.buffer_minutes),p_start-interval '30 minutes',p_start+interval '5 minutes',p_origin,p_status,auth.uid(),case when p_status='in_progress' then clock_timestamp() end,case when p_status='in_progress' then auth.uid() end)
 returning * into a;
 return a;
end; $$;
create function public.create_booking(p_service uuid,p_professional uuid,p_start timestamptz,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_service,p_professional,p_start); result jsonb; b public.business_settings; s public.services; c uuid; a public.appointments; local_start timestamp; h public.business_hours;
begin
 result:=private.replay('create_booking',p_key,body); if result is not null then return result; end if;
 perform private.expire_no_shows();
 select * into b from public.business_settings where id=1;
 if not b.booking_enabled then raise exception 'BOOKING_DISABLED'; end if;
 perform private.require_service_professional(p_service,p_professional);
 select * into s from public.services where id=p_service;
 select id into c from public.customers where auth_user_id=auth.uid();
 if c is null or p_start is null then raise exception 'INVALID_INPUT'; end if;
 local_start:=p_start at time zone b.timezone;
 select * into h from public.business_hours where weekday=extract(dow from local_start);
 if p_start < clock_timestamp()+make_interval(mins=>b.min_notice_minutes)
  or local_start::date>(clock_timestamp() at time zone b.timezone)::date+b.horizon_days
  or extract(epoch from (local_start::time-h.start_time))::numeric % (b.slot_step_minutes*60) <> 0 then raise exception 'INVALID_INPUT'; end if;
 if not private.slot_available(p_professional,p_start,s.duration_minutes,s.buffer_minutes) then raise exception 'SLOT_UNAVAILABLE'; end if;
 if (select count(*) from public.appointments where customer_id=c and status in ('confirmed','checked_in') and starts_at>clock_timestamp())>=5 then raise exception 'INVALID_INPUT'; end if;
 a:=private.make_appointment(p_service,p_professional,p_start,c,'online','confirmed');
 return private.remember('create_booking',p_key,body,to_jsonb(a));
end; $$;
create function public.list_appointments(p_date date default null,p_professional uuid default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare z text; result jsonb;
begin
 perform private.require_role(array['customer','barber','admin']);
 perform private.expire_no_shows();
 select timezone into z from public.business_settings where id=1;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at),'[]') into result from (
  select a.*,p.name as professional_name,c.name as customer_name,v.id as visit_id,s.id as sale_id
  from public.appointments a join public.professionals p on p.id=a.professional_id
  left join public.customers c on c.id=a.customer_id left join public.visits v on v.appointment_id=a.id left join public.sales s on s.visit_id=v.id
  where (private.can_manage(a.professional_id) or (private.actor_role()='customer' and c.auth_user_id=auth.uid()))
   and (p_date is null or (a.starts_at at time zone z)::date=p_date)
   and (p_professional is null or a.professional_id=p_professional)
  order by a.starts_at desc limit 250
 ) q;
 return result;
end; $$;
create function public.cancel_booking(p_id uuid,p_reason text,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_id,p_reason); result jsonb; a public.appointments;
begin
 result:=private.replay('cancel_booking',p_key,body); if result is not null then return result; end if;
 select * into a from public.appointments where id=p_id for update;
 if not found or not (private.owns_customer(a.customer_id) or private.can_manage(a.professional_id)) then raise exception 'NOT_AUTHORIZED'; end if;
 if a.status<>'confirmed' then raise exception 'INVALID_STATE'; end if;
 if clock_timestamp()>a.cancellation_deadline then raise exception 'CANCELLATION_CLOSED'; end if;
 if length(p_reason)>200 then raise exception 'INVALID_INPUT'; end if;
 update public.appointments set status='cancelled',revision=revision+1 where id=p_id;
 perform private.audit('appointment.cancel',p_id,jsonb_build_object('reason',p_reason));
 return private.remember('cancel_booking',p_key,body,jsonb_build_object('id',p_id));
end; $$;
create function public.reschedule_booking(p_id uuid,p_revision integer,p_date date,p_time time,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_id,p_revision,p_date,p_time); result jsonb; a public.appointments; b public.business_settings; t timestamptz;
begin
 perform private.require_role(array['barber','admin']);
 result:=private.replay('reschedule_booking',p_key,body); if result is not null then return result; end if;
 select * into a from public.appointments where id=p_id for update;
 if not found or not private.can_manage(a.professional_id) then raise exception 'NOT_AUTHORIZED'; end if;
 if a.revision<>p_revision then raise exception 'STALE_VERSION'; end if;
 if a.status<>'confirmed' then raise exception 'INVALID_STATE'; end if;
 if clock_timestamp()>a.cancellation_deadline then raise exception 'CANCELLATION_CLOSED'; end if;
 select * into b from public.business_settings where id=1;
 t:=(p_date+p_time) at time zone b.timezone;
 perform private.expire_no_shows();
 if t<clock_timestamp()+make_interval(mins=>b.min_notice_minutes) or p_date>(clock_timestamp() at time zone b.timezone)::date+b.horizon_days then raise exception 'INVALID_INPUT'; end if;
 if not private.slot_available(a.professional_id,t,a.duration_minutes,a.buffer_minutes,a.id) then raise exception 'SLOT_UNAVAILABLE'; end if;
 update public.appointments set starts_at=t,ends_at=t+make_interval(mins=>a.duration_minutes),occupied_until=t+make_interval(mins=>a.duration_minutes+a.buffer_minutes),cancellation_deadline=t-interval '30 minutes',arrival_deadline=t+interval '5 minutes',revision=revision+1,schedule_version=schedule_version+1 where id=p_id;
 return private.remember('reschedule_booking',p_key,body,jsonb_build_object('id',p_id));
end; $$;
create function public.transition_appointment(p_id uuid,p_action text,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_id,p_action); result jsonb; a public.appointments; v uuid;
begin
 perform private.require_role(array['barber','admin']);
 result:=private.replay('transition_appointment',p_key,body); if result is not null then return result; end if;
 select * into a from public.appointments where id=p_id for update;
 if not found or not private.can_manage(a.professional_id) then raise exception 'NOT_AUTHORIZED'; end if;
 if p_action='check_in' then
  if a.status<>'confirmed' then raise exception 'INVALID_STATE'; end if;
  if clock_timestamp()>a.arrival_deadline then raise exception 'ARRIVAL_EXPIRED'; end if;
  if clock_timestamp()<a.starts_at-interval '60 minutes' then raise exception 'INVALID_INPUT'; end if;
  update public.appointments set status='checked_in',checked_in_at=clock_timestamp(),checked_in_by=auth.uid(),revision=revision+1 where id=p_id;
 elsif p_action='start' then
  if a.status<>'checked_in' then raise exception 'INVALID_STATE'; end if;
  -- Arrival can be early; starting must not leave an unrecorded occupied gap.
  if clock_timestamp()<a.starts_at then raise exception 'START_TOO_EARLY'; end if;
  if not private.slot_available(a.professional_id,clock_timestamp(),a.duration_minutes,a.buffer_minutes,a.id) then raise exception 'SLOT_UNAVAILABLE'; end if;
  update public.appointments set status='in_progress',occupied_until=greatest(occupied_until,clock_timestamp()+make_interval(mins=>a.duration_minutes+a.buffer_minutes)),revision=revision+1 where id=p_id;
  insert into public.visits(appointment_id,customer_id,professional_id,origin,started_at,status,recorded_by) values(a.id,a.customer_id,a.professional_id,'appointment',clock_timestamp(),'in_progress',auth.uid()) returning id into v;
 elsif p_action='finish' then
  if a.status<>'in_progress' then raise exception 'INVALID_STATE'; end if;
  update public.visits set status='completed',completed_at=clock_timestamp() where appointment_id=p_id returning id into v;
  update public.appointments set status='completed',revision=revision+1 where id=p_id;
 else raise exception 'INVALID_INPUT';
 end if;
 return private.remember('transition_appointment',p_key,body,jsonb_build_object('id',p_id,'visit_id',v));
end; $$;

create function public.create_break(p_professional uuid,p_date date,p_start time,p_end time,p_reason text,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_professional,p_date,p_start,p_end,p_reason); result jsonb; z text; t1 timestamptz; t2 timestamptz; bid uuid;
begin
 perform private.require_role(array['barber','admin']);
 result:=private.replay('create_break',p_key,body); if result is not null then return result; end if;
 if not private.can_manage(p_professional) then raise exception 'NOT_AUTHORIZED'; end if;
 if p_date is null or p_start is null or p_end is null or p_end<=p_start or coalesce(length(btrim(p_reason)),0) not between 1 and 200 then raise exception 'INVALID_INPUT'; end if;
 perform private.expire_no_shows();
 select timezone into z from public.business_settings where id=1;
 t1:=(p_date+p_start) at time zone z; t2:=(p_date+p_end) at time zone z;
 if t2<=clock_timestamp() then raise exception 'INVALID_INPUT'; end if;
 if exists(select 1 from public.calendar_allocations where professional_id=p_professional and active and tstzrange(starts_at,ends_at,'[)') && tstzrange(t1,t2,'[)')) then raise exception 'SLOT_UNAVAILABLE'; end if;
 insert into public.calendar_allocations(professional_id,kind,starts_at,ends_at,reason,created_by) values(p_professional,'break',t1,t2,btrim(p_reason),auth.uid()) returning id into bid;
 perform private.audit('break.create',bid,jsonb_build_object('professional_id',p_professional,'starts_at',t1,'ends_at',t2));
 return private.remember('create_break',p_key,body,jsonb_build_object('id',bid));
end; $$;
create function public.list_breaks(p_date date) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; z text;
begin
 perform private.require_role(array['barber','admin']);
 select timezone into z from public.business_settings where id=1;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'professional_name',p.name,'starts_at',a.starts_at,'ends_at',a.ends_at,'reason',a.reason) order by a.starts_at),'[]') into result
 from public.calendar_allocations a join public.professionals p on p.id=a.professional_id where a.kind='break' and a.active and private.can_manage(a.professional_id) and (a.starts_at at time zone z)::date=p_date;
 return result;
end; $$;
create function public.remove_break(p_id uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_id); result jsonb; a public.calendar_allocations;
begin
 perform private.require_role(array['barber','admin']);
 result:=private.replay('remove_break',p_key,body); if result is not null then return result; end if;
 select * into a from public.calendar_allocations where id=p_id and kind='break' for update;
 if not found or not private.can_manage(a.professional_id) then raise exception 'NOT_AUTHORIZED'; end if;
 update public.calendar_allocations set active=false where id=p_id;
 perform private.audit('break.remove',p_id);
 return private.remember('remove_break',p_key,body,jsonb_build_object('id',p_id));
end; $$;
create function private.occasional_customer(p_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
 if length(p_name)>100 then raise exception 'INVALID_INPUT'; end if;
 if nullif(btrim(p_name),'') is not null then insert into public.customers(name) values(btrim(p_name)) returning id into c; end if;
 return c;
end; $$;
create function public.register_walk_in(p_professional uuid,p_service uuid,p_name text,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_professional,p_service,p_name); result jsonb; a public.appointments; s public.services; c uuid; t timestamptz; v uuid;
begin
 perform private.require_role(array['barber','admin']);
 result:=private.replay('register_walk_in',p_key,body); if result is not null then return result; end if;
 if not private.can_manage(p_professional) then raise exception 'NOT_AUTHORIZED'; end if;
 perform private.expire_no_shows();
 perform private.require_service_professional(p_service,p_professional);
 select * into s from public.services where id=p_service;
 t:=clock_timestamp();
 if not private.slot_available(p_professional,t,s.duration_minutes,s.buffer_minutes) then raise exception 'SLOT_UNAVAILABLE'; end if;
 c:=private.occasional_customer(p_name);
 a:=private.make_appointment(p_service,p_professional,t,c,'walk_in','in_progress');
 insert into public.visits(appointment_id,customer_id,professional_id,origin,started_at,status,recorded_by) values(a.id,c,p_professional,'walk_in',t,'in_progress',auth.uid()) returning id into v;
 return private.remember('register_walk_in',p_key,body,jsonb_build_object('id',a.id,'visit_id',v));
end; $$;

create function private.post_sale(p_visit uuid,p_items jsonb,p_method text,p_sold_at timestamptz) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.visits; a public.appointments; s public.services; item jsonb; qty integer; price numeric; total numeric:=0; sale uuid; description text; prepared jsonb:='[]';
begin
 perform private.require_role(array['admin']);
 if p_method is null or p_method not in ('cash','bank_transfer','deuna') or p_sold_at is null or p_sold_at>clock_timestamp() then raise exception 'INVALID_INPUT'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 12 then raise exception 'INVALID_INPUT'; end if;
 select * into v from public.visits where id=p_visit for update;
 if not found then raise exception 'INVALID_INPUT'; end if;
 if exists(select 1 from public.sales where visit_id=p_visit) then raise exception 'ALREADY_SOLD'; end if;
 if v.appointment_id is not null then select * into a from public.appointments where id=v.appointment_id; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  qty:=(item->>'quantity')::integer;
  if qty is null or qty not between 1 and 10 then raise exception 'INVALID_INPUT'; end if;
  select * into s from public.services where id=(item->>'service_id')::uuid;
  if not found or (not s.active and s.id is distinct from a.service_id) then raise exception 'INVALID_INPUT'; end if;
  if s.id=a.service_id then price:=a.quoted_price; description:=a.service_name; else price:=s.price; description:=s.name; end if;
  total:=total+price*qty;
  prepared:=prepared||jsonb_build_array(jsonb_build_object('id',s.id,'quantity',qty,'price',price,'name',description));
 end loop;
 insert into public.sales(visit_id,sold_at,total_amount,payment_method,created_by) values(p_visit,p_sold_at,total,p_method,auth.uid()) returning id into sale;
 for item in select value from jsonb_array_elements(prepared) loop
  insert into public.sale_items(sale_id,service_id,quantity,unit_price,service_name_snapshot) values(sale,(item->>'id')::uuid,(item->>'quantity')::integer,(item->>'price')::numeric,item->>'name');
 end loop;
 update public.visits set status='completed',completed_at=coalesce(completed_at,clock_timestamp()) where id=p_visit;
 if v.appointment_id is not null then update public.appointments set status='completed',revision=revision+1 where id=v.appointment_id; end if;
 perform private.audit('sale.post',sale,jsonb_build_object('total',total,'payment_method',p_method));
 return jsonb_build_object('id',sale,'total_amount',total);
end; $$;
create function public.register_sale(p_visit uuid,p_items jsonb,p_method text,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_visit,p_items,p_method); result jsonb;
begin
 perform private.require_role(array['admin']);
 result:=private.replay('register_sale',p_key,body); if result is not null then return result; end if;
 result:=private.post_sale(p_visit,p_items,p_method,clock_timestamp());
 return private.remember('register_sale',p_key,body,result);
end; $$;
create function public.register_retrospective(p_professional uuid,p_service uuid,p_name text,p_local_time timestamp,p_method text,p_reason text,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_professional,p_service,p_name,p_local_time,p_method,p_reason); result jsonb; z text; t timestamptz; v uuid; c uuid;
begin
 perform private.require_role(array['admin']);
 result:=private.replay('register_retrospective',p_key,body); if result is not null then return result; end if;
 if coalesce(length(btrim(p_reason)),0) not between 5 and 200 or p_local_time is null then raise exception 'INVALID_INPUT'; end if;
 select timezone into z from public.business_settings where id=1; t:=p_local_time at time zone z;
 if t>clock_timestamp() or t<clock_timestamp()-interval '365 days' then raise exception 'INVALID_INPUT'; end if;
 perform private.require_service_professional(p_service,p_professional);
 c:=private.occasional_customer(p_name);
 insert into public.visits(customer_id,professional_id,origin,started_at,completed_at,status,recorded_by,reason)
 values(c,p_professional,'retrospective',t,t,'completed',auth.uid(),p_reason) returning id into v;
 result:=private.post_sale(v,jsonb_build_array(jsonb_build_object('service_id',p_service,'quantity',1)),p_method,t);
 perform private.audit('visit.retrospective',v,jsonb_build_object('reason',p_reason,'recorded_time',t));
 return private.remember('register_retrospective',p_key,body,result);
end; $$;
create function public.void_sale(p_id uuid,p_reason text,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_id,p_reason); result jsonb;
begin
 perform private.require_role(array['admin']);
 result:=private.replay('void_sale',p_key,body); if result is not null then return result; end if;
 if coalesce(length(btrim(p_reason)),0) not between 5 and 200 then raise exception 'INVALID_INPUT'; end if;
 update public.sales set status='voided',void_reason=btrim(p_reason),voided_by=auth.uid(),voided_at=clock_timestamp() where id=p_id and status='posted';
 if not found then raise exception 'INVALID_STATE'; end if;
 perform private.audit('sale.void',p_id,jsonb_build_object('reason',p_reason));
 return private.remember('void_sale',p_key,body,jsonb_build_object('id',p_id));
end; $$;
create function public.get_sales_dashboard(p_from date,p_to date) returns jsonb language plpgsql security definer set search_path = '' as $$
declare z text; t1 timestamptz; t2 timestamptz; total numeric; n bigint; series jsonb; details jsonb;
begin
 perform private.require_role(array['admin']);
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then raise exception 'INVALID_INPUT'; end if;
 select timezone into z from public.business_settings where id=1;
 t1:=p_from::timestamp at time zone z; t2:=(p_to+1)::timestamp at time zone z;
 select coalesce(sum(total_amount),0),count(*) into total,n from public.sales where status='posted' and sold_at>=t1 and sold_at<t2;
 select jsonb_agg(jsonb_build_object('date',d::date,'total',coalesce((select sum(total_amount) from public.sales where status='posted' and (sold_at at time zone z)::date=d::date),0)) order by d) into series
 from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.sold_at desc),'[]') into details from (
  select s.id,s.sold_at,s.total_amount,s.payment_method,s.status,(select string_agg(i.service_name_snapshot,' + ') from public.sale_items i where i.sale_id=s.id) as description
  from public.sales s where s.sold_at>=t1 and s.sold_at<t2 order by s.sold_at desc limit 500
 ) q;
 return jsonb_build_object('total',total,'count',n,'average',case when n>0 then round(total/n,2) else 0 end,'series',series,'sales',details,'detail_count',(select count(*) from public.sales where sold_at>=t1 and sold_at<t2),'detail_limit',500);
end; $$;

create function public.get_notifications() returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 perform private.require_role(array['barber','admin']);
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'appointment_id',a.id,'starts_at',a.starts_at,'service_name',a.service_name,'customer_name',c.name,'presented_at',n.presented_at,'read_at',n.read_at) order by a.starts_at),'[]') into result
 from public.notifications n join public.appointments a on a.id=n.appointment_id left join public.customers c on c.id=a.customer_id
 where n.recipient_user_id=auth.uid() and n.active and n.visible_from<=clock_timestamp() and n.expires_at>clock_timestamp()
  and a.status in ('confirmed','checked_in') and a.schedule_version=n.schedule_version and private.can_manage(a.professional_id);
 return result;
end; $$;
create function public.claim_notification(p_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare token uuid;
begin
 perform private.require_role(array['barber','admin']);
 update public.notifications n set claim_token=gen_random_uuid(),claim_until=clock_timestamp()+interval '30 seconds'
 where id=p_id and recipient_user_id=auth.uid() and active and presented_at is null and (claim_until is null or claim_until<clock_timestamp())
  and visible_from<=clock_timestamp() and expires_at>clock_timestamp()
  and exists(select 1 from public.appointments a where a.id=n.appointment_id and a.status in ('confirmed','checked_in') and a.schedule_version=n.schedule_version and private.can_manage(a.professional_id))
 returning claim_token into token;
 return token;
end; $$;
create function public.ack_notification(p_id uuid,p_action text,p_token uuid default null) returns void language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_role(array['barber','admin']);
 if p_action not in ('presented','read','dismiss') or p_action is null then raise exception 'INVALID_INPUT'; end if;
 update public.notifications n set presented_at=case when p_action='presented' then coalesce(presented_at,clock_timestamp()) else presented_at end,
  read_at=case when p_action='read' then coalesce(read_at,clock_timestamp()) else read_at end,
  dismissed_at=case when p_action='dismiss' then coalesce(dismissed_at,clock_timestamp()) else dismissed_at end
 where id=p_id and recipient_user_id=auth.uid() and active
  and (p_action<>'presented' or (p_token is not null and claim_token=p_token and claim_until>=clock_timestamp()))
  and exists(select 1 from public.appointments a where a.id=n.appointment_id and private.can_manage(a.professional_id));
 if not found then raise exception 'NOT_AUTHORIZED'; end if;
end; $$;

create function public.get_settings() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_role(array['admin']);
 return jsonb_build_object('business',(select to_jsonb(b) from public.business_settings b where id=1),
 'professionals',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('hours',coalesce((select jsonb_agg(to_jsonb(h)) from public.working_intervals h where h.professional_id=p.id),'[]'))) from public.professionals p),'[]'));
end; $$;
create function public.update_settings(p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; b public.business_settings; enabled boolean;
begin
 perform private.require_role(array['admin']);
 result:=private.replay('update_settings',p_key,p_data); if result is not null then return result; end if;
 select * into b from public.business_settings where id=1;
 if not exists(select 1 from pg_timezone_names where name=p_data->>'timezone') then raise exception 'INVALID_INPUT'; end if;
 if p_data->>'timezone'<>b.timezone and exists(select 1 from public.appointments where starts_at>clock_timestamp() and status in ('confirmed','checked_in','in_progress')) then raise exception 'INVALID_STATE'; end if;
 enabled:=coalesce((p_data->>'booking_enabled')::boolean,false);
 if enabled and (
  (select count(*) from public.professionals p join public.user_roles r on r.user_id=p.user_id where p.active and r.active and r.role='barber' and p.name not like 'Peluquero % —%' and exists(select 1 from public.working_intervals h where h.professional_id=p.id) and exists(select 1 from public.professional_services ps where ps.professional_id=p.id))<>2
  or not exists(select 1 from public.user_roles where role='admin' and active)
 ) then raise exception 'SETUP_INCOMPLETE'; end if;
 update public.business_settings set name=btrim(p_data->>'name'),address=btrim(p_data->>'address'),timezone=p_data->>'timezone',slot_step_minutes=(p_data->>'slot_step_minutes')::integer,min_notice_minutes=(p_data->>'min_notice_minutes')::integer,horizon_days=(p_data->>'horizon_days')::integer,booking_enabled=enabled where id=1;
 perform private.audit('settings.update',null,p_data);
 return private.remember('update_settings',p_key,p_data,jsonb_build_object('ok',true));
end; $$;
create function public.update_service(p_id uuid,p_price numeric,p_duration integer,p_buffer integer,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_id,p_price,p_duration,p_buffer); result jsonb;
begin
 perform private.require_role(array['admin']);
 result:=private.replay('update_service',p_key,body); if result is not null then return result; end if;
 if p_price is null or p_price<0 or p_price>99999 or p_duration is null or p_duration not between 5 and 240 or p_buffer is null or p_buffer not between 0 and 60 then raise exception 'INVALID_INPUT'; end if;
 update public.services set price=p_price,duration_minutes=p_duration,buffer_minutes=p_buffer where id=p_id;
 if not found then raise exception 'INVALID_INPUT'; end if;
 perform private.audit('service.update',p_id,jsonb_build_object('price',p_price,'duration',p_duration,'buffer',p_buffer));
 return private.remember('update_service',p_key,body,jsonb_build_object('id',p_id));
end; $$;
create function public.update_professional(p_id uuid,p_name text,p_active boolean,p_hours jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare body jsonb:=jsonb_build_array(p_id,p_name,p_active,p_hours); result jsonb; h jsonb; z text;
begin
 perform private.require_role(array['admin']);
 result:=private.replay('update_professional',p_key,body); if result is not null then return result; end if;
 if p_active is null or coalesce(length(btrim(p_name)),0) not between 2 and 100 or p_hours is null or jsonb_typeof(p_hours)<>'array' or jsonb_array_length(p_hours)>7 then raise exception 'INVALID_INPUT'; end if;
 if not exists(select 1 from public.professionals where id=p_id) then raise exception 'INVALID_INPUT'; end if;
 if p_active and not exists(select 1 from public.professionals p join public.user_roles r on r.user_id=p.user_id where p.id=p_id and r.active and r.role='barber') then raise exception 'SETUP_INCOMPLETE'; end if;
 perform private.expire_no_shows();
 delete from public.working_intervals where professional_id=p_id;
 for h in select value from jsonb_array_elements(p_hours) loop
  insert into public.working_intervals(professional_id,weekday,start_time,end_time) values(p_id,(h->>'weekday')::integer,(h->>'start_time')::time,(h->>'end_time')::time);
 end loop;
 select timezone into z from public.business_settings where id=1;
 if exists(select 1 from public.appointments a where a.professional_id=p_id and a.occupied_until>clock_timestamp() and a.status not in ('cancelled','no_show') and
  (not p_active or not exists(select 1 from public.working_intervals w where w.professional_id=p_id and w.weekday=extract(dow from a.starts_at at time zone z) and (a.starts_at at time zone z)::time>=w.start_time and (a.occupied_until at time zone z)::time<=w.end_time))) then raise exception 'SLOT_UNAVAILABLE'; end if;
 update public.professionals set name=btrim(p_name),active=p_active where id=p_id;
 if not p_active then update public.business_settings set booking_enabled=false where id=1; end if;
 perform private.audit('professional.update',p_id,body);
 return private.remember('update_professional',p_key,body,jsonb_build_object('id',p_id));
end; $$;

-- Explicit function allowlist; never grant private mutation helpers.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname=any(array['get_bootstrap','get_identity','get_available_slots','create_booking','list_appointments','cancel_booking','reschedule_booking','transition_appointment','create_break','list_breaks','remove_break','register_walk_in','register_sale','register_retrospective','void_sale','get_sales_dashboard','get_notifications','claim_notification','ack_notification','get_settings','update_settings','update_service','update_professional']) loop
  execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
  if f.proname in ('get_bootstrap','get_available_slots') then execute format('grant execute on function %s to anon',f.signature); end if;
 end loop;
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.actor_role(),private.can_manage(uuid),private.owns_customer(uuid) to authenticated;
commit;
