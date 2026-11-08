import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarClock, Check, ChevronRight, ClipboardList, FileSpreadsheet, History, ListChecks, Lock, Pencil, RefreshCw, Scale, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import { useModals, useUfficio } from "../lib/ufficio";
import { abbinate, ORDINE_STATI, STATI } from "../lib/domain";
import { daysFromToday, fmtDate, fmtDateTime, normalizeSearch, relDays, titleCase } from "../lib/format";
import { Button } from "../components/ui/Button";
import { SearchInput } from "../components/ui/Inputs";
import { Avatar, Badge, Empty, ProgressStati, StatoPill } from "../components/ui/Misc";
import { CaricaElenco } from "../features/pratica/CaricaElenco";
import { ConfrontoBando } from "../features/ConfrontoBando";
import { PraticaEditor } from "./Pratiche";
import type { StatoDomanda } from "../lib/types";

type Filtro = "tutte" | StatoDomanda;

export function PraticaDettaglioPage() {
  const { id } = useParams();
  const loc = useLocation();
  const { pratiche, aziende, abbinamenti, domande, domandaByKey, caricamenti, ufficio, loading } = useUfficio();
  const { apriDomanda } = useModals();
  const nav = useNavigate();
  const p = pratiche.find((x) => x.id === id);
  const [carica, setCarica] = useState<"modello" | "fatte" | null>(null);
  const [edit, setEdit] = useState(false);
  const [confronto, setConfronto] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("tutte");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(100);

  // arrivo da «Nuova domanda»: si apre subito il caricamento dell'elenco
  // (lo stato della navigazione si azzera solo alla chiusura: durante l'animazione la pagina può essere montata due volte)
  const daAprire = (loc.state as { carica?: string } | null)?.carica === "modello";
  useEffect(() => { if (daAprire && p && !p.modello) setCarica("modello"); }, [daAprire, p?.id, p?.modello]); // eslint-disable-line react-hooks/exhaustive-deps
  const chiudiCaricamento = () => { setCarica(null); if (daAprire) nav(loc.pathname, { replace: true, state: null }); };

  const miei = useMemo(() => caricamenti.filter((c) => c.pratica_id === id), [caricamenti, id]);
  const modello = miei.filter((c) => c.tipo === "modello");
  const fatte = miei.filter((c) => c.tipo === "fatte");

  const righe = useMemo(() => {
    if (!p) return [];
    const ab = abbinate(aziende, p, abbinamenti, domande);
    return aziende.filter((a) => ab.has(a.id)).map((a) => ({ a, d: domandaByKey.get(a.id + "|" + p.id) }));
  }, [p, aziende, abbinamenti, domande, domandaByKey]);

  const counts = useMemo(() => {
    const c: Record<StatoDomanda, number> = { N: 0, C: 0, S: 0, R: 0 };
    righe.forEach(({ d }) => c[d?.stato ?? "N"]++);
    return c;
  }, [righe]);

  const lista = useMemo(() => {
    const n = normalizeSearch(q.trim());
    return righe.filter(({ a, d }) => (filtro === "tutte" || (d?.stato ?? "N") === filtro) && (!n || normalizeSearch(`${a.denominazione} ${a.cuaa} ${d?.numero ?? ""}`).includes(n)))
      .sort((x, y) => ORDINE_STATI.indexOf(x.d?.stato ?? "N") - ORDINE_STATI.indexOf(y.d?.stato ?? "N") || x.a.denominazione.localeCompare(y.a.denominazione, "it"));
  }, [righe, filtro, q]);

  if (!p) return loading ? null : <Navigate to={`/u/${ufficio.id}/pratiche`} replace />;
  const g = daysFromToday(p.scadenza);
  const tot = righe.length;

  return (
    <div>
      <button onClick={() => nav(`/u/${ufficio.id}/pratiche`)} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-500 hover:text-ink-900 mb-5"><ArrowLeft size={16} /> Pratiche e bandi</button>

      {/* intestazione */}
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

      {/* i due caricamenti */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Passo
          n={1} titolo="Elenco delle domande da fare" fatto={!!p.modello}
          desc={p.modello ? "Il modello della pratica: le aziende che devono fare questa domanda." : "Carica l'Excel con le aziende che devono fare questa domanda. Si fa una volta sola."}
          info={modello[0] && <>Caricato il {fmtDateTime(modello[modello.length - 1].created_at)}{modello[modello.length - 1].created_by ? ` da ${modello[modello.length - 1].created_by}` : ""} · {tot} aziende</>}
          azione={p.modello
            ? <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => setCarica("modello")}>Aggiungi aziende all'elenco</Button>
            : <Button size="lg" icon={<Upload size={18} />} onClick={() => setCarica("modello")}>Carica l'elenco da fare</Button>}
        />
        <Passo
          n={2} titolo="Domande fatte" fatto={fatte.length > 0} bloccato={!p.modello}
          desc={!p.modello ? "Prima carica l'elenco delle domande da fare." : "Carica l'Excel delle domande fatte: lo confronto con l'elenco e metto il pallino a ogni azienda. Puoi ricaricarlo ogni volta che si aggiorna."}
          info={fatte[0] && <>Ultimo caricamento il {fmtDateTime(fatte[0].created_at)} · {fatte.length} {fatte.length === 1 ? "caricamento" : "caricamenti"}</>}
          azione={<Button size="lg" variant={fatte.length ? "secondary" : "primary"} disabled={!p.modello} icon={<Upload size={18} />} onClick={() => setCarica("fatte")}>{fatte.length ? "Carica un elenco aggiornato" : "Carica le domande fatte"}</Button>}
        />
      </div>

      {/* stato */}
      <div className="mt-6 card p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="text-[13px] text-ink-500 font-medium">{p.modello ? "Aziende dell'elenco" : "Aziende abbinate dai requisiti (elenco non ancora caricato)"}</div>
            <div className="text-[28px] font-extrabold tabular-nums tracking-tight">{tot ? Math.round((counts.R / tot) * 100) : 0}% <span className="text-base font-semibold text-ink-400">fatte · {counts.R} su {tot}</span></div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(["R", "S", "C", "N"] as StatoDomanda[]).map((s) => (
              <button key={s} onClick={() => setFiltro(filtro === s ? "tutte" : s)}
                className={clsx("rounded-2xl px-3 py-2.5 text-left border-2 transition-all min-w-[86px] active:scale-[.97]", filtro === s ? "" : "border-transparent bg-ink-50 hover:bg-ink-100")}
                style={filtro === s ? { borderColor: STATI[s].color, background: STATI[s].color + "0F" } : undefined}>
                <div className="flex items-center gap-1.5 text-[11.5px] font-bold whitespace-nowrap" style={{ color: STATI[s].color }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATI[s].color }} />{s === "R" ? "Fatte" : s === "N" ? "Da fare" : STATI[s].label}</div>
                <div className="text-[22px] font-extrabold tabular-nums leading-tight">{counts[s]}</div>
              </button>
            ))}
          </div>
        </div>
        <ProgressStati className="mt-5" counts={counts} total={tot} height={10} />
        {counts.N > 0 && (
          <button onClick={() => nav(`/u/${ufficio.id}/da-fare?pratica=${p.id}`)} className="mt-4 inline-flex items-center gap-2 text-[13.5px] font-semibold text-brand-800 hover:text-brand-950">
            <ListChecks size={16} /> {counts.N} aziende in «Da fare» <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* elenco aziende con pallino */}
      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Cerca azienda, CUAA o numero domanda…" className="flex-1" />
        {filtro !== "tutte" && <Button variant="secondary" onClick={() => setFiltro("tutte")}>Mostra tutte</Button>}
      </div>
      <div className="mt-3 card overflow-hidden">
        {tot === 0 ? (
          <Empty icon={<ClipboardList size={26} />} title="Nessuna azienda nella pratica" desc="Carica l'elenco delle domande da fare per iniziare." action={<Button icon={<Upload size={17} />} onClick={() => setCarica("modello")}>Carica l'elenco da fare</Button>} />
        ) : lista.length === 0 ? <Empty icon={<ClipboardList size={26} />} title="Nessuna azienda con questo filtro" /> : (
          <div className="divide-y divide-ink-100">
            <AnimatePresence initial={false}>
              {lista.slice(0, limit).map(({ a, d }, i) => {
                const st = d?.stato ?? "N";
                return (
                  <motion.button key={a.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: Math.min(i, 15) * 0.012 } }} exit={{ opacity: 0 }}
                    onClick={() => apriDomanda(a.id, p.id)} className="group w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-ink-50/80 transition-colors">
                    <span className="relative h-3.5 w-3.5 shrink-0">
                      <span className="absolute inset-0 rounded-full" style={{ background: STATI[st].color }} />
                      {st === "N" && <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: STATI[st].color }} />}
                    </span>
                    <Avatar name={a.denominazione} size={36} square={a.tipo === "PG"} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-[14.5px] truncate group-hover:text-brand-900">{titleCase(a.denominazione)}</span>
                      <span className="block text-[12px] font-mono text-ink-400">{a.cuaa}</span>
                    </span>
                    <span className="hidden md:block w-40 text-[12.5px] text-ink-500 truncate">{d?.numero ?? ""}{d?.data_presentazione ? ` · ${fmtDate(d.data_presentazione)}` : ""}</span>
                    <StatoPill stato={st} />
                    <ChevronRight size={17} className="text-ink-300 group-hover:text-brand-700" />
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        {lista.length > limit && <div className="p-4 flex justify-center border-t border-ink-100"><Button variant="secondary" onClick={() => setLimit((l) => l + 100)}>Mostra altre ({lista.length - limit})</Button></div>}
      </div>

      {/* storico caricamenti */}
      {miei.length > 0 && (
        <div className="mt-6">
          <div className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink-400 mb-3 flex items-center gap-2"><History size={14} /> Caricamenti</div>
          <div className="card divide-y divide-ink-100">
            {miei.map((c) => {
              const r = c.riepilogo as Record<string, number | Record<string, number>>;
              const ps = (r.perStato ?? {}) as Record<string, number>;
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className={clsx("h-10 w-10 rounded-xl grid place-items-center", c.tipo === "modello" ? "bg-brand-50 text-brand-800" : "bg-blue-50 text-blue-700")}><FileSpreadsheet size={18} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[14px]">{c.tipo === "modello" ? "Elenco delle domande da fare" : "Domande fatte"} <span className="text-ink-400 font-normal">· {c.righe} righe</span></div>
                    <div className="text-[12px] text-ink-500 truncate">{c.file_names.join(", ")} · {fmtDateTime(c.created_at)}{c.created_by ? ` · ${c.created_by}` : ""}</div>
                  </div>
                  <div className="hidden sm:flex gap-1.5">
                    {c.tipo === "fatte" ? (["R", "S", "C"] as StatoDomanda[]).filter((s) => ps[s]).map((s) => <span key={s} className="chip !h-6 !text-[11px]" style={{ background: STATI[s].color + "14", color: STATI[s].color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: STATI[s].color }} />{ps[s]}</span>)
                      : <span className="chip !h-6 !text-[11px] bg-brand-50 text-brand-800"><Check size={11} />{Number(r.nuoveAziende ?? 0)} nuove aziende</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {carica && <CaricaElenco open={!!carica} onClose={chiudiCaricamento} pratica={p} tipo={carica} />}
      <PraticaEditor value={edit ? p : null} onClose={() => setEdit(false)} />
      <ConfrontoBando open={confronto} onClose={() => setConfronto(false)} pratica={confronto ? p : null} />
    </div>
  );
}

function Passo({ n, titolo, desc, info, azione, fatto, bloccato }: { n: number; titolo: string; desc: string; info?: React.ReactNode; azione: React.ReactNode; fatto: boolean; bloccato?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: n * 0.06 } }}
      className={clsx("card p-6 flex flex-col", bloccato && "opacity-60")}>
      <div className="flex items-start gap-4">
        <span className={clsx("h-11 w-11 rounded-2xl grid place-items-center shrink-0 font-extrabold text-[15px]", fatto ? "bg-brand-700 text-white" : bloccato ? "bg-ink-100 text-ink-400" : "bg-brand-50 text-brand-800")}>
          {fatto ? <Check size={20} strokeWidth={3} /> : bloccato ? <Lock size={18} /> : n}
        </span>
        <div className="flex-1">
          <div className="text-[12px] font-bold uppercase tracking-wider text-ink-400">Passo {n}</div>
          <div className="text-[19px] font-extrabold tracking-tight">{titolo}</div>
          <p className="text-[14px] text-ink-500 mt-1">{desc}</p>
          {info && <p className="text-[12.5px] text-brand-800 font-medium mt-2">{info}</p>}
        </div>
      </div>
      <div className="mt-5 flex justify-end">{azione}</div>
    </motion.div>
  );
}
