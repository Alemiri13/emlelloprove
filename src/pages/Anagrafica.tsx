import { AnimatePresence, motion } from "framer-motion";
import { CaricamentoIntelligente } from "../features/CaricamentoIntelligente";
import { ImportAziende } from "../features/import/ImportAziende";
import { FileSpreadsheet, Trash2, X, Sparkles, ArrowDownAZ, Building2, ChevronRight, Leaf, Plus, Tractor, User, Users } from "lucide-react";
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
import { useEliminaAziende } from "../lib/queries";
import { Segmented } from "../components/ui/Segmented";
import { Select } from "../components/ui/Select";
import { Avatar, Badge, Empty } from "../components/ui/Misc";
import { Skeleton } from "../components/ui/Spinner";
import type { Azienda } from "../lib/types";

type Filtro = "tutte" | "PF" | "PG" | "bio" | "iap" | "uma";
type Ordine = "nome" | "sau" | "recenti" | "eta";

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
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [conferma, setConferma] = useState(false);
  useEffect(() => setSel(new Set()), [ufficio.id]);

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
  }, [aziende, q, filtro, ordine, coltura]);

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

      <div className="flex flex-col xl:flex-row gap-3 mb-4">
        <SearchInput value={q} onChange={(v) => { setQ(v); setLimit(60); }} placeholder="Cerca per nome, CUAA o comune…" size="lg" className="flex-1" shortcut />
        <div className="grid grid-cols-2 xl:flex gap-3">
          <Select
            value={coltura}
            onChange={setColtura}
            clearable
            onClear={() => setColtura(null)}
            placeholder="Tutte le colture"
            icon={<Leaf size={17} />}
            size="lg"
            className="min-w-0 xl:w-60"
            options={coltureUsate.map((c) => ({ value: c!.id, label: c!.nome, icon: <span className="h-3 w-3 rounded-full" style={{ background: c!.colore }} /> }))}
          />
          <Select
            value={ordine}
            onChange={setOrdine}
            size="lg"
            icon={<ArrowDownAZ size={17} />}
            className="min-w-0 xl:w-52"
            options={[
              { value: "nome", label: "Per nome" },
              { value: "sau", label: "Per superficie" },
              { value: "eta", label: "Per età" },
              { value: "recenti", label: "Modificate di recente" },
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1 pb-1 mb-6">
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
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[88px] !rounded-2xl" />)}</div>
      ) : list.length === 0 ? (
        <div className="card">
          <Empty
            icon={<Users size={28} />}
            title={aziende.length ? "Nessuna azienda trovata" : "Ancora nessuna azienda"}
            desc={aziende.length ? "Prova a cambiare la ricerca o i filtri." : "Inserisci la prima azienda di questo ufficio."}
            action={!aziende.length && <Button icon={<Plus size={18} />} onClick={nuovaAzienda}>Nuova azienda</Button>}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3 pl-5">
            <Checkbox checked={list.length > 0 && list.every((a) => sel.has(a.id))} indeterminate={list.some((a) => sel.has(a.id)) && !list.every((a) => sel.has(a.id))}
              onChange={(v) => setSel(v ? new Set(list.map((a) => a.id)) : new Set())} />
            <span className="text-[13px] text-ink-500 font-medium">{list.length} {list.length === 1 ? "azienda" : "aziende"}{sel.size > 0 && <> · <b className="text-brand-800">{sel.size} selezionate</b></>}</span>
          </div>
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {list.slice(0, limit).map((a, i) => (
                <AziendaRow key={a.id} a={a} i={i} onClick={() => apriAzienda(a.id)} domande={domByAz.get(a.id) ?? []} pratiche={pratiche.length} colturaById={colturaById}
                  selected={sel.has(a.id)} onSelect={(v) => setSel((x) => { const n = new Set(x); if (v) n.add(a.id); else n.delete(a.id); return n; })} />
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
      <AnimatePresence>
        {sel.size > 0 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 lg:ml-[132px] z-40 bg-ink-900 text-white rounded-[22px] shadow-pop pl-5 pr-2 py-2 flex items-center gap-2">
            <span className="font-bold text-[14px] whitespace-nowrap pr-2">{sel.size} selezionate</span>
            <span className="h-6 w-px bg-white/15" />
            <button onClick={() => setConferma(true)} className="h-11 px-4 rounded-xl text-[13.5px] font-semibold flex items-center gap-2 hover:bg-red-500/20 text-red-300 hover:text-red-200 transition whitespace-nowrap"><Trash2 size={16} /> Elimina</button>
            <button onClick={() => setSel(new Set())} className="h-11 w-11 rounded-xl grid place-items-center hover:bg-white/10 transition" aria-label="Deseleziona"><X size={18} /></button>
          </motion.div>
        )}
      </AnimatePresence>
      <EliminaAziende open={conferma} ids={[...sel]} onClose={() => setConferma(false)} onDone={() => { setConferma(false); setSel(new Set()); }} />
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
