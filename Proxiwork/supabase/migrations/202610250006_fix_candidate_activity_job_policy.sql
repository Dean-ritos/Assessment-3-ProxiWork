-- Avoid recursive RLS evaluation between jobs and applications while preserving
-- a candidate's ability to read jobs in their own saved/application history.
create or replace function public.current_user_has_job_activity(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.saved_jobs saved_job
    where saved_job.job_id = target_job_id
      and saved_job.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.applications application
    where application.job_id = target_job_id
      and application.applicant_id = auth.uid()
  );
$$;

revoke all on function public.current_user_has_job_activity(uuid) from public;
grant execute on function public.current_user_has_job_activity(uuid) to anon, authenticated;

drop policy if exists "candidate_activity_jobs" on public.jobs;

create policy "candidate_activity_jobs" on public.jobs for select using (
  public.current_user_has_job_activity(id)
);