-- Persist each candidate's useful job searches across devices.
create table if not exists public.job_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  query text not null default '',
  employment_type text,
  location text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists job_searches_user_created_idx on public.job_searches(user_id, created_at desc);

alter table public.job_searches enable row level security;

create policy "own_job_searches" on public.job_searches
  for all using(user_id = auth.uid()) with check(user_id = auth.uid());

-- Candidates can add a normalised skill to the shared catalogue before linking it
-- to their own profile. Updates and deletes remain unavailable to client roles.
create policy "authenticated_skill_insert" on public.skills
  for insert to authenticated with check(true);