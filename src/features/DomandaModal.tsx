import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleDashed, ClipboardList, FileCheck2, Gavel, PenLine, Plus, Printer, Send, Trash2, X, XCircle, CheckCircle2, CircleDot, Hourglass } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Field, NumberInput, TextArea, TextInput } from "../components/ui/Inputs";
import { DatePicker } from "../components/ui/DatePicker";
import { useFeedback } from "../components/ui/Feedback";
import { ESITI, STATI } from "../lib/domain";
import { titleCase, todayISO } from "../lib/format";
import { useEliminaDomanda, useSalvaDomanda, type DomandaInput } from "../lib/queries";
import { useModals, useUfficio } from "../lib/ufficio";
import type { Domanda, Esito, StatoDomanda } from "../lib/types";

const STATO_ICON: Record<StatoDomanda, ReactNode> = {
  N: <CircleDashed size={22} />, C: <PenLine size={22} />, S: <Printer size={22} />, R: <Send size={22} />,
};
const ESITO_ICON: Record<Esito, ReactNode> = {
  I: <Hourglass size={20} />, A: <CheckCircle2 size={20} />, P: <CircleDot size={20} />, X: <XCircle size={20} />,
};

type Form = Omit<DomandaInput, "azienda_id" | "pratica_id"> & { stato: StatoDomanda; esito: Esito; motivi: string[] };

function emptyForm(d?: Domanda): Form {
  return {
    stato: d?.stato ?? "N", numero: d?.numero ?? null, data_presentazione: d?.data_presentazione ?? null, esito: d?.esito ?? "I", motivi: d?.motivi ?? [],
    data_esito: d?.data_esito ?? null, riesame: d?.riesame ?? null,
    litri_richiesti: d?.litri_richiesti ?? null, litri_assegnati: d?.litri_assegnati ?? null, n_libretto: d?.n_libretto ?? null,
    note: d?.note ?? null,
  };
}

export function DomandaModal({ state, onClose }: { state: { aziendaId: string; praticaId: string } | null; onClose: () => void }) {
  const { azById, praticaById, domandaByKey } = useUfficio();
  const { apriAzienda } = useModals();
  const salva = useSalvaDomanda();
  const elimina = useEliminaDomanda();
  const { toast, confirm } = useFeedback();
  const [cache, setCache] = useState(state);
  useEffect(() => { if (state) setCache(state); }, [state]);
  const s = state ?? cache;
  const a = s ? azById.get(s.aziendaId) : undefined;
  const p = s ? praticaById.get(s.praticaId) : undefined;
  const d = s ? domandaByKey.get(s.aziendaId + "|" + s.praticaId) : undefined;
  const [f, setF] = useState<Form>(emptyForm(d));
  const [nuovoMotivo, setNuovoMotivo] = useState("");

  useEffect(() => { if (state) { setF(emptyForm(domandaByKey.get(state.aziendaId + "|" + state.praticaId))); setNuovoMotivo(""); } }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => {
    const n = { ...x, [k]: v };
    // stesse regole del database, mostrate subito
    if (k === "esito" && v !== "I") n.stato = "R";
    if (k === "stato" && v === "R" && !n.data_presentazione) n.data_presentazione = todayISO();
    return n;
  });


  if (!a || !p) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const isR = f.stato === "R";
  const litri = p.unita === "litri";

  const save = async () => {
    if (f.stato === "N") {
      if (d) {
        const ok = await confirm({ title: "Riportare a «Non fatta»?", message: "La domanda verrà rimossa con tutti i suoi dati (numero, date, esito).", confirmLabel: "Rimuovi", danger: true });
        if (!ok) return;
        await elimina.mutateAsync(d.id);
        toast("success", "Domanda rimossa");
      }
      onClose();
      return;
    }
    try {
      await salva.mutateAsync({ azienda_id: a.id, pratica_id: p.id, ...f, motivi: f.esito === "X" ? f.motivi : [] });
      toast("success", "Domanda salvata", `${titleCase(a.denominazione)} · ${STATI[f.stato].label}`);
      onClose();
    } catch (e) { toast("error", "Salvataggio non riuscito", (e as Error).message); }
  };

  const motiviDisponibili = Array.from(new Set([...p.motivi_tipici, ...f.motivi]));

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      size="lg"
      icon={<ClipboardList size={22} />}
      title={p.nome}
      subtitle={
        <button onClick={() => { onClose(); setTimeout(() => apriAzienda(a.id, "domande"), 200); }} className="hover:text-brand-800 hover:underline underline-offset-2 text-left">
          {titleCase(a.denominazione)} · <span className="font-mono">{a.cuaa}</span>
        </button>
      }
      footer={
        <>
          {d && <Button variant="ghost" className="!text-red-600 hover:!bg-red-50" icon={<Trash2 size={16} />} onClick={() => set("stato", "N")}>Rimuovi</Button>}
          <div className="flex-1" />
          <Button variant="secondary" size="lg" onClick={onClose}>Annulla</Button>
          <Button size="lg" onClick={save} loading={salva.isPending || elimina.isPending} icon={<Check size={18} strokeWidth={2.5} />}>Salva</Button>
        </>
      }
    >
      <div className="space-y-6">
        <Section n={1} title="A che punto è la domanda?">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["N", "C", "S", "R"] as StatoDomanda[]).map((k) => {
              const on = f.stato === k;
              const st = STATI[k];
              return (
                <motion.button
                  key={k}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => set("stato", k)}
                  className={clsx("relative rounded-2xl border-2 p-4 text-left transition-all duration-200", on ? "shadow-[0_10px_24px_-14px_var(--c)]" : "border-ink-100 hover:border-ink-200 bg-white")}
                  style={{ ["--c" as string]: st.color, ...(on ? { borderColor: st.color, background: st.color + "0F" } : {}) }}
                >
                  <span className="grid place-items-center h-11 w-11 rounded-xl mb-3 transition-colors" style={{ background: on ? st.color : st.color + "16", color: on ? "white" : st.color }}>{STATO_ICON[k]}</span>
                  <div className="font-bold text-[15px] tracking-tight">{st.label}</div>
                  <div className="text-[12px] text-ink-500 leading-snug mt-0.5">{st.desc}</div>
                  {on && <motion.span layoutId="stato-check" className="absolute top-3 right-3 h-6 w-6 rounded-full grid place-items-center text-white" style={{ background: st.color }}><Check size={14} strokeWidth={3} /></motion.span>}
                </motion.button>
              );
            })}
          </div>
        </Section>

        <AnimatePresence initial={false}>
          {f.stato !== "N" && (
            <Collapse key="pres">
              <Section n={2} title="Dati della domanda">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Numero domanda" optional><TextInput value={f.numero ?? ""} onChange={(e) => set("numero", e.target.value || null)} placeholder={p.codice ? `${p.codice}-…` : ""} className="font-mono" /></Field>
                  <Field label="Data di presentazione" optional><DatePicker value={f.data_presentazione} onChange={(v) => set("data_presentazione", v)} /></Field>
                  {litri ? (
                    <>
                      <Field label="Litri richiesti" optional><NumberInput value={f.litri_richiesti} onChange={(v) => set("litri_richiesti", v == null ? null : Math.round(v))} suffix="L" decimals={0} /></Field>
                      <Field label="N. libretto" optional><TextInput value={f.n_libretto ?? ""} onChange={(e) => set("n_libretto", e.target.value || null)} /></Field>
                    </>
                  ) : null}
                </div>
              </Section>
            </Collapse>
          )}

          {isR && (
            <Collapse key="esito">
              <Section n={3} title="Esito dell'istruttoria" icon={<Gavel size={16} />}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {(["I", "A", "P", "X"] as Esito[]).map((k) => {
                    const on = f.esito === k;
                    const e = ESITI[k];
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => set("esito", k)}
                        className={clsx("rounded-2xl border-2 px-3.5 py-3 flex items-center gap-2.5 text-left transition-all active:scale-[.97]", on ? "" : "border-ink-100 hover:border-ink-200")}
                        style={on ? { borderColor: e.color, background: e.color + "10" } : undefined}
                      >
                        <span style={{ color: e.color }}>{ESITO_ICON[k]}</span>
                        <span className="font-bold text-[13.5px] leading-tight">{e.label}</span>
                      </button>
                    );
                  })}
                </div>
                {f.esito !== "I" && (
                  <div className="mt-4 max-w-xs"><Field label="Data dell'esito"><DatePicker value={f.data_esito} onChange={(v) => set("data_esito", v)} /></Field></div>
                )}
                <AnimatePresence>
                  {f.esito === "X" && (
                    <Collapse key="motivi">
                      <div className="mt-5">
                        <span className="label">Motivi del rigetto</span>
                        <div className="flex flex-wrap gap-2">
                          {motiviDisponibili.map((m) => {
                            const on = f.motivi.includes(m);
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => set("motivi", on ? f.motivi.filter((x) => x !== m) : [...f.motivi, m])}
                                className={clsx("h-10 px-3.5 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 border transition-all active:scale-[.97]", on ? "bg-red-50 border-red-200 text-red-700" : "border-ink-200 text-ink-600 hover:border-ink-300")}
                              >
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
                        <Field label="Riesame o ricorso" className="mt-4" hint="Se presentato, indica data e riferimenti: la domanda esce dagli avvisi.">
                          <TextArea value={f.riesame ?? ""} onChange={(e) => set("riesame", e.target.value || null)} placeholder="es. Istanza di riesame inviata il 10/10/2026, prot. …" className="!min-h-[72px]" />
                        </Field>
                      </div>
                    </Collapse>
                  )}
                </AnimatePresence>
              </Section>
            </Collapse>
          )}

          {isR && litri && f.esito !== "X" && (
            <Collapse key="litri">
              <Section n={4} title="Assegnazione" icon={<FileCheck2 size={16} />}>
                <div className="max-w-xs"><Field label="Litri assegnati"><NumberInput value={f.litri_assegnati} onChange={(v) => set("litri_assegnati", v == null ? null : Math.round(v))} suffix="L" decimals={0} /></Field></div>
              </Section>
            </Collapse>
          )}

          {f.stato !== "N" && (
            <Collapse key="note">
              <Field label="Note"><TextArea value={f.note ?? ""} onChange={(e) => set("note", e.target.value || null)} placeholder="Annotazioni sulla domanda…" className="!min-h-[72px]" /></Field>
            </Collapse>
          )}
        </AnimatePresence>
        {f.stato === "N" && d && (
          <div className="rounded-2xl bg-red-50 text-red-700 px-5 py-4 text-sm font-medium flex items-center gap-3"><X size={18} /> Salvando, la domanda sarà rimossa e l'azienda tornerà tra le «Non fatte».</div>
        )}
      </div>
    </Modal>
  );
}

function Section({ n, title, children, icon, right }: { n: number; title: string; children: ReactNode; icon?: ReactNode; right?: ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3.5">
        <span className="h-7 w-7 rounded-full bg-ink-900 text-white text-[12px] font-bold grid place-items-center">{n}</span>
        <h3 className="font-bold text-[16px] tracking-tight flex items-center gap-2 flex-1">{icon}{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Collapse({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
      <div className="pt-1">{children}</div>
    </motion.div>
  );
}
