/**
 * Estrazione del testo dai file, interamente nel browser.
 *  - PDF con testo: pdf.js
 *  - PDF scansionati e immagini: OCR in italiano (Tesseract), caricato solo quando serve
 *  - XML / P7M (fatture elettroniche): decodifica del tracciato
 *  - TXT / CSV: lettura diretta
 */
export type Metodo = "pdf" | "ocr" | "xml" | "testo" | "nome";
export interface Estrazione { testo: string; metodo: Metodo; pagine: number; anteprima?: string; avviso?: string }
export type Fase = "lettura" | "ocr" | "classificazione";

const MAX_PAGINE = 6;
const MIN_TESTO_PDF = 80;

export function tipoFile(f: File): "pdf" | "immagine" | "xml" | "testo" | "altro" {
  const n = f.name.toLowerCase();
  if (f.type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (f.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp|gif|tiff?)$/.test(n)) return "immagine";
  if (/\.(xml|p7m)$/.test(n) || f.type.includes("xml")) return "xml";
  if (/\.(txt|csv)$/.test(n) || f.type.startsWith("text/")) return "testo";
  return "altro";
}

// ---------- pdf.js (caricato a richiesta) ----------
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import("pdfjs-dist");
      const worker = (await import("pdfjs-dist/build/pdf.worker.min.js?url")).default;
      lib.GlobalWorkerOptions.workerSrc = worker;
      return lib;
    })();
  }
  return pdfjsPromise;
}

// ---------- OCR (caricato a richiesta, un solo worker riutilizzato) ----------
type OcrWorker = { recognize: (img: HTMLCanvasElement | Blob | string) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };
let ocrPromise: Promise<OcrWorker> | null = null;
let ocrProgress: ((p: number) => void) | null = null;
async function ocr(): Promise<OcrWorker> {
  if (!ocrPromise) {
    ocrPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker("ita", 1, {
        logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") ocrProgress?.(m.progress); },
      });
      return w as unknown as OcrWorker;
    })().catch((e) => { ocrPromise = null; throw e; });
  }
  return ocrPromise;
}

async function ocrSu(img: HTMLCanvasElement | Blob, onProgress?: (p: number) => void) {
  const w = await ocr();
  ocrProgress = onProgress ?? null;
  try { return (await w.recognize(img)).data.text; } finally { ocrProgress = null; }
}

function righeDaItems(items: { str: string; transform: number[] }[]) {
  // ricostruisce le righe usando la coordinata y
  const righe: { y: number; parti: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const y = Math.round(it.transform[5]);
    let r = righe.find((x) => Math.abs(x.y - y) <= 3);
    if (!r) { r = { y, parti: [] }; righe.push(r); }
    r.parti.push({ x: it.transform[4], s: it.str });
  }
  return righe.sort((a, b) => b.y - a.y).map((r) => r.parti.sort((a, b) => a.x - b.x).map((p) => p.s).join(" ")).join("\n");
}

async function canvasPagina(page: { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: unknown) => { promise: Promise<void> } }, scala: number) {
  const vp = page.getViewport({ scale: scala });
  const c = document.createElement("canvas");
  c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return c;
}

export async function estraiTesto(file: File, onFase?: (f: Fase, progresso?: number) => void): Promise<Estrazione> {
  const tipo = tipoFile(file);
  onFase?.("lettura");

  if (tipo === "xml") {
    const buf = new Uint8Array(await file.arrayBuffer());
    let s = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    // P7M firmato: l'XML è racchiuso nella busta, lo si recupera per posizione
    const i = s.indexOf("<?xml") >= 0 ? s.indexOf("<?xml") : s.search(/<(\w+:)?FatturaElettronica/);
    if (i > 0) s = s.slice(i);
    const fine = s.search(/<\/(\w+:)?FatturaElettronica>/);
    if (fine > 0) s = s.slice(0, fine + s.slice(fine).indexOf(">") + 1);
    return { testo: s, metodo: "xml", pagine: 1 };
  }

  if (tipo === "testo") return { testo: (await file.text()).slice(0, 200_000), metodo: "testo", pagine: 1 };

  if (tipo === "pdf") {
    try {
      const lib = await pdfjs();
      const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
      const n = Math.min(doc.numPages, MAX_PAGINE);
      let testo = "";
      let anteprima: string | undefined;
      for (let p = 1; p <= n; p++) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        testo += righeDaItems(tc.items as { str: string; transform: number[] }[]) + "\n\n";
        if (p === 1) anteprima = (await canvasPagina(page as never, 0.35)).toDataURL("image/jpeg", 0.7);
      }
      if (testo.replace(/\s/g, "").length >= MIN_TESTO_PDF) return { testo, metodo: "pdf", pagine: doc.numPages, anteprima };
      // PDF scansionato: OCR delle prime pagine
      onFase?.("ocr", 0);
      let ocrTesto = "";
      const np = Math.min(doc.numPages, 2);
      for (let p = 1; p <= np; p++) {
        const c = await canvasPagina((await doc.getPage(p)) as never, 2);
        ocrTesto += (await ocrSu(c, (x) => onFase?.("ocr", (p - 1 + x) / np))) + "\n\n";
      }
      return { testo: ocrTesto, metodo: "ocr", pagine: doc.numPages, anteprima };
    } catch (e) {
      return { testo: "", metodo: "nome", pagine: 0, avviso: "Non è stato possibile leggere il PDF: " + (e as Error).message };
    }
  }

  if (tipo === "immagine") {
    const anteprima = URL.createObjectURL(file);
    try {
      onFase?.("ocr", 0);
      const testo = await ocrSu(file, (x) => onFase?.("ocr", x));
      return { testo, metodo: "ocr", pagine: 1, anteprima };
    } catch (e) {
      return { testo: "", metodo: "nome", pagine: 1, anteprima, avviso: "Riconoscimento del testo non disponibile: " + (e as Error).message };
    }
  }

  return { testo: "", metodo: "nome", pagine: 0, avviso: "Formato non leggibile: classificato dal nome del file" };
}
