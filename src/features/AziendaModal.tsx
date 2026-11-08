import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles, Building2, CalendarDays, Copy, FileText, History, Leaf, Mail, MapPin, Pencil, Phone, Plus, Sprout, Tractor, Trash2, User, BadgeCheck, ClipboardList, ArrowRightLeft, Download, ChevronRight, Ban, Link2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useModals, useUfficio } from "../lib/ufficio";
import { eta } from "../lib/cf";
import { eur, fileSize, fmtDate, fmtDateLong, fmtDateTime, ha, litri, relDays, daysFromToday, titleCase } from "../lib/format";
import { abbinate, CATEGORIE_DOC, KIT, statoDocumento } from "../lib/domain";
import {
  apriDocumento, useAbbina, useDocumenti, useEliminaAzienda, useEliminaDocumento, useRimuoviColturaAzienda, useSalvaAzienda, useSalvaColturaAzienda, useStorico, type AziendaInput,
} from "../lib/queries";
import { Modal } from "../components/ui/Modal";
import { Avatar, Badge, Empty, EsitoPill, InfoRow, SectionTitle, StatoPill, Tabs } from "../components/ui/Misc";
import { Button } from "../components/ui/Button";
import { CheckIcon, Field, NumberInput, TextArea, TextInput, ToggleCard } from "../components/ui/Inputs";
import { Select } from "../components/ui/Select";
import { DatePicker } from "../components/ui/DatePicker";
import { useFeedback } from "../components/ui/Feedback";
import { Skeleton } from "../components/ui/Spinner";
import { DocumentoModal } from "./DocumentoModal";
import { CaricamentoIntelligente } from "./CaricamentoIntelligente";
import { DocumentoPreview } from "./DocumentoPreview";
import type { Azienda, Documento } from "../lib/types";

type Tab = "scheda" | "colture" | "domande" | "documenti" | "storico";

export function AziendaModal({ state, onClose }: { state: { id: string; tab?: string } | null; onClose: () => void }) {
  const { azById } = useUfficio();
  const [tab, setTab] = useState<Tab>("scheda");
  const [editing, setEditing] = useState(false);
  const a = state ? azById.get(state.id) : undefined;
  const [last, setLast] = useState<Azienda | undefined>(a);
  useEffect(() => { if (a) setLast(a); }, [a]);
  useEffect(() => { if (state) { setTab((state.tab as Tab) ?? "scheda"); setEditing(false); } }, [state]);
  const az = a ?? last;
  const docs = useDocumenti(state?.id);

  return (
    <Modal open={!!state && !!az} onClose={onClose} size="xl" hideClose className="sm:h-[86vh]" bodyClassName="!px-0 !pb-0 flex flex-col">
      {az && (
        <>
          <Header a={az} onClose={onClose} onEdit={() => { setTab("scheda"); setEditing(true); }} editing={editing} />
          <div className="px-8">
            <Tabs
              value={tab}
              onChange={(t) => { setTab(t); setEditing(false); }}
              tabs={[
                { value: "scheda", label: "Scheda", icon: <User size={16} /> },
                { value: "colture", label: "Colture", icon: <Sprout size={16} />, count: az.azienda_colture?.length },
                { value: "domande", label: "Domande", icon: <ClipboardList size={16} /> },
                { value: "documenti", label: "Documenti", icon: <FileText size={16} />, count: docs.data?.length },
                { value: "storico", label: "Storico", icon: <History size={16} /> },
              ]}
            />
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-7 bg-ink-50/50">
            <AnimatePresence mode="wait">
              <motion.div key={tab + (editing ? "-e" : "")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                {tab === "scheda" && (editing ? <SchedaEdit a={az} onDone={() => setEditing(false)} onDeleted={onClose} /> : <Scheda a={az} />)}
                {tab === "colture" && <ColtureTab a={az} />}
                {tab === "domande" && <DomandeTab a={az} />}
                {tab === "documenti" && <DocumentiTab a={az} docs={docs.data} loading={docs.isLoading} />}
                {tab === "storico" && <StoricoTab id={az.id} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}
    </Modal>
  );
}

function Header({ a, onClose, onEdit, editing }: { a: Azienda; onClose: () => void; onEdit: () => void; editing: boolean }) {
  const { toast } = useFeedback();
  const e = eta(a.data_nascita);
  return (
    <div className="px-8 pt-7 pb-5 flex items-start gap-5">
      <Avatar name={a.denominazione} size={64} square={a.tipo === "PG"} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={a.tipo === "PG" ? "blue" : "neutral"}>{a.tipo === "PG" ? <><Building2 size={11} /> Società / ente</> : <><User size={11} /> Persona fisica</>}</Badge>
          {a.biologico && <Badge tone="green"><Leaf size={11} /> Biologica</Badge>}
          {a.iap && <Badge tone="green">IAP / CD</Badge>}
          {a.uma && <Badge tone="amber"><Tractor size={11} /> UMA</Badge>}
        </div>
        <h2 className="mt-2 text-[26px] font-extrabold tracking-[-0.03em] leading-tight">{titleCase(a.denominazione)}</h2>
        <div className="mt-1.5 flex items-center gap-x-4 gap-y-1 flex-wrap text-[14px] text-ink-500">
          <button
            onClick={() => { navigator.clipboard?.writeText(a.cuaa); toast("success", "CUAA copiato"); }}
            className="group inline-flex items-center gap-1.5 font-mono text-ink-700 hover:text-brand-800 transition-colors"
            title="Copia CUAA"
          >
            {a.cuaa} <Copy size={13} className="opacity-50 group-hover:opacity-100" />
          </button>
          {e != null && <span>{e} anni · {a.sesso === "F" ? "donna" : "uomo"}</span>}
          {a.comune && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {a.comune}</span>}
          {a.sau_ha != null && <span>{ha(a.sau_ha)} di SAU</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!editing && <Button variant="secondary" icon={<Pencil size={16} />} onClick={onEdit}>Modifica</Button>}
        <button onClick={onClose} className="h-11 w-11 grid place-items-center rounded-full text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition" aria-label="Chiudi">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

function Scheda({ a }: { a: Azienda }) {
  const { colturaById } = useUfficio();
  return (
    <div className="grid md:grid-cols-2 gap-5">
      <div className="card p-6">
        <SectionTitle>Anagrafica</SectionTitle>
        <InfoRow label="Denominazione">{titleCase(a.denominazione)}</InfoRow>
        <InfoRow label="CUAA" mono>{a.cuaa}</InfoRow>
        {a.tipo === "PF" && <InfoRow label="Data di nascita">{a.data_nascita ? `${fmtDateLong(a.data_nascita)} (${eta(a.data_nascita)} anni)` : null}</InfoRow>}
        <InfoRow label="Comune">{a.comune}</InfoRow>
        <InfoRow label="Indirizzo">{[a.indirizzo, a.cap].filter(Boolean).join(" · ")}</InfoRow>
      </div>
      <div className="card p-6">
        <SectionTitle>Contatti</SectionTitle>
        <InfoRow label="Telefono">{a.telefono && <a className="text-brand-800 hover:underline inline-flex items-center gap-1.5" href={`tel:${a.telefono}`}><Phone size={13} />{a.telefono}</a>}</InfoRow>
        <InfoRow label="Email">{a.email && <a className="text-brand-800 hover:underline inline-flex items-center gap-1.5" href={`mailto:${a.email}`}><Mail size={13} />{a.email}</a>}</InfoRow>
        <InfoRow label="PEC">{a.pec}</InfoRow>
        <InfoRow label="IBAN" mono>{a.iban}</InfoRow>
      </div>
      <div className="card p-6">
        <SectionTitle>Terreni e requisiti</SectionTitle>
        <InfoRow label="Superficie agricola (SAU)">{ha(a.sau_ha)}</InfoRow>
        <InfoRow label="Biologica"><CheckIcon ok={a.biologico} /></InfoRow>
        <InfoRow label="IAP / Coltivatore diretto"><CheckIcon ok={a.iap} /></InfoRow>
        <InfoRow label="Utente UMA"><CheckIcon ok={a.uma} /></InfoRow>
      </div>
      <div className="card p-6">
        <SectionTitle>Colture</SectionTitle>
        {(a.azienda_colture ?? []).length === 0 && <div className="text-sm text-ink-400 py-3">Nessuna coltura indicata</div>}
        <div className="flex flex-wrap gap-2">
          {(a.azienda_colture ?? []).map((c) => {
            const co = colturaById.get(c.coltura_id);
            return co ? (
              <span key={c.id} className="chip !h-8 bg-ink-50 text-ink-800 ring-1 ring-inset ring-ink-100">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: co.colore }} />{co.nome}
                {c.superficie_ha != null && <span className="text-ink-400 font-medium">{ha(c.superficie_ha)}</span>}
              </span>
            ) : null;
          })}
        </div>
        {a.note && (<><div className="mt-5"><SectionTitle>Note</SectionTitle></div><p className="text-sm text-ink-700 whitespace-pre-wrap">{a.note}</p></>)}
      </div>
    </div>
  );
}

function SchedaEdit({ a, onDone, onDeleted }: { a: Azienda; onDone: () => void; onDeleted: () => void }) {
  const { uffici } = useUfficio();
  const salva = useSalvaAzienda();
  const elimina = useEliminaAzienda();
  const { toast, confirm } = useFeedback();
  const [f, setF] = useState<AziendaInput>({
    denominazione: a.denominazione, comune: a.comune, indirizzo: a.indirizzo, cap: a.cap, telefono: a.telefono, email: a.email, pec: a.pec,
    iban: a.iban, sau_ha: a.sau_ha, biologico: a.biologico, iap: a.iap, uma: a.uma, note: a.note, data_nascita: a.data_nascita, ufficio_id: a.ufficio_id,
  });
  const set = <K extends keyof AziendaInput>(k: K, v: AziendaInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const txt = (k: keyof AziendaInput) => ({ value: (f[k] as string) ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never) });

  const save = async () => {
    if (!f.denominazione?.trim()) return toast("error", "La denominazione è obbligatoria");
    const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === "string" ? (v.trim() || null) : v])) as AziendaInput;
    clean.denominazione = f.denominazione.trim().toUpperCase();
    try {
      await salva.mutateAsync({ id: a.id, data: clean });
      toast("success", "Scheda aggiornata", f.ufficio_id !== a.ufficio_id ? `Spostata nell'ufficio di ${uffici.find((u) => u.id === f.ufficio_id)?.nome}` : undefined);
      if (f.ufficio_id !== a.ufficio_id) onDeleted(); else onDone();
    } catch (e) { toast("error", "Salvataggio non riuscito", (e as Error).message); }
  };
  const del = async () => {
    const ok = await confirm({ title: "Eliminare l'azienda?", message: <>Verranno eliminate anche domande, colture e documenti di <b>{titleCase(a.denominazione)}</b>. L'operazione non si può annullare.</>, confirmLabel: "Elimina", danger: true });
    if (!ok) return;
    try { await elimina.mutateAsync(a.id); toast("success", "Azienda eliminata"); onDeleted(); } catch (e) { toast("error", "Errore", (e as Error).message); }
  };

  return (
    <div className="space-y-5">
      <div className="card p-6 grid md:grid-cols-2 gap-5">
        <Field label="Denominazione" className="md:col-span-2"><TextInput {...txt("denominazione")} /></Field>
        {a.tipo === "PF" && <Field label="Data di nascita"><DatePicker value={f.data_nascita} onChange={(v) => set("data_nascita", v)} /></Field>}
        <Field label="Comune"><TextInput {...txt("comune")} icon={<MapPin size={16} />} /></Field>
        <Field label="Indirizzo"><TextInput {...txt("indirizzo")} /></Field>
        <Field label="CAP"><TextInput {...txt("cap")} inputMode="numeric" maxLength={5} /></Field>
      </div>
      <div className="card p-6 grid md:grid-cols-2 gap-5">
        <Field label="Telefono"><TextInput {...txt("telefono")} icon={<Phone size={16} />} inputMode="tel" /></Field>
        <Field label="Email"><TextInput {...txt("email")} icon={<Mail size={16} />} type="email" /></Field>
        <Field label="PEC"><TextInput {...txt("pec")} /></Field>
        <Field label="IBAN"><TextInput {...txt("iban")} className="font-mono" /></Field>
      </div>
      <div className="card p-6 space-y-4">
        <Field label="Superficie agricola utilizzata (SAU)" className="max-w-xs"><NumberInput value={f.sau_ha} onChange={(v) => set("sau_ha", v)} suffix="ha" /></Field>
        <div className="grid md:grid-cols-3 gap-3">
          <ToggleCard checked={!!f.biologico} onChange={(v) => set("biologico", v)} icon={<Leaf size={20} />} title="Biologica" />
          <ToggleCard checked={!!f.iap} onChange={(v) => set("iap", v)} icon={<BadgeCheck size={20} />} title="IAP / CD" />
          <ToggleCard checked={!!f.uma} onChange={(v) => set("uma", v)} icon={<Tractor size={20} />} title="Utente UMA" />
        </div>
        <Field label="Note"><TextArea value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} placeholder="Annotazioni sull'azienda…" /></Field>
      </div>
      <div className="card p-6">
        <Field label="Ufficio di riferimento" hint="Sposta l'azienda in un altro ufficio: domande e documenti la seguono." className="max-w-sm">
          <Select value={f.ufficio_id} onChange={(v) => set("ufficio_id", v)} icon={<ArrowRightLeft size={16} />} options={uffici.map((u) => ({ value: u.id, label: u.nome }))} />
        </Field>
      </div>
      <div className="flex items-center gap-3 sticky bottom-0 -mx-8 px-8 -mb-7 py-4 bg-white/90 backdrop-blur-md border-t border-ink-100">
        <Button variant="ghost" className="!text-red-600 hover:!bg-red-50" icon={<Trash2 size={16} />} onClick={del} loading={elimina.isPending}>Elimina azienda</Button>
        <div className="flex-1" />
        <Button variant="secondary" size="lg" onClick={onDone}>Annulla</Button>
        <Button size="lg" onClick={save} loading={salva.isPending}>Salva modifiche</Button>
      </div>
    </div>
  );
}

function ColtureTab({ a }: { a: Azienda }) {
  const { colture, colturaById } = useUfficio();
  const salva = useSalvaColturaAzienda();
  const rimuovi = useRimuoviColturaAzienda();
  const { toast } = useFeedback();
  const [nuova, setNuova] = useState<string | null>(null);
  const [sup, setSup] = useState<number | null>(null);
  const list = (a.azienda_colture ?? []).slice().sort((x, y) => (y.superficie_ha ?? 0) - (x.superficie_ha ?? 0));
  const tot = list.reduce((s, c) => s + (c.superficie_ha ?? 0), 0);
  const used = new Set(list.map((c) => c.coltura_id));
  const pct = a.sau_ha ? Math.min(100, (tot / a.sau_ha) * 100) : 0;

  const add = async () => {
    if (!nuova) return;
    try { await salva.mutateAsync({ azienda_id: a.id, coltura_id: nuova, superficie_ha: sup }); setNuova(null); setSup(null); toast("success", "Coltura aggiunta"); }
    catch (e) { toast("error", "Errore", (e as Error).message); }
  };

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-[13px] text-ink-500 font-medium">Superficie coltivata</div>
            <div className="text-2xl font-extrabold tracking-tight tabular-nums">{ha(tot)} <span className="text-ink-400 text-base font-semibold">su {ha(a.sau_ha)} di SAU</span></div>
          </div>
          {a.sau_ha != null && tot > a.sau_ha + 0.01 && <Badge tone="amber">Superiore alla SAU</Badge>}
        </div>
        <div className="h-3 rounded-full bg-ink-100 overflow-hidden flex">
          {list.map((c) => {
            const co = colturaById.get(c.coltura_id);
            const w = a.sau_ha ? ((c.superficie_ha ?? 0) / Math.max(a.sau_ha, tot)) * 100 : 0;
            return <motion.div key={c.id} title={co?.nome} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.6 }} style={{ background: co?.colore }} className="h-full first:rounded-l-full" />;
          })}
        </div>
        <div className="text-xs text-ink-400 mt-2">{Math.round(pct)}% della SAU assegnata a colture</div>
      </div>

      <div className="card divide-y divide-ink-100">
        {list.length === 0 && <Empty icon={<Sprout size={26} />} title="Nessuna coltura" desc="Aggiungi le colture praticate dall'azienda." />}
        {list.map((c) => {
          const co = colturaById.get(c.coltura_id);
          return (
            <div key={c.id} className="flex items-center gap-4 px-6 py-4">
              <span className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: (co?.colore ?? "#5BB44A") + "1F", color: co?.colore }}><Sprout size={19} /></span>
              <div className="flex-1">
                <div className="font-bold">{co?.nome}</div>
                <div className="text-xs text-ink-500">{co?.categoria}</div>
              </div>
              <SupField value={c.superficie_ha} onSave={(v) => salva.mutate({ azienda_id: a.id, coltura_id: c.coltura_id, superficie_ha: v }, { onSuccess: () => toast("success", "Superficie aggiornata") })} />
              <button onClick={() => rimuovi.mutate(c.id)} className="h-10 w-10 grid place-items-center rounded-xl text-ink-400 hover:text-red-600 hover:bg-red-50 transition" aria-label="Rimuovi"><Trash2 size={17} /></button>
            </div>
          );
        })}
      </div>

      <div className="card p-6">
        <SectionTitle>Aggiungi una coltura</SectionTitle>
        <div className="flex flex-col md:flex-row gap-3">
          <Select
            value={nuova}
            onChange={setNuova}
            placeholder="Scegli la coltura…"
            searchable
            className="flex-1"
            options={colture.filter((c) => !used.has(c.id)).map((c) => ({ value: c.id, label: c.nome, hint: c.categoria, group: c.categoria, icon: <span className="h-3 w-3 rounded-full" style={{ background: c.colore }} /> })).sort((x, y) => x.group.localeCompare(y.group))}
          />
          <div className="md:w-44"><NumberInput value={sup} onChange={setSup} suffix="ha" placeholder="Superficie" /></div>
          <Button size="lg" className="!h-12" icon={<Plus size={18} />} onClick={add} disabled={!nuova} loading={salva.isPending}>Aggiungi</Button>
        </div>
      </div>
    </div>
  );
}

/** Superficie modificabile: salva quando si esce dal campo. */
function SupField({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="w-40" onBlur={() => { if (v !== value) onSave(v); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}>
      <NumberInput value={v} onChange={setV} suffix="ha" />
    </div>
  );
}

function DomandeTab({ a }: { a: Azienda }) {
  const { pratiche, abbinamenti, domande, domandaByKey } = useUfficio();
  const { apriDomanda } = useModals();
  const abb = useAbbina();
  const { toast } = useFeedback();
  const rows = useMemo(() => pratiche.filter((p) => p.attivo).map((p) => {
    const m = abbinate([a], p, abbinamenti, domande).get(a.id);
    const escl = abbinamenti.some((x) => x.pratica_id === p.id && x.azienda_id === a.id && x.tipo === "escluso");
    return { p, motivo: m, escluso: escl, d: domandaByKey.get(a.id + "|" + p.id) };
  }), [a, pratiche, abbinamenti, domande, domandaByKey]);

  return (
    <div className="space-y-3">
      {rows.map(({ p, motivo, escluso, d }) => {
        const giorni = daysFromToday(p.scadenza);
        return (
          <div key={p.id} className={clsx("card p-5 flex items-center gap-4 transition", !motivo && "opacity-70")}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[15.5px] tracking-tight">{p.nome}</span>
                {p.codice && <span className="text-xs font-mono text-ink-400">{p.codice}</span>}
              </div>
              <div className="text-[13px] text-ink-500 mt-1 flex gap-3 flex-wrap">
                {p.scadenza && <span className={clsx(giorni != null && giorni >= 0 && giorni <= 15 && "text-red-600 font-semibold")}>Scadenza {fmtDate(p.scadenza)}{giorni != null && giorni >= 0 ? ` · ${relDays(giorni)}` : ""}</span>}
                {d?.numero && <span>N. {d.numero}</span>}
                {d && p.unita === "litri" && d.litri_assegnati != null && <span>{litri(d.litri_assegnati)}</span>}
                {!motivo && <span>{escluso ? "Esclusa manualmente" : "Non rientra nei requisiti"}</span>}
                {motivo === "incluso" && !d && <span>Aggiunta manualmente</span>}
              </div>
            </div>
            {motivo ? (
              <>
                {d?.stato === "R" && <EsitoPill esito={d.esito} />}
                <StatoPill stato={d?.stato ?? "N"} />
                {motivo === "criteri" && !d && (
                  <button title="Escludi da questa pratica" onClick={async () => { await abb.mutateAsync({ pratica_id: p.id, aziende: [a.id], tipo: "escluso" }); toast("info", "Esclusa dalla pratica"); }} className="h-10 w-10 grid place-items-center rounded-xl text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"><Ban size={17} /></button>
                )}
                <Button variant="soft" size="sm" iconRight={<ChevronRight size={16} />} onClick={() => apriDomanda(a.id, p.id)}>{d ? "Apri" : "Avvia"}</Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" icon={<Link2 size={15} />} onClick={async () => { await abb.mutateAsync({ pratica_id: p.id, aziende: [a.id], tipo: "incluso" }); toast("success", "Azienda abbinata alla pratica"); }}>Abbina</Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DocumentiTab({ a, docs, loading }: { a: Azienda; docs?: Documento[]; loading: boolean }) {
  const [upload, setUpload] = useState(false);
  const [smart, setSmart] = useState(false);
  const [preview, setPreview] = useState<Documento | null>(null);
  const elimina = useEliminaDocumento();
  const { toast, confirm } = useFeedback();
  const kit = KIT.filter((k) => !k.soloPG || a.tipo === "PG").map((k) => ({ ...k, ok: (docs ?? []).some(k.t) }));
  const okCount = kit.filter((k) => k.ok).length;

  return (
    <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-5 items-start">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <SectionTitle className="!mb-0">Kit documentale</SectionTitle>
          <span className="text-sm font-bold tabular-nums text-brand-800">{okCount}/{kit.length}</span>
        </div>
        <div className="h-2 rounded-full bg-ink-100 overflow-hidden my-4">
          <motion.div className="h-full bg-brand-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${(okCount / kit.length) * 100}%` }} transition={{ duration: 0.6 }} />
        </div>
        <ul className="space-y-2.5">
          {kit.map((k) => (
            <li key={k.l} className="flex items-center gap-3 text-[14px]">
              <CheckIcon ok={k.ok} />
              <span className={k.ok ? "text-ink-800 font-medium" : "text-ink-500"}>{k.l}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle className="!mb-0">Archivio</SectionTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setUpload(true)}>Senza file</Button>
            <Button icon={<Sparkles size={16} />} onClick={() => setSmart(true)}>Carica documenti</Button>
          </div>
        </div>
        {loading ? <Skeleton className="h-40 !rounded-2xl" /> : !docs?.length ? (
          <div className="card"><Empty icon={<FileText size={26} />} title="Nessun documento" desc="Carica documenti d'identità, titoli di conduzione, visure e altro." action={<Button variant="soft" icon={<Sparkles size={16} />} onClick={() => setSmart(true)}>Carica e riconosci</Button>} /></div>
        ) : (
          <div className="card divide-y divide-ink-100">
            {docs.map((d) => {
              const st = statoDocumento(d);
              const cat = CATEGORIE_DOC.find((c) => c.k === d.categoria);
              return (
                <div key={d.id} onClick={() => setPreview(d)} className="flex items-center gap-4 px-5 py-4 group cursor-pointer hover:bg-ink-50/70 transition-colors">
                  <span className="h-11 w-11 rounded-xl bg-brand-50 text-brand-800 grid place-items-center shrink-0 group-hover:bg-brand-700 group-hover:text-white transition-colors"><FileText size={20} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate group-hover:text-brand-900">{d.titolo}</div>
                    <div className="text-xs text-ink-500 flex gap-2 flex-wrap mt-0.5">
                      <span>{d.tipo}</span>
                      {cat && <span className="text-ink-300">·</span>}
                      {cat && <span>{cat.l}</span>}
                      {d.data_doc && <><span className="text-ink-300">·</span><span>{fmtDate(d.data_doc)}</span></>}
                      {d.size ? <><span className="text-ink-300">·</span><span>{fileSize(d.size)}</span></> : null}
                      {d.foglio && <><span className="text-ink-300">·</span><span>Fg. {d.foglio}{d.particelle ? ` p.lle ${d.particelle}` : ""}</span></>}
                      {d.importo != null && <><span className="text-ink-300">·</span><span>{eur(d.importo, 2)}</span></>}
                      {d.analisi && !d.analisi.corretto && <><span className="text-ink-300">·</span><span className="inline-flex items-center gap-1 text-brand-700 font-semibold"><Sparkles size={11} />riconosciuto {Math.round(d.analisi.confidenza * 100)}%</span></>}
                    </div>
                  </div>
                  {d.scadenza && (
                    <Badge tone={st === "scaduto" ? "red" : st === "in_scadenza" ? "amber" : "neutral"}>
                      <CalendarDays size={11} /> {st === "scaduto" ? "Scaduto" : "Scade"} {fmtDate(d.scadenza)}
                    </Badge>
                  )}
                  {d.storage_path && (
                    <button onClick={(e) => { e.stopPropagation(); apriDocumento(d).catch((err) => toast("error", "Impossibile aprire", err.message)); }} className="h-10 w-10 grid place-items-center rounded-xl text-ink-500 hover:text-brand-800 hover:bg-brand-50 transition" title="Apri in una nuova scheda"><Download size={17} /></button>
                  )}
                  <button
                    onClick={async (e) => { e.stopPropagation(); if (await confirm({ title: "Eliminare il documento?", message: d.titolo, danger: true, confirmLabel: "Elimina" })) elimina.mutate(d); }}
                    className="h-10 w-10 grid place-items-center rounded-xl text-ink-400 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                    title="Elimina"
                  ><Trash2 size={17} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <DocumentoModal open={upload} onClose={() => setUpload(false)} azienda={a} />
      <CaricamentoIntelligente open={smart} onClose={() => setSmart(false)} aziendaId={a.id} />
      <DocumentoPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function StoricoTab({ id }: { id: string }) {
  const { data, isLoading } = useStorico(id);
  if (isLoading) return <Skeleton className="h-48 !rounded-2xl" />;
  if (!data?.length) return <div className="card"><Empty icon={<History size={26} />} title="Nessuna attività" /></div>;
  return (
    <div className="card p-6">
      <ol className="relative">
        {data.map((s, i) => (
          <motion.li key={s.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className="relative pl-8 pb-6 last:pb-0">
            {i < data.length - 1 && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-ink-200" />}
            <span className={clsx("absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-[3px] border-white ring-1", i === 0 ? "bg-brand-500 ring-brand-200" : "bg-ink-300 ring-ink-200")} />
            <div className="text-[14.5px] font-semibold text-ink-900">{s.testo}</div>
            <div className="text-xs text-ink-500 mt-0.5">{fmtDateTime(s.created_at)} · <span className="capitalize">{s.utente ?? "sistema"}</span></div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
