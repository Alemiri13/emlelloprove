/**
 * Lettura di file Excel / CSV e riconoscimento automatico delle colonne.
 * La libreria SheetJS viene caricata solo quando serve.
 */
import { normalizzaCuaa } from "./cf";
import { normalizza } from "./analisi/classificatore";
import type { Esito, StatoDomanda } from "./types";

export interface Foglio { nome: string; righe: unknown[][] }
export interface Tabella { intestazioni: string[]; righe: unknown[][]; rigaIntestazione: number }

export async function leggiExcel(file: File): Promise<Foglio[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  return wb.SheetNames.map((nome) => ({
    nome,
    righe: (XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null, blankrows: false }) as unknown[][]),
  }));
}

/** Trova la riga d'intestazione (la prima con almeno 2 celle di testo tra le prime 15) e toglie le colonne vuote. */
export function tabella(f: Foglio, riconosci: (h: string) => string | null): Tabella {
  let best = 0, bestScore = -1;
  for (let i = 0; i < Math.min(15, f.righe.length); i++) {
    const r = f.righe[i] ?? [];
    const testi = r.filter((c) => typeof c === "string" && c.trim()).length;
    const noti = r.filter((c) => typeof c === "string" && riconosci(c)).length;
    const score = noti * 10 + testi;
    if (score > bestScore && testi >= 1) { best = i; bestScore = score; }
  }
  const head = (f.righe[best] ?? []).map((c) => (c == null ? "" : String(c).trim()));
  const righe = f.righe.slice(best + 1).filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
  // colonne completamente vuote → fuori
  const usate = head.map((h, i) => !!h || righe.some((r) => r[i] != null && String(r[i]).trim() !== ""));
  return {
    intestazioni: head.filter((_, i) => usate[i]).map((h, i) => h || `Colonna ${i + 1}`),
    righe: righe.map((r) => head.map((_, i) => r[i] ?? null).filter((_, i) => usate[i])),
    rigaIntestazione: best + 1,
  };
}

// ---------------- riconoscimento colonne ----------------
export type Mappa<K extends string> = Partial<Record<K, number>>;

export function creaRiconoscitore<K extends string>(sinonimi: Record<K, RegExp>) {
  return (h: string): K | null => {
    const n = normalizza(h).replace(/[^a-z0-9 %.]/g, " ").replace(/\s+/g, " ").trim();
    if (!n) return null;
    for (const k of Object.keys(sinonimi) as K[]) if (sinonimi[k].test(n)) return k;
    return null;
  };
}

export function mappaAutomatica<K extends string>(t: Tabella, riconosci: (h: string) => K | null, campionaCuaa?: K): Mappa<K> {
  const m: Mappa<K> = {};
  t.intestazioni.forEach((h, i) => { const k = riconosci(h); if (k && m[k] == null) m[k] = i; });
  // CUAA senza intestazione chiara: cerca la colonna che contiene codici fiscali / P.IVA
  if (campionaCuaa && m[campionaCuaa] == null) {
    for (let i = 0; i < t.intestazioni.length; i++) {
      const vals = t.righe.slice(0, 30).map((r) => normalizzaCuaa(String(r[i] ?? "")));
      if (vals.filter((v) => /^([A-Z0-9]{16}|\d{11})$/.test(v)).length >= Math.max(1, vals.length * 0.6)) { m[campionaCuaa] = i; break; }
    }
  }
  return m;
}

// ---------------- conversione valori ----------------
export function testo(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function numero(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[€\s]|eur(o)?|ha|lt?|litri/gi, "");
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

export function data(v: unknown): string | null {
  if (v == null || v === "") return null;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (v instanceof Date && !isNaN(+v)) return iso(new Date(v.getTime() + 12 * 3600 * 1000));
  if (typeof v === "number" && v > 20000 && v < 80000) return iso(new Date(Math.round((v - 25569) * 86400 * 1000) + 12 * 3600 * 1000));
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) {
    let y = Number(m[3]); if (y < 100) y += y > 50 ? 1900 : 2000;
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    return d.getDate() === Number(m[1]) ? iso(d) : null;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function siNo(v: unknown): boolean | null {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return v;
  const s = normalizza(String(v)).trim();
  if (/^(si|s|x|true|vero|1|yes|y|ok)$/.test(s)) return true;
  if (/^(no|n|false|falso|0)$/.test(s)) return false;
  return null;
}

export function stato(v: unknown): StatoDomanda | null {
  const s = normalizza(String(v ?? "")).trim();
  if (!s) return null;
  if (/^n$|non fatt|non presentat|non rilasciat|da fare|^no$|mancante|da presentare/.test(s)) return "N";
  if (/^s$|stampat|firmat|da rilasciare/.test(s)) return "S";
  if (/^c$|compil|bozza|in corso|lavorazione|aperta|iniziat/.test(s)) return "C";
  if (/^(r|ril|si|ok|fatta|fatto|x)$/.test(s) || /rilasc|presentat|inviat|trasmess|protocollat|completat/.test(s)) return "R";
  return null;
}

export function esito(v: unknown): Esito | null {
  const s = normalizza(String(v ?? "")).trim();
  if (!s) return null;
  if (/non ammess|respint|rigett|esclus|^x$/.test(s)) return "X";
  if (/in parte|parzial|^p$/.test(s)) return "P";
  if (/ammess|accolt|finanziat|liquidat|^a$/.test(s)) return "A";
  if (/istruttori|attesa|^i$/.test(s)) return "I";
  return null;
}
