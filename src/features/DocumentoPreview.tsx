import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Download, FileText, Minus, Plus, Sparkles, Trash2, X, FileQuestion } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Badge, InfoRow } from "../components/ui/Misc";
import { Spinner } from "../components/ui/Spinner";
import { useFeedback } from "../components/ui/Feedback";
import { CATEGORIE_DOC, statoDocumento } from "../lib/domain";
import { eur, fileSize, fmtDate, fmtDateTime } from "../lib/format";
import { scaricaDocumento, useEliminaDocumento } from "../lib/queries";
import { leggiFatturaPA, type DatiFattura } from "../lib/analisi/classificatore";
import { pdfjs } from "../lib/analisi/estrazione";
import { useUfficio } from "../lib/ufficio";
import type { Documento } from "../lib/types";

type Contenuto =
  | { tipo: "pdf"; doc: { numPages: number; getPage: (n: number) => Promise<unknown> } }
  | { tipo: "immagine"; url: string }
  | { tipo: "fattura"; dati: DatiFattura; xml: string }
  | { tipo: "testo"; testo: string }
  | { tipo: "altro" };

function genere(d: Documento): "pdf" | "immagine" | "xml" | "testo" | "altro" {
  const n = (d.file_name ?? "").toLowerCase();
  const m = d.mime ?? "";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/.test(n)) return "immagine";
  if (/\.(xml|p7m)$/.test(n) || m.includes("xml")) return "xml";
  if (m.startsWith("text/") || /\.(txt|csv)$/.test(n)) return "testo";
  return "altro";
}

export function DocumentoPreview({ doc, onClose }: { doc: Documento | null; onClose: () => void }) {
  const [ultimo, setUltimo] = useState(doc);
  useEffect(() => { if (doc) setUltimo(doc); }, [doc]);
  const d = doc ?? ultimo;
  const { praticaById } = useUfficio();
  const elimina = useEliminaDocumento();
  const { toast, confirm } = useFeedback();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [contenuto, setContenuto] = useState<Contenuto | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    let annullato = false;
    let urlDaRevocare: string | null = null;
    setBlob(null); setContenuto(null); setErrore(null);
    if (!doc.storage_path) { setContenuto({ tipo: "altro" }); return; }
    (async () => {
      try {
        const b = await scaricaDocumento(doc);
        if (annullato) return;
        setBlob(b);
        const g = genere(doc);
        if (g === "pdf") {
          const lib = await pdfjs();
          const pdf = await lib.getDocument({ data: new Uint8Array(await b.arrayBuffer()), isEvalSupported: false }).promise;
          if (!annullato) setContenuto({ tipo: "pdf", doc: pdf as never });
        } else if (g === "immagine") {
          urlDaRevocare = URL.createObjectURL(b);
          setContenuto({ tipo: "immagine", url: urlDaRevocare });
        } else if (g === "xml") {
          let xml = new TextDecoder().decode(new Uint8Array(await b.arrayBuffer()));
          const i = xml.indexOf("<?xml"); if (i > 0) xml = xml.slice(i);
          const dati = leggiFatturaPA(xml);
          setContenuto(dati ? { tipo: "fattura", dati, xml } : { tipo: "testo", testo: xml });
        } else if (g === "testo") {
          setContenuto({ tipo: "testo", testo: await b.text() });
        } else setContenuto({ tipo: "altro" });
      } catch (e) { if (!annullato) setErrore((e as Error).message); }
    })();
    return () => { annullato = true; const u = urlDaRevocare; if (u) setTimeout(() => URL.revokeObjectURL(u), 1500); };
  }, [doc]);

  const scarica = () => {
    if (!blob || !d) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = d.file_name ?? d.titolo; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  if (!d) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const cat = CATEGORIE_DOC.find((c) => c.k === d.categoria);
  const st = statoDocumento(d);

  return (
    <Modal open={!!doc} onClose={onClose} size="xl" hideClose className="sm:h-[90vh] !max-w-6xl" bodyClassName="!px-0 !pb-0 flex flex-col">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-ink-100">
        <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-800 grid place-items-center"><FileText size={19} /></span>
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{d.titolo}</div>
          <div className="text-xs text-ink-500 truncate">{d.file_name ?? "Nessun file allegato"}{d.size ? ` · ${fileSize(d.size)}` : ""}</div>
        </div>
        {blob && <Button variant="secondary" size="sm" icon={<Download size={15} />} onClick={scarica}>Scarica</Button>}
        <button onClick={onClose} className="h-10 w-10 grid place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition" aria-label="Chiudi"><X size={20} /></button>
      </div>
      <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-0 bg-[#e9ece9] relative">
          {errore ? <Centro><FileQuestion size={34} className="text-ink-400" /><div className="mt-3 font-semibold">Anteprima non disponibile</div><div className="text-sm text-ink-500">{errore}</div></Centro>
            : !contenuto ? <Centro><Spinner size={28} className="text-brand-700" /><div className="mt-3 text-sm text-ink-500">Caricamento anteprima…</div></Centro>
            : contenuto.tipo === "pdf" ? <VistaPdf pdf={contenuto.doc} />
            : contenuto.tipo === "immagine" ? <VistaImmagine url={contenuto.url} />
            : contenuto.tipo === "fattura" ? <VistaFattura dati={contenuto.dati} />
            : contenuto.tipo === "testo" ? <pre className="absolute inset-0 overflow-auto p-6 text-[12px] font-mono whitespace-pre-wrap text-ink-700 bg-white">{contenuto.testo.slice(0, 100000)}</pre>
            : <Centro><FileQuestion size={34} className="text-ink-400" /><div className="mt-3 font-semibold">{d.storage_path ? "Formato senza anteprima" : "Documento registrato senza file"}</div>{blob && <Button className="mt-4" variant="secondary" icon={<Download size={15} />} onClick={scarica}>Scarica il file</Button>}</Centro>}
        </div>
        <aside className="hidden lg:block border-l border-ink-100 overflow-y-auto p-5 bg-white">
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge tone="green">{d.tipo}</Badge>
            {cat && <Badge>{cat.l}</Badge>}
            {d.scadenza && <Badge tone={st === "scaduto" ? "red" : st === "in_scadenza" ? "amber" : "neutral"}><CalendarDays size={11} />{st === "scaduto" ? "Scaduto" : "Scade"} {fmtDate(d.scadenza)}</Badge>}
          </div>
          <InfoRow label="Data documento">{d.data_doc ? fmtDate(d.data_doc) : null}</InfoRow>
          <InfoRow label="Numero" mono>{d.numero}</InfoRow>
          {d.importo != null && <InfoRow label="Importo">{eur(d.importo, 2)}</InfoRow>}
          {d.controparte && <InfoRow label="Controparte">{d.controparte}</InfoRow>}
          {d.foglio && <InfoRow label="Foglio / particelle">{d.foglio}{d.particelle ? ` · ${d.particelle}` : ""}</InfoRow>}
          {d.superficie_ha != null && <InfoRow label="Superficie">{Number(d.superficie_ha).toLocaleString("it-IT", { maximumFractionDigits: 4 })} ha</InfoRow>}
          {d.pratica_id && <InfoRow label="Pratica">{praticaById.get(d.pratica_id)?.nome ?? d.pratica_id}</InfoRow>}
          <InfoRow label="Archiviato">{fmtDateTime(d.created_at)}</InfoRow>
          {d.analisi && (
            <div className="mt-4 rounded-2xl bg-brand-50/70 p-4">
              <div className="flex items-center gap-2 text-[13px] font-bold text-brand-900"><Sparkles size={15} />Riconoscimento automatico</div>
              <div className="text-[13px] text-ink-700 mt-1">{d.analisi.corretto ? <>Proposto «{d.analisi.tipo}», corretto a mano</> : <>«{d.analisi.tipo}» con confidenza {Math.round(d.analisi.confidenza * 100)}%</>}</div>
              {d.analisi.indizi.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{d.analisi.indizi.slice(0, 5).map((i) => <span key={i} className="chip !h-6 !text-[11px] bg-white text-ink-600">{i}</span>)}</div>}
            </div>
          )}
          <Button variant="ghost" className="mt-5 !text-red-600 hover:!bg-red-50 w-full" icon={<Trash2 size={16} />}
            onClick={async () => { if (await confirm({ title: "Eliminare il documento?", message: d.titolo, danger: true, confirmLabel: "Elimina" })) { await elimina.mutateAsync(d); toast("success", "Documento eliminato"); onClose(); } }}>
            Elimina documento
          </Button>
        </aside>
      </div>
    </Modal>
  );
}

const Centro = ({ children }: { children: React.ReactNode }) => <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">{children}</div>;

function VistaPdf({ pdf }: { pdf: { numPages: number; getPage: (n: number) => Promise<unknown> } }) {
  const [pagina, setPagina] = useState(1);
  const [zoom, setZoom] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let annullato = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      setRendering(true);
      const page = (await pdf.getPage(pagina)) as { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: unknown) => { cancel: () => void; promise: Promise<void> } };
      if (annullato || !canvas.current || !box.current) return;
      const base = page.getViewport({ scale: 1 });
      const larghezza = Math.max(320, box.current.clientWidth - 64);
      const scala = (larghezza / base.width) * zoom;
      const dpr = window.devicePixelRatio || 1;
      const vp = page.getViewport({ scale: scala * dpr });
      const c = canvas.current;
      c.width = vp.width; c.height = vp.height;
      c.style.width = `${vp.width / dpr}px`; c.style.height = `${vp.height / dpr}px`;
      task = page.render({ canvasContext: c.getContext("2d")!, viewport: vp });
      try { await task.promise; } catch { /* annullato */ }
      if (!annullato) setRendering(false);
    })();
    return () => { annullato = true; task?.cancel(); };
  }, [pdf, pagina, zoom]);

  return (
    <>
      <div ref={box} className="absolute inset-0 overflow-auto">
        <div className="min-h-full flex justify-center p-8">
          <motion.canvas key={pagina} ref={canvas} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={clsx("bg-white rounded-md shadow-[0_8px_30px_-8px_rgba(0,0,0,.3)] transition-opacity", rendering && "opacity-60")} />
        </div>
      </div>
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-2xl bg-ink-900/90 backdrop-blur text-white p-1.5 shadow-pop">
        <Ctl onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1}><ChevronLeft size={18} /></Ctl>
        <span className="px-2 text-[13px] font-semibold tabular-nums">{pagina} / {pdf.numPages}</span>
        <Ctl onClick={() => setPagina((p) => Math.min(pdf.numPages, p + 1))} disabled={pagina >= pdf.numPages}><ChevronRight size={18} /></Ctl>
        <span className="mx-1 h-5 w-px bg-white/20" />
        <Ctl onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}><Minus size={16} /></Ctl>
        <span className="w-12 text-center text-[13px] font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
        <Ctl onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}><Plus size={16} /></Ctl>
      </div>
    </>
  );
}

function VistaImmagine({ url }: { url: string }) {
  const [zoom, setZoom] = useState(false);
  return (
    <div className="absolute inset-0 overflow-auto flex items-center justify-center p-8">
      <motion.img src={url} alt="" onClick={() => setZoom((z) => !z)} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
        className={clsx("rounded-lg shadow-[0_8px_30px_-8px_rgba(0,0,0,.3)] transition-all duration-300", zoom ? "max-w-none cursor-zoom-out" : "max-h-full max-w-full object-contain cursor-zoom-in")} />
    </div>
  );
}

function VistaFattura({ dati }: { dati: DatiFattura }) {
  return (
    <div className="absolute inset-0 overflow-auto p-8">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-card p-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-ink-400">Fattura elettronica</div>
            <div className="text-2xl font-extrabold tracking-tight mt-1">N. {dati.numero ?? "—"}</div>
            <div className="text-sm text-ink-500">del {fmtDate(dati.data)}</div>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-ink-400 font-semibold">Totale</div>
            <div className="text-2xl font-extrabold text-brand-800 tabular-nums">{eur(dati.totale, 2)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-8">
          {[["Cedente / prestatore", dati.cedente], ["Cessionario / committente", dati.cessionario]].map(([l, p]) => (
            <div key={l as string} className="rounded-xl bg-ink-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{l as string}</div>
              <div className="font-bold mt-1">{(p as DatiFattura["cedente"]).nome ?? "—"}</div>
              <div className="text-xs font-mono text-ink-500 mt-0.5">{(p as DatiFattura["cedente"]).codici.join(" · ")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Ctl({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="h-9 w-9 grid place-items-center rounded-xl hover:bg-white/10 disabled:opacity-30 transition">{children}</button>;
}
