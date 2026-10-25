-- Seed the Melbourne demonstration listings as normal jobs so they can be saved
-- and applied for, while retaining a system-owned demo employer.
alter table public.employers alter column owner_user_id drop not null;

create policy "verified_employers_read" on public.employers
  for select
  using (verification_status = 'verified');

insert into public.employers (
  id,
  owner_user_id,
  company_name,
  description,
  suburb,
  state,
  postcode,
  verification_status
)
values (
  '10000000-0000-0000-0000-000000000001',
  null,
  'ProxiWork Demo Employers',
  'Demonstration employer account used for sample job listings.',
  'Melbourne',
  'VIC',
  '3000',
  'verified'
)
on conflict (id) do update set
  company_name = excluded.company_name,
  description = excluded.description,
  suburb = excluded.suburb,
  state = excluded.state,
  postcode = excluded.postcode,
  verification_status = excluded.verification_status;

insert into public.jobs (
  id,
  employer_id,
  title,
  description,
  responsibilities,
  requirements,
  employment_type,
  suburb,
  state,
  postcode,
  status
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Office Administrator',
    'Help keep a busy local office organised by supporting customers, coordinating appointments, and keeping daily administration on track.',
    'Answer customer calls and emails\nCoordinate appointments and meeting rooms\nPrepare documents and update records\nSupport the team with day-to-day administration',
    'Friendly, clear communication\nComfortable using email and Microsoft Office\nOrganised with strong attention to detail\nPrevious administration experience is welcome but not essential',
    'part_time', 'Melbourne', 'VIC', '3000', 'published'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Customer Service Member',
    'Join a welcoming retail team and help customers find what they need in a busy Richmond store.',
    'Welcome and assist customers\nProcess purchases and returns\nKeep displays tidy and stocked\nWork with the team during busy periods',
    'Positive customer-first attitude\nReliable availability for casual shifts\nConfident communication\nRetail or hospitality experience is helpful',
    'casual', 'Richmond', 'VIC', '3121', 'published'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'Data Analyst',
    'Turn business data into clear reports and practical insights for a growing Southbank technology team.',
    'Prepare weekly performance reports\nAnalyse customer and operational data\nBuild clear dashboards for stakeholders\nPresent findings and recommendations',
    'Experience with Excel or Google Sheets\nConfidence working with data and patterns\nClear written and verbal communication\nSQL or dashboard experience is a bonus',
    'contract', 'Southbank', 'VIC', '3006', 'published'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'Retail Team Member',
    'Support a friendly Fitzroy retail team with customer service, stock presentation, and flexible weekend shifts.',
    'Assist customers on the shop floor\nReceive and replenish stock\nMaintain attractive product displays\nSupport opening and closing routines',
    'Available for weekend work\nFriendly and proactive approach\nAble to work independently and in a team\nInterest in local retail and community',
    'casual', 'Fitzroy', 'VIC', '3065', 'published'
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    'Administration Assistant',
    'Support administration, enquiries, and project coordination for a community-focused team based in Carlton.',
    'Maintain accurate records\nCoordinate enquiries and bookings\nPrepare simple reports and correspondence\nSupport projects and team events',
    'Strong organisational skills\nProfessional written communication\nComfortable learning new systems\nA collaborative and dependable approach',
    'full_time', 'Carlton', 'VIC', '3053', 'published'
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  responsibilities = excluded.responsibilities,
  requirements = excluded.requirements,
  employment_type = excluded.employment_type,
  suburb = excluded.suburb,
  state = excluded.state,
  postcode = excluded.postcode,
  status = excluded.status;

alter table public.applications add column if not exists cover_letter_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  5242880,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

create policy "own_application_document_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own_application_document_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own_application_document_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );