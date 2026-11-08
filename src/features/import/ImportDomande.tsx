import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, FileSpreadsheet, Plus, Search, Columns3, Check, PenLine, Printer, Send, CircleDashed, ChevronDown, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { Wizard, type WizardStep } from "../../components/ui/Wizard";
import { ChoiceCard, TextInput } from "../../components/ui/Inputs";
import { Segmented } from "../../components/ui/Segmented";
import { Select } from "../../components/ui/Select";
import { useFeedback } from "../../components/ui/Feedback";
import { Avatar, ProgressStati } from "../../components/ui/Misc";
import { useModals, useUfficio } from "../../lib/ufficio";
import { abbinate, STATI } from "../../lib/domain";
import { creaRiconoscitore, data, esito as esitoDa, leggiExcel, mappaAutomatica, numero, siNo, stato as statoDa, tabella, testo, type Foglio, type Mappa, type Tabella } from "../../lib/excel";
import { importaDomande, type EsitoImportDomande, type NuovaPratica, type RigaDomanda } from "../../lib/importazione";
import { normalizzaCuaa } from "../../lib/cf";
import { normalizza } from "../../lib/analisi/classificatore";
import { titleCase } from "../../lib/format";
import type { Pratica, StatoDomanda } from "../../lib/types";
import { Avanzamento, DropExcel, MappaColonne, Numero, type CampoDef } from "./Comuni";
import { Scartate } from "./ImportAziende";

type K = "cuaa" | "denominazione" | "tipo" | "stato" | "numero" | "data_presentazione" | "esito" | "motivi" | "data_esito" | "importo_richiesto" | "importo_ammesso" | "importo_pagato" | "data_pagamento" | "litri_richiesti" | "litri_assegnati" | "quota_importo" | "quota_incassata" | "note";

const riconosci = creaRiconoscitore<K>({
  cuaa: /^(cuaa|codice fiscale|cod\.? ?fisc|c\.?f\.?|cf|partita iva|p\.? ?iva|piva)$|cuaa/,
  denominazione: /denominazion|ragione sociale|nominativ|^nome|cognome|intestatar|^azienda$|^ditta|beneficiar|richiedent/,
  tipo: /^(tipo|tipologia|bando|pratica|misura|intervento|domanda|tipo domanda|tipologia domanda)$|tipo (di )?domanda|tipologia/,
  stato: /^stato|situazione|^esito pratica|avanzamento/,
  numero: /^n\.? ?domanda|numero|^n\.?$|protocollo|barcode|^id domanda/,
  data_presentazione: /^data$|data (di )?(presentazione|rilascio|invio|domanda)|presentata il/,
  esito: /^esito$|esito istruttor|ammission/,
  motivi: /motiv|causal/,
  data_esito: /data esito|data (dell )?istruttoria/,
  importo_richiesto: /richiest/,
  importo_ammesso: /ammess|concess/,
  importo_pagato: /pagat|liquidat|erogat/,
  data_pagamento: /data pagamento|data liquidazione/,
  litri_richiesti: /litri richiest/,
  litri_assegnati: /litri|assegnat/,
  quota_importo: /^quota( cia)?$|quota servizio|tariffa|compenso/,
  quota_incassata: /incassat|pagata quota|quota pagata/,
  note: /^note|annotazion/,
});

const CAMPI: CampoDef<K>[] = [
  { k: "cuaa", l: "CUAA", hint: "Consigliato: abbina con certezza" },
  { k: "denominazione", l: "Nominativo", hint: "Usato se manca il CUAA" },
  { k: "tipo", l: "Tipo di domanda", hint: "Solo se il file ne contiene più tipi" },
  { k: "stato", l: "Stato", hint: "Rilasciata, Stampata, In compilazione…" },
  { k: "numero", l: "N. domanda" }, { k: "data_presentazione", l: "Data presentazione" },
  { k: "esito", l: "Esito" }, { k: "motivi", l: "Motivi rigetto" }, { k: "data_esito", l: "Data esito" },
  { k: "importo_richiesto", l: "Importo richiesto" }, { k: "importo_ammesso", l: "Importo ammesso" }, { k: "importo_pagato", l: "Importo pagato" },
  { k: "data_pagamento", l: "Data pagamento" }, { k: "litri_richiesti", l: "Litri richiesti" }, { k: "litri_assegnati", l: "Litri assegnati" },
  { k: "quota_importo", l: "Quota CIA" }, { k: "quota_incassata", l: "Quota incassata", hint: "SI / NO" }, { k: "note", l: "Note" },
];

type Scelta = { tipo: "esistente"; id: string } | { tipo: "nuova"; nome: string } | { tipo: "colonna" } | null;

/** Abbina un testo del file a una pratica esistente (codice, nome, parole chiave). */
function trovaPratica(testoTipo: string, pratiche: Pratica[]): Pratica | null {
  const n = normalizza(testoTipo).trim();
  if (!n) return null;
  const compatta = (s: string) => normalizza(s).replace(/[^a-z0-9]/g, "");
  const c = compatta(testoTipo);
  return pratiche.find((p) => p.codice && compatta(p.codice) === c)
    ?? pratiche.find((p) => compatta(p.nome) === c)
    ?? pratiche.find((p) => (p.codice && c.includes(compatta(p.codice))) || compatta(p.nome).includes(c) || c.includes(compatta(p.nome)))
    ?? (/\b(du|pac|domanda unica)\b/.test(n) ? pratiche.find((p) => /^du/i.test(p.codice ?? p.id)) ?? null : null)
    ?? (/\buma\b|gasolio agricolo|libretto/.test(n) ? pratiche.find((p) => /^uma/i.test(p.codice ?? p.id)) ?? null : null);
}

export function ImportDomande({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ufficio, pratiche } = useUfficio();
  const qc = useQueryClient();
  const { toast } = useFeedback();
  const [step, setStep] = useState(0);
  const [q, setQ] = useState("");
  const [scelta, setScelta] = useState<Scelta>(null);
  const [unita, setUnita] = useState<"euro" | "litri">("euro");
  const [file, setFile] = useState<File | null>(null);
  const [fogli, setFogli] = useState<Foglio[]>([]);
  const [foglio, setFoglio] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [mappa, setMappa] = useState<Mappa<K>>({});
  const [statoDef, setStatoDef] = useState<StatoDomanda>("R");
  const [mappaTipi, setMappaTipi] = useState<Record<string, string>>({}); // testo → id pratica | "nuova"
  const [lavoro, setLavoro] = useState<{ msg: string; p: number } | null>(null);
  const [esito, setEsito] = useState<EsitoImportDomande | null>(null);

  useEffect(() => {
    if (open) { setStep(0); setQ(""); setScelta(null); setUnita("euro"); setFile(null); setFogli([]); setFoglio(null); setErrore(null); setMappa({}); setStatoDef("R"); setMappaTipi({}); setLavoro(null); setEsito(null); }
  }, [open]);

  const suggerite = useMemo(() => {
    const n = normalizza(q).trim();
    const l = pratiche.filter((p) => !n || normalizza(`${p.nome} ${p.codice ?? ""} ${p.ente ?? ""}`).includes(n));
    return l.slice(0, 6);
  }, [q, pratiche]);
  const esisteUguale = pratiche.some((p) => normalizza(p.nome) === normalizza(q).trim() || (p.codice && normalizza(p.codice) === normalizza(q).trim()));

  const t: Tabella | null = useMemo(() => { const f = fogli.find((x) => x.nome === foglio); return f ? tabella(f, riconosci) : null; }, [fogli, foglio]);
  useEffect(() => {
    if (!t) return;
    const m = mappaAutomatica(t, riconosci, "cuaa");
    if (scelta?.tipo !== "colonna") delete m.tipo;
    setMappa(m);
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  const carica = async (f: File | null) => {
    setFile(f); setErrore(null); setFogli([]); setFoglio(null);
    if (!f) return;
    try {
      const fs = (await leggiExcel(f)).filter((x) => x.righe.length > 0);
      if (!fs.length) throw new Error("Il file è vuoto");
      setFogli(fs);
      setFoglio((fs.find((x) => /domand/i.test(x.nome)) ?? fs[0]).nome);
    } catch (e) { setErrore("Impossibile leggere il file: " + (e as Error).message); }
  };

  const righe: RigaDomanda[] = useMemo(() => {
    if (!t) return [];
    const v = (r: unknown[], k: K) => (mappa[k] != null ? r[mappa[k]!] : null);
    return t.righe.map((r, i) => ({
      riga: t.rigaIntestazione + i + 1,
      cuaa: testo(v(r, "cuaa")), denominazione: testo(v(r, "denominazione")), tipo: testo(v(r, "tipo")),
      stato: statoDa(v(r, "stato")), numero: testo(v(r, "numero")), data_presentazione: data(v(r, "data_presentazione")),
      esito: esitoDa(v(r, "esito")), motivi: (testo(v(r, "motivi")) ?? "").split(";").map((x) => x.trim()).filter(Boolean),
      data_esito: data(v(r, "data_esito")), importo_richiesto: numero(v(r, "importo_richiesto")), importo_ammesso: numero(v(r, "importo_ammesso")),
      importo_pagato: numero(v(r, "importo_pagato")), data_pagamento: data(v(r, "data_pagamento")),
      litri_richiesti: numero(v(r, "litri_richiesti")), litri_assegnati: numero(v(r, "litri_assegnati")),
      quota_importo: numero(v(r, "quota_importo")), quota_incassata: siNo(v(r, "quota_incassata")), note: testo(v(r, "note")),
    })).filter((r) => (r.cuaa || r.denominazione) && !/esempio/i.test(r.denominazione ?? ""));
  }, [t, mappa]);

  // tipi presenti nel file (modalità "colonna")
  const tipiFile = useMemo(() => [...new Set(righe.map((r) => r.tipo ?? "").filter(Boolean))], [righe]);
  useEffect(() => {
    if (scelta?.tipo !== "colonna") return;
    setMappaTipi((m) => {
      const n = { ...m };
      for (const tp of tipiFile) if (!n[tp]) n[tp] = trovaPratica(tp, pratiche)?.id ?? "nuova";
      return n;
    });
  }, [tipiFile, scelta, pratiche]);

  const contaStati = useMemo(() => {
    const c: Record<StatoDomanda, number> = { N: 0, C: 0, S: 0, R: 0 };
    righe.forEach((r) => c[r.stato ?? statoDef]++);
    return c;
  }, [righe, statoDef]);

  const conCuaa = righe.filter((r) => /^([A-Z0-9]{16}|\d{11})$/.test(normalizzaCuaa(r.cuaa ?? ""))).length;

  const importa = async () => {
    setLavoro({ msg: "Avvio importazione", p: 0 });
    try {
      const nuove: NuovaPratica[] = [];
      let fissa: string | null = null;
      if (scelta?.tipo === "esistente") fissa = scelta.id;
      if (scelta?.tipo === "nuova") { nuove.push({ chiave: "__nuova__", nome: scelta.nome, codice: null, unita }); fissa = "__nuova__"; }
      if (scelta?.tipo === "colonna") for (const tp of tipiFile) if (mappaTipi[tp] === "nuova") nuove.push({ chiave: "tipo:" + tp, nome: tp, codice: /^[A-Z0-9]{3,10}$/.test(tp.trim()) ? tp.trim() : null, unita: /uma|litri|gasolio/i.test(tp) ? "litri" : "euro" });
      const e = await importaDomande({
        ufficio: ufficio.id, righe, praticaFissa: fissa, nuovePratiche: nuove, statoPredefinito: statoDef,
        risolviPratica: (tp) => (tp ? (mappaTipi[tp] === "nuova" ? "tipo:" + tp : mappaTipi[tp] ?? null) : null),
        onFase: (msg, p) => setLavoro({ msg, p }),
      });
      await Promise.all(["domande", "aziende", "pratiche", "riepilogo-uffici", "storico"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      setEsito(e);
    } catch (e) { toast("error", "Importazione non riuscita", (e as Error).message); }
    finally { setLavoro(null); }
  };

  const nomeScelta = scelta?.tipo === "esistente" ? pratiche.find((p) => p.id === scelta.id)?.nome : scelta?.tipo === "nuova" ? scelta.nome : null;

  const steps: WizardStep[] = esito ? [{ key: "riepilogo", title: "Riepilogo", question: "Ecco com'è la situazione", hint: `Ufficio di ${ufficio.nome} · dati aggiornati dopo l'importazione`, content: <Riepilogo esito={esito} onClose={onClose} /> }]
    : lavoro ? [{ key: "lavoro", title: "Importazione", question: "Importazione in corso…", canNext: false, content: <Avanzamento msg={lavoro.msg} p={lavoro.p} /> }]
    : [
      {
        key: "tipo", title: "Tipologia", question: "Che domanda stai importando?", hint: "Scrivi il nome: puoi sceglierne una esistente o crearne una nuova.", canNext: !!scelta,
        content: (
          <div>
            <TextInput size="lg" autoFocus value={q} onChange={(e) => { setQ(e.target.value); if (scelta?.tipo === "nuova") setScelta(null); }} placeholder="es. Domanda Unica 2027, Rimborso gasolio, PSR misura…" icon={<Search size={19} />}
              onKeyDown={(e) => { if (e.key === "Enter" && q.trim() && !esisteUguale) { setScelta({ tipo: "nuova", nome: q.trim() }); } }} />
            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              {q.trim() && !esisteUguale && (
                <ChoiceCard className="sm:col-span-2" selected={scelta?.tipo === "nuova"} onClick={() => setScelta({ tipo: "nuova", nome: q.trim() })} icon={<Plus size={20} />}
                  title={<>Crea «{q.trim()}»</>} desc="Nuova tipologia di domanda, abbinata a tutte le aziende dell'ufficio" />
              )}
              {suggerite.map((p) => (
                <ChoiceCard key={p.id} selected={scelta?.tipo === "esistente" && scelta.id === p.id} onClick={() => setScelta({ tipo: "esistente", id: p.id })}
                  icon={<ClipboardList size={20} />} title={p.nome} desc={[p.codice, p.ente].filter(Boolean).join(" · ") || (p.categoria === "bando" ? "Bando" : "Annuale")} />
              ))}
              <ChoiceCard className="sm:col-span-2" selected={scelta?.tipo === "colonna"} onClick={() => setScelta({ tipo: "colonna" })} icon={<Columns3 size={20} />}
                title="Il file contiene più tipi di domanda" desc="Il tipo è indicato in una colonna del file: abbino ogni valore a una pratica" />
            </div>
            <AnimatePresence>
              {scelta?.tipo === "nuova" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-5"><span className="label">Cosa si misura</span>
                    <Segmented value={unita} onChange={setUnita} options={[{ value: "euro", label: "Contributo in €" }, { value: "litri", label: "Litri (gasolio)" }]} /></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ),
      },
      {
        key: "file", title: "File", question: "Carica l'Excel con i nominativi", hint: nomeScelta ? `Domanda: ${nomeScelta}. Serve almeno una colonna con CUAA o nominativo.` : "Serve almeno una colonna con CUAA o nominativo, e una con il tipo di domanda.",
        canNext: !!t && t.righe.length > 0,
        content: <DropExcel file={file} onFile={carica} fogli={fogli.map((f) => f.nome)} foglio={foglio} onFoglio={setFoglio} righe={t?.righe.length} errore={errore} />,
      },
      {
        key: "colonne", title: "Colonne", question: "Ho riconosciuto queste colonne", hint: "Le celle vuote non cancellano i dati già presenti.",
        canNext: (mappa.cuaa != null || mappa.denominazione != null) && (scelta?.tipo !== "colonna" || mappa.tipo != null),
        content: t ? (
          <div className="space-y-5">
            <MappaColonne campi={scelta?.tipo === "colonna" ? CAMPI : CAMPI.filter((c) => c.k !== "tipo")} tabella={t} mappa={mappa} onChange={(k, c) => setMappa((m) => ({ ...m, [k]: c ?? undefined }))} />
          </div>
        ) : null,
      },
      {
        key: "stato", title: "Stato", question: mappa.stato != null ? "Stato delle domande" : "In che stato sono queste domande?",
        hint: mappa.stato != null ? "Lo stato è letto dalla colonna del file. Per le celle vuote uso:" : "Il file non ha una colonna «stato»: lo applico a tutti i nominativi elencati. Le aziende non presenti nel file risulteranno «Non fatte».",
        content: (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-3">
              {([["R", <Send size={20} key="r" />], ["S", <Printer size={20} key="s" />], ["C", <PenLine size={20} key="c" />], ["N", <CircleDashed size={20} key="n" />]] as const).map(([k, ic]) => (
                <ChoiceCard key={k} selected={statoDef === k} onClick={() => setStatoDef(k)} icon={ic} title={STATI[k].label} desc={STATI[k].desc} color={STATI[k].color} />
              ))}
            </div>
            {scelta?.tipo === "colonna" && tipiFile.length > 0 && (
              <div>
                <span className="label">Tipi di domanda trovati nel file</span>
                <div className="rounded-2xl ring-1 ring-ink-100 divide-y divide-ink-100">
                  {tipiFile.map((tp) => (
                    <div key={tp} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex-1 font-semibold text-[14px] truncate">«{tp}» <span className="text-ink-400 font-normal text-xs">{righe.filter((r) => r.tipo === tp).length} righe</span></span>
                      <Select size="sm" className="w-72" value={mappaTipi[tp] ?? "nuova"} onChange={(v) => setMappaTipi((m) => ({ ...m, [tp]: v }))}
                        options={[{ value: "nuova", label: `Crea nuova «${tp}»` }, ...pratiche.map((p) => ({ value: p.id, label: p.nome, hint: p.codice ?? undefined }))]} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        key: "anteprima", title: "Controllo", question: "Prima di importare",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(["R", "S", "C", "N"] as StatoDomanda[]).map((s) => <Numero key={s} v={contaStati[s]} l={STATI[s].label} tone={s === "R" ? "green" : s === "S" ? "blue" : s === "C" ? "amber" : "red"} />)}
            </div>
            <div className="rounded-2xl ring-1 ring-ink-100 p-4 text-[14px] text-ink-700 space-y-1.5">
              <div className="flex items-center gap-2"><FileSpreadsheet size={16} className="text-brand-700" /><b>{righe.length}</b> righe da importare nell'ufficio di <b>{ufficio.nome}</b>{nomeScelta && <> per <b>{nomeScelta}</b></>}</div>
              <div className="flex items-center gap-2"><UserPlus size={16} className="text-brand-700" />I CUAA non ancora in anagrafica diventano nuove aziende ({conCuaa} righe hanno un CUAA valido)</div>
            </div>
          </div>
        ),
      },
    ];

  return (
    <Wizard
      open={open}
      onClose={() => { if (!lavoro) onClose(); }}
      steps={steps}
      index={esito || lavoro ? 0 : step}
      setIndex={setStep}
      title="Importa domande da Excel"
      icon={<FileSpreadsheet size={20} />}
      onFinish={esito ? onClose : importa}
      finishLabel={esito ? "Chiudi" : `Importa ${righe.length} domande`}
    />
  );
}

/** Riepilogo dopo l'importazione: fatte, stampate, in compilazione, non fatte, per ogni pratica. */
function Riepilogo({ esito, onClose }: { esito: EsitoImportDomande; onClose: () => void }) {
  const { aziende, pratiche, abbinamenti, domande, domandaByKey } = useUfficio();
  const { apriDomanda } = useModals();
  const [aperto, setAperto] = useState<{ p: string; s: StatoDomanda } | null>(null);
  const [nonTrovate, setNonTrovate] = useState(false);
  const righe = useMemo(() => esito.pratiche.map((pid) => pratiche.find((p) => p.id === pid)).filter((p): p is Pratica => !!p).map((p) => {
    const ab = abbinate(aziende, p, abbinamenti, domande);
    const per: Record<StatoDomanda, string[]> = { N: [], C: [], S: [], R: [] };
    for (const id of ab.keys()) per[domandaByKey.get(id + "|" + p.id)?.stato ?? "N"].push(id);
    return { p, per, tot: ab.size };
  }), [esito, pratiche, aziende, abbinamenti, domande, domandaByKey]);
  const azById = useMemo(() => new Map(aziende.map((a) => [a.id, a])), [aziende]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-[13px]">
        <span className="chip !h-8 bg-brand-50 text-brand-800"><Check size={13} />{esito.importate} domande salvate</span>
        {esito.praticheCreate.length > 0 && <span className="chip !h-8 bg-blue-50 text-blue-700"><Plus size={13} />Nuove tipologie: {esito.praticheCreate.join(", ")}</span>}
        {esito.aziendeCreate.length > 0 && <span className="chip !h-8 bg-amber-50 text-amber-800"><UserPlus size={13} />{esito.aziendeCreate.length} aziende create</span>}
      </div>
      {righe.map(({ p, per, tot }) => (
        <div key={p.id} className="rounded-3xl ring-1 ring-ink-100 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="font-extrabold text-[17px] tracking-tight">{p.nome}</div>
            <div className="text-sm text-ink-500">{tot} aziende · <b className="text-ink-800">{tot ? Math.round((per.R.length / tot) * 100) : 0}%</b> fatte</div>
          </div>
          <ProgressStati className="mt-3" counts={{ N: per.N.length, C: per.C.length, S: per.S.length, R: per.R.length }} total={tot} height={9} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            {(["R", "S", "C", "N"] as StatoDomanda[]).map((s) => (
              <Numero key={s} v={per[s].length} l={s === "R" ? "Fatte" : s === "N" ? "Non fatte" : STATI[s].label} tone={s === "R" ? "green" : s === "S" ? "blue" : s === "C" ? "amber" : "red"}
                attivo={aperto?.p === p.id && aperto.s === s} onClick={() => setAperto(aperto?.p === p.id && aperto.s === s ? null : { p: p.id, s })} />
            ))}
          </div>
          <AnimatePresence>
            {aperto?.p === p.id && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl bg-ink-50/70 p-2">
                  {per[aperto.s].length === 0 && <div className="text-center text-sm text-ink-400 py-4">Nessuna azienda</div>}
                  {per[aperto.s].map((id) => {
                    const a = azById.get(id);
                    return a ? (
                      <button key={id} onClick={() => { onClose(); setTimeout(() => apriDomanda(id, p.id), 250); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white text-left">
                        <Avatar name={a.denominazione} size={30} />
                        <span className="flex-1 truncate text-[13.5px] font-semibold">{titleCase(a.denominazione)}</span>
                        <span className="text-[11.5px] font-mono text-ink-400">{a.cuaa}</span>
                      </button>
                    ) : null;
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      {esito.nonTrovate.length > 0 && (
        <div className="rounded-2xl bg-amber-50/70 ring-1 ring-amber-100 p-4">
          <button onClick={() => setNonTrovate((x) => !x)} className="w-full flex items-center gap-2 text-sm font-semibold text-amber-800 text-left">
            <ChevronDown size={16} className={clsx("transition-transform", nonTrovate && "rotate-180")} />{esito.nonTrovate.length} nominativi senza CUAA non abbinati
          </button>
          {nonTrovate && <ul className="mt-2 text-[13px] text-amber-900 max-h-40 overflow-y-auto">{esito.nonTrovate.map((r) => <li key={r.riga}>Riga {r.riga}: <b>{r.nome}</b> — {r.motivo}</li>)}</ul>}
        </div>
      )}
      {esito.scartate.length > 0 && <Scartate righe={esito.scartate} />}
    </div>
  );
}

