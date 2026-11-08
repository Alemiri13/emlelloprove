import { motion } from "framer-motion";
import { ArrowUpRight, Building2, MapPin, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useRiepilogoUffici, useUffici } from "../lib/queries";
import { Logo } from "../components/layout/Logo";
import { UserMenu } from "../components/layout/UserMenu";
import { Skeleton } from "../components/ui/Spinner";

function saluto() {
  const h = new Date().getHours();
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

export function UfficiPage() {
  const { profilo } = useAuth();
  const { data: uffici, isLoading } = useUffici();
  const { data: riep } = useRiepilogoUffici();
  const nav = useNavigate();

  const go = (id: string) => {
    try { localStorage.setItem("cia-ufficio", id); } catch { /* ignore */ }
    nav(`/u/${id}`);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(1000px_500px_at_50%_-10%,#EFF8EC,transparent_70%)]">
      <header className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <Logo className="h-10 w-auto" />
        <UserMenu />
      </header>
      <main className="max-w-6xl mx-auto px-6 pt-10 sm:pt-16 pb-20">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="text-brand-700 font-semibold">{saluto()}{profilo ? `, ${profilo.nome}` : ""}</p>
          <h1 className="mt-2 text-[40px] sm:text-[52px] font-extrabold tracking-[-0.04em] leading-[1.02]">Quale ufficio apriamo?</h1>
          <p className="mt-3 text-ink-500 text-lg">Ogni ufficio ha la stessa dashboard, con i propri dati. Puoi cambiare in qualsiasi momento.</p>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[300px] !rounded-[28px]" />)}
          {uffici?.map((u, i) => {
            const r = riep?.[u.id];
            const pref = profilo?.ufficio_preferito === u.id;
            return (
              <motion.button
                key={u.id}
                onClick={() => go(u.id)}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6 }}
                whileTap={{ scale: 0.98 }}
                className="group relative text-left rounded-[28px] bg-white border border-ink-100 p-8 shadow-card hover:shadow-lift transition-shadow duration-300 overflow-hidden min-h-[300px] flex flex-col"
              >
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-50 transition-transform duration-500 group-hover:scale-[1.6]" />
                <div className="relative flex items-start justify-between">
                  <span className="grid place-items-center h-14 w-14 rounded-2xl bg-brand-800 text-white shadow-[0_10px_24px_-10px_rgba(0,80,42,.7)]">
                    <Building2 size={26} />
                  </span>
                  <span className="grid place-items-center h-11 w-11 rounded-full bg-white border border-ink-100 text-ink-400 group-hover:bg-brand-800 group-hover:text-white group-hover:border-brand-800 transition-all duration-300 group-hover:rotate-45">
                    <ArrowUpRight size={20} />
                  </span>
                </div>
                <div className="relative mt-auto">
                  {pref && (
                    <span className="chip bg-brand-50 text-brand-800 mb-3"><Star size={12} fill="currentColor" /> Il tuo ufficio</span>
                  )}
                  <div className="text-[34px] font-extrabold tracking-[-0.035em] leading-none">{u.nome}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-ink-500"><MapPin size={14} /> {u.indirizzo}</div>
                  <div className="mt-6 pt-5 border-t border-ink-100 flex gap-6">
                    <div>
                      <div className="text-2xl font-bold tabular-nums tracking-tight">{r?.aziende ?? "–"}</div>
                      <div className="text-xs text-ink-500 font-medium">aziende</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold tabular-nums tracking-tight">{r?.aperte ?? "–"}</div>
                      <div className="text-xs text-ink-500 font-medium">domande in corso</div>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
