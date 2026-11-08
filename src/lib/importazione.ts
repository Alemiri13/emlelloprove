/**
 * Importazione massiva da Excel: aziende e domande.
 * Regole:
 *  - le celle vuote non cancellano i dati esistenti (si aggiornano solo i campi pieni);
 *  - i CUAA sconosciuti diventano nuove aziende dell'ufficio (dati anagrafici ricavati dal codice fiscale);
 *  - inserimenti e aggiornamenti a blocchi, raggruppati per insieme di colonne.
 */
import { check, supabase } from "./supabase";
import { tutte } from "./queries";
import { decodeCuaa, normalizzaCuaa } from "./cf";
import { normalizza } from "./analisi/classificatore";
import type { Esito, StatoDomanda } from "./types";

const BLOCCO = 400;

function pulisci<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== "")) as Partial<T>;
}

/** upsert raggruppato per insieme di chiavi: ogni richiesta ha oggetti con le stesse colonne. */
async function upsertRaggruppato(tabella: string, righe: Record<string, unknown>[], onConflict: string, onProgress?: (fatti: number) => void) {
  const gruppi = new Map<string, Record<string, unknown>[]>();
  for (const r of righe) {
    const k = Object.keys(r).sort().join(",");
    (gruppi.get(k) ?? gruppi.set(k, []).get(k)!).push(r);
  }
  let fatti = 0;
  for (const g of gruppi.values()) {
    for (let i = 0; i < g.length; i += BLOCCO) {
      const parte = g.slice(i, i + BLOCCO);
      check(await supabase.from(tabella).upsert(parte, { onConflict }));
      fatti += parte.length;
      onProgress?.(fatti);
    }
  }
}

export function chiaveNome(s: string) {
  return normalizza(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
}

function anagraficaDaCuaa(cuaa: string) {
  const info = decodeCuaa(cuaa);
  if (info.valido && info.tipo === "PF") return { data_nascita: info.dataNascita, sesso: info.sesso, comune: info.comune };
  return {};
}

async function aziendeUfficio(ufficio: string) {
  return tutte<{ id: string; cuaa: string; denominazione: string }>((a, b) =>
    supabase.from("aziende").select("id, cuaa, denominazione").eq("ufficio_id", ufficio).order("id").range(a, b));
}

// =====================================================================
// AZIENDE
// =====================================================================
export interface RigaAzienda {
  riga: number;
  cuaa: string; denominazione: string | null; data_nascita?: string | null; comune?: string | null; indirizzo?: string | null; cap?: string | null;
  telefono?: string | null; email?: string | null; pec?: string | null; iban?: string | null; sau_ha?: number | null;
  biologico?: boolean | null; iap?: boolean | null; uma?: boolean | null; note?: string | null; colture?: string[];
}

export interface EsitoImportAziende {
  perUfficio: Record<string, { nuove: number; aggiornate: number }>;
  coltureCreate: string[];
  scartate: { riga: number; motivo: string }[];
}

export function validaAzienda(r: RigaAzienda): string | null {
  const c = normalizzaCuaa(r.cuaa ?? "");
  if (!c) return "CUAA mancante";
  if (!/^([A-Z0-9]{16}|\d{11})$/.test(c)) return `CUAA non valido (${r.cuaa})`;
  return null;
}

export async function importaAziende(righe: RigaAzienda[], uffici: string[], onFase?: (msg: string, p: number) => void): Promise<EsitoImportAziende> {
  const esito: EsitoImportAziende = { perUfficio: {}, coltureCreate: [], scartate: [] };
  // deduplica per CUAA (l'ultima riga vince, ma le celle vuote non cancellano)
  const perCuaa = new Map<string, RigaAzienda>();
  for (const r of righe) {
    const err = validaAzienda(r);
    if (err) { esito.scartate.push({ riga: r.riga, motivo: err }); continue; }
    const c = normalizzaCuaa(r.cuaa);
    const prev = perCuaa.get(c);
    perCuaa.set(c, prev ? { ...prev, ...pulisci(r as unknown as Record<string, unknown>), colture: [...new Set([...(prev.colture ?? []), ...(r.colture ?? [])])] } as RigaAzienda : { ...r, cuaa: c });
  }

  // colture: nomi → id (crea quelle nuove)
  const nomiColture = new Set([...perCuaa.values()].flatMap((r) => r.colture ?? []).map((x) => x.trim()).filter(Boolean));
  const coltureDb = check(await supabase.from("colture").select("id, nome")) as { id: string; nome: string }[];
  const colturaId = new Map(coltureDb.map((c) => [normalizza(c.nome), c.id]));
  const nuoveColture = [...nomiColture].filter((n) => !colturaId.has(normalizza(n)));
  if (nuoveColture.length) {
    const ins = check(await supabase.from("colture").insert(nuoveColture.map((nome) => ({ nome: nome.charAt(0).toUpperCase() + nome.slice(1), categoria: "Altro" }))).select("id, nome")) as { id: string; nome: string }[];
    ins.forEach((c) => colturaId.set(normalizza(c.nome), c.id));
    esito.coltureCreate = ins.map((c) => c.nome);
  }

  let passo = 0;
  for (const u of uffici) {
    onFase?.(`Ufficio ${u}: lettura anagrafica`, passo / uffici.length);
    const esistenti = new Map((await aziendeUfficio(u)).map((a) => [a.cuaa, a.id]));
    const nuove: Record<string, unknown>[] = [];
    const aggiorna: Record<string, unknown>[] = [];
    for (const r of perCuaa.values()) {
      const campi = pulisci({
        denominazione: r.denominazione?.trim().toUpperCase(), data_nascita: r.data_nascita, comune: r.comune, indirizzo: r.indirizzo, cap: r.cap,
        telefono: r.telefono, email: r.email, pec: r.pec, iban: r.iban, sau_ha: r.sau_ha, biologico: r.biologico, iap: r.iap, uma: r.uma, note: r.note,
      });
      if (esistenti.has(r.cuaa)) {
        if (Object.keys(campi).length) aggiorna.push({ ufficio_id: u, cuaa: r.cuaa, ...campi });
      } else {
        if (!campi.denominazione) { if (passo === 0) esito.scartate.push({ riga: r.riga, motivo: `Denominazione mancante per ${r.cuaa}` }); continue; }
        nuove.push({ ufficio_id: u, cuaa: r.cuaa, biologico: false, iap: false, uma: false, ...pulisci(anagraficaDaCuaa(r.cuaa)), ...campi });
      }
    }
    onFase?.(`Ufficio ${u}: ${nuove.length} nuove, ${aggiorna.length} da aggiornare`, (passo + 0.3) / uffici.length);
    await upsertRaggruppato("aziende", nuove, "ufficio_id,cuaa");
    await upsertRaggruppato("aziende", aggiorna, "ufficio_id,cuaa");
    esito.perUfficio[u] = { nuove: nuove.length, aggiornate: aggiorna.length };

    // colture delle aziende
    const conColture = [...perCuaa.values()].filter((r) => r.colture?.length);
    if (conColture.length) {
      const ids = new Map((await aziendeUfficio(u)).map((a) => [a.cuaa, a.id]));
      const link = conColture.flatMap((r) => (r.colture ?? []).map((n) => colturaId.get(normalizza(n.trim()))).filter(Boolean).map((cid) => ({ azienda_id: ids.get(r.cuaa), coltura_id: cid }))).filter((x) => x.azienda_id);
      for (let i = 0; i < link.length; i += BLOCCO) check(await supabase.from("azienda_colture").upsert(link.slice(i, i + BLOCCO), { onConflict: "azienda_id,coltura_id", ignoreDuplicates: true }));
    }
    passo++;
    onFase?.(`Ufficio ${u} completato`, passo / uffici.length);
  }
  return esito;
}

// =====================================================================
// DOMANDE
// =====================================================================
export interface RigaDomanda {
  riga: number;
  cuaa: string | null; denominazione: string | null; tipo: string | null;
  stato: StatoDomanda | null; numero: string | null; data_presentazione: string | null;
  esito: Esito | null; motivi: string[] | null; data_esito: string | null;
  importo_richiesto: number | null; importo_ammesso: number | null; importo_pagato: number | null; data_pagamento: string | null;
  litri_richiesti: number | null; litri_assegnati: number | null; quota_importo: number | null; quota_incassata: boolean | null; note: string | null;
}

export interface NuovaPratica { chiave: string; nome: string; codice: string | null; unita: "euro" | "litri" }

export interface EsitoImportDomande {
  pratiche: string[];
  praticheCreate: string[];
  aziendeCreate: { cuaa: string; denominazione: string }[];
  nonTrovate: { riga: number; nome: string; motivo: string }[];
  scartate: { riga: number; motivo: string }[];
  importate: number;
  perPratica: Record<string, Record<StatoDomanda, number>>;
}

function slug(s: string) {
  return normalizza(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || `pratica-${Date.now()}`;
}

/**
 * @param risolviPratica  da tipo (testo nel file) a id pratica esistente o chiave di una nuova
 */
export async function importaDomande(params: {
  ufficio: string;
  righe: RigaDomanda[];
  praticaFissa: string | null;
  risolviPratica: (tipo: string | null) => string | null;
  nuovePratiche: NuovaPratica[];
  statoPredefinito: StatoDomanda;
  onFase?: (msg: string, p: number) => void;
}): Promise<EsitoImportDomande> {
  const { ufficio, righe, praticaFissa, risolviPratica, nuovePratiche, statoPredefinito, onFase } = params;
  const out: EsitoImportDomande = { pratiche: [], praticheCreate: [], aziendeCreate: [], nonTrovate: [], scartate: [], importate: 0, perPratica: {} };

  // 1. nuove tipologie di domanda
  const idNuove = new Map<string, string>();
  if (nuovePratiche.length) {
    onFase?.("Creo le nuove tipologie di domanda", 0.05);
    const esist = new Set((check(await supabase.from("pratiche").select("id")) as { id: string }[]).map((p) => p.id));
    const maxOrd = (check(await supabase.from("pratiche").select("ordine").order("ordine", { ascending: false }).limit(1)) as { ordine: number }[])[0]?.ordine ?? 0;
    const ins = nuovePratiche.map((n, i) => {
      let id = slug(n.codice || n.nome); let k = 2;
      while (esist.has(id)) id = `${slug(n.codice || n.nome)}-${k++}`;
      esist.add(id); idNuove.set(n.chiave, id);
      return {
        id, nome: n.nome.trim(), codice: n.codice, categoria: "annuale", unita: n.unita, ha_contributo: n.unita === "euro", campagna: String(new Date().getFullYear()),
        criteri: { tipo: "tutti" }, motivi_tipici: ["Documentazione incompleta", "Fascicolo aziendale non validato", "Presentata fuori termine"], ordine: maxOrd + 1 + i, attivo: true,
      };
    });
    check(await supabase.from("pratiche").insert(ins));
    out.praticheCreate = ins.map((p) => p.nome);
  }
  const praticaDi = (r: RigaDomanda) => {
    const k = praticaFissa ?? risolviPratica(r.tipo);
    return k ? idNuove.get(k) ?? k : null;
  };

  // 2. aziende: per CUAA, altrimenti per nome
  onFase?.("Abbino i nominativi all'anagrafica", 0.15);
  let anag = await aziendeUfficio(ufficio);
  const daCreare = new Map<string, string>();
  for (const r of righe) {
    const c = normalizzaCuaa(r.cuaa ?? "");
    if (c && /^([A-Z0-9]{16}|\d{11})$/.test(c) && !anag.some((a) => a.cuaa === c) && r.denominazione) daCreare.set(c, r.denominazione.trim().toUpperCase());
  }
  if (daCreare.size) {
    onFase?.(`Creo ${daCreare.size} nuove aziende`, 0.25);
    const nuove = [...daCreare].map(([cuaa, denominazione]) => ({ ufficio_id: ufficio, cuaa, denominazione, biologico: false, iap: false, uma: false, ...pulisci(anagraficaDaCuaa(cuaa)) }));
    await upsertRaggruppato("aziende", nuove, "ufficio_id,cuaa");
    out.aziendeCreate = [...daCreare].map(([cuaa, denominazione]) => ({ cuaa, denominazione }));
    anag = await aziendeUfficio(ufficio);
  }
  const perCuaa = new Map(anag.map((a) => [a.cuaa, a.id]));
  const perNome = new Map<string, string | null>();
  for (const a of anag) { const k = chiaveNome(a.denominazione); perNome.set(k, perNome.has(k) ? null : a.id); }

  // 3. domande
  const domande = new Map<string, Record<string, unknown>>();
  for (const r of righe) {
    const pid = praticaDi(r);
    if (!pid) { out.scartate.push({ riga: r.riga, motivo: `Tipo di domanda non riconosciuto${r.tipo ? ` («${r.tipo}»)` : ""}` }); continue; }
    const c = normalizzaCuaa(r.cuaa ?? "");
    let az = c ? perCuaa.get(c) : undefined;
    let omonimi = false;
    if (!az && r.denominazione) {
      const k = chiaveNome(r.denominazione);
      az = perNome.get(k) ?? undefined;
      omonimi = perNome.has(k) && perNome.get(k) === null;
    }
    if (!az) {
      if (c && !/^([A-Z0-9]{16}|\d{11})$/.test(c)) out.scartate.push({ riga: r.riga, motivo: `CUAA non valido (${r.cuaa})` });
      else out.nonTrovate.push({ riga: r.riga, nome: r.denominazione ?? r.cuaa ?? "?", motivo: omonimi ? "più aziende con questo nome: serve il CUAA" : "non presente in anagrafica e senza CUAA" });
      continue;
    }
    const st = r.stato ?? statoPredefinito;
    const rec = pulisci({
      azienda_id: az, pratica_id: pid, stato: st, numero: r.numero, data_presentazione: r.data_presentazione, esito: r.esito,
      motivi: r.motivi?.length ? r.motivi : null, data_esito: r.data_esito, importo_richiesto: r.importo_richiesto, importo_ammesso: r.importo_ammesso,
      importo_pagato: r.importo_pagato, data_pagamento: r.data_pagamento, litri_richiesti: r.litri_richiesti, litri_assegnati: r.litri_assegnati,
      quota_importo: r.quota_importo, quota_incassata: r.quota_incassata, note: r.note,
    });
    const key = az + "|" + pid;
    domande.set(key, { ...(domande.get(key) ?? {}), ...rec });
    (out.perPratica[pid] ??= { N: 0, C: 0, S: 0, R: 0 })[st]++;
  }
  onFase?.(`Salvo ${domande.size} domande`, 0.5);
  await upsertRaggruppato("domande", [...domande.values()], "azienda_id,pratica_id", (n) => onFase?.(`Salvate ${n} di ${domande.size}`, 0.5 + 0.5 * (n / Math.max(1, domande.size))));
  out.importate = domande.size;
  out.pratiche = Object.keys(out.perPratica);
  return out;
}
