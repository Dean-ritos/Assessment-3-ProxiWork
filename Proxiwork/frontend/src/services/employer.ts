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
    .select("*")
    .eq("employer_id", employer.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmployerJob[];
}

export async function saveEmployerJob(
  employerId: string,
  input: EmployerJobInput,
  jobId?: string,
) {
  const db = client();
  const payload = { ...input, employer_id: employerId };
  const request = jobId
    ? db.from("jobs").update(payload).eq("id", jobId)
    : db.from("jobs").insert(payload);
  const { data, error } = await request.select("*").single();
  if (error) throw error;
  return data as EmployerJob;
}

export async function employerApplicationCounts() {
  const { data, error } = await client().from("applications").select("job_id");
  if (error) throw error;
  return (data ?? []).reduce<Record<string, number>>((counts, application) => {
    counts[application.job_id] = (counts[application.job_id] ?? 0) + 1;
    return counts;
  }, {});
}