/**
 * Lettura del «brogliaccio» (consistenza / piano colturale del fascicolo aziendale) da Excel:
 * trova la colonna della coltura e quella della superficie, somma le superfici per coltura
 * e propone l'abbinamento al catalogo delle colture.
 *
 * Non esiste un tracciato unico (cambia per regione e per versione SIAN), quindi le colonne si riconoscono
 * da intestazione + contenuto, come per gli altri Excel. Superfici accettate: ettari (1,2345), metri quadri
 * (12345), formato «ha.aa.ca» (1.23.45) oppure tre colonne separate Ha / Are / Ca.
 */
import { analizzaFile, cuaaDa, numero, testo, type Analisi, type CampoSpec, type Foglio } from "./excel";
import { normalizza } from "./analisi/classificatore";
import type { Coltura } from "./types";

export type KBrogliaccio = "coltura" | "destinazione" | "uso" | "varieta" | "codice" | "superficie" | "sup_condotta" | "sup_catastale" | "ha" | "are" | "ca" | "foglio" | "particella" | "comune";

const testuale = (p: { n: number; nomi: number; codici: number; numeri: number; distinti: number }) => (p.n ? Math.max(0, 1 - p.numeri / p.n) * (p.distinti > 1 ? 0.5 : 0.2) : 0);
const numerica = (p: { n: number; numeri: number; decimali: number }) => (p.n ? (p.numeri / p.n) * 0.35 : 0);

export const CAMPI_BROGLIACCIO: CampoSpec<KBrogliaccio>[] = [
  { k: "coltura", etichetta: "Coltura / uso del suolo", sinonimi: ["occupazione suolo", "occupazione del suolo", "uso del suolo", "uso suolo", "coltura", "colture", "prodotto", "descrizione prodotto", "descrizione coltura", "coltura dichiarata", "macrouso", "macro uso", "intervento", "descrizione intervento", "utilizzo", "qualita coltura", "investimento", "gruppo coltura", "descrizione uso"], vieta: /codice|cod |data|superficie|sup /, contenuto: testuale },
  { k: "destinazione", etichetta: "Destinazione", sinonimi: ["destinazione", "destinazione uso", "destinazione d uso"], vieta: /codice|cod / },
  { k: "uso", etichetta: "Uso", sinonimi: ["uso", "dettaglio uso", "tipo uso"], vieta: /suolo|codice|cod / },
  { k: "varieta", etichetta: "Varietà", sinonimi: ["varieta", "cultivar", "qualita", "vitigno"], vieta: /codice|cod / },
  { k: "codice", etichetta: "Codice prodotto", sinonimi: ["codice prodotto", "cod prodotto", "codice coltura", "cod coltura", "codice uso", "codice occupazione"] },
  { k: "superficie", etichetta: "Superficie utilizzata", sinonimi: ["superficie utilizzata", "sup utilizzata", "superficie dichiarata", "sup dichiarata", "superficie coltivata", "sup coltivata", "superficie uso", "sup uso", "superficie occupazione", "superficie ha", "sup ha", "superficie", "sup", "ettari", "ha", "superficie eleggibile", "sup eleggibile", "superficie grafica utilizzata", "mq", "metri quadri"], vieta: /catastal|condott|totale particella/, contenuto: numerica },
  { k: "sup_condotta", etichetta: "Superficie condotta", sinonimi: ["superficie condotta", "sup condotta", "sup conduzione", "superficie in conduzione"] },
  { k: "sup_catastale", etichetta: "Superficie catastale", sinonimi: ["superficie catastale", "sup catastale", "sup cat", "superficie particella"] },
  { k: "ha", etichetta: "Ettari", sinonimi: ["ha", "ettari", "et"], vieta: /sup|superf|catast|condott|utilizz|dichiar/ },
  { k: "are", etichetta: "Are", sinonimi: ["are", "a"], vieta: /sup|superf|catast|condott|area/ },
  { k: "ca", etichetta: "Centiare", sinonimi: ["ca", "centiare"], vieta: /sup|superf|catast|condott/ },
  { k: "foglio", etichetta: "Foglio", sinonimi: ["foglio", "fg", "fgl"] },
  { k: "particella", etichetta: "Particella", sinonimi: ["particella", "part", "mappale", "numero particella", "p lla", "plla"] },
  { k: "comune", etichetta: "Comune", sinonimi: ["comune", "comune catastale", "descrizione comune"] },
];

export type Unita = "ha" | "mq" | "haaaca";

/** «1.23.45» → 1,2345 ha; «01 23 45» idem. */
function daHaAaCa(s: string): number | null {
  const m = s.trim().match(/^(\d{1,4})[.\s:](\d{1,2})[.\s:](\d{1,2})$/);
  return m ? Number(m[1]) + Number(m[2]) / 100 + Number(m[3]) / 10000 : null;
}

/** Unità di misura della colonna superficie: dall'intestazione, poi dai valori. */
export function unitaColonna(intestazione: string, valori: unknown[]): Unita {
  const h = normalizza(intestazione);
  const piene = valori.filter((v) => v != null && String(v).trim() !== "");
  if (piene.length && piene.filter((v) => typeof v === "string" && daHaAaCa(v) != null).length / piene.length > 0.5) return "haaaca";
  if (/\b(mq|m2|metri|mt)\b/.test(h)) return "mq";
  if (/\b(ha|ettari)\b/.test(h)) return "ha";
  const nums = piene.map(numero).filter((x): x is number => x != null);
  if (!nums.length) return "ha";
  const interi = nums.filter((x) => Number.isInteger(x)).length / nums.length;
  const mediana = nums.slice().sort((a, b) => a - b)[Math.floor(nums.length / 2)];
  return interi > 0.9 && mediana >= 100 ? "mq" : "ha";
}

export function superficieHa(v: unknown, unita: Unita): number | null {
  if (v == null || String(v).trim() === "") return null;
  if (unita === "haaaca" && typeof v === "string") { const x = daHaAaCa(v); if (x != null) return x; }
  const n = numero(v);
  if (n == null) return null;
  return unita === "mq" ? n / 10000 : n;
}

// ---------------------------------------------------------------------
// Abbinamento al catalogo delle colture
// ---------------------------------------------------------------------
/** Parole che indicano superfici non coltivate: proposte come «da non contare». */
export const NON_COLTIVATO = /\b(tar[ae]|fabbricat\w*|strad\w*|acque|corsi d acqua|non agricol\w*|cortil\w*|aia|improdutt\w*|incolt\w*|area non|superficie non|sine|senza uso|manufatt\w*|serbato\w*|capezzagn\w*|fossi?|scarpat\w*|siepi?|bosc\w*|boschi\w*)\b/;

/** Sinonimi verso i nomi del catalogo (normalizzati). */
const SINONIMI: [RegExp, string][] = [
  [/\b(oliv\w*|uliv\w*|oliveto)\b/, "olivo"],
  [/\buva da tavola\b|\bvite\b.*\btavola\b|\btavola\b.*\bvite\b/, "vite da tavola"],
  [/\b(vite|vigneto|vigna|uva|vitigno)\b/, "vite da vino"],
  [/\b(frumento|grano) duro\b/, "grano duro"],
  [/\b(frumento|grano) tenero\b|\bfrumento\b/, "grano tenero"],
  [/\borzo\b/, "orzo"],
  [/\bavena\b/, "avena"],
  [/\b(mais|granturco|granoturco)\b/, "mais"],
  [/\bgirasole\b/, "girasole"],
  [/\b(erba medica|medica|medicaio|erbaio)\b/, "erba medica"],
  [/\b(prat\w*|pascol\w*|foraggi\w*)\b/, "prato pascolo"],
  [/\bpomodor\w*\b/, "pomodoro da industria"],
  [/\bserr\w*\b/, "ortive in serra"],
  [/\b(ortiv\w*|ortic\w*|ortagg\w*|carciof\w*|cavol\w*|finocch\w*|patat\w*|melanzan\w*|peperon\w*|zucchin\w*|cipoll\w*|aglio)\b/, "ortive in pieno campo"],
  [/\b(pesc[ho]\w*|nettarin\w*|percoc\w*)\b/, "pesco"],
  [/\bmandorl\w*\b/, "mandorlo"],
  [/\bnoc[ei]\b|\bnoceto\b/, "noce"],
  [/\b(leguminos\w*|fav[ae]|favino|favetta|pisell\w*|cec[ei]|lenticch\w*|fagiol\w*|lupin\w*|veccia)\b/, "leguminose da granella"],
  [/\bvivai\w*\b/, "vivaio"],
];

const CATEGORIA_DA: [RegExp, string][] = [
  [/\b(oliv|vite|vign|uva|pesc|mandorl|noc|ciliegi|albicocc|melo|pero|agrum|frutt|actinid|kiwi|nocciol|susin|fico|castagn)/, "Arboree"],
  [/\b(grano|frumento|orzo|avena|mais|girasole|sorgo|colza|soia|seminativ|cereal|farro|segale|triticale)/, "Seminativi"],
  [/\b(ortiv|ortic|pomodor|patat|carciof|cavol|finocch|melanzan|peperon|zucch|cipoll|aglio|insalat|lattug)/, "Orticole"],
  [/\b(prat|pascol|erba|medica|erbaio|foragg|trifogl|sulla)/, "Foraggere"],
  [/\b(vivai|fior|piante ornament)/, "Vivai e fiori"],
];

export function categoriaPer(nome: string) {
  const n = normalizza(nome);
  return CATEGORIA_DA.find(([re]) => re.test(n))?.[1] ?? "Altro";
}

const chiave = (s: string) => normalizza(s).replace(/['’.]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Coltura del catalogo più adatta a una descrizione del brogliaccio (o null). */
export function abbinaColtura(descrizione: string, catalogo: Pick<Coltura, "id" | "nome">[]): string | null {
  const d = chiave(descrizione);
  if (!d) return null;
  const perNome = new Map(catalogo.map((c) => [chiave(c.nome), c.id]));
  if (perNome.has(d)) return perNome.get(d)!;
  for (const [re, nome] of SINONIMI) if (re.test(d) && perNome.has(nome)) return perNome.get(nome)!;
  // parole in comune con i nomi del catalogo
  const parole = new Set(d.split(" ").filter((w) => w.length > 3));
  let best: { id: string; s: number } | null = null;
  for (const c of catalogo) {
    const w = chiave(c.nome).split(" ").filter((x) => x.length > 3);
    if (!w.length) continue;
    const comuni = w.filter((x) => parole.has(x) || [...parole].some((p) => p.startsWith(x.slice(0, 5)) || x.startsWith(p.slice(0, 5)))).length;
    const s = comuni / w.length;
    if (s >= 0.6 && (!best || s > best.s)) best = { id: c.id, s };
  }
  return best?.id ?? null;
}

// ---------------------------------------------------------------------
// Lettura
// ---------------------------------------------------------------------
export interface GruppoColtura {
  chiave: string;
  descrizione: string;          // come scritta nel brogliaccio (la più frequente)
  superficie: number;           // ettari
  particelle: number;
  varieta: string[];
  colturaId: string | null;     // proposta dal catalogo
  nonColtivato: boolean;
}
export interface LetturaBrogliaccio {
  analisi: Analisi<KBrogliaccio>;
  colonnaSuperficie: { col: number; intestazione: string; unita: Unita } | null;
  gruppi: GruppoColtura[];
  totale: number;               // ettari coltivati (senza le superfici non coltivate)
  totaleTutto: number;
  righe: number;
  scartate: number;             // righe senza coltura o senza superficie
  cuaa: string[];               // CUAA trovati nel file (intestazione o colonne)
  avvisi: string[];
}

/** Descrizione della coltura di una riga: coltura (+ destinazione / uso se aggiungono informazione). */
function descrizioneRiga(a: Analisi<KBrogliaccio>, r: unknown[]) {
  const get = (k: KBrogliaccio) => { const m = a.mappa[k]; return m ? testo(r[m.col]) : null; };
  const base = get("coltura");
  const extra = [get("destinazione"), get("uso")].filter((x): x is string => !!x && !/^(-|nd|n\/d|0)$/i.test(x.trim()));
  if (!base) return extra.join(" - ") || null;
  const nb = normalizza(base);
  const agg = extra.filter((x) => !nb.includes(normalizza(x)));
  return [base, ...agg].join(" - ");
}

export function leggiBrogliaccio(fogli: Foglio[], catalogo: Pick<Coltura, "id" | "nome">[], unitaForzata?: Unita): LetturaBrogliaccio {
  const [analisi] = analizzaFile(fogli, CAMPI_BROGLIACCIO, /brogliacc|piano|coltur|consistenz|uso/i);
  const avvisi: string[] = [];
  // CUAA scritti nel file (prime righe di ogni foglio e colonne)
  const cuaa = new Set<string>();
  for (const f of fogli) for (const r of f.righe.slice(0, 15)) for (const c of r ?? []) { const x = cuaaDa(typeof c === "string" ? c.replace(/^.*?:\s*/, "") : c); if (x) cuaa.add(x.cuaa); }

  const a = analisi;
  // superficie: utilizzata > condotta > catastale > ha/are/ca separati
  const scelta = (["superficie", "sup_condotta", "sup_catastale"] as KBrogliaccio[]).map((k) => a?.mappa[k]).find(Boolean);
  let colonnaSuperficie: LetturaBrogliaccio["colonnaSuperficie"] = null;
  if (a && scelta) {
    colonnaSuperficie = { col: scelta.col, intestazione: a.intestazioni[scelta.col], unita: unitaForzata ?? unitaColonna(a.intestazioni[scelta.col], a.righe.map((r) => r[scelta.col])) };
    if (!a.mappa.superficie) avvisi.push(`Nessuna colonna di superficie utilizzata: uso «${colonnaSuperficie.intestazione}».`);
  }
  const haAreCa = a && !scelta && a.mappa.ha ? { ha: a.mappa.ha.col, are: a.mappa.are?.col, ca: a.mappa.ca?.col } : null;
  if (!a || !a.mappa.coltura && !a.mappa.destinazione) avvisi.push("Non ho trovato la colonna della coltura (uso del suolo / occupazione / prodotto).");
  if (!colonnaSuperficie && !haAreCa) avvisi.push("Non ho trovato la colonna della superficie.");

  const gruppi = new Map<string, GruppoColtura & { conteggi: Map<string, number> }>();
  let scartate = 0;
  for (const r of a?.righe ?? []) {
    const desc = descrizioneRiga(a!, r);
    let sup: number | null = null;
    if (colonnaSuperficie) sup = superficieHa(r[colonnaSuperficie.col], colonnaSuperficie.unita);
    else if (haAreCa) sup = (numero(r[haAreCa.ha]) ?? 0) + (haAreCa.are != null ? (numero(r[haAreCa.are]) ?? 0) / 100 : 0) + (haAreCa.ca != null ? (numero(r[haAreCa.ca]) ?? 0) / 10000 : 0);
    if (!desc || sup == null || sup <= 0 || /^(totale|totali|tot\.?|subtotale)\b/i.test(desc)) { scartate++; continue; }
    const k = chiave(desc);
    const g = gruppi.get(k) ?? { chiave: k, descrizione: desc, superficie: 0, particelle: 0, varieta: [] as string[], colturaId: null, nonColtivato: NON_COLTIVATO.test(k), conteggi: new Map<string, number>() };
    g.superficie += sup;
    g.particelle++;
    g.conteggi.set(desc, (g.conteggi.get(desc) ?? 0) + 1);
    const v = a!.mappa.varieta ? testo(r[a!.mappa.varieta.col]) : null;
    if (v && !g.varieta.includes(v) && g.varieta.length < 6) g.varieta.push(v);
    gruppi.set(k, g);
  }
  const lista: GruppoColtura[] = [...gruppi.values()].map(({ conteggi, ...g }) => ({
    ...g,
    descrizione: [...conteggi.entries()].sort((x, y) => y[1] - x[1])[0][0],
    superficie: Math.round(g.superficie * 10000) / 10000,
    colturaId: g.nonColtivato ? null : abbinaColtura(g.descrizione, catalogo),
  })).sort((x, y) => y.superficie - x.superficie);
  const totaleTutto = lista.reduce((s, g) => s + g.superficie, 0);
  const totale = lista.filter((g) => !g.nonColtivato).reduce((s, g) => s + g.superficie, 0);
  return { analisi: a, colonnaSuperficie, gruppi: lista, totale: Math.round(totale * 10000) / 10000, totaleTutto: Math.round(totaleTutto * 10000) / 10000, righe: a?.righe.length ?? 0, scartate, cuaa: [...cuaa], avvisi };
}
