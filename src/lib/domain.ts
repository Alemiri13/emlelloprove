import type { Abbinamento, Azienda, Documento, Domanda, Esito, Pratica, StatoDomanda, StatoPagamento } from "./types";
import { eta } from "./cf";
import { daysFromToday, parseISO } from "./format";

export const STATI: Record<StatoDomanda, { label: string; breve: string; color: string; bg: string; text: string; ring: string; desc: string }> = {
  N: { label: "Non fatta", breve: "Da fare", color: "#DC2626", bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200", desc: "Nessuna domanda avviata" },
  C: { label: "In compilazione", breve: "In corso", color: "#EA8C0C", bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", desc: "Iniziata, da completare" },
  S: { label: "Stampata", breve: "Stampata", color: "#2563EB", bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200", desc: "Pronta, da firmare e rilasciare" },
  R: { label: "Rilasciata", breve: "Fatta", color: "#16A34A", bg: "bg-green-50", text: "text-green-700", ring: "ring-green-200", desc: "Presentata all'ente" },
};
export const ORDINE_STATI: StatoDomanda[] = ["N", "C", "S", "R"];

export const ESITI: Record<Esito, { label: string; color: string; bg: string; text: string; desc: string }> = {
  I: { label: "In istruttoria", color: "#64748B", bg: "bg-slate-100", text: "text-slate-700", desc: "In attesa di esito" },
  A: { label: "Ammessa", color: "#16A34A", bg: "bg-green-50", text: "text-green-700", desc: "Accolta per intero" },
  P: { label: "Ammessa in parte", color: "#65A30D", bg: "bg-lime-50", text: "text-lime-700", desc: "Accolta con riduzioni" },
  X: { label: "Non ammessa", color: "#DC2626", bg: "bg-red-50", text: "text-red-700", desc: "Respinta, indica i motivi" },
};

export const PAGAMENTI: Record<StatoPagamento, { label: string; bg: string; text: string }> = {
  pagata: { label: "Pagata", bg: "bg-green-50", text: "text-green-700" },
  parziale: { label: "Pagata in parte", bg: "bg-lime-50", text: "text-lime-700" },
  non_pagata: { label: "Non pagata", bg: "bg-amber-50", text: "text-amber-700" },
  non_dovuto: { label: "Non dovuto", bg: "bg-slate-100", text: "text-slate-600" },
  attesa: { label: "In attesa di esito", bg: "bg-slate-100", text: "text-slate-600" },
};

/** Stato pagamento calcolato dagli importi (sovrascrivibile a mano). */
export function statoPagamento(d: Domanda | null | undefined, p: Pratica | undefined): StatoPagamento | null {
  if (!d || !p || !p.ha_contributo || d.stato !== "R") return null;
  if (d.stato_pagamento_manuale) return d.stato_pagamento_manuale;
  if (d.esito === "X") return "non_dovuto";
  const pagato = Number(d.importo_pagato) || 0;
  const rif = d.importo_ammesso ?? d.importo_richiesto;
  if (pagato > 0 && rif != null && pagato >= Number(rif)) return "pagata";
  if (pagato > 0) return "parziale";
  if (d.esito === "A" || d.esito === "P") return "non_pagata";
  return "attesa";
}

/** Data di riferimento per l'età: oggi, o la scadenza se già passata. */
function dataRiferimento(p: Pratica) {
  const s = parseISO(p.scadenza);
  const oggi = new Date();
  return s && s < oggi ? s : oggi;
}

export function soddisfaCriteri(a: Azienda, p: Pratica): boolean {
  const c = p.criteri || {};
  if (c.tipo && c.tipo !== "tutti" && a.tipo !== c.tipo) return false;
  if (c.etaMin != null || c.etaMax != null) {
    if (a.tipo !== "PF") return false;
    const e = eta(a.data_nascita, dataRiferimento(p));
    if (e == null) return false;
    if (c.etaMin != null && e < c.etaMin) return false;
    if (c.etaMax != null && e > c.etaMax) return false;
  }
  if (c.biologico && !a.biologico) return false;
  if (c.iap && !a.iap) return false;
  if (c.uma && !a.uma) return false;
  if (c.sauMin != null && (a.sau_ha ?? 0) < c.sauMin) return false;
  if (c.colture && c.colture.length) {
    const ids = new Set((a.azienda_colture ?? []).map((x) => x.coltura_id));
    if (!c.colture.some((id) => ids.has(id))) return false;
  }
  return true;
}

export type MotivoAbbinamento = "criteri" | "incluso" | "domanda";

/** Aziende abbinate a una pratica: criteri + inclusi − esclusi, più chi ha già una domanda. */
export function abbinate(aziende: Azienda[], p: Pratica, abb: Abbinamento[], domande: Domanda[]) {
  const inclusi = new Set(abb.filter((x) => x.pratica_id === p.id && x.tipo === "incluso").map((x) => x.azienda_id));
  const esclusi = new Set(abb.filter((x) => x.pratica_id === p.id && x.tipo === "escluso").map((x) => x.azienda_id));
  const conDomanda = new Set(domande.filter((d) => d.pratica_id === p.id && d.stato !== "N").map((d) => d.azienda_id));
  const out = new Map<string, MotivoAbbinamento>();
  for (const a of aziende) {
    if (conDomanda.has(a.id)) out.set(a.id, "domanda");
    else if (inclusi.has(a.id)) out.set(a.id, "incluso");
    else if (!esclusi.has(a.id) && soddisfaCriteri(a, p)) out.set(a.id, "criteri");
  }
  return out;
}

export function descriviCriteri(p: Pratica, nomiColture: Record<string, string> = {}) {
  const c = p.criteri || {};
  const out: string[] = [];
  if (c.tipo === "PF") out.push("Persone fisiche");
  if (c.tipo === "PG") out.push("Società ed enti");
  if (c.etaMin != null && c.etaMax != null) out.push(`Età ${c.etaMin}–${c.etaMax} anni`);
  else if (c.etaMin != null) out.push(`Almeno ${c.etaMin} anni`);
  else if (c.etaMax != null) out.push(`Fino a ${c.etaMax} anni`);
  if (c.biologico) out.push("Biologiche");
  if (c.iap) out.push("IAP / CD");
  if (c.uma) out.push("Utenti UMA");
  if (c.sauMin != null) out.push(`SAU ≥ ${c.sauMin} ha`);
  if (c.colture?.length) out.push("Colture: " + c.colture.map((id) => nomiColture[id] ?? "?").join(", "));
  return out.length ? out : ["Tutte le aziende"];
}

// ---------------- Documenti ----------------
export const CATEGORIE_DOC = [
  { k: "titoli", l: "Titoli di conduzione", icon: "KeyRound", tipi: ["Contratto d'affitto", "Comodato verbale", "Comodato scritto", "Comproprietà (assenso comproprietari)", "Atto di proprietà", "Usufrutto", "Enfiteusi / livello", "Successione (dichiarazione)", "Concessione demaniale / ente pubblico", "Uso civico", "Assenso del proprietario", "Altro titolo di conduzione"] },
  { k: "catasto", l: "Catasto e terreni", icon: "Map", tipi: ["Visura catastale", "Estratto di mappa", "Certificato di destinazione urbanistica (CDU)", "Planimetria / rilievo", "Analisi del terreno"] },
  { k: "identita", l: "Identità e anagrafica", icon: "IdCard", tipi: ["Documento d'identità", "Codice fiscale / tessera sanitaria", "Visura camerale", "Attribuzione partita IVA", "Statuto / atto costitutivo", "Delega / mandato CAA", "Informativa privacy", "Coordinate bancarie (IBAN)"] },
  { k: "fascicolo", l: "Fascicolo aziendale", icon: "FolderOpen", tipi: ["Scheda di validazione fascicolo", "Piano di coltivazione", "Schedario viticolo", "Registro di stalla / BDN", "Certificato IAP / CD", "Iscrizione INPS agricola"] },
  { k: "domande", l: "Domande e pratiche", icon: "FileCheck2", tipi: ["Domanda Unica", "Libretto UMA", "Domanda di bando", "Ricevuta di rilascio", "Comunicazione di esito", "Preavviso di rigetto (10-bis)", "Ricorso / riesame", "Polizza assicurativa agevolata"] },
  { k: "contratti", l: "Contratti", icon: "Handshake", tipi: ["Contratto di servizio CIA", "Contratto di filiera / conferimento", "Contratto di fornitura", "Contratto di lavoro stagionale", "Altro contratto"] },
  { k: "fatture", l: "Fatture e spese", icon: "Receipt", tipi: ["Fattura di acquisto", "Fattura di vendita", "Preventivo", "Quietanza / bonifico", "Ricevuta fiscale"] },
  { k: "pagamenti", l: "Pagamenti ricevuti", icon: "Banknote", tipi: ["Estratto pagamenti AGEA", "Decreto di liquidazione", "Contabile bancaria"] },
  { k: "cert", l: "Certificazioni", icon: "BadgeCheck", tipi: ["Certificato biologico", "DURC", "Comunicazione antimafia", "Patentino fitosanitari", "Attestato di formazione", "Autorizzazione / licenza"] },
  { k: "altro", l: "Altro", icon: "Paperclip", tipi: ["Corrispondenza", "Foto / sopralluogo", "Altro"] },
] as const;

export function statoDocumento(d: Documento): "valido" | "in_scadenza" | "scaduto" {
  const g = daysFromToday(d.scadenza);
  if (g == null) return "valido";
  if (g < 0) return "scaduto";
  if (g <= 60) return "in_scadenza";
  return "valido";
}

export const KIT = [
  { l: "Documento d'identità valido", t: (d: Documento) => d.tipo === "Documento d'identità" && statoDocumento(d) !== "scaduto" },
  { l: "Delega / mandato CAA", t: (d: Documento) => d.tipo === "Delega / mandato CAA" },
  { l: "Titolo di conduzione valido", t: (d: Documento) => d.categoria === "titoli" && statoDocumento(d) !== "scaduto" },
  { l: "Visura catastale", t: (d: Documento) => d.tipo === "Visura catastale" },
  { l: `Validazione fascicolo ${new Date().getFullYear()}`, t: (d: Documento) => d.tipo === "Scheda di validazione fascicolo" && (d.data_doc ?? "").startsWith(String(new Date().getFullYear())) },
  { l: "Informativa privacy", t: (d: Documento) => d.tipo === "Informativa privacy" },
  { l: "Visura camerale", t: (d: Documento) => d.tipo === "Visura camerale", soloPG: true },
];

// ---------------- Attività "Da fare" ----------------
export type TipoAttivita = "presentare" | "completare" | "rilasciare" | "riesame" | "pagamento" | "quota";
export interface Attivita {
  tipo: TipoAttivita; azienda: Azienda; pratica: Pratica; domanda?: Domanda; priorita: number; urgente: boolean; dettaglio: string;
}

export const TIPI_ATTIVITA: Record<TipoAttivita, { label: string; desc: string; color: string }> = {
  presentare: { label: "Da presentare", desc: "Aziende abbinate senza domanda", color: "#DC2626" },
  completare: { label: "Da completare", desc: "Domande in compilazione", color: "#EA8C0C" },
  rilasciare: { label: "Da rilasciare", desc: "Stampate, da firmare e rilasciare", color: "#2563EB" },
  riesame: { label: "Non ammesse", desc: "Senza riesame o ricorso", color: "#B91C1C" },
  pagamento: { label: "Pagamenti attesi", desc: "Ammesse non ancora pagate", color: "#65A30D" },
  quota: { label: "Quote da incassare", desc: "Servizio CIA non ancora incassato", color: "#00502A" },
};

export function calcolaAttivita(aziende: Azienda[], pratiche: Pratica[], abb: Abbinamento[], domande: Domanda[]): Attivita[] {
  const out: Attivita[] = [];
  const byKey = new Map(domande.map((d) => [d.azienda_id + "|" + d.pratica_id, d]));
  const azById = new Map(aziende.map((a) => [a.id, a]));
  for (const p of pratiche.filter((x) => x.attivo)) {
    const giorni = daysFromToday(p.scadenza);
    const scaduta = giorni != null && giorni < 0;
    for (const [azId] of abbinate(aziende, p, abb, domande)) {
      const a = azById.get(azId)!;
      const d = byKey.get(azId + "|" + p.id);
      const stato = d?.stato ?? "N";
      if (stato === "N" && !scaduta) {
        out.push({ tipo: "presentare", azienda: a, pratica: p, priorita: giorni ?? 999, urgente: giorni != null && giorni <= 15,
          dettaglio: giorni != null ? `Scade ${giorni === 0 ? "oggi" : `tra ${giorni} gg`}` : "Senza scadenza" });
      }
      if (!d) continue;
      if (stato === "C") out.push({ tipo: "completare", azienda: a, pratica: p, domanda: d, priorita: giorni ?? 500, urgente: giorni != null && giorni >= 0 && giorni <= 15, dettaglio: "In compilazione" });
      if (stato === "S") out.push({ tipo: "rilasciare", azienda: a, pratica: p, domanda: d, priorita: giorni ?? 400, urgente: giorni != null && giorni >= 0 && giorni <= 15, dettaglio: d.numero ? `N. ${d.numero}` : "Stampata" });
      if (stato === "R" && d.esito === "X" && !d.riesame) out.push({ tipo: "riesame", azienda: a, pratica: p, domanda: d, priorita: 0, urgente: true, dettaglio: d.motivi[0] ?? "Motivo non indicato" });
      const sp = statoPagamento(d, p);
      if (sp === "non_pagata" || sp === "parziale") {
        const g = d.data_esito ? -(daysFromToday(d.data_esito) ?? 0) : 0;
        out.push({ tipo: "pagamento", azienda: a, pratica: p, domanda: d, priorita: -g, urgente: g > 90, dettaglio: g > 0 ? `Esito da ${g} giorni` : "Esito recente" });
      }
      if (stato === "R" && (d.quota_importo ?? 0) > 0 && !d.quota_incassata) out.push({ tipo: "quota", azienda: a, pratica: p, domanda: d, priorita: 0, urgente: false, dettaglio: `€ ${d.quota_importo}` });
    }
  }
  return out.sort((x, y) => Number(y.urgente) - Number(x.urgente) || x.priorita - y.priorita);
}

export const CATEGORIE_COLTURE = ["Arboree", "Seminativi", "Orticole", "Foraggere", "Vivai e fiori", "Altro"] as const;
export const COLORI_COLTURE = ["#7A9A3A", "#8E3B5B", "#D9A93B", "#4E9A5B", "#D9483B", "#E07A3F", "#EE8F6B", "#8A6A4A", "#3E8E7E", "#5B7DB1", "#9AAE4A", "#B65E86"];
