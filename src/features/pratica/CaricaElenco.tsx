import { AlertTriangle, Check, ChevronDown, CircleDashed, FileSpreadsheet, PenLine, Printer, Send, Trash2, UploadCloud, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Wizard, type WizardStep } from "../../components/ui/Wizard";
import { ChoiceCard } from "../../components/ui/Inputs";
import { Select } from "../../components/ui/Select";
import { useFeedback } from "../../components/ui/Feedback";
import { useUfficio } from "../../lib/ufficio";
import { STATI } from "../../lib/domain";
import { fileSize, titleCase } from "../../lib/format";
import {
  analizzaFile, CAMPI_DOMANDA, cuaaDa, data, esito as esitoDa, leggiExcel, stato as statoDa, testo, valore,
  type Analisi, type KDomanda,
} from "../../lib/excel";
import { useAggiungiVoci, useCaricaFatte, useCaricaModello, type NuovoFile } from "../../lib/queries";
import { chiaveCuaa, chiaveNome, riscontro, type Fonte } from "../../lib/riscontro";
import type { Pratica, PraticaFile, RigaFile } from "../../lib/types";
import { Avanzamento, Numero } from "../import/Comuni";
import { NOME_STATO } from "./ElencoVoci";

interface FileCaricato { id: string; file: File; analisi: Analisi<KDomanda>[]; scelta: number; errore?: string }

const CHIAVE: KDomanda[] = ["cuaa", "denominazione", "stato"];

/** Righe normalizzate di un file analizzato. */
function righeDa(f: FileCaricato): { righe: RigaFile[]; colonne: Record<string, string> } {
  const a = f.analisi[f.scelta];
  const colonne: Record<string, string> = {};
  for (const [k, m] of Object.entries(a.mappa)) if (m) colonne[k] = a.intestazioni[(m as { col: number }).col];
  const righe = a.righe.map((r, i): RigaFile => {
    const grezzo = valore(a, r, "cuaa");
    const c = cuaaDa(grezzo);
    return {
      riga: i + 2 + (a.rigaIntestazione || 0),
      cuaa: c?.cuaa ?? (testo(grezzo)?.toUpperCase().replace(/\s+/g, "") || null),
      denominazione: testo(valore(a, r, "denominazione")),
      stato: a.mappa.stato ? statoDa(valore(a, r, "stato")) : null,
      numero: testo(valore(a, r, "numero")),
      data: data(valore(a, r, "data_presentazione")),
      esito: esitoDa(valore(a, r, "esito")),
      note: testo(valore(a, r, "note")),
    };
  }).filter((x) => x.cuaa || x.denominazione);
  return { righe, colonne };
}

const chiaveRiga = (r: { cuaa: string | null; denominazione: string | null }) => chiaveCuaa(r.cuaa) || "n:" + chiaveNome(r.denominazione);

/**
 * Caricamento di un file Excel in una pratica:
 *  - «modello»: l'elenco delle domande da fare (uno solo, si può sostituire o integrare);
 *  - «fatte»: uno o più file delle domande fatte / stampate / in compilazione.
 * Non crea né modifica aziende in anagrafica.
 */
export function CaricaElenco({ open, onClose, pratica, tipo }: { open: boolean; onClose: () => void; pratica: Pratica; tipo: "modello" | "fatte" }) {
  const { ufficio, voci, praticaFile } = useUfficio();
  const { toast } = useFeedback();
  const caricaModello = useCaricaModello();
  const caricaFatte = useCaricaFatte();
  const aggiungiVoci = useAggiungiVoci();
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<FileCaricato[]>([]);
  const [statoDef, setStatoDef] = useState<"C" | "S" | "R">("R");
  const [modo, setModo] = useState<"sostituisci" | "integra">("sostituisci");
  const [lavoro, setLavoro] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const isModello = tipo === "modello";

  const miei = useMemo(() => praticaFile.filter((f) => f.pratica_id === pratica.id), [praticaFile, pratica.id]);
  const precedente = miei.find((f) => f.tipo === "modello") ?? null;
  const vociPratica = useMemo(() => voci.filter((v) => v.pratica_id === pratica.id), [voci, pratica.id]);

  useEffect(() => { if (open) { setStep(0); setFiles([]); setStatoDef("R"); setModo("sostituisci"); setLavoro(null); setFatto(false); } }, [open]);

  const aggiungi = async (lista: FileList | File[]) => {
    const nuovi = [...lista].slice(0, isModello ? 1 : 20);
    if (isModello) setFiles([]);
    for (const file of nuovi) {
      const id = crypto.randomUUID();
      setFiles((x) => [...x, { id, file, analisi: [], scelta: 0 }]);
      try {
        const fogli = await leggiExcel(file);
        const analisi = analizzaFile(fogli, CAMPI_DOMANDA, /domand|elenco|fatt|rilasc|stamp/i).filter((a) => a.righe.length > 0);
        if (!analisi.length) throw new Error("nessun dato trovato");
        setFiles((x) => x.map((f) => (f.id === id ? { ...f, analisi } : f)));
      } catch (e) {
        setFiles((x) => x.map((f) => (f.id === id ? { ...f, errore: "Impossibile leggere il file: " + (e as Error).message } : f)));
      }
    }
  };
  const setMappa = (id: string, k: KDomanda, col: number | null) => setFiles((x) => x.map((f) => {
    if (f.id !== id) return f;
    const a = { ...f.analisi[f.scelta], mappa: { ...f.analisi[f.scelta].mappa } };
    for (const kk of Object.keys(a.mappa) as KDomanda[]) if (col != null && a.mappa[kk]?.col === col) delete a.mappa[kk];
    if (col == null) delete a.mappa[k]; else a.mappa[k] = { col, confidenza: 1, perche: "scelta a mano" };
    const analisi = [...f.analisi]; analisi[f.scelta] = a;
    return { ...f, analisi };
  }));

  const validi = useMemo(() => files.filter((f) => f.analisi.length && !f.errore), [files]);
  const parsed = useMemo(() => (step >= 2 ? validi.map((f) => ({ f, ...righeDa(f) })) : []), [validi, step]);

  // ---------- anteprima: elenco da fare ----------
  const anteprimaModello = useMemo(() => {
    if (!isModello || !parsed[0]) return null;
    const visti = new Set<string>();
    const unici: RigaFile[] = [];
    let doppioni = 0;
    for (const r of parsed[0].righe) { const k = chiaveRiga(r); if (visti.has(k)) { doppioni++; continue; } visti.add(k); unici.push(r); }
    const presenti = new Set(vociPratica.map(chiaveRiga));
    const nuoviDaIntegrare = unici.filter((r) => !presenti.has(chiaveRiga(r)));
    const senzaCuaa = unici.filter((r) => !r.cuaa).length;
    const finte = unici.map((r, i) => ({ id: "x" + i, pratica_id: pratica.id, ufficio_id: ufficio.id, file_id: null, cuaa: r.cuaa, denominazione: r.denominazione, extra: {}, stato_manuale: null, numero: null, data_presentazione: null, esito: null, motivi: [], riesame: null, note: r.note, ordine: i, created_at: "", updated_at: "", updated_by: null }));
    const ris = miei.some((f) => f.tipo === "fatte") ? riscontro(finte, miei) : null;
    return { unici, doppioni, senzaCuaa, nuoviDaIntegrare, ris };
  }, [isModello, parsed, vociPratica, miei, pratica.id, ufficio.id]);

  // ---------- anteprima: domande fatte ----------
  const anteprimaFatte = useMemo(() => {
    if (isModello || !parsed.length) return null;
    const ora = new Date().toISOString();
    const nuovi: PraticaFile[] = parsed.map(({ f, righe, colonne }) => ({ id: "nuovo-" + f.id, pratica_id: pratica.id, ufficio_id: ufficio.id, tipo: "fatte", nome: f.file.name, righe, colonne, stato_predefinito: statoDef, n_righe: righe.length, storage_path: null, created_at: ora, created_by: null }));
    const prima = riscontro(vociPratica, miei);
    const dopo = riscontro(vociPratica, [...miei, ...nuovi]);
    const cambiano = dopo.voci.filter((v, i) => v.stato !== prima.voci[i].stato).length;
    const fuoriNuovi = dopo.fuori.filter((x) => x.file.id.startsWith("nuovo-"));
    return { nuovi, prima, dopo, cambiano, fuoriNuovi };
  }, [isModello, parsed, statoDef, vociPratica, miei, pratica.id, ufficio.id]);

  const esegui = async () => {
    try {
      if (isModello && anteprimaModello && parsed[0]) {
        if (precedente && modo === "integra") {
          setLavoro("Aggiungo i nuovi nominativi all'elenco…");
          const base = vociPratica.reduce((m, v) => Math.max(m, v.ordine), 0) + 1;
          await aggiungiVoci.mutateAsync(anteprimaModello.nuoviDaIntegrare.map((r, i) => ({ pratica_id: pratica.id, ufficio_id: ufficio.id, file_id: precedente.id, cuaa: r.cuaa, denominazione: r.denominazione, note: r.note, ordine: base + i })));
        } else {
          setLavoro("Salvo l'elenco delle domande da fare…");
          const nuovo: NuovoFile = { file: parsed[0].f.file, righe: anteprimaModello.unici, colonne: parsed[0].colonne };
          await caricaModello.mutateAsync({ pratica_id: pratica.id, ufficio_id: ufficio.id, nuovo, precedente });
        }
      } else if (!isModello) {
        setLavoro("Salvo i file e faccio il riscontro…");
        await caricaFatte.mutateAsync({ pratica_id: pratica.id, ufficio_id: ufficio.id, stato_predefinito: statoDef, nuovi: parsed.map(({ f, righe, colonne }) => ({ file: f.file, righe, colonne })) });
      }
      setFatto(true);
    } catch (e) { toast("error", "Caricamento non riuscito", (e as Error).message); }
    finally { setLavoro(null); }
  };

  const fileStep: WizardStep = {
    key: "file", title: "File", canNext: validi.length > 0 && files.every((f) => f.analisi.length || f.errore),
    question: isModello ? (precedente ? "Carica il nuovo elenco delle domande da fare" : "Carica l'elenco delle domande da fare") : "Carica le domande fatte, stampate o in compilazione",
    hint: isModello
      ? "Un file Excel con i nominativi che devono fare questa domanda. Resta salvato nella pratica: potrai modificarlo, sostituirlo o eliminarlo. L'anagrafica non viene toccata."
      : "Anche più file insieme (per esempio le rilasciate e le stampate). Li confronto con l'elenco delle domande da fare.",
    content: (
      <div className="space-y-4">
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); aggiungi(e.dataTransfer.files); }}
          onClick={() => input.current?.click()} animate={{ scale: drag ? 1.015 : 1 }}
          className={clsx("cursor-pointer rounded-3xl border-2 border-dashed text-center transition-colors", files.length ? "p-5" : "p-10", drag ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/40")}
        >
          <div className={clsx("mx-auto rounded-2xl bg-brand-50 text-brand-700 grid place-items-center", files.length ? "h-10 w-10 mb-2" : "h-16 w-16 mb-4")}><UploadCloud size={files.length ? 20 : 30} /></div>
          <div className="font-bold">{files.length ? (isModello ? "Scegli un altro file" : "Aggiungi altri file") : "Trascina qui il file Excel"}</div>
          {!files.length && <div className="text-sm text-ink-500 mt-1">oppure <span className="text-brand-700 font-semibold">sfoglia</span> · .xlsx, .xls, .csv{isModello ? "" : " · anche più file"}</div>}
        </motion.div>
        <input ref={input} type="file" multiple={!isModello} accept=".xlsx,.xls,.xlsm,.csv,.ods" className="hidden" onChange={(e) => { if (e.target.files) aggiungi(e.target.files); e.target.value = ""; }} />
        {files.map((f) => <SchedaFile key={f.id} f={f} onRemove={() => setFiles((x) => x.filter((y) => y.id !== f.id))} onFoglio={(i) => setFiles((x) => x.map((y) => (y.id === f.id ? { ...y, scelta: i } : y)))} />)}
      </div>
    ),
  };

  const colonneStep: WizardStep = {
    key: "colonne", title: "Colonne", question: "Ho riconosciuto queste colonne",
    hint: "Riconosciute dall'intestazione e dal contenuto. Correggi solo se serve.",
    canNext: validi.every((f) => f.analisi[f.scelta].mappa.cuaa || f.analisi[f.scelta].mappa.denominazione || (f.analisi[f.scelta].mappa.cognome && f.analisi[f.scelta].mappa.nome)),
    content: (
      <div className="space-y-6">
        {validi.map((f) => <MappaFile key={f.id} f={f} onChange={(k, c) => setMappa(f.id, k, c)} />)}
        {!isModello && (
          <div>
            <span className="label">Cosa contengono questi file?</span>
            <p className="text-[13px] text-ink-500 -mt-1 mb-3">Vale per le righe senza uno stato riconoscibile{validi.some((f) => f.analisi[f.scelta].mappa.stato) ? " (dove c'è la colonna «stato» uso quella)" : ""}.</p>
            <div className="grid sm:grid-cols-3 gap-2.5">
              {([["R", <Send size={18} key="r" />], ["S", <Printer size={18} key="s" />], ["C", <PenLine size={18} key="c" />]] as const).map(([k, ic]) => (
                <ChoiceCard key={k} selected={statoDef === k} onClick={() => setStatoDef(k)} icon={ic} title={NOME_STATO[k]} color={STATI[k].color} className="!p-3" />
              ))}
            </div>
          </div>
        )}
      </div>
    ),
  };

  const m = anteprimaModello;
  const fa = anteprimaFatte;
  const riepilogoStep: WizardStep = {
    key: "riepilogo", title: isModello ? "Controllo" : "Riscontro", question: isModello ? "Controllo dell'elenco" : "Riscontro con l'elenco delle domande da fare",
    content: isModello ? (m ? (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Numero v={m.unici.length} l="Nominativi" tone="green" />
          <Numero v={m.doppioni} l="Doppioni tolti" />
          <Numero v={m.senzaCuaa} l="Senza CUAA" tone={m.senzaCuaa ? "amber" : "neutral"} />
        </div>
        {precedente && (
          <div className="grid sm:grid-cols-2 gap-2.5">
            <ChoiceCard selected={modo === "sostituisci"} onClick={() => setModo("sostituisci")} title="Sostituisci l'elenco" desc={`Tolgo le ${vociPratica.length} righe attuali (e gli stati messi a mano) e uso il nuovo file.`} />
            <ChoiceCard selected={modo === "integra"} onClick={() => setModo("integra")} title="Aggiungi solo i nuovi" desc={`Tengo l'elenco attuale e aggiungo ${m.nuoviDaIntegrare.length} nominativi che mancano.`} />
          </div>
        )}
        {m.ris && (
          <div className="rounded-2xl ring-1 ring-ink-100 p-4">
            <div className="text-[13px] font-semibold text-ink-600 mb-3">Con i file delle domande fatte già caricati risulterebbero:</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["R", "S", "C", "N"] as const).map((s) => <Numero key={s} v={m.ris!.conteggi[s]} l={NOME_STATO[s]} tone={s === "R" ? "green" : s === "S" ? "blue" : s === "C" ? "amber" : "red"} />)}
            </div>
          </div>
        )}
        {m.senzaCuaa > 0 && <p className="text-[13px] text-amber-800 flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />Le righe senza CUAA si confrontano per nominativo: funziona se il nome è scritto allo stesso modo nei file.</p>}
        <p className="text-[12.5px] text-ink-500">L'anagrafica non viene modificata: l'elenco vale solo per questa pratica nell'ufficio di {ufficio.nome}.</p>
      </div>
    ) : null) : (fa ? (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["R", "S", "C", "N"] as const).map((s) => <Numero key={s} v={fa.dopo.conteggi[s]} l={NOME_STATO[s]} tone={s === "R" ? "green" : s === "S" ? "blue" : s === "C" ? "amber" : "red"} />)}
        </div>
        <div className="rounded-2xl ring-1 ring-ink-100 divide-y divide-ink-100 text-[14px]">
          {fa.nuovi.map((nf) => {
            const st = fa.dopo.perFile.get(nf.id)!;
            return <RigaInfo key={nf.id} l={`«${nf.nome}»: righe trovate nell'elenco`} v={st.abbinate} />;
          })}
          <RigaInfo l="Righe dell'elenco che cambiano stato" v={fa.cambiano} />
          {fa.fuoriNuovi.length > 0 && <RigaInfo l="Nominativi fuori elenco (non sono tra le domande da fare)" v={fa.fuoriNuovi.length} />}
        </div>
        {!vociPratica.length && <p className="text-[13px] text-amber-800 flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />Non c'è ancora l'elenco delle domande da fare: i file vengono salvati e il riscontro si farà quando lo carichi.</p>}
        <FuoriElenco fuori={fa.fuoriNuovi} />
      </div>
    ) : null),
  };

  const steps: WizardStep[] = fatto ? [{
    key: "fatto", title: "Fatto", question: isModello ? "Elenco delle domande da fare salvato" : "File caricati, riscontro aggiornato",
    hint: isModello ? "Ora carica i file delle domande fatte, stampate o in compilazione: faccio il riscontro." : "Ogni riga dell'elenco ha il suo pallino. Puoi eliminare un file in qualsiasi momento: il riscontro si ricalcola.",
    content: (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {isModello && m ? <Numero v={modo === "integra" && precedente ? m.nuoviDaIntegrare.length : m.unici.length} l={modo === "integra" && precedente ? "Nominativi aggiunti" : "Nominativi nell'elenco"} tone="green" />
          : fa && (["R", "S", "C", "N"] as const).map((s) => <Numero key={s} v={fa.dopo.conteggi[s]} l={NOME_STATO[s]} tone={s === "R" ? "green" : s === "S" ? "blue" : s === "C" ? "amber" : "red"} />)}
      </div>
    ),
  }] : lavoro ? [{ key: "lavoro", title: "Salvataggio", question: "Salvataggio in corso…", canNext: false, content: <Avanzamento msg={lavoro} p={0.6} /> }] : [fileStep, colonneStep, riepilogoStep];

  return (
    <Wizard
      open={open}
      onClose={() => { if (!lavoro) onClose(); }}
      steps={steps}
      index={fatto || lavoro ? 0 : step}
      setIndex={setStep}
      title={`${pratica.nome} · ${isModello ? "domande da fare" : "domande fatte"}`}
      icon={<FileSpreadsheet size={20} />}
      onFinish={fatto ? onClose : esegui}
      finishLabel={fatto ? "Chiudi" : isModello ? (precedente && modo === "integra" ? "Aggiungi all'elenco" : "Salva l'elenco") : "Salva e fai il riscontro"}
    />
  );
}

function SchedaFile({ f, onRemove, onFoglio }: { f: FileCaricato; onRemove: () => void; onFoglio: (i: number) => void }) {
  const a = f.analisi[f.scelta];
  const trovati = a ? CHIAVE.filter((k) => a.mappa[k] || (k === "denominazione" && a.mappa.cognome && a.mappa.nome)) : [];
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl ring-1 ring-ink-100 p-4">
      <div className="flex items-center gap-3">
        <span className="h-11 w-11 rounded-xl bg-green-50 text-green-700 grid place-items-center"><FileSpreadsheet size={22} /></span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{f.file.name}</div>
          <div className="text-xs text-ink-500">{fileSize(f.file.size)}{a ? ` · foglio «${a.foglio}» · ${a.righe.length} righe` : f.errore ? "" : " · analisi…"}</div>
        </div>
        <button onClick={onRemove} className="h-9 w-9 grid place-items-center rounded-full hover:bg-ink-100 text-ink-500"><Trash2 size={16} /></button>
      </div>
      {f.errore && <div className="mt-3 text-sm text-red-700 flex gap-2"><AlertTriangle size={16} />{f.errore}</div>}
      {a && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {(["cuaa", "denominazione", "stato", "numero", "data_presentazione", "esito"] as KDomanda[]).map((k) => {
            const m = a.mappa[k] ?? (k === "denominazione" && a.mappa.cognome ? a.mappa.cognome : undefined);
            const nome = { cuaa: "CUAA", denominazione: "Nominativo", stato: "Stato", numero: "N. domanda", data_presentazione: "Data", esito: "Esito" }[k as string];
            return <span key={k} className={clsx("chip !h-6 !text-[11px]", m ? "bg-green-50 text-green-700" : "bg-ink-50 text-ink-400")}>{m ? <Check size={11} strokeWidth={3} /> : <X size={11} />}{nome}{m && <span className="opacity-60 ml-0.5">· «{a.intestazioni[m.col]}»</span>}</span>;
          })}
          {f.analisi.length > 1 && (
            <Select size="sm" className="ml-auto w-48" value={String(f.scelta)} onChange={(v) => onFoglio(Number(v))} options={f.analisi.map((x, i) => ({ value: String(i), label: `Foglio «${x.foglio}»`, hint: `${x.righe.length} righe` }))} />
          )}
        </div>
      )}
      {a && !trovati.length && <div className="mt-2 text-[13px] text-amber-700">Non ho trovato né CUAA né nominativi: controlla le colonne al passo successivo.</div>}
      {a?.avvisi.map((w) => <div key={w} className="mt-1 text-[12px] text-ink-500">{w}</div>)}
    </motion.div>
  );
}

function MappaFile({ f, onChange }: { f: FileCaricato; onChange: (k: KDomanda, col: number | null) => void }) {
  const a = f.analisi[f.scelta];
  const opzioni = [{ value: "-1", label: "— non usare —" }, ...a.intestazioni.map((h, i) => ({ value: String(i), label: h, hint: a.righe.slice(0, 3).map((r) => testo(r[i]) ?? "").filter(Boolean).join(" · ") }))];
  const campi = CAMPI_DOMANDA.filter((c) => (c.k !== "note" || a.mappa.note) && !((c.k === "cognome" || c.k === "nome") && a.mappa.denominazione));
  return (
    <div>
      <div className="text-[13px] font-bold text-ink-700 mb-2 flex items-center gap-2"><FileSpreadsheet size={15} className="text-green-700" />{f.file.name}</div>
      <div className="rounded-2xl ring-1 ring-ink-100 divide-y divide-ink-100">
        {campi.map((c) => {
          const m = a.mappa[c.k];
          return (
            <div key={c.k} className="flex items-center gap-3 px-4 py-2.5">
              <span className={clsx("h-6 w-6 rounded-full grid place-items-center shrink-0", m ? (m.confidenza >= 0.7 ? "bg-brand-600 text-white" : "bg-amber-400 text-white") : "bg-ink-100 text-ink-300")}>
                {m ? <Check size={13} strokeWidth={3} /> : <CircleDashed size={12} />}
              </span>
              <div className="w-40 shrink-0">
                <div className="text-[14px] font-semibold">{c.etichetta}</div>
                {m && <div className="text-[11px] text-ink-400 leading-tight truncate" title={m.perche}>{m.perche || ""}</div>}
              </div>
              <Select size="sm" className="flex-1 min-w-0" value={m ? String(m.col) : "-1"} onChange={(v) => onChange(c.k, v === "-1" ? null : Number(v))} options={opzioni} menuMinWidth={300} />
              <span className={clsx("hidden sm:block w-12 text-right text-[12px] font-bold tabular-nums", !m ? "text-ink-300" : m.confidenza >= 0.7 ? "text-brand-700" : "text-amber-600")}>{m ? `${Math.round(m.confidenza * 100)}%` : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RigaInfo({ l, v }: { l: string; v: number }) {
  return <div className="flex items-center justify-between px-4 py-2.5"><span className="text-ink-600">{l}</span><span className="font-bold tabular-nums">{v}</span></div>;
}

function FuoriElenco({ fuori }: { fuori: Fonte[] }) {
  const [aperto, setAperto] = useState(false);
  if (!fuori.length) return null;
  return (
    <div>
      <button onClick={() => setAperto((x) => !x)} className="text-[13px] font-semibold text-ink-600 flex items-center gap-1.5 hover:text-ink-900">
        <ChevronDown size={15} className={clsx("transition-transform", aperto && "rotate-180")} />Vedi i nominativi fuori elenco
      </button>
      <AnimatePresence>
        {aperto && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 max-h-48 overflow-y-auto rounded-2xl bg-ink-50 p-3 text-[13px] space-y-0.5">
            {fuori.map((x, i) => <li key={i}>{titleCase(x.riga.denominazione ?? "") || "—"} <span className="font-mono text-ink-400">{x.riga.cuaa ?? ""}</span> <span className="text-ink-400">· {NOME_STATO[x.stato]}</span></li>)}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
