-- EDIT all placeholders. Run in SQL Editor as project owner AFTER creating the
-- three users in Authentication > Users. Never publish real staff emails in Git.
begin;
do $$
declare
 admin_email text := 'johnyv1305@gmail.com';
 barber_one_email text := 'johnyv@hotmail.es';
 barber_two_email text := 'barber2@eldorado.com';
 barber_one_name text := 'BARBERO_1';
 barber_two_name text := 'BARBERO_2';
 -- List only the service UUIDs each barber actually offers.
 barber_one_services uuid[] := array[]::uuid[];
 barber_two_services uuid[] := array[]::uuid[];
 admin_id uuid; one_id uuid; two_id uuid;
begin
 if admin_email like 'CAMBIAR%' or barber_one_name like 'CAMBIAR%' or barber_two_name like 'CAMBIAR%'
  or cardinality(barber_one_services)=0 or cardinality(barber_two_services)=0 then
   raise exception 'Replace emails/names and fill the service UUID arrays before running.';
 end if;
 select id into admin_id from auth.users where lower(email)=lower(admin_email);
 select id into one_id from auth.users where lower(email)=lower(barber_one_email);
 select id into two_id from auth.users where lower(email)=lower(barber_two_email);
 if admin_id is null or one_id is null or two_id is null then raise exception 'Create all three Auth users first.'; end if;
 if admin_id=one_id or admin_id=two_id or one_id=two_id then raise exception 'Use three distinct users.'; end if;
 insert into public.user_roles(user_id,role) values(admin_id,'admin'),(one_id,'barber'),(two_id,'barber') on conflict(user_id) do update set role=excluded.role,active=true;
 update public.professionals set user_id=one_id,name=barber_one_name,active=true where id='20000000-0000-0000-0000-000000000001';
 update public.professionals set user_id=two_id,name=barber_two_name,active=true where id='20000000-0000-0000-0000-000000000002';
 insert into public.professional_services select '20000000-0000-0000-0000-000000000001'::uuid,unnest(barber_one_services) on conflict do nothing;
 insert into public.professional_services select '20000000-0000-0000-0000-000000000002'::uuid,unnest(barber_two_services) on conflict do nothing;
 -- Covers users created before this project's Auth trigger was installed.
 insert into public.customers(auth_user_id,name) select id,coalesce(nullif(raw_user_meta_data->>'full_name',''),'Cliente') from auth.users where id in (admin_id,one_id,two_id) on conflict(auth_user_id) do nothing;
 update public.business_settings set booking_enabled=false where id=1;
end $$;
commit;
-- Sign in as administrator, configure each barber's actual weekly schedule,
-- review settings, then enable booking. Do not assign 12-hour shifts by default.
