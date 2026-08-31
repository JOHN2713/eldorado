-- Run AFTER the core migrations. Requires Supabase Cron (pg_cron extension).
create extension if not exists pg_cron with schema pg_catalog;
do $$ begin
 if exists(select 1 from cron.job where jobname='eldorado-expire-no-shows') then
  perform cron.unschedule('eldorado-expire-no-shows');
 end if;
 perform cron.schedule('eldorado-expire-no-shows','* * * * *','select private.expire_no_shows();');
end $$;
-- Verification (a scheduled write may lag <1 min; availability also normalizes):
select jobid,jobname,schedule,active from cron.job where jobname='eldorado-expire-no-shows';
