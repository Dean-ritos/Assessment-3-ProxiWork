import { supabase } from "../lib/supabase";

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  resume_path: string | null;
  preferred_distance_km: number;
  weekly_application_goal: number;
  onboarding_completed: boolean;
};

export type Experience = {
  id?: string;
  company_name: string;
  position_title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
};
export type Education = {
  id?: string;
  certification_level: string;
  course_name: string;
  institution: string;
  start_date: string | null;
  end_date: string | null;
  is_currently_studying: boolean;
};
export type RecentSearch = {
  id: string;
  query: string;
  employment_type: string | null;
  location: string;
  created_at: string;
};

function client() {
  if (!supabase)
    throw new Error("Supabase is not configured. Add frontend/.env.local.");
  return supabase;
}

export async function getProfile() {
  const { data, error } = await client().from("profiles").select("*").single();
  if (error) throw error;
  return data as Profile;
}

export async function getProfileBundle() {
  const db = client();
  const [profile, skillRows, experienceRows, educationRows] = await Promise.all(
    [
      getProfile(),
      db.from("profile_skills").select("skills(name)").order("created_at"),
      db
        .from("work_experience")
        .select("*")
        .order("start_date", { ascending: false }),
      db.from("education").select("*").order("end_date", { ascending: false }),
    ],
  );
  if (skillRows.error) throw skillRows.error;
  if (experienceRows.error) throw experienceRows.error;
  if (educationRows.error) throw educationRows.error;
  return {
    profile,
    skills: (skillRows.data ?? []).flatMap(
      (row: { skills: { name: string } | { name: string }[] | null }) =>
        Array.isArray(row.skills)
          ? row.skills.map((skill) => skill.name)
          : row.skills
            ? [row.skills.name]
            : [],
    ),
    experiences: (experienceRows.data ?? []) as Experience[],
    education: (educationRows.data ?? []) as Education[],
  };
}

export async function saveProfileBundle(input: {
  profile: Omit<Profile, "id" | "resume_path" | "onboarding_completed"> & {
    resume_path?: string | null;
    onboarding_completed?: boolean;
  };
  skills: string[];
  experiences: Experience[];
  education: Education[];
}) {
  const db = client();
  const { data: user, error: userError } = await db.auth.getUser();
  if (userError) throw userError;
  if (!user.user)
    throw new Error("You need to sign in before saving your profile.");
  const profileId = user.user.id;
  const { error: profileError } = await db
    .from("profiles")
    .upsert({ id: profileId, ...input.profile }, { onConflict: "id" });
  if (profileError) throw profileError;

  const normalized = [
    ...new Set(input.skills.map((skill) => skill.trim()).filter(Boolean)),
  ];
  const { error: deleteSkillsError } = await db
    .from("profile_skills")
    .delete()
    .eq("profile_id", profileId);
  if (deleteSkillsError) throw deleteSkillsError;
  if (normalized.length) {
    const normalisedNames = normalized.map((name) => name.toLowerCase());
    const { data: existingSkills, error: existingSkillsError } = await db
      .from("skills")
      .select("id,name")
      .in("normalised_name", normalisedNames);
    if (existingSkillsError) throw existingSkillsError;
    const existingNames = new Set(
      (existingSkills ?? []).map((skill) => skill.name.toLowerCase()),
    );
    const missingSkills = normalized.filter(
      (name) => !existingNames.has(name.toLowerCase()),
    );
    if (missingSkills.length) {
      const { error: skillError } = await db.from("skills").insert(
        missingSkills.map((name) => ({
          name,
          normalised_name: name.toLowerCase(),
        })),
      );
      if (skillError) throw skillError;
    }
    const { data: skills, error: skillsError } = await db
      .from("skills")
      .select("id,name")
      .in("normalised_name", normalisedNames);
    if (skillsError) throw skillsError;
    const { error: linkError } = await db.from("profile_skills").insert(
      (skills ?? []).map((skill) => ({
        profile_id: profileId,
        skill_id: skill.id,
      })),
    );
    if (linkError) throw linkError;
  }

  const { error: deleteExperienceError } = await db
    .from("work_experience")
    .delete()
    .eq("profile_id", profileId);
  if (deleteExperienceError) throw deleteExperienceError;
  if (input.experiences.length) {
    const { error } = await db.from("work_experience").insert(
      input.experiences.map(({ id: _id, ...experience }) => ({
        ...experience,
        profile_id: profileId,
      })),
    );
    if (error) throw error;
  }
  const { error: deleteEducationError } = await db
    .from("education")
    .delete()
    .eq("profile_id", profileId);
  if (deleteEducationError) throw deleteEducationError;
  if (input.education.length) {
    const { error } = await db.from("education").insert(
      input.education.map(({ id: _id, ...entry }) => ({
        ...entry,
        profile_id: profileId,
      })),
    );
    if (error) throw error;
  }
}

export async function uploadCv(file: File) {
  if (
    ![
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(file.type)
  )
    throw new Error("Choose a PDF or DOCX file.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Your CV must be 5 MB or smaller.");
  const db = client();
  const { data, error } = await db.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("You need to sign in before uploading a CV.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${data.user.id}/cv.${extension}`;
  const { error: uploadError } = await db.storage
    .from("cvs")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;
  return path;
}

export async function recentSearches() {
  const { data, error } = await client()
    .from("job_searches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []) as RecentSearch[];
}

export async function rememberSearch(
  search: Omit<RecentSearch, "id" | "created_at">,
) {
  if (
    !search.query.trim() &&
    !search.location.trim() &&
    !search.employment_type
  )
    return;
  const { error } = await client().from("job_searches").insert(search);
  if (error) throw error;
}

export async function removeRecentSearch(id: string) {
  const { error } = await client().from("job_searches").delete().eq("id", id);
  if (error) throw error;
}
