-- Search tags, privacy-safe visit analytics, and employer applicant inbox.

create index if not exists job_skills_skill_job_idx on public.job_skills(skill_id, job_id);
create index if not exists jobs_published_location_type_idx on public.jobs(status, state, suburb, employment_type);

drop policy if exists "published_or_owned_job_skills_read" on public.job_skills;
create policy "published_or_owned_job_skills_read" on public.job_skills
  for select using (
    exists (select 1 from public.jobs job where job.id = job_id and job.status = 'published')
    or public.current_user_owns_job(job_id)
  );

drop policy if exists "own_job_skills_manage" on public.job_skills;
create policy "own_job_skills_manage" on public.job_skills
  for all using (public.current_user_owns_job(job_id))
  with check (public.current_user_owns_job(job_id));

drop policy if exists "authenticated_skills_insert" on public.skills;
create policy "authenticated_skills_insert" on public.skills
  for insert to authenticated with check (length(trim(name)) between 1 and 80 and normalised_name = lower(trim(name)));

create table if not exists public.employer_page_visits (
  employer_id uuid not null references public.employers(id) on delete cascade,
  visitor_token uuid not null,
  visited_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (employer_id, visitor_token, visited_on)
);

create table if not exists public.job_listing_views (
  job_id uuid not null references public.jobs(id) on delete cascade,
  visitor_token uuid not null,
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (job_id, visitor_token, viewed_on)
);

alter table public.employer_page_visits enable row level security;
alter table public.job_listing_views enable row level security;

create or replace function public.record_employer_page_visit(target_employer_id uuid, browser_visitor_token uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if browser_visitor_token is null then return; end if;
  if not exists (
    select 1 from public.employers employer
    where employer.id = target_employer_id and employer.verification_status = 'verified'
  ) then return; end if;
  if exists (
    select 1 from public.employers employer
    where employer.id = target_employer_id and employer.owner_user_id = auth.uid()
  ) then return; end if;
  insert into public.employer_page_visits(employer_id, visitor_token)
  values(target_employer_id, browser_visitor_token)
  on conflict do nothing;
end;
$$;

create or replace function public.record_job_listing_view(target_job_id uuid, browser_visitor_token uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if browser_visitor_token is null then return; end if;
  if not exists (select 1 from public.jobs job where job.id = target_job_id and job.status = 'published') then return; end if;
  if exists (
    select 1 from public.jobs job join public.employers employer on employer.id = job.employer_id
    where job.id = target_job_id and employer.owner_user_id = auth.uid()
  ) then return; end if;
  insert into public.job_listing_views(job_id, visitor_token)
  values(target_job_id, browser_visitor_token)
  on conflict do nothing;
end;
$$;

create or replace function public.employer_dashboard_metrics()
returns table(company_page_views bigint, job_listing_views bigint, recent_company_page_views bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.employer_page_visits visit join public.employers employer on employer.id = visit.employer_id where employer.owner_user_id = auth.uid()),
    (select count(*) from public.job_listing_views view join public.jobs job on job.id = view.job_id join public.employers employer on employer.id = job.employer_id where employer.owner_user_id = auth.uid()),
    (select count(*) from public.employer_page_visits visit join public.employers employer on employer.id = visit.employer_id where employer.owner_user_id = auth.uid() and visit.visited_on >= current_date - 30);
$$;

create or replace function public.employer_job_view_counts()
returns table(job_id uuid, view_count bigint)
language sql stable security definer set search_path = '' as $$
  select view.job_id, count(*)::bigint
  from public.job_listing_views view
  join public.jobs job on job.id = view.job_id
  join public.employers employer on employer.id = job.employer_id
  where employer.owner_user_id = auth.uid()
  group by view.job_id;
$$;

create or replace function public.employer_applicants()
returns table(
  application_id uuid, job_id uuid, job_title text, applicant_id uuid,
  first_name text, last_name text, suburb text, state text, status text,
  applied_at timestamptz, skills text[], cover_letter text
)
language sql stable security definer set search_path = '' as $$
  select application.id, job.id, job.title, profile.id, profile.first_name, profile.last_name,
    profile.suburb, profile.state, application.status, application.applied_at,
    coalesce(array_agg(distinct skill.name) filter (where skill.name is not null), '{}'), application.cover_letter
  from public.applications application
  join public.jobs job on job.id = application.job_id
  join public.employers employer on employer.id = job.employer_id and employer.owner_user_id = auth.uid()
  join public.profiles profile on profile.id = application.applicant_id
  left join public.profile_skills profile_skill on profile_skill.profile_id = profile.id
  left join public.skills skill on skill.id = profile_skill.skill_id
  group by application.id, job.id, job.title, profile.id, profile.first_name, profile.last_name, profile.suburb, profile.state, application.status, application.applied_at, application.cover_letter;
$$;

create or replace function public.employer_applicant_detail(target_application_id uuid)
returns table(
  application_id uuid, job_id uuid, job_title text, applicant_id uuid,
  first_name text, last_name text, suburb text, state text, status text,
  applied_at timestamptz, cover_letter text, skills text[],
  experiences jsonb, education_entries jsonb
)
language sql stable security definer set search_path = '' as $$
  select application.id, job.id, job.title, profile.id, profile.first_name, profile.last_name,
    profile.suburb, profile.state, application.status, application.applied_at, application.cover_letter,
    coalesce((select array_agg(skill.name order by skill.name) from public.profile_skills profile_skill join public.skills skill on skill.id = profile_skill.skill_id where profile_skill.profile_id = profile.id), '{}'),
    coalesce((select jsonb_agg(jsonb_build_object('company_name', work.company_name, 'position_title', work.position_title, 'start_date', work.start_date, 'end_date', work.end_date, 'is_current', work.is_current, 'description', work.description) order by work.start_date desc) from public.work_experience work where work.profile_id = profile.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('certification_level', education.certification_level, 'course_name', education.course_name, 'institution', education.institution, 'start_date', education.start_date, 'end_date', education.end_date, 'is_currently_studying', education.is_currently_studying) order by education.end_date desc nulls last) from public.education education where education.profile_id = profile.id), '[]'::jsonb)
  from public.applications application
  join public.jobs job on job.id = application.job_id
  join public.employers employer on employer.id = job.employer_id and employer.owner_user_id = auth.uid()
  join public.profiles profile on profile.id = application.applicant_id
  where application.id = target_application_id;
$$;

create or replace function public.update_employer_application_status(target_application_id uuid, next_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if next_status not in ('reviewing', 'shortlisted', 'rejected', 'accepted') then
    raise exception 'Invalid employer application status';
  end if;
  update public.applications application set status = next_status, updated_at = now()
  where application.id = target_application_id and exists (
    select 1 from public.jobs job join public.employers employer on employer.id = job.employer_id
    where job.id = application.job_id and employer.owner_user_id = auth.uid()
  );
  if not found then raise exception 'Application not found or access denied'; end if;
end;
$$;

revoke all on function public.record_employer_page_visit(uuid, uuid), public.record_job_listing_view(uuid, uuid), public.employer_dashboard_metrics(), public.employer_job_view_counts(), public.employer_applicants(), public.employer_applicant_detail(uuid), public.update_employer_application_status(uuid, text) from public;
grant execute on function public.record_employer_page_visit(uuid, uuid), public.record_job_listing_view(uuid, uuid), public.employer_dashboard_metrics(), public.employer_job_view_counts(), public.employer_applicants(), public.employer_applicant_detail(uuid), public.update_employer_application_status(uuid, text) to anon, authenticated;