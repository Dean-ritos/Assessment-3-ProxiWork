-- Ensure candidates can add new skills to the shared catalogue during profile setup.
-- This is intentionally idempotent because earlier environments may have applied
-- the policy from 202610250001_job_searches.sql already.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'skills'
      and policyname = 'authenticated_skill_insert'
  ) then
    create policy "authenticated_skill_insert"
      on public.skills
      for insert
      to authenticated
      with check (true);
  end if;
end;
$$;