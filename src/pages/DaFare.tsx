import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronRight, Download, ListChecks, X } from "lucide-react";
import { BarraAzioni, SelezionaTutti, useSelezione } from "../components/ui/Bulk";
import { Checkbox, SearchInput } from "../components/ui/Inputs";
import { useFeedback } from "../components/ui/Feedback";
import { useStatoMisto } from "../lib/queries";
import { esportaExcel } from "../lib/esporta";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { useModals, useUfficio } from "../lib/ufficio";
import { calcolaAttivita, STATI, TIPI_ATTIVITA, type TipoAttivita } from "../lib/domain";
import { normalizeSearch, titleCase } from "../lib/format";
import { Avatar, Empty } from "../components/ui/Misc";
import { Button } from "../components/ui/Button";
import { PageHeader } from "./Anagrafica";

export function DaFarePage() {
  const { aziende, pratiche, abbinamenti, domande, ufficio } = useUfficio();
  const { apriDomanda } = useModals();
  const [params, setParams] = useSearchParams();
  const filtroPratica = params.get("pratica");
  const praticaFiltro = pratiche.find((p) => p.id === filtroPratica);
  const all = useMemo(() => calcolaAttivita(aziende, praticaFiltro ? [praticaFiltro] : pratiche, abbinamenti, domande), [aziende, pratiche, praticaFiltro, abbinamenti, domande]);
  const [tipo, setTipo] = useState<TipoAttivita | "urgenti" | null>(null);
  const [q, setQ] = useState("");
  const selezione = useSelezione(`${ufficio.id}|${filtroPratica}|${tipo}`);
  const statoMisto = useStatoMisto();
  const { toast, confirm } = useFeedback();
  const chiave = (x: { azienda: { id: string }; pratica: { id: string } }) => x.azienda.id + "|" + x.pratica.id;
  const [limit, setLimit] = useState(40);
  const counts = useMemo(() => {
    const c = {} as Record<TipoAttivita, number>;
    (Object.keys(TIPI_ATTIVITA) as TipoAttivita[]).forEach((k) => (c[k] = all.filter((a) => a.tipo === k).length));
    return c;
  }, [all]);
  const urgenti = all.filter((a) => a.urgente);
  // senza urgenze si apre la prima categoria che ha qualcosa da fare
  const scelto = tipo ?? (urgenti.length ? "urgenti" : (Object.keys(TIPI_ATTIVITA) as TipoAttivita[]).find((k) => counts[k] > 0) ?? "urgenti");
  const listaTipo = scelto === "urgenti" ? urgenti : all.filter((a) => a.tipo === scelto);
  const list = useMemo(() => {
    const n = normalizeSearch(q.trim());
    return n ? listaTipo.filter((x) => normalizeSearch(`${x.azienda.denominazione} ${x.azienda.cuaa} ${x.pratica.nome}`).includes(n)) : listaTipo;
  }, [listaTipo, q]);
  const cambia = async (st: "C" | "S" | "R" | "N") => {
    const voci = list.filter((x) => selezione.sel.has(chiave(x))).map((x) => ({ azienda_id: x.azienda.id, pratica_id: x.pratica.id }));
    if (st === "N" && !(await confirm({ title: `Riportare ${voci.length} domande a «da fare»?`, message: "Le domande vengono eliminate con i loro dati.", danger: true, confirmLabel: "Conferma" }))) return;
    await statoMisto.mutateAsync({ voci, stato: st });
    toast("success", `${voci.length} domande aggiornate`, STATI[st].label); selezione.svuota();
  };
  const esporta = (soloSel: boolean) => {
    const l = soloSel ? list.filter((x) => selezione.sel.has(chiave(x))) : list;
    esportaExcel(`da_fare_${ufficio.id}`, ["Attività", "Azienda", "CUAA", "Pratica", "Dettaglio", "Urgente"], l.map((x) => [TIPI_ATTIVITA[x.tipo].label, x.azienda.denominazione, x.azienda.cuaa, x.pratica.nome, x.dettaglio, x.urgente ? "SI" : ""]));
  };
  return (
    <div>
      <PageHeader title="Da fare" subtitle={`Attività generate in automatico per l'ufficio di ${ufficio.nome}`} />
      {praticaFiltro && (
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-50 ring-1 ring-brand-100 pl-4 pr-1.5 h-10 text-[13.5px] font-semibold text-brand-900">
          Solo: {praticaFiltro.nome}
          <button onClick={() => setParams({})} className="h-7 w-7 grid place-items-center rounded-full hover:bg-white text-brand-700" aria-label="Togli il filtro"><X size={15} /></button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Tile on={scelto === "urgenti"} onClick={() => { setTipo("urgenti"); setLimit(40); }} color="#DC2626" label="Urgenti" count={urgenti.length} desc="Da trattare subito" icon={<AlertCircle size={18} />} />
        {(Object.keys(TIPI_ATTIVITA) as TipoAttivita[]).map((k) => (
          <Tile key={k} on={scelto === k} onClick={() => { setTipo(k); setLimit(40); }} color={TIPI_ATTIVITA[k].color} label={TIPI_ATTIVITA[k].label} count={counts[k]} desc={TIPI_ATTIVITA[k].desc} />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <SearchInput value={q} onChange={setQ} placeholder="Cerca azienda, CUAA o pratica…" className="flex-1" />
        {list.length > 0 && <Button variant="secondary" icon={<Download size={16} />} onClick={() => esporta(false)}>Esporta {list.length}</Button>}
      </div>
      <div className="card overflow-hidden">
        {list.length > 0 && (
          <div className="px-5 h-11 flex items-center bg-ink-50/60 border-b border-ink-100">
            <SelezionaTutti ids={list.slice(0, limit).map(chiave)} sel={selezione.sel} onChange={selezione.imposta} etichetta={<>{list.length} attività{selezione.n > 0 && <> · <b className="text-brand-800">{selezione.n} selezionate</b></>}</>} />
          </div>
        )}
        {list.length === 0 ? (
          <Empty icon={<CheckCircle2 size={28} />} title="Niente da fare qui" desc="Tutto in ordine per questa categoria." />
        ) : (
          <div className="divide-y divide-ink-100">
            {list.slice(0, limit).map((x, i) => (
              <motion.div
                role="button"
                tabIndex={0}
                key={x.tipo + x.azienda.id + x.pratica.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 15) * 0.015 } }}
                onClick={() => apriDomanda(x.azienda.id, x.pratica.id)}
                className={clsx("group w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer transition-colors", selezione.sel.has(chiave(x)) ? "bg-brand-50/60" : "hover:bg-ink-50/80")}
              >
                <span onClick={(e) => e.stopPropagation()}><Checkbox checked={selezione.sel.has(chiave(x))} onChange={(v) => selezione.toggle(chiave(x), v)} /></span>
                <span className="w-1 self-stretch rounded-full -my-1" style={{ background: TIPI_ATTIVITA[x.tipo].color }} />
                <Avatar name={x.azienda.denominazione} size={42} square={x.azienda.tipo === "PG"} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[15px] truncate">{titleCase(x.azienda.denominazione)}</div>
                  <div className="text-[13px] text-ink-500 truncate">{x.pratica.nome}</div>
                </div>
                <span className="hidden sm:inline-flex chip bg-ink-50 text-ink-700">{TIPI_ATTIVITA[x.tipo].label}</span>
                <span className={clsx("text-[13px] font-semibold w-44 text-right truncate", x.urgente ? "text-red-600" : "text-ink-500")}>{x.dettaglio}</span>
                <ChevronRight size={18} className="text-ink-300 group-hover:text-brand-700 group-hover:translate-x-0.5 transition-all" />
              </motion.div>
            ))}
          </div>
        )}
        {list.length > limit && <div className="p-4 flex justify-center border-t border-ink-100"><Button variant="secondary" onClick={() => setLimit((l) => l + 40)}>Mostra altre ({list.length - limit})</Button></div>}
      </div>
      <BarraAzioni n={selezione.n} nome={selezione.n === 1 ? "selezionata" : "selezionate"} onClear={selezione.svuota} azioni={[
        ...(["R", "S", "C"] as const).map((st) => ({ label: st === "R" ? "Fatta" : STATI[st].label, icon: <span className="h-2 w-2 rounded-full" style={{ background: STATI[st].color }} />, onClick: () => cambia(st) })),
        { label: "Da fare", onClick: () => cambia("N"), tone: "muted" as const },
        { label: "Esporta", icon: <Download size={15} />, onClick: () => esporta(true) },
      ]} />
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
