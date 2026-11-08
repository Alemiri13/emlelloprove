import { classifica, estraiCampi, leggiFatturaPA, normalizza, type Campi, type Candidato } from "./classificatore";
import { estraiTesto, type Fase, type Metodo } from "./estrazione";
import { CATEGORIE_DOC } from "../domain";
import type { AnalisiSalvata, Azienda, Pratica } from "../types";

export type { Fase } from "./estrazione";

export interface Analisi {
  metodo: Metodo;
  testo: string;
  pagine: number;
  anteprima?: string;
  candidati: Candidato[];
  tipo: string;
  categoria: string;
  confidenza: number;
  campi: Campi;
  titolo: string;
  /** azienda riconosciuta dal documento (per CUAA o per nome) */
  aziendaTrovata: { id: string; come: "cuaa" | "nome"; valore: string } | null;
  /** CUAA presenti nel documento che non appartengono a nessuna azienda dell'ufficio */
  cuaaEstranei: string[];
  avvisi: string[];
}

const PAROLE_PRATICA: [RegExp, RegExp][] = [
  [/^du/i, /domanda unica|pagamenti diretti/],
  [/^uma/i, /\buma\b|utenti motori agricoli|gasolio agricolo/],
  [/vendemmia/i, /dichiarazione di vendemmia|vendemmia/],
  [/gasolio/i, /rimborso (del )?gasolio|accisa/],
  [/^sre01/i, /primo insediamento|giovani agricoltori/],
  [/^sra29/i, /agricoltura biologica|\bsra29\b/],
];

export function categoriaDi(tipo: string) {
  return CATEGORIE_DOC.find((c) => (c.tipi as readonly string[]).includes(tipo))?.k ?? "altro";
}

export async function analizzaFile(
  file: File,
  ctx: { aziende: Azienda[]; pratiche: Pratica[]; aziendaAttesa?: string | null },
  onFase?: (f: Fase, p?: number) => void,
): Promise<Analisi> {
  const est = await estraiTesto(file, onFase);
  onFase?.("classificazione");
  const avvisi: string[] = est.avviso ? [est.avviso] : [];

  let candidati = classifica(est.testo, file.name, { immagineSenzaTesto: est.metodo === "ocr" && est.testo.replace(/\s/g, "").length < 25 });
  const codiciPratiche = ctx.pratiche.map((p) => ({
    id: p.id, codice: p.codice,
    parole: PAROLE_PRATICA.find(([re]) => re.test(p.codice ?? p.id))?.[1] ?? null,
  }));
  const tipoProv = candidati[0]?.tipo ?? "Altro";
  const campi = estraiCampi(est.testo, tipoProv, codiciPratiche);

  // fattura elettronica: dati certi dal tracciato
  const fattura = est.metodo === "xml" ? leggiFatturaPA(est.testo) : null;
  const azByCuaa = new Map(ctx.aziende.map((a) => [a.cuaa, a]));
  if (fattura) {
    campi.numero = fattura.numero ?? campi.numero;
    campi.dataDocumento = fattura.data ?? campi.dataDocumento;
    campi.importo = fattura.totale ?? campi.importo;
    campi.cuaa = [...new Set([...fattura.cessionario.codici, ...fattura.cedente.codici, ...campi.cuaa])];
    const cedenteNostro = fattura.cedente.codici.some((c) => azByCuaa.has(c) || azByCuaa.has(c.replace(/^IT/, "")));
    const tipo = cedenteNostro ? "Fattura di vendita" : "Fattura di acquisto";
    campi.controparte = cedenteNostro ? fattura.cessionario.nome : fattura.cedente.nome;
    candidati = [{ tipo, cat: "fatture", punteggio: 30, confidenza: 0.98, indizi: ["tracciato FatturaPA", cedenteNostro ? "l'azienda è il cedente" : "l'azienda è il cessionario"] }, ...candidati.filter((c) => !c.tipo.startsWith("Fattura"))];
  }

  // azienda: prima per CUAA, poi per nome
  let aziendaTrovata: Analisi["aziendaTrovata"] = null;
  const cuaaEstranei: string[] = [];
  for (const c of campi.cuaa) {
    const a = azByCuaa.get(c);
    if (a && !aziendaTrovata) aziendaTrovata = { id: a.id, come: "cuaa", valore: c };
    else if (!a) cuaaEstranei.push(c);
  }
  if (!aziendaTrovata && est.testo) {
    const t = normalizza(est.testo);
    const trovate = ctx.aziende.filter((a) => {
      const parole = normalizza(a.denominazione).split(/\s+/).filter((w) => w.length > 2 && !/^(di|de|del|della|soc|societa|agricola|s\.s\.|ss|srl|spa)$/.test(w));
      return parole.length >= 2 && parole.slice(0, 3).every((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\']/g, ".")}\\b`).test(t));
    });
    if (trovate.length === 1) aziendaTrovata = { id: trovate[0].id, come: "nome", valore: trovate[0].denominazione };
  }

  const top = candidati[0];
  // l'importo ha senso solo per fatture, pagamenti, contratti e titoli
  if (!top || !["fatture", "pagamenti", "contratti", "titoli"].includes(top.cat)) campi.importo = null;
  const tipo = top && top.confidenza >= 0.25 ? top.tipo : "Altro";
  const categoria = top && tipo !== "Altro" ? top.cat || categoriaDi(tipo) : "altro";
  if (!top || top.confidenza < 0.25) avvisi.push("Tipo non riconosciuto con sicurezza: verifica la categoria");
  if (est.metodo === "nome") avvisi.push("Nessun testo leggibile: l'analisi si basa solo sul nome del file");
  if (ctx.aziendaAttesa && aziendaTrovata && aziendaTrovata.id !== ctx.aziendaAttesa) {
    const altra = ctx.aziende.find((a) => a.id === aziendaTrovata!.id);
    avvisi.push(`Il documento sembra riferito a un'altra azienda: ${altra?.denominazione ?? aziendaTrovata.valore}`);
  }
  if (campi.scadenza && campi.scadenza < new Date().toISOString().slice(0, 10)) avvisi.push("Il documento risulta scaduto");

  const anno = campi.anno ?? new Date().getFullYear();
  let titolo = tipo === "Altro" ? file.name.replace(/\.[^.]+$/, "") : `${tipo}${campi.numero ? ` n. ${campi.numero}` : ""} · ${anno}`;
  if (fattura) titolo = `Fattura ${fattura.numero ?? ""}${campi.controparte ? ` · ${campi.controparte}` : ""}`.trim();

  return {
    metodo: est.metodo, testo: est.testo, pagine: est.pagine, anteprima: est.anteprima,
    candidati, tipo, categoria, confidenza: top?.confidenza ?? 0, campi, titolo, aziendaTrovata, cuaaEstranei, avvisi,
  };
}

export function sintesiAnalisi(a: Analisi, tipoScelto: string): AnalisiSalvata {
  return {
    versione: 1, metodo: a.metodo, tipo: a.tipo, categoria: a.categoria, confidenza: a.confidenza,
    indizi: a.candidati[0]?.indizi.slice(0, 6) ?? [],
    alternative: a.candidati.slice(1, 4).map((c) => ({ tipo: c.tipo, confidenza: c.confidenza })),
    cuaa_trovati: a.campi.cuaa, corretto: tipoScelto !== a.tipo,
  };
}
