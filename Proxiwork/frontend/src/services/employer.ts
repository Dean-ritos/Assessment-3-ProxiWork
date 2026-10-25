import { supabase } from "../lib/supabase";

export type Employer = {
  id: string;
  company_name: string;
  description: string;
  website: string | null;
  abn: string | null;
  industry: string | null;
  suburb: string;
  state: string;
  postcode: string;
  onboarding_completed: boolean;
};

export type EmployerJob = {
  id: string;
  title: string;
  description: string;
  responsibilities: string | null;
  requirements: string | null;
  experience_required: string | null;
  employment_type: "casual" | "part_time" | "full_time" | "contract";
  suburb: string;
  state: string;
  postcode: string;
  status: "draft" | "published" | "closed";
  created_at: string;
  skills?: string[];
};

export type EmployerJobInput = Omit<
  EmployerJob,
  "id" | "created_at"
>;

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function getEmployer() {
  const db = client();
  const { data: userResult, error: userError } = await db.auth.getUser();
  if (userError) throw userError;
  if (!userResult.user) throw new Error("You need to sign in first.");
  const { data, error } = await db
    .from("employers")
    .select("*")
    .eq("owner_user_id", userResult.user.id)
    .maybeSingle();
  if (error) throw error;
  return data as Employer | null;
}

export async function saveEmployer(input: Omit<Employer, "id">) {
  const db = client();
  const { data: userResult, error: userError } = await db.auth.getUser();
  if (userError) throw userError;
  if (!userResult.user) throw new Error("You need to sign in first.");
  const existing = await getEmployer();
  const request = existing
    ? db.from("employers").update(input).eq("id", existing.id)
    : db.from("employers").insert({ ...input, owner_user_id: userResult.user.id });
  const { data, error } = await request.select("*").single();
  if (error) throw error;
  return data as Employer;
}

export async function employerJobs() {
  const employer = await getEmployer();
  if (!employer) return [];
  const { data, error } = await client()
    .from("jobs")
    .select("*,job_skills(skills(name))")
    .eq("employer_id", employer.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((job) => ({ ...job, skills: (job.job_skills ?? []).flatMap((item: { skills: { name: string }[] | null }) => item.skills?.map((skill) => skill.name) ?? []) })) as EmployerJob[];
}

export async function saveEmployerJob(
  employerId: string,
  input: EmployerJobInput & { skills?: string[] },
  jobId?: string,
) {
  const db = client();
  const { skills = [], ...jobInput } = input;
  const payload = { ...jobInput, employer_id: employerId };
  const request = jobId
    ? db.from("jobs").update(payload).eq("id", jobId)
    : db.from("jobs").insert(payload);
  const { data, error } = await request.select("*").single();
  if (error) throw error;
  const job = data as EmployerJob;
  const normalisedSkills = [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))];
  await db.from("job_skills").delete().eq("job_id", job.id);
  if (normalisedSkills.length) {
    const { data: rows, error: skillError } = await db.from("skills").upsert(normalisedSkills.map((name) => ({ name, normalised_name: name.toLowerCase() })), { onConflict: "normalised_name" }).select("id");
    if (skillError) throw skillError;
    const { error: joinError } = await db.from("job_skills").insert((rows ?? []).map((skill) => ({ job_id: job.id, skill_id: skill.id })));
    if (joinError) throw joinError;
  }
  return { ...job, skills: normalisedSkills };
}

export async function employerApplicationCounts() {
  const { data, error } = await client().from("applications").select("job_id");
  if (error) throw error;
  return (data ?? []).reduce<Record<string, number>>((counts, application) => {
    counts[application.job_id] = (counts[application.job_id] ?? 0) + 1;
    return counts;
  }, {});
}

export type EmployerMetrics = { company_page_views: number; job_listing_views: number; recent_company_page_views: number };
export type EmployerApplicant = { application_id: string; job_id: string; job_title: string; applicant_id: string; first_name: string; last_name: string; suburb: string; state: string; status: string; applied_at: string; skills: string[]; cover_letter: string | null };
export type ApplicantExperience = { company_name: string; position_title: string; start_date: string; end_date: string | null; is_current: boolean; description: string | null };
export type ApplicantEducation = { certification_level: string; course_name: string; institution: string; start_date: string | null; end_date: string | null; is_currently_studying: boolean };
export type EmployerApplicantDetail = EmployerApplicant & { resume_path: string | null; cover_letter_path: string | null; experiences: ApplicantExperience[]; education_entries: ApplicantEducation[] };
export async function employerMetrics() { const { data, error } = await client().rpc("employer_dashboard_metrics"); if (error) throw error; return (data?.[0] ?? { company_page_views: 0, job_listing_views: 0, recent_company_page_views: 0 }) as EmployerMetrics; }
export async function employerJobViewCounts() { const { data, error } = await client().rpc("employer_job_view_counts"); if (error) throw error; return (data ?? []) as Array<{ job_id: string; view_count: number }>; }
export async function employerApplicants() { const { data, error } = await client().rpc("employer_applicants"); if (error) throw error; return (data ?? []) as EmployerApplicant[]; }
export async function employerApplicantDetail(applicationId: string) { const { data, error } = await client().rpc("employer_applicant_detail", { target_application_id: applicationId }); if (error) throw error; return (data?.[0] ?? null) as EmployerApplicantDetail | null; }
export async function employerApplicantDocumentUrl(bucket: "cvs" | "application-documents", path: string, download = false) {
  const { data, error } = await client().storage.from(bucket).createSignedUrl(path, 60, download ? { download: true } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
export async function updateEmployerApplicationStatus(applicationId: string, status: string) { const { error } = await client().rpc("update_employer_application_status", { target_application_id: applicationId, next_status: status }); if (error) throw error; }
export async function publicEmployer(employerId: string) { const { data, error } = await client().from("employers").select("id,company_name,description,website,industry,suburb,state,verification_status,jobs(id,title,description,employment_type,suburb,state,status,job_skills(skills(name)))").eq("id", employerId).eq("verification_status", "verified").maybeSingle(); if (error) throw error; return data; }
export async function recordCompanyPageVisit(employerId: string) { if (!supabase) return; const key = "proxiwork:visitor-token"; let token = localStorage.getItem(key); if (!token) { token = crypto.randomUUID(); localStorage.setItem(key, token); } await supabase.rpc("record_employer_page_visit", { target_employer_id: employerId, browser_visitor_token: token }); }
