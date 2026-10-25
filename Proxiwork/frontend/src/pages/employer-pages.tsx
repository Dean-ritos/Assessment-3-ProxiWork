import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Download, ExternalLink, MapPin, Pencil, Plus } from "lucide-react";
import { Button, ErrorBox, Header, Logo } from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  employerApplicationCounts,
  employerApplicantDetail,
  employerApplicants,
  employerApplicantDocumentUrl,
  employerJobs,
  getEmployer,
  saveEmployer,
  saveEmployerJob,
  updateEmployerApplicationStatus,
  type Employer,
  type EmployerJob,
} from "../services/employer";

const authSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
});

const companySchema = z.object({
  company_name: z.string().min(2, "Company name is required"),
  abn: z.string().regex(/^\d{11}$/, "Enter an 11-digit ABN"),
  industry: z.string().min(2, "Industry is required"),
  description: z.string().min(20, "Add at least 20 characters"),
  website: z.union([z.literal(""), z.url("Enter a valid website URL")]),
  suburb: z.string().min(2, "Suburb is required"),
  state: z.string().length(3, "Use a three-letter state code, e.g. VIC"),
  postcode: z.string().regex(/^\d{4}$/, "Enter a 4-digit postcode"),
});

const vacancySchema = z.object({
  title: z.string().min(2, "Job title is required"),
  description: z.string().min(20, "Add a short description of at least 20 characters"),
  responsibilities: z.string().min(10, "Describe what the person will do"),
  requirements: z.string().min(10, "Describe what the person will bring"),
  experience_required: z.string().min(10, "Describe the required experience"),
  employment_type: z.enum(["casual", "part_time", "full_time", "contract"]),
  suburb: z.string().min(2, "Suburb is required"),
  state: z.string().length(3, "Use a three-letter state code, e.g. VIC"),
  postcode: z.string().regex(/^\d{4}$/, "Enter a 4-digit postcode"),
  status: z.enum(["draft", "published", "closed"]),
});

type CompanyForm = z.infer<typeof companySchema>;
type VacancyForm = z.infer<typeof vacancySchema>;

const blankCompany: CompanyForm = {
  company_name: "",
  abn: "",
  industry: "",
  description: "",
  website: "",
  suburb: "",
  state: "VIC",
  postcode: "",
};

function EmployerShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header logoTo="/employer/dashboard" mode="employer" />
      <main className="mx-auto min-h-screen max-w-6xl p-5 pb-10">{children}</main>
    </>
  );
}

function Field({
  label,
  error,
  ...props
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" {...props} />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}

function TextField({
  label,
  error,
  ...props
}: { label: string; error?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <textarea className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" {...props} />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function EmployerLoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
  });
  const submit = async (value: z.infer<typeof authSchema>) => {
    setError("");
    if (!supabase) return setError("Supabase is not configured.");
    const { error: authError } = await supabase.auth.signInWithPassword(value);
    if (authError) return setError(authError.message);
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("account_type")
      .maybeSingle();
    if (profileError || data?.account_type !== "employer") {
      await supabase.auth.signOut();
      return setError("This is a candidate account. Use the job seeker login instead.");
    }
    navigate("/employer/dashboard", { replace: true });
  };
  return (
    <main className="min-h-screen bg-brand-pale p-5">
      <div className="mx-auto max-w-md pt-5">
        <Logo />
        <section className="mt-10 rounded-3xl bg-white p-7 shadow-sm">
          <p className="font-bold text-brand-teal">Employer portal</p>
          <h1 className="mt-2 text-3xl font-black">Welcome back</h1>
          <p className="mt-2 text-slate-600">Sign in to manage your company and vacancies.</p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(submit)}>
            <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
            <Field label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
            {error && <ErrorBox>{error}</ErrorBox>}
            <Button disabled={isSubmitting} type="submit">{isSubmitting ? "Signing in…" : "Sign in"}</Button>
          </form>
          <p className="mt-5 text-sm">New employer? <Link className="font-bold text-brand-purple" to="/employer/register">Create an employer account</Link></p>
          <p className="mt-3 text-sm"><Link className="font-bold text-brand-purple" to="/login">Looking for work instead?</Link></p>
        </section>
      </div>
    </main>
  );
}

export function EmployerRegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const schema = authSchema.extend({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    terms: z.literal(true, { error: "Accept the Terms and Privacy Policy" }),
  });
  type Form = z.infer<typeof schema>;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
  const submit = async (value: Form) => {
    setError(""); setMessage("");
    if (!supabase) return setError("Supabase is not configured.");
    const { data, error: authError } = await supabase.auth.signUp({
      email: value.email,
      password: value.password,
      options: { data: { first_name: value.first_name, last_name: value.last_name, account_type: "employer" } },
    });
    if (authError) return setError(authError.message);
    if (data.session) navigate("/employer/onboarding", { replace: true });
    else setMessage("Check your email to confirm your account, then sign in to set up your company.");
  };
  return (
    <main className="min-h-screen bg-brand-pale p-5"><div className="mx-auto max-w-md pt-5"><Logo />
      <section className="mt-10 rounded-3xl bg-white p-7 shadow-sm"><p className="font-bold text-brand-teal">Employer portal</p><h1 className="mt-2 text-3xl font-black">Create your employer account</h1>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(submit)}><div className="grid gap-4 sm:grid-cols-2"><Field label="First name" error={errors.first_name?.message} {...register("first_name")} /><Field label="Last name" error={errors.last_name?.message} {...register("last_name")} /></div><Field label="Email" type="email" error={errors.email?.message} {...register("email")} /><Field label="Password" type="password" error={errors.password?.message} {...register("password")} /><label className="flex gap-2 text-sm"><input type="checkbox" {...register("terms")} />I agree to the Terms and Privacy Policy.</label>{errors.terms && <ErrorBox>{errors.terms.message}</ErrorBox>}{error && <ErrorBox>{error}</ErrorBox>}{message && <p className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}<Button disabled={isSubmitting} type="submit">{isSubmitting ? "Creating account…" : "Create employer account"}</Button></form>
        <p className="mt-5 text-sm">Already registered? <Link className="font-bold text-brand-purple" to="/employer/login">Employer sign in</Link></p>
      </section></div></main>
  );
}

export function EmployerOnboardingPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CompanyForm>({ resolver: zodResolver(companySchema), defaultValues: blankCompany });
  useEffect(() => { void getEmployer().then((employer) => { if (employer) reset({ ...employer, website: employer.website ?? "", abn: employer.abn ?? "", industry: employer.industry ?? "" }); }).catch((issue) => setError(issue.message)); }, [reset]);
  const submit = async (value: CompanyForm) => {
    setError("");
    try {
      await saveEmployer({ ...value, website: value.website || null, onboarding_completed: true });
      await refreshProfile();
      navigate("/employer/dashboard", { replace: true });
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to save company profile."); }
  };
  return <EmployerShell><div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm"><p className="font-bold text-brand-teal">Employer setup</p><h1 className="mt-2 text-3xl font-black">Tell candidates about your company</h1><p className="mt-2 text-slate-600">Your ABN, location, and industry help build trust in your vacancy listings.</p><CompanyFormFields register={register} errors={errors} />{error && <div className="mt-5"><ErrorBox>{error}</ErrorBox></div>}<div className="mt-7"><Button disabled={isSubmitting} onClick={handleSubmit(submit)}>{isSubmitting ? "Saving…" : "Complete company profile"}</Button></div></div></EmployerShell>;
}

function CompanyFormFields({ register, errors }: { register: ReturnType<typeof useForm<CompanyForm>>["register"]; errors: ReturnType<typeof useForm<CompanyForm>>["formState"]["errors"] }) {
  return <div className="mt-6 grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Company name" error={errors.company_name?.message} {...register("company_name")} /><Field label="ABN" inputMode="numeric" error={errors.abn?.message} {...register("abn")} /></div><Field label="Industry" placeholder="e.g. Retail, Hospitality, Professional services" error={errors.industry?.message} {...register("industry")} /><TextField label="Company description" error={errors.description?.message} {...register("description")} /><Field label="Website (optional)" type="url" placeholder="https://example.com" error={errors.website?.message} {...register("website")} /><div className="grid gap-4 sm:grid-cols-3"><Field label="Suburb" error={errors.suburb?.message} {...register("suburb")} /><Field label="State" maxLength={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal uppercase" error={errors.state?.message} {...register("state")} /><Field label="Postcode" inputMode="numeric" error={errors.postcode?.message} {...register("postcode")} /></div></div>;
}

export function EmployerDashboardPage() {
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  useEffect(() => { void Promise.all([getEmployer(), employerJobs(), employerApplicationCounts()]).then(([company, vacancies, applicationCounts]) => { setEmployer(company); setJobs(vacancies); setCounts(applicationCounts); }).catch((issue) => setError(issue.message)); }, []);
  if (!employer && !error) return <EmployerShell><p>Loading employer portal…</p></EmployerShell>;
  if (!employer) return <EmployerShell><ErrorBox>{error || "Company profile not found."}</ErrorBox><Link className="mt-4 inline-block font-bold text-brand-purple" to="/employer/onboarding">Set up your company profile</Link></EmployerShell>;
  return <EmployerShell><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-bold text-brand-teal">Employer portal</p><h1 className="mt-1 text-3xl font-black">{employer.company_name}</h1><p className="mt-2 flex items-center gap-1 text-slate-600"><MapPin size={17} />{employer.suburb}, {employer.state}</p></div><Link className="inline-flex items-center gap-2 rounded-xl bg-[#0878F9] px-5 py-3 font-bold text-white shadow-sm hover:bg-[#0667D4]" to="/employer/jobs/new"><Plus size={18} />Post a vacancy</Link></div><div className="mt-6 flex gap-4"><Link className="inline-flex items-center gap-2 font-bold text-brand-purple" to="/employer/company"><Building2 size={18} />Edit company profile</Link></div>{error && <div className="mt-5"><ErrorBox>{error}</ErrorBox></div>}<section className="mt-8"><h2 className="text-2xl font-black">Your vacancies</h2>{jobs.length === 0 ? <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm"><p className="text-slate-600">You have not posted a vacancy yet.</p></div> : <div className="mt-4 grid gap-4">{jobs.map((job) => <article className="rounded-2xl bg-white p-5 shadow-sm" key={job.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold capitalize text-brand-purple">{job.status} · {job.employment_type.replace("_", " ")}</p><h3 className="mt-1 text-xl font-black">{job.title}</h3><p className="mt-1 text-slate-600">{job.suburb}, {job.state} · {counts[job.id] ?? 0} applications</p></div><Link className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 font-bold text-brand-purple" to={`/employer/jobs/${job.id}/edit`}><Pencil size={16} />Edit</Link></div></article>)}</div>}</section></EmployerShell>;
}

export function EmployerCompanyPage() {
  const navigate = useNavigate(); const [company, setCompany] = useState<Employer | null>(null); const [editing, setEditing] = useState(false); const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CompanyForm>({ resolver: zodResolver(companySchema), defaultValues: blankCompany });
  const formValues = (employer: Employer): CompanyForm => ({ ...employer, website: employer.website ?? "", abn: employer.abn ?? "", industry: employer.industry ?? "" });
  useEffect(() => { void getEmployer().then((employer) => { if (!employer) navigate("/employer/onboarding", { replace: true }); else { setCompany(employer); reset(formValues(employer)); } }).catch((issue) => setError(issue.message)); }, [navigate, reset]);
  const startEditing = () => { if (company) reset(formValues(company)); setError(""); setEditing(true); };
  const cancelEditing = () => { if (company) reset(formValues(company)); setError(""); setEditing(false); };
  const submit = async (value: CompanyForm) => { setError(""); try { const saved = await saveEmployer({ ...value, website: value.website || null, onboarding_completed: true }); setCompany(saved); reset(formValues(saved)); setEditing(false); } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to update company profile."); } };
  if (!company && !error) return <EmployerShell><p>Loading company details…</p></EmployerShell>;
  if (!company) return <EmployerShell><ErrorBox>{error || "Company profile not found."}</ErrorBox></EmployerShell>;
  return <EmployerShell><div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm">{editing ? <><p className="font-bold text-brand-teal">Company details</p><h1 className="mt-2 text-3xl font-black">Edit company details</h1><form className="mt-6" onSubmit={handleSubmit(submit)}><CompanyFormFields register={register} errors={errors} />{error && <div className="mt-5"><ErrorBox>{error}</ErrorBox></div>}<div className="mt-7 flex flex-wrap gap-3"><Button disabled={isSubmitting} type="submit">{isSubmitting ? "Saving…" : "Save changes"}</Button><button className="rounded-xl border px-5 py-3 font-bold" onClick={cancelEditing} type="button">Cancel</button></div></form></> : <><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-bold text-brand-teal">Employer portal</p><h1 className="mt-2 text-3xl font-black">{company.company_name}</h1><p className="mt-2 flex items-center gap-1 text-slate-600"><MapPin size={17} />{company.suburb}, {company.state} {company.postcode}</p></div><button className="inline-flex items-center gap-2 rounded-xl bg-[#7754E8] px-5 py-3 font-bold text-white hover:bg-violet-700" onClick={startEditing} type="button"><Pencil size={17} />Edit company details</button></div><dl className="mt-8 grid gap-6 sm:grid-cols-2"><div><dt className="text-sm font-bold text-slate-500">Industry</dt><dd className="mt-1 font-semibold">{company.industry || "Not provided"}</dd></div><div><dt className="text-sm font-bold text-slate-500">ABN</dt><dd className="mt-1 font-semibold">{company.abn || "Not provided"}</dd></div><div className="sm:col-span-2"><dt className="text-sm font-bold text-slate-500">Website</dt><dd className="mt-1 font-semibold">{company.website ? <a className="text-brand-purple underline" href={company.website} rel="noreferrer" target="_blank">{company.website}</a> : "Not provided"}</dd></div><div className="sm:col-span-2"><dt className="text-sm font-bold text-slate-500">Company description</dt><dd className="mt-1 whitespace-pre-wrap text-slate-700">{company.description || "Not provided"}</dd></div></dl></>}</div></EmployerShell>;
}

export function EmployerVacancyPage() {
  const { id } = useParams(); const navigate = useNavigate(); const [employer, setEmployer] = useState<Employer | null>(null); const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<VacancyForm>({ resolver: zodResolver(vacancySchema), defaultValues: { title: "", description: "", responsibilities: "", requirements: "", experience_required: "", employment_type: "full_time", suburb: "", state: "VIC", postcode: "", status: "draft" } });
  useEffect(() => { void Promise.all([getEmployer(), employerJobs()]).then(([company, vacancies]) => { if (!company) { navigate("/employer/onboarding", { replace: true }); return; } setEmployer(company); const job = vacancies.find((item) => item.id === id); if (id && !job) setError("Vacancy not found."); if (job) reset({ title: job.title, description: job.description, responsibilities: job.responsibilities ?? "", requirements: job.requirements ?? "", experience_required: job.experience_required ?? "", employment_type: job.employment_type, suburb: job.suburb, state: job.state, postcode: job.postcode, status: job.status }); }).catch((issue) => setError(issue.message)); }, [id, navigate, reset]);
  const submit = async (value: VacancyForm) => { if (!employer) return; setError(""); try { await saveEmployerJob(employer.id, value, id); navigate("/employer/dashboard", { replace: true }); } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to save vacancy."); } };
  return <EmployerShell><div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm"><p className="font-bold text-brand-teal">Employer portal</p><h1 className="mt-2 text-3xl font-black">{id ? "Edit vacancy" : "Post a vacancy"}</h1><form className="mt-6 space-y-5" onSubmit={handleSubmit(submit)}><Field label="Job title" error={errors.title?.message} {...register("title")} /><div className="grid gap-4 sm:grid-cols-3"><Field label="Suburb" error={errors.suburb?.message} {...register("suburb")} /><Field label="State" maxLength={3} error={errors.state?.message} {...register("state")} /><Field label="Postcode" inputMode="numeric" error={errors.postcode?.message} {...register("postcode")} /></div><label className="block text-sm font-bold">Employment type<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" {...register("employment_type")}><option value="casual">Casual</option><option value="part_time">Part time</option><option value="full_time">Full time</option><option value="contract">Contract</option></select>{errors.employment_type && <span className="text-xs text-red-600">{errors.employment_type.message}</span>}</label><TextField label="Short description" error={errors.description?.message} {...register("description")} /><TextField label="What you'll do" error={errors.responsibilities?.message} placeholder="Use a new line for each key responsibility." {...register("responsibilities")} /><TextField label="What you'll bring" error={errors.requirements?.message} placeholder="Use a new line for each quality or capability." {...register("requirements")} /><TextField label="Experience required" error={errors.experience_required?.message} {...register("experience_required")} /><label className="block text-sm font-bold">Vacancy status<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" {...register("status")}><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></label>{error && <ErrorBox>{error}</ErrorBox>}<div className="flex flex-wrap gap-3"><Button disabled={isSubmitting} type="submit">{isSubmitting ? "Saving…" : id ? "Save vacancy" : "Create vacancy"}</Button><Link className="rounded-xl border px-5 py-3 font-bold" to="/employer/dashboard">Cancel</Link></div></form></div></EmployerShell>;
}

export function EmployerApplicantsPage() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof employerApplicants>>>([]);
  const [error, setError] = useState("");
  useEffect(() => { void employerApplicants().then(setItems).catch((issue) => setError(issue.message)); }, []);
  return <EmployerShell><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-bold text-brand-teal">Employer portal</p><h1 className="mt-1 text-3xl font-black">Applicants</h1></div><Link className="rounded-xl bg-[#7754E8] px-4 py-3 font-bold text-white" to="/employer/jobs/new">Post vacancy</Link></div>{error && <div className="mt-5"><ErrorBox>{error}</ErrorBox></div>}<section className="mt-6 space-y-3">{items.length ? items.map((item) => <Link className="block rounded-2xl bg-white p-5 shadow-sm hover:ring-2 hover:ring-brand-purple" key={item.application_id} to={`/employer/applicants/${item.application_id}`}><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black">{item.first_name} {item.last_name}</h2><p className="text-sm text-slate-600">{item.job_title} · {item.suburb}, {item.state}</p></div><span className="inline-flex min-h-8 items-center justify-center rounded-full bg-violet-100 px-3 text-center text-sm font-bold capitalize leading-none text-brand-purple">{item.status}</span></div>{item.skills.length > 0 && <p className="mt-3 text-sm text-slate-600">{item.skills.join(" · ")}</p>}</Link>) : <p className="rounded-2xl bg-white p-8 text-center text-slate-600">Applications for your vacancies will appear here.</p>}</section></EmployerShell>;
}

export function EmployerApplicantDetailPage() {
  const { applicationId = "" } = useParams();
  const [item, setItem] = useState<Awaited<ReturnType<typeof employerApplicantDetail>>>(null);
  const [error, setError] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [today] = useState(() => new Date());
  useEffect(() => { void employerApplicantDetail(applicationId).then(setItem).catch((issue) => setError(issue.message)); }, [applicationId]);
  const update = async (status: string) => { try { await updateEmployerApplicationStatus(applicationId, status); setItem((current) => current ? { ...current, status } : current); } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to update application."); } };
  const formatMonthYear = (date: string | null) => date ? new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : "Not provided";
  const workDuration = (start: string, end: string | null, current: boolean) => { const startDate = new Date(`${start}T00:00:00Z`); const endDate = current ? today : end ? new Date(`${end}T00:00:00Z`) : null; if (Number.isNaN(startDate.valueOf()) || !endDate || endDate < startDate) return ""; const months = Math.max(0, (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + endDate.getUTCMonth() - startDate.getUTCMonth()); const years = Math.floor(months / 12); const remainingMonths = months % 12; return [years ? `${years} ${years === 1 ? "year" : "years"}` : "", remainingMonths ? `${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}` : ""].filter(Boolean).join(" ") || "Less than a month"; };
  const openDocument = async (bucket: "cvs" | "application-documents", path: string, download = false) => { setDocumentError(""); try { const url = await employerApplicantDocumentUrl(bucket, path, download); window.open(url, "_blank", "noopener,noreferrer"); } catch (issue) { setDocumentError(issue instanceof Error ? issue.message : "Unable to access this document."); } };
  return <EmployerShell><Link className="font-bold text-brand-purple" to="/employer/applicants">← Back to applicants</Link>{error && <div className="mt-5"><ErrorBox>{error}</ErrorBox></div>}{item && <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm"><div className="flex flex-wrap justify-between gap-4"><div><p className="font-bold text-brand-teal">Applicant for {item.job_title}</p><h1 className="mt-1 text-3xl font-black">{item.first_name} {item.last_name}</h1><p className="mt-2 text-slate-600">{item.suburb}, {item.state}</p></div><select className="h-fit rounded-xl border px-3 py-2 font-bold capitalize" onChange={(event) => void update(event.target.value)} value={item.status}><option value="submitted">submitted</option><option value="reviewing">reviewing</option><option value="shortlisted">shortlisted</option><option value="rejected">rejected</option><option value="accepted">accepted</option></select></div><h2 className="mt-7 font-black">Skills</h2><p className="mt-2 text-slate-600">{item.skills.join(" · ") || "No skills listed"}</p><section className="mt-7"><h2 className="font-black">Application documents</h2>{documentError && <div className="mt-3"><ErrorBox>{documentError}</ErrorBox></div>}<div className="mt-3 flex flex-wrap gap-3">{item.resume_path && <><button className="inline-flex items-center gap-2 rounded-xl border border-brand-purple px-4 py-2 font-bold text-brand-purple" onClick={() => void openDocument("cvs", item.resume_path!)} type="button"><ExternalLink size={17} />View CV</button><button className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-bold" onClick={() => void openDocument("cvs", item.resume_path!, true)} type="button"><Download size={17} />Download CV</button></>}{item.cover_letter_path && <><button className="inline-flex items-center gap-2 rounded-xl border border-brand-purple px-4 py-2 font-bold text-brand-purple" onClick={() => void openDocument("application-documents", item.cover_letter_path!)} type="button"><ExternalLink size={17} />View cover letter</button><button className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-bold" onClick={() => void openDocument("application-documents", item.cover_letter_path!, true)} type="button"><Download size={17} />Download cover letter</button></>}{!item.resume_path && !item.cover_letter_path && <p className="text-slate-600">No documents attached.</p>}</div></section>{item.cover_letter && <section className="mt-7"><h2 className="font-black">Cover letter</h2><p className="mt-2 whitespace-pre-wrap text-slate-700">{item.cover_letter}</p></section>}<section className="mt-7"><h2 className="font-black">Experience</h2>{item.experiences.length ? <div className="mt-3 space-y-3">{item.experiences.map((experience, index) => <article className="rounded-xl bg-slate-50 p-4" key={`${experience.company_name}-${experience.position_title}-${index}`}><p className="font-bold">{experience.position_title || "Position"}</p><p className="text-sm text-slate-600">{experience.company_name || "Company not provided"}</p><p className="mt-1 text-sm font-semibold text-slate-700">{formatMonthYear(experience.start_date)} – {experience.is_current ? "Present" : formatMonthYear(experience.end_date)}</p>{workDuration(experience.start_date, experience.end_date, experience.is_current) && <p className="mt-1 text-sm text-slate-600">{workDuration(experience.start_date, experience.end_date, experience.is_current)}</p>}{experience.description && <div className="mt-3 border-t border-slate-200 pt-3"><p className="text-sm font-bold text-slate-700">Job duties</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{experience.description}</p></div>}</article>)}</div> : <p className="mt-2 text-slate-600">No experience listed.</p>}</section><section className="mt-7"><h2 className="font-black">Qualifications</h2>{item.education_entries.length ? <div className="mt-3 space-y-3">{item.education_entries.map((education, index) => <article className="rounded-xl bg-slate-50 p-4" key={`${education.institution}-${education.course_name}-${index}`}><p className="font-bold">{education.course_name || "Qualification"}</p><p className="text-sm font-semibold text-slate-700">{education.certification_level}</p><p className="mt-1 text-sm text-slate-600">{education.institution}</p><p className="mt-2 text-sm text-slate-600">{education.is_currently_studying ? "Currently studying" : education.end_date ? `Year obtained: ${new Date(`${education.end_date}T00:00:00Z`).getUTCFullYear()}` : "Completion year not provided"}</p></article>)}</div> : <p className="mt-2 text-slate-600">No qualifications listed.</p>}</section></section>}</EmployerShell>;
}