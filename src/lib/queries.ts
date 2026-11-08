import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { check, supabase } from "./supabase";
import type { Abbinamento, Azienda, Caricamento, Coltura, Documento, Domanda, Pratica, Profilo, Storico, TipoDomanda, Ufficio } from "./types";

const num = (v: unknown) => (v == null ? null : Number(v));

function fixAzienda(a: Azienda): Azienda {
  return { ...a, sau_ha: num(a.sau_ha), azienda_colture: (a.azienda_colture ?? []).map((c) => ({ ...c, superficie_ha: num(c.superficie_ha) })) };
}
/** Le colonne di importi/pagamenti/quota non fanno più parte del gestionale: vengono scartate se ancora presenti nel database. */
const SCARTA = ["importo_richiesto", "importo_ammesso", "importo_pagato", "data_pagamento", "stato_pagamento_manuale", "quota_importo", "quota_incassata", "quota_data"];
function fixDomanda(d: Domanda): Domanda {
  const o = { ...d } as Record<string, unknown>;
  for (const k of SCARTA) delete o[k];
  return o as unknown as Domanda;
}

// ---------------- Letture ----------------
export function useUffici() {
  return useQuery({
    queryKey: ["uffici"],
    queryFn: async () => check(await supabase.from("uffici").select("*").order("ordine")) as Ufficio[],
    staleTime: Infinity,
  });
}

export function useProfilo(userId: string | undefined) {
  return useQuery({
    queryKey: ["profilo", userId],
    enabled: !!userId,
    queryFn: async () => check(await supabase.from("profili").select("*").eq("id", userId!).maybeSingle()) as Profilo | null,
  });
}

/** Conteggi per la schermata di scelta ufficio. */
/** Legge tutte le righe superando il limite di 1000 per richiesta. */
export async function tutte<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>, pagina = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pagina) {
    const rows = check(await query(from, from + pagina - 1)) as T[];
    out.push(...rows);
    if (rows.length < pagina) break;
  }
  return out;
}

/** Conteggi per la schermata di scelta ufficio. */
export function useRiepilogoUffici() {
  return useQuery({
    queryKey: ["riepilogo-uffici"],
    queryFn: async () => {
      const uffici = check(await supabase.from("uffici").select("id")) as { id: string }[];
      const out: Record<string, { aziende: number; aperte: number; rilasciate: number }> = {};
      await Promise.all(uffici.map(async (u) => {
        const conta = async (stati?: string[]) => {
          if (!stati) {
            const r = await supabase.from("aziende").select("id", { count: "exact", head: true }).eq("ufficio_id", u.id);
            return r.count ?? 0;
          }
          const r = await supabase.from("domande").select("id, azienda:aziende!inner(ufficio_id)", { count: "exact", head: true }).eq("azienda.ufficio_id", u.id).in("stato", stati);
          return r.count ?? 0;
        };
        const [aziende, aperte, rilasciate] = await Promise.all([conta(), conta(["C", "S"]), conta(["R"])]);
        out[u.id] = { aziende, aperte, rilasciate };
      }));
      return out;
    },
  });
}

export function useAziende(ufficio: string | undefined) {
  return useQuery({
    queryKey: ["aziende", ufficio],
    enabled: !!ufficio,
    queryFn: async () => {
      const rows = await tutte<Azienda>((a, b) => supabase.from("aziende").select("*, azienda_colture(*)").eq("ufficio_id", ufficio!).order("denominazione").order("id").range(a, b));
      return rows.map(fixAzienda);
    },
  });
}

export function useDomande(ufficio: string | undefined) {
  return useQuery({
    queryKey: ["domande", ufficio],
    enabled: !!ufficio,
    queryFn: async () => {
      const rows = await tutte<Domanda & { azienda?: unknown }>((a, b) => supabase.from("domande").select("*, azienda:aziende!inner(ufficio_id)").eq("azienda.ufficio_id", ufficio!).order("id").range(a, b));
      return rows.map(({ azienda: _a, ...d }) => fixDomanda(d as Domanda));
    },
  });
}

export function usePratiche() {
  return useQuery({
    queryKey: ["pratiche"],
    queryFn: async () => {
      const rows = check(await supabase.from("pratiche").select("*").order("ordine").order("nome")) as Pratica[];
      return rows.map((p) => {
        const { quota_default: _q, ha_contributo: _h, ...resto } = p as Pratica & { quota_default?: unknown; ha_contributo?: unknown };
        return { ...resto, criteri: p.criteri ?? {} } as Pratica;
      });
    },
  });
}

export function useTipiDomanda() {
  return useQuery({
    queryKey: ["tipi-domanda"],
    queryFn: async () => check(await supabase.from("tipi_domanda").select("*").order("ordine")) as TipoDomanda[],
    staleTime: 10 * 60_000,
  });
}

export function useCaricamenti(ufficio: string | undefined) {
  return useQuery({
    queryKey: ["caricamenti", ufficio],
    enabled: !!ufficio,
    queryFn: async () => check(await supabase.from("pratica_caricamenti").select("*").eq("ufficio_id", ufficio!).order("created_at", { ascending: false })) as Caricamento[],
  });
}

export function useColture() {
  return useQuery({
    queryKey: ["colture"],
    queryFn: async () => check(await supabase.from("colture").select("*").order("nome")) as Coltura[],
  });
}

export function useAbbinamenti() {
  return useQuery({
    queryKey: ["abbinamenti"],
    queryFn: async () => check(await supabase.from("pratica_abbinamenti").select("pratica_id, azienda_id, tipo")) as Abbinamento[],
  });
}

export function useStorico(aziendaId: string | undefined) {
  return useQuery({
    queryKey: ["storico", aziendaId],
    enabled: !!aziendaId,
    queryFn: async () => check(await supabase.from("storico").select("*").eq("azienda_id", aziendaId!).order("created_at", { ascending: false }).limit(100)) as Storico[],
  });
}

export function useDocumenti(aziendaId: string | undefined) {
  return useQuery({
    queryKey: ["documenti", aziendaId],
    enabled: !!aziendaId,
    queryFn: async () => check(await supabase.from("documenti").select("*").eq("azienda_id", aziendaId!).order("created_at", { ascending: false })) as Documento[],
  });
}

/** Ricerca CUAA su tutti gli uffici (per evitare doppioni). */
/** Ricerca CUAA in tutti gli uffici: serve a evitare doppioni e a ricopiare i dati già noti. */
export async function cercaCuaa(cuaa: string) {
  return check(await supabase.from("aziende").select("*").eq("cuaa", cuaa)) as Azienda[];
}

// ---------------- Scritture ----------------
function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export type AziendaInput = Partial<Omit<Azienda, "id" | "tipo" | "created_at" | "updated_at" | "azienda_colture">>;

export function useSalvaAzienda() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, data, colture }: { id?: string; data: AziendaInput; colture?: { coltura_id: string; superficie_ha: number | null }[] }) => {
      let row: Azienda;
      if (id) row = check(await supabase.from("aziende").update(data).eq("id", id).select().single()) as Azienda;
      else row = check(await supabase.from("aziende").insert(data).select().single()) as Azienda;
      if (colture && colture.length) {
        check(await supabase.from("azienda_colture").upsert(colture.map((c) => ({ ...c, azienda_id: row.id })), { onConflict: "azienda_id,coltura_id" }));
      }
      return row;
    },
    onSuccess: () => inv("aziende", "riepilogo-uffici", "storico"),
  });
}

/** Elimina una o più aziende (con domande, colture e documenti, compresi i file archiviati). */
export async function eliminaAziende(ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) {
    const blocco = ids.slice(i, i + 200);
    const docs = check(await supabase.from("documenti").select("storage_path").in("azienda_id", blocco)) as { storage_path: string | null }[];
    const paths = docs.map((d) => d.storage_path).filter((x): x is string => !!x);
    if (paths.length) await supabase.storage.from("documenti").remove(paths);
    check(await supabase.from("aziende").delete().in("id", blocco));
  }
}

export function useEliminaAzienda() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => eliminaAziende([id]),
    onSuccess: () => inv("aziende", "domande", "riepilogo-uffici"),
  });
}

export function useEliminaAziende() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ ids, cuaaAltriUffici }: { ids: string[]; cuaaAltriUffici?: string[] }) => {
      let tutti = [...ids];
      if (cuaaAltriUffici?.length) {
        for (let i = 0; i < cuaaAltriUffici.length; i += 200) {
          const r = check(await supabase.from("aziende").select("id").in("cuaa", cuaaAltriUffici.slice(i, i + 200))) as { id: string }[];
          tutti.push(...r.map((x) => x.id));
        }
        tutti = [...new Set(tutti)];
      }
      await eliminaAziende(tutti);
      return tutti.length;
    },
    onSuccess: () => inv("aziende", "domande", "riepilogo-uffici", "abbinamenti"),
  });
}

export function useSalvaColturaAzienda() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { azienda_id: string; coltura_id: string; superficie_ha: number | null; varieta?: string | null }) => {
      check(await supabase.from("azienda_colture").upsert(v, { onConflict: "azienda_id,coltura_id" }));
    },
    onSuccess: () => inv("aziende", "storico"),
  });
}
export function useRimuoviColturaAzienda() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => { check(await supabase.from("azienda_colture").delete().eq("id", id)); },
    onSuccess: () => inv("aziende", "storico"),
  });
}

export function useSalvaColtura() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...v }: { id?: string; nome: string; categoria: string; colore: string }) => {
      if (id) return check(await supabase.from("colture").update(v).eq("id", id).select().single()) as Coltura;
      return check(await supabase.from("colture").insert(v).select().single()) as Coltura;
    },
    onSuccess: () => inv("colture"),
  });
}
export function useEliminaColtura() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.from("colture").delete().eq("id", id);
      if (res.error?.code === "23503") throw new Error("La coltura è usata da alcune aziende: rimuovila prima da loro.");
      check(res);
    },
    onSuccess: () => inv("colture"),
  });
}

export type DomandaInput = Partial<Omit<Domanda, "id" | "created_at" | "updated_at" | "updated_by">> & { azienda_id: string; pratica_id: string };

export function useSalvaDomanda() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: DomandaInput) =>
      fixDomanda(check(await supabase.from("domande").upsert(v, { onConflict: "azienda_id,pratica_id" }).select().single()) as Domanda),
    onSuccess: () => inv("domande", "riepilogo-uffici", "storico"),
  });
}

export function useStatoMultiplo() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ pratica_id, aziende, stato }: { pratica_id: string; aziende: string[]; stato: "C" | "S" | "R" | "N" }) => {
      if (stato === "N") {
        check(await supabase.from("domande").delete().eq("pratica_id", pratica_id).in("azienda_id", aziende));
      } else {
        check(await supabase.from("domande").upsert(aziende.map((azienda_id) => ({ azienda_id, pratica_id, stato })), { onConflict: "azienda_id,pratica_id" }));
      }
    },
    onSuccess: () => inv("domande", "riepilogo-uffici", "storico"),
  });
}

export function useEliminaDomanda() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => { check(await supabase.from("domande").delete().eq("id", id)); },
    onSuccess: () => inv("domande", "riepilogo-uffici", "storico"),
  });
}

export function useAbbina() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ pratica_id, aziende, tipo }: { pratica_id: string; aziende: string[]; tipo: "incluso" | "escluso" | null }) => {
      if (tipo === null) check(await supabase.from("pratica_abbinamenti").delete().eq("pratica_id", pratica_id).in("azienda_id", aziende));
      else check(await supabase.from("pratica_abbinamenti").upsert(aziende.map((azienda_id) => ({ pratica_id, azienda_id, tipo })), { onConflict: "pratica_id,azienda_id" }));
    },
    onSuccess: () => inv("abbinamenti"),
  });
}

export function useSalvaPratica() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ isNew, ...v }: Partial<Pratica> & { id: string; isNew?: boolean }) => {
      if (isNew) return check(await supabase.from("pratiche").insert(v).select().single()) as Pratica;
      return check(await supabase.from("pratiche").update(v).eq("id", v.id).select().single()) as Pratica;
    },
    onSuccess: () => inv("pratiche"),
  });
}

export function useEliminaPratica() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => { check(await supabase.from("pratiche").delete().eq("id", id)); },
    onSuccess: () => inv("pratiche", "domande"),
  });
}

export function useCaricaDocumento() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ file, meta }: { file: File | null; meta: Omit<Documento, "id" | "created_at" | "created_by" | "storage_path" | "file_name" | "mime" | "size"> }) => {
      let storage: Partial<Documento> = {};
      if (file) {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
        const path = `${meta.azienda_id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("documenti").upload(path, file, { contentType: file.type || undefined });
        if (up.error) throw new Error(up.error.message);
        storage = { storage_path: path, file_name: file.name, mime: file.type, size: file.size };
      }
      check(await supabase.from("documenti").insert({ ...meta, ...storage }));
    },
    onSuccess: () => inv("documenti", "storico"),
  });
}

export function useEliminaDocumento() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (d: Documento) => {
      if (d.storage_path) await supabase.storage.from("documenti").remove([d.storage_path]);
      check(await supabase.from("documenti").delete().eq("id", d.id));
    },
    onSuccess: () => inv("documenti", "storico"),
  });
}

export async function apriDocumento(d: Documento) {
  if (!d.storage_path) return;
  const { data, error } = await supabase.storage.from("documenti").createSignedUrl(d.storage_path, 120);
  if (error) throw new Error(error.message);
  window.open(data.signedUrl, "_blank", "noopener");
}

/** Scarica il file archiviato (per l'anteprima). */
export async function scaricaDocumento(d: Documento): Promise<Blob> {
  if (!d.storage_path) throw new Error("Nessun file allegato");
  const { data, error } = await supabase.storage.from("documenti").download(d.storage_path);
  if (error) throw new Error(error.message);
  return data;
}

// =====================================================================
// Operazioni in blocco
// =====================================================================
async function aBlocchi<T>(ids: T[], fn: (parte: T[]) => Promise<void>, dim = 200) {
  for (let i = 0; i < ids.length; i += dim) await fn(ids.slice(i, i + dim));
}

/** Aggiorna gli stessi campi su più aziende. */
export function useAggiornaAziende() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ ids, campi }: { ids: string[]; campi: Partial<Azienda> }) => {
      await aBlocchi(ids, async (p) => { check(await supabase.from("aziende").update(campi).in("id", p)); });
    },
    onSuccess: () => inv("aziende", "storico"),
  });
}

/** Copia (o sposta) aziende in un altro ufficio. Spostando, domande e documenti seguono l'azienda. */
export function useTrasferisciAziende() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ ids, ufficio, sposta }: { ids: string[]; ufficio: string; sposta: boolean }) => {
      const righe = await tutte<Azienda>((a, b) => supabase.from("aziende").select("*, azienda_colture(*)").in("id", ids.slice(0, 1000)).order("id").range(a, b));
      const gia = new Set((await tutte<{ cuaa: string }>((a, b) => supabase.from("aziende").select("cuaa").eq("ufficio_id", ufficio).order("id").range(a, b))).map((x) => x.cuaa));
      const libere = righe.filter((r) => !gia.has(r.cuaa));
      if (sposta) {
        await aBlocchi(libere.map((r) => r.id), async (p) => { check(await supabase.from("aziende").update({ ufficio_id: ufficio }).in("id", p)); });
      } else if (libere.length) {
        const nuove = libere.map(({ id: _id, tipo: _t, created_at: _c, updated_at: _u, azienda_colture: _ac, ...r }) => ({ ...r, ufficio_id: ufficio }));
        const ins = [] as { id: string; cuaa: string }[];
        await aBlocchi(nuove, async (p) => { ins.push(...(check(await supabase.from("aziende").insert(p).select("id, cuaa")) as { id: string; cuaa: string }[])); });
        const idNuovo = new Map(ins.map((x) => [x.cuaa, x.id]));
        const colture = libere.flatMap((r) => (r.azienda_colture ?? []).map((c) => ({ azienda_id: idNuovo.get(r.cuaa), coltura_id: c.coltura_id, superficie_ha: c.superficie_ha, varieta: c.varieta })));
        await aBlocchi(colture, async (p) => { check(await supabase.from("azienda_colture").insert(p)); });
      }
      return { fatte: libere.length, saltate: righe.length - libere.length };
    },
    onSuccess: () => inv("aziende", "domande", "riepilogo-uffici"),
  });
}

/** Attiva / disattiva più pratiche. */
export function useAttivaPratiche() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ ids, attivo }: { ids: string[]; attivo: boolean }) => { check(await supabase.from("pratiche").update({ attivo }).in("id", ids)); },
    onSuccess: () => inv("pratiche"),
  });
}

/** Elimina più pratiche (con le loro domande, in tutti gli uffici). */
export function useEliminaPratiche() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (ids: string[]) => { check(await supabase.from("pratiche").delete().in("id", ids)); },
    onSuccess: () => inv("pratiche", "domande", "abbinamenti", "caricamenti", "riepilogo-uffici"),
  });
}

/** Toglie aziende da una pratica: elimina le domande e le toglie dall'elenco «da fare». */
export function useTogliDaPratica() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ pratica_id, aziende, escludi }: { pratica_id: string; aziende: string[]; escludi?: boolean }) => {
      await aBlocchi(aziende, async (p) => {
        check(await supabase.from("domande").delete().eq("pratica_id", pratica_id).in("azienda_id", p));
        if (escludi) check(await supabase.from("pratica_abbinamenti").upsert(p.map((azienda_id) => ({ pratica_id, azienda_id, tipo: "escluso" })), { onConflict: "pratica_id,azienda_id" }));
        else check(await supabase.from("pratica_abbinamenti").delete().eq("pratica_id", pratica_id).in("azienda_id", p));
      });
    },
    onSuccess: () => inv("domande", "abbinamenti", "riepilogo-uffici", "storico"),
  });
}

/** Elimina caricamenti dallo storico. Eliminando l'elenco «da fare» la pratica torna ai requisiti automatici. */
export function useEliminaCaricamenti() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ ids, svuotaElenco }: { ids: string[]; svuotaElenco?: { pratica_id: string; aziende: string[] } }) => {
      check(await supabase.from("pratica_caricamenti").delete().in("id", ids));
      if (svuotaElenco) await aBlocchi(svuotaElenco.aziende, async (p) => {
        check(await supabase.from("pratica_abbinamenti").delete().eq("pratica_id", svuotaElenco.pratica_id).eq("tipo", "incluso").in("azienda_id", p));
      });
    },
    onSuccess: () => inv("caricamenti", "abbinamenti"),
  });
}

/** Stato per più domande anche di pratiche diverse. */
export function useStatoMisto() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ voci, stato }: { voci: { azienda_id: string; pratica_id: string }[]; stato: "C" | "S" | "R" | "N" }) => {
      await aBlocchi(voci, async (p) => {
        if (stato === "N") {
          for (const v of p) check(await supabase.from("domande").delete().eq("pratica_id", v.pratica_id).eq("azienda_id", v.azienda_id));
        } else check(await supabase.from("domande").upsert(p.map((v) => ({ ...v, stato })), { onConflict: "azienda_id,pratica_id" }));
      });
    },
    onSuccess: () => inv("domande", "riepilogo-uffici", "storico"),
  });
}

export function useEliminaColture() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await supabase.from("colture").delete().in("id", ids);
      if (res.error?.code === "23503") throw new Error("Alcune colture sono usate da aziende: toglile prima da loro.");
      check(res);
    },
    onSuccess: () => inv("colture"),
  });
}

export function useEliminaDocumenti() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (docs: Documento[]) => {
      const paths = docs.map((d) => d.storage_path).filter((x): x is string => !!x);
      if (paths.length) await supabase.storage.from("documenti").remove(paths);
      check(await supabase.from("documenti").delete().in("id", docs.map((d) => d.id)));
    },
    onSuccess: () => inv("documenti", "storico"),
  });
}
