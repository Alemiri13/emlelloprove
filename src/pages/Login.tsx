import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ClipboardCheck, Eye, EyeOff, Lock, MapPin, Sparkles, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
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
      <BrandPanel />

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

const FEATURE = [
  { icon: Users, titolo: "Anagrafica completa", testo: "Aziende, colture, terreni e documenti in un'unica scheda." },
  { icon: ClipboardCheck, titolo: "Domande sotto controllo", testo: "Chi l'ha fatta e chi no, pratica per pratica, a colpo d'occhio." },
  { icon: Sparkles, titolo: "Documenti che si archiviano da soli", testo: "Trascini un file: lo leggo, lo riconosco e lo collego all'azienda." },
];

const UFFICI = [
  { nome: "Scerni", x: 22, y: 58, d: 0.9 },
  { nome: "Vasto", x: 63, y: 40, d: 1.05 },
  { nome: "San Salvo", x: 83, y: 64, d: 1.2 },
];

function BrandPanel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % FEATURE.length), 4500);
    return () => clearInterval(t);
  }, []);
  const f = FEATURE[i];

  return (
    <div className="relative hidden lg:flex flex-col overflow-hidden text-white bg-[#012a17]">
      {/* cielo */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_0%,#1f6b3a_0%,#0b4527_38%,#012a17_75%)]" />
      <motion.div
        className="absolute -right-10 top-[6%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(220,245,190,.38)_0%,rgba(140,210,110,.12)_45%,transparent_70%)]"
        animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* grana */}
      <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%22.9%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')]" />

      {/* intestazione */}
      <div className="relative z-10 px-14 pt-12 flex items-center justify-between">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="flex items-center gap-3 rounded-2xl bg-white pl-3 pr-4 py-2.5 shadow-[0_12px_30px_-12px_rgba(0,0,0,.5)]">
          <Logo className="h-8 w-auto" />
          <span className="h-6 w-px bg-ink-200" />
          <span className="text-[12.5px] font-semibold leading-tight text-ink-700">Confederazione<br />Italiana Agricoltori</span>
        </motion.div>
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="text-[12px] font-semibold tracking-[0.14em] uppercase text-white/50">Gestionale uffici</motion.span>
      </div>

      {/* titolo e funzioni */}
      <div className="relative z-10 px-14 my-auto py-[3vh] max-w-[640px]">
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-[clamp(34px,3.3vw,52px)] leading-[1.04] font-extrabold tracking-[-0.04em] [text-wrap:balance]">
          Il lavoro di ogni giorno,{" "}<br />
          <span className="bg-gradient-to-r from-brand-300 via-[#c7ec8f] to-brand-300 bg-clip-text text-transparent">più semplice.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.7 }}
          className="mt-4 text-[17px] text-white/65 leading-relaxed max-w-[480px]">
          Un unico strumento per seguire le aziende agricole dei tre uffici del territorio.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7 }}
          className="mt-[4.5vh] max-w-[480px] rounded-[22px] bg-white/[0.07] ring-1 ring-white/15 backdrop-blur-md p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,.6)]">
          <div className="relative h-[74px]">
            <AnimatePresence mode="wait">
              <motion.div key={i} className="absolute inset-0 flex items-start gap-4"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}>
                <span className="h-12 w-12 shrink-0 rounded-2xl grid place-items-center bg-gradient-to-br from-brand-300 to-brand-500 text-brand-950 shadow-[0_8px_20px_-8px_rgba(91,180,74,.8)]">
                  <f.icon size={22} strokeWidth={2.2} />
                </span>
                <div>
                  <div className="font-bold text-[16.5px] tracking-tight">{f.titolo}</div>
                  <div className="text-[14px] text-white/65 mt-0.5 leading-snug">{f.testo}</div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-3 flex gap-1.5">
            {FEATURE.map((_, k) => (
              <button key={k} onClick={() => setI(k)} aria-label={FEATURE[k].titolo} className="h-1.5 flex-1 rounded-full bg-white/15 overflow-hidden">
                {k === i && <motion.span key={i} className="block h-full bg-brand-300 rounded-full" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 4.5, ease: "linear" }} />}
                {k < i && <span className="block h-full w-full bg-white/40 rounded-full" />}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* paesaggio con gli uffici */}
      <div className="relative h-[34vh] min-h-[210px] max-h-[340px] shrink-0">
        <Paesaggio />
        {UFFICI.map((u) => (
          <motion.div key={u.nome} className="absolute z-10 -translate-x-1/2 -translate-y-full flex flex-col items-center"
            style={{ left: `${u.x}%`, top: `${u.y}%` }}
            initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: u.d, type: "spring", stiffness: 260, damping: 18 }}>
            <span className="mb-1.5 whitespace-nowrap rounded-full bg-white text-brand-900 text-[12.5px] font-bold px-3 py-1 shadow-[0_8px_20px_-6px_rgba(0,0,0,.5)] flex items-center gap-1.5">
              <MapPin size={12} className="text-brand-600" />{u.nome}
            </span>
            <span className="relative h-3 w-3">
              <span className="absolute inset-0 rounded-full bg-brand-300 animate-ping opacity-70" />
              <span className="absolute inset-0 rounded-full bg-white ring-[3px] ring-brand-400" />
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** Colline con campi coltivati (SVG), in movimento leggero. */
function Paesaggio() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 320" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f7d3a" /><stop offset="1" stopColor="#1b5a2b" /></linearGradient>
        <linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3f9a33" /><stop offset="1" stopColor="#226b2c" /></linearGradient>
        <linearGradient id="h3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5bb44a" /><stop offset="1" stopColor="#2c7c28" /></linearGradient>
        <pattern id="filari" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
          <rect width="14" height="14" fill="transparent" /><rect width="14" height="3" fill="rgba(255,255,255,.10)" />
        </pattern>
        <pattern id="grano" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
          <rect width="10" height="10" fill="#c9b553" /><rect width="10" height="2" fill="#b39f3f" />
        </pattern>
      </defs>
      {/* collina lontana */}
      <motion.path d="M0 120 C 120 70, 240 90, 360 80 S 620 40, 800 90 L800 320 L0 320Z" fill="url(#h1)" opacity=".8"
        animate={{ y: [0, -3, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
      {/* collina media con campo di grano */}
      <motion.g animate={{ y: [0, -2, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
        <path d="M0 175 C 150 120, 300 150, 430 135 S 680 110, 800 150 L800 320 L0 320Z" fill="url(#h2)" />
        <path d="M440 134 C 520 126, 600 117, 690 121 C 700 140, 712 158, 722 172 C 640 168, 545 174, 462 186 C 455 168, 448 150, 440 134 Z" fill="url(#grano)" opacity=".6" />
        <path d="M0 175 C 150 120, 300 150, 430 135 S 680 110, 800 150 L800 320 L0 320Z" fill="url(#filari)" />
      </motion.g>
      {/* olivi */}
      {[[120, 168], [160, 160], [205, 158], [560, 140], [600, 146]].map(([x, y], k) => (
        <g key={k} transform={`translate(${x} ${y})`}>
          <rect x="-1.5" y="-2" width="3" height="10" rx="1" fill="#2a3b20" />
          <ellipse cx="0" cy="-8" rx="11" ry="8" fill="#6f8f3a" />
          <ellipse cx="-4" cy="-10" rx="6" ry="4" fill="#86a64a" opacity=".8" />
        </g>
      ))}
      {/* collina vicina con filari */}
      <path d="M0 240 C 160 195, 330 215, 480 205 S 700 190, 800 215 L800 320 L0 320Z" fill="url(#h3)" />
      <path d="M0 240 C 160 195, 330 215, 480 205 S 700 190, 800 215 L800 320 L0 320Z" fill="url(#filari)" opacity=".9" />
      <path d="M0 290 C 200 265, 420 285, 800 262 L800 320 L0 320Z" fill="#012a17" opacity=".35" />
    </svg>
  );
}
