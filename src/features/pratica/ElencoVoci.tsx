import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ClipboardList, Download, Hand, Plus, Send, Sparkles, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { BarraAzioni, SelezionaTutti, useSelezione } from "../../components/ui/Bulk";
import { Button } from "../../components/ui/Button";
import { Checkbox, Field, SearchInput, TextInput } from "../../components/ui/Inputs";
import { Select } from "../../components/ui/Select";
import { Avatar, Empty, ProgressStati, StatoPill } from "../../components/ui/Misc";
import { Modal } from "../../components/ui/Modal";
import { useFeedback } from "../../components/ui/Feedback";
import { ESITI, ORDINE_STATI, STATI } from "../../lib/domain";
import { esportaExcel } from "../../lib/esporta";
import { fmtDate, normalizeSearch, titleCase } from "../../lib/format";
import { useAggiornaVoci, useAggiungiVoci, useEliminaVoci } from "../../lib/queries";
import type { Riscontro, VoceRiscontro } from "../../lib/riscontro";
import { useModals, useUfficio } from "../../lib/ufficio";
import type { Pratica, StatoDomanda } from "../../lib/types";

type Filtro = "tutte" | StatoDomanda | "manuali";
export const NOME_STATO: Record<StatoDomanda, string> = { R: "Fatte", S: "Stampate", C: "In compilazione", N: "Non fatte" };

/** Riquadri con i conteggi del riscontro (fatte, stampate, in compilazione, non fatte). */
export function ConteggiRiscontro({ r, filtro, onFiltro }: { r: Riscontro | undefined; filtro?: Filtro; onFiltro?: (f: Filtro) => void }) {
  const c = r?.conteggi ?? { N: 0, C: 0, S: 0, R: 0 };
  const tot = r?.voci.length ?? 0;
  return (
    <div className="card p-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <div className="text-[13px] text-ink-500 font-medium">Riscontro tra l'elenco da fare e i file delle domande fatte</div>
          <div className="text-[28px] font-extrabold tabular-nums tracking-tight">{tot ? Math.round((c.R / tot) * 100) : 0}% <span className="text-base font-semibold text-ink-400">fatte · {c.R} su {tot}</span></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(["R", "S", "C", "N"] as StatoDomanda[]).map((s) => (
            <button key={s} onClick={() => onFiltro?.(filtro === s ? "tutte" : s)} disabled={!onFiltro}
              className={clsx("rounded-2xl px-3 py-2.5 text-left border-2 transition-all min-w-[104px] active:scale-[.97]", filtro === s ? "" : "border-transparent bg-ink-50 hover:bg-ink-100")}
              style={filtro === s ? { borderColor: STATI[s].color, background: STATI[s].color + "0F" } : undefined}>
              <div className="flex items-center gap-1.5 text-[11.5px] font-bold whitespace-nowrap" style={{ color: STATI[s].color }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATI[s].color }} />{NOME_STATO[s]}</div>
              <div className="text-[22px] font-extrabold tabular-nums leading-tight">{c[s]}</div>
            </button>
          ))}
        </div>
      </div>
      <ProgressStati className="mt-5" counts={c} total={tot} height={10} />
    </div>
  );
}

/** Elenco delle domande da fare di una pratica, con il pallino dello stato, filtri e azioni in blocco. */
export function ElencoVoci({ pratica, r, conConteggi = true }: { pratica: Pratica; r: Riscontro | undefined; conConteggi?: boolean }) {
  const { ufficio } = useUfficio();
  const { apriVoce } = useModals();
  const [filtro, setFiltro] = useState<Filtro>("tutte");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(100);
  const [nuova, setNuova] = useState(false);
  const selezione = useSelezione(pratica.id + ufficio.id);
  const aggiorna = useAggiornaVoci();
  const elimina = useEliminaVoci();
  const { toast, confirm } = useFeedback();
  const voci = r?.voci ?? [];
  const c = r?.conteggi ?? { N: 0, C: 0, S: 0, R: 0 };

  const lista = useMemo(() => {
    const n = normalizeSearch(q.trim());
    return voci
      .filter((v) => (filtro === "tutte" || (filtro === "manuali" ? v.manuale : v.stato === filtro)) && (!n || normalizeSearch(`${v.voce.denominazione ?? ""} ${v.voce.cuaa ?? ""} ${v.numero ?? ""}`).includes(n)))
      .sort((x, y) => ORDINE_STATI.indexOf(x.stato) - ORDINE_STATI.indexOf(y.stato) || (x.voce.denominazione ?? "").localeCompare(y.voce.denominazione ?? "", "it"));
  }, [voci, filtro, q]);

  const imposta = async (st: StatoDomanda | null) => {
    const ids = selezione.ids;
    await aggiorna.mutateAsync({ ids, campi: { stato_manuale: st } });
    toast("success", `${ids.length} righe aggiornate`, st ? NOME_STATO[st] : "Stato automatico dai file"); selezione.svuota();
  };
  const togli = async () => {
    const ids = selezione.ids;
    if (!(await confirm({ title: `Togliere ${ids.length} righe dall'elenco?`, message: "Escono dall'elenco delle domande da fare di questa pratica. L'anagrafica non cambia.", danger: true, confirmLabel: "Togli" }))) return;
    await elimina.mutateAsync(ids);
    toast("success", `${ids.length} righe tolte dall'elenco`); selezione.svuota();
  };
  const esporta = (ids?: string[]) => {
    const l = ids ? voci.filter((v) => ids.includes(v.voce.id)) : lista;
    esportaExcel(`${pratica.codice ?? pratica.id}_${ufficio.id}`, ["Nominativo", "CUAA", "Stato", "Origine stato", "File", "N. domanda", "Data presentazione", "Esito", "Note"],
      l.map((v) => [v.voce.denominazione, v.voce.cuaa, NOME_STATO[v.stato], v.manuale ? "A mano" : v.fonte ? "Dal file" : "Non trovata nei file", v.fonte?.file.nome, v.numero, v.data ? fmtDate(v.data) : "", v.stato === "R" && v.esito ? ESITI[v.esito].label : "", v.voce.note]));
  };

  return (
    <div>
      {conConteggi && <ConteggiRiscontro r={r} filtro={filtro} onFiltro={setFiltro} />}
      <div className={clsx("flex flex-col sm:flex-row gap-3", conConteggi && "mt-5")}>
        <SearchInput value={q} onChange={setQ} placeholder="Cerca nominativo, CUAA o numero domanda…" className="flex-1" />
        <Select value={filtro} onChange={setFiltro} className="sm:w-60" options={[
          { value: "tutte", label: `Tutti gli stati (${voci.length})` },
          ...(["R", "S", "C", "N"] as StatoDomanda[]).map((s) => ({ value: s, label: `${NOME_STATO[s]} (${c[s]})`, icon: <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATI[s].color }} /> })),
          { value: "manuali", label: `Stato impostato a mano (${voci.filter((v) => v.manuale).length})`, icon: <Hand size={14} /> },
        ]} />
        <Button variant="secondary" icon={<UserPlus size={16} />} onClick={() => setNuova(true)}>Aggiungi</Button>
        {lista.length > 0 && <Button variant="secondary" icon={<Download size={16} />} onClick={() => esporta()}>Esporta</Button>}
      </div>
      <div className="mt-3 card overflow-hidden">
        {voci.length === 0 ? (
          <Empty icon={<ClipboardList size={26} />} title="L'elenco è vuoto" desc="Carica l'Excel delle domande da fare oppure aggiungi i nominativi a mano." />
        ) : lista.length === 0 ? <Empty icon={<ClipboardList size={26} />} title="Nessuna riga con questo filtro" /> : (
          <div className="divide-y divide-ink-100">
            <div className="px-5 h-11 flex items-center bg-ink-50/60">
              <SelezionaTutti ids={lista.map((v) => v.voce.id)} sel={selezione.sel} onChange={selezione.imposta} etichetta={<>{lista.length} righe{selezione.n > 0 && <> · <b className="text-brand-800">{selezione.n} selezionate</b></>}</>} />
            </div>
            <AnimatePresence initial={false}>
              {lista.slice(0, limit).map((v, i) => <RigaVoce key={v.voce.id} v={v} i={i} sel={selezione.sel.has(v.voce.id)} onSel={(x) => selezione.toggle(v.voce.id, x)} onOpen={() => apriVoce(v.voce.id)} />)}
            </AnimatePresence>
          </div>
        )}
        {lista.length > limit && <div className="p-4 flex justify-center border-t border-ink-100"><Button variant="secondary" onClick={() => setLimit((l) => l + 100)}>Mostra altre ({lista.length - limit})</Button></div>}
      </div>

      <BarraAzioni n={selezione.n} nome={selezione.n === 1 ? "selezionata" : "selezionate"} onClear={selezione.svuota} azioni={[
        { label: "Imposta stato", icon: <Send size={16} />, menu: [
          ...(["R", "S", "C", "N"] as StatoDomanda[]).map((st) => ({ label: st === "R" ? "Fatta" : st === "N" ? "Non fatta" : STATI[st].label, dot: STATI[st].color, onClick: () => imposta(st) })),
          { label: "Automatico dai file", icon: <Sparkles size={15} />, onClick: () => imposta(null) },
        ] },
        { label: "Esporta", icon: <Download size={16} />, onClick: () => esporta(selezione.ids) },
        { label: "Togli dall'elenco", icon: <Trash2 size={16} />, tone: "danger", onClick: togli },
      ]} />
      <NuovaVoce open={nuova} onClose={() => setNuova(false)} pratica={pratica} ordine={voci.length} />
    </div>
  );
}

function RigaVoce({ v, i, sel, onSel, onOpen }: { v: VoceRiscontro; i: number; sel: boolean; onSel: (v: boolean) => void; onOpen: () => void }) {
  const nome = v.voce.denominazione || v.voce.cuaa || "—";
  return (
    <motion.div role="button" tabIndex={0} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: Math.min(i, 15) * 0.012 } }} exit={{ opacity: 0 }}
      onClick={onOpen} className={clsx("group w-full flex items-center gap-4 px-5 py-3 text-left cursor-pointer transition-colors", sel ? "bg-brand-50/60" : "hover:bg-ink-50/80")}>
      <span onClick={(e) => e.stopPropagation()}><Checkbox checked={sel} onChange={onSel} /></span>
      <span className="relative h-3.5 w-3.5 shrink-0">
        <span className="absolute inset-0 rounded-full" style={{ background: STATI[v.stato].color }} />
        {v.stato === "N" && <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: STATI[v.stato].color }} />}
      </span>
      <Avatar name={nome} size={36} />
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-[14.5px] truncate group-hover:text-brand-900">{titleCase(nome)}</span>
        <span className="block text-[12px] text-ink-400 truncate"><span className="font-mono">{v.voce.cuaa ?? "senza CUAA"}</span>{v.fonte && !v.manuale ? <> · da «{v.fonte.file.nome}»</> : null}</span>
      </span>
      <span className="hidden md:block w-40 text-[12.5px] text-ink-500 truncate text-right">{v.numero ?? ""}{v.data ? ` · ${fmtDate(v.data)}` : ""}</span>
      {v.manuale && <span className="hidden sm:inline-flex chip !h-6 !text-[11px] bg-ink-100 text-ink-600" title="Stato impostato a mano"><Hand size={11} />a mano</span>}
      <StatoPill stato={v.stato} />
      <ChevronRight size={17} className="text-ink-300 group-hover:text-brand-700" />
    </motion.div>
  );
}

function NuovaVoce({ open, onClose, pratica, ordine }: { open: boolean; onClose: () => void; pratica: Pratica; ordine: number }) {
  const { ufficio } = useUfficio();
  const aggiungi = useAggiungiVoci();
  const { toast } = useFeedback();
  const [nome, setNome] = useState("");
  const [cuaa, setCuaa] = useState("");
  const salva = async (continua: boolean) => {
    if (!nome.trim() && !cuaa.trim()) return;
    await aggiungi.mutateAsync([{ pratica_id: pratica.id, ufficio_id: ufficio.id, denominazione: nome.trim() || null, cuaa: cuaa.trim().toUpperCase() || null, ordine }]);
    toast("success", "Aggiunta all'elenco", titleCase(nome || cuaa));
    setNome(""); setCuaa("");
    if (!continua) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} size="sm" icon={<Plus size={20} />} title="Aggiungi all'elenco" subtitle={pratica.nome}
      footer={<>
        <div className="flex-1" />
        <Button variant="secondary" onClick={() => salva(true)} disabled={!nome.trim() && !cuaa.trim()}>Aggiungi e continua</Button>
        <Button onClick={() => salva(false)} loading={aggiungi.isPending} disabled={!nome.trim() && !cuaa.trim()}>Aggiungi</Button>
      </>}>
      <div className="space-y-4">
        <Field label="Nominativo"><TextInput autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Rossi Mario" /></Field>
        <Field label="CUAA" optional hint="Codice fiscale o partita IVA: serve per il riscontro con i file delle domande fatte."><TextInput value={cuaa} onChange={(e) => setCuaa(e.target.value)} className="font-mono uppercase" /></Field>
        <p className="text-[12.5px] text-ink-500">La riga si aggiunge solo all'elenco di questa pratica: l'anagrafica non cambia.</p>
      </div>
    </Modal>
  );
}
