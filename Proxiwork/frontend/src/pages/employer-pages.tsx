import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, MapPin, Pencil, Plus } from "lucide-react";
import { Button, ErrorBox, Header, Logo } from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  employerApplicationCounts,
  employerJobs,
  getEmployer,
  saveEmployer,
  saveEmployerJob,
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
      <Header logoTo="/employer/dashboard" />
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
  const navigate = useNavigate(); const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CompanyForm>({ resolver: zodResolver(companySchema), defaultValues: blankCompany });
  useEffect(() => { void getEmployer().then((employer) => { if (!employer) navigate("/employer/onboarding", { replace: true }); else reset({ ...employer, website: employer.website ?? "", abn: employer.abn ?? "", industry: employer.industry ?? "" }); }).catch((issue) => setError(issue.message)); }, [navigate, reset]);
  const submit = async (value: CompanyForm) => { setError(""); try { await saveEmployer({ ...value, website: value.website || null, onboarding_completed: true }); navigate("/employer/dashboard"); } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to update company profile."); } };
  return <EmployerShell><div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm"><h1 className="text-3xl font-black">Edit company profile</h1><CompanyFormFields register={register} errors={errors} />{error && <div className="mt-5"><ErrorBox>{error}</ErrorBox></div>}<div className="mt-7 flex gap-3"><Button disabled={isSubmitting} onClick={handleSubmit(submit)}>{isSubmitting ? "Saving…" : "Save company profile"}</Button><Link className="rounded-xl border px-5 py-3 font-bold" to="/employer/dashboard">Cancel</Link></div></div></EmployerShell>;
}

export function EmployerVacancyPage() {
  const { id } = useParams(); const navigate = useNavigate(); const [employer, setEmployer] = useState<Employer | null>(null); const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<VacancyForm>({ resolver: zodResolver(vacancySchema), defaultValues: { title: "", description: "", responsibilities: "", requirements: "", experience_required: "", employment_type: "full_time", suburb: "", state: "VIC", postcode: "", status: "draft" } });
  useEffect(() => { void Promise.all([getEmployer(), employerJobs()]).then(([company, vacancies]) => { if (!company) { navigate("/employer/onboarding", { replace: true }); return; } setEmployer(company); const job = vacancies.find((item) => item.id === id); if (id && !job) setError("Vacancy not found."); if (job) reset({ title: job.title, description: job.description, responsibilities: job.responsibilities ?? "", requirements: job.requirements ?? "", experience_required: job.experience_required ?? "", employment_type: job.employment_type, suburb: job.suburb, state: job.state, postcode: job.postcode, status: job.status }); }).catch((issue) => setError(issue.message)); }, [id, navigate, reset]);
  const submit = async (value: VacancyForm) => { if (!employer) return; setError(""); try { await saveEmployerJob(employer.id, value, id); navigate("/employer/dashboard", { replace: true }); } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to save vacancy."); } };
  return <EmployerShell><div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm"><p className="font-bold text-brand-teal">Employer portal</p><h1 className="mt-2 text-3xl font-black">{id ? "Edit vacancy" : "Post a vacancy"}</h1><form className="mt-6 space-y-5" onSubmit={handleSubmit(submit)}><Field label="Job title" error={errors.title?.message} {...register("title")} /><div className="grid gap-4 sm:grid-cols-3"><Field label="Suburb" error={errors.suburb?.message} {...register("suburb")} /><Field label="State" maxLength={3} error={errors.state?.message} {...register("state")} /><Field label="Postcode" inputMode="numeric" error={errors.postcode?.message} {...register("postcode")} /></div><label className="block text-sm font-bold">Employment type<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" {...register("employment_type")}><option value="casual">Casual</option><option value="part_time">Part time</option><option value="full_time">Full time</option><option value="contract">Contract</option></select>{errors.employment_type && <span className="text-xs text-red-600">{errors.employment_type.message}</span>}</label><TextField label="Short description" error={errors.description?.message} {...register("description")} /><TextField label="What you'll do" error={errors.responsibilities?.message} placeholder="Use a new line for each key responsibility." {...register("responsibilities")} /><TextField label="What you'll bring" error={errors.requirements?.message} placeholder="Use a new line for each quality or capability." {...register("requirements")} /><TextField label="Experience required" error={errors.experience_required?.message} {...register("experience_required")} /><label className="block text-sm font-bold">Vacancy status<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" {...register("status")}><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></label>{error && <ErrorBox>{error}</ErrorBox>}<div className="flex flex-wrap gap-3"><Button disabled={isSubmitting} type="submit">{isSubmitting ? "Saving…" : id ? "Save vacancy" : "Create vacancy"}</Button><Link className="rounded-xl border px-5 py-3 font-bold" to="/employer/dashboard">Cancel</Link></div></form></div></EmployerShell>;
}