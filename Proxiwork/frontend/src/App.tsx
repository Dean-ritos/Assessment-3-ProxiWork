import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import {
  ActivityPage,
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, session, profileComplete } = useAuth();
  if (loading) return <main className="centered">Loading ProxiWork...</main>;
  if (!session) return <Navigate to="/login" replace />;
  if (profileComplete === null)
    return <main className="centered">Loading your profile...</main>;
  return profileComplete ? (
    <>{children}</>
  ) : (
    <Navigate to="/onboarding" replace />
  );
}

function OnboardingRoute() {
  const { loading, session, profileComplete } = useAuth();
  const location = useLocation();
  if (loading) return <main className="centered">Loading ProxiWork...</main>;
  if (!session) return <Navigate to="/login" replace />;
  if (profileComplete && !new URLSearchParams(location.search).has("edit"))
    return <Navigate to="/app/search" replace />;
  return <OnboardingPage />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
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
                <JobDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
