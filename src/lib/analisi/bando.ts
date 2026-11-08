/**
 * Lettura dei requisiti da un bando (testo del PDF) e confronto con le aziende.
 */
import { dataDopo, normalizza, numeroIt, trovaDate } from "./classificatore";
import { eta } from "../cf";
import { parseISO } from "../format";
import type { Azienda, Coltura, Criteri, Pratica } from "../types";

export interface BandoLetto {
  nome: string | null; codice: string | null; ente: string | null; apertura: string | null; scadenza: string | null;
  criteri: Criteri; evidenze: Partial<Record<"nome" | "codice" | "ente" | "apertura" | "scadenza" | "eta" | "tipo" | "biologico" | "iap" | "sau" | "colture", string>>;
}

const SETTORI: [RegExp, RegExp][] = [
  [/vitivinicol|vinicol|\bvino\b/, /^vite da vino/],
  [/vigne|viticol|\bvite\b|\buve\b/, /^vite/],
  [/olivicol|oliveti|\bolivo\b|\bolive\b|oleicol/, /^olivo/],
  [/cereal|frumento|grano/, /^grano|^orzo|^avena|^mais/],
  [/ortic|ortofrutt|ortaggi/, /^ortive|^pomodoro/],
  [/frutticol|frutteti|frutta/, /^pesco|^mandorlo|^noce/],
  [/foragg|zootecn|pascol/, /^erba medica|^prato/],
  [/vivai|florovivai/, /^vivaio/],
];

function frase(t: string, i: number, raggio = 90) {
  const a = Math.max(0, i - raggio), b = Math.min(t.length, i + raggio);
  return (a > 0 ? "…" : "") + t.slice(a, b).replace(/\s+/g, " ").trim() + (b < t.length ? "…" : "");
}

export function leggiBando(testo: string, colture: Coltura[]): BandoLetto {
  const t = normalizza(testo).replace(/\s+/g, " ");
  const ev: BandoLetto["evidenze"] = {};
  const criteri: Criteri = { tipo: "tutti" };

  // nome: prima riga "significativa" con parole tipiche
  const righe = testo.split(/\n+/).map((r) => r.replace(/\s+/g, " ").trim()).filter((r) => r.length > 8);
  const titolo = righe.slice(0, 40).find((r) => /bando|avviso pubblico|intervento|misura|sottomisura|disposizioni attuative/i.test(r) && r.length < 220)
    ?? righe.find((r) => r.length > 15 && r.length < 160) ?? null;
  const nome = titolo ? titolo.replace(/^(bando|avviso)\s*(pubblico)?\s*[:\-–]?\s*/i, (m) => m).slice(0, 140) : null;
  if (titolo) ev.nome = titolo;

  const cod = testo.match(/\b(SR[A-H]\s?\d{2}|M\s?\d{1,2}\.\d(?:\.\d)?|(?:sotto)?misura\s+\d{1,2}\.\d(?:\.\d)?)\b/i);
  const codice = cod ? cod[1].replace(/\s/g, "").replace(/^(sotto)?misura/i, "M").toUpperCase() : null;
  if (cod) ev.codice = frase(testo, cod.index!);

  const ent = t.match(/regione abruzzo|regione molise|\bagea\b|\bgal [a-z' ]{3,30}|ministero dell[a-z' ]{5,60}|camera di commercio[a-z' ]{0,30}|\bismea\b|\binail\b/);
  const ente = ent ? ent[0].replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bAgea\b/, "AGEA").replace(/\bIsmea\b/, "ISMEA").replace(/\bInail\b/, "INAIL").trim() : null;
  if (ent) ev.ente = frase(t, ent.index!);

  const date = trovaDate(t);
  const scadenza = dataDopo(t, date, /scadenza|entro (e non oltre )?(le ore [\d.:]+ del )?(il )?|termine (ultimo |finale )?(per la presentazione )?|chiusura (dei termini|dello sportello)?|fino al|non oltre il/g, 80);
  const apertura = dataDopo(t, date, /apertura|a (partire|decorrere) dal|dalle ore [\d.:]+ del|presentabili dal|dal giorno/g, 60);
  if (scadenza) { const i = t.search(/scadenza|entro|termine|chiusura|fino al/); if (i >= 0) ev.scadenza = frase(t, i); }
  if (apertura) { const i = t.search(/apertura|a (partire|decorrere) dal|presentabili dal/); if (i >= 0) ev.apertura = frase(t, i); }

  // età
  let m = t.match(/eta (anagrafica )?(compresa )?tra (i )?(\d{2}) e (i )?(\d{2}) anni/);
  if (m) { criteri.etaMin = Number(m[4]); criteri.etaMax = Number(m[6]); ev.eta = frase(t, m.index!); }
  m = t.match(/non (abbiano |aver |avere )?(ancora )?compiuto (il )?(\d{2})/) ?? t.match(/(\d{2}) anni non compiuti/) ?? t.match(/eta inferiore a (\d{2})/);
  if (m) { const n = Number(m[4] ?? m[1]); criteri.etaMax = n - 1; ev.eta = frase(t, m.index!); }
  m = t.match(/eta (non )?(superiore|pari o superiore|almeno|minima( di)?) a? ?(\d{2})|maggiore eta|maggiorenn/);
  if (m) { criteri.etaMin = m[4] ? Number(m[4]) : 18; ev.eta = ev.eta ?? frase(t, m.index!); }
  if (criteri.etaMax == null && /giovan[ei] agricolt|primo insediamento/.test(t)) {
    criteri.etaMin = criteri.etaMin ?? 18; criteri.etaMax = 40;
    ev.eta = frase(t, t.search(/giovan[ei] agricolt|primo insediamento/));
  }

  // tipo di soggetto
  const pf = /persone? fisic|imprenditori? (agricol[oi] )?individual|ditte? individual/.test(t);
  const pg = /\bsocieta\b|persone giuridiche|cooperativ|consorzi/.test(t);
  if (pf && !pg) { criteri.tipo = "PF"; ev.tipo = frase(t, t.search(/persone? fisic|individual/)); }
  else if (pg && !pf) { criteri.tipo = "PG"; ev.tipo = frase(t, t.search(/societa|persone giuridiche|cooperativ/)); }
  if (criteri.etaMax != null && criteri.tipo === "tutti") criteri.tipo = "PF";

  // biologico / IAP
  const bio = t.search(/agricoltura biologica|metodo (di produzione )?biologico|produzione biologica|reg(olamento)?\.? \(?ue\)? (n\.? )?2018\/848/);
  if (bio >= 0) { criteri.biologico = true; ev.biologico = frase(t, bio); }
  const iap = t.search(/(qualifica|possesso|requisito)[^.]{0,60}(imprenditore agricolo professionale|\biap\b|coltivatore diretto)/);
  if (iap >= 0) { criteri.iap = true; ev.iap = frase(t, iap); }

  // SAU minima
  m = t.match(/(superficie|sau)[^.]{0,90}?(minima|almeno|non inferiore a|pari o superiore a|di almeno)[^.]{0,25}?(\d{1,4}(?:[.,]\d{1,2})?)\s*(ha|ettari)/)
    ?? t.match(/(almeno|minimo|non inferiore a) (\d{1,4}(?:[.,]\d{1,2})?)\s*(ha|ettari)/);
  if (m) {
    const v = numeroIt(m[3] ?? m[2]) ?? Number((m[3] ?? m[2]).replace(",", "."));
    if (v && v < 1000) { criteri.sauMin = v; ev.sau = frase(t, m.index!); }
  }

  // colture / settori (solo se il bando parla di comparti o colture ammissibili)
  const ctx = t.match(/(colture|coltivazioni|comparto|comparti|settore|settori|filiera|filiere|produzioni)[^.]{0,120}/g)?.join(" ") ?? "";
  const ids = new Set<string>();
  for (const [re, nomeRe] of SETTORI) if (re.test(ctx)) colture.filter((c) => nomeRe.test(normalizza(c.nome))).forEach((c) => ids.add(c.id));
  if (ids.size) { criteri.colture = [...ids]; const i = t.search(/(colture|comparto|settore|filiera)/); ev.colture = frase(t, i); }

  return { nome, codice, ente, apertura, scadenza, criteri, evidenze: ev };
}

// ---------------------------------------------------------------------
// Confronto
// ---------------------------------------------------------------------
export type EsitoVoce = "ok" | "ko" | "manca";
export interface Voce { chiave: string; label: string; esito: EsitoVoce; dettaglio: string }
export type Giudizio = "idonea" | "verificare" | "quasi" | "no";
export interface Valutazione { giudizio: Giudizio; voci: Voce[]; ko: number; mancanti: number }

export function valuta(a: Azienda, p: Pick<Pratica, "criteri" | "scadenza">, nomiColture: Record<string, string>): Valutazione {
  const c = p.criteri || {};
  const voci: Voce[] = [];
  if (c.tipo && c.tipo !== "tutti") voci.push({ chiave: "tipo", label: c.tipo === "PF" ? "Persona fisica" : "Società / ente", esito: a.tipo === c.tipo ? "ok" : "ko", dettaglio: a.tipo === "PF" ? "persona fisica" : "società" });
  if (c.etaMin != null || c.etaMax != null) {
    const s = parseISO(p.scadenza);
    const rif = s && s < new Date() ? s : new Date();
    const e = a.tipo === "PF" ? eta(a.data_nascita, rif) : null;
    const lab = c.etaMin != null && c.etaMax != null ? `Età ${c.etaMin}–${c.etaMax}` : c.etaMin != null ? `Età ≥ ${c.etaMin}` : `Età ≤ ${c.etaMax}`;
    voci.push({ chiave: "eta", label: lab, esito: e == null ? (a.tipo === "PG" ? "ko" : "manca") : (c.etaMin == null || e >= c.etaMin) && (c.etaMax == null || e <= c.etaMax) ? "ok" : "ko", dettaglio: e == null ? (a.tipo === "PG" ? "società" : "data di nascita mancante") : `${e} anni` });
  }
  if (c.biologico) voci.push({ chiave: "bio", label: "Biologica", esito: a.biologico ? "ok" : "ko", dettaglio: a.biologico ? "sì" : "non biologica" });
  if (c.iap) voci.push({ chiave: "iap", label: "IAP / CD", esito: a.iap ? "ok" : "ko", dettaglio: a.iap ? "sì" : "no" });
  if (c.uma) voci.push({ chiave: "uma", label: "Utente UMA", esito: a.uma ? "ok" : "ko", dettaglio: a.uma ? "sì" : "no" });
  if (c.sauMin != null) voci.push({ chiave: "sau", label: `SAU ≥ ${c.sauMin} ha`, esito: a.sau_ha == null ? "manca" : a.sau_ha >= c.sauMin ? "ok" : "ko", dettaglio: a.sau_ha == null ? "SAU non indicata" : `${a.sau_ha.toLocaleString("it-IT")} ha` });
  if (c.colture?.length) {
    const has = (a.azienda_colture ?? []).map((x) => x.coltura_id);
    const ok = c.colture.some((id) => has.includes(id));
    voci.push({ chiave: "colture", label: "Colture: " + c.colture.map((id) => nomiColture[id] ?? "?").join(", "), esito: !has.length ? "manca" : ok ? "ok" : "ko", dettaglio: !has.length ? "colture non indicate" : ok ? c.colture.filter((id) => has.includes(id)).map((id) => nomiColture[id]).join(", ") : "nessuna coltura richiesta" });
  }
  const ko = voci.filter((v) => v.esito === "ko").length;
  const mancanti = voci.filter((v) => v.esito === "manca").length;
  // "quasi": un solo requisito non rispettato, e di quelli che l'azienda può cambiare (superficie, colture, bio, IAP, UMA)
  const recuperabile = voci.find((v) => v.esito === "ko")?.chiave;
  const giudizio: Giudizio = ko === 0 && mancanti === 0 ? "idonea" : ko === 0 ? "verificare"
    : ko === 1 && mancanti === 0 && recuperabile && !["tipo", "eta"].includes(recuperabile) ? "quasi" : "no";
  return { giudizio, voci, ko, mancanti };
}
