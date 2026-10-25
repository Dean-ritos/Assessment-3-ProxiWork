import { useEffect, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { supabase } from "./lib/supabase";
import {
  ActivityPage,
  JobApplicationPage,
  JobDetailsPage,
  LandingPage,
  LoginPage,
  OnboardingPage,
  ProfilePage,
  RegisterPage,
  ResetPasswordPage,
  SearchPage,
  SwipePage,
} from "./pages/pages";
import {
  EmployerCompanyPage,
  EmployerDashboardPage,
  EmployerLoginPage,
  EmployerOnboardingPage,
  EmployerRegisterPage,
  EmployerVacancyPage,
} from "./pages/employer-pages";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, session, profileComplete, accountType } = useAuth();
  if (loading) return <main className="centered">Loading ProxiWork...</main>;
  if (!session) return <Navigate to="/login" replace />;
  if (profileComplete === null)
    return <main className="centered">Loading your profile...</main>;
  if (accountType === "employer") return <Navigate to="/employer/dashboard" replace />;
  return profileComplete ? (
    <>{children}</>
  ) : (
    <Navigate to="/onboarding" replace />
  );
}

function OnboardingRoute() {
  const { loading, session, profileComplete, accountType } = useAuth();
  const location = useLocation();
  if (loading) return <main className="centered">Loading ProxiWork...</main>;
  if (!session) return <Navigate to="/login" replace />;
  if (accountType === "employer") return <Navigate to="/employer/dashboard" replace />;
  if (profileComplete && !new URLSearchParams(location.search).has("edit"))
    return <Navigate to="/app/search" replace />;
  return <OnboardingPage />;
}

function EmployerRoute({ children }: { children: React.ReactNode }) {
  const { loading, session, accountType } = useAuth();
  if (loading) return <main className="centered">Loading ProxiWork...</main>;
  if (!session) return <Navigate to="/employer/login" replace />;
  if (accountType === null)
    return <main className="centered">Loading your account...</main>;
  return accountType === "employer" ? <>{children}</> : <Navigate to="/app/search" replace />;
}

function EmployerOnboardingRoute() {
  const { loading, session, accountType } = useAuth();
  if (loading) return <main className="centered">Loading ProxiWork...</main>;
  if (!session) return <Navigate to="/employer/login" replace />;
  if (accountType === null)
    return <main className="centered">Loading your account...</main>;
  return accountType === "employer" ? <EmployerOnboardingPage /> : <Navigate to="/app/search" replace />;
}

function LandingPageWithEmployerPortal() {
  return (
    <div className="relative">
      <LandingPage />
      <Link
        className="absolute right-6 top-11 z-10 rounded-xl border border-brand-purple bg-white px-4 py-3 text-right text-sm font-bold text-brand-purple shadow-sm hover:bg-violet-50 md:right-12 md:top-12"
        to="/employer/login"
      >
        <span className="block">Employer portal</span>
        <span className="font-normal text-slate-600">Looking for employees?</span>
      </Link>
    </div>
  );
}

function JobDetailsWithExperience() {
  const { id } = useParams();
  const [experience, setExperience] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !id) return;
    void supabase
      .from("jobs")
      .select("experience_required")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setExperience(data?.experience_required ?? null));
  }, [id]);

  return (
    <>
      <JobDetailsPage />
      {experience && (
        <section className="mx-auto -mt-24 mb-8 max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Experience required</h2>
          <p className="mt-3 whitespace-pre-wrap text-slate-700">{experience}</p>
        </section>
      )}
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPageWithEmployerPortal />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/employer/login" element={<EmployerLoginPage />} />
          <Route path="/employer/register" element={<EmployerRegisterPage />} />
          <Route path="/employer/onboarding" element={<EmployerOnboardingRoute />} />
          <Route path="/employer/dashboard" element={<EmployerRoute><EmployerDashboardPage /></EmployerRoute>} />
          <Route path="/employer/company" element={<EmployerRoute><EmployerCompanyPage /></EmployerRoute>} />
          <Route path="/employer/jobs/new" element={<EmployerRoute><EmployerVacancyPage /></EmployerRoute>} />
          <Route path="/employer/jobs/:id/edit" element={<EmployerRoute><EmployerVacancyPage /></EmployerRoute>} />
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route
            path="/app/search"
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/swipe"
            element={
              <ProtectedRoute>
                <SwipePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/activity"
            element={
              <ProtectedRoute>
                <ActivityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/jobs/:id"
            element={
              <ProtectedRoute>
                <JobDetailsWithExperience />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/jobs/:id/apply"
            element={
              <ProtectedRoute>
                <JobApplicationPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
