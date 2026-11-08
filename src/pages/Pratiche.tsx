import { motion } from "framer-motion";
import { BadgeCheck, CalendarClock, Check, FileStack, Leaf, Pencil, Plus, Tractor, Trash2, Wallet, X, Droplets, Euro } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useUfficio } from "../lib/ufficio";
import { abbinate, descriviCriteri } from "../lib/domain";
import { daysFromToday, eur, fmtDate, relDays } from "../lib/format";
import { useEliminaPratica, useSalvaPratica } from "../lib/queries";
import { Button } from "../components/ui/Button";
import { ChoiceCard, Field, NumberInput, TextArea, TextInput, Toggle, ToggleCard } from "../components/ui/Inputs";
import { DatePicker } from "../components/ui/DatePicker";
import { Segmented } from "../components/ui/Segmented";
import { Wizard } from "../components/ui/Wizard";
import { Badge, ProgressStati } from "../components/ui/Misc";
import { useFeedback } from "../components/ui/Feedback";
import { PageHeader } from "./Anagrafica";
import type { Criteri, Pratica, StatoDomanda } from "../lib/types";

export function PratichePage() {
  const { pratiche, aziende, abbinamenti, domande, domandaByKey, colturaById, ufficio } = useUfficio();
  const [edit, setEdit] = useState<Pratica | "new" | null>(null);
  const salva = useSalvaPratica();
  const nomiColture = useMemo(() => Object.fromEntries([...colturaById.values()].map((c) => [c.id, c.nome])), [colturaById]);

  return (
    <div>
      <PageHeader
        title="Pratiche e bandi"
        subtitle="Scadenze, requisiti e quote: valgono per tutti e tre gli uffici"
        action={<Button size="lg" icon={<Plus size={19} strokeWidth={2.5} />} onClick={() => setEdit("new")}>Nuova pratica</Button>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pratiche.map((p, i) => {
          const ab = abbinate(aziende, p, abbinamenti, domande);
          const counts: Record<StatoDomanda, number> = { N: 0, C: 0, S: 0, R: 0 };
          for (const id of ab.keys()) counts[domandaByKey.get(id + "|" + p.id)?.stato ?? "N"]++;
          const g = daysFromToday(p.scadenza);
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
              className={clsx("card p-6 flex flex-col", !p.attivo && "opacity-60")}
            >
              <div className="flex items-start gap-4">
                <span className={clsx("h-14 w-14 rounded-2xl grid place-items-center shrink-0 text-[12px] font-extrabold", p.categoria === "bando" ? "bg-amber-50 text-amber-700" : "bg-brand-50 text-brand-800")}>
                  {sigla(p)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={p.categoria === "bando" ? "amber" : "green"}>{p.categoria === "bando" ? "Bando" : "Annuale"}</Badge>
                    {p.esempio && <Badge>Requisiti da verificare</Badge>}
                    {!p.attivo && <Badge tone="red">Non attiva</Badge>}
                  </div>
                  <h3 className="text-[19px] font-extrabold tracking-[-0.02em] mt-1.5 leading-tight">{p.nome}</h3>
                  <div className="text-[13px] text-ink-500 mt-0.5">{[p.ente, p.campagna && `Campagna ${p.campagna}`].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle checked={p.attivo} onChange={(v) => salva.mutate({ id: p.id, attivo: v })} size="sm" />
                  <Button variant="ghost" size="icon-sm" onClick={() => setEdit(p)} aria-label="Modifica"><Pencil size={16} /></Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-5">
                <Stat icon={<CalendarClock size={14} />} label="Scadenza" value={p.scadenza ? fmtDate(p.scadenza) : "—"} sub={g != null ? (g < 0 ? "Chiusa" : relDays(g)) : undefined} alert={g != null && g >= 0 && g <= 15} />
                <Stat icon={<Wallet size={14} />} label="Quota CIA" value={p.quota_default != null ? eur(p.quota_default) : "—"} />
                <Stat icon={p.unita === "litri" ? <Droplets size={14} /> : <Euro size={14} />} label="Misura" value={p.unita === "litri" ? "Litri" : p.ha_contributo ? "Contributo" : "Senza importi"} />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {descriviCriteri(p, nomiColture).map((c) => <span key={c} className="chip bg-ink-50 text-ink-600">{c}</span>)}
              </div>
              <div className="mt-auto pt-5">
                <div className="flex justify-between text-[12.5px] text-ink-500 mb-1.5">
                  <span>{ufficio.nome}: {ab.size} aziende abbinate</span>
                  <span className="font-semibold text-ink-700">{counts.R} rilasciate</span>
                </div>
                <ProgressStati counts={counts} total={ab.size} height={7} />
              </div>
            </motion.div>
          );
        })}
      </div>
      <PraticaEditor value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function Stat({ icon, label, value, sub, alert }: { icon: React.ReactNode; label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className="rounded-2xl bg-ink-50 px-3.5 py-3">
      <div className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider flex items-center gap-1">{icon}{label}</div>
      <div className="font-bold text-[14.5px] mt-1 truncate">{value}</div>
      {sub && <div className={clsx("text-[11.5px]", alert ? "text-red-600 font-semibold" : "text-ink-500")}>{sub}</div>}
    </div>
  );
}

export function sigla(p: { codice: string | null; nome: string }) {
  if (p.codice) return p.codice.replace(/\d{4}$/, "").slice(0, 5).toUpperCase();
  return p.nome.split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "pratica-" + Date.now();
}

function PraticaEditor({ value, onClose }: { value: Pratica | "new" | null; onClose: () => void }) {
  const { colture, pratiche } = useUfficio();
  const salva = useSalvaPratica();
  const elimina = useEliminaPratica();
  const { toast, confirm } = useFeedback();
  const isNew = value === "new";
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Partial<Pratica>>({});
  const [crit, setCrit] = useState<Criteri>({});
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!value) return;
    setStep(0); setMotivo("");
    if (value === "new") {
      setF({ nome: "", codice: "", categoria: "annuale", ente: "", campagna: String(new Date().getFullYear()), unita: "euro", ha_contributo: true, apertura: null, scadenza: null, quota_default: null, motivi_tipici: ["Documentazione incompleta", "Fascicolo aziendale non validato", "Presentata fuori termine"], note: "", attivo: true });
      setCrit({ tipo: "tutti" });
    } else { setF({ ...value }); setCrit({ ...value.criteri }); }
  }, [value]);

  const set = <K extends keyof Pratica>(k: K, v: Pratica[K]) => setF((x) => ({ ...x, [k]: v }));
  const setC = <K extends keyof Criteri>(k: K, v: Criteri[K]) => setCrit((x) => ({ ...x, [k]: v }));

  const finish = async () => {
    const id = isNew ? slugify(f.codice || f.nome || "") : (value as Pratica).id;
    if (isNew && pratiche.some((p) => p.id === id)) return toast("error", "Esiste già una pratica con questo codice");
    try {
      await salva.mutateAsync({
        isNew, id, nome: f.nome!.trim(), codice: f.codice?.trim() || null, categoria: f.categoria, ente: f.ente?.trim() || null, campagna: f.campagna?.trim() || null,
        unita: f.unita, ha_contributo: f.unita === "litri" ? false : f.ha_contributo, apertura: f.apertura ?? null, scadenza: f.scadenza ?? null, quota_default: f.quota_default ?? null,
        motivi_tipici: f.motivi_tipici ?? [], criteri: crit, note: f.note?.trim() || null, attivo: f.attivo ?? true, esempio: isNew ? false : f.esempio,
        ...(isNew ? { ordine: pratiche.length + 1 } : {}),
      });
      toast("success", isNew ? "Pratica creata" : "Pratica aggiornata", f.nome);
      onClose();
    } catch (e) { toast("error", "Errore", (e as Error).message); }
  };

  const del = async () => {
    if (isNew || !value) return;
    if (!(await confirm({ title: `Eliminare «${value.nome}»?`, message: "Verranno eliminate anche tutte le domande collegate, in tutti gli uffici.", danger: true, confirmLabel: "Elimina" }))) return;
    await elimina.mutateAsync(value.id);
    toast("success", "Pratica eliminata");
    onClose();
  };

  if (!value) return <Wizard open={false} onClose={onClose} steps={[]} index={0} setIndex={() => {}} onFinish={() => {}} title="" />;

  return (
    <Wizard
      open={!!value}
      onClose={onClose}
      index={step}
      setIndex={setStep}
      title={isNew ? "Nuova pratica" : `Modifica · ${(value as Pratica).nome}`}
      icon={<FileStack size={20} />}
      onFinish={finish}
      loading={salva.isPending}
      finishLabel={isNew ? "Crea pratica" : "Salva"}
      steps={[
        {
          key: "info", title: "Informazioni", question: "Di che pratica si tratta?", canNext: !!f.nome?.trim(),
          content: (
            <div className="space-y-5">
              <Field label="Nome"><TextInput size="lg" autoFocus value={f.nome ?? ""} onChange={(e) => set("nome", e.target.value)} placeholder="es. Domanda Unica PAC 2027" /></Field>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Codice" optional><TextInput value={f.codice ?? ""} onChange={(e) => set("codice", e.target.value.toUpperCase())} className="font-mono" placeholder="DU2027" /></Field>
                <Field label="Ente" optional><TextInput value={f.ente ?? ""} onChange={(e) => set("ente", e.target.value)} placeholder="AGEA" /></Field>
                <Field label="Campagna" optional><TextInput value={f.campagna ?? ""} onChange={(e) => set("campagna", e.target.value)} inputMode="numeric" /></Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <ChoiceCard selected={f.categoria === "annuale"} onClick={() => set("categoria", "annuale")} icon={<CalendarClock size={20} />} title="Pratica annuale" desc="Si ripete ogni anno" />
                <ChoiceCard selected={f.categoria === "bando"} onClick={() => set("categoria", "bando")} icon={<FileStack size={20} />} title="Bando" desc="Con apertura e chiusura" />
              </div>
              <div>
                <span className="label">Cosa si misura</span>
                <Segmented
                  full
                  size="lg"
                  value={f.unita === "litri" ? "litri" : f.ha_contributo ? "euro" : "nessuno"}
                  onChange={(v) => { if (v === "litri") { set("unita", "litri"); set("ha_contributo", false); } else { set("unita", "euro"); set("ha_contributo", v === "euro"); } }}
                  options={[{ value: "euro", label: "Contributo in €", icon: <Euro size={15} /> }, { value: "litri", label: "Litri (UMA)", icon: <Droplets size={15} /> }, { value: "nessuno", label: "Nessun importo" }]}
                />
              </div>
            </div>
          ),
        },
        {
          key: "date", title: "Scadenze", question: "Quando e quanto?", hint: "La quota servizio CIA viene proposta in automatico quando una domanda viene rilasciata.",
          content: (
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Apertura" optional><DatePicker value={f.apertura} onChange={(v) => set("apertura", v)} /></Field>
              <Field label="Scadenza" optional><DatePicker value={f.scadenza} onChange={(v) => set("scadenza", v)} /></Field>
              <Field label="Quota servizio CIA" optional><NumberInput value={f.quota_default} onChange={(v) => set("quota_default", v)} suffix="€" /></Field>
              <Field label="Note" className="sm:col-span-2" optional><TextArea value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} className="!min-h-[80px]" /></Field>
            </div>
          ),
        },
        {
          key: "req", title: "Requisiti", question: "Quali aziende possono partecipare?", hint: "Le aziende che rispettano i requisiti vengono abbinate in automatico.",
          content: (
            <div className="space-y-5">
              <div>
                <span className="label">Tipo di soggetto</span>
                <Segmented full size="lg" value={crit.tipo ?? "tutti"} onChange={(v) => setC("tipo", v)} options={[{ value: "tutti", label: "Tutti" }, { value: "PF", label: "Persone fisiche" }, { value: "PG", label: "Società ed enti" }]} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Età minima" optional><NumberInput value={crit.etaMin ?? null} onChange={(v) => setC("etaMin", v == null ? null : Math.round(v))} suffix="anni" decimals={0} /></Field>
                <Field label="Età massima" optional hint="«41 non compiuti» = 40"><NumberInput value={crit.etaMax ?? null} onChange={(v) => setC("etaMax", v == null ? null : Math.round(v))} suffix="anni" decimals={0} /></Field>
                <Field label="SAU minima" optional><NumberInput value={crit.sauMin ?? null} onChange={(v) => setC("sauMin", v)} suffix="ha" /></Field>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <ToggleCard checked={!!crit.biologico} onChange={(v) => setC("biologico", v)} icon={<Leaf size={20} />} title="Biologiche" />
                <ToggleCard checked={!!crit.iap} onChange={(v) => setC("iap", v)} icon={<BadgeCheck size={20} />} title="IAP / CD" />
                <ToggleCard checked={!!crit.uma} onChange={(v) => setC("uma", v)} icon={<Tractor size={20} />} title="Utenti UMA" />
              </div>
              <div>
                <span className="label">Colture (almeno una)</span>
                <div className="flex flex-wrap gap-2">
                  {colture.map((c) => {
                    const on = crit.colture?.includes(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => setC("colture", on ? (crit.colture ?? []).filter((x) => x !== c.id) : [...(crit.colture ?? []), c.id])}
                        className={clsx("h-10 pl-2.5 pr-3.5 rounded-xl border-2 text-[13px] font-semibold flex items-center gap-2 transition-colors", on ? "" : "border-ink-100 text-ink-600 hover:border-ink-200")}
                        style={on ? { borderColor: c.colore, background: c.colore + "14" } : undefined}>
                        <span className="h-4 w-4 rounded-full grid place-items-center" style={{ background: on ? c.colore : c.colore + "33" }}>{on && <Check size={10} className="text-white" strokeWidth={3} />}</span>
                        {c.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ),
        },
        {
          key: "motivi", title: "Motivi", question: "Motivi tipici di non ammissione", hint: "Saranno proposti con un tocco quando una domanda viene respinta.",
          content: (
            <div>
              <div className="flex flex-wrap gap-2">
                {(f.motivi_tipici ?? []).map((m) => (
                  <span key={m} className="h-10 pl-3.5 pr-1.5 rounded-xl bg-ink-50 ring-1 ring-inset ring-ink-100 text-[13px] font-semibold flex items-center gap-1.5">
                    {m}
                    <button type="button" onClick={() => set("motivi_tipici", (f.motivi_tipici ?? []).filter((x) => x !== m))} className="h-7 w-7 grid place-items-center rounded-lg text-ink-400 hover:bg-white hover:text-red-600"><X size={14} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <TextInput value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Aggiungi un motivo…" className="flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter" && motivo.trim()) { e.preventDefault(); set("motivi_tipici", [...(f.motivi_tipici ?? []), motivo.trim()]); setMotivo(""); } }} />
                <Button variant="secondary" className="!h-12" icon={<Plus size={16} />} disabled={!motivo.trim()} onClick={() => { set("motivi_tipici", [...(f.motivi_tipici ?? []), motivo.trim()]); setMotivo(""); }}>Aggiungi</Button>
              </div>
              {!isNew && (
                <div className="mt-10 pt-6 border-t border-ink-100">
                  <Button variant="ghost" className="!text-red-600 hover:!bg-red-50" icon={<Trash2 size={16} />} onClick={del}>Elimina pratica</Button>
                </div>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
