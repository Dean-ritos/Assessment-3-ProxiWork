-- Let an employer access only documents attached to applications for their own jobs.
create policy "employer_application_cv_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and exists (
      select 1
      from public.applications application
      join public.jobs job on job.id = application.job_id
      join public.employers employer on employer.id = job.employer_id
      where employer.owner_user_id = auth.uid()
        and application.resume_path = name
    )
  );

create policy "employer_application_document_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (
      select 1
      from public.applications application
      join public.jobs job on job.id = application.job_id
      join public.employers employer on employer.id = job.employer_id
      where employer.owner_user_id = auth.uid()
        and application.cover_letter_path = name
    )
  );

drop function if exists public.employer_applicant_detail(uuid);

create or replace function public.employer_applicant_detail(target_application_id uuid)
returns table(
  application_id uuid, job_id uuid, job_title text, applicant_id uuid,
  first_name text, last_name text, suburb text, state text, status text,
  applied_at timestamptz, cover_letter text, resume_path text, cover_letter_path text,
  skills text[], experiences jsonb, education_entries jsonb
)
language sql stable security definer set search_path = '' as $$
  select application.id, job.id, job.title, profile.id, profile.first_name, profile.last_name,
    profile.suburb, profile.state, application.status, application.applied_at, application.cover_letter,
    application.resume_path, application.cover_letter_path,
    coalesce((select array_agg(skill.name order by skill.name) from public.profile_skills profile_skill join public.skills skill on skill.id = profile_skill.skill_id where profile_skill.profile_id = profile.id), '{}'),
    coalesce((select jsonb_agg(jsonb_build_object('company_name', work.company_name, 'position_title', work.position_title, 'start_date', work.start_date, 'end_date', work.end_date, 'is_current', work.is_current, 'description', work.description) order by work.start_date desc) from public.work_experience work where work.profile_id = profile.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('certification_level', education.certification_level, 'course_name', education.course_name, 'institution', education.institution, 'start_date', education.start_date, 'end_date', education.end_date, 'is_currently_studying', education.is_currently_studying) order by education.end_date desc nulls last) from public.education education where education.profile_id = profile.id), '[]'::jsonb)
  from public.applications application
  join public.jobs job on job.id = application.job_id
  join public.employers employer on employer.id = job.employer_id and employer.owner_user_id = auth.uid()
  join public.profiles profile on profile.id = application.applicant_id
  where application.id = target_application_id;
$$;

revoke all on function public.employer_applicant_detail(uuid) from public;
grant execute on function public.employer_applicant_detail(uuid) to anon, authenticated;