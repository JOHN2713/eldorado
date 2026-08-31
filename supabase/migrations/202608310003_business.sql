-- Confirmed business facts. No real accounts or unconfirmed staff hours are invented.
begin;
insert into public.business_settings(id,name,address) values(1,'El Dorado Barbería','Zámbiza, calle Quito');
insert into public.business_hours(weekday,start_time,end_time) select n,'09:00'::time,'21:00'::time from generate_series(0,6) n;
insert into public.services(id,name,description,price,estimated_min_minutes,estimated_max_minutes,duration_minutes,sort_order) values
 ('10000000-0000-0000-0000-000000000001','Corte normal','Un clásico bien hecho. Limpio, preciso y a tu medida.',5,30,45,45,1),
 ('10000000-0000-0000-0000-000000000002','Corte con diseño','Detalles que hacen la diferencia. Dale tu toque.',6,40,50,50,2),
 ('10000000-0000-0000-0000-000000000003','Corte con barba','Cabello y barba en equilibrio. Acabado completo.',6.50,40,50,50,3),
 ('10000000-0000-0000-0000-000000000004','Corte completo','Tu servicio completo. Consulta los detalles en el local.',8,50,60,60,4);
insert into public.professionals(id,name,active) values
 ('20000000-0000-0000-0000-000000000001','Peluquero 1 — por configurar',false),
 ('20000000-0000-0000-0000-000000000002','Peluquero 2 — por configurar',false);
-- Services per professional must be explicitly assigned in the staff setup script.
commit;
