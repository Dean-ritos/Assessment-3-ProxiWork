import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthValue = {
  session: Session | null;
  loading: boolean;
  profileComplete: boolean | null;
  refreshProfile: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

const Context = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  const refreshProfile = async () => {
    if (!supabase || !session) {
      setProfileComplete(null);
      return false;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", session.user.id)
      .maybeSingle();
    const complete = !error && Boolean(data?.onboarding_completed);
    setProfileComplete(complete);
    return complete;
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfileComplete(null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) void refreshProfile();
    else setProfileComplete(null);
  }, [session]);

  return (
    <Context.Provider
      value={{
        session,
        loading,
        profileComplete,
        refreshProfile,
        signOut: async () => {
          if (supabase) await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
