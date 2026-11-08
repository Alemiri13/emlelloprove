import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, CircleDashed, CircleDot, ClipboardList, FileSpreadsheet, Hourglass, PenLine, Plus, Printer, Send, Sparkles, Trash2, UserRound, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Field, TextArea, TextInput } from "../../components/ui/Inputs";
import { DatePicker } from "../../components/ui/DatePicker";
import { useFeedback } from "../../components/ui/Feedback";
import { ESITI, STATI } from "../../lib/domain";
import { fmtDate, titleCase } from "../../lib/format";
import { useEliminaVoci, useSalvaVoce } from "../../lib/queries";
import { chiaveCuaa } from "../../lib/riscontro";
import { useModals, useUfficio } from "../../lib/ufficio";
import type { Esito, StatoDomanda } from "../../lib/types";

const STATO_ICON: Record<StatoDomanda, ReactNode> = { N: <CircleDashed size={20} />, C: <PenLine size={20} />, S: <Printer size={20} />, R: <Send size={20} /> };
const ESITO_ICON: Record<Esito, ReactNode> = { I: <Hourglass size={18} />, A: <CheckCircle2 size={18} />, P: <CircleDot size={18} />, X: <XCircle size={18} /> };

interface Form {
  denominazione: string; cuaa: string; stato_manuale: StatoDomanda | null; numero: string | null; data_presentazione: string | null;
  esito: Esito | null; motivi: string[]; riesame: string | null; note: string | null;
}

/** Scheda di una riga dell'elenco «domande da fare» di una pratica. Non tocca l'anagrafica. */
export function VoceModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { voci, riscontri, praticaById, aziende, ufficio } = useUfficio();
  const { apriAzienda } = useModals();
  const salva = useSalvaVoce();
  const elimina = useEliminaVoci();
  const { toast, confirm } = useFeedback();
  const [cache, setCache] = useState(id);
  useEffect(() => { if (id) setCache(id); }, [id]);
  const vid = id ?? cache;
  const voce = voci.find((v) => v.id === vid);
  const p = voce ? praticaById.get(voce.pratica_id) : undefined;
  const r = voce ? riscontri.get(voce.pratica_id)?.voci.find((x) => x.voce.id === voce.id) : undefined;
  const azienda = useMemo(() => {
    const c = chiaveCuaa(voce?.cuaa);
    return c ? aziende.find((a) => chiaveCuaa(a.cuaa) === c) : undefined;
  }, [voce?.cuaa, aziende]);

  const [f, setF] = useState<Form | null>(null);
  const [nuovoMotivo, setNuovoMotivo] = useState("");
  useEffect(() => {
    if (id && voce) {
      setF({ denominazione: voce.denominazione ?? "", cuaa: voce.cuaa ?? "", stato_manuale: voce.stato_manuale, numero: voce.numero, data_presentazione: voce.data_presentazione, esito: voce.esito, motivi: voce.motivi ?? [], riesame: voce.riesame, note: voce.note });
      setNuovoMotivo("");
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!voce || !p || !f) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const derivato = r?.derivato ?? "N";
  const stato = f.stato_manuale ?? derivato;
  const esito = f.esito ?? r?.fonte?.riga.esito ?? "I";

  const save = async () => {
    try {
      await salva.mutateAsync({
        id: voce.id, pratica_id: voce.pratica_id, ufficio_id: ufficio.id,
        denominazione: f.denominazione.trim() || null, cuaa: f.cuaa.trim().toUpperCase() || null,
        stato_manuale: f.stato_manuale, numero: f.numero?.trim() || null, data_presentazione: f.data_presentazione,
        esito: f.esito, motivi: esito === "X" ? f.motivi : [], riesame: f.riesame, note: f.note,
      });
      toast("success", "Salvato", `${titleCase(f.denominazione || f.cuaa)} · ${STATI[stato].label}`);
      onClose();
    } catch (e) { toast("error", "Salvataggio non riuscito", (e as Error).message); }
  };
  const remove = async () => {
    if (!(await confirm({ title: "Togliere dall'elenco?", message: "La riga esce dall'elenco delle domande da fare di questa pratica. L'anagrafica non cambia.", danger: true, confirmLabel: "Togli" }))) return;
    await elimina.mutateAsync([voce.id]);
    toast("success", "Tolta dall'elenco"); onClose();
  };
  const motiviDisponibili = Array.from(new Set([...p.motivi_tipici, ...f.motivi]));

  return (
    <Modal
      open={!!id}
      onClose={onClose}
      size="lg"
      icon={<ClipboardList size={22} />}
      title={titleCase(voce.denominazione ?? "") || voce.cuaa || "Riga dell'elenco"}
      subtitle={<>{p.nome}{voce.cuaa && <> · <span className="font-mono">{voce.cuaa}</span></>}</>}
      footer={
        <>
          <Button variant="ghost" className="!text-red-600 hover:!bg-red-50" icon={<Trash2 size={16} />} onClick={remove}>Togli dall'elenco</Button>
          <div className="flex-1" />
          <Button variant="secondary" size="lg" onClick={onClose}>Annulla</Button>
          <Button size="lg" onClick={save} loading={salva.isPending} icon={<Check size={18} strokeWidth={2.5} />}>Salva</Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* da dove viene lo stato */}
        <div className={clsx("rounded-2xl px-4 py-3.5 flex items-start gap-3 text-[13.5px]", r?.fonte ? "bg-brand-50/70 text-brand-900" : "bg-ink-50 text-ink-600")}>
          <FileSpreadsheet size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            {r?.fonte ? (
              <>Trovata nel file <b>«{r.fonte.file.nome}»</b> (riga {r.fonte.riga.riga}) come <b>{STATI[r.fonte.stato].label.toLowerCase()}</b>{r.fonte.riga.numero ? <> · n. {r.fonte.riga.numero}</> : null}{r.fonte.riga.data ? <> · {fmtDate(r.fonte.riga.data)}</> : null}.</>
            ) : <>Non compare in nessun file delle domande fatte: risulta <b>non fatta</b>.</>}
          </div>
        </div>

        <Sezione n={1} titolo="Stato della domanda">
          <button type="button" onClick={() => set("stato_manuale", null)}
            className={clsx("w-full mb-3 rounded-2xl border-2 px-4 py-3 flex items-center gap-3 text-left transition-all active:scale-[.99]", f.stato_manuale == null ? "border-brand-500 bg-brand-50/60" : "border-ink-100 hover:border-ink-200")}>
            <span className={clsx("h-9 w-9 rounded-xl grid place-items-center", f.stato_manuale == null ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-700")}><Sparkles size={17} /></span>
            <span className="flex-1">
              <span className="block font-bold text-[14.5px]">Automatico dai file</span>
              <span className="block text-[12.5px] text-ink-500">Ora: {STATI[derivato].label.toLowerCase()} · si aggiorna quando carichi o elimini un file</span>
            </span>
            {f.stato_manuale == null && <Check size={18} className="text-brand-700" strokeWidth={3} />}
          </button>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {(["N", "C", "S", "R"] as StatoDomanda[]).map((k) => {
              const on = f.stato_manuale === k;
              const st = STATI[k];
              return (
                <motion.button key={k} type="button" whileTap={{ scale: 0.97 }} onClick={() => set("stato_manuale", k)}
                  className={clsx("relative rounded-2xl border-2 p-3.5 text-left transition-all", on ? "" : "border-ink-100 hover:border-ink-200 bg-white")}
                  style={on ? { borderColor: st.color, background: st.color + "0F" } : undefined}>
                  <span className="grid place-items-center h-10 w-10 rounded-xl mb-2.5" style={{ background: on ? st.color : st.color + "16", color: on ? "white" : st.color }}>{STATO_ICON[k]}</span>
                  <div className="font-bold text-[14px] tracking-tight">{k === "R" ? "Fatta" : st.label}</div>
                  <div className="text-[11.5px] text-ink-500 leading-snug">a mano</div>
                </motion.button>
              );
            })}
          </div>
        </Sezione>

        <Sezione n={2} titolo="Nominativo nell'elenco">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nominativo"><TextInput value={f.denominazione} onChange={(e) => set("denominazione", e.target.value)} /></Field>
            <Field label="CUAA" optional><TextInput value={f.cuaa} onChange={(e) => set("cuaa", e.target.value)} className="font-mono uppercase" /></Field>
          </div>
          {azienda && (
            <button onClick={() => { onClose(); setTimeout(() => apriAzienda(azienda.id), 200); }} className="mt-3 inline-flex items-center gap-2 text-[13px] font-semibold text-brand-800 hover:text-brand-950">
              <UserRound size={15} /> In anagrafica: {titleCase(azienda.denominazione)}
            </button>
          )}
        </Sezione>

        <AnimatePresence initial={false}>
          {stato !== "N" && (
            <motion.div key="dati" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <Sezione n={3} titolo="Dati della domanda">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Numero domanda" optional hint={!f.numero && r?.fonte?.riga.numero ? `Dal file: ${r.fonte.riga.numero}` : undefined}>
                    <TextInput value={f.numero ?? ""} onChange={(e) => set("numero", e.target.value || null)} placeholder={r?.fonte?.riga.numero ?? ""} className="font-mono" />
                  </Field>
                  <Field label="Data di presentazione" optional hint={!f.data_presentazione && r?.fonte?.riga.data ? `Dal file: ${fmtDate(r.fonte.riga.data)}` : undefined}>
                    <DatePicker value={f.data_presentazione} onChange={(v) => set("data_presentazione", v)} />
                  </Field>
                </div>
              </Sezione>
            </motion.div>
          )}
          {stato === "R" && (
            <motion.div key="esito" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <Sezione n={4} titolo="Esito">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {(["I", "A", "P", "X"] as Esito[]).map((k) => {
                    const on = esito === k;
                    const e = ESITI[k];
                    return (
                      <button key={k} type="button" onClick={() => set("esito", k)}
                        className={clsx("rounded-2xl border-2 px-3.5 py-3 flex items-center gap-2.5 text-left transition-all active:scale-[.97]", on ? "" : "border-ink-100 hover:border-ink-200")}
                        style={on ? { borderColor: e.color, background: e.color + "10" } : undefined}>
                        <span style={{ color: e.color }}>{ESITO_ICON[k]}</span><span className="font-bold text-[13.5px] leading-tight">{e.label}</span>
                      </button>
                    );
                  })}
                </div>
                {esito === "X" && (
                  <div className="mt-5">
                    <span className="label">Motivi del rigetto</span>
                    <div className="flex flex-wrap gap-2">
                      {motiviDisponibili.map((m) => {
                        const on = f.motivi.includes(m);
                        return (
                          <button key={m} type="button" onClick={() => set("motivi", on ? f.motivi.filter((x) => x !== m) : [...f.motivi, m])}
                            className={clsx("h-10 px-3.5 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 border transition-all active:scale-[.97]", on ? "bg-red-50 border-red-200 text-red-700" : "border-ink-200 text-ink-600 hover:border-ink-300")}>
                            {on ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}{m}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <TextInput value={nuovoMotivo} onChange={(e) => setNuovoMotivo(e.target.value)} placeholder="Altro motivo…" className="flex-1"
                        onKeyDown={(e) => { if (e.key === "Enter" && nuovoMotivo.trim()) { e.preventDefault(); set("motivi", [...f.motivi, nuovoMotivo.trim()]); setNuovoMotivo(""); } }} />
                      <Button variant="secondary" className="!h-12" disabled={!nuovoMotivo.trim()} onClick={() => { set("motivi", [...f.motivi, nuovoMotivo.trim()]); setNuovoMotivo(""); }}>Aggiungi</Button>
                    </div>
                    <Field label="Riesame o ricorso" className="mt-4" hint="Se presentato, la domanda esce dagli avvisi.">
                      <TextArea value={f.riesame ?? ""} onChange={(e) => set("riesame", e.target.value || null)} placeholder="es. Istanza di riesame inviata il 10/10/2026, prot. …" className="!min-h-[72px]" />
                    </Field>
                  </div>
                )}
              </Sezione>
            </motion.div>
          )}
        </AnimatePresence>

        <Field label="Note" optional><TextArea value={f.note ?? ""} onChange={(e) => set("note", e.target.value || null)} className="!min-h-[72px]" /></Field>
      </div>
    </Modal>
  );
}

function Sezione({ n, titolo, children }: { n: number; titolo: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="h-6 w-6 rounded-full bg-brand-50 text-brand-800 text-[12px] font-extrabold grid place-items-center">{n}</span>
        <h3 className="font-bold text-[15px] tracking-tight">{titolo}</h3>
      </div>
      {children}
    </section>
  );
}
