import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen, CalendarClock, ClipboardList, ExternalLink, Plus, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Field, TextInput } from "../components/ui/Inputs";
import { DatePicker } from "../components/ui/DatePicker";
import { Segmented } from "../components/ui/Segmented";
import { Badge } from "../components/ui/Misc";
import { useFeedback } from "../components/ui/Feedback";
import { useUfficio } from "../lib/ufficio";
import { useSalvaPratica, useTipiDomanda } from "../lib/queries";
import { normalizza } from "../lib/analisi/classificatore";
import { fmtDate } from "../lib/format";
import type { TipoDomanda } from "../lib/types";

type Bozza = { nome: string; codice: string | null; ente: string | null; categoria: "annuale" | "bando"; unita: "euro" | "litri"; scadenza: string | null; tipo?: TipoDomanda };

function slug(s: string) {
  return normalizza(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || `pratica-${Date.now()}`;
}

/** «Nuova domanda»: la prima cosa è scegliere (o creare) la pratica; poi si va alla sua pagina per caricare gli elenchi. */
export function NuovaDomanda({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pratiche, ufficio } = useUfficio();
  const { data: catalogo = [] } = useTipiDomanda();
  const salva = useSalvaPratica();
  const { toast } = useFeedback();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [bozza, setBozza] = useState<Bozza | null>(null);
  const [filtro, setFiltro] = useState<"tutte" | "annuale" | "una_tantum">("tutte");

  useEffect(() => { if (open) { setQ(""); setBozza(null); setFiltro("tutte"); } }, [open]);

  const anno = new Date().getFullYear();
  const n = normalizza(q).trim();
  const trova = (s: string) => !n || n.split(/\s+/).every((w) => normalizza(s).includes(w));
  const inUso = useMemo(() => pratiche.filter((p) => trova(`${p.nome} ${p.codice ?? ""} ${p.ente ?? ""}`)), [pratiche, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const usati = new Set(pratiche.map((p) => p.tipo_domanda_id).filter(Boolean));
  const dalCatalogo = useMemo(() => catalogo.filter((t) => (filtro === "tutte" || t.tipologia === filtro) && trova(`${t.nome} ${t.codice ?? ""} ${t.ente ?? ""} ${t.ambito} ${t.parole.join(" ")}`)), [catalogo, filtro, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const esisteUguale = pratiche.some((p) => normalizza(p.nome) === n);

  const vai = (id: string, caricaElenco = false) => { onClose(); setTimeout(() => nav(`/u/${ufficio.id}/pratiche/${id}`, { state: caricaElenco ? { carica: "modello" } : null }), 180); };

  const daCatalogo = (t: TipoDomanda) => setBozza({
    nome: t.tipologia === "annuale" ? `${t.nome} ${anno}` : t.nome, codice: t.codice ? (t.tipologia === "annuale" ? `${t.codice}${anno}` : t.codice) : null,
    ente: t.ente, categoria: t.tipologia === "annuale" ? "annuale" : "bando", unita: t.unita, scadenza: null, tipo: t,
  });

  const crea = async () => {
    if (!bozza?.nome.trim()) return;
    const esist = new Set(pratiche.map((p) => p.id));
    let id = slug(bozza.codice || bozza.nome); const base = id; let k = 2;
    while (esist.has(id)) id = `${base}-${k++}`;
    try {
      await salva.mutateAsync({
        isNew: true, id, nome: bozza.nome.trim(), codice: bozza.codice?.trim() || null, ente: bozza.ente, categoria: bozza.categoria, unita: bozza.unita,
        campagna: String(anno), scadenza: bozza.scadenza, criteri: bozza.tipo?.criteri ?? { tipo: "tutti" }, tipo_domanda_id: bozza.tipo?.id ?? null,
        motivi_tipici: ["Documentazione incompleta", "Fascicolo aziendale non validato", "Requisiti non rispettati", "Presentata fuori termine"],
        note: bozza.tipo ? [bozza.tipo.descrizione, bozza.tipo.periodo && `Periodo indicativo: ${bozza.tipo.periodo}`].filter(Boolean).join(" ") : null,
        attivo: true, esempio: false, ordine: pratiche.length + 1,
      });
      toast("success", "Pratica creata", "Ora carica l'elenco delle domande da fare");
      vai(id, true);
    } catch (e) { toast("error", "Errore", (e as Error).message); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" hideClose className="sm:h-[86vh]" bodyClassName="!px-0 !pb-0 flex flex-col">
      <AnimatePresence mode="wait" initial={false}>
        {!bozza ? (
          <motion.div key="scelta" className="flex flex-col min-h-0 flex-1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <div className="px-8 pt-7 pb-4">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold text-ink-500">Nuova domanda · {ufficio.nome}</div>
                <button onClick={onClose} className="h-9 px-4 rounded-full text-[13px] font-semibold text-ink-500 hover:bg-ink-100">Annulla</button>
              </div>
              <h2 className="mt-3 text-[26px] font-extrabold tracking-[-0.03em]">Per quale pratica?</h2>
              <p className="text-[15px] text-ink-500 mt-1">Scegli una pratica, cercala nel catalogo o creane una nuova. Poi caricherai gli elenchi Excel.</p>
              <TextInput size="lg" autoFocus className="mt-5" value={q} onChange={(e) => setQ(e.target.value)} icon={<Search size={19} />} placeholder="es. Domanda Unica, UMA, vendemmia, SRE01, ISI INAIL…" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8 space-y-7">
              {q.trim() && !esisteUguale && (
                <button onClick={() => setBozza({ nome: q.trim(), codice: null, ente: null, categoria: "annuale", unita: "euro", scadenza: null })}
                  className="w-full flex items-center gap-4 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/50 px-5 py-4 text-left hover:bg-brand-50 transition active:scale-[.99]">
                  <span className="h-11 w-11 rounded-xl bg-brand-700 text-white grid place-items-center"><Plus size={20} /></span>
                  <span className="flex-1"><span className="block font-bold">Crea la pratica «{q.trim()}»</span><span className="text-[13px] text-ink-500">Nuova tipologia di domanda</span></span>
                  <ArrowRight size={18} className="text-brand-700" />
                </button>
              )}

              {inUso.length > 0 && (
                <section>
                  <div className="text-[12px] font-bold uppercase tracking-wider text-ink-400 mb-2.5">Pratiche in uso</div>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {inUso.map((p) => (
                      <button key={p.id} onClick={() => vai(p.id, !p.modello)} className="group text-left rounded-2xl border border-ink-100 bg-white p-4 hover:border-brand-300 hover:shadow-card transition-all active:scale-[.99]">
                        <div className="flex items-start gap-3">
                          <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-800 grid place-items-center shrink-0 group-hover:bg-brand-700 group-hover:text-white transition-colors"><ClipboardList size={18} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-[14.5px] leading-tight">{p.nome}</div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {p.modello ? <Badge tone="green">Elenco caricato</Badge> : <Badge tone="amber">Elenco da caricare</Badge>}
                              {p.scadenza && <Badge><CalendarClock size={10} /> {fmtDate(p.scadenza)}</Badge>}
                              {!p.attivo && <Badge tone="red">Non attiva</Badge>}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
                  <div className="text-[12px] font-bold uppercase tracking-wider text-ink-400 flex items-center gap-1.5"><BookOpen size={13} />Catalogo dei tipi di domanda</div>
                  <Segmented size="sm" value={filtro} onChange={setFiltro} options={[{ value: "tutte", label: "Tutte" }, { value: "annuale", label: "Annuali" }, { value: "una_tantum", label: "Una tantum" }]} />
                </div>
                {dalCatalogo.length === 0 && <div className="text-sm text-ink-400 py-4">Nessun tipo trovato nel catalogo.</div>}
                <div className="space-y-2">
                  {dalCatalogo.map((t) => (
                    <button key={t.id} onClick={() => daCatalogo(t)} className="group w-full text-left rounded-2xl border border-ink-100 bg-white px-4 py-3.5 hover:border-brand-300 hover:shadow-card transition-all active:scale-[.995] flex items-start gap-3">
                      <span className={clsx("h-10 w-10 rounded-xl grid place-items-center shrink-0 text-[10.5px] font-extrabold", t.tipologia === "annuale" ? "bg-brand-50 text-brand-800" : "bg-amber-50 text-amber-700")}>{(t.codice ?? "").slice(0, 5)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[14.5px]">{t.nome}</span>
                          <Badge tone={t.tipologia === "annuale" ? "green" : "amber"}>{t.tipologia === "annuale" ? "Annuale" : "Una tantum"}</Badge>
                          {usati.has(t.id) && <Badge>già in uso</Badge>}
                        </div>
                        <div className="text-[12.5px] text-ink-500 mt-0.5">{[t.ente, t.periodo].filter(Boolean).join(" · ")}</div>
                        {t.descrizione && <div className="text-[12.5px] text-ink-400 mt-0.5 line-clamp-1">{t.descrizione}</div>}
                      </div>
                      <ArrowRight size={17} className="text-ink-300 group-hover:text-brand-700 mt-2.5 transition-colors" />
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        ) : (
          <motion.div key="bozza" className="flex flex-col min-h-0 flex-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <div className="px-8 pt-7">
              <button onClick={() => setBozza(null)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft size={15} /> Torna alla scelta</button>
              <h2 className="mt-3 text-[26px] font-extrabold tracking-[-0.03em]">Crea la pratica</h2>
              <p className="text-[15px] text-ink-500 mt-1">Controlla nome e scadenza: subito dopo caricherai l'elenco delle domande da fare.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
              {bozza.tipo && (
                <div className="rounded-2xl bg-brand-50/70 ring-1 ring-brand-100 p-4 text-[13.5px] text-ink-700 flex gap-3">
                  <Sparkles size={17} className="text-brand-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-brand-900">Dal catalogo: {bozza.tipo.nome}</div>
                    {bozza.tipo.descrizione && <div className="mt-0.5">{bozza.tipo.descrizione}</div>}
                    {bozza.tipo.periodo && <div className="mt-1 text-ink-500">Periodo indicativo: {bozza.tipo.periodo}. Verifica sul bando dell'anno.</div>}
                    {bozza.tipo.fonte && <a href={bozza.tipo.fonte} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-brand-700 font-semibold hover:underline">Fonte <ExternalLink size={12} /></a>}
                  </div>
                </div>
              )}
              <Field label="Nome della pratica"><TextInput size="lg" autoFocus value={bozza.nome} onChange={(e) => setBozza({ ...bozza, nome: e.target.value })} onKeyDown={(e) => e.key === "Enter" && crea()} /></Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Codice" optional><TextInput value={bozza.codice ?? ""} onChange={(e) => setBozza({ ...bozza, codice: e.target.value.toUpperCase() || null })} className="font-mono" /></Field>
                <Field label="Scadenza" optional><DatePicker value={bozza.scadenza} onChange={(v) => setBozza({ ...bozza, scadenza: v })} /></Field>
              </div>
              <div><span className="label">Tipo</span>
                <Segmented value={bozza.categoria} onChange={(v) => setBozza({ ...bozza, categoria: v })} options={[{ value: "annuale", label: "Annuale" }, { value: "bando", label: "Bando / una tantum" }]} /></div>
            </div>
            <div className="px-8 py-5 border-t border-ink-100 flex items-center gap-3">
              <Button variant="ghost" size="lg" icon={<ArrowLeft size={18} />} onClick={() => setBozza(null)}>Indietro</Button>
              <div className="flex-1" />
              <Button size="lg" iconRight={<ArrowRight size={18} />} loading={salva.isPending} disabled={!bozza.nome.trim()} onClick={crea}>Crea e carica l'elenco</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
