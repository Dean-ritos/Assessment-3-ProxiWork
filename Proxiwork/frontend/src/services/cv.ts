import { apiBaseUrl, supabase } from "../lib/supabase";
import type { Education, Experience } from "./profile";

export type CvExtraction = {
  profile: {
    first_name: string;
    last_name: string;
    phone: string;
    suburb: string;
    state: string;
    postcode: string;
  };
  skills: string[];
  experiences: Experience[];
  education: Education[];
};

export async function extractCvDetails(file: File): Promise<CvExtraction> {
  if (!supabase)
    throw new Error("Supabase is not configured. Add frontend/.env.local.");
  if (
    ![
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(file.type)
  )
    throw new Error("Choose a PDF or DOCX file.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Your CV must be 5 MB or smaller.");

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session)
    throw new Error("You need to sign in before extracting CV details.");

  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${apiBaseUrl}/cv/extract`, {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    body: formData,
  });
  const body = (await response.json().catch(() => null)) as
    | CvExtraction
    | { detail?: string }
    | null;
  if (!response.ok)
    throw new Error(
      body && "detail" in body && body.detail
        ? body.detail
        : "Unable to extract details from this CV.",
    );
  return body as CvExtraction;
}