import { motion } from "framer-motion";
import { CalendarClock, ClipboardList, FileSpreadsheet, Plus, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useModals, useUfficio } from "../lib/ufficio";
import { daysFromToday, fmtDate, relDays } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Empty, ProgressStati } from "../components/ui/Misc";
import { ElencoVoci } from "../features/pratica/ElencoVoci";
import { PageHeader } from "./Anagrafica";

/** Domande per pratica: riscontro tra l'elenco da fare e i file delle domande fatte. */
export function DomandePage() {
  const { pratiche, riscontri, ufficio } = useUfficio();
  const { nuovaDomanda } = useModals();
  const nav = useNavigate();
  const attive = useMemo(() => pratiche.filter((p) => p.attivo).sort((a, b) => Number(riscontri.has(b.id)) - Number(riscontri.has(a.id))), [pratiche, riscontri]);
  const [pid, setPid] = useState<string>(() => { try { return localStorage.getItem("cia-pratica") ?? ""; } catch { return ""; } });
  const pratica = attive.find((p) => p.id === pid) ?? attive[0];
  useEffect(() => { if (pratica) try { localStorage.setItem("cia-pratica", pratica.id); } catch { /* ignore */ } }, [pratica]);
  const r = pratica ? riscontri.get(pratica.id) : undefined;

  return (
    <div>
      <PageHeader
        title="Domande"
        subtitle={`Fatte, stampate, in compilazione e non fatte · ufficio di ${ufficio.nome}`}
        action={<Button size="lg" icon={<Plus size={19} strokeWidth={2.5} />} onClick={nuovaDomanda}>Nuova domanda</Button>}
      />
      {attive.length === 0 ? (
        <div className="card"><Empty icon={<ClipboardList size={26} />} title="Nessuna pratica attiva" desc="Crea una pratica e carica l'elenco delle domande da fare." action={<Button icon={<Plus size={17} />} onClick={nuovaDomanda}>Nuova domanda</Button>} /></div>
      ) : (
        <>
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 flex gap-3 overflow-x-auto pb-2 snap-x">
            {attive.map((p) => {
              const on = p.id === pratica?.id;
              const ri = riscontri.get(p.id);
              const tot = ri?.voci.length ?? 0;
              const g = daysFromToday(p.scadenza);
              return (
                <motion.button key={p.id} onClick={() => setPid(p.id)} whileTap={{ scale: 0.98 }}
                  className={clsx("snap-start shrink-0 w-[270px] text-left rounded-3xl p-5 border-2 transition-all duration-300",
                    on ? "bg-brand-800 border-brand-800 text-white shadow-[0_18px_40px_-18px_rgba(0,80,42,.8)]" : "bg-white border-ink-100 hover:border-ink-200 shadow-soft hover:shadow-card")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={clsx("text-[11px] font-bold uppercase tracking-wider", on ? "text-brand-200" : "text-ink-400")}>{p.codice ?? (p.categoria === "bando" ? "Bando" : "Annuale")}</div>
                      <div className="font-bold text-[15.5px] leading-tight mt-1 line-clamp-2 tracking-tight">{p.nome}</div>
                    </div>
                    {g != null && g >= 0 && g <= 45 && (
                      <span className={clsx("chip !h-6 !text-[11px] shrink-0", on ? "bg-white/15 text-white" : g <= 15 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}><CalendarClock size={11} /> {g} gg</span>
                    )}
                  </div>
                  {tot ? (
                    <>
                      <div className="mt-4 flex items-end justify-between">
                        <div><span className="text-[26px] font-extrabold tabular-nums tracking-tight">{ri!.conteggi.R}</span><span className={clsx("text-sm font-semibold", on ? "text-white/60" : "text-ink-400")}> / {tot}</span></div>
                        <span className={clsx("text-[12px] font-semibold", on ? "text-white/70" : "text-ink-500")}>fatte</span>
                      </div>
                      <div className={clsx("mt-2.5 rounded-full", on && "bg-white/10 p-[2px]")}><ProgressStati counts={ri!.conteggi} total={tot} height={6} /></div>
                    </>
                  ) : (
                    <div className={clsx("mt-4 text-[13px] font-semibold flex items-center gap-1.5", on ? "text-white/75" : "text-ink-400")}><FileSpreadsheet size={14} /> Elenco da caricare</div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {pratica && (
            <div className="mt-5">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-[22px] font-extrabold tracking-[-0.025em]">{pratica.nome}</h2>
                  <div className="text-[13px] text-ink-500">{[pratica.ente, pratica.scadenza && `Scadenza ${fmtDate(pratica.scadenza)}${(daysFromToday(pratica.scadenza) ?? 0) >= 0 ? ` · ${relDays(daysFromToday(pratica.scadenza))}` : " · chiusa"}`].filter(Boolean).join(" · ")}</div>
                </div>
                <Button variant="secondary" icon={<FileSpreadsheet size={16} />} onClick={() => nav(`/u/${ufficio.id}/pratiche/${pratica.id}`)}>File e caricamenti</Button>
              </div>
              {pratica.modello || r?.voci.length ? <ElencoVoci pratica={pratica} r={r} /> : (
                <div className="card">
                  <Empty icon={<FileSpreadsheet size={26} />} title="Manca l'elenco delle domande da fare" desc="Carica l'Excel dei nominativi che devono fare questa domanda, poi i file delle domande fatte: farò il riscontro."
                    action={<Button icon={<Upload size={17} />} onClick={() => nav(`/u/${ufficio.id}/pratiche/${pratica.id}`, { state: { carica: "modello" } })}>Carica l'elenco da fare</Button>} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
