import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Check, FileSearch, HelpCircle, Leaf, Quote, Scale, Tractor, UploadCloud, X, PenLine } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Checkbox, Field, NumberInput, SearchInput, TextInput, Toggle } from "../components/ui/Inputs";
import { DatePicker } from "../components/ui/DatePicker";
import { Segmented } from "../components/ui/Segmented";
import { Avatar, Empty } from "../components/ui/Misc";
import { useFeedback } from "../components/ui/Feedback";
import { useModals, useUfficio } from "../lib/ufficio";
import { estraiTesto } from "../lib/analisi/estrazione";
import { leggiBando, valuta, type BandoLetto, type Giudizio } from "../lib/analisi/bando";
import { normalizza } from "../lib/analisi/classificatore";
import { normalizeSearch, titleCase } from "../lib/format";
import { useAggiungiVoci, useSalvaPratica } from "../lib/queries";
import { chiaveCuaa } from "../lib/riscontro";
import type { Criteri, Pratica } from "../lib/types";

const GIUDIZI: Record<Giudizio, { l: string; desc: string; color: string }> = {
  idonea: { l: "Idonee", desc: "Rispettano tutti i requisiti", color: "#16A34A" },
  verificare: { l: "Da verificare", desc: "Mancano dati in anagrafica", color: "#2563EB" },
  quasi: { l: "Quasi", desc: "Manca un solo requisito recuperabile (superficie, colture…)", color: "#EA8C0C" },
  no: { l: "Non idonee", desc: "Due o più requisiti non rispettati", color: "#DC2626" },
};

function slug(s: string) {
  return normalizza(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || `bando-${Date.now()}`;
}

export function ConfrontoBando({ open, onClose, pratica }: { open: boolean; onClose: () => void; pratica?: Pratica | null }) {
  const { aziende, colture, pratiche, ufficio, voci } = useUfficio();
  const { apriAzienda } = useModals();
  const salva = useSalvaPratica();
  const abb = useAggiungiVoci();
  const { toast } = useFeedback();
  const [fase, setFase] = useState<"carica" | "analisi" | "confronto">("carica");
  const [nomeFile, setNomeFile] = useState<string | null>(null);
  const [b, setB] = useState<BandoLetto>({ nome: null, codice: null, ente: null, apertura: null, scadenza: null, criteri: { tipo: "tutti" }, evidenze: {} });
  const [vista, setVista] = useState<Giudizio>("idonea");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ(""); setSel(new Set()); setVista("idonea"); setNomeFile(null);
    if (pratica) {
      setB({ nome: pratica.nome, codice: pratica.codice, ente: pratica.ente, apertura: pratica.apertura, scadenza: pratica.scadenza, criteri: { ...pratica.criteri }, evidenze: {} });
      setFase("confronto");
    } else { setB({ nome: null, codice: null, ente: null, apertura: null, scadenza: null, criteri: { tipo: "tutti" }, evidenze: {} }); setFase("carica"); }
  }, [open, pratica]);

  const analizza = async (f: File | null) => {
    if (!f) return;
    setNomeFile(f.name); setFase("analisi");
    try {
      const est = await estraiTesto(f);
      const letto = leggiBando(est.testo, colture);
      setB({ ...letto, nome: letto.nome ?? f.name.replace(/\.[^.]+$/, "") });
      if (!est.testo.trim()) toast("info", "Non ho trovato testo leggibile nel file", "Inserisci i requisiti a mano");
    } catch (e) { toast("error", "Lettura non riuscita", (e as Error).message); }
    setFase("confronto");
  };

  const nomiColture = useMemo(() => Object.fromEntries(colture.map((c) => [c.id, c.nome])), [colture]);
  const risultati = useMemo(() => aziende.map((a) => ({ a, v: valuta(a, { criteri: b.criteri, scadenza: b.scadenza }, nomiColture) })), [aziende, b.criteri, b.scadenza, nomiColture]);
  const conta = useMemo(() => {
    const c: Record<Giudizio, number> = { idonea: 0, verificare: 0, quasi: 0, no: 0 };
    risultati.forEach((r) => c[r.v.giudizio]++);
    return c;
  }, [risultati]);
  const lista = useMemo(() => {
    const n = normalizeSearch(q.trim());
    return risultati.filter((r) => r.v.giudizio === vista && (!n || normalizeSearch(r.a.denominazione + " " + r.a.cuaa).includes(n)))
      .sort((x, y) => x.v.mancanti - y.v.mancanti || x.a.denominazione.localeCompare(y.a.denominazione));
  }, [risultati, vista, q]);
  const cuaaInElenco = new Set(pratica ? voci.filter((x) => x.pratica_id === pratica.id).map((x) => chiaveCuaa(x.cuaa)).filter(Boolean) : []);
  const inclusiGia = new Set(aziende.filter((a) => cuaaInElenco.has(chiaveCuaa(a.cuaa))).map((a) => a.id));
  const idoneeLibere = risultati.filter((r) => r.v.giudizio === "idonea" && !inclusiGia.has(r.a.id)).map((r) => r.a.id);

  const setC = <K extends keyof Criteri>(k: K, v: Criteri[K]) => setB((x) => ({ ...x, criteri: { ...x.criteri, [k]: v } }));

  const salvaBando = async () => {
    if (!b.nome?.trim()) { toast("error", "Indica il nome del bando"); return; }
    try {
      let id = pratica?.id;
      if (!id) {
        const esist = new Set(pratiche.map((p) => p.id));
        id = slug(b.codice || b.nome); let k = 2; const base = id;
        while (esist.has(id)) id = `${base}-${k++}`;
        await salva.mutateAsync({
          isNew: true, id, nome: b.nome.trim(), codice: b.codice, ente: b.ente, categoria: "bando", campagna: String(new Date().getFullYear()),
          unita: "euro", apertura: b.apertura, scadenza: b.scadenza, criteri: b.criteri, attivo: true, esempio: false,
          motivi_tipici: ["Requisiti di accesso non rispettati", "Documentazione incompleta", "Punteggio insufficiente in graduatoria", "Presentata fuori termine"],
          note: nomeFile ? `Requisiti letti automaticamente da «${nomeFile}»: verificarli sul testo ufficiale.` : null, ordine: pratiche.length + 1,
        });
      } else {
        await salva.mutateAsync({ id, nome: b.nome.trim(), codice: b.codice, ente: b.ente, apertura: b.apertura, scadenza: b.scadenza, criteri: b.criteri });
      }
      const daAggiungere = aziende.filter((a) => sel.has(a.id) && !inclusiGia.has(a.id));
      const base = voci.filter((x) => x.pratica_id === id).length;
      if (daAggiungere.length) await abb.mutateAsync(daAggiungere.map((a, i) => ({ pratica_id: id!, ufficio_id: ufficio.id, cuaa: a.cuaa, denominazione: a.denominazione, ordine: base + i })));
      toast("success", pratica ? "Requisiti aggiornati" : "Bando salvato", daAggiungere.length ? `${daAggiungere.length} aziende aggiunte all'elenco delle domande da fare` : `${conta.idonea} aziende idonee`);
      onClose();
    } catch (e) { toast("error", "Salvataggio non riuscito", (e as Error).message); }
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" hideClose className="sm:h-[90vh] !max-w-6xl" bodyClassName="!px-0 !pb-0 flex flex-col">
      <div className="px-7 py-5 flex items-center gap-4 border-b border-ink-100">
        <span className="h-12 w-12 rounded-2xl grid place-items-center bg-gradient-to-br from-brand-600 to-brand-800 text-white"><Scale size={22} /></span>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold tracking-tight truncate">{pratica ? `Confronto aziende · ${pratica.nome}` : "Carica un bando"}</h2>
          <p className="text-sm text-ink-500">Quali aziende dell'ufficio di {ufficio.nome} possono partecipare, requisito per requisito.</p>
        </div>
        <Button variant="ghost" onClick={onClose}>Chiudi</Button>
      </div>

      {fase === "carica" && (
        <div className="flex-1 p-8 flex flex-col gap-4">
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); analizza(e.dataTransfer.files[0] ?? null); }}
            onClick={() => input.current?.click()} animate={{ scale: drag ? 1.01 : 1 }}
            className={clsx("flex-1 cursor-pointer rounded-[28px] border-2 border-dashed grid place-items-center text-center p-10 transition-colors", drag ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/40")}
          >
            <div>
              <div className="mx-auto h-20 w-20 rounded-3xl bg-brand-50 text-brand-700 grid place-items-center mb-5"><UploadCloud size={36} /></div>
              <div className="text-2xl font-extrabold tracking-tight">Trascina qui il PDF del bando</div>
              <div className="text-ink-500 mt-2 max-w-md mx-auto">Leggo il testo e ricavo nome, ente, scadenza e requisiti (età, tipo di soggetto, biologico, IAP, superficie minima, comparti), poi confronto tutte le aziende.</div>
            </div>
          </motion.div>
          <div className="flex justify-center"><Button variant="secondary" icon={<PenLine size={16} />} onClick={() => setFase("confronto")}>Inserisci i requisiti a mano</Button></div>
          <input ref={input} type="file" accept=".pdf,image/*,.txt" className="hidden" onChange={(e) => { analizza(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </div>
      )}

      {fase === "analisi" && (
        <div className="flex-1 grid place-items-center text-center p-10">
          <div>
            <div className="relative mx-auto h-28 w-24 rounded-2xl bg-white ring-1 ring-ink-100 shadow-card overflow-hidden grid place-items-center">
              <FileSearch size={36} className="text-ink-300" />
              <motion.span className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-brand-400/40 to-transparent" animate={{ y: [-40, 112] }} transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }} />
            </div>
            <div className="mt-6 font-bold text-lg">Leggo il bando…</div>
            <div className="text-sm text-ink-500">{nomeFile}</div>
          </div>
        </div>
      )}

      {fase === "confronto" && (
        <div className="flex-1 min-h-0 grid lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* requisiti */}
          <div className="min-h-0 overflow-y-auto border-r border-ink-100 p-6 space-y-4 bg-ink-50/40">
            {nomeFile && <div className="rounded-2xl bg-brand-50 text-brand-900 text-[13px] px-4 py-3 flex gap-2"><FileSearch size={16} className="shrink-0 mt-0.5" /><span>Requisiti letti da <b>{nomeFile}</b>. Controllali: sotto ogni campo c'è il passaggio del bando da cui li ho ricavati.</span></div>}
            <Field label="Nome del bando"><TextInput value={b.nome ?? ""} onChange={(e) => setB((x) => ({ ...x, nome: e.target.value }))} /></Field>
            <Prova testo={b.evidenze.nome} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Codice" optional><TextInput value={b.codice ?? ""} onChange={(e) => setB((x) => ({ ...x, codice: e.target.value.toUpperCase() || null }))} className="font-mono" /></Field>
              <Field label="Ente" optional><TextInput value={b.ente ?? ""} onChange={(e) => setB((x) => ({ ...x, ente: e.target.value || null }))} /></Field>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Apertura" optional><DatePicker value={b.apertura} onChange={(v) => setB((x) => ({ ...x, apertura: v }))} /></Field>
              <Field label="Scadenza" optional><DatePicker value={b.scadenza} onChange={(v) => setB((x) => ({ ...x, scadenza: v }))} /></Field>
            </div>
            <Prova testo={b.evidenze.scadenza} />
            <div className="pt-2 text-[12px] font-bold uppercase tracking-wider text-ink-400">Requisiti</div>
            <div><span className="label">Soggetti ammessi</span>
              <Segmented full value={b.criteri.tipo ?? "tutti"} onChange={(v) => setC("tipo", v)} options={[{ value: "tutti", label: "Tutti" }, { value: "PF", label: "Pers. fisiche" }, { value: "PG", label: "Società" }]} /></div>
            <Prova testo={b.evidenze.tipo} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Età minima"><NumberInput value={b.criteri.etaMin ?? null} onChange={(v) => setC("etaMin", v == null ? null : Math.round(v))} suffix="anni" decimals={0} /></Field>
              <Field label="Età massima"><NumberInput value={b.criteri.etaMax ?? null} onChange={(v) => setC("etaMax", v == null ? null : Math.round(v))} suffix="anni" decimals={0} /></Field>
            </div>
            <Prova testo={b.evidenze.eta} />
            <Field label="Superficie minima (SAU)"><NumberInput value={b.criteri.sauMin ?? null} onChange={(v) => setC("sauMin", v)} suffix="ha" /></Field>
            <Prova testo={b.evidenze.sau} />
            <div className="rounded-2xl bg-white ring-1 ring-ink-100 divide-y divide-ink-100">
              {([["biologico", "Solo biologiche", <Leaf size={16} key="l" />], ["iap", "Solo IAP / CD", <BadgeCheck size={16} key="b" />], ["uma", "Solo utenti UMA", <Tractor size={16} key="t" />]] as const).map(([k, l, ic]) => (
                <div key={k} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-ink-500">{ic}</span><span className="flex-1 text-[14px] font-semibold">{l}</span>
                  <Toggle size="sm" checked={!!b.criteri[k]} onChange={(v) => setC(k, v)} />
                </div>
              ))}
            </div>
            <Prova testo={b.evidenze.biologico ?? b.evidenze.iap} />
            <div><span className="label">Colture o comparti (almeno uno)</span>
              <div className="flex flex-wrap gap-1.5">
                {colture.map((c) => {
                  const on = b.criteri.colture?.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => setC("colture", on ? (b.criteri.colture ?? []).filter((x) => x !== c.id) : [...(b.criteri.colture ?? []), c.id])}
                      className={clsx("h-8 px-2.5 rounded-lg border text-[12px] font-semibold flex items-center gap-1.5 transition-colors", on ? "" : "border-ink-200 text-ink-600 hover:border-ink-300 bg-white")}
                      style={on ? { borderColor: c.colore, background: c.colore + "18" } : undefined}>
                      <span className="h-2 w-2 rounded-full" style={{ background: c.colore }} />{c.nome}
                    </button>
                  );
                })}
              </div></div>
            <Prova testo={b.evidenze.colture} />
          </div>

          {/* risultati */}
          <div className="min-h-0 flex flex-col">
            <div className="p-6 pb-4 space-y-4">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {(Object.keys(GIUDIZI) as Giudizio[]).map((g) => (
                  <button key={g} onClick={() => setVista(g)}
                    className={clsx("text-left rounded-2xl p-4 border-2 transition-all active:scale-[.98]", vista === g ? "" : "border-transparent bg-ink-50 hover:bg-ink-100")}
                    style={vista === g ? { borderColor: GIUDIZI[g].color, background: GIUDIZI[g].color + "0E" } : undefined}>
                    <div className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: GIUDIZI[g].color }}><span className="h-2 w-2 rounded-full" style={{ background: GIUDIZI[g].color }} />{GIUDIZI[g].l}</div>
                    <div className="text-[28px] font-extrabold tabular-nums tracking-tight leading-tight">{conta[g]}</div>
                    <div className="text-[11.5px] text-ink-500 leading-snug">{GIUDIZI[g].desc}</div>
                  </button>
                ))}
              </div>
              <SearchInput value={q} onChange={setQ} placeholder="Cerca azienda…" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
              {lista.length === 0 ? <Empty icon={<Scale size={26} />} title="Nessuna azienda in questo gruppo" /> : (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {lista.slice(0, 200).map(({ a, v }) => {
                      const gia = inclusiGia.has(a.id);
                      return (
                        <motion.div key={a.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className={clsx("rounded-2xl ring-1 px-4 py-3 flex items-center gap-3 transition-colors", sel.has(a.id) ? "ring-brand-300 bg-brand-50/50" : "ring-ink-100 bg-white")}>
                          {!gia ? <Checkbox checked={sel.has(a.id)} onChange={(x) => setSel((s) => { const n = new Set(s); if (x) n.add(a.id); else n.delete(a.id); return n; })} /> : <span className="w-5" />}
                          <Avatar name={a.denominazione} size={36} square={a.tipo === "PG"} />
                          <button onClick={() => apriAzienda(a.id)} className="flex-1 min-w-0 text-left">
                            <div className="font-bold text-[14.5px] truncate hover:text-brand-800">{titleCase(a.denominazione)}</div>
                            <div className="text-[11.5px] font-mono text-ink-400">{a.cuaa}{gia && <span className="font-sans ml-2 text-brand-700 font-semibold">già nell'elenco</span>}</div>
                          </button>
                          <div className="hidden md:flex flex-wrap justify-end gap-1 max-w-[55%]">
                            {v.voci.length === 0 && <span className="chip !h-6 !text-[11px] bg-ink-50 text-ink-500">Nessun requisito</span>}
                            {v.voci.map((x) => (
                              <span key={x.chiave} title={x.dettaglio} className={clsx("chip !h-6 !text-[11px]", x.esito === "ok" ? "bg-green-50 text-green-700" : x.esito === "ko" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700")}>
                                {x.esito === "ok" ? <Check size={11} strokeWidth={3} /> : x.esito === "ko" ? <X size={11} strokeWidth={3} /> : <HelpCircle size={11} />}{x.label}
                                {x.esito !== "ok" && <span className="font-medium opacity-70">· {x.dettaglio}</span>}
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {lista.length > 200 && <div className="text-center text-sm text-ink-400 py-2">… e altre {lista.length - 200}: usa la ricerca</div>}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-ink-100 flex items-center gap-3 bg-white">
              <div className="text-[13px] text-ink-500 flex-1">
                {sel.size > 0 ? <>Salvando, le <b className="text-ink-800">{sel.size}</b> aziende scelte vengono aggiunte all'elenco delle domande da fare di {ufficio.nome}.</> : <><b className="text-ink-800">{conta.idonea}</b> aziende idonee: seleziona quelle da mettere nell'elenco delle domande da fare.</>}
                {idoneeLibere.length > 0 && <button onClick={() => setSel((s) => new Set([...s, ...idoneeLibere]))} className="ml-2 font-semibold text-brand-800 hover:underline">Seleziona tutte le idonee</button>}
                <span className="block text-[11.5px] text-ink-400">Colture richieste: {b.criteri.colture?.map((id) => nomiColture[id]).join(", ") || "nessun vincolo"}</span>
              </div>
              <Button size="lg" icon={<Check size={18} strokeWidth={2.5} />} onClick={salvaBando} loading={salva.isPending || abb.isPending}>{pratica ? "Salva requisiti" : "Salva bando"}</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Prova({ testo }: { testo?: string }) {
  if (!testo) return null;
  return (
    <div className="-mt-2 flex gap-1.5 text-[11.5px] text-ink-500 italic leading-snug">
      <Quote size={11} className="shrink-0 mt-0.5 text-brand-500" /><span className="line-clamp-2">{testo}</span>
    </div>
  );
}
