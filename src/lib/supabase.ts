import { createClient } from "@supabase/supabase-js";

// Valori pubblici del progetto "Cia Project" usati se le variabili d'ambiente mancano.
// La chiave "publishable" è pensata per il browser: la sicurezza dei dati è garantita dalle policy RLS.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || "https://cbfarrrsamwmlenxlugx.supabase.co";
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "sb_publishable_auaQxErCxa6i-ubDhjTU1A_7rLINgDD";

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error("Configurare VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nel file .env");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "cia-gestionale-auth" },
});

export const LOGIN_DOMAIN = (import.meta.env.VITE_LOGIN_DOMAIN as string) || "cia-gestionale.it";

export function usernameToEmail(u: string) {
  const v = u.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${LOGIN_DOMAIN}`;
}

/** Lancia l'errore di Supabase con un messaggio leggibile. */
export function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const msg = res.error.code === "23505" ? "Esiste già un record con questi dati." : res.error.message;
    throw new Error(msg);
  }
  return res.data;
}
