-- Introduce distinct employer accounts, employer-only ownership checks, and
-- employer vacancy fields. This migration is intentionally idempotent because
-- the project currently applies reviewed database changes through SQL Editor.

alter table public.profiles
  add column if not exists account_type text not null default 'candidate'
  check (account_type in ('candidate', 'employer'));

alter table public.employers
  add column if not exists abn text,
  add column if not exists industry text,
  add column if not exists onboarding_completed boolean not null default false;

alter table public.jobs
  add column if not exists experience_required text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employers_owner_user_id_unique'
      and conrelid = 'public.employers'::regclass
  ) then
    alter table public.employers
      add constraint employers_owner_user_id_unique unique(owner_user_id);
  end if;
end
$$;

update public.profiles set account_type = 'candidate' where account_type is null;

create or replace function public.current_user_is_employer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.account_type = 'employer'
  );
$$;

create or replace function public.current_user_owns_employer(target_employer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_is_employer()
    and exists (
      select 1
      from public.employers employer
      where employer.id = target_employer_id
        and employer.owner_user_id = auth.uid()
    );
$$;

create or replace function public.current_user_owns_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.jobs job
    join public.employers employer on employer.id = job.employer_id
    where job.id = target_job_id
      and employer.owner_user_id = auth.uid()
      and public.current_user_is_employer()
  );
$$;

revoke all on function public.current_user_is_employer() from public;
revoke all on function public.current_user_owns_employer(uuid) from public;
revoke all on function public.current_user_owns_job(uuid) from public;
grant execute on function public.current_user_is_employer() to anon, authenticated;
grant execute on function public.current_user_owns_employer(uuid) to anon, authenticated;
grant execute on function public.current_user_owns_job(uuid) to anon, authenticated;

create or replace function public.prevent_account_type_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.account_type is distinct from new.account_type then
    raise exception 'Account type cannot be changed after registration';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_account_type_change on public.profiles;
create trigger prevent_profile_account_type_change
  before update on public.profiles
  for each row execute procedure public.prevent_account_type_change();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, first_name, last_name, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    case when new.raw_user_meta_data ->> 'account_type' = 'employer'
      then 'employer'
      else 'candidate'
    end
  )
  on conflict(id) do nothing;
  return new;
end;
$$;

drop policy if exists "own_employers" on public.employers;
create policy "own_employers" on public.employers
  for all
  using (public.current_user_owns_employer(id))
  with check (
    public.current_user_is_employer()
    and owner_user_id = auth.uid()
  );

drop policy if exists "own_jobs" on public.jobs;
create policy "own_jobs" on public.jobs
  for all
  using (public.current_user_owns_employer(employer_id))
  with check (public.current_user_owns_employer(employer_id));

drop policy if exists "read_applications" on public.applications;
create policy "read_applications" on public.applications
  for select
  using (
    applicant_id = auth.uid()
    or public.current_user_owns_job(job_id)
  );

drop policy if exists "insert_own_application" on public.applications;
create policy "insert_own_application" on public.applications
  for insert
  with check (
    applicant_id = auth.uid()
    and not public.current_user_is_employer()
  );

update public.jobs
set experience_required = case id
  when '20000000-0000-0000-0000-000000000001' then 'At least 1 year of office administration, reception, or customer service experience is preferred. Confident applicants returning to work are encouraged to apply.'
  when '20000000-0000-0000-0000-000000000002' then 'No formal experience is required. Experience in retail, hospitality, or face-to-face customer service will be highly regarded.'
  when '20000000-0000-0000-0000-000000000003' then 'At least 2 years of experience in data analysis, reporting, business intelligence, or a related analytical role. Experience presenting findings to non-technical stakeholders is valued.'
  when '20000000-0000-0000-0000-000000000004' then 'Previous retail, hospitality, or customer-facing experience is preferred, though full training is provided for someone with the right attitude and availability.'
  when '20000000-0000-0000-0000-000000000005' then 'At least 1 year of administration, coordination, customer service, or office support experience is preferred. Community-sector experience is welcome but not essential.'
  else experience_required
end
where id in (
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000005'
);