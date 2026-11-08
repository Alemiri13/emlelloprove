import { motion } from "framer-motion";
import { Sparkles, ArrowRight, ClipboardList, FilePlus2, FileStack, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { CaricamentoIntelligente } from "../features/CaricamentoIntelligente";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useModals, useUfficio } from "../lib/ufficio";

export function HomePage() {
  const { ufficio, aziende, pratiche } = useUfficio();
  const { profilo } = useAuth();
  const { nuovaAzienda, nuovaDomanda } = useModals();
  const nav = useNavigate();
  const [smart, setSmart] = useState(false);

  const tiles = [
    { to: "anagrafica", icon: Users, title: "Anagrafica", desc: "Aziende, contatti, colture (brogliaccio) e documenti", meta: `${aziende.length} aziende`, big: true, wide: false },
    { to: "domande", icon: ClipboardList, title: "Domande", desc: "Fatte, in corso e da fare per ogni pratica", meta: `${pratiche.filter((p) => p.attivo).length} pratiche attive`, big: true },
    { to: "pratiche", icon: FileStack, title: "Pratiche e bandi", desc: "Elenchi da fare e riscontro delle fatte", meta: "Comuni a tutti gli uffici", wide: true },
  ];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <p className="text-brand-700 font-semibold">Ufficio di {ufficio.nome}</p>
        <h1 className="mt-1 text-[36px] sm:text-[44px] font-extrabold tracking-[-0.04em] leading-[1.05]">
          Ciao {profilo?.nome ?? ""}, cosa facciamo oggi?
        </h1>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <QuickAction icon={<UserPlus size={24} />} title="Nuova azienda" desc="Inserisci un'azienda in pochi passi" onClick={nuovaAzienda} delay={0.05} />
        <QuickAction icon={<Sparkles size={24} />} title="Carica documenti" desc="Li riconosco e archivio io" onClick={() => setSmart(true)} delay={0.08} />
        <QuickAction icon={<FilePlus2 size={24} />} title="Nuova domanda" desc="Avvia o aggiorna una pratica" onClick={() => nuovaDomanda()} delay={0.1} primary />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        {tiles.map((t, i) => (
          <motion.button
            key={t.to}
            onClick={() => nav(t.to)}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.985 }}
            className={`group relative text-left bg-white rounded-[28px] border border-ink-100 p-7 shadow-card hover:shadow-lift transition-shadow duration-300 overflow-hidden ${t.big ? "xl:col-span-3 min-h-[230px]" : t.wide ? "xl:col-span-6 min-h-[180px]" : "xl:col-span-2 min-h-[200px]"}`}
          >
            <div className="absolute right-0 bottom-0 h-40 w-40 rounded-tl-[80px] bg-gradient-to-tl from-brand-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex flex-col h-full">
              <div className="flex items-center justify-between">
                <span className="grid place-items-center h-14 w-14 rounded-2xl bg-brand-50 text-brand-800 group-hover:bg-brand-800 group-hover:text-white transition-colors duration-300">
                  <t.icon size={26} />
                </span>
                <ArrowRight size={22} className="text-ink-300 group-hover:text-brand-700 group-hover:translate-x-1 transition-all duration-300" />
              </div>
              <div className="mt-auto pt-8">
                <div className={`${t.big ? "text-[28px]" : "text-[22px]"} font-extrabold tracking-[-0.03em]`}>{t.title}</div>
                <div className="text-ink-500 text-[14.5px] mt-1">{t.desc}</div>
                <div className="mt-4 inline-flex chip bg-ink-100 text-ink-600">
                  {t.meta}
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
      <CaricamentoIntelligente open={smart} onClose={() => setSmart(false)} />
    </div>
  );
}

function QuickAction({ icon, title, desc, onClick, delay, primary }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void; delay: number; primary?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      className={`group flex items-center gap-5 text-left rounded-[24px] p-5 pr-7 transition-shadow duration-300 ${primary ? "bg-brand-800 text-white shadow-[0_18px_40px_-18px_rgba(0,80,42,.8)] hover:shadow-[0_22px_48px_-16px_rgba(0,80,42,.85)]" : "bg-white border border-ink-100 shadow-card hover:shadow-lift"}`}
    >
      <span className={`grid place-items-center h-16 w-16 rounded-2xl ${primary ? "bg-white/12 text-white ring-1 ring-white/20" : "bg-brand-50 text-brand-800"}`}>{icon}</span>
      <span className="flex-1">
        <span className="block text-[19px] font-bold tracking-tight">{title}</span>
        <span className={`block text-[14px] ${primary ? "text-white/70" : "text-ink-500"}`}>{desc}</span>
      </span>
      <span className={`grid place-items-center h-11 w-11 rounded-full transition-all duration-300 group-hover:translate-x-1 ${primary ? "bg-white text-brand-800" : "bg-ink-100 text-ink-600 group-hover:bg-brand-800 group-hover:text-white"}`}>
        <ArrowRight size={19} />
      </span>
    </motion.button>
  );
}
