import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, FileText, Image as ImageIcon, FileCode2, Plus, ScanText, Sparkles, Trash2, UploadCloud, Wand2, Building2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Field, NumberInput, TextInput } from "../components/ui/Inputs";
import { DatePicker } from "../components/ui/DatePicker";
import { Select } from "../components/ui/Select";
import { useFeedback } from "../components/ui/Feedback";
import { Badge } from "../components/ui/Misc";
import { analizzaFile, categoriaDi, sintesiAnalisi, type Analisi, type Fase } from "../lib/analisi";
import { tipoFile } from "../lib/analisi/estrazione";
import { CATEGORIE_DOC } from "../lib/domain";
import { eur, fileSize, fmtDate, titleCase } from "../lib/format";
import { useCaricaDocumento } from "../lib/queries";
import { useUfficio } from "../lib/ufficio";

type Stato = "attesa" | "analisi" | "pronto" | "salvataggio" | "salvato" | "errore";
interface Scelta { aziendaId: string | null; tipo: string; titolo: string; data: string | null; scadenza: string | null; numero: string; pratica: string | null; importo: number | null }
interface Item { id: string; file: File; stato: Stato; fase?: Fase; progresso?: number; analisi?: Analisi; scelta?: Scelta; errore?: string }

const FASE_LABEL: Record<Fase, string> = { lettura: "Lettura del file", ocr: "Riconoscimento del testo", classificazione: "Analisi del contenuto" };
const METODO_LABEL: Record<string, string> = { pdf: "Testo del PDF", ocr: "Testo letto con OCR", xml: "Fattura elettronica", testo: "File di testo", nome: "Solo nome del file" };

export function CaricamentoIntelligente({ open, onClose, aziendaId }: { open: boolean; onClose: () => void; aziendaId?: string }) {
  const { aziende, pratiche, azById, praticaById } = useUfficio();
  const carica = useCaricaDocumento();
  const { toast, confirm } = useFeedback();
  const [items, setItems] = useState<Item[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const coda = useRef<Item[]>([]);
  const ctxRef = useRef({ aziende, pratiche, aziendaId });
  ctxRef.current = { aziende, pratiche, aziendaId };

  useEffect(() => { if (open) { setItems([]); setSel(null); coda.current = []; } }, [open]);

  const patch = (id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const patchScelta = (id: string, p: Partial<Scelta>) => setItems((xs) => xs.map((x) => (x.id === id && x.scelta ? { ...x, scelta: { ...x.scelta, ...p } } : x)));

  // coda di analisi: un file alla volta
  const avvia = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (coda.current.length) {
        const it = coda.current.shift()!;
        patch(it.id, { stato: "analisi", fase: "lettura", progresso: 0 });
        try {
          const { aziende: az, pratiche: pr, aziendaId: attesa } = ctxRef.current;
          const a = await analizzaFile(it.file, { aziende: az, pratiche: pr, aziendaAttesa: attesa }, (fase, progresso) => patch(it.id, { fase, progresso }));
          patch(it.id, {
            stato: "pronto", analisi: a,
            scelta: {
              aziendaId: attesa ?? a.aziendaTrovata?.id ?? null, tipo: a.tipo, titolo: a.titolo, data: a.campi.dataDocumento, scadenza: a.campi.scadenza,
              numero: a.campi.numero ?? "", pratica: a.campi.pratica, importo: a.campi.importo,
            },
          });
        } catch (e) {
          patch(it.id, { stato: "errore", errore: (e as Error).message });
        }
      }
    } finally { running.current = false; }
  }, []);

  const aggiungi = (files: FileList | File[]) => {
    const nuovi = [...files].filter((f) => f.size <= 20 * 1024 * 1024).map((file) => ({ id: crypto.randomUUID(), file, stato: "attesa" as Stato }));
    const scartati = [...files].length - nuovi.length;
    if (scartati) toast("error", `${scartati} file superano i 20 MB`);
    if (!nuovi.length) return;
    coda.current.push(...nuovi);
    setItems((xs) => [...xs, ...nuovi]);
    setSel((s) => s ?? nuovi[0].id);
    setTimeout(avvia, 0);
  };

  // incolla da appunti
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => { const f = e.clipboardData?.files; if (f?.length) aggiungi(f); };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pronti = items.filter((x) => x.stato === "pronto");
  const archiviabili = pronti.filter((x) => x.scelta?.aziendaId);
  const inCorso = items.some((x) => x.stato === "analisi" || x.stato === "attesa");
  const corrente = items.find((x) => x.id === sel) ?? items[0];

  const archivia = async () => {
    let ok = 0;
    for (const it of archiviabili) {
      const s = it.scelta!, a = it.analisi!;
      patch(it.id, { stato: "salvataggio" });
      try {
        await carica.mutateAsync({
          file: it.file,
          meta: {
            azienda_id: s.aziendaId!, categoria: categoriaDi(s.tipo), tipo: s.tipo, titolo: s.titolo.trim() || s.tipo,
            numero: s.numero.trim() || null, data_doc: s.data, scadenza: s.scadenza, pratica_id: s.pratica, note: null,
            importo: s.importo, controparte: a.campi.controparte, foglio: a.campi.foglio, particelle: a.campi.particelle, superficie_ha: a.campi.superficieHa,
            analisi: sintesiAnalisi(a, s.tipo), testo: a.testo ? a.testo.slice(0, 20000) : null,
          },
        });
        patch(it.id, { stato: "salvato" });
        ok++;
      } catch (e) {
        patch(it.id, { stato: "errore", errore: (e as Error).message });
      }
    }
    if (ok) toast("success", ok === 1 ? "Documento archiviato" : `${ok} documenti archiviati`);
    if (ok && ok === archiviabili.length && !items.some((x) => x.stato === "errore")) setTimeout(onClose, 400);
  };

  const chiudi = async () => {
    if (pronti.length && !(await confirm({ title: "Chiudere senza archiviare?", message: `${pronti.length} documenti analizzati non sono ancora stati archiviati.`, confirmLabel: "Chiudi" }))) return;
    onClose();
  };

  const opzioniTipo = useMemo(() => CATEGORIE_DOC.flatMap((c) => c.tipi.map((t) => ({ value: t, label: t, group: c.l }))), []);
  const opzioniAziende = useMemo(() => aziende.map((a) => ({ value: a.id, label: titleCase(a.denominazione), hint: a.cuaa })), [aziende]);

  return (
    <Modal open={open} onClose={chiudi} size="xl" hideClose className="sm:h-[86vh]" bodyClassName="!px-0 !pb-0 flex flex-col">
      <div className="px-8 pt-7 pb-5 flex items-start gap-4 border-b border-ink-100">
        <span className="h-12 w-12 rounded-2xl grid place-items-center bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-[0_8px_20px_-8px_rgba(0,80,42,.6)]"><Sparkles size={22} /></span>
        <div className="flex-1">
          <h2 className="text-xl font-bold tracking-tight">Caricamento intelligente</h2>
          <p className="text-sm text-ink-500 mt-0.5">
            Trascina i documenti: li leggo, capisco di cosa si tratta, trovo l'azienda e compilo date, numeri e scadenze.
            {aziendaId && azById.get(aziendaId) && <> Azienda: <b className="text-ink-700">{titleCase(azById.get(aziendaId)!.denominazione)}</b>.</>}
          </p>
        </div>
        <Button variant="ghost" onClick={chiudi}>Chiudi</Button>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 p-8 flex">
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); aggiungi(e.dataTransfer.files); }}
            onClick={() => input.current?.click()}
            animate={{ scale: drag ? 1.01 : 1 }}
            className={clsx("flex-1 cursor-pointer rounded-[28px] border-2 border-dashed grid place-items-center text-center p-10 transition-colors", drag ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/40")}
          >
            <div>
              <motion.div animate={{ y: drag ? -6 : [0, -6, 0] }} transition={drag ? {} : { duration: 3, repeat: Infinity, ease: "easeInOut" }} className="mx-auto h-20 w-20 rounded-3xl bg-brand-50 text-brand-700 grid place-items-center mb-5">
                <UploadCloud size={36} />
              </motion.div>
              <div className="text-2xl font-extrabold tracking-tight">Trascina qui i documenti</div>
              <div className="text-ink-500 mt-2">anche più file insieme · oppure <span className="text-brand-700 font-semibold">sfoglia</span> · oppure incolla</div>
              <div className="mt-8 flex flex-wrap justify-center gap-2.5">
                {[["PDF", <FileText size={14} key="p" />], ["Foto e scansioni", <ImageIcon size={14} key="i" />], ["Fatture XML / P7M", <FileCode2 size={14} key="x" />]].map(([l, i]) => (
                  <span key={l as string} className="chip !h-8 bg-white ring-1 ring-ink-100 text-ink-600">{i}{l}</span>
                ))}
              </div>
              <div className="mt-8 grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
                <Passo n={1} t="Lettura" d="Testo dei PDF, OCR per foto e scansioni" />
                <Passo n={2} t="Riconoscimento" d="Oltre 60 tipi di documento agricolo" />
                <Passo n={3} t="Compilazione" d="Azienda, date, scadenze, numeri, particelle" />
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid lg:grid-cols-[340px_1fr]">
          {/* elenco file */}
          <div className="border-r border-ink-100 flex flex-col min-h-0 bg-ink-50/50">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <AnimatePresence initial={false}>
                {items.map((it) => (
                  <motion.button
                    key={it.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    onClick={() => setSel(it.id)}
                    className={clsx("w-full text-left rounded-2xl p-3 flex items-center gap-3 border transition-all", corrente?.id === it.id ? "bg-white border-brand-200 shadow-card" : "border-transparent hover:bg-white")}
                  >
                    <Miniatura it={it} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{it.file.name}</div>
                      <div className="text-[12px] text-ink-500 truncate mt-0.5">
                        {it.stato === "attesa" && "In coda…"}
                        {it.stato === "analisi" && <span className="text-brand-700 font-medium">{FASE_LABEL[it.fase ?? "lettura"]}{it.fase === "ocr" && it.progresso != null ? ` ${Math.round(it.progresso * 100)}%` : "…"}</span>}
                        {(it.stato === "pronto" || it.stato === "salvataggio") && it.scelta?.tipo}
                        {it.stato === "salvato" && <span className="text-brand-700 font-semibold">Archiviato</span>}
                        {it.stato === "errore" && <span className="text-red-600">{it.errore}</span>}
                      </div>
                      {it.stato === "analisi" && (
                        <div className="mt-1.5 h-1 rounded-full bg-ink-100 overflow-hidden">
                          <motion.div className="h-full bg-brand-500" animate={{ width: `${Math.max(8, (it.fase === "lettura" ? 0.2 : it.fase === "ocr" ? 0.2 + (it.progresso ?? 0) * 0.65 : 0.92) * 100)}%` }} />
                        </div>
                      )}
                    </div>
                    {(it.stato === "pronto" || it.stato === "salvataggio") && it.analisi && <Anello v={it.scelta?.tipo === it.analisi.tipo ? it.analisi.confidenza : 1} manuale={it.scelta?.tipo !== it.analisi.tipo} />}
                    {it.stato === "salvato" && <span className="h-7 w-7 rounded-full bg-brand-600 grid place-items-center"><Check size={15} className="text-white" strokeWidth={3} /></span>}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
            <div className="p-3 border-t border-ink-100">
              <Button variant="secondary" className="w-full" icon={<Plus size={16} />} onClick={() => input.current?.click()}>Aggiungi file</Button>
            </div>
          </div>

          {/* dettaglio */}
          <div className="min-h-0 overflow-y-auto p-7">
            <AnimatePresence mode="wait">
              {corrente && (
                <motion.div key={corrente.id + corrente.stato} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                  {(corrente.stato === "attesa" || corrente.stato === "analisi") && <InAnalisi it={corrente} />}
                  {corrente.stato === "errore" && <div className="rounded-2xl bg-red-50 text-red-700 p-5 flex gap-3"><AlertTriangle size={20} /> {corrente.errore}</div>}
                  {corrente.stato === "salvato" && <div className="rounded-2xl bg-brand-50 text-brand-800 p-5 flex gap-3 font-semibold"><Check size={20} /> Archiviato come «{corrente.scelta?.tipo}»</div>}
                  {(corrente.stato === "pronto" || corrente.stato === "salvataggio") && corrente.analisi && corrente.scelta && (
                    <Revisione
                      it={corrente}
                      opzioniTipo={opzioniTipo}
                      opzioniAziende={opzioniAziende}
                      aziendaFissa={!!aziendaId}
                      nomeAzienda={(id) => (azById.get(id) ? titleCase(azById.get(id)!.denominazione) : "")}
                      pratiche={pratiche.map((p) => ({ value: p.id, label: p.nome, hint: p.codice ?? undefined }))}
                      nomePratica={(id) => praticaById.get(id)?.nome ?? ""}
                      onChange={(p) => patchScelta(corrente.id, p)}
                      onRemove={() => { setItems((xs) => xs.filter((x) => x.id !== corrente.id)); setSel(null); }}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <input ref={input} type="file" multiple className="hidden" accept=".pdf,.xml,.p7m,.txt,.csv,image/*" onChange={(e) => { if (e.target.files) aggiungi(e.target.files); e.target.value = ""; }} />

      {items.length > 0 && (
        <div className="px-8 py-4 border-t border-ink-100 bg-white flex items-center gap-3">
          <div className="text-sm text-ink-500">
            {inCorso ? <span className="flex items-center gap-2"><ScanText size={16} className="text-brand-600 animate-pulse" /> Analisi in corso…</span>
              : `${pronti.length} da archiviare${pronti.length - archiviabili.length ? ` · ${pronti.length - archiviabili.length} senza azienda` : ""}`}
          </div>
          <div className="flex-1" />
          <Button size="lg" icon={<Check size={18} strokeWidth={2.5} />} disabled={!archiviabili.length} loading={carica.isPending} onClick={archivia}>
            Archivia {archiviabili.length > 0 ? archiviabili.length : ""} {archiviabili.length === 1 ? "documento" : "documenti"}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function Passo({ n, t, d }: { n: number; t: string; d: string }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-ink-100 p-4">
      <div className="h-7 w-7 rounded-full bg-brand-800 text-white text-xs font-bold grid place-items-center mb-2">{n}</div>
      <div className="font-bold text-[14px]">{t}</div>
      <div className="text-[12.5px] text-ink-500 leading-snug">{d}</div>
    </div>
  );
}

function Miniatura({ it }: { it: Item }) {
  const t = tipoFile(it.file);
  const src = it.analisi?.anteprima;
  return (
    <span className="relative h-12 w-10 shrink-0 rounded-lg overflow-hidden bg-white ring-1 ring-ink-100 grid place-items-center">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : t === "immagine" ? <ImageIcon size={18} className="text-ink-400" /> : t === "xml" ? <FileCode2 size={18} className="text-ink-400" /> : <FileText size={18} className="text-ink-400" />}
      {it.stato === "analisi" && <motion.span className="absolute inset-x-0 h-4 bg-gradient-to-b from-transparent via-brand-400/50 to-transparent" animate={{ y: [-16, 48] }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} />}
    </span>
  );
}

function Anello({ v, manuale }: { v: number; manuale?: boolean }) {
  const r = 12, c = 2 * Math.PI * r;
  const col = manuale ? "#2C7C28" : v >= 0.75 ? "#16A34A" : v >= 0.45 ? "#EA8C0C" : "#DC2626";
  return (
    <span className="relative h-8 w-8 shrink-0" title={manuale ? "Scelto a mano" : `Confidenza ${Math.round(v * 100)}%`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 -rotate-90">
        <circle cx="16" cy="16" r={r} fill="none" stroke="#EEF2EF" strokeWidth="3.5" />
        <motion.circle cx="16" cy="16" r={r} fill="none" stroke={col} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ duration: 0.8 }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[9px] font-bold" style={{ color: col }}>{manuale ? <Check size={11} strokeWidth={3} /> : Math.round(v * 100)}</span>
    </span>
  );
}

function InAnalisi({ it }: { it: Item }) {
  const fasi: Fase[] = tipoFile(it.file) === "immagine" || it.fase === "ocr" ? ["lettura", "ocr", "classificazione"] : ["lettura", "classificazione"];
  const idx = it.stato === "attesa" ? -1 : fasi.indexOf(it.fase ?? "lettura");
  return (
    <div className="max-w-md mx-auto pt-10 text-center">
      <div className="relative mx-auto h-28 w-24 rounded-2xl bg-white ring-1 ring-ink-100 shadow-card overflow-hidden grid place-items-center">
        <FileText size={36} className="text-ink-300" />
        <motion.span className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-brand-400/40 to-transparent" animate={{ y: [-40, 112] }} transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }} />
      </div>
      <div className="mt-6 font-bold text-lg truncate">{it.file.name}</div>
      <div className="text-sm text-ink-500">{fileSize(it.file.size)}</div>
      <div className="mt-8 space-y-3 text-left">
        {fasi.map((f, i) => (
          <div key={f} className={clsx("flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors", i === idx ? "bg-brand-50" : "bg-ink-50/60")}>
            <span className={clsx("h-7 w-7 rounded-full grid place-items-center text-xs font-bold", i < idx ? "bg-brand-600 text-white" : i === idx ? "bg-white text-brand-700 ring-2 ring-brand-400" : "bg-white text-ink-300")}>
              {i < idx ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={clsx("font-semibold text-[14px] flex-1", i > idx && "text-ink-400")}>{FASE_LABEL[f]}</span>
            {i === idx && f === "ocr" && it.progresso != null && <span className="text-sm font-bold text-brand-700 tabular-nums">{Math.round(it.progresso * 100)}%</span>}
            {i === idx && f !== "ocr" && <span className="h-4 w-4 rounded-full border-2 border-brand-300 border-t-brand-700 animate-spin" />}
          </div>
        ))}
      </div>
      {fasi.includes("ocr") && <p className="text-xs text-ink-400 mt-4">La prima lettura con OCR scarica il dizionario italiano: può richiedere qualche secondo.</p>}
    </div>
  );
}

function Revisione({ it, opzioniTipo, opzioniAziende, aziendaFissa, nomeAzienda, pratiche, nomePratica, onChange, onRemove }: {
  it: Item; opzioniTipo: { value: string; label: string; group: string }[]; opzioniAziende: { value: string; label: string; hint: string }[];
  aziendaFissa: boolean; nomeAzienda: (id: string) => string; pratiche: { value: string; label: string; hint?: string }[]; nomePratica: (id: string) => string;
  onChange: (p: Partial<Scelta>) => void; onRemove: () => void;
}) {
  const a = it.analisi!, s = it.scelta!;
  const top = a.candidati[0];
  const riconosciuto = a.tipo !== "Altro";
  const extra = [
    a.campi.foglio && ["Foglio", a.campi.foglio],
    a.campi.particelle && ["Particelle", a.campi.particelle],
    a.campi.superficieHa != null && ["Superficie", `${a.campi.superficieHa.toLocaleString("it-IT", { maximumFractionDigits: 4 })} ha`],
    a.campi.controparte && ["Controparte", a.campi.controparte],
    a.campi.cuaa.length > 0 && ["CUAA nel documento", a.campi.cuaa.join(", ")],
  ].filter(Boolean) as [string, string][];
  const [mostraTesto, setMostraTesto] = useState(false);

  return (
    <div className="space-y-6">
      {/* esito */}
      <div className={clsx("rounded-3xl p-5 ring-1", riconosciuto ? "bg-gradient-to-br from-brand-50 to-white ring-brand-100" : "bg-amber-50/60 ring-amber-100")}>
        <div className="flex items-start gap-4">
          <span className={clsx("h-12 w-12 rounded-2xl grid place-items-center shrink-0", riconosciuto ? "bg-brand-700 text-white" : "bg-amber-500 text-white")}>{riconosciuto ? <Wand2 size={22} /> : <Search size={22} />}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-wider text-ink-400">{riconosciuto ? "Ho riconosciuto" : "Non sono sicuro"}</div>
            <div className="text-[22px] font-extrabold tracking-tight leading-tight">{riconosciuto ? a.tipo : "Tipo da confermare"}</div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {top && <Badge tone={a.confidenza >= 0.75 ? "green" : a.confidenza >= 0.45 ? "amber" : "red"}>Confidenza {Math.round(a.confidenza * 100)}%</Badge>}
              <Badge>{METODO_LABEL[a.metodo]}{a.pagine > 1 ? ` · ${a.pagine} pagine` : ""}</Badge>
            </div>
          </div>
          <button onClick={onRemove} className="h-10 w-10 grid place-items-center rounded-xl text-ink-400 hover:text-red-600 hover:bg-red-50 transition" title="Rimuovi dall'elenco"><Trash2 size={17} /></button>
        </div>
        {top?.indizi.length ? (
          <div className="mt-4">
            <div className="text-[12px] font-semibold text-ink-500 mb-1.5">Perché</div>
            <div className="flex flex-wrap gap-1.5">{top.indizi.slice(0, 6).map((i) => <span key={i} className="chip !h-6 !text-[11.5px] bg-white ring-1 ring-ink-100 text-ink-700"><Check size={11} className="text-brand-600" />{i}</span>)}</div>
          </div>
        ) : null}
        {a.candidati.length > 1 && (
          <div className="mt-4">
            <div className="text-[12px] font-semibold text-ink-500 mb-1.5">Potrebbe anche essere</div>
            <div className="flex flex-wrap gap-2">
              {a.candidati.slice(0, 4).map((c) => (
                <button key={c.tipo} onClick={() => onChange({ tipo: c.tipo, titolo: s.titolo.startsWith(s.tipo) ? s.titolo.replace(s.tipo, c.tipo) : s.titolo })}
                  className={clsx("h-9 px-3 rounded-xl text-[13px] font-semibold border transition-all active:scale-[.97] flex items-center gap-2", s.tipo === c.tipo ? "bg-brand-800 text-white border-brand-800" : "bg-white border-ink-200 hover:border-ink-300")}>
                  {c.tipo}<span className={clsx("text-[11px] tabular-nums", s.tipo === c.tipo ? "text-white/70" : "text-ink-400")}>{Math.round(c.confidenza * 100)}%</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {a.avvisi.length > 0 && (
        <div className="space-y-2">
          {a.avvisi.map((w) => <div key={w} className="rounded-2xl bg-amber-50 text-amber-800 px-4 py-3 text-[13.5px] font-medium flex items-center gap-2.5"><AlertTriangle size={16} className="shrink-0" />{w}</div>)}
        </div>
      )}

      {/* campi */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Azienda" className="sm:col-span-2" hint={a.aziendaTrovata && !aziendaFissa ? (a.aziendaTrovata.come === "cuaa" ? `Trovata dal CUAA ${a.aziendaTrovata.valore} presente nel documento` : "Trovata dal nome presente nel documento") : !s.aziendaId ? "Nessuna azienda dell'ufficio citata nel documento: sceglila tu" : undefined}>
          {aziendaFissa ? (
            <div className="h-12 rounded-xl bg-ink-50 px-4 flex items-center gap-2.5 font-semibold"><Building2 size={16} className="text-ink-400" />{nomeAzienda(s.aziendaId!)}</div>
          ) : (
            <Select value={s.aziendaId} onChange={(v) => onChange({ aziendaId: v })} options={opzioniAziende} searchable placeholder="Scegli l'azienda…" icon={<Building2 size={16} />} />
          )}
        </Field>
        <Field label="Tipo di documento" className="sm:col-span-2"><Select value={s.tipo === "Altro" ? "Altro" : s.tipo} onChange={(v) => onChange({ tipo: v })} options={opzioniTipo} searchable /></Field>
        <Field label="Titolo" className="sm:col-span-2"><TextInput value={s.titolo} onChange={(e) => onChange({ titolo: e.target.value })} /></Field>
        <Field label="Data del documento" hint={a.campi.dataDocumento ? "Letta dal documento" : undefined}><DatePicker value={s.data} onChange={(v) => onChange({ data: v })} /></Field>
        <Field label="Scadenza" hint={a.campi.scadenza ? `Letta dal documento · ${fmtDate(a.campi.scadenza)}` : "Nessuna scadenza trovata"}><DatePicker value={s.scadenza} onChange={(v) => onChange({ scadenza: v })} /></Field>
        <Field label="Numero" optional><TextInput value={s.numero} onChange={(e) => onChange({ numero: e.target.value })} className="font-mono" /></Field>
        <Field label="Pratica collegata" optional hint={a.campi.pratica ? `Riconosciuta: ${nomePratica(a.campi.pratica)}` : undefined}>
          <Select value={s.pratica} onChange={(v) => onChange({ pratica: v })} clearable onClear={() => onChange({ pratica: null })} placeholder="Nessuna" options={pratiche} />
        </Field>
        {(s.importo != null || ["fatture", "pagamenti"].includes(categoriaDi(s.tipo))) && (
          <Field label="Importo" hint={a.campi.importo != null ? `Letto dal documento: ${eur(a.campi.importo, 2)}` : undefined}><NumberInput value={s.importo} onChange={(v) => onChange({ importo: v })} suffix="€" /></Field>
        )}
      </div>

      {extra.length > 0 && (
        <div className="rounded-2xl ring-1 ring-ink-100 divide-y divide-ink-100">
          <div className="px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-ink-400">Altri dati trovati</div>
          {extra.map(([k, v]) => <div key={k} className="px-4 py-2.5 flex justify-between gap-4 text-[13.5px]"><span className="text-ink-500">{k}</span><span className="font-semibold text-right break-all">{v}</span></div>)}
        </div>
      )}

      {a.testo && (
        <div>
          <button onClick={() => setMostraTesto((x) => !x)} className="text-[13px] font-semibold text-brand-700 hover:text-brand-900">{mostraTesto ? "Nascondi" : "Mostra"} il testo letto</button>
          <AnimatePresence>
            {mostraTesto && (
              <motion.pre initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 max-h-64 overflow-auto rounded-2xl bg-ink-50 p-4 text-[11.5px] leading-relaxed whitespace-pre-wrap text-ink-600 font-mono">
                {a.testo.slice(0, 6000)}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
