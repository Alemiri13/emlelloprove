import { AnimatePresence, motion } from "framer-motion";
import { CaricamentoIntelligente } from "../features/CaricamentoIntelligente";
import { ImportAziende } from "../features/import/ImportAziende";
import { FileSpreadsheet, Trash2, Sparkles, ArrowDownAZ, Building2, ChevronRight, Leaf, Plus, Tractor, User, Users, Download, SlidersHorizontal, ArrowRightLeft, ClipboardPlus, MapPin, Filter, BadgeCheck, RotateCcw } from "lucide-react";
import { BarraAzioni, useSelezione } from "../components/ui/Bulk";
import { esportaExcel } from "../lib/esporta";
import { fmtDate } from "../lib/format";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useModals, useUfficio } from "../lib/ufficio";
import { eta } from "../lib/cf";
import { ha, normalizeSearch, titleCase } from "../lib/format";
import { STATI } from "../lib/domain";
import { Button } from "../components/ui/Button";
import { Checkbox, SearchInput, Toggle } from "../components/ui/Inputs";
import { Modal } from "../components/ui/Modal";
import { useFeedback } from "../components/ui/Feedback";
import { useAbbina, useAggiornaAziende, useEliminaAziende, useTrasferisciAziende } from "../lib/queries";
import { Segmented } from "../components/ui/Segmented";
import { Select } from "../components/ui/Select";
import { Avatar, Badge, Empty } from "../components/ui/Misc";
import { Skeleton } from "../components/ui/Spinner";
import type { Azienda } from "../lib/types";

type Filtro = "tutte" | "PF" | "PG" | "bio" | "iap" | "uma";
type Ordine = "nome" | "sau" | "recenti" | "eta";
type Situazione = "tutte" | "con_domande" | "senza_domande" | "senza_sau" | "senza_colture" | "senza_contatti";

export function AnagraficaPage() {
  const { aziende, colturaById, domande, pratiche, loading, ufficio } = useUfficio();
  const { apriAzienda, nuovaAzienda } = useModals();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("tutte");
  const [ordine, setOrdine] = useState<Ordine>("nome");
  const [coltura, setColtura] = useState<string | null>(null);
  const [limit, setLimit] = useState(60);
  const [smart, setSmart] = useState(false);
  const [importa, setImporta] = useState(false);
  const [comune, setComune] = useState<string | null>(null);
  const [situazione, setSituazione] = useState<Situazione>("tutte");
  const selezione = useSelezione(ufficio.id);
  const { sel } = selezione;
  const [conferma, setConferma] = useState(false);
  const [versoPratica, setVersoPratica] = useState(false);
  const { uffici } = useUfficio();
  const aggiorna = useAggiornaAziende();
  const trasferisci = useTrasferisciAziende();
  const { toast, confirm } = useFeedback();

  const domByAz = useMemo(() => {
    const m = new Map<string, typeof domande>();
    for (const d of domande) (m.get(d.azienda_id) ?? m.set(d.azienda_id, []).get(d.azienda_id)!).push(d);
    return m;
  }, [domande]);

  const counts = useMemo(() => ({
    tutte: aziende.length,
    PF: aziende.filter((a) => a.tipo === "PF").length,
    PG: aziende.filter((a) => a.tipo === "PG").length,
    bio: aziende.filter((a) => a.biologico).length,
    iap: aziende.filter((a) => a.iap).length,
    uma: aziende.filter((a) => a.uma).length,
  }), [aziende]);

  const list = useMemo(() => {
    const n = normalizeSearch(q.trim());
    let l = aziende.filter((a) => {
      if (filtro === "PF" && a.tipo !== "PF") return false;
      if (filtro === "PG" && a.tipo !== "PG") return false;
      if (filtro === "bio" && !a.biologico) return false;
      if (filtro === "iap" && !a.iap) return false;
      if (filtro === "uma" && !a.uma) return false;
      if (coltura && !a.azienda_colture?.some((c) => c.coltura_id === coltura)) return false;
      if (comune && (a.comune ?? "—") !== comune) return false;
      if (situazione === "con_domande" && !domByAz.get(a.id)?.length) return false;
      if (situazione === "senza_domande" && domByAz.get(a.id)?.length) return false;
      if (situazione === "senza_sau" && a.sau_ha != null) return false;
      if (situazione === "senza_colture" && a.azienda_colture?.length) return false;
      if (situazione === "senza_contatti" && (a.telefono || a.email || a.pec)) return false;
      if (n && !normalizeSearch(`${a.denominazione} ${a.cuaa} ${a.comune ?? ""} ${a.telefono ?? ""}`).includes(n)) return false;
      return true;
    });
    l = [...l].sort((a, b) => {
      if (ordine === "sau") return (b.sau_ha ?? 0) - (a.sau_ha ?? 0);
      if (ordine === "recenti") return b.updated_at.localeCompare(a.updated_at);
      if (ordine === "eta") return (a.data_nascita ?? "9999").localeCompare(b.data_nascita ?? "9999");
      return a.denominazione.localeCompare(b.denominazione, "it");
    });
    return l;
  }, [aziende, q, filtro, ordine, coltura, comune, situazione, domByAz]);

  const comuni = useMemo(() => {
    const m = new Map<string, number>();
    aziende.forEach((a) => m.set(a.comune ?? "—", (m.get(a.comune ?? "—") ?? 0) + 1));
    return [...m].sort((x, y) => x[0].localeCompare(y[0], "it"));
  }, [aziende]);
  const filtriAttivi = !!(q || coltura || comune || situazione !== "tutte" || filtro !== "tutte");
  const azzera = () => { setQ(""); setColtura(null); setComune(null); setSituazione("tutte"); setFiltro("tutte"); };

  const esporta = (ids?: string[]) => {
    const l = ids ? aziende.filter((a) => ids.includes(a.id)) : list;
    esportaExcel(`aziende_${ufficio.id}`, ["CUAA", "Denominazione", "Tipo", "Data di nascita", "Comune", "Indirizzo", "CAP", "Telefono", "Email", "PEC", "SAU (ha)", "Colture", "Biologico", "IAP", "UMA", "Note"],
      l.map((a) => [a.cuaa, a.denominazione, a.tipo === "PF" ? "Persona fisica" : "Società", a.data_nascita ? fmtDate(a.data_nascita) : "", a.comune, a.indirizzo, a.cap, a.telefono, a.email, a.pec, a.sau_ha,
        (a.azienda_colture ?? []).map((c) => colturaById.get(c.coltura_id)?.nome).filter(Boolean).join("; "), a.biologico ? "SI" : "NO", a.iap ? "SI" : "NO", a.uma ? "SI" : "NO", a.note]));
  };
  const imposta = async (campo: "biologico" | "iap" | "uma", v: boolean) => {
    await aggiorna.mutateAsync({ ids: selezione.ids, campi: { [campo]: v } });
    toast("success", `${selezione.n} aziende aggiornate`);
  };
  const trasferimento = async (ufficioDest: string, sposta: boolean) => {
    const nome = uffici.find((u) => u.id === ufficioDest)?.nome;
    if (sposta && !(await confirm({ title: `Spostare ${selezione.n} aziende a ${nome}?`, message: "Lasciano l'ufficio di " + ufficio.nome + " insieme a domande e documenti. Quelle già presenti a " + nome + " vengono saltate.", confirmLabel: "Sposta" }))) return;
    const r = await trasferisci.mutateAsync({ ids: selezione.ids, ufficio: ufficioDest, sposta });
    toast("success", `${r.fatte} aziende ${sposta ? "spostate" : "copiate"} a ${nome}`, r.saltate ? `${r.saltate} erano già presenti` : undefined);
    selezione.svuota();
  };

  const coltureUsate = useMemo(() => {
    const s = new Set<string>();
    aziende.forEach((a) => a.azienda_colture?.forEach((c) => s.add(c.coltura_id)));
    return [...s].map((id) => colturaById.get(id)).filter(Boolean).sort((a, b) => a!.nome.localeCompare(b!.nome));
  }, [aziende, colturaById]);

  return (
    <div>
      <PageHeader
        title="Anagrafica"
        subtitle={`Le aziende seguite dall'ufficio di ${ufficio.nome}`}
        action={
          <div className="flex gap-3">
            <Button size="lg" variant="secondary" icon={<FileSpreadsheet size={18} />} onClick={() => setImporta(true)}>Importa Excel</Button>
            <Button size="lg" variant="secondary" icon={<Sparkles size={18} />} onClick={() => setSmart(true)}>Carica documenti</Button>
            <Button size="lg" icon={<Plus size={19} strokeWidth={2.5} />} onClick={nuovaAzienda}>Nuova azienda</Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 mb-4">
        <SearchInput value={q} onChange={(v) => { setQ(v); setLimit(60); }} placeholder="Cerca per nome, CUAA o comune…" size="lg" shortcut />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            value={coltura}
            onChange={setColtura}
            clearable
            onClear={() => setColtura(null)}
            placeholder="Tutte le colture"
            icon={<Leaf size={17} />}
            size="lg"
            className="min-w-0"
            options={coltureUsate.map((c) => ({ value: c!.id, label: c!.nome, icon: <span className="h-3 w-3 rounded-full" style={{ background: c!.colore }} /> }))}
          />
          <Select
            value={comune}
            onChange={setComune}
            clearable
            onClear={() => setComune(null)}
            placeholder="Tutti i comuni"
            icon={<MapPin size={17} />}
            size="lg"
            className="min-w-0"
            options={comuni.map(([c, n]) => ({ value: c, label: c === "—" ? "Comune non indicato" : c, hint: `${n} aziende` }))}
          />
          <Select
            value={situazione}
            onChange={setSituazione}
            size="lg"
            icon={<Filter size={17} />}
            className="min-w-0"
            options={[
              { value: "tutte", label: "Qualsiasi situazione" },
              { value: "con_domande", label: "Con almeno una domanda" },
              { value: "senza_domande", label: "Senza domande" },
              { value: "senza_sau", label: "Senza superficie (SAU)" },
              { value: "senza_colture", label: "Senza colture" },
              { value: "senza_contatti", label: "Senza contatti" },
            ]}
          />
          <Select
            value={ordine}
            onChange={setOrdine}
            size="lg"
            icon={<ArrowDownAZ size={17} />}
            className="min-w-0"
            options={[
              { value: "nome", label: "Per nome" },
              { value: "sau", label: "Per superficie" },
              { value: "eta", label: "Per età" },
              { value: "recenti", label: "Modificate di recente" },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto -mx-1 px-1 pb-1 mb-6">
        <Segmented
          value={filtro}
          onChange={(v) => { setFiltro(v); setLimit(60); }}
          options={[
            { value: "tutte", label: "Tutte", count: counts.tutte },
            { value: "PF", label: "Persone fisiche", count: counts.PF, icon: <User size={14} /> },
            { value: "PG", label: "Società", count: counts.PG, icon: <Building2 size={14} /> },
            { value: "bio", label: "Biologiche", count: counts.bio, icon: <Leaf size={14} /> },
            { value: "iap", label: "IAP / CD", count: counts.iap },
            { value: "uma", label: "Utenti UMA", count: counts.uma, icon: <Tractor size={14} /> },
          ]}
        />
        <div className="flex-1" />
        {filtriAttivi && <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={azzera}>Azzera filtri</Button>}
        {list.length > 0 && <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => esporta()}>Esporta {list.length}</Button>}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[88px] !rounded-2xl" />)}</div>
      ) : list.length === 0 ? (
        <div className="card">
          <Empty
            icon={<Users size={28} />}
            title={aziende.length ? "Nessuna azienda trovata" : "Ancora nessuna azienda"}
            desc={aziende.length ? "Prova a cambiare la ricerca o i filtri." : `L'anagrafica dell'ufficio di ${ufficio.nome} è vuota: caricala da un file Excel, riconosco da solo le colonne.`}
            action={!aziende.length && (
              <div className="flex flex-wrap justify-center gap-3">
                <Button size="lg" icon={<FileSpreadsheet size={18} />} onClick={() => setImporta(true)}>Importa da Excel</Button>
                <Button size="lg" variant="secondary" icon={<Plus size={18} />} onClick={nuovaAzienda}>Inserisci a mano</Button>
              </div>
            )}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3 pl-5">
            <Checkbox checked={list.length > 0 && list.every((a) => sel.has(a.id))} indeterminate={list.some((a) => sel.has(a.id)) && !list.every((a) => sel.has(a.id))}
              onChange={(v) => selezione.imposta(v ? list.map((a) => a.id) : [])} />
            <span className="text-[13px] text-ink-500 font-medium">{list.length} {list.length === 1 ? "azienda" : "aziende"}{sel.size > 0 && <> · <b className="text-brand-800">{sel.size} selezionate</b></>}</span>
          </div>
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {list.slice(0, limit).map((a, i) => (
                <AziendaRow key={a.id} a={a} i={i} onClick={() => apriAzienda(a.id)} domande={domByAz.get(a.id) ?? []} pratiche={pratiche.length} colturaById={colturaById}
                  selected={sel.has(a.id)} onSelect={(v) => selezione.toggle(a.id, v)} />
              ))}
            </AnimatePresence>
          </div>
          {list.length > limit && (
            <div className="flex justify-center mt-6">
              <Button variant="secondary" onClick={() => setLimit((l) => l + 60)}>Mostra altre {Math.min(60, list.length - limit)}</Button>
            </div>
          )}
        </>
      )}
      <CaricamentoIntelligente open={smart} onClose={() => setSmart(false)} />
      <ImportAziende open={importa} onClose={() => setImporta(false)} />
      <BarraAzioni n={selezione.n} nome={selezione.n === 1 ? "selezionata" : "selezionate"} onClear={selezione.svuota} azioni={[
        { label: "Esporta", icon: <Download size={16} />, onClick: () => esporta(selezione.ids) },
        { label: "Imposta", icon: <SlidersHorizontal size={16} />, menu: [
          { label: "Biologica: sì", icon: <Leaf size={15} />, onClick: () => imposta("biologico", true) },
          { label: "Biologica: no", icon: <Leaf size={15} />, onClick: () => imposta("biologico", false) },
          { label: "IAP / CD: sì", icon: <BadgeCheck size={15} />, onClick: () => imposta("iap", true) },
          { label: "IAP / CD: no", icon: <BadgeCheck size={15} />, onClick: () => imposta("iap", false) },
          { label: "Utente UMA: sì", icon: <Tractor size={15} />, onClick: () => imposta("uma", true) },
          { label: "Utente UMA: no", icon: <Tractor size={15} />, onClick: () => imposta("uma", false) },
        ] },
        { label: "Aggiungi a pratica", icon: <ClipboardPlus size={16} />, onClick: () => setVersoPratica(true) },
        { label: "Ufficio", icon: <ArrowRightLeft size={16} />, menu: uffici.filter((u) => u.id !== ufficio.id).flatMap((u) => [
          { label: `Copia a ${u.nome}`, onClick: () => trasferimento(u.id, false) },
          { label: `Sposta a ${u.nome}`, onClick: () => trasferimento(u.id, true) },
        ]) },
        { label: "Elimina", icon: <Trash2 size={16} />, tone: "danger", onClick: () => setConferma(true) },
      ]} />
      <AggiungiAPratica open={versoPratica} ids={selezione.ids} onClose={() => setVersoPratica(false)} onDone={() => { setVersoPratica(false); selezione.svuota(); }} />
      <EliminaAziende open={conferma} ids={selezione.ids} onClose={() => setConferma(false)} onDone={() => { setConferma(false); selezione.svuota(); }} />
    </div>
  );
}

function AziendaRow({ a, i, onClick, domande, colturaById, selected, onSelect }: { a: Azienda; i: number; onClick: () => void; domande: { stato: string; pratica_id: string }[]; pratiche: number; colturaById: Map<string, { nome: string; colore: string }>; selected: boolean; onSelect: (v: boolean) => void }) {
  const e = eta(a.data_nascita);
  const colt = (a.azienda_colture ?? []).slice().sort((x, y) => (y.superficie_ha ?? 0) - (x.superficie_ha ?? 0));
  return (
    <motion.div
      layout="position"
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.025 } }}
      exit={{ opacity: 0 }}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className={clsx("group w-full text-left cursor-pointer rounded-2xl border px-5 py-4 flex items-center gap-4 shadow-soft hover:shadow-card transition-[box-shadow,border-color,background-color] duration-200", selected ? "bg-brand-50/60 border-brand-200" : "bg-white border-ink-100 hover:border-ink-200")}
    >
      <Checkbox checked={selected} onChange={onSelect} className={clsx("transition-opacity", !selected && "opacity-40 group-hover:opacity-100")} />
      <Avatar name={a.denominazione} size={48} square={a.tipo === "PG"} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-[15.5px] tracking-tight truncate">{titleCase(a.denominazione)}</span>
          {a.biologico && <Badge tone="green"><Leaf size={11} /> Bio</Badge>}
          {a.tipo === "PG" && <Badge>Società</Badge>}
        </div>
        <div className="flex items-center gap-x-3 gap-y-1 text-[13px] text-ink-500 mt-1 flex-wrap">
          <span className="font-mono text-[12.5px] tracking-tight text-ink-600">{a.cuaa}</span>
          {a.comune && <><Dot /><span>{a.comune}</span></>}
          {e != null && <><Dot /><span>{e} anni</span></>}
          {a.uma && <><Dot /><span className="inline-flex items-center gap-1"><Tractor size={12} /> UMA</span></>}
        </div>
      </div>
      <div className="hidden md:flex items-center gap-1.5 w-56 justify-end flex-wrap">
        {colt.slice(0, 3).map((c) => {
          const co = colturaById.get(c.coltura_id);
          if (!co) return null;
          return (
            <span key={c.id} className="chip !h-6 !text-[11px] bg-ink-50 text-ink-700">
              <span className="h-2 w-2 rounded-full" style={{ background: co.colore }} />
              {co.nome}
            </span>
          );
        })}
        {colt.length > 3 && <span className="text-[11px] text-ink-400 font-semibold">+{colt.length - 3}</span>}
      </div>
      <div className="hidden sm:block w-24 text-right">
        <div className="text-[15px] font-bold tabular-nums">{ha(a.sau_ha)}</div>
        <div className="text-[11px] text-ink-400 font-medium">SAU</div>
      </div>
      <div className="hidden lg:flex w-20 justify-end gap-1">
        {domande.slice(0, 4).map((d) => (
          <span key={d.pratica_id} className="h-2.5 w-2.5 rounded-full" style={{ background: STATI[d.stato as "R"].color }} title={STATI[d.stato as "R"].label} />
        ))}
      </div>
      <ChevronRight size={20} className={clsx("text-ink-300 transition-all duration-200 group-hover:text-brand-700 group-hover:translate-x-0.5")} />
    </motion.div>
  );
}

const Dot = () => <span className="h-1 w-1 rounded-full bg-ink-300" />;

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-[34px] sm:text-[40px] font-extrabold tracking-[-0.04em] leading-none">{title}</h1>
        {subtitle && <p className="text-ink-500 mt-2.5 text-[15px]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function EliminaAziende({ open, ids, onClose, onDone }: { open: boolean; ids: string[]; onClose: () => void; onDone: () => void }) {
  const { azById, ufficio, uffici } = useUfficio();
  const elimina = useEliminaAziende();
  const { toast } = useFeedback();
  const [ovunque, setOvunque] = useState(false);
  useEffect(() => { if (open) setOvunque(false); }, [open]);
  const nomi = ids.map((id) => azById.get(id)).filter(Boolean) as Azienda[];
  const altri = uffici.filter((u) => u.id !== ufficio.id).map((u) => u.nome).join(" e ");
  const vai = async () => {
    try {
      const n = await elimina.mutateAsync({ ids, cuaaAltriUffici: ovunque ? nomi.map((a) => a.cuaa) : undefined });
      toast("success", `${n} ${n === 1 ? "azienda eliminata" : "aziende eliminate"}`);
      onDone();
    } catch (e) { toast("error", "Eliminazione non riuscita", (e as Error).message); }
  };
  return (
    <Modal open={open} onClose={onClose} size="sm" hideClose
      footer={<><div className="flex-1" /><Button variant="secondary" onClick={onClose}>Annulla</Button><Button variant="danger" loading={elimina.isPending} onClick={vai} icon={<Trash2 size={16} />}>Elimina {ids.length}</Button></>}>
      <div className="pt-7 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-red-50 text-red-600 grid place-items-center mb-4"><Trash2 size={26} /></div>
        <h3 className="text-lg font-bold tracking-tight">Eliminare {ids.length} {ids.length === 1 ? "azienda" : "aziende"}?</h3>
        <p className="text-sm text-ink-500 mt-2">Vengono eliminati anche domande, colture e documenti. L'operazione non si può annullare.</p>
        <div className="mt-4 max-h-36 overflow-y-auto rounded-2xl bg-ink-50 p-3 text-left text-[13px] space-y-0.5">
          {nomi.slice(0, 50).map((a) => <div key={a.id} className="truncate">{titleCase(a.denominazione)} <span className="font-mono text-ink-400 text-[11.5px]">{a.cuaa}</span></div>)}
          {nomi.length > 50 && <div className="text-ink-400">… e altre {nomi.length - 50}</div>}
        </div>
        <div onClick={() => setOvunque((x) => !x)} className={clsx("mt-4 flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer text-left transition-colors", ovunque ? "border-red-200 bg-red-50" : "border-ink-200 hover:border-ink-300")}>
          <Toggle size="sm" checked={ovunque} onChange={setOvunque} />
          <span className="text-[13.5px]"><b>Elimina anche dagli uffici di {altri}</b><span className="block text-ink-500 text-[12px]">Altrimenti solo dall'ufficio di {ufficio.nome}</span></span>
        </div>
      </div>
    </Modal>
  );
}

function AggiungiAPratica({ open, ids, onClose, onDone }: { open: boolean; ids: string[]; onClose: () => void; onDone: () => void }) {
  const { pratiche } = useUfficio();
  const abb = useAbbina();
  const { toast } = useFeedback();
  const [pid, setPid] = useState<string | null>(null);
  useEffect(() => { if (open) setPid(null); }, [open]);
  const vai = async () => {
    if (!pid) return;
    await abb.mutateAsync({ pratica_id: pid, aziende: ids, tipo: "incluso" });
    toast("success", `${ids.length} aziende aggiunte`, pratiche.find((p) => p.id === pid)?.nome);
    onDone();
  };
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Aggiungi a una pratica" subtitle={`${ids.length} aziende entrano nell'elenco delle domande da fare`} icon={<ClipboardPlus size={22} />}
      footer={<><div className="flex-1" /><Button variant="secondary" onClick={onClose}>Annulla</Button><Button disabled={!pid} loading={abb.isPending} onClick={vai}>Aggiungi</Button></>}>
      <Select value={pid} onChange={setPid} placeholder="Scegli la pratica…" searchable options={pratiche.map((p) => ({ value: p.id, label: p.nome, hint: p.codice ?? undefined }))} />
    </Modal>
  );
}
