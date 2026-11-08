import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, ChevronDown, CircleDashed, FileSpreadsheet, ListChecks, PenLine, Printer, Send, Trash2, UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Wizard, type WizardStep } from "../../components/ui/Wizard";
import { ChoiceCard, Toggle } from "../../components/ui/Inputs";
import { Select } from "../../components/ui/Select";
import { useFeedback } from "../../components/ui/Feedback";
import { useUfficio } from "../../lib/ufficio";
import { abbinate, STATI } from "../../lib/domain";
import { fileSize, titleCase } from "../../lib/format";
import {
  analizzaFile, CAMPI_DOMANDA, cuaaDa, data, esito as esitoDa, leggiExcel, numero, stato as statoDa, testo, valore,
  type Analisi, type KDomanda,
} from "../../lib/excel";
import { eseguiPiano, pianifica, type Contesto, type Piano, type RigaElenco } from "../../lib/importazione";
import type { Pratica, StatoDomanda } from "../../lib/types";
import { Avanzamento, Numero } from "../import/Comuni";

interface FileCaricato { id: string; file: File; analisi: Analisi<KDomanda>[]; scelta: number; errore?: string }

const CHIAVE: KDomanda[] = ["cuaa", "denominazione", "stato"];

export function CaricaElenco({ open, onClose, pratica, tipo }: { open: boolean; onClose: () => void; pratica: Pratica; tipo: "modello" | "fatte" }) {
  const { ufficio, aziende, abbinamenti, domande } = useUfficio();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { toast } = useFeedback();
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<FileCaricato[]>([]);
  const [statoDef, setStatoDef] = useState<StatoDomanda>("R");
  const [aggiungiFuori, setAggiungiFuori] = useState(true);
  const [lavoro, setLavoro] = useState<{ msg: string; p: number } | null>(null);
  const [fatto, setFatto] = useState<Piano | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setStep(0); setFiles([]); setStatoDef("R"); setAggiungiFuori(true); setLavoro(null); setFatto(null); } }, [open]);

  const aggiungi = async (lista: FileList | File[]) => {
    for (const file of [...lista]) {
      const id = crypto.randomUUID();
      setFiles((x) => [...x, { id, file, analisi: [], scelta: 0 }]);
      try {
        const fogli = await leggiExcel(file);
        const analisi = analizzaFile(fogli, CAMPI_DOMANDA, /domand|elenco|fatt|rilasc/i).filter((a) => a.righe.length > 0);
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
    // una colonna = un campo
    for (const kk of Object.keys(a.mappa) as KDomanda[]) if (col != null && a.mappa[kk]?.col === col) delete a.mappa[kk];
    if (col == null) delete a.mappa[k]; else a.mappa[k] = { col, confidenza: 1, perche: "scelta a mano" };
    const analisi = [...f.analisi]; analisi[f.scelta] = a;
    return { ...f, analisi };
  }));

  const validi = useMemo(() => files.filter((f) => f.analisi.length && !f.errore), [files]);
  const senzaStato = validi.some((f) => !f.analisi[f.scelta].mappa.stato);

  const righe: RigaElenco[] = useMemo(() => validi.flatMap((f) => {
    const a = f.analisi[f.scelta];
    return a.righe.map((r, i) => {
      const c = cuaaDa(valore(a, r, "cuaa"));
      const st = a.mappa.stato ? statoDa(valore(a, r, "stato")) : null;
      return {
        file: f.file.name, riga: i + 1 + (a.rigaIntestazione || 0),
        cuaa: c?.cuaa ?? testo(valore(a, r, "cuaa")), denominazione: testo(valore(a, r, "denominazione")),
        stato: st, numero: testo(valore(a, r, "numero")), data_presentazione: data(valore(a, r, "data_presentazione")),
        esito: esitoDa(valore(a, r, "esito")), motivi: (testo(valore(a, r, "motivi")) ?? "").split(/;|\n/).map((x) => x.trim()).filter(Boolean),
        data_esito: data(valore(a, r, "data_esito")), litri_assegnati: numero(valore(a, r, "litri_assegnati")), note: testo(valore(a, r, "note")),
      } satisfies RigaElenco;
    }).filter((x) => x.cuaa || x.denominazione);
  }), [validi]);

  const ctx: Contesto = useMemo(() => {
    const membri = new Set(abbinate(aziende, pratica, abbinamenti, domande).keys());
    const stati = new Map(domande.filter((d) => d.pratica_id === pratica.id).map((d) => [d.azienda_id, d.stato]));
    return { aziende, membri, stati };
  }, [aziende, pratica, abbinamenti, domande]);

  const piano = useMemo(() => (step >= 2 && righe.length ? pianifica(tipo, righe, ctx, statoDef) : null), [step, righe, ctx, tipo, statoDef]);

  // aziende dell'elenco che restano da fare dopo questo caricamento
  const restanoDaFare = useMemo(() => {
    if (!piano || tipo !== "fatte") return 0;
    const nuovoStato = new Map(ctx.stati);
    piano.voci.forEach((v) => { if (v.esame.tipo === "azienda" && (!v.fuori || aggiungiFuori)) nuovoStato.set(v.esame.aziendaId, v.stato); });
    return [...ctx.membri].filter((id) => (nuovoStato.get(id) ?? "N") === "N").length;
  }, [piano, ctx, tipo, aggiungiFuori]);

  const esegui = async () => {
    if (!piano) return;
    setLavoro({ msg: "Avvio", p: 0 });
    try {
      await eseguiPiano({ piano, ufficio: ufficio.id, praticaId: pratica.id, aggiungiFuori, fileNames: validi.map((f) => f.file.name), onFase: (msg, p) => setLavoro({ msg, p }) });
      await Promise.all(["domande", "aziende", "abbinamenti", "caricamenti", "riepilogo-uffici", "storico"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      setFatto(piano);
    } catch (e) { toast("error", "Caricamento non riuscito", (e as Error).message); }
    finally { setLavoro(null); }
  };

  const titoloModello = tipo === "modello";
  const steps: WizardStep[] = fatto ? [{
    key: "fatto", title: "Fatto", question: titoloModello ? "Elenco delle domande da fare salvato" : "Stati aggiornati",
    hint: titoloModello ? "Ora, quando hai l'elenco delle domande fatte, caricalo dalla pagina della pratica: farò il confronto." : "Le aziende che non hanno ancora la domanda sono in «Da fare».",
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {titoloModello ? (<>
            <Numero v={fatto.voci.length} l="Aziende nell'elenco" tone="green" />
            <Numero v={fatto.conteggi.nuoveAziende} l="Create in anagrafica" tone="blue" />
            <Numero v={fatto.scartate.length} l="Righe scartate" tone={fatto.scartate.length ? "red" : "neutral"} />
            <Numero v={fatto.conflitti} l="Doppioni fusi" />
          </>) : (<>
            <Numero v={fatto.conteggi.perStato.R} l="Fatte" tone="green" />
            <Numero v={fatto.conteggi.perStato.S} l="Stampate" tone="blue" />
            <Numero v={fatto.conteggi.perStato.C} l="In compilazione" tone="amber" />
            <Numero v={restanoDaFare} l="Restano da fare" tone="red" />
          </>)}
        </div>
        {!titoloModello && (
          <button onClick={() => { onClose(); nav(`/u/${ufficio.id}/da-fare?pratica=${pratica.id}`); }}
            className="w-full flex items-center gap-4 rounded-2xl bg-brand-800 text-white px-5 py-4 text-left hover:bg-brand-900 transition active:scale-[.99]">
            <ListChecks size={22} /><span className="flex-1 font-bold">Apri «Da fare» per questa pratica</span><span className="text-white/70 text-sm">{restanoDaFare} aziende</span>
          </button>
        )}
        {fatto.scartate.length > 0 && <Scartate righe={fatto.scartate} />}
      </div>
    ),
  }] : lavoro ? [{ key: "lavoro", title: "Salvataggio", question: "Salvataggio in corso…", canNext: false, content: <Avanzamento msg={lavoro.msg} p={lavoro.p} /> }] : [
    {
      key: "file", title: "File", canNext: validi.length > 0 && files.every((f) => f.analisi.length || f.errore),
      question: titoloModello ? "Carica l'elenco delle domande da fare" : "Carica l'elenco delle domande fatte",
      hint: titoloModello
        ? "È il modello della pratica: le aziende che devono fare questa domanda. Si carica una volta e resta fisso."
        : "Puoi caricare più file insieme (per esempio rilasciate e stampate). Lo confronto con l'elenco delle domande da fare.",
      content: (
        <div className="space-y-4">
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); aggiungi(e.dataTransfer.files); }}
            onClick={() => input.current?.click()} animate={{ scale: drag ? 1.015 : 1 }}
            className={clsx("cursor-pointer rounded-3xl border-2 border-dashed text-center transition-colors", files.length ? "p-5" : "p-10", drag ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/40")}
          >
            <div className={clsx("mx-auto rounded-2xl bg-brand-50 text-brand-700 grid place-items-center", files.length ? "h-10 w-10 mb-2" : "h-16 w-16 mb-4")}><UploadCloud size={files.length ? 20 : 30} /></div>
            <div className="font-bold">{files.length ? "Aggiungi altri file" : "Trascina qui i file Excel"}</div>
            {!files.length && <div className="text-sm text-ink-500 mt-1">oppure <span className="text-brand-700 font-semibold">sfoglia</span> · .xlsx, .xls, .csv · anche più file</div>}
          </motion.div>
          <input ref={input} type="file" multiple accept=".xlsx,.xls,.xlsm,.csv,.ods" className="hidden" onChange={(e) => { if (e.target.files) aggiungi(e.target.files); e.target.value = ""; }} />
          {files.map((f) => <SchedaFile key={f.id} f={f} onRemove={() => setFiles((x) => x.filter((y) => y.id !== f.id))} onFoglio={(i) => setFiles((x) => x.map((y) => (y.id === f.id ? { ...y, scelta: i } : y)))} />)}
        </div>
      ),
    },
    {
      key: "colonne", title: "Colonne", question: "Ho riconosciuto queste colonne",
      hint: "Ogni colonna è stata riconosciuta dall'intestazione e dal contenuto. Correggi solo se serve.",
      canNext: validi.every((f) => f.analisi[f.scelta].mappa.cuaa || f.analisi[f.scelta].mappa.denominazione || (f.analisi[f.scelta].mappa.cognome && f.analisi[f.scelta].mappa.nome)),
      content: (
        <div className="space-y-6">
          {validi.map((f) => <MappaFile key={f.id} f={f} onChange={(k, c) => setMappa(f.id, k, c)} />)}
          {tipo === "fatte" && senzaStato && (
            <div>
              <span className="label">Stato per i file senza colonna «stato»</span>
              <div className="grid sm:grid-cols-3 gap-2.5">
                {([["R", <Send size={18} key="r" />], ["S", <Printer size={18} key="s" />], ["C", <PenLine size={18} key="c" />]] as const).map(([k, ic]) => (
                  <ChoiceCard key={k} selected={statoDef === k} onClick={() => setStatoDef(k)} icon={ic} title={STATI[k].label} color={STATI[k].color} className="!p-3" />
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "confronto", title: "Confronto", question: titoloModello ? "Controllo dell'elenco" : "Confronto con l'elenco delle domande da fare",
      content: piano ? (
        <div className="space-y-4">
          {titoloModello ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Numero v={piano.voci.length} l="Aziende nell'elenco" tone="green" />
              <Numero v={piano.voci.length - piano.conteggi.nuoveAziende} l="Già in anagrafica" />
              <Numero v={piano.conteggi.nuoveAziende} l="Nuove (le creo)" tone="blue" />
              <Numero v={piano.scartate.length} l="Non abbinabili" tone={piano.scartate.length ? "red" : "neutral"} />
            </div>
          ) : (<>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(["R", "S", "C"] as StatoDomanda[]).map((s) => <Numero key={s} v={piano.conteggi.perStato[s]} l={s === "R" ? "Fatte" : STATI[s].label} tone={s === "R" ? "green" : s === "S" ? "blue" : "amber"} />)}
              <Numero v={restanoDaFare} l="Restano da fare" tone="red" />
            </div>
            <div className="rounded-2xl ring-1 ring-ink-100 divide-y divide-ink-100 text-[14px]">
              <RigaInfo l="Domande nuove (prima erano da fare)" v={piano.conteggi.nuove} />
              <RigaInfo l="Domande che cambiano stato" v={piano.conteggi.aggiornate} />
              <RigaInfo l="Già aggiornate" v={piano.conteggi.invariate} />
              {piano.conflitti > 0 && <RigaInfo l="Aziende presenti in più file (vale lo stato più avanzato)" v={piano.conflitti} />}
            </div>
            {piano.conteggi.fuori > 0 && (
              <div onClick={() => setAggiungiFuori((x) => !x)} className={clsx("flex items-center gap-4 rounded-2xl border-2 px-4 py-3.5 cursor-pointer transition-colors", aggiungiFuori ? "border-amber-300 bg-amber-50/60" : "border-ink-100")}>
                <Toggle checked={aggiungiFuori} onChange={setAggiungiFuori} />
                <div className="flex-1">
                  <div className="font-bold text-[14.5px]">{piano.conteggi.fuori} aziende «fuori elenco»</div>
                  <div className="text-[13px] text-ink-500">Hanno la domanda ma non erano nell'elenco da fare{piano.conteggi.nuoveAziende ? ` (${piano.conteggi.nuoveAziende} non sono in anagrafica)` : ""}. {aggiungiFuori ? "Le aggiungo alla pratica." : "Le ignoro."}</div>
                </div>
              </div>
            )}
            <FuoriElenco piano={piano} />
          </>)}
          {piano.scartate.length > 0 && <Scartate righe={piano.scartate} />}
        </div>
      ) : null,
    },
  ];

  return (
    <Wizard
      open={open}
      onClose={() => { if (!lavoro) onClose(); }}
      steps={steps}
      index={fatto || lavoro ? 0 : step}
      setIndex={setStep}
      title={`${pratica.nome} · ${titoloModello ? "domande da fare" : "domande fatte"}`}
      icon={<FileSpreadsheet size={20} />}
      onFinish={fatto ? onClose : esegui}
      finishLabel={fatto ? "Chiudi" : titoloModello ? "Salva l'elenco" : "Aggiorna gli stati"}
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

function FuoriElenco({ piano }: { piano: Piano }) {
  const { azById } = useUfficio();
  const [aperto, setAperto] = useState(false);
  const fuori = piano.voci.filter((v) => v.fuori);
  if (!fuori.length) return null;
  return (
    <div>
      <button onClick={() => setAperto((x) => !x)} className="text-[13px] font-semibold text-ink-600 flex items-center gap-1.5 hover:text-ink-900">
        <ChevronDown size={15} className={clsx("transition-transform", aperto && "rotate-180")} />Vedi le aziende fuori elenco
      </button>
      <AnimatePresence>
        {aperto && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 max-h-48 overflow-y-auto rounded-2xl bg-ink-50 p-3 text-[13px] space-y-0.5 overflow-hidden">
            {fuori.map((v) => <li key={v.chiave}>{v.esame.tipo === "azienda" ? titleCase(azById.get(v.esame.aziendaId)?.denominazione ?? "") : <>{titleCase(v.esame.denominazione)} <span className="text-blue-600 font-semibold">nuova</span></>} <span className="text-ink-400">· {STATI[v.stato].label}</span></li>)}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Scartate({ righe }: { righe: { file: string; riga: number; nome: string; motivo: string }[] }) {
  const [aperto, setAperto] = useState(false);
  return (
    <div className="rounded-2xl bg-amber-50/70 ring-1 ring-amber-100 p-4">
      <button onClick={() => setAperto((x) => !x)} className="w-full flex items-center gap-2 font-semibold text-amber-800 text-sm text-left">
        <AlertTriangle size={16} />{righe.length} righe non abbinate<ChevronDown size={15} className={clsx("ml-auto transition-transform", aperto && "rotate-180")} />
      </button>
      {aperto && (
        <ul className="mt-2 max-h-44 overflow-y-auto text-[13px] text-amber-900 space-y-0.5">
          {righe.slice(0, 300).map((r, i) => <li key={i}><span className="text-amber-700/70">{r.file} · riga {r.riga}:</span> <b>{r.nome}</b> — {r.motivo}</li>)}
        </ul>
      )}
    </div>
  );
}
