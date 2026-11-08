import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, usernameToEmail } from "./supabase";
import { useProfilo } from "./queries";
import type { Profilo } from "./types";

interface AuthCtx {
  session: Session | null;
  ready: boolean;
  profilo: Profilo | null | undefined;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();
  const { data: profilo } = useProfilo(session?.user.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const login = async (username: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "Nome utente o password non corretti" : error.message);
  };
  const logout = async () => {
    await supabase.auth.signOut();
    qc.clear();
  };

  return <Ctx.Provider value={{ session, ready, profilo, login, logout }}>{children}</Ctx.Provider>;
}
