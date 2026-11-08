import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/layout/Logo";
import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/Inputs";

const LAST_USER = "cia-last-user";

export function LoginPage() {
  const { session, login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState(() => { try { return localStorage.getItem(LAST_USER) ?? ""; } catch { return ""; } });
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(0);

  if (session) return <Navigate to="/uffici" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!username.trim() || !password) { setErr("Inserisci nome utente e password"); setShake((s) => s + 1); return; }
    setLoading(true);
    try {
      await login(username, password);
      try { localStorage.setItem(LAST_USER, username.trim().toLowerCase()); } catch { /* ignore */ }
      nav("/uffici", { replace: true });
    } catch (e) {
      setErr((e as Error).message);
      setShake((s) => s + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-white">
      {/* pannello brand */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-grain text-white p-14">
        <Leaves />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_12px_#5BB44A]" />
          <span className="text-sm font-semibold tracking-wide text-white/80">Confederazione Italiana Agricoltori</span>
        </motion.div>
        <div className="relative">
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex rounded-[32px] bg-white p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,.45)]">
            <Logo className="h-24 w-auto" />
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7 }} className="mt-10 text-[44px] leading-[1.05] font-extrabold tracking-[-0.035em] max-w-md">
            Le aziende agricole, in un unico posto.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7 }} className="mt-4 text-white/70 text-lg max-w-md">
            Anagrafica, colture e domande per gli uffici di Scerni, San Salvo e Vasto.
          </motion.p>
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="relative flex gap-3">
          {["Scerni", "San Salvo", "Vasto"].map((u) => (
            <span key={u} className="px-4 h-9 inline-flex items-center rounded-full bg-white/10 backdrop-blur text-sm font-semibold text-white/90 ring-1 ring-white/15">{u}</span>
          ))}
        </motion.div>
      </div>

      {/* form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-[420px]">
          <div className="lg:hidden mb-10 flex justify-center"><Logo className="h-16 w-auto" /></div>
          <h2 className="text-[34px] font-extrabold tracking-[-0.035em] leading-tight">Bentornato</h2>
          <p className="text-ink-500 mt-2 text-[15px]">Accedi con il tuo nome utente per continuare.</p>

          <motion.form
            key={shake}
            onSubmit={submit}
            animate={shake ? { x: [0, -10, 10, -6, 6, -2, 0] } : {}}
            transition={{ duration: 0.45 }}
            className="mt-10 space-y-5"
          >
            <label className="block">
              <span className="label">Nome utente</span>
              <TextInput
                size="lg"
                icon={<User size={19} />}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="es. alessandro"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus={!username}
                invalid={!!err}
              />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <TextInput
                size="lg"
                icon={<Lock size={19} />}
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                autoFocus={!!username}
                invalid={!!err}
                suffix={
                  <button type="button" onClick={() => setShow((s) => !s)} className="h-9 w-9 -mr-2 grid place-items-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-ink-100 transition" aria-label={show ? "Nascondi password" : "Mostra password"}>
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
            </label>
            <motion.div initial={false} animate={{ height: err ? "auto" : 0, opacity: err ? 1 : 0 }} className="overflow-hidden">
              <div className="rounded-xl bg-red-50 text-red-700 text-sm font-medium px-4 py-3 ring-1 ring-inset ring-red-100">{err}</div>
            </motion.div>
            <Button type="submit" size="lg" loading={loading} className="w-full !h-[58px] text-[16px]" iconRight={<ArrowRight size={19} />}>
              Accedi
            </Button>
          </motion.form>
          <p className="mt-10 text-center text-xs text-ink-400">Accesso riservato al personale CIA · dati protetti</p>
        </motion.div>
      </div>
    </div>
  );
}

function Leaves() {
  return (
    <svg className="absolute -right-24 -bottom-24 w-[620px] opacity-[0.13]" viewBox="0 0 600 600" fill="none">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.ellipse
          key={i}
          cx={300 + i * 30}
          cy={300 - i * 60}
          rx="70"
          ry="160"
          fill="#5BB44A"
          transform={`rotate(${28 + i * 6} ${300 + i * 30} ${300 - i * 60})`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: [0, -8, 0] }}
          transition={{ opacity: { delay: i * 0.12, duration: 0.8 }, y: { delay: i * 0.3, duration: 6 + i, repeat: Infinity, ease: "easeInOut" } }}
        />
      ))}
    </svg>
  );
}
