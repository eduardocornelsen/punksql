"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const AuthContext = createContext({
  user: null,
  signInWithGoogle: () => {},
  signOut: () => {},
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const initAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    // OAUTH REDIRECT FIX:
    // If redirecting to localhost instead of production, fix in Supabase dashboard:
    //   Authentication → URL Configuration
    //   1. Set "Site URL" to your production URL (e.g. https://punksql.vercel.app)
    //   2. Add to "Redirect URLs": https://punksql.vercel.app/api/auth/callback
    //
    // Optionally set NEXT_PUBLIC_APP_URL in Vercel env vars to force the correct origin.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appUrl}/api/auth/callback`,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, signInWithGoogle, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
