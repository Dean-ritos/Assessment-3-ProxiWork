import { supabase } from "../lib/supabase";
export type Job = {
  id: string;
  title: string;
  description: string;
  responsibilities?: string | null;
  requirements?: string | null;
  employment_type: string;
  suburb: string;
  state: string;
  employers: { company_name: string }[] | null;
  is_example?: boolean;
};
export type JobFilters = {
  query?: string;
  employmentType?: string;
  location?: string;
};

const exampleJobs: Job[] = [
  {
    id: "example-office-administrator",
    title: "Office Administrator",
    description:
      "Help keep a busy local office organised by supporting customers, coordinating appointments, and keeping daily administration on track.",
    responsibilities:
      "Answer customer calls and emails\nCoordinate appointments and meeting rooms\nPrepare documents and update records\nSupport the team with day-to-day administration",
    requirements:
      "Friendly, clear communication\nComfortable using email and Microsoft Office\nOrganised with strong attention to detail\nPrevious administration experience is welcome but not essential",
    employment_type: "part_time",
    suburb: "Melbourne",
    state: "VIC",
    employers: [{ company_name: "Collins Street Services" }],
    is_example: true,
  },
  {
    id: "example-customer-service-member",
    title: "Customer Service Member",
    description:
      "Join a welcoming retail team and help customers find what they need in a busy Richmond store.",
    responsibilities:
      "Welcome and assist customers\nProcess purchases and returns\nKeep displays tidy and stocked\nWork with the team during busy periods",
    requirements:
      "Positive customer-first attitude\nReliable availability for casual shifts\nConfident communication\nRetail or hospitality experience is helpful",
    employment_type: "casual",
    suburb: "Richmond",
    state: "VIC",
    employers: [{ company_name: "Bridge Road Collective" }],
    is_example: true,
  },
  {
    id: "example-data-analyst",
    title: "Data Analyst",
    description:
      "Turn business data into clear reports and practical insights for a growing Southbank technology team.",
    responsibilities:
      "Prepare weekly performance reports\nAnalyse customer and operational data\nBuild clear dashboards for stakeholders\nPresent findings and recommendations",
    requirements:
      "Experience with Excel or Google Sheets\nConfidence working with data and patterns\nClear written and verbal communication\nSQL or dashboard experience is a bonus",
    employment_type: "contract",
    suburb: "Southbank",
    state: "VIC",
    employers: [{ company_name: "Yarra Insights" }],
    is_example: true,
  },
  {
    id: "example-retail-team-member",
    title: "Retail Team Member",
    description:
      "Support a friendly Fitzroy retail team with customer service, stock presentation, and flexible weekend shifts.",
    responsibilities:
      "Assist customers on the shop floor\nReceive and replenish stock\nMaintain attractive product displays\nSupport opening and closing routines",
    requirements:
      "Available for weekend work\nFriendly and proactive approach\nAble to work independently and in a team\nInterest in local retail and community",
    employment_type: "casual",
    suburb: "Fitzroy",
    state: "VIC",
    employers: [{ company_name: "Brunswick Street Market" }],
    is_example: true,
  },
  {
    id: "example-administration-assistant",
    title: "Administration Assistant",
    description:
      "Provide essential administration support to a community-focused team based in Carlton.",
    responsibilities:
      "Maintain accurate records\nCoordinate enquiries and bookings\nPrepare simple reports and correspondence\nSupport projects and team events",
    requirements:
      "Strong organisational skills\nProfessional written communication\nComfortable learning new systems\nA collaborative and dependable approach",
    employment_type: "full_time",
    suburb: "Carlton",
    state: "VIC",
    employers: [{ company_name: "Northside Community Hub" }],
    is_example: true,
  },
];

function matchesExampleJob(job: Job, filters: JobFilters) {
  const query = filters.query?.trim().toLowerCase();
  const location = filters.location?.trim().toLowerCase();
  const searchable =
    `${job.title} ${job.description} ${job.employers?.[0]?.company_name ?? ""}`.toLowerCase();
  const jobLocation = `${job.suburb} ${job.state}`.toLowerCase();
  return (
    (!filters.employmentType ||
      job.employment_type === filters.employmentType) &&
    (!query || searchable.includes(query)) &&
    (!location || jobLocation.includes(location))
  );
}

function filteredExampleJobs(filters: JobFilters) {
  return exampleJobs.filter((job) => matchesExampleJob(job, filters));
}

export async function jobs(filters: JobFilters = {}) {
  if (!supabase)
    throw new Error("Supabase is not configured. Add frontend/.env.local.");
  let request = supabase
    .from("jobs")
    .select(
      "id,title,description,responsibilities,requirements,employment_type,suburb,state,employers(company_name)",
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
  return data?.length ? (data as Job[]) : filteredExampleJobs(filters);
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
        "id,status,applied_at,jobs(id,title,employment_type,suburb,state,employers(company_name))",
      )
      .order("applied_at", { ascending: false }),
  ]);
  if (saved.error) throw saved.error;
  if (applications.error) throw applications.error;
  return { saved: saved.data ?? [], applications: applications.data ?? [] };
}
