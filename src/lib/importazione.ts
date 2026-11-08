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
// ELENCHI DELLE PRATICHE: «domande da fare» (modello) e «domande fatte»
// =====================================================================
export interface RigaElenco {
  file: string; riga: number;
  cuaa: string | null; denominazione: string | null;
  stato: StatoDomanda | null; numero: string | null; data_presentazione: string | null;
  esito: Esito | null; motivi: string[]; data_esito: string | null; litri_assegnati: number | null; note: string | null;
}

export type Esame =
  | { tipo: "azienda"; aziendaId: string; come: "cuaa" | "nome" }
  | { tipo: "nuova"; cuaa: string; denominazione: string }
  | { tipo: "scartata"; motivo: string };

export interface Contesto {
  aziende: { id: string; cuaa: string; denominazione: string }[];
  membri: Set<string>;            // aziende già nell'elenco della pratica (modello) o con domanda
  stati: Map<string, StatoDomanda>; // stato attuale per azienda
}

export interface Piano {
  tipo: "modello" | "fatte";
  righe: RigaElenco[];
  esami: Esame[];
  /** una voce per azienda (le righe ripetute nei vari file vengono fuse, prevale lo stato più avanzato) */
  voci: { chiave: string; esame: Exclude<Esame, { tipo: "scartata" }>; riga: RigaElenco; stato: StatoDomanda; prima: StatoDomanda | null; fuori: boolean }[];
  scartate: { file: string; riga: number; nome: string; motivo: string }[];
  conflitti: number;
  conteggi: { nuoveAziende: number; giaPresenti: number; fuori: number; nuove: number; aggiornate: number; invariate: number; perStato: Record<StatoDomanda, number> };
}

const ORDINE: Record<StatoDomanda, number> = { N: 0, C: 1, S: 2, R: 3 };

export function pianifica(tipo: "modello" | "fatte", righe: RigaElenco[], ctx: Contesto, statoPredefinito: StatoDomanda): Piano {
  const perCuaa = new Map(ctx.aziende.map((a) => [a.cuaa, a.id]));
  const perNome = new Map<string, string | null>();
  for (const a of ctx.aziende) { const k = chiaveNome(a.denominazione); perNome.set(k, perNome.has(k) ? null : a.id); }
  const esami: Esame[] = righe.map((r) => {
    const c = r.cuaa ? normalizzaCuaa(r.cuaa) : "";
    const valido = /^([A-Z0-9]{16}|\d{11})$/.test(c);
    if (valido && perCuaa.has(c)) return { tipo: "azienda", aziendaId: perCuaa.get(c)!, come: "cuaa" };
    if (r.denominazione) {
      const k = chiaveNome(r.denominazione);
      const id = perNome.get(k);
      if (!valido && id) return { tipo: "azienda", aziendaId: id, come: "nome" };
      if (valido) return { tipo: "nuova", cuaa: c, denominazione: r.denominazione.trim().toUpperCase() };
      if (perNome.has(k) && id === null) return { tipo: "scartata", motivo: "più aziende con questo nome: serve il CUAA" };
      return { tipo: "scartata", motivo: "non presente in anagrafica e senza CUAA" };
    }
    if (valido) return { tipo: "scartata", motivo: `CUAA ${c} non in anagrafica e senza nominativo` };
    return { tipo: "scartata", motivo: r.cuaa ? `CUAA non valido (${r.cuaa})` : "riga senza CUAA né nominativo" };
  });

  const voci = new Map<string, Piano["voci"][number]>();
  const scartate: Piano["scartate"] = [];
  let conflitti = 0;
  righe.forEach((r, i) => {
    const e = esami[i];
    if (e.tipo === "scartata") { scartate.push({ file: r.file, riga: r.riga, nome: r.denominazione ?? r.cuaa ?? "?", motivo: e.motivo }); return; }
    const chiave = e.tipo === "azienda" ? e.aziendaId : "nuova:" + e.cuaa;
    const prima = e.tipo === "azienda" ? ctx.stati.get(e.aziendaId) ?? null : null;
    // nell'elenco «da fare» senza colonna di stato non si tocca lo stato di chi l'ha già
    const st: StatoDomanda = r.stato ?? (tipo === "modello" ? prima ?? "N" : statoPredefinito);
    const fuori = tipo === "fatte" && (e.tipo === "nuova" || !ctx.membri.has(e.aziendaId));
    const esistente = voci.get(chiave);
    if (esistente) {
      if (esistente.stato !== st) conflitti++;
      if (ORDINE[st] > ORDINE[esistente.stato]) voci.set(chiave, { ...esistente, stato: st, riga: { ...esistente.riga, ...pulisciRiga(r) } });
      else voci.set(chiave, { ...esistente, riga: { ...pulisciRiga(r), ...pulisciRiga(esistente.riga) } as RigaElenco });
    } else voci.set(chiave, { chiave, esame: e, riga: r, stato: st, prima, fuori });
  });

  const lista = [...voci.values()];
  const perStato: Record<StatoDomanda, number> = { N: 0, C: 0, S: 0, R: 0 };
  lista.forEach((v) => perStato[v.stato]++);
  return {
    tipo, righe, esami, voci: lista, scartate, conflitti,
    conteggi: {
      nuoveAziende: lista.filter((v) => v.esame.tipo === "nuova").length,
      giaPresenti: lista.filter((v) => v.esame.tipo === "azienda" && ctx.membri.has(v.esame.aziendaId)).length,
      fuori: lista.filter((v) => v.fuori).length,
      nuove: lista.filter((v) => (v.prima ?? "N") === "N" && v.stato !== "N").length,
      aggiornate: lista.filter((v) => v.prima && v.prima !== "N" && v.prima !== v.stato).length,
      invariate: lista.filter((v) => (v.prima ?? "N") === v.stato).length,
      perStato,
    },
  };
}

function pulisciRiga(r: RigaElenco) {
  return Object.fromEntries(Object.entries(r).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length))) as Partial<RigaElenco>;
}

/** Scrive il piano: crea le aziende nuove, aggiorna l'elenco della pratica e gli stati, registra il caricamento. */
export async function eseguiPiano(params: {
  piano: Piano; ufficio: string; praticaId: string; aggiungiFuori: boolean; fileNames: string[];
  onFase?: (msg: string, p: number) => void;
}) {
  const { piano, ufficio, praticaId, aggiungiFuori, fileNames, onFase } = params;
  let voci = piano.voci;
  if (piano.tipo === "fatte" && !aggiungiFuori) voci = voci.filter((v) => !v.fuori);

  // 1. aziende nuove
  const nuove = voci.filter((v) => v.esame.tipo === "nuova").map((v) => v.esame as Extract<Esame, { tipo: "nuova" }>);
  const idNuove = new Map<string, string>();
  if (nuove.length) {
    onFase?.(`Creo ${nuove.length} nuove aziende in anagrafica`, 0.1);
    await upsertRaggruppato("aziende", nuove.map((n) => ({ ufficio_id: ufficio, cuaa: n.cuaa, denominazione: n.denominazione, biologico: false, iap: false, uma: false, ...pulisci(anagraficaDaCuaa(n.cuaa)) })), "ufficio_id,cuaa");
    const ids = await aziendeUfficio(ufficio);
    ids.forEach((a) => idNuove.set(a.cuaa, a.id));
  }
  const idDi = (v: Piano["voci"][number]) => (v.esame.tipo === "azienda" ? v.esame.aziendaId : idNuove.get(v.esame.cuaa)!);

  // 2. elenco della pratica (modello) o aggiunta dei «fuori elenco»
  const daIncludere = voci.filter((v) => piano.tipo === "modello" || v.fuori).map(idDi).filter(Boolean);
  if (daIncludere.length) {
    onFase?.(piano.tipo === "modello" ? `Salvo l'elenco: ${daIncludere.length} aziende` : `Aggiungo ${daIncludere.length} aziende fuori elenco`, 0.3);
    for (let i = 0; i < daIncludere.length; i += BLOCCO) {
      check(await supabase.from("pratica_abbinamenti").upsert(daIncludere.slice(i, i + BLOCCO).map((azienda_id) => ({ pratica_id: praticaId, azienda_id, tipo: "incluso" })), { onConflict: "pratica_id,azienda_id" }));
    }
  }

  // 3. domande: solo dove c'è uno stato da registrare (nel modello di norma tutte «da fare» = nessun record)
  const domande = voci.filter((v) => (v.stato !== "N" || v.prima != null) && v.stato !== v.prima || (v.riga.numero || v.riga.data_presentazione || v.riga.esito))
    .filter((v) => piano.tipo === "fatte" || v.riga.stato != null).map((v) => pulisci({
    azienda_id: idDi(v), pratica_id: praticaId, stato: v.stato, numero: v.riga.numero, data_presentazione: v.riga.data_presentazione,
    esito: v.riga.esito, motivi: v.riga.motivi?.length ? v.riga.motivi : null, data_esito: v.riga.data_esito, litri_assegnati: v.riga.litri_assegnati, note: v.riga.note,
  }));
  if (domande.length) {
    onFase?.(`Aggiorno ${domande.length} domande`, 0.5);
    await upsertRaggruppato("domande", domande, "azienda_id,pratica_id", (n) => onFase?.(`Aggiornate ${n} di ${domande.length}`, 0.5 + 0.4 * (n / domande.length)));
  }

  // 4. registro del caricamento
  check(await supabase.from("pratica_caricamenti").insert({
    pratica_id: praticaId, ufficio_id: ufficio, tipo: piano.tipo, file_names: fileNames, righe: piano.righe.length,
    riepilogo: { ...piano.conteggi, scartate: piano.scartate.length, conflitti: piano.conflitti, aggiuntiFuori: aggiungiFuori ? piano.conteggi.fuori : 0 },
  }));
  onFase?.("Fatto", 1);
}
