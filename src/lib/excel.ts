/**
 * Riconoscimento intelligente di file Excel / CSV.
 *
 * Per ogni foglio:
 *  1. trova la riga d'intestazione (anche dopo righe di titolo, anche su due righe con celle unite,
 *     oppure assente: in quel caso lavora solo sul contenuto);
 *  2. profila ogni colonna sul contenuto (codici fiscali con carattere di controllo, partite IVA anche
 *     se Excel ha tolto gli zeri iniziali, date, stati della domanda, esiti, nominativi, codici, sì/no…);
 *  3. confronta le intestazioni con un dizionario di sinonimi, con espansione delle abbreviazioni
 *     (c.f., p.iva, nr., dt.…) e tolleranza agli errori di battitura (distanza di Levenshtein);
 *  4. combina i due punteggi e assegna ogni campo alla colonna migliore (una colonna = un campo);
 *  5. sceglie da solo il foglio più adatto quando il file ne ha più d'uno.
 * Ogni abbinamento ha una confidenza e una spiegazione leggibile.
 */
import { normalizza } from "./analisi/classificatore";
import type { Esito, StatoDomanda } from "./types";

// =====================================================================
// Lettura
// =====================================================================
export interface Foglio { nome: string; righe: unknown[][] }

export async function leggiExcel(file: File): Promise<Foglio[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, dense: true });
  return wb.SheetNames.map((nome) => {
    const ws = wb.Sheets[nome];
    const righe = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false }) as unknown[][];
    // celle unite: ripete il valore su tutta l'area (utile per intestazioni su due righe)
    for (const m of (ws["!merges"] ?? []) as { s: { r: number; c: number }; e: { r: number; c: number } }[]) {
      const v = righe[m.s.r]?.[m.s.c];
      if (v == null) continue;
      for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) {
        if (!righe[r]) continue;
        if (righe[r][c] == null) righe[r][c] = v;
      }
    }
    return { nome, righe };
  });
}

// =====================================================================
// Conversione valori
// =====================================================================
export function testo(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toLocaleDateString("it-IT");
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

export function numero(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[€\s]|eur(o)?|ha|lt?\.?|litri/gi, "");
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

const isoDi = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function data(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(+v)) return isoDi(new Date(v.getTime() + 12 * 3600 * 1000));
  if (typeof v === "number" && v > 25000 && v < 73000 && Number.isInteger(v)) return isoDi(new Date(Math.round((v - 25569) * 86400 * 1000) + 12 * 3600 * 1000));
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (m) {
    let y = Number(m[3]); if (y < 100) y += y > 50 ? 1900 : 2000;
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 ? isoDi(d) : null;
  }
  m = s.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const mesi = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  m = normalizza(s).match(/^(\d{1,2}) ([a-z]{3})[a-z]* (\d{4})$/);
  if (m && mesi.includes(m[2])) return isoDi(new Date(Number(m[3]), mesi.indexOf(m[2]), Number(m[1])));
  return null;
}

export function siNo(v: unknown): boolean | null {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return v;
  const s = normalizza(String(v)).trim();
  if (/^(si|s|x|true|vero|1|yes|y|ok|v|✓|✔)$/.test(s)) return true;
  if (/^(no|n|false|falso|0|-)$/.test(s)) return false;
  return null;
}

export function stato(v: unknown): StatoDomanda | null {
  if (typeof v === "boolean") return v ? "R" : "N";
  const s = normalizza(String(v ?? "")).trim();
  if (!s) return null;
  if (/^n$|non fatt|non presentat|non rilasciat|non inviat|da fare|^no$|mancante|da presentare|annullat|rinunci/.test(s)) return "N";
  if (/^s$|stampat|firmat|da rilasciare|da firmare|in firma/.test(s)) return "S";
  if (/^c$|compil|bozza|in corso|lavorazione|aperta|iniziat|inserit|caricat|da completare/.test(s)) return "C";
  if (/^(r|ril|si|ok|fatta|fatto|x|v|1|presentata|inviata)$/.test(s) || /rilasc|presentat|inviat|trasmess|protocollat|completat|chius/.test(s)) return "R";
  return null;
}

export function esito(v: unknown): Esito | null {
  const s = normalizza(String(v ?? "")).trim();
  if (!s) return null;
  if (/non ammess|respint|rigett|esclus|non finanziab|^x$|negativ/.test(s)) return "X";
  if (/in parte|parzial|^p$|ridott/.test(s)) return "P";
  if (/ammess|accolt|finanziat|liquidat|positiv|^a$|approvat/.test(s)) return "A";
  if (/istruttori|attesa|valutazion|^i$/.test(s)) return "I";
  return null;
}

// =====================================================================
// CUAA (codice fiscale / partita IVA)
// =====================================================================
const ODD: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const RE_CF = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
function controlloCF(cf: string) {
  let s = 0;
  for (let i = 0; i < 15; i++) s += i % 2 === 0 ? ODD[cf[i]] ?? 0 : /\d/.test(cf[i]) ? Number(cf[i]) : cf.charCodeAt(i) - 65;
  return String.fromCharCode(65 + (s % 26)) === cf[15];
}
function controlloPIVA(p: string) {
  let s = 0;
  for (let i = 0; i < 11; i++) { let n = Number(p[i]); if (i % 2) { n *= 2; if (n > 9) n -= 9; } s += n; }
  return s % 10 === 0 && !/^0+$/.test(p);
}

/** Restituisce il CUAA normalizzato o null. Ripristina gli zeri iniziali tolti da Excel alle partite IVA. */
export function cuaaDa(v: unknown): { cuaa: string; tipo: "CF" | "PIVA"; controllo: boolean } | null {
  if (v == null) return null;
  let s = typeof v === "number" ? String(Math.trunc(v)) : String(v);
  s = s.toUpperCase().replace(/^\s*(IT)(?=\d{11}\b)/, "").replace(/[^A-Z0-9]/g, "");
  if (/^\d{8,11}$/.test(s)) s = s.padStart(11, "0");
  if (/^\d{11}$/.test(s)) return { cuaa: s, tipo: "PIVA", controllo: controlloPIVA(s) };
  if (s.length === 16 && RE_CF.test(s)) return { cuaa: s, tipo: "CF", controllo: controlloCF(s) };
  return null;
}

// =====================================================================
// Profilo del contenuto di una colonna
// =====================================================================
export interface Profilo {
  n: number; vuote: number;
  cuaa: number; cuaaControllo: number; date: number; dateNascita: number; numeri: number; interi: number; decimali: number;
  stati: number; esiti: number; siNo: number; nomi: number; codici: number; email: number; pec: number; telefoni: number;
  cap: number; iban: number; testoLungo: number; distinti: number; ripetuti: number; tipiDomanda: number;
}

const PAROLE_TIPO = /\b(du|pac|domanda unica|uma|vendemmia|giacenza|sr[a-h]\s?\d{2}|psr|csr|ocm|rrv|isi|inail|ismea|bando|misura|intervento|assicura|titoli|riserva|gasolio|carburant|biologic|insediamento|giovani)\b/;

function eNominativo(s: string) {
  if (s.length < 5 || s.length > 90 || /\d/.test(s)) return false;
  if (!/^[A-Za-zÀ-ÿ'’.\-& ]+$/.test(s)) return false;
  const w = s.trim().split(/\s+/);
  if (w.length < 2 || w.length > 12) return false;
  if (stato(s) || esito(s)) return false;
  return true;
}

export function profila(valori: unknown[]): Profilo {
  const p: Profilo = { n: 0, vuote: 0, cuaa: 0, cuaaControllo: 0, date: 0, dateNascita: 0, numeri: 0, interi: 0, decimali: 0, stati: 0, esiti: 0, siNo: 0, nomi: 0, codici: 0, email: 0, pec: 0, telefoni: 0, cap: 0, iban: 0, testoLungo: 0, distinti: 0, ripetuti: 0, tipiDomanda: 0 };
  const visti = new Map<string, number>();
  const campione = valori.slice(0, 400);
  for (const v of campione) {
    if (v == null || (typeof v === "string" && !v.trim())) { p.vuote++; continue; }
    p.n++;
    const s = v instanceof Date ? "" : String(v).trim();
    const k = v instanceof Date ? isoDi(v) : normalizza(s);
    visti.set(k, (visti.get(k) ?? 0) + 1);
    const c = cuaaDa(v);
    // un numero piccolo non è una partita IVA
    if (c && (c.tipo === "CF" || (typeof v === "string" ? /^\s*(IT)?\s*\d{11}\s*$/i.test(v) : Math.abs(Number(v)) >= 1e7))) { p.cuaa++; if (c.controllo) p.cuaaControllo++; }
    const d = v instanceof Date ? isoDi(v) : typeof v === "string" ? data(v) : null;
    if (d) { p.date++; if (d < "2008-01-01" && d > "1910-01-01") p.dateNascita++; }
    const num = typeof v === "number" ? v : typeof v === "string" && /^[\d\s.,€-]+$/.test(v) ? numero(v) : null;
    if (num != null && !(v instanceof Date)) { p.numeri++; if (Number.isInteger(num)) p.interi++; else p.decimali++; }
    if (typeof v === "boolean" || stato(v)) p.stati++;
    if (esito(v)) p.esiti++;
    if (siNo(v) != null) p.siNo++;
    if (typeof v === "string") {
      if (eNominativo(s)) p.nomi++;
      if (/\d/.test(s) && /^[A-Za-z0-9][A-Za-z0-9\/\-_.]{4,}$/.test(s) && !c && !data(s)) p.codici++;
      if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s)) { p.email++; if (/pec|legalmail|cert/i.test(s)) p.pec++; }
      if (/^\+?[\d\s/.-]{8,16}$/.test(s) && (s.match(/\d/g)?.length ?? 0) >= 8 && !data(s)) p.telefoni++;
      if (/^\d{5}$/.test(s)) p.cap++;
      if (/^IT\d{2}[A-Z]\d{10}[A-Z0-9]{12}$/i.test(s.replace(/\s/g, ""))) p.iban++;
      if (s.length > 40) p.testoLungo++;
      if (PAROLE_TIPO.test(normalizza(s))) p.tipiDomanda++;
    } else if (typeof v === "number") {
      if (Number.isInteger(v) && v >= 10000 && v <= 99999) p.cap++;
      if (Number.isInteger(v) && v >= 1e5 && !c) p.codici++;
    }
  }
  p.distinti = visti.size;
  p.ripetuti = [...visti.values()].filter((x) => x > 1).length;
  return p;
}

const r = (x: number, p: Profilo) => (p.n ? x / p.n : 0);

// =====================================================================
// Intestazioni: normalizzazione, abbreviazioni, somiglianza
// =====================================================================
const ABBREVIAZIONI: [RegExp, string][] = [
  [/\bc\s?\.?\s?f\b\.?/g, "codice fiscale"], [/\bcod\b\.?\s*fisc\w*/g, "codice fiscale"], [/\bcodfisc\w*/g, "codice fiscale"],
  [/\bp\s?\.?\s?iva\b/g, "partita iva"], [/\bpiva\b/g, "partita iva"], [/\bpart\b\.?\s*iva/g, "partita iva"],
  [/\bnr\b\.?|\bnum\b\.?|\bn\s?°|\bn\b\.?(?=\s|$)/g, "numero"], [/\bdt\b\.?/g, "data"], [/\bdata\s*(pres|ril)\w*/g, "data presentazione"],
  [/\brag\b\.?\s*soc\w*/g, "ragione sociale"], [/\bdenom\w*/g, "denominazione"], [/\btel\b\.?/g, "telefono"], [/\bcell\b\.?/g, "cellulare"],
  [/\bind\b\.?/g, "indirizzo"], [/\bdom\b\.?/g, "domanda"], [/\bprat\b\.?/g, "pratica"], [/\bsup\b\.?/g, "superficie"], [/\blt\b\.?/g, "litri"],
  [/\bprot\b\.?/g, "protocollo"], [/\bnom\b\.?(?=\s|$)/g, "nominativo"], [/\bcogn\b\.?/g, "cognome"], [/\bcomp\b\.?/g, "compilazione"],
];

export function normalizzaIntestazione(h: string) {
  let s = normalizza(h).replace(/[_/\\|]+/g, " ").replace(/\s+/g, " ").trim();
  for (const [re, sost] of ABBREVIAZIONI) s = s.replace(re, sost);
  return s.replace(/[^a-z0-9 %]/g, " ").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m + n;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const simile = (a: string, b: string) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

/** 0..1: quanto l'intestazione corrisponde a uno dei sinonimi. */
export function punteggioIntestazione(h: string, sinonimi: string[], vieta?: RegExp): number {
  const n = normalizzaIntestazione(h);
  if (!n) return 0;
  if (vieta && vieta.test(n)) return 0;
  const parole = n.split(" ");
  let best = 0;
  for (const s of sinonimi) {
    if (n === s) return 1;
    const sp = s.split(" ");
    if (new RegExp(`(^| )${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(n)) best = Math.max(best, 0.9 - Math.min(0.25, (parole.length - sp.length) * 0.05));
    // errori di battitura: confronto fuzzy sull'intera intestazione e parola per parola
    const f = simile(n, s);
    if (f >= 0.8) best = Math.max(best, 0.55 + 0.4 * f);
    if (sp.length === 1) for (const w of parole) if (w.length >= 4 && simile(w, s) >= 0.8) best = Math.max(best, 0.7);
    const comuni = sp.filter((w) => parole.some((x) => x === w || (w.length >= 5 && simile(x, w) >= 0.8))).length;
    if (sp.length > 1 && comuni === sp.length) best = Math.max(best, 0.82);
  }
  return best;
}

// =====================================================================
// Campi
// =====================================================================
export interface CampoSpec<K extends string> {
  k: K; etichetta: string; sinonimi: string[]; vieta?: RegExp;
  contenuto?: (p: Profilo) => number; obbligatorio?: boolean; hint?: string;
}

export const CAMPI_AZIENDA: CampoSpec<KAzienda>[] = [];
export type KAzienda = "cuaa" | "denominazione" | "cognome" | "nome" | "data_nascita" | "comune" | "indirizzo" | "cap" | "telefono" | "email" | "pec" | "iban" | "sau_ha" | "colture" | "biologico" | "iap" | "uma" | "note";
export type KDomanda = "cuaa" | "denominazione" | "cognome" | "nome" | "stato" | "numero" | "data_presentazione" | "esito" | "motivi" | "data_esito" | "litri_assegnati" | "note";

const cCuaa = (p: Profilo) => Math.min(1, r(p.cuaa, p) * 1.05) * (p.n >= 1 ? 1 : 0);
const cNomi = (p: Profilo) => r(p.nomi, p) * (p.distinti / Math.max(1, p.n) > 0.6 ? 1 : 0.4);
const cNomeSingolo = (p: Profilo) => {
  // colonne «cognome» / «nome» separate: parole singole, molto varie
  return 0.3 * (p.distinti / Math.max(1, p.n));
};

const COMUNI: Pick<CampoSpec<KAzienda & KDomanda>, "k" | "etichetta" | "sinonimi" | "contenuto" | "vieta" | "hint">[] = [
  { k: "cuaa", etichetta: "CUAA", hint: "Codice fiscale o P.IVA", sinonimi: ["cuaa", "codice fiscale", "partita iva", "codice fiscale partita iva", "codice fiscale o partita iva", "identificativo fiscale", "codice azienda", "id fiscale", "fiscale"], contenuto: cCuaa },
  { k: "denominazione", etichetta: "Nominativo / denominazione", sinonimi: ["denominazione", "ragione sociale", "nominativo", "cognome e nome", "cognome nome", "nome e cognome", "intestatario", "azienda", "ditta", "beneficiario", "richiedente", "titolare", "produttore", "socio", "cliente", "anagrafica", "nome azienda", "denominazione azienda"], vieta: /^(nome|cognome)$/, contenuto: cNomi },
  { k: "cognome", etichetta: "Cognome", sinonimi: ["cognome"], vieta: /nome e cognome|cognome e nome|cognome nome/, contenuto: cNomeSingolo },
  { k: "nome", etichetta: "Nome", sinonimi: ["nome"], vieta: /cognome|azienda|ditta|file|foglio/, contenuto: cNomeSingolo },
];

CAMPI_AZIENDA.push(
  ...(COMUNI as CampoSpec<KAzienda>[]),
  { k: "data_nascita", etichetta: "Data di nascita", sinonimi: ["data di nascita", "data nascita", "nascita", "nato il", "data nato"], contenuto: (p) => r(p.dateNascita, p) * 0.6 },
  { k: "comune", etichetta: "Comune", sinonimi: ["comune", "citta", "localita", "comune di residenza", "residenza", "comune sede", "sede comune"], vieta: /nascita/ },
  { k: "indirizzo", etichetta: "Indirizzo", sinonimi: ["indirizzo", "via", "sede", "domicilio", "indirizzo sede", "recapito"] },
  { k: "cap", etichetta: "CAP", sinonimi: ["cap", "codice postale"], contenuto: (p) => r(p.cap, p) * 0.7 },
  { k: "telefono", etichetta: "Telefono", sinonimi: ["telefono", "cellulare", "recapito telefonico", "tel cellulare", "mobile"], contenuto: (p) => r(p.telefoni, p) * 0.8 },
  { k: "email", etichetta: "Email", sinonimi: ["email", "e mail", "mail", "posta elettronica", "indirizzo email"], vieta: /pec|certificat/, contenuto: (p) => r(p.email - p.pec, p) },
  { k: "pec", etichetta: "PEC", sinonimi: ["pec", "posta certificata", "posta elettronica certificata", "email pec"], contenuto: (p) => r(p.pec, p) },
  { k: "iban", etichetta: "IBAN", sinonimi: ["iban", "coordinate bancarie", "conto corrente"], contenuto: (p) => r(p.iban, p) },
  { k: "sau_ha", etichetta: "SAU (ettari)", sinonimi: ["sau", "superficie", "superficie agricola", "superficie agricola utilizzata", "ettari", "ha", "superficie ha", "sat"], contenuto: (p) => (r(p.decimali, p) > 0.3 ? 0.3 : 0) },
  { k: "colture", etichetta: "Colture", hint: "Separate da ; o ,", sinonimi: ["colture", "coltura", "coltivazioni", "ordinamento colturale", "piano colturale", "produzioni"] },
  { k: "biologico", etichetta: "Biologico", hint: "SI / NO", sinonimi: ["biologico", "bio", "agricoltura biologica", "certificazione biologica"] },
  { k: "iap", etichetta: "IAP / CD", hint: "SI / NO", sinonimi: ["iap", "coltivatore diretto", "imprenditore agricolo professionale", "iap cd", "cd"] },
  { k: "uma", etichetta: "Utente UMA", hint: "SI / NO", sinonimi: ["uma", "utente uma", "libretto uma", "gasolio agricolo"] },
  { k: "note", etichetta: "Note", sinonimi: ["note", "annotazioni", "osservazioni", "commenti"], contenuto: (p) => r(p.testoLungo, p) * 0.4 },
);

export const CAMPI_DOMANDA: CampoSpec<KDomanda>[] = [
  ...(COMUNI as CampoSpec<KDomanda>[]),
  { k: "stato", etichetta: "Stato", hint: "Rilasciata, Stampata, In compilazione…", sinonimi: ["stato", "stato domanda", "stato pratica", "situazione", "avanzamento", "fase", "stato lavorazione", "rilasciata", "fatta", "presentata", "esito pratica", "status"], vieta: /esito istrutt|data/, contenuto: (p) => (p.distinti <= 12 ? r(p.stati, p) : r(p.stati, p) * 0.5) },
  { k: "numero", etichetta: "N. domanda", sinonimi: ["numero domanda", "numero", "numero pratica", "protocollo", "numero protocollo", "barcode", "codice a barre", "id domanda", "identificativo domanda", "codice domanda", "numero di domanda"], vieta: /telefono|cellulare|civico|ettari|litri|cap/, contenuto: (p) => r(p.codici, p) * (p.distinti / Math.max(1, p.n) > 0.8 ? 0.85 : 0.3) },
  { k: "data_presentazione", etichetta: "Data presentazione", sinonimi: ["data presentazione", "data", "data rilascio", "data invio", "data domanda", "data protocollo", "presentata il", "data di presentazione", "data trasmissione"], vieta: /nascita|esito|scadenza|pagamento/, contenuto: (p) => r(p.date, p) * 0.75 },
  { k: "esito", etichetta: "Esito", sinonimi: ["esito", "esito istruttoria", "esito istruttorio", "ammissibilita", "esito domanda", "ammessa"], vieta: /data/, contenuto: (p) => r(p.esiti, p) * 0.8 },
  { k: "motivi", etichetta: "Motivi rigetto", sinonimi: ["motivo", "motivi", "motivazione", "causale", "motivo rigetto", "motivi esclusione", "anomalie"], contenuto: (p) => r(p.testoLungo, p) * 0.3 },
  { k: "data_esito", etichetta: "Data esito", sinonimi: ["data esito", "data istruttoria", "data ammissione", "data decreto"], contenuto: (p) => r(p.date, p) * 0.3 },
  { k: "litri_assegnati", etichetta: "Litri assegnati", sinonimi: ["litri", "litri assegnati", "gasolio assegnato", "quantita assegnata", "carburante assegnato", "lt assegnati"] },
  { k: "note", etichetta: "Note", sinonimi: ["note", "annotazioni", "osservazioni", "commenti"], contenuto: (p) => r(p.testoLungo, p) * 0.4 },
];

// =====================================================================
// Analisi di un foglio
// =====================================================================
export interface Abbinamento { col: number; confidenza: number; perche: string }
export interface Analisi<K extends string> {
  foglio: string;
  intestazioni: string[];
  righe: unknown[][];
  rigaIntestazione: number; // 0 = nessuna intestazione
  mappa: Partial<Record<K, Abbinamento>>;
  punteggio: number;
  avvisi: string[];
}

const lettera = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));

function rigaSembraDati(riga: unknown[]) {
  return riga.some((c) => c instanceof Date || (cuaaDa(c)?.tipo === "CF") || (typeof c === "number" && Math.abs(c) > 0));
}

function punteggioRigaIntestazione<K extends string>(riga: unknown[], campi: CampoSpec<K>[]) {
  let s = 0, testi = 0;
  for (const c of riga) {
    if (typeof c !== "string" || !c.trim()) continue;
    if (c.length > 60) continue;
    testi++;
    let best = 0;
    for (const f of campi) best = Math.max(best, punteggioIntestazione(c, f.sinonimi, f.vieta));
    if (best >= 0.6) s += best;
  }
  if (rigaSembraDati(riga)) s -= 2;
  return s + Math.min(testi, 6) * 0.05;
}

function costruisciMappa<K extends string>(intestazioni: string[], righe: unknown[][], campi: CampoSpec<K>[], conIntestazione: boolean) {
  const profili = intestazioni.map((_, i) => profila(righe.map((rr) => rr[i])));
  const candidati: { k: K; col: number; tot: number; h: number; c: number }[] = [];
  campi.forEach((f) => intestazioni.forEach((h, i) => {
    if (profili[i].n === 0) return;
    const hs = conIntestazione ? punteggioIntestazione(h, f.sinonimi, f.vieta) : 0;
    const cs = f.contenuto ? f.contenuto(profili[i]) : 0;
    let tot = hs >= 0.5 ? (f.contenuto ? 0.62 * hs + 0.38 * Math.max(cs, hs * 0.6) : hs) : cs * 0.88;
    // il contenuto smentisce l'intestazione: una colonna «CF» senza codici fiscali non è il CUAA
    if (f.k === "cuaa" && hs >= 0.5 && r(profili[i].cuaa, profili[i]) < 0.2) tot *= 0.4;
    if ((f.k === "data_presentazione" || f.k === "data_esito") && hs >= 0.5 && r(profili[i].date, profili[i]) < 0.3) tot *= 0.5;
    // «N.» progressivo (1, 2, 3…) non è il numero di domanda
    if (f.k === "numero" && r(profili[i].codici, profili[i]) < 0.2 && r(profili[i].interi, profili[i]) > 0.8) tot *= 0.35;
    if (tot >= 0.42) candidati.push({ k: f.k, col: i, tot, h: hs, c: cs });
  }));
  candidati.sort((a, b) => b.tot - a.tot);
  const mappa: Partial<Record<K, Abbinamento>> = {};
  const usate = new Set<number>();
  for (const c of candidati) {
    if (mappa[c.k] || usate.has(c.col)) continue;
    const p = profili[c.col];
    const motivi: string[] = [];
    if (c.h >= 0.5) motivi.push(`intestazione «${intestazioni[c.col]}»`);
    if (c.k === "cuaa") motivi.push(`${Math.round(r(p.cuaa, p) * 100)}% codici fiscali/P.IVA validi`);
    else if (c.k === "stato" && p.stati) motivi.push(`${Math.round(r(p.stati, p) * 100)}% valori di stato riconosciuti`);
    else if (c.k === "denominazione" && p.nomi) motivi.push(`${Math.round(r(p.nomi, p) * 100)}% nominativi`);
    else if (c.k.startsWith("data") && p.date) motivi.push(`${Math.round(r(p.date, p) * 100)}% date`);
    else if (c.c >= 0.42 && c.h < 0.5) motivi.push("riconosciuta dal contenuto");
    mappa[c.k] = { col: c.col, confidenza: Math.round(Math.min(0.99, c.tot) * 100) / 100, perche: motivi.join(" · ") };
    usate.add(c.col);
  }
  // nominativo e cognome/nome: se c'è la colonna completa, le parziali non servono
  if (mappa["denominazione" as K] && (mappa["cognome" as K] || mappa["nome" as K])) {
    const d = mappa["denominazione" as K]!;
    if (d.confidenza >= 0.7) { delete mappa["cognome" as K]; delete mappa["nome" as K]; }
  }
  // cognome e nome senza denominazione: vanno bene insieme, da soli no
  if (!mappa["denominazione" as K] && !(mappa["cognome" as K] && mappa["nome" as K])) { delete mappa["cognome" as K]; delete mappa["nome" as K]; }
  return { mappa, profili };
}

export function analizzaFoglio<K extends string>(f: Foglio, campi: CampoSpec<K>[]): Analisi<K> {
  const righe = f.righe.filter((rr) => rr && rr.some((c) => c != null && String(c).trim() !== ""));
  const avvisi: string[] = [];
  if (!righe.length) return { foglio: f.nome, intestazioni: [], righe: [], rigaIntestazione: 0, mappa: {}, punteggio: 0, avvisi: ["Foglio vuoto"] };
  const larghezza = Math.max(...righe.slice(0, 200).map((rr) => rr.length));

  // 1. riga d'intestazione (singola o doppia)
  let migliore = { idx: -1, doppia: false, s: 0.5 };
  for (let i = 0; i < Math.min(25, righe.length); i++) {
    const s1 = punteggioRigaIntestazione(righe[i], campi);
    if (s1 > migliore.s) migliore = { idx: i, doppia: false, s: s1 };
    if (i + 1 < righe.length && !rigaSembraDati(righe[i + 1])) {
      const unita = Array.from({ length: larghezza }, (_, c) => [righe[i][c], righe[i + 1][c]].filter((x) => typeof x === "string" && x.trim()).join(" ")).map((x) => x || null);
      const s2 = punteggioRigaIntestazione(unita, campi);
      if (s2 > migliore.s + 0.4) migliore = { idx: i, doppia: true, s: s2 };
    }
  }

  let intestazioni: string[];
  let dati: unknown[][];
  let rigaIntestazione = 0;
  if (migliore.idx >= 0) {
    const i = migliore.idx;
    const raw = migliore.doppia
      ? Array.from({ length: larghezza }, (_, c) => [...new Set([righe[i][c], righe[i + 1][c]].filter((x) => x != null && String(x).trim()).map(String))].join(" "))
      : Array.from({ length: larghezza }, (_, c) => (righe[i][c] == null ? "" : String(righe[i][c]).trim()));
    intestazioni = raw.map((h, c) => h || `Colonna ${lettera(c)}`);
    dati = righe.slice(i + (migliore.doppia ? 2 : 1));
    rigaIntestazione = i + 1;
    if (i > 0 || migliore.doppia) avvisi.push(`Intestazione trovata dopo ${i} ${i === 1 ? "riga" : "righe"} di titolo${migliore.doppia ? ", su due righe" : ""}`);
  } else {
    intestazioni = Array.from({ length: larghezza }, (_, c) => `Colonna ${lettera(c)}`);
    // salta eventuali righe di titolo prima dei dati
    const inizio = righe.findIndex((rr) => rigaSembraDati(rr));
    dati = righe.slice(Math.max(0, inizio));
    avvisi.push("Nessuna intestazione: colonne riconosciute dal contenuto");
  }
  // righe di totale / piè di pagina
  dati = dati.filter((rr) => !rr.some((c) => typeof c === "string" && /^\s*(totale|totali|tot\.)\b/i.test(c)));
  // colonne vuote
  const usate = intestazioni.map((_, c) => dati.some((rr) => rr[c] != null && String(rr[c]).trim() !== ""));
  const idx = intestazioni.map((_, c) => c).filter((c) => usate[c]);
  intestazioni = idx.map((c) => intestazioni[c]);
  dati = dati.map((rr) => idx.map((c) => rr[c] ?? null));

  const { mappa } = costruisciMappa(intestazioni, dati, campi, migliore.idx >= 0);
  const conf = Object.values(mappa) as Abbinamento[];
  const punteggio = conf.reduce((s, a) => s + a.confidenza, 0) + (mappa["cuaa" as K] ? 2 : 0) + (mappa["denominazione" as K] ? 1 : 0) + Math.log10(dati.length + 1);
  return { foglio: f.nome, intestazioni, righe: dati, rigaIntestazione, mappa, punteggio, avvisi };
}

/** Sceglie il foglio migliore del file (quello con più campi riconosciuti e più righe). */
export function analizzaFile<K extends string>(fogli: Foglio[], campi: CampoSpec<K>[], preferito?: RegExp): Analisi<K>[] {
  return fogli.map((f) => {
    const a = analizzaFoglio(f, campi);
    if (preferito && preferito.test(f.nome)) a.punteggio += 1.5;
    if (/istruzion|legenda|note|esempio/i.test(f.nome)) a.punteggio -= 3;
    return a;
  }).sort((a, b) => b.punteggio - a.punteggio);
}

/** Valore di un campo in una riga (gestisce cognome + nome separati). */
export function valore<K extends string>(a: Pick<Analisi<K>, "mappa">, riga: unknown[], k: K): unknown {
  const m = a.mappa[k];
  if (m) return riga[m.col];
  if (k === ("denominazione" as K)) {
    const c = a.mappa["cognome" as K], n = a.mappa["nome" as K];
    if (c && n) return [riga[c.col], riga[n.col]].filter((x) => x != null && String(x).trim()).join(" ") || null;
  }
  return null;
}

export function confidenzaMedia<K extends string>(a: Analisi<K>, chiavi: K[]) {
  const v = chiavi.map((k) => a.mappa[k]?.confidenza).filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
}
