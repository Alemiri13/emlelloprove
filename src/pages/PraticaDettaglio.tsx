import { motion } from "framer-motion";
import { ArrowLeft, CalendarClock, Check, Download, FileSpreadsheet, ListPlus, Lock, Pencil, Replace, Scale, Trash2, Upload, UserRoundX } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import { SelezionaTutti, useSelezione } from "../components/ui/Bulk";
import { useFeedback } from "../components/ui/Feedback";
import { Button } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Inputs";
import { Badge } from "../components/ui/Misc";
import { useAggiungiVoci, useEliminaFileElenco, scaricaFileElenco } from "../lib/queries";
import { useUfficio } from "../lib/ufficio";
import { STATI } from "../lib/domain";
import { daysFromToday, fmtDate, fmtDateTime, relDays, titleCase } from "../lib/format";
import { CaricaElenco } from "../features/pratica/CaricaElenco";
import { ElencoVoci, NOME_STATO } from "../features/pratica/ElencoVoci";
import { ConfrontoBando } from "../features/ConfrontoBando";
import { PraticaEditor } from "./Pratiche";
import { chiaveCuaa, chiaveNome } from "../lib/riscontro";
import type { PraticaFile, StatoDomanda } from "../lib/types";

export function PraticaDettaglioPage() {
  const { id } = useParams();
  const loc = useLocation();
  const { pratiche, praticaFile, voci, riscontri, ufficio, loading } = useUfficio();
  const nav = useNavigate();
  const p = pratiche.find((x) => x.id === id);
  const [carica, setCarica] = useState<"modello" | "fatte" | null>(null);
  const [edit, setEdit] = useState(false);
  const [confronto, setConfronto] = useState(false);
  const selFile = useSelezione(id);
  const selFuori = useSelezione(id);
  const elimina = useEliminaFileElenco();
  const aggiungi = useAggiungiVoci();
  const { toast, confirm } = useFeedback();

  // arrivo da «Nuova domanda»: si apre subito il caricamento dell'elenco
  // (lo stato della navigazione si azzera solo alla chiusura: durante l'animazione la pagina può essere montata due volte)
  const daAprire = (loc.state as { carica?: string } | null)?.carica === "modello";
  useEffect(() => { if (daAprire && p && !p.modello) setCarica("modello"); }, [daAprire, p?.id, p?.modello]); // eslint-disable-line react-hooks/exhaustive-deps
  const chiudiCaricamento = () => { setCarica(null); if (daAprire) nav(loc.pathname, { replace: true, state: null }); };

  const miei = useMemo(() => praticaFile.filter((f) => f.pratica_id === id), [praticaFile, id]);
  const modello = miei.find((f) => f.tipo === "modello");
  const fatte = useMemo(() => miei.filter((f) => f.tipo === "fatte").sort((a, b) => b.created_at.localeCompare(a.created_at)), [miei]);
  const nVoci = useMemo(() => voci.filter((v) => v.pratica_id === id).length, [voci, id]);
  const r = id ? riscontri.get(id) : undefined;
  const fuori = r?.fuori ?? [];
  const chiaveFonte = (i: number) => String(i);

  if (!p) return loading ? null : <Navigate to={`/u/${ufficio.id}/pratiche`} replace />;

  const eliminaFile = async (files: PraticaFile[]) => {
    const conModello = files.some((f) => f.tipo === "modello");
    const ok = await confirm({
      title: files.length === 1 ? `Eliminare «${files[0].nome}»?` : `Eliminare ${files.length} file?`,
      message: conModello
        ? `Elimini l'elenco delle domande da fare: si tolgono anche le ${nVoci} righe dell'elenco con gli stati messi a mano. I file delle domande fatte restano.`
        : "Il riscontro si ricalcola senza questi file. L'elenco delle domande da fare non cambia.",
      danger: true, confirmLabel: "Elimina",
    });
    if (!ok) return;
    await elimina.mutateAsync(files);
    toast("success", files.length === 1 ? "File eliminato" : `${files.length} file eliminati`); selFile.svuota();
  };
  const scarica = async (f: PraticaFile) => { try { await scaricaFileElenco(f); } catch (e) { toast("error", "Download non riuscito", (e as Error).message); } };
  const aggiungiFuori = async (idx: string[]) => {
    const scelte = idx.map((i) => fuori[Number(i)]).filter(Boolean);
    const base = nVoci;
    await aggiungi.mutateAsync(scelte.map((x, i) => ({ pratica_id: p.id, ufficio_id: ufficio.id, file_id: modello?.id ?? null, cuaa: x.riga.cuaa, denominazione: x.riga.denominazione, ordine: base + i })));
    toast("success", `${scelte.length} nominativi aggiunti all'elenco`); selFuori.svuota();
  };
  const g = daysFromToday(p.scadenza);

  return (
    <div>
      <button onClick={() => nav(`/u/${ufficio.id}/pratiche`)} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-500 hover:text-ink-900 mb-5"><ArrowLeft size={16} /> Pratiche e bandi</button>

      <div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-7">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={p.categoria === "bando" ? "amber" : "green"}>{p.categoria === "bando" ? "Bando / una tantum" : "Annuale"}</Badge>
            {p.codice && <Badge>{p.codice}</Badge>}
            {p.ente && <Badge>{p.ente}</Badge>}
            {p.scadenza && <Badge tone={g != null && g >= 0 && g <= 15 ? "red" : "neutral"}><CalendarClock size={11} /> Scadenza {fmtDate(p.scadenza)}{g != null ? ` · ${g < 0 ? "chiusa" : relDays(g)}` : ""}</Badge>}
          </div>
          <h1 className="mt-2 text-[32px] sm:text-[38px] font-extrabold tracking-[-0.04em] leading-tight">{p.nome}</h1>
          <p className="text-ink-500 mt-1">Ufficio di {ufficio.nome}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setEdit(true)}>Modifica</Button>
          <Button variant="secondary" icon={<Scale size={16} />} onClick={() => setConfronto(true)}>Requisiti</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* 1 · elenco delle domande da fare */}
        <Passo n={1} titolo="Elenco delle domande da fare" fatto={!!modello}
          desc={modello ? "Il modello della pratica: chi deve fare questa domanda. Puoi modificarlo riga per riga, sostituirlo o eliminarlo." : "Carica l'Excel con i nominativi che devono fare questa domanda. L'anagrafica non viene toccata."}>
          {modello ? (
            <>
              <SchedaFile f={modello} sotto={<>{nVoci} nominativi nell'elenco · caricato il {fmtDateTime(modello.created_at)}{modello.created_by ? ` da ${modello.created_by}` : ""}</>}
                azioni={<>
                  <IconBtn title="Scarica il file originale" onClick={() => scarica(modello)} disabled={!modello.storage_path}><Download size={16} /></IconBtn>
                  <IconBtn title="Elimina l'elenco" danger onClick={() => eliminaFile([modello])}><Trash2 size={16} /></IconBtn>
                </>} />
              <div className="mt-4 flex flex-wrap gap-2 justify-end">
                <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => document.getElementById("elenco")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Modifica le righe</Button>
                <Button variant="secondary" size="sm" icon={<Replace size={14} />} onClick={() => setCarica("modello")}>Sostituisci o integra</Button>
              </div>
            </>
          ) : (
            <div className="flex justify-end"><Button size="lg" icon={<Upload size={18} />} onClick={() => setCarica("modello")}>Carica l'elenco da fare</Button></div>
          )}
        </Passo>

        {/* 2 · file delle domande fatte */}
        <Passo n={2} titolo="Domande fatte, stampate o in compilazione" fatto={fatte.length > 0} bloccato={!modello && !fatte.length}
          desc={!modello && !fatte.length ? "Prima carica l'elenco delle domande da fare." : "Carica uno o più Excel: li confronto con l'elenco e metto il pallino a ogni riga. Elimina i file vecchi quando non servono più."}>
          {fatte.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3 px-1 h-8">
                <SelezionaTutti ids={fatte.map((f) => f.id)} sel={selFile.sel} onChange={selFile.imposta} etichetta={selFile.n ? `${selFile.n} selezionati` : `${fatte.length} file`} />
                <div className="flex-1" />
                {selFile.n > 0 && <Button variant="ghost" size="sm" className="!text-red-600 hover:!bg-red-50" icon={<Trash2 size={14} />} loading={elimina.isPending} onClick={() => eliminaFile(fatte.filter((f) => selFile.sel.has(f.id)))}>Elimina selezionati</Button>}
              </div>
              {fatte.map((f) => {
                const st = r?.perFile.get(f.id);
                return (
                  <SchedaFile key={f.id} f={f} sel={selFile.sel.has(f.id)} onSel={(v) => selFile.toggle(f.id, v)}
                    sotto={<>{f.n_righe} righe · {fmtDateTime(f.created_at)}{f.created_by ? ` · ${f.created_by}` : ""}</>}
                    chips={st && <>
                      {(["R", "S", "C"] as StatoDomanda[]).filter((s) => st.perStato[s]).map((s) => <span key={s} className="chip !h-6 !text-[11px]" style={{ background: STATI[s].color + "14", color: STATI[s].color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: STATI[s].color }} />{st.perStato[s]} {NOME_STATO[s].toLowerCase()}</span>)}
                      {st.fuori > 0 && <span className="chip !h-6 !text-[11px] bg-amber-50 text-amber-700">{st.fuori} fuori elenco</span>}
                      {f.righe.some((x) => !x.stato || x.stato === "N") && <span className="chip !h-6 !text-[11px] bg-red-50 text-red-700">{f.righe.filter((x) => !x.stato || x.stato === "N").length} senza stato (non fatte)</span>}
                    </>}
                    azioni={<>
                      <IconBtn title="Scarica il file originale" onClick={() => scarica(f)} disabled={!f.storage_path}><Download size={16} /></IconBtn>
                      <IconBtn title="Elimina il file" danger onClick={() => eliminaFile([f])}><Trash2 size={16} /></IconBtn>
                    </>} />
                );
              })}
            </div>
          )}
          <div className="flex justify-end">
            <Button size={fatte.length ? "md" : "lg"} variant={fatte.length ? "secondary" : "primary"} disabled={!modello && !fatte.length} icon={<Upload size={fatte.length ? 16 : 18} />} onClick={() => setCarica("fatte")}>
              {fatte.length ? "Carica altri file" : "Carica le domande fatte"}
            </Button>
          </div>
        </Passo>
      </div>

      {/* riscontro */}
      <div id="elenco" className="mt-6 scroll-mt-24">
        {modello || nVoci ? (
          <ElencoVoci pratica={p} r={r} />
        ) : null}
      </div>

      {/* fuori elenco */}
      {fuori.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="text-[13px] font-bold uppercase tracking-[0.06em] text-amber-700 flex items-center gap-2"><UserRoundX size={14} /> Fuori elenco · {fuori.length}</div>
            <span className="text-[13px] text-ink-500">Nei file delle domande fatte ma non nell'elenco da fare.</span>
            <div className="flex-1" />
            <SelezionaTutti ids={fuori.map((_, i) => chiaveFonte(i))} sel={selFuori.sel} onChange={selFuori.imposta} etichetta={selFuori.n ? `${selFuori.n} selezionati` : "Seleziona tutti"} />
            {selFuori.n > 0 && <Button variant="soft" size="sm" icon={<ListPlus size={14} />} loading={aggiungi.isPending} onClick={() => aggiungiFuori(selFuori.ids)}>Aggiungi all'elenco</Button>}
          </div>
          <div className="card divide-y divide-ink-100">
            {fuori.slice(0, 300).map((x, i) => (
              <div key={chiaveCuaa(x.riga.cuaa) + chiaveNome(x.riga.denominazione) + i} className={clsx("flex items-center gap-4 px-5 py-3", selFuori.sel.has(chiaveFonte(i)) && "bg-brand-50/50")}>
                <Checkbox checked={selFuori.sel.has(chiaveFonte(i))} onChange={(v) => selFuori.toggle(chiaveFonte(i), v)} />
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: STATI[x.stato].color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] truncate">{titleCase(x.riga.denominazione ?? "") || "—"}</div>
                  <div className="text-[12px] text-ink-400 truncate"><span className="font-mono">{x.riga.cuaa ?? "senza CUAA"}</span> · «{x.file.nome}» riga {x.riga.riga}</div>
                </div>
                <span className="text-[12.5px] font-semibold" style={{ color: STATI[x.stato].color }}>{NOME_STATO[x.stato]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {carica && <CaricaElenco open={!!carica} onClose={chiudiCaricamento} pratica={p} tipo={carica} />}
      <PraticaEditor value={edit ? p : null} onClose={() => setEdit(false)} />
      <ConfrontoBando open={confronto} onClose={() => setConfronto(false)} pratica={confronto ? p : null} />
    </div>
  );
}

function Passo({ n, titolo, desc, children, fatto, bloccato }: { n: number; titolo: string; desc: string; children: ReactNode; fatto: boolean; bloccato?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: n * 0.06 } }} className={clsx("card p-6 flex flex-col", bloccato && "opacity-60")}>
      <div className="flex items-start gap-4 mb-5">
        <span className={clsx("h-11 w-11 rounded-2xl grid place-items-center shrink-0 font-extrabold text-[15px]", fatto ? "bg-brand-700 text-white" : bloccato ? "bg-ink-100 text-ink-400" : "bg-brand-50 text-brand-800")}>
          {fatto ? <Check size={20} strokeWidth={3} /> : bloccato ? <Lock size={18} /> : n}
        </span>
        <div className="flex-1">
          <div className="text-[12px] font-bold uppercase tracking-wider text-ink-400">Passo {n}</div>
          <div className="text-[19px] font-extrabold tracking-tight">{titolo}</div>
          <p className="text-[14px] text-ink-500 mt-1">{desc}</p>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function SchedaFile({ f, sotto, chips, azioni, sel, onSel }: { f: PraticaFile; sotto: ReactNode; chips?: ReactNode; azioni: ReactNode; sel?: boolean; onSel?: (v: boolean) => void }) {
  return (
    <div className={clsx("rounded-2xl ring-1 px-4 py-3 flex items-center gap-3 transition-colors", sel ? "ring-brand-300 bg-brand-50/50" : "ring-ink-100")}>
      {onSel && <Checkbox checked={!!sel} onChange={onSel} />}
      <span className={clsx("h-10 w-10 rounded-xl grid place-items-center shrink-0", f.tipo === "modello" ? "bg-brand-50 text-brand-800" : "bg-blue-50 text-blue-700")}><FileSpreadsheet size={18} /></span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[14px] truncate" title={f.nome}>{f.nome}</div>
        <div className="text-[12px] text-ink-500 truncate">{sotto}</div>
        {chips && <div className="mt-1.5 flex flex-wrap gap-1.5">{chips}</div>}
      </div>
      <div className="flex gap-1 shrink-0">{azioni}</div>
    </div>
  );
}

function IconBtn({ children, title, onClick, danger, disabled }: { children: ReactNode; title: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} disabled={disabled}
      className={clsx("h-9 w-9 grid place-items-center rounded-xl transition disabled:opacity-30", danger ? "text-ink-400 hover:bg-red-50 hover:text-red-600" : "text-ink-400 hover:bg-ink-100 hover:text-ink-800")}>
      {children}
    </button>
  );
}
