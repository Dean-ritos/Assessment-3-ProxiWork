import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  MapPin,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BottomNav,
  Button,
  ErrorBox,
  Header,
  JobViewSwitch,
  Logo,
} from "../components/ui";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { extractCvDetails, type CvExtraction } from "../services/cv";
import {
  action,
  activity,
  apply,
  jobs,
  uploadCoverLetter,
  weeklyApplicationProgress,
  type Job,
} from "../services/jobs";
import {
  getProfileBundle,
  recentSearches,
  rememberSearch,
  removeRecentSearch,
  saveProfileBundle,
  uploadCv,
  type Education,
  type Experience,
  type Profile,
  type RecentSearch,
} from "../services/profile";

const authSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
});
type AuthForm = z.infer<typeof authSchema>;
type ProfileDraft = Pick<
  Profile,
  | "first_name"
  | "last_name"
  | "phone"
  | "suburb"
  | "state"
  | "postcode"
  | "preferred_distance_km"
  | "weekly_application_goal"
>;
const blankProfile: ProfileDraft = {
  first_name: "",
  last_name: "",
  phone: "",
  suburb: "",
  state: "",
  postcode: "",
  preferred_distance_km: 20,
  weekly_application_goal: 1,
};
const blankExperience = (): Experience => ({
  company_name: "",
  position_title: "",
  start_date: "",
  end_date: null,
  is_current: false,
  description: "",
});
const blankEducation = (): Education => ({
  certification_level: "",
  course_name: "",
  institution: "",
  start_date: null,
  end_date: null,
  is_currently_studying: false,
});
const employmentTypes = ["casual", "part_time", "full_time", "contract"];

function formatEmploymentType(type: string) {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function JobTypeSelect({
  selectedTypes,
  onChange,
}: {
  selectedTypes: string[];
  onChange: (types: string[]) => void;
}) {
  const selectionLabel = selectedTypes.length
    ? `${selectedTypes.length} selected`
    : "All job types";

  return (
    <details className="group relative">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-xl border border-slate-300 px-3 py-3 font-medium marker:content-none">
        <span>{selectionLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className="transition-transform group-open:rotate-180"
          size={18}
        />
      </summary>
      <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        {employmentTypes.map((type) => {
          const selected = selectedTypes.includes(type);
          return (
            <label
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50"
              key={type}
            >
              <input
                checked={selected}
                className="h-4 w-4 accent-[#0878F9]"
                onChange={() =>
                  onChange(
                    selected
                      ? selectedTypes.filter((value) => value !== type)
                      : [...selectedTypes, type],
                  )
                }
                type="checkbox"
              />
              <span>{formatEmploymentType(type)}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}

function formatMonthYear(date: string | null) {
  if (!date) return "";
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!match) return "";
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${match[1]}-${match[2]}-01T00:00:00Z`));
}

function preserveJobLineBreaks(text: string) {
  return text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}

function toMonthInputValue(date: string | null) {
  return date?.match(/^\d{4}-\d{2}-\d{2}$/) ? date.slice(0, 7) : "";
}

function MonthYearInput({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  optional?: boolean;
}) {
  return (
    <label className="block text-sm font-bold text-slate-700">
      {label}
      {optional ? " (optional)" : ""}
      <input
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal disabled:bg-slate-100"
        type="month"
        value={toMonthInputValue(value)}
        onChange={(event) =>
          onChange(event.target.value ? `${event.target.value}-01` : null)
        }
      />
    </label>
  );
}

function hasExperienceContent(entry: Experience) {
  return Boolean(
    entry.company_name.trim() ||
    entry.position_title.trim() ||
    entry.start_date ||
    entry.end_date ||
    entry.description?.trim(),
  );
}

function hasEducationContent(entry: Education) {
  return Boolean(
    entry.certification_level.trim() ||
    entry.course_name.trim() ||
    entry.institution.trim() ||
    entry.start_date ||
    entry.end_date,
  );
}

function Shell({
  children,
  logoTo,
  mobileBanner,
}: {
  children: React.ReactNode;
  logoTo?: string;
  mobileBanner?: React.ReactNode;
}) {
  return (
    <>
      <Header logoTo={logoTo} />
      {mobileBanner && <div className="md:hidden">{mobileBanner}</div>}
      <main className="mx-auto min-h-screen max-w-6xl p-5 pb-24 md:pb-8">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
function AuthShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-brand-pale p-5">
      <div className="mx-auto max-w-md">
        <div className="mb-12 pt-4">
          <Logo />
        </div>
        <section className="rounded-3xl bg-white p-7 shadow-sm">
          <h1 className="text-3xl font-black">{title}</h1>
          {!supabaseConfigured && (
            <div className="mt-4">
              <ErrorBox>
                Authentication requires VITE_SUPABASE_URL and
                VITE_SUPABASE_PUBLISHABLE_KEY. Add them to frontend/.env.local
                locally or Vercel Environment Variables before deploying.
              </ErrorBox>
            </div>
          )}
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
function Input({
  label,
  error,
  ...props
}: {
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal outline-brand-purple"
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
function Textarea({
  label,
  ...props
}: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <textarea
        className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal outline-brand-purple"
        {...props}
      />
    </label>
  );
}
function Pill({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#7754E8] px-3 py-1 text-sm font-bold text-white">
      {children}
      {onRemove && (
        <button
          aria-label={`Remove ${children}`}
          className="rounded-full p-0.5 hover:bg-white/20"
          onClick={onRemove}
        >
          <X size={14} />
        </button>
      )}
    </span>
  );
}

export function LandingPage() {
  return (
    <main className="min-h-screen bg-brand-pale">
      <div className="h-5 bg-brand-teal" />
      <section className="mx-auto flex min-h-[calc(100vh-20px)] max-w-6xl flex-col justify-between p-6 md:p-12">
        <Logo className="h-[min(600px,calc(100vw-3rem))] w-[min(600px,calc(100vw-3rem))]" />
        <div className="max-w-3xl py-16">
          <p className="inline-block rounded-full bg-teal-100 px-4 py-2 text-sm font-bold text-teal-800">
            Local opportunities, made simpler
          </p>
          <h1 className="mt-6 text-5xl font-black tracking-tight md:text-7xl">
            Local Jobs,
            <br />
            <span className="text-brand-purple">Real Connections.</span>
          </h1>
          <p className="mt-6 text-xl text-slate-600">
            Your next job can be closer than you think.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register">
              <Button tone="blue">Get started</Button>
            </Link>
            <Link
              className="rounded-xl border border-[#0878F9] px-5 py-3 font-bold text-[#0878F9] hover:bg-blue-50"
              to="/login"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthForm>({ resolver: zodResolver(authSchema) });
  const submit = async (value: AuthForm) => {
    setError("");
    if (!supabase) return setError("Supabase is not configured.");
    const { error: authError } = await supabase.auth.signInWithPassword(value);
    if (authError) return setError(authError.message);
    navigate("/app/search");
  };
  return (
    <AuthShell title="Welcome back">
      <p className="mb-6 text-slate-600">Log in to find work close to you.</p>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button disabled={isSubmitting} tone="blue" type="submit">
          {isSubmitting ? "Signing in…" : "Log in"}
        </Button>
      </form>
      <div className="mt-5 flex justify-between text-sm">
        <Link className="font-bold text-brand-purple" to="/reset-password">
          Forgot password?
        </Link>
        <Link className="font-bold text-brand-purple" to="/register">
          Create account
        </Link>
      </div>
    </AuthShell>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const schema = authSchema.extend({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    terms: z.literal(true, { error: "Accept the Terms and Privacy Policy" }),
  });
  type Register = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Register>({ resolver: zodResolver(schema) });
  const submit = async (value: Register) => {
    setError("");
    setMessage("");
    if (!supabase) return setError("Supabase is not configured.");
    const { data, error: authError } = await supabase.auth.signUp({
      email: value.email,
      password: value.password,
      options: {
        data: { first_name: value.first_name, last_name: value.last_name },
      },
    });
    if (authError) return setError(authError.message);
    if (data.session) navigate("/onboarding");
    else
      setMessage(
        "Check your email to confirm your account, then log in to complete your profile.",
      );
  };
  return (
    <AuthShell title="Create your account">
      <p className="mb-6 text-slate-600">
        Set up your account first, then we will build your job profile together.
      </p>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            autoComplete="given-name"
            error={errors.first_name?.message}
            {...register("first_name")}
          />
          <Input
            label="Last name"
            autoComplete="family-name"
            error={errors.last_name?.message}
            {...register("last_name")}
          />
        </div>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <label className="flex gap-2 text-sm">
          <input type="checkbox" {...register("terms")} />I agree to the Terms
          and Privacy Policy.
        </label>
        {errors.terms && <ErrorBox>{errors.terms.message}</ErrorBox>}
        {error && <ErrorBox>{error}</ErrorBox>}
        {message && (
          <p className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
            {message}
          </p>
        )}
        <Button disabled={isSubmitting} tone="blue" type="submit">
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-5 text-sm">
        Already have an account?{" "}
        <Link className="font-bold text-brand-purple" to="/login">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { register, handleSubmit } = useForm<{ email: string }>();
  const submit = async ({ email }: { email: string }) => {
    setError("");
    if (!supabase) return setError("Supabase is not configured.");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/reset-password` },
    );
    if (resetError) setError(resetError.message);
    else setMessage("If an account exists, a secure reset link has been sent.");
  };
  return (
    <AuthShell title="Reset password">
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          {...register("email", { required: true })}
        />
        {error && <ErrorBox>{error}</ErrorBox>}
        {message && (
          <p className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
            {message}
          </p>
        )}
        <Button tone="blue" type="submit">
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}

function ExperienceEditor({
  entries,
  setEntries,
}: {
  entries: Experience[];
  setEntries: React.Dispatch<React.SetStateAction<Experience[]>>;
}) {
  const update = (index: number, patch: Partial<Experience>) =>
    setEntries((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  return (
    <div className="space-y-4">
      {entries.map((entry, index) => (
        <fieldset
          className="rounded-2xl border border-slate-200 p-4"
          key={index}
        >
          <div className="mb-3 flex justify-between">
            <legend className="font-black">Experience {index + 1}</legend>
            <button
              className="text-sm font-bold text-red-600"
              onClick={() =>
                setEntries((items) =>
                  items.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              type="button"
            >
              <Trash2 className="inline" size={15} /> Remove
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Job title"
              value={entry.position_title}
              onChange={(event) =>
                update(index, { position_title: event.target.value })
              }
            />
            <Input
              label="Company"
              value={entry.company_name}
              onChange={(event) =>
                update(index, { company_name: event.target.value })
              }
            />
            <MonthYearInput
              label="Start date"
              value={entry.start_date}
              onChange={(start_date) =>
                update(index, { start_date: start_date ?? "" })
              }
            />
            {!entry.is_current ? (
              <MonthYearInput
                label="End date"
                optional
                value={entry.end_date}
                onChange={(end_date) => update(index, { end_date })}
              />
            ) : (
              <p className="self-end pb-2 text-sm text-slate-600">
                Current role — no end date required.
              </p>
            )}
          </div>
          <label className="mt-3 flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={entry.is_current}
              onChange={(event) =>
                update(index, {
                  is_current: event.target.checked,
                  end_date: event.target.checked ? null : entry.end_date,
                })
              }
            />
            I currently work here
          </label>
          <div className="mt-3">
            <Textarea
              label="Key duties (optional)"
              value={entry.description ?? ""}
              onChange={(event) =>
                update(index, { description: event.target.value })
              }
            />
          </div>
        </fieldset>
      ))}
      <button
        className="inline-flex items-center gap-1 font-bold text-brand-purple"
        onClick={() => setEntries((items) => [...items, blankExperience()])}
        type="button"
      >
        <Plus size={17} /> Add experience
      </button>
    </div>
  );
}

function EducationEditor({
  entries,
  setEntries,
}: {
  entries: Education[];
  setEntries: React.Dispatch<React.SetStateAction<Education[]>>;
}) {
  const update = (index: number, patch: Partial<Education>) =>
    setEntries((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  return (
    <div className="space-y-4">
      {entries.map((entry, index) => (
        <fieldset
          className="rounded-2xl border border-slate-200 p-4"
          key={index}
        >
          <div className="mb-3 flex justify-between">
            <legend className="font-black">Education {index + 1}</legend>
            <button
              className="text-sm font-bold text-red-600"
              onClick={() =>
                setEntries((items) =>
                  items.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              type="button"
            >
              <Trash2 className="inline" size={15} /> Remove
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Qualification"
              value={entry.certification_level}
              onChange={(event) =>
                update(index, { certification_level: event.target.value })
              }
            />
            <Input
              label="Course"
              value={entry.course_name}
              onChange={(event) =>
                update(index, { course_name: event.target.value })
              }
            />
            <Input
              label="Institution"
              value={entry.institution}
              onChange={(event) =>
                update(index, { institution: event.target.value })
              }
            />
            <MonthYearInput
              label="Start date"
              optional
              value={entry.start_date}
              onChange={(start_date) => update(index, { start_date })}
            />
            <MonthYearInput
              label={
                entry.is_currently_studying ? "Expected completion" : "End date"
              }
              optional
              value={entry.end_date}
              onChange={(end_date) => update(index, { end_date })}
            />
          </div>
          <label className="mt-3 flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={entry.is_currently_studying}
              onChange={(event) =>
                update(index, {
                  is_currently_studying: event.target.checked,
                })
              }
            />
            I am currently studying
          </label>
        </fieldset>
      ))}
      <button
        className="inline-flex items-center gap-1 font-bold text-brand-purple"
        onClick={() => setEntries((items) => [...items, blankEducation()])}
        type="button"
      >
        <Plus size={17} /> Add education
      </button>
    </div>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const editing = new URLSearchParams(location.search).get("edit") === "1";
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<ProfileDraft>(blankProfile);
  const [skills, setSkills] = useState<string[]>([]);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<
    string[]
  >([]);
  const [skillInput, setSkillInput] = useState("");
  const [experiences, setExperiences] = useState<Experience[]>([
    blankExperience(),
  ]);
  const [education, setEducation] = useState<Education[]>([blankEducation()]);
  const [cvPath, setCvPath] = useState<string | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [extractingCv, setExtractingCv] = useState(false);
  const [cvExtractionMessage, setCvExtractionMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void getProfileBundle()
      .then((bundle) => {
        const {
          id: _id,
          resume_path,
          onboarding_completed: _complete,
          ...draft
        } = bundle.profile;
        setProfile(draft);
        setSkills(bundle.skills);
        setSelectedEmploymentTypes(bundle.jobPreferences.employment_types);
        setExperiences(
          bundle.experiences.length ? bundle.experiences : [blankExperience()],
        );
        setEducation(
          bundle.education.length ? bundle.education : [blankEducation()],
        );
        setCvPath(resume_path);
      })
      .catch((issue) => setError(issue.message))
      .finally(() => setLoading(false));
  }, []);
  const addSkill = () => {
    const skill = skillInput.trim();
    if (
      skill &&
      !skills.some((value) => value.toLowerCase() === skill.toLowerCase())
    )
      setSkills((values) => [...values, skill]);
    setSkillInput("");
  };
  const applyCvSuggestions = (suggestions: CvExtraction) => {
    setProfile((current) => {
      const suggestedProfile = suggestions.profile;
      return {
        ...current,
        first_name: current.first_name.trim()
          ? current.first_name
          : suggestedProfile.first_name,
        last_name: current.last_name.trim()
          ? current.last_name
          : suggestedProfile.last_name,
        phone: current.phone?.trim() ? current.phone : suggestedProfile.phone,
        suburb: current.suburb?.trim()
          ? current.suburb
          : suggestedProfile.suburb,
        state: current.state?.trim() ? current.state : suggestedProfile.state,
        postcode: current.postcode?.trim()
          ? current.postcode
          : suggestedProfile.postcode,
      };
    });
    setSkills((current) => {
      const existing = new Set(current.map((skill) => skill.toLowerCase()));
      return [
        ...current,
        ...suggestions.skills.filter((skill) => {
          const normalized = skill.trim().toLowerCase();
          if (!normalized || existing.has(normalized)) return false;
          existing.add(normalized);
          return true;
        }),
      ];
    });
    setExperiences((current) =>
      current.some(hasExperienceContent) ? current : suggestions.experiences,
    );
    setEducation((current) =>
      current.some(hasEducationContent) ? current : suggestions.education,
    );
  };
  const selectCv = async (file: File | null) => {
    setCvFile(file);
    setCvExtractionMessage("");
    if (!file) return;

    setExtractingCv(true);
    try {
      const suggestions = await extractCvDetails(file);
      applyCvSuggestions(suggestions);
      setCvExtractionMessage(
        "We added suggestions from your CV. Review every field before saving your profile.",
      );
    } catch (issue) {
      setCvExtractionMessage(
        `${issue instanceof Error ? issue.message : "Unable to extract CV details."} You can still complete your profile manually.`,
      );
    } finally {
      setExtractingCv(false);
    }
  };
  const finish = async () => {
    setError("");
    if (!profile.first_name.trim() || !profile.last_name.trim())
      return setError(
        "Add your first and last name before completing your profile.",
      );
    const submittedExperiences = experiences
      .filter(hasExperienceContent)
      .map((item) => ({
        ...item,
        end_date: item.is_current ? null : item.end_date,
      }));
    const submittedEducation = education.filter(hasEducationContent);
    if (
      submittedExperiences.some(
        (item) =>
          !item.company_name.trim() ||
          !item.position_title.trim() ||
          !item.start_date,
      )
    )
      return setError("Complete or remove every work experience entry.");
    if (
      submittedEducation.some(
        (item) =>
          !item.certification_level.trim() ||
          !item.course_name.trim() ||
          !item.institution.trim(),
      )
    )
      return setError("Complete or remove every education entry.");
    if (
      submittedExperiences.some(
        (item) => item.end_date && item.end_date < item.start_date,
      )
    )
      return setError("Each work end date must be after its start date.");
    if (
      submittedEducation.some(
        (item) =>
          item.start_date && item.end_date && item.end_date < item.start_date,
      )
    )
      return setError("Each education end date must be after its start date.");
    setSaving(true);
    try {
      let resumePath = cvPath;
      if (cvFile) resumePath = await uploadCv(cvFile);
      await saveProfileBundle({
        profile: {
          ...profile,
          resume_path: resumePath,
          onboarding_completed: true,
        },
        skills,
        employmentTypes: selectedEmploymentTypes,
        experiences: submittedExperiences,
        education: submittedEducation,
      });
      await refreshProfile();
      navigate(editing ? "/app/profile" : "/app/search", { replace: true });
    } catch (issue) {
      setError(
        issue instanceof Error ? issue.message : "Unable to save your profile.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (loading)
    return (
      <Shell logoTo="/">
        <p>Loading your profile…</p>
      </Shell>
    );
  const titles = [
    "About you",
    "Job preferences",
    "Your CV",
    "Skills",
    "Experience",
    "Education",
    "Review",
  ];
  return (
    <Shell logoTo="/">
      <div className="mx-auto max-w-3xl">
        <p className="font-bold text-brand-teal">
          {editing ? "Edit your profile" : "First-time setup"}
        </p>
        <h1 className="text-3xl font-black">{titles[step - 1]}</h1>
        <p className="mt-2 text-slate-600">
          {editing
            ? "Change any detail and save when you are ready."
            : "You can review and edit everything before your profile is saved."}
        </p>
        <div className="mt-5 grid grid-cols-7 gap-1">
          {titles.map((title, index) => (
            <div
              aria-label={title}
              className={`h-2 rounded ${index < step ? "bg-brand-purple" : "bg-slate-200"}`}
              key={title}
            />
          ))}
        </div>
        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm md:p-7">
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First name"
                value={profile.first_name}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    first_name: event.target.value,
                  }))
                }
              />
              <Input
                label="Last name"
                value={profile.last_name}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    last_name: event.target.value,
                  }))
                }
              />
              <Input
                label="Phone (optional)"
                type="tel"
                value={profile.phone ?? ""}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    phone: event.target.value,
                  }))
                }
              />
              <Input
                label="Suburb"
                value={profile.suburb ?? ""}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    suburb: event.target.value,
                  }))
                }
              />
              <Input
                label="State"
                value={profile.state ?? ""}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    state: event.target.value,
                  }))
                }
              />
              <Input
                label="Postcode"
                value={profile.postcode ?? ""}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    postcode: event.target.value,
                  }))
                }
              />
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5">
              <label className="block font-bold">
                Preferred distance: {profile.preferred_distance_km} km
                <input
                  className="mt-3 w-full accent-brand-purple"
                  type="range"
                  min="5"
                  max="50"
                  value={profile.preferred_distance_km}
                  onChange={(event) =>
                    setProfile((value) => ({
                      ...value,
                      preferred_distance_km: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <Input
                label="Weekly application goal"
                type="number"
                min="1"
                value={profile.weekly_application_goal}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    weekly_application_goal: Math.max(
                      1,
                      Number(event.target.value),
                    ),
                  }))
                }
              />
            </div>
          )}
          {step === 3 && (
            <div>
              <p className="text-slate-600">
                Optional: upload a PDF or DOCX CV up to 5 MB. We can suggest
                profile details from it, but nothing is saved until you review
                and confirm the fields yourself.
              </p>
              <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-purple bg-brand-pale p-8 text-center font-bold text-brand-purple">
                <Upload size={20} />
                <span>
                  {cvFile
                    ? cvFile.name
                    : cvPath
                      ? "A CV is already stored — choose a replacement if needed"
                      : "Choose CV file"}
                </span>
                <input
                  className="sr-only"
                  type="file"
                  accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) =>
                    void selectCv(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              {extractingCv && (
                <p className="mt-3 text-sm font-medium text-brand-purple">
                  Reading your CV and preparing suggestions…
                </p>
              )}
              {cvExtractionMessage && (
                <p className="mt-3 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">
                  {cvExtractionMessage}
                </p>
              )}
              {cvFile && !extractingCv && (
                <p className="mt-3 text-sm text-slate-600">
                  Your CV will upload securely when you save your profile.
                </p>
              )}
            </div>
          )}
          {step === 4 && (
            <div>
              <p className="mb-4 text-slate-600">
                Add skills you want employers to see.
              </p>
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3 outline-brand-purple"
                  placeholder="e.g. Customer service"
                  value={skillInput}
                  onChange={(event) => setSkillInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSkill();
                    }
                  }}
                />
                <button
                  className="rounded-xl bg-brand-purple px-4 font-bold text-white"
                  onClick={addSkill}
                  type="button"
                >
                  Add
                </button>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <Pill
                    key={skill}
                    onRemove={() =>
                      setSkills((values) =>
                        values.filter((value) => value !== skill),
                      )
                    }
                  >
                    {skill}
                  </Pill>
                ))}
              </div>
              <fieldset className="mt-8 border-t border-slate-200 pt-6">
                <legend className="font-black">
                  What types of work are you looking for?
                </legend>
                <p className="mt-1 text-sm text-slate-600">
                  Select all that apply. This is optional and can be changed
                  later.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {employmentTypes.map((type) => {
                    const selected = selectedEmploymentTypes.includes(type);
                    return (
                      <button
                        aria-pressed={selected}
                        className={`rounded-xl border px-4 py-3 font-bold transition-colors ${
                          selected
                            ? "border-brand-purple bg-brand-purple text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:border-brand-purple hover:text-brand-purple"
                        }`}
                        key={type}
                        onClick={() =>
                          setSelectedEmploymentTypes((values) =>
                            selected
                              ? values.filter((value) => value !== type)
                              : [...values, type],
                          )
                        }
                        type="button"
                      >
                        {type.replace("_", " ")}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}
          {step === 5 && (
            <div>
              <h2 className="font-black">Add your work experience</h2>
              <p className="mb-4 text-slate-600">
                <span className="block">Add jobs you have held.</span>
                <span className="block text-sm">
                  Optional — you can change these later.
                </span>
              </p>
              <button
                className="mb-4 font-bold text-brand-purple underline underline-offset-4"
                onClick={() => setExperiences([])}
                type="button"
              >
                I&apos;m new to the workforce
              </button>
              {experiences.length === 0 && (
                <p className="mb-4 rounded-xl bg-brand-pale p-3 text-sm text-slate-700">
                  No work experience will be added right now. You can add it
                  later.
                </p>
              )}
              <ExperienceEditor
                entries={experiences}
                setEntries={setExperiences}
              />
            </div>
          )}
          {step === 6 && (
            <div>
              <h2 className="font-black">Add your qualifications</h2>
              <p className="mb-4 text-slate-600">
                <span className="block">
                  Add your studies and qualifications.
                </span>
                <span className="block text-sm">
                  Optional — you can change these later.
                </span>
              </p>
              <EducationEditor entries={education} setEntries={setEducation} />
            </div>
          )}
          {step === 7 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-black">
                  {profile.first_name} {profile.last_name}
                </h2>
                <p className="text-slate-600">
                  {[profile.suburb, profile.state, profile.postcode]
                    .filter(Boolean)
                    .join(", ") || "Location not provided"}
                </p>
              </div>
              <div>
                <h2 className="font-black">Profile summary</h2>
                <p className="text-slate-600">
                  {skills.length} skills · {experiences.length} work entries ·{" "}
                  {education.length} education entries ·{" "}
                  {cvFile || cvPath ? "CV attached" : "No CV attached"}
                </p>
              </div>
              <p className="rounded-xl bg-teal-50 p-4 text-sm text-teal-900">
                Review the earlier steps with Back if you would like to change
                anything. You can also edit your profile after setup.
              </p>
            </div>
          )}
          {error && (
            <div className="mt-5">
              <ErrorBox>{error}</ErrorBox>
            </div>
          )}
          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              className="font-bold text-slate-600 disabled:opacity-40"
              disabled={step === 1}
              onClick={() => setStep((value) => value - 1)}
              type="button"
            >
              Back
            </button>
            {step === 7 ? (
              <Button disabled={saving} onClick={() => void finish()}>
                {saving
                  ? "Saving securely…"
                  : editing
                    ? "Save profile"
                    : "Complete profile"}
              </Button>
            ) : (
              <Button onClick={() => setStep((value) => value + 1)}>
                Continue
              </Button>
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function JobCard({ job }: { job: Job }) {
  const location = useLocation();
  const [note, setNote] = useState("");
  const label = job.employment_type.replace("_", " ");
  const saveJob = () => {
    void action(job.id, "saved")
      .then(() => setNote("Saved"))
      .catch((issue) => setNote(issue.message));
  };
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm font-bold capitalize text-brand-purple">{label}</p>
      <h2 className="text-xl font-black">{job.title}</h2>
      <p className="font-semibold text-slate-600">
        {job.employers?.[0]?.company_name || "Employer"}
      </p>
      <p className="mt-2 flex items-center gap-1 text-sm text-slate-500">
        <MapPin size={15} />
        {job.suburb}, {job.state}
      </p>
      <p className="mt-3 line-clamp-3 text-sm text-slate-600">
        {job.description}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          className="inline-flex items-center justify-center rounded-xl border border-brand-purple px-3 py-2 text-sm font-bold text-brand-purple"
          state={{ from: `${location.pathname}${location.search}` }}
          to={`/app/jobs/${job.id}`}
        >
          Details
        </Link>
        <button
          className="rounded-xl border px-3 py-2 text-sm font-bold"
          onClick={saveJob}
        >
          Save
        </button>
        <Link
          className="inline-flex items-center justify-center rounded-xl bg-[#0878F9] px-5 py-3 font-bold text-white shadow-sm hover:bg-[#0667D4]"
          state={{ from: `${location.pathname}${location.search}` }}
          to={`/app/jobs/${job.id}/apply`}
        >
          Apply
        </Link>
      </div>
      {note && <p className="mt-3 text-sm font-medium text-teal-800">{note}</p>}
    </article>
  );
}

function JobContextBanner({ job }: { job: Job }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-2 bg-brand-teal px-4 py-3 text-white">
      <p className="text-sm font-black capitalize">
        {job.employment_type.replace("_", " ")} opportunity
      </p>
      <p className="flex items-center gap-1 text-sm font-semibold text-white/90">
        <MapPin size={15} />
        {job.suburb}, {job.state}
      </p>
    </section>
  );
}

function useWeeklyApplicationGoal() {
  const [goal, setGoal] = useState<number | null>(null);
  const [applied, setApplied] = useState(0);

  useEffect(() => {
    const loadProgress = async () => {
      const [bundle, progress] = await Promise.all([
        getProfileBundle(),
        weeklyApplicationProgress(),
      ]);
      setGoal(bundle.profile.weekly_application_goal);
      setApplied(progress.applied);
    };
    void loadProgress();
    const refresh = () => void loadProgress();
    window.addEventListener("proxiwork:application-submitted", refresh);
    return () =>
      window.removeEventListener("proxiwork:application-submitted", refresh);
  }, []);

  return { goal, applied };
}

function WeeklyApplicationGoal({
  compact = false,
  wide = false,
  goal,
  applied,
}: {
  compact?: boolean;
  wide?: boolean;
  goal: number | null;
  applied: number;
}) {
  if (goal === null) return null;
  const remaining = Math.max(goal - applied, 0);
  const percent = Math.min((applied / goal) * 100, 100);
  const complete = remaining === 0;

  return (
    <section
      className={
        compact
          ? "bg-[#7754E8] px-4 py-3 text-white"
          : wide
            ? "bg-[#7754E8] px-5 py-4 text-white shadow-sm"
            : "mt-6 rounded-2xl bg-[#7754E8] p-5 text-white shadow-sm"
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          {compact ? (
            <h2 className="text-sm font-black">
              Weekly application goal · {applied}/{goal}
            </h2>
          ) : (
            <>
              <p className="text-sm font-bold text-white/85">Weekly application goal</p>
              <h2 className={`${wide ? "mt-0.5 text-lg" : "mt-1 text-xl"} font-black`}>
                {applied} of {goal} applications completed
              </h2>
            </>
          )}
        </div>
        <span
          className={`rounded-full bg-white/20 font-bold ${
            compact ? "px-2.5 py-1 text-xs" : "px-3 py-1 text-sm"
          }`}
        >
          {complete ? "Goal complete" : `${remaining} to go`}
        </span>
      </div>
      <div
        aria-label={`${applied} of ${goal} weekly applications completed`}
        aria-valuemax={goal}
        aria-valuemin={0}
        aria-valuenow={Math.min(applied, goal)}
        className={`${compact ? "mt-2 h-2" : wide ? "mt-3 h-2.5" : "mt-4 h-3"} overflow-hidden rounded-full bg-white/25`}
        role="progressbar"
      >
        <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
      </div>
      {!compact && (
        <p className="mt-3 text-sm font-medium text-white/90">
          {complete
            ? "You have reached your goal for this week — great work!"
            : `Apply for ${remaining} more ${remaining === 1 ? "role" : "roles"} before Sunday to reach your goal.`}
        </p>
      )}
    </section>
  );
}

export function SearchPage() {
  const [list, setList] = useState<Job[]>([]);
  const [history, setHistory] = useState<RecentSearch[]>([]);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [employmentTypesFilter, setEmploymentTypesFilter] = useState<string[]>(
    [],
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async (
    filters = { query, location, employmentTypes: employmentTypesFilter },
    remember = false,
  ) => {
    setLoading(true);
    setError("");
    try {
      const [results] = await Promise.all([
        jobs({
          query: filters.query,
          location: filters.location,
          employmentTypes: filters.employmentTypes,
        }),
        remember
          ? rememberSearch({
              query: filters.query,
              location: filters.location,
              employment_type: filters.employmentTypes.join(",") || null,
            })
          : Promise.resolve(),
      ]);
      setList(results);
      setHistory(await recentSearches());
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to load jobs.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load({ query: "", location: "", employmentTypes: [] });
  }, []);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void load(undefined, true);
  };
  const applyRecentSearch = (item: RecentSearch) => {
    setQuery(item.query);
    setLocation(item.location);
    const selectedTypes = item.employment_type
      ? item.employment_type.split(",").filter(Boolean)
      : [];
    setEmploymentTypesFilter(selectedTypes);
    void load({
      query: item.query,
      location: item.location,
      employmentTypes: selectedTypes,
    });
  };
  const weeklyGoal = useWeeklyApplicationGoal();
  return (
    <Shell mobileBanner={<WeeklyApplicationGoal compact {...weeklyGoal} />}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-black">Find local jobs</h1>
        <JobViewSwitch view="list" />
      </div>
      <div className="hidden md:block">
        <WeeklyApplicationGoal {...weeklyGoal} />
      </div>
      <form
        className="mt-6 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_180px_auto]"
        onSubmit={submit}
      >
        <label className="relative">
          <span className="sr-only">Keywords</span>
          <Search
            className="absolute left-3 top-3.5 text-slate-400"
            size={18}
          />
          <input
            className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3"
            placeholder="Job title or keyword"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <input
          className="rounded-xl border border-slate-300 px-3 py-3"
          placeholder="Suburb or state"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
        <JobTypeSelect
          onChange={setEmploymentTypesFilter}
          selectedTypes={employmentTypesFilter}
        />
        <Button type="submit">Search</Button>
      </form>
      {history.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">Recent searches</h2>
            <p className="text-sm text-slate-500">Saved to your account</p>
          </div>
          <ul className="mt-3 divide-y rounded-2xl bg-white shadow-sm">
            {history.map((item) => (
              <li
                className="flex items-center justify-between gap-3 p-4"
                key={item.id}
              >
                <button
                  className="min-w-0 text-left"
                  onClick={() => applyRecentSearch(item)}
                >
                  <span className="block font-bold">
                    {item.query || "All jobs"}
                    {item.employment_type
                      ? ` Â· ${item.employment_type
                          .split(",")
                          .map(formatEmploymentType)
                          .join(", ")}`
                      : ""}
                  </span>
                  <span className="block truncate text-sm text-slate-500">
                    {item.location || "Any location"}
                  </span>
                </button>
                <button
                  aria-label="Delete recent search"
                  className="p-2 text-slate-500 hover:text-red-600"
                  onClick={() =>
                    void removeRecentSearch(item.id)
                      .then(() =>
                        setHistory((items) =>
                          items.filter((value) => value.id !== item.id),
                        ),
                      )
                      .catch((issue) => setError(issue.message))
                  }
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-7">
        <h2 className="text-lg font-black">Recommended Jobs for you</h2>
        {loading ? (
          <p className="mt-5">Loading jobs…</p>
        ) : error ? (
          <div className="mt-5">
            <ErrorBox>{error}</ErrorBox>
          </div>
        ) : list.length ? (
          <div className="mt-5 space-y-4">
            {list.map((job) => (
              <JobCard job={job} key={job.id} />
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl bg-white p-8 text-center">
            No jobs match this search yet.
          </p>
        )}
      </section>
    </Shell>
  );
}

export function SwipePage() {
  const [list, setList] = useState<Job[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void jobs()
      .then(setList)
      .catch((issue) =>
        setError(
          issue instanceof Error ? issue.message : "Unable to load jobs.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  const job = list[activeIndex];
  const weeklyGoal = useWeeklyApplicationGoal();
  return (
    <Shell mobileBanner={<WeeklyApplicationGoal compact {...weeklyGoal} />}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="whitespace-nowrap text-lg font-black sm:text-3xl">Heres some listings for you</h1>
        <div className="shrink-0">
          <JobViewSwitch view="swipe" />
        </div>
      </div>
      {loading ? (
        <p className="mt-6">Loading jobs…</p>
      ) : error ? (
        <div className="mt-6">
          <ErrorBox>{error}</ErrorBox>
        </div>
      ) : job ? (
        <section className="mx-auto mt-6 max-w-xl md:max-w-3xl">
          <div className="hidden overflow-hidden rounded-2xl shadow-sm md:block">
            <WeeklyApplicationGoal wide {...weeklyGoal} />
          </div>
          <div className="mt-4">
            <JobCard job={job} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              className="rounded-xl border border-slate-300 px-4 py-3 font-bold disabled:opacity-40"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((index) => index - 1)}
            >
              Previous
            </button>
            <p className="text-sm font-bold text-slate-600">
              {activeIndex + 1} of {list.length}
            </p>
            <button
              className="rounded-xl bg-brand-teal px-4 py-3 font-bold text-white disabled:opacity-40"
              disabled={activeIndex === list.length - 1}
              onClick={() => setActiveIndex((index) => index + 1)}
            >
              Next listing
            </button>
          </div>
        </section>
      ) : (
        <p className="mt-6 rounded-2xl bg-white p-8 text-center">
          No listings are available right now.
        </p>
      )}
    </Shell>
  );
}

export function ActivityPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof activity>> | null>(
    null,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    void activity()
      .then(setData)
      .catch((issue) => setError(issue.message));
  }, []);
  const job = (
    value:
      | {
          id: string;
          title: string;
          suburb: string;
          state: string;
          status?: string | null;
          employers: { company_name: string }[] | null;
        }[]
      | null,
  ) => value?.[0];
  return (
    <Shell>
      <h1 className="text-3xl font-black">Liked & applied</h1>
      {error && (
        <div className="mt-4">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}
      {!data ? (
        <p className="mt-4">Loading your activity…</p>
      ) : data.saved.length === 0 && data.applications.length === 0 ? (
        <section className="mt-5 rounded-2xl bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-black">Start exploring local jobs</h2>
          <p className="mx-auto mt-3 max-w-md text-slate-600">
            You have not saved or applied for any jobs yet. Browse local
            opportunities to build your activity here.
          </p>
          <Link
            className="mt-6 inline-flex rounded-xl bg-[#0878F9] px-5 py-3 font-bold text-white shadow-sm hover:bg-[#0667D4]"
            to="/app/search"
          >
            Find local jobs
          </Link>
        </section>
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-black">Saved jobs</h2>
            {data.saved.length ? (
              <ul className="mt-3 space-y-3">
                {data.saved.map((item) => {
                  const value = job(item.jobs);
                  return (
                    <li key={item.id} className="border-t pt-3">
                      {value ? (
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{value.title}</p>
                            <p className="text-sm font-medium text-slate-600">
                              {value.employers?.[0]?.company_name || "Employer"}
                            </p>
                            <p className="text-sm text-slate-500">
                              Liked {new Date(item.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {value.status === "published" ? (
                            <Link
                              className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-brand-purple outline-offset-4 hover:bg-brand-pale hover:text-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-purple"
                              state={{ from: "/app/activity" }}
                              to={`/app/jobs/${value.id}`}
                            >
                              Details
                            </Link>
                          ) : (
                            <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                              Unavailable
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="font-bold">
                          Job listing is no longer available
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-slate-600">
                Save jobs to review them here.
              </p>
            )}
          </section>
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-black">Applications</h2>
            {data.applications.length ? (
              <ul className="mt-3 space-y-3">
                {data.applications.map((item) => {
                  const value = job(item.jobs);
                  return (
                    <li key={item.id} className="border-t pt-3">
                      {value ? (
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{value.title}</p>
                            <p className="text-sm font-medium text-slate-600">
                              {value.employers?.[0]?.company_name || "Employer"}
                            </p>
                            <p className="text-sm text-slate-500">
                              Applied {new Date(item.applied_at).toLocaleDateString()}
                            </p>
                            <p className="text-sm capitalize text-slate-500">
                              Status: {item.status}
                            </p>
                          </div>
                          {value.status === "published" ? (
                            <Link
                              className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-brand-purple outline-offset-4 hover:bg-brand-pale hover:text-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-purple"
                              state={{ from: "/app/activity" }}
                              to={`/app/jobs/${value.id}`}
                            >
                              Details
                            </Link>
                          ) : (
                            <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                              Unavailable
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="font-bold">
                          Job listing is no longer available
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-slate-600">
                Your submitted applications will appear here.
              </p>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}

export function ProfilePage() {
  const { session, signOut } = useAuth();
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof getProfileBundle>
  > | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void getProfileBundle()
      .then(setBundle)
      .catch((issue) => setError(issue.message));
  }, []);
  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-bold text-brand-teal">Your ProxiWork profile</p>
          <h1 className="text-3xl font-black">Profile</h1>
        </div>
        <Link
          className="rounded-xl bg-[#0878F9] px-5 py-3 font-bold text-white hover:bg-[#0667D4]"
          to="/onboarding?edit=1"
        >
          Edit profile
        </Link>
      </div>
      {error && (
        <div className="mt-5">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}
      {!bundle ? (
        <p className="mt-5">Loading profile…</p>
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">
              {bundle.profile.first_name} {bundle.profile.last_name}
            </h2>
            <p className="mt-1 text-slate-600">{session?.user.email}</p>
            <p className="mt-3 flex items-center gap-1 text-sm text-slate-600">
              <MapPin size={16} />
              {[
                bundle.profile.suburb,
                bundle.profile.state,
                bundle.profile.postcode,
              ]
                .filter(Boolean)
                .join(", ") || "No location saved"}
            </p>
            <p className="mt-4 text-sm">
              <strong>Job radius:</strong>{" "}
              {bundle.profile.preferred_distance_km} km ·{" "}
              <strong>Weekly goal:</strong>{" "}
              {bundle.profile.weekly_application_goal}
            </p>
            <p className="mt-5 flex items-center gap-2 rounded-xl bg-brand-pale p-3 text-sm font-bold">
              <FileText size={18} />
              {bundle.profile.resume_path
                ? "CV stored securely"
                : "No CV uploaded"}
            </p>
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-black">Skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {bundle.skills.length ? (
                bundle.skills.map((skill) => <Pill key={skill}>{skill}</Pill>)
              ) : (
                <p className="text-slate-600">No skills added yet.</p>
              )}
            </div>
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-black">Experience</h2>
            {bundle.experiences.length ? (
              <ul className="mt-3 space-y-3">
                {bundle.experiences.map((item) => (
                  <li
                    key={
                      item.id ?? `${item.company_name}-${item.position_title}`
                    }
                  >
                    <p className="font-bold">{item.position_title}</p>
                    <p className="text-sm text-slate-600">
                      {item.company_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatMonthYear(item.start_date) || "Start date not provided"}
                      {" – "}
                      {item.is_current
                        ? "Current"
                        : formatMonthYear(item.end_date) || "End date not provided"}
                    </p>
                    {item.description && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {item.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-slate-600">No experience added yet.</p>
            )}
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-black">Education</h2>
            {bundle.education.length ? (
              <ul className="mt-3 space-y-3">
                {bundle.education.map((item) => (
                  <li
                    key={item.id ?? `${item.institution}-${item.course_name}`}
                  >
                    <p className="font-bold">{item.course_name}</p>
                    <p className="text-sm text-slate-600">
                      {item.certification_level} · {item.institution}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-slate-600">No education added yet.</p>
            )}
          </section>
        </div>
      )}
      <div className="mt-8">
        <Button onClick={() => void signOut()}>Log out</Button>
      </div>
    </Shell>
  );
}

export function JobDetailsPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const weeklyGoal = useWeeklyApplicationGoal();
  const goBack = () => {
    if (location.state?.from) navigate(-1);
    else navigate("/app/search");
  };
  useEffect(() => {
    void jobs()
      .then((items) => setJob(items.find((item) => item.id === id) ?? null))
      .catch((issue) => setError(issue.message));
  }, [id]);
  return (
    <Shell mobileBanner={<WeeklyApplicationGoal compact {...weeklyGoal} />}>
      <button
        className="mb-5 inline-flex items-center gap-2 font-bold text-brand-purple hover:text-violet-700"
        onClick={goBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={19} />
        Back
      </button>
      {error ? (
        <ErrorBox>{error}</ErrorBox>
      ) : !job ? (
        <p>Loading job details…</p>
      ) : (
        <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-sm">
          <JobContextBanner job={job} />
          <div className="p-6">
            <h1 className="text-3xl font-black">{job.title}</h1>
          <p className="mt-2 font-semibold text-slate-600">
            {job.employers?.[0]?.company_name || "Employer"}
          </p>
          <p className="mt-6 whitespace-pre-wrap text-slate-700">
            {job.description}
          </p>
          {job.responsibilities && (
            <section className="mt-7 border-t border-slate-200 pt-6">
              <h2 className="text-xl font-black">What you&apos;ll do</h2>
              <p className="mt-3 whitespace-pre-wrap text-slate-700">
                {preserveJobLineBreaks(job.responsibilities)}
              </p>
            </section>
          )}
          {job.requirements && (
            <section className="mt-7 border-t border-slate-200 pt-6">
              <h2 className="text-xl font-black">What you&apos;ll bring</h2>
              <p className="mt-3 whitespace-pre-wrap text-slate-700">
                {preserveJobLineBreaks(job.requirements)}
              </p>
            </section>
          )}
          {job.experience_required && (
            <section className="mt-7 border-t border-slate-200 pt-6">
              <h2 className="text-xl font-black">Experience required</h2>
              <p className="mt-3 whitespace-pre-wrap text-slate-700">
                {preserveJobLineBreaks(job.experience_required)}
              </p>
            </section>
          )}
          <div className="mt-8 flex gap-3">
            <button
              className="rounded-xl border px-4 py-3 font-bold"
              onClick={() => {
                void action(job.id, "saved")
                  .then(() => setNote("Saved"))
                  .catch((issue) => setNote(issue.message));
              }}
            >
              Save job
            </button>
            <Link
              className="inline-flex items-center justify-center rounded-xl bg-[#0878F9] px-5 py-3 font-bold text-white shadow-sm hover:bg-[#0667D4]"
              state={{ from: `${location.pathname}${location.search}` }}
              to={`/app/jobs/${job.id}/apply`}
            >
              Apply
            </Link>
          </div>
            {note && <p className="mt-4 font-medium text-teal-800">{note}</p>}
          </div>
        </article>
      )}
    </Shell>
  );
}

export function JobApplicationPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [resumePath, setResumePath] = useState<string | null>(null);
  const [coverLetterMode, setCoverLetterMode] = useState<
    "none" | "write" | "upload"
  >("none");
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void Promise.all([jobs(), getProfileBundle()])
      .then(([items, bundle]) => {
        setJob(items.find((item) => item.id === id) ?? null);
        setResumePath(bundle.profile.resume_path);
      })
      .catch((issue) => setError(issue.message));
  }, [id]);

  const goBack = () => {
    if (location.state?.from) navigate(-1);
    else navigate(`/app/jobs/${id}`);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!job) return;
    setError("");
    if (coverLetterMode === "write" && !coverLetter.trim()) {
      setError("Write your cover letter or choose another option.");
      return;
    }
    if (coverLetterMode === "upload" && !coverLetterFile) {
      setError("Choose a PDF or DOCX cover-letter file to upload.");
      return;
    }
    setSubmitting(true);
    try {
      const coverLetterPath =
        coverLetterMode === "upload" && coverLetterFile
          ? await uploadCoverLetter(coverLetterFile)
          : null;
      await apply(job.id, {
        resume_path: resumePath,
        cover_letter: coverLetterMode === "write" ? coverLetter.trim() : null,
        cover_letter_path: coverLetterPath,
      });
      window.dispatchEvent(new Event("proxiwork:application-submitted"));
      navigate("/app/activity", { replace: true });
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to apply.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <button
        className="mb-5 inline-flex items-center gap-2 font-bold text-brand-purple hover:text-violet-700"
        onClick={goBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={19} />
        Back
      </button>
      {error && <ErrorBox>{error}</ErrorBox>}
      {!job ? (
        <p className="mt-4">Loading application details…</p>
      ) : (
        <form
          className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm"
          onSubmit={submit}
        >
          <p className="font-bold text-brand-teal">Confirm your application</p>
          <h1 className="mt-2 text-3xl font-black">{job.title}</h1>
          <p className="mt-2 font-semibold text-slate-600">
            {job.employers?.[0]?.company_name || "Employer"}
          </p>
          <p className="mt-2 flex items-center gap-1 text-slate-500">
            <MapPin size={17} />
            {job.suburb}, {job.state}
          </p>

          <section className="mt-7 border-t border-slate-200 pt-6">
            <h2 className="text-xl font-black">Your application</h2>
            <p className="mt-2 text-slate-600">
              Review your details, choose an optional cover-letter method, then
              confirm your application.
            </p>
            <p className="mt-4 rounded-xl bg-brand-pale p-3 text-sm font-medium text-slate-700">
              {resumePath
                ? "Your profile CV will be included with this application."
                : "No CV is attached. You can still apply for this role."}
            </p>
          </section>

          <fieldset className="mt-7 border-t border-slate-200 pt-6">
            <legend className="text-xl font-black">Cover letter</legend>
            <p className="mt-2 text-sm text-slate-600">
              A cover letter is optional. Choose one option.
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  checked={coverLetterMode === "none"}
                  name="cover-letter-option"
                  onChange={() => setCoverLetterMode("none")}
                  type="radio"
                />
                <span>
                  <span className="block font-bold">
                    Apply without a cover letter
                  </span>
                  <span className="text-sm text-slate-600">
                    Submit your application without adding one.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  checked={coverLetterMode === "write"}
                  name="cover-letter-option"
                  onChange={() => setCoverLetterMode("write")}
                  type="radio"
                />
                <span className="font-bold">Write a cover letter</span>
              </label>
              {coverLetterMode === "write" && (
                <Textarea
                  label="Cover letter"
                  onChange={(event) => setCoverLetter(event.target.value)}
                  placeholder="Write a short message to the employer…"
                  value={coverLetter}
                />
              )}
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  checked={coverLetterMode === "upload"}
                  name="cover-letter-option"
                  onChange={() => setCoverLetterMode("upload")}
                  type="radio"
                />
                <span>
                  <span className="block font-bold">Upload a cover letter</span>
                  <span className="text-sm text-slate-600">
                    PDF or DOCX, up to 5 MB.
                  </span>
                </span>
              </label>
              {coverLetterMode === "upload" && (
                <label className="block rounded-xl border border-dashed border-brand-purple p-4 text-sm font-bold text-brand-purple">
                  <input
                    accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="sr-only"
                    onChange={(event) =>
                      setCoverLetterFile(event.target.files?.[0] ?? null)
                    }
                    type="file"
                  />
                  <span className="inline-flex items-center gap-2">
                    <Upload size={18} />
                    {coverLetterFile
                      ? coverLetterFile.name
                      : "Choose cover-letter file"}
                  </span>
                </label>
              )}
            </div>
          </fieldset>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button disabled={submitting} type="submit">
              {submitting ? "Submitting application…" : "Confirm application"}
            </Button>
            <button
              className="rounded-xl border px-5 py-3 font-bold"
              onClick={goBack}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Shell>
  );
}
