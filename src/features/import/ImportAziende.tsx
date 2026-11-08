import { Building2, Check, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { Wizard, type WizardStep } from "../../components/ui/Wizard";
import { useFeedback } from "../../components/ui/Feedback";
import { useUfficio } from "../../lib/ufficio";
import { creaRiconoscitore, data, leggiExcel, mappaAutomatica, numero, siNo, tabella, testo, type Foglio, type Mappa, type Tabella } from "../../lib/excel";
import { importaAziende, validaAzienda, type EsitoImportAziende, type RigaAzienda } from "../../lib/importazione";
import { normalizzaCuaa } from "../../lib/cf";
import { Avanzamento, DropExcel, MappaColonne, Numero, type CampoDef } from "./Comuni";

type K = "cuaa" | "denominazione" | "data_nascita" | "comune" | "indirizzo" | "cap" | "telefono" | "email" | "pec" | "iban" | "sau_ha" | "colture" | "biologico" | "iap" | "uma" | "note";

const CAMPI: CampoDef<K>[] = [
  { k: "cuaa", l: "CUAA", obbligatorio: true, hint: "Codice fiscale o P.IVA" },
  { k: "denominazione", l: "Denominazione", obbligatorio: true, hint: "Obbligatoria per le nuove" },
  { k: "data_nascita", l: "Data di nascita", hint: "Se manca, dal codice fiscale" },
  { k: "comune", l: "Comune" }, { k: "indirizzo", l: "Indirizzo" }, { k: "cap", l: "CAP" },
  { k: "telefono", l: "Telefono" }, { k: "email", l: "Email" }, { k: "pec", l: "PEC" }, { k: "iban", l: "IBAN" },
  { k: "sau_ha", l: "SAU (ettari)" }, { k: "colture", l: "Colture", hint: "Separate da ; o ," },
  { k: "biologico", l: "Biologico", hint: "SI / NO" }, { k: "iap", l: "IAP / CD", hint: "SI / NO" }, { k: "uma", l: "Utente UMA", hint: "SI / NO" },
  { k: "note", l: "Note" },
];

const riconosci = creaRiconoscitore<K>({
  cuaa: /^(cuaa|codice fiscale|cod\.? ?fisc|c\.?f\.?|cf|partita iva|p\.? ?iva|piva|cf ?\/ ?p ?iva)$|cuaa/,
  denominazione: /denominazion|ragione sociale|nominativ|^nome|cognome e nome|intestatar|azienda$|^ditta/,
  data_nascita: /nascita|nato/,
  comune: /^comune|^citta|localita|residenza/,
  indirizzo: /indirizzo|^via|sede/,
  cap: /^cap$/,
  telefono: /telefon|cellular|^tel|^cell/,
  email: /^e ?mail|^mail/,
  pec: /^pec|posta certificata/,
  iban: /iban/,
  sau_ha: /^sau|superficie|ettari|^ha$/,
  colture: /coltur|coltivazion/,
  biologico: /biolog|^bio$/,
  iap: /^iap|coltivatore|imprenditore agricolo/,
  uma: /^uma|gasolio/,
  note: /^note|annotazion/,
});

export function ImportAziende({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ufficio, uffici, aziende } = useUfficio();
  const qc = useQueryClient();
  const { toast } = useFeedback();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [fogli, setFogli] = useState<Foglio[]>([]);
  const [foglio, setFoglio] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [mappa, setMappa] = useState<Mappa<K>>({});
  const [target, setTarget] = useState<string[]>([]);
  const [lavoro, setLavoro] = useState<{ msg: string; p: number } | null>(null);
  const [esito, setEsito] = useState<EsitoImportAziende | null>(null);

  useEffect(() => {
    if (open) { setStep(0); setFile(null); setFogli([]); setFoglio(null); setErrore(null); setMappa({}); setTarget(uffici.map((u) => u.id)); setLavoro(null); setEsito(null); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const t: Tabella | null = useMemo(() => {
    const f = fogli.find((x) => x.nome === foglio);
    return f ? tabella(f, riconosci) : null;
  }, [fogli, foglio]);
  useEffect(() => { if (t) setMappa(mappaAutomatica(t, riconosci, "cuaa")); }, [t]);

  const carica = async (f: File | null) => {
    setFile(f); setErrore(null); setFogli([]); setFoglio(null);
    if (!f) return;
    try {
      const fs = (await leggiExcel(f)).filter((x) => x.righe.length > 0);
      if (!fs.length) throw new Error("Il file è vuoto");
      setFogli(fs);
      setFoglio((fs.find((x) => /anagraf|aziend/i.test(x.nome)) ?? fs[0]).nome);
    } catch (e) { setErrore("Impossibile leggere il file: " + (e as Error).message); }
  };

  const righe: RigaAzienda[] = useMemo(() => {
    if (!t) return [];
    const v = (r: unknown[], k: K) => (mappa[k] != null ? r[mappa[k]!] : null);
    return t.righe.map((r, i) => ({
      riga: t.rigaIntestazione + i + 1,
      cuaa: normalizzaCuaa(String(v(r, "cuaa") ?? "")), denominazione: testo(v(r, "denominazione")),
      data_nascita: data(v(r, "data_nascita")), comune: testo(v(r, "comune")), indirizzo: testo(v(r, "indirizzo")), cap: testo(v(r, "cap")),
      telefono: testo(v(r, "telefono")), email: testo(v(r, "email")), pec: testo(v(r, "pec")), iban: testo(v(r, "iban"))?.replace(/\s/g, "") ?? null,
      sau_ha: numero(v(r, "sau_ha")), biologico: siNo(v(r, "biologico")), iap: siNo(v(r, "iap")), uma: siNo(v(r, "uma")), note: testo(v(r, "note")),
      colture: (testo(v(r, "colture")) ?? "").split(/[;,/]+/).map((x) => x.trim()).filter(Boolean),
    })).filter((r) => !/esempio/i.test(r.denominazione ?? ""));
  }, [t, mappa]);

  const valide = righe.filter((r) => !validaAzienda(r));
  const giaQui = new Set(aziende.map((a) => a.cuaa));
  const nuoveQui = new Set(valide.filter((r) => !giaQui.has(r.cuaa)).map((r) => r.cuaa)).size;

  const importa = async () => {
    setLavoro({ msg: "Avvio importazione", p: 0 });
    try {
      const e = await importaAziende(righe, target, (msg, p) => setLavoro({ msg: msg.replace(/Ufficio (\S+)/, (_, id) => `Ufficio di ${uffici.find((u) => u.id === id)?.nome ?? id}`), p }));
      setEsito(e);
      await Promise.all(["aziende", "riepilogo-uffici", "colture", "storico"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast("success", "Importazione completata");
    } catch (e) { toast("error", "Importazione non riuscita", (e as Error).message); }
    finally { setLavoro(null); }
  };

  const nome = (id: string) => uffici.find((u) => u.id === id)?.nome ?? id;

  const steps: WizardStep[] = esito ? [{
    key: "fatto", title: "Risultato", question: "Importazione completata",
    content: (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          {Object.entries(esito.perUfficio).map(([u, r]) => (
            <div key={u} className="rounded-2xl ring-1 ring-ink-100 p-4">
              <div className="flex items-center gap-2 font-bold"><Building2 size={16} className="text-brand-700" />{nome(u)}</div>
              <div className="mt-3 flex gap-5">
                <div><div className="text-2xl font-extrabold tabular-nums">{r.nuove}</div><div className="text-xs text-ink-500">nuove</div></div>
                <div><div className="text-2xl font-extrabold tabular-nums">{r.aggiornate}</div><div className="text-xs text-ink-500">aggiornate</div></div>
              </div>
            </div>
          ))}
        </div>
        {esito.coltureCreate.length > 0 && <div className="rounded-2xl bg-brand-50 text-brand-900 px-4 py-3 text-sm">Nuove colture aggiunte al catalogo: <b>{esito.coltureCreate.join(", ")}</b></div>}
        {esito.scartate.length > 0 && <Scartate righe={esito.scartate} />}
      </div>
    ),
  }] : lavoro ? [{ key: "lavoro", title: "Importazione", question: "Importazione in corso…", canNext: false, content: <Avanzamento msg={lavoro.msg} p={lavoro.p} /> }] : [
    {
      key: "file", title: "File", question: "Carica l'elenco delle aziende", hint: "Basta una colonna con il CUAA (e la denominazione per le aziende nuove). Le celle vuote non cancellano i dati già presenti.", canNext: !!t && t.righe.length > 0,
      content: <DropExcel file={file} onFile={carica} fogli={fogli.map((f) => f.nome)} foglio={foglio} onFoglio={setFoglio} righe={t?.righe.length} errore={errore} />,
    },
    {
      key: "colonne", title: "Colonne", question: "Ho riconosciuto queste colonne", hint: "Controlla gli abbinamenti e correggi se serve.", canNext: mappa.cuaa != null,
      content: t ? <MappaColonne campi={CAMPI} tabella={t} mappa={mappa} onChange={(k, c) => setMappa((m) => ({ ...m, [k]: c ?? undefined }))} /> : null,
    },
    {
      key: "uffici", title: "Uffici", question: "In quali uffici le inserisco?", hint: "Ogni ufficio ha la propria anagrafica: la stessa azienda può stare in tutti e tre.", canNext: target.length > 0,
      content: (
        <div className="space-y-3">
          {uffici.map((u) => {
            const on = target.includes(u.id);
            return (
              <button key={u.id} type="button" onClick={() => setTarget((x) => on ? x.filter((y) => y !== u.id) : [...x, u.id])}
                className={clsx("w-full flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all active:scale-[.99]", on ? "border-brand-500 bg-brand-50/60" : "border-ink-100 hover:border-ink-200")}>
                <span className={clsx("h-11 w-11 rounded-xl grid place-items-center", on ? "bg-brand-700 text-white" : "bg-ink-50 text-ink-500")}><Building2 size={20} /></span>
                <span className="flex-1 font-bold text-[16px]">{u.nome}{u.id === ufficio.id && <span className="ml-2 text-xs font-semibold text-ink-400">ufficio attuale</span>}</span>
                <span className={clsx("h-6 w-6 rounded-full grid place-items-center", on ? "bg-brand-600" : "border-2 border-ink-200")}>{on && <Check size={14} className="text-white" strokeWidth={3} />}</span>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      key: "anteprima", title: "Riepilogo", question: "Pronto per importare",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Numero v={righe.length} l="Righe nel file" />
            <Numero v={valide.length} l="Valide" tone="green" />
            <Numero v={righe.length - valide.length} l="Da scartare" tone={righe.length - valide.length ? "red" : "neutral"} />
          </div>
          <div className="rounded-2xl ring-1 ring-ink-100 p-4 text-sm text-ink-700 flex items-start gap-3">
            <FileSpreadsheet size={18} className="text-brand-700 mt-0.5" />
            <span>Uffici: <b>{target.map(nome).join(", ")}</b>. Nell'ufficio di {ufficio.nome} le aziende nuove sono <b>{nuoveQui}</b>, quelle già presenti verranno aggiornate solo nei campi pieni.</span>
          </div>
          {righe.length - valide.length > 0 && <Scartate righe={righe.filter((r) => validaAzienda(r)).map((r) => ({ riga: r.riga, motivo: validaAzienda(r)! }))} />}
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
      title={`Importa aziende da Excel`}
      icon={<FileSpreadsheet size={20} />}
      onFinish={esito ? onClose : importa}
      finishLabel={esito ? "Chiudi" : `Importa ${valide.length} aziende`}
    />
  );
}

export function Scartate({ righe }: { righe: { riga: number; motivo: string }[] }) {
  return (
    <div className="rounded-2xl bg-amber-50/70 ring-1 ring-amber-100 p-4">
      <div className="flex items-center gap-2 font-semibold text-amber-800 text-sm"><AlertTriangle size={16} />{righe.length} righe non importate</div>
      <ul className="mt-2 max-h-40 overflow-y-auto text-[13px] text-amber-900 space-y-0.5">
        {righe.slice(0, 200).map((r, i) => <li key={i}>Riga {r.riga}: {r.motivo}</li>)}
      </ul>
    </div>
  );
}
