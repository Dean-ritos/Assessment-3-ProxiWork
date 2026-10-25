import { supabase } from "../lib/supabase";
export type Job = {
  id: string;
  title: string;
  description: string;
  employment_type: string;
  suburb: string;
  state: string;
  employers: { company_name: string }[] | null;
};
export type JobFilters = {
  query?: string;
  employmentType?: string;
  location?: string;
};
export async function jobs(filters: JobFilters = {}) {
  if (!supabase)
    throw new Error("Supabase is not configured. Add frontend/.env.local.");
  let request = supabase
    .from("jobs")
    .select(
      "id,title,description,employment_type,suburb,state,employers(company_name)",
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (filters.employmentType)
    request = request.eq("employment_type", filters.employmentType);
  if (filters.query?.trim())
    request = request.or(
      `title.ilike.%${filters.query.trim()}%,description.ilike.%${filters.query.trim()}%`,
    );
  if (filters.location?.trim())
    request = request.or(
      `suburb.ilike.%${filters.location.trim()}%,state.ilike.%${filters.location.trim()}%`,
    );
  const { data, error } = await request;
  if (error) throw error;
  return data as Job[];
}
export async function action(job_id: string, action: "saved" | "dismissed") {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("saved_jobs")
    .upsert({ job_id, action }, { onConflict: "user_id,job_id" });
  if (error) throw error;
}
export async function apply(job_id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("applications").insert({ job_id });
  if (error) throw error;
}
export async function activity() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const [saved, applications] = await Promise.all([
    supabase
      .from("saved_jobs")
      .select(
        "id,action,created_at,jobs(id,title,employment_type,suburb,state,employers(company_name))",
      )
      .eq("action", "saved")
      .order("created_at", { ascending: false }),
    supabase
      .from("applications")
      .select(
        "id,status,created_at,jobs(id,title,employment_type,suburb,state,employers(company_name))",
      )
      .order("created_at", { ascending: false }),
  ]);
  if (saved.error) throw saved.error;
  if (applications.error) throw applications.error;
  return { saved: saved.data ?? [], applications: applications.data ?? [] };
}
