/**
 * Riscontro tra l'elenco delle domande da fare (voci) e i file delle domande fatte.
 * Per ogni voce:
 *  - si cercano le righe dei file «fatte» con lo stesso CUAA (o, se manca, con lo stesso nominativo);
 *  - lo stato è il più avanzato trovato (fatta > stampata > in compilazione); se non c'è in nessun file: non fatta;
 *  - uno stato impostato a mano ha la precedenza;
 *  - le righe dell'elenco da fare con uno stato indicato nel file (colonna stato, «Data stampa»…) valgono come fonte.
 * Le righe dei file «fatte» che non corrispondono a nessuna voce sono «fuori elenco».
 */
import { normalizza } from "./analisi/classificatore";
import type { Esito, PraticaFile, RigaFile, StatoDomanda, Voce } from "./types";

export const ORDINE: Record<StatoDomanda, number> = { N: 0, C: 1, S: 2, R: 3 };

export function chiaveNome(s: string | null | undefined) {
  return normalizza(s ?? "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
}
export function chiaveCuaa(s: string | null | undefined) {
  const c = (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^\d{8,11}$/.test(c) ? c.padStart(11, "0") : c;
}

export interface Fonte { file: PraticaFile; riga: RigaFile; stato: StatoDomanda }
export interface VoceRiscontro {
  voce: Voce;
  stato: StatoDomanda;
  derivato: StatoDomanda;
  manuale: boolean;
  fonte: Fonte | null;
  numero: string | null;
  data: string | null;
  esito: Esito | null;
}
export interface Riscontro {
  voci: VoceRiscontro[];
  conteggi: Record<StatoDomanda, number>;
  fuori: Fonte[];
  perFile: Map<string, { abbinate: number; fuori: number; perStato: Record<StatoDomanda, number> }>;
}

export function riscontro(voci: Voce[], files: PraticaFile[]): Riscontro {
  const fatte = files.filter((f) => f.tipo === "fatte");
  // l'elenco da fare conta solo per le righe in cui il file indica davvero uno stato (es. «Data stampa» compilata)
  const modelli = files.filter((f) => f.tipo === "modello");
  const perCuaa = new Map<string, Fonte[]>();
  const perNome = new Map<string, Fonte[]>();
  const tutte: Fonte[] = [];
  for (const f of [...fatte, ...modelli]) for (const r of f.righe) {
    const st: StatoDomanda | null = f.tipo === "modello" ? r.stato : r.stato ?? f.stato_predefinito;
    if (!st) continue;
    if (st === "N") continue; // righe esplicitamente «non fatte» non contano come fatte
    const fonte = { file: f, riga: r, stato: st };
    tutte.push(fonte);
    const c = chiaveCuaa(r.cuaa);
    if (c) (perCuaa.get(c) ?? perCuaa.set(c, []).get(c)!).push(fonte);
    const n = chiaveNome(r.denominazione);
    if (n) (perNome.get(n) ?? perNome.set(n, []).get(n)!).push(fonte);
  }
  // nominativi ripetuti nell'elenco: l'abbinamento per nome vale solo se il nome è unico
  const nomiVoci = new Map<string, number>();
  voci.forEach((v) => { const n = chiaveNome(v.denominazione); if (n) nomiVoci.set(n, (nomiVoci.get(n) ?? 0) + 1); });

  const usate = new Set<Fonte>();
  const conteggi: Record<StatoDomanda, number> = { N: 0, C: 0, S: 0, R: 0 };
  const out: VoceRiscontro[] = voci.map((v) => {
    const c = chiaveCuaa(v.cuaa);
    const n = chiaveNome(v.denominazione);
    let cand = c ? perCuaa.get(c) ?? [] : [];
    if (!cand.length && n && nomiVoci.get(n) === 1) cand = (perNome.get(n) ?? []).filter((x) => !x.riga.cuaa || !c || chiaveCuaa(x.riga.cuaa) === c);
    cand.forEach((x) => usate.add(x));
    const migliore = cand.reduce<Fonte | null>((m, x) => (!m || ORDINE[x.stato] > ORDINE[m.stato] || (ORDINE[x.stato] === ORDINE[m.stato] && x.file.created_at > m.file.created_at) ? x : m), null);
    const derivato: StatoDomanda = migliore?.stato ?? "N";
    const stato = v.stato_manuale ?? derivato;
    conteggi[stato]++;
    return {
      voce: v, stato, derivato, manuale: !!v.stato_manuale, fonte: migliore,
      numero: v.numero ?? migliore?.riga.numero ?? null, data: v.data_presentazione ?? migliore?.riga.data ?? null, esito: v.esito ?? migliore?.riga.esito ?? null,
    };
  });
  // fuori elenco: righe non usate, una per CUAA/nome
  const visti = new Set<string>();
  const fuori: Fonte[] = [];
  for (const x of tutte) {
    if (usate.has(x) || x.file.tipo === "modello") continue;
    const k = chiaveCuaa(x.riga.cuaa) || "n:" + chiaveNome(x.riga.denominazione);
    if (visti.has(k)) continue;
    visti.add(k); fuori.push(x);
  }
  const perFile = new Map<string, { abbinate: number; fuori: number; perStato: Record<StatoDomanda, number> }>();
  for (const f of fatte) perFile.set(f.id, { abbinate: 0, fuori: 0, perStato: { N: 0, C: 0, S: 0, R: 0 } });
  for (const x of tutte) {
    const s = perFile.get(x.file.id);
    if (!s) continue;
    if (usate.has(x)) { s.abbinate++; s.perStato[x.stato]++; } else s.fuori++;
  }
  return { voci: out, conteggi, fuori, perFile };
}
