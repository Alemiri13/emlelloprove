/**
 * Importazione massiva dell'anagrafica (aziende) da Excel.
 * Gli elenchi delle pratiche NON passano da qui: non toccano l'anagrafica (vedi riscontro.ts).
 * Regole:
 *  - le celle vuote non cancellano i dati esistenti (si aggiornano solo i campi pieni);
 *  - i CUAA nuovi diventano nuove aziende dell'ufficio (dati anagrafici ricavati dal codice fiscale);
 *  - inserimenti e aggiornamenti a blocchi, raggruppati per insieme di colonne.
 */
import { check, supabase } from "./supabase";
import { tutte } from "./queries";
import { decodeCuaa, normalizzaCuaa } from "./cf";
import { normalizza } from "./analisi/classificatore";

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
