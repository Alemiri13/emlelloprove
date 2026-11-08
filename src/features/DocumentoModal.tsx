import { motion } from "framer-motion";
import { type LucideIcon, BadgeCheck, Banknote, File, FileCheck2, FileText, FileUp, FolderOpen, Handshake, IdCard, KeyRound, Map as MapIcon, Paperclip, Receipt, UploadCloud, X } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { KeyRound, Map: MapIcon, IdCard, FolderOpen, FileCheck2, Handshake, Receipt, Banknote, BadgeCheck, Paperclip };
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Wizard } from "../components/ui/Wizard";
import { ChoiceCard, Field, TextInput } from "../components/ui/Inputs";
import { DatePicker } from "../components/ui/DatePicker";
import { Select } from "../components/ui/Select";
import { useFeedback } from "../components/ui/Feedback";
import { CATEGORIE_DOC } from "../lib/domain";
import { fileSize, toISO } from "../lib/format";
import { useCaricaDocumento } from "../lib/queries";
import { useUfficio } from "../lib/ufficio";
import type { Azienda } from "../lib/types";

/** Riconosce categoria e tipo dal nome del file. */
function indovina(nome: string): { cat?: string; tipo?: string } {
  const n = nome.toLowerCase();
  const regole: [RegExp, string, string][] = [
    [/(carta|c\.i\.|identit|patente|passaporto)/, "identita", "Documento d'identità"],
    [/delega|mandato/, "identita", "Delega / mandato CAA"],
    [/privacy/, "identita", "Informativa privacy"],
    [/camerale/, "identita", "Visura camerale"],
    [/visura/, "catasto", "Visura catastale"],
    [/mappa/, "catasto", "Estratto di mappa"],
    [/cdu|urbanistic/, "catasto", "Certificato di destinazione urbanistica (CDU)"],
    [/affitt/, "titoli", "Contratto d'affitto"],
    [/comodato/, "titoli", "Comodato scritto"],
    [/validazion|fascicolo/, "fascicolo", "Scheda di validazione fascicolo"],
    [/uma|libretto/, "domande", "Libretto UMA"],
    [/domanda unica|\bdu\b|pac/, "domande", "Domanda Unica"],
    [/ricevuta/, "domande", "Ricevuta di rilascio"],
    [/fattura|\.xml$/, "fatture", "Fattura di acquisto"],
    [/durc/, "cert", "DURC"],
    [/biolog/, "cert", "Certificato biologico"],
  ];
  for (const [re, cat, tipo] of regole) if (re.test(n)) return { cat, tipo };
  return {};
}

export function DocumentoModal({ open, onClose, azienda }: { open: boolean; onClose: () => void; azienda: Azienda }) {
  const { pratiche } = useUfficio();
  const carica = useCaricaDocumento();
  const { toast } = useFeedback();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [titolo, setTitolo] = useState("");
  const [numero, setNumero] = useState("");
  const [dataDoc, setDataDoc] = useState<string | null>(toISO(new Date()));
  const [scadenza, setScadenza] = useState<string | null>(null);
  const [pratica, setPratica] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setStep(0); setFile(null); setCat(null); setTipo(null); setTitolo(""); setNumero(""); setDataDoc(toISO(new Date())); setScadenza(null); setPratica(null); }
  }, [open]);

  const pick = (f: File | null) => {
    setFile(f);
    if (f) {
      const g = indovina(f.name);
      if (g.cat) setCat(g.cat);
      if (g.tipo) setTipo(g.tipo);
      setTitolo(f.name.replace(/\.[^.]+$/, ""));
    }
  };
  const categoria = CATEGORIE_DOC.find((c) => c.k === cat);

  const finish = async () => {
    try {
      await carica.mutateAsync({
        file,
        meta: {
          azienda_id: azienda.id, categoria: cat ?? "altro", tipo: tipo ?? "Altro", titolo: titolo.trim() || tipo || "Documento",
          numero: numero || null, data_doc: dataDoc, scadenza, pratica_id: pratica, note: null,
        },
      });
      toast("success", "Documento archiviato");
      onClose();
    } catch (e) { toast("error", "Caricamento non riuscito", (e as Error).message); }
  };

  return (
    <Wizard
      open={open}
      onClose={onClose}
      index={step}
      setIndex={setStep}
      title="Carica documento"
      icon={<FileUp size={20} />}
      loading={carica.isPending}
      finishLabel="Archivia"
      onFinish={finish}
      steps={[
        {
          key: "file", title: "File", question: "Quale file vuoi archiviare?", hint: "Trascina qui il file oppure sceglilo dal computer. Puoi anche registrare solo i dati, senza file.", optional: true,
          content: (
            <div>
              <motion.div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0] ?? null); }}
                onClick={() => input.current?.click()}
                animate={{ scale: drag ? 1.015 : 1 }}
                className={clsx("cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition-colors", drag ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/40")}
              >
                <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center mb-4"><UploadCloud size={30} /></div>
                <div className="font-bold text-lg">Trascina il file qui</div>
                <div className="text-sm text-ink-500 mt-1">oppure <span className="text-brand-700 font-semibold">sfoglia</span> · PDF, immagini, XML fino a 20 MB</div>
                <input ref={input} type="file" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
              </motion.div>
              {file && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-3 rounded-2xl bg-ink-50 px-4 py-3">
                  <FileText size={20} className="text-brand-700" />
                  <div className="flex-1 min-w-0"><div className="font-semibold truncate">{file.name}</div><div className="text-xs text-ink-500">{fileSize(file.size)}</div></div>
                  <button onClick={() => pick(null)} className="h-8 w-8 grid place-items-center rounded-full hover:bg-white text-ink-500"><X size={16} /></button>
                </motion.div>
              )}
            </div>
          ),
        },
        {
          key: "cat", title: "Categoria", question: "Di che tipo di documento si tratta?", canNext: !!cat,
          content: (
            <div className="grid sm:grid-cols-2 gap-3">
              {CATEGORIE_DOC.map((c) => {
                const I = ICONS[c.icon] ?? File;
                return <ChoiceCard key={c.k} selected={cat === c.k} onClick={() => { setCat(c.k); if (!(c.tipi as readonly string[]).includes(tipo ?? "")) setTipo(null); setStep(2); }} icon={<I size={20} />} title={c.l} desc={`${c.tipi.length} tipi`} />;
              })}
            </div>
          ),
        },
        {
          key: "tipo", title: "Tipo", question: categoria ? categoria.l : "Tipo di documento", hint: "Scegli il tipo preciso.", canNext: !!tipo,
          content: (
            <div className="flex flex-wrap gap-2.5">
              {categoria?.tipi.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTipo(t); if (!titolo) setTitolo(t); setStep(3); }}
                  className={clsx("h-12 px-5 rounded-2xl border-2 text-[14.5px] font-semibold transition-all active:scale-[.97]", tipo === t ? "border-brand-500 bg-brand-50 text-brand-900" : "border-ink-100 hover:border-ink-200 text-ink-700")}
                >
                  {t}
                </button>
              ))}
            </div>
          ),
        },
        {
          key: "det", title: "Dettagli", question: "Ultimi dettagli", hint: "Indica la scadenza per ricevere un avviso quando sta per scadere.",
          content: (
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Titolo" className="sm:col-span-2"><TextInput value={titolo} onChange={(e) => setTitolo(e.target.value)} /></Field>
              <Field label="Data del documento"><DatePicker value={dataDoc} onChange={setDataDoc} /></Field>
              <Field label="Scadenza" optional><DatePicker value={scadenza} onChange={setScadenza} /></Field>
              <Field label="Numero" optional><TextInput value={numero} onChange={(e) => setNumero(e.target.value)} /></Field>
              <Field label="Pratica collegata" optional>
                <Select value={pratica} onChange={setPratica} clearable onClear={() => setPratica(null)} placeholder="Nessuna" options={pratiche.map((p) => ({ value: p.id, label: p.nome, hint: p.codice ?? undefined }))} />
              </Field>
            </div>
          ),
        },
      ]}
    />
  );
}
