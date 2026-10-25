-- Let candidates continue to read jobs in their own saved/application history after closure.
-- This is idempotent because the policy may have been applied manually in SQL Editor.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'jobs'
      and policyname = 'candidate_activity_jobs'
  ) then
    create policy "candidate_activity_jobs" on public.jobs for select using (
      exists (
        select 1
        from public.saved_jobs saved_job
        where saved_job.job_id = jobs.id
          and saved_job.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.applications application
        where application.job_id = jobs.id
          and application.applicant_id = auth.uid()
      )
    );
  end if;
end
$$;