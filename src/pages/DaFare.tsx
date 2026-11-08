import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronRight, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { useModals, useUfficio } from "../lib/ufficio";
import { calcolaAttivita, TIPI_ATTIVITA, type TipoAttivita } from "../lib/domain";
import { titleCase } from "../lib/format";
import { Avatar, Empty } from "../components/ui/Misc";
import { Button } from "../components/ui/Button";
import { PageHeader } from "./Anagrafica";

export function DaFarePage() {
  const { aziende, pratiche, abbinamenti, domande, ufficio } = useUfficio();
  const { apriDomanda } = useModals();
  const all = useMemo(() => calcolaAttivita(aziende, pratiche, abbinamenti, domande), [aziende, pratiche, abbinamenti, domande]);
  const [tipo, setTipo] = useState<TipoAttivita | "urgenti" | null>(null);
  const [limit, setLimit] = useState(40);
  const counts = useMemo(() => {
    const c = {} as Record<TipoAttivita, number>;
    (Object.keys(TIPI_ATTIVITA) as TipoAttivita[]).forEach((k) => (c[k] = all.filter((a) => a.tipo === k).length));
    return c;
  }, [all]);
  const urgenti = all.filter((a) => a.urgente);
  // senza urgenze si apre la prima categoria che ha qualcosa da fare
  const scelto = tipo ?? (urgenti.length ? "urgenti" : (Object.keys(TIPI_ATTIVITA) as TipoAttivita[]).find((k) => counts[k] > 0) ?? "urgenti");
  const list = scelto === "urgenti" ? urgenti : all.filter((a) => a.tipo === scelto);

  return (
    <div>
      <PageHeader title="Da fare" subtitle={`Attività generate in automatico per l'ufficio di ${ufficio.nome}`} />
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <Tile on={scelto === "urgenti"} onClick={() => { setTipo("urgenti"); setLimit(40); }} color="#DC2626" label="Urgenti" count={urgenti.length} desc="Da trattare subito" icon={<AlertCircle size={18} />} />
        {(Object.keys(TIPI_ATTIVITA) as TipoAttivita[]).map((k) => (
          <Tile key={k} on={scelto === k} onClick={() => { setTipo(k); setLimit(40); }} color={TIPI_ATTIVITA[k].color} label={TIPI_ATTIVITA[k].label} count={counts[k]} desc={TIPI_ATTIVITA[k].desc} />
        ))}
      </div>

      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <Empty icon={<CheckCircle2 size={28} />} title="Niente da fare qui" desc="Tutto in ordine per questa categoria." />
        ) : (
          <div className="divide-y divide-ink-100">
            {list.slice(0, limit).map((x, i) => (
              <motion.button
                key={x.tipo + x.azienda.id + x.pratica.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 15) * 0.015 } }}
                onClick={() => apriDomanda(x.azienda.id, x.pratica.id)}
                className="group w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-ink-50/80 transition-colors"
              >
                <span className="w-1 self-stretch rounded-full -my-1" style={{ background: TIPI_ATTIVITA[x.tipo].color }} />
                <Avatar name={x.azienda.denominazione} size={42} square={x.azienda.tipo === "PG"} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[15px] truncate">{titleCase(x.azienda.denominazione)}</div>
                  <div className="text-[13px] text-ink-500 truncate">{x.pratica.nome}</div>
                </div>
                <span className="hidden sm:inline-flex chip bg-ink-50 text-ink-700">{TIPI_ATTIVITA[x.tipo].label}</span>
                <span className={clsx("text-[13px] font-semibold w-44 text-right truncate", x.urgente ? "text-red-600" : "text-ink-500")}>{x.dettaglio}</span>
                <ChevronRight size={18} className="text-ink-300 group-hover:text-brand-700 group-hover:translate-x-0.5 transition-all" />
              </motion.button>
            ))}
          </div>
        )}
        {list.length > limit && <div className="p-4 flex justify-center border-t border-ink-100"><Button variant="secondary" onClick={() => setLimit((l) => l + 40)}>Mostra altre ({list.length - limit})</Button></div>}
      </div>
      {all.length === 0 && <div className="mt-6 text-center text-ink-400 text-sm flex items-center justify-center gap-2"><ListChecks size={16} /> Nessuna attività aperta</div>}
    </div>
  );
}

function Tile({ on, onClick, color, label, count, desc, icon }: { on: boolean; onClick: () => void; color: string; label: string; count: number; desc: string; icon?: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={clsx("text-left rounded-3xl p-4 border-2 transition-all duration-200", on ? "shadow-card" : "bg-white border-ink-100 hover:border-ink-200")}
      style={on ? { borderColor: color, background: color + "0C" } : undefined}
    >
      <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color }}>{icon ?? <span className="h-2 w-2 rounded-full" style={{ background: color }} />}{label}</div>
      <div className="text-[30px] font-extrabold tabular-nums tracking-tight mt-1">{count}</div>
      <div className="text-[11.5px] text-ink-500 leading-snug">{desc}</div>
    </motion.button>
  );
}
