import { AnimatePresence, motion } from "framer-motion";
import { Ban, CalendarClock, Check, ChevronDown, ClipboardList, Download, PenLine, Plus, Printer, Send, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useModals, useUfficio } from "../lib/ufficio";
import { abbinate, ESITI, ORDINE_STATI, STATI, statoPagamento } from "../lib/domain";
import { daysFromToday, eur, fmtDate, litri, normalizeSearch, relDays, titleCase } from "../lib/format";
import { useAbbina, useSalvaDomanda, useStatoMultiplo } from "../lib/queries";
import { Button } from "../components/ui/Button";
import { Checkbox, SearchInput } from "../components/ui/Inputs";
import { Select } from "../components/ui/Select";
import { Avatar, Empty, EsitoPill, ProgressStati, StatoPill } from "../components/ui/Misc";
import { Popover } from "../components/ui/Popover";
import { useFeedback } from "../components/ui/Feedback";
import { Skeleton } from "../components/ui/Spinner";
import { PageHeader } from "./Anagrafica";
import type { Azienda, Domanda, Esito, Pratica, StatoDomanda } from "../lib/types";

type FiltroStato = "tutte" | StatoDomanda;

export function DomandePage() {
  const { aziende, domande, pratiche, abbinamenti, domandaByKey, loading, ufficio } = useUfficio();
  const { apriDomanda, nuovaDomanda } = useModals();
  const attive = pratiche.filter((p) => p.attivo);
  const [pid, setPid] = useState<string>(() => { try { return localStorage.getItem("cia-pratica") ?? ""; } catch { return ""; } });
  const pratica = attive.find((p) => p.id === pid) ?? attive[0];
  useEffect(() => { if (pratica) try { localStorage.setItem("cia-pratica", pratica.id); } catch { /* ignore */ } }, [pratica]);

  const [filtro, setFiltro] = useState<FiltroStato>("tutte");
  const [esito, setEsito] = useState<Esito | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(80);
  useEffect(() => { setSel(new Set()); setFiltro("tutte"); setEsito(null); setLimit(80); }, [pratica?.id, ufficio.id]);

  // riepilogo per ogni pratica (per le card in alto)
  const perPratica = useMemo(() => {
    const m = new Map<string, { counts: Record<StatoDomanda, number>; tot: number }>();
    for (const p of attive) {
      const ab = abbinate(aziende, p, abbinamenti, domande);
      const counts: Record<StatoDomanda, number> = { N: 0, C: 0, S: 0, R: 0 };
      for (const id of ab.keys()) counts[domandaByKey.get(id + "|" + p.id)?.stato ?? "N"]++;
      m.set(p.id, { counts, tot: ab.size });
    }
    return m;
  }, [attive, aziende, abbinamenti, domande, domandaByKey]);

  const righe = useMemo(() => {
    if (!pratica) return [];
    const ab = abbinate(aziende, pratica, abbinamenti, domande);
    return aziende.filter((a) => ab.has(a.id)).map((a) => ({ a, d: domandaByKey.get(a.id + "|" + pratica.id), motivo: ab.get(a.id)! }));
  }, [pratica, aziende, abbinamenti, domande, domandaByKey]);

  const filtrate = useMemo(() => {
    const n = normalizeSearch(q.trim());
    return righe
      .filter(({ a, d }) => {
        const st = d?.stato ?? "N";
        if (filtro !== "tutte" && st !== filtro) return false;
        if (esito && (st !== "R" || d?.esito !== esito)) return false;
        if (n && !normalizeSearch(`${a.denominazione} ${a.cuaa} ${d?.numero ?? ""}`).includes(n)) return false;
        return true;
      })
      .sort((x, y) => ORDINE_STATI.indexOf(x.d?.stato ?? "N") - ORDINE_STATI.indexOf(y.d?.stato ?? "N") || x.a.denominazione.localeCompare(y.a.denominazione, "it"));
  }, [righe, filtro, esito, q]);

  const info = pratica ? perPratica.get(pratica.id) : undefined;
  const esitiCount = useMemo(() => {
    const c: Record<Esito, number> = { I: 0, A: 0, P: 0, X: 0 };
    righe.forEach(({ d }) => { if (d?.stato === "R") c[d.esito]++; });
    return c;
  }, [righe]);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSel = filtrate.length > 0 && filtrate.every((r) => sel.has(r.a.id));

  const exportCsv = () => {
    if (!pratica) return;
    const rows = [["CUAA", "Denominazione", "Stato", "Numero", "Data", "Esito", "Richiesto", "Ammesso", "Pagato", "Litri assegnati", "Quota CIA", "Quota incassata"]];
    filtrate.forEach(({ a, d }) => rows.push([
      a.cuaa, a.denominazione, STATI[d?.stato ?? "N"].label, d?.numero ?? "", d?.data_presentazione ? fmtDate(d.data_presentazione) : "",
      d?.stato === "R" ? ESITI[d.esito].label : "", String(d?.importo_richiesto ?? ""), String(d?.importo_ammesso ?? ""), String(d?.importo_pagato ?? ""),
      String(d?.litri_assegnati ?? ""), String(d?.quota_importo ?? ""), d ? (d.quota_incassata ? "SI" : "NO") : "",
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const el = document.createElement("a");
    el.href = url; el.download = `${pratica.codice ?? pratica.id}_${ufficio.id}.csv`; el.click();
    URL.revokeObjectURL(url);
  };

  if (!loading && attive.length === 0) {
    return (
      <div>
        <PageHeader title="Domande" />
        <div className="card"><Empty icon={<ClipboardList size={28} />} title="Nessuna pratica attiva" desc="Attiva o crea una pratica nella sezione Pratiche e bandi." /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Domande"
        subtitle={`Chi ha fatto la domanda e chi no, pratica per pratica · ${ufficio.nome}`}
        action={<Button size="lg" icon={<Plus size={19} strokeWidth={2.5} />} onClick={() => nuovaDomanda(pratica ? { praticaId: pratica.id } : undefined)}>Nuova domanda</Button>}
      />

      {/* card pratiche */}
      <div className="flex gap-3 overflow-x-auto -mx-2 px-2 pt-1 pb-5 -mb-2 snap-x">
        {loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[136px] w-[260px] shrink-0 !rounded-3xl" />)}
        {!loading && attive.map((p) => {
          const r = perPratica.get(p.id)!;
          const on = p.id === pratica?.id;
          const g = daysFromToday(p.scadenza);
          const fatte = r.counts.R;
          return (
            <motion.button
              key={p.id}
              onClick={() => setPid(p.id)}
              whileTap={{ scale: 0.98 }}
              className={clsx(
                "snap-start shrink-0 w-[270px] text-left rounded-3xl p-5 border-2 transition-all duration-300",
                on ? "bg-brand-800 border-brand-800 text-white shadow-[0_18px_40px_-18px_rgba(0,80,42,.8)]" : "bg-white border-ink-100 hover:border-ink-200 shadow-soft hover:shadow-card",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={clsx("text-[11px] font-bold uppercase tracking-wider", on ? "text-brand-200" : "text-ink-400")}>{p.codice ?? (p.categoria === "bando" ? "Bando" : "Annuale")}</div>
                  <div className="font-bold text-[15.5px] leading-tight mt-1 line-clamp-2 tracking-tight">{p.nome}</div>
                </div>
                {g != null && g >= 0 && g <= 45 && (
                  <span className={clsx("chip !h-6 !text-[11px] shrink-0", on ? "bg-white/15 text-white" : g <= 15 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>
                    <CalendarClock size={11} /> {g} gg
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <span className="text-[26px] font-extrabold tabular-nums tracking-tight">{fatte}</span>
                  <span className={clsx("text-sm font-semibold", on ? "text-white/60" : "text-ink-400")}> / {r.tot}</span>
                </div>
                <span className={clsx("text-[12px] font-semibold", on ? "text-white/70" : "text-ink-500")}>rilasciate</span>
              </div>
              <div className={clsx("mt-2.5 rounded-full", on && "bg-white/10 p-[2px]")}>
                <ProgressStati counts={r.counts} total={r.tot} height={6} />
              </div>
            </motion.button>
          );
        })}
      </div>

      {pratica && info && (
        <>
          {/* intestazione pratica */}
          <div className="mt-5 card p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-[13px] text-ink-500">
                  {pratica.ente && <span className="font-semibold text-ink-700">{pratica.ente}</span>}
                  {pratica.campagna && <span>· Campagna {pratica.campagna}</span>}
                  {pratica.scadenza && (
                    <span className={clsx("chip !h-6", (daysFromToday(pratica.scadenza) ?? 1) < 0 ? "bg-ink-100 text-ink-500" : "bg-amber-50 text-amber-700")}>
                      <CalendarClock size={12} /> Scadenza {fmtDate(pratica.scadenza)} · {(daysFromToday(pratica.scadenza) ?? 0) < 0 ? "chiusa" : relDays(daysFromToday(pratica.scadenza))}
                    </span>
                  )}
                </div>
                <h2 className="text-[22px] font-extrabold tracking-[-0.025em] mt-1">{pratica.nome}</h2>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {(["N", "C", "S", "R"] as StatoDomanda[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setFiltro(filtro === s ? "tutte" : s); setEsito(null); }}
                    className={clsx("rounded-2xl px-2.5 sm:px-4 py-3 text-left border-2 transition-all min-w-0 sm:min-w-[84px] active:scale-[.97]", filtro === s ? "" : "border-transparent bg-ink-50 hover:bg-ink-100")}
                    style={filtro === s ? { borderColor: STATI[s].color, background: STATI[s].color + "0F" } : undefined}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-[11.5px] font-bold whitespace-nowrap" style={{ color: STATI[s].color }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: STATI[s].color }} />{STATI[s].breve}
                    </div>
                    <div className="text-[24px] font-extrabold tabular-nums tracking-tight leading-tight mt-0.5">{info.counts[s]}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5"><ProgressStati counts={info.counts} total={info.tot} height={10} /></div>
            <div className="mt-2 text-[12.5px] text-ink-500 flex justify-between">
              <span>{info.tot} aziende abbinate</span>
              <span className="font-semibold text-ink-700">{info.tot ? Math.round((info.counts.R / info.tot) * 100) : 0}% completato</span>
            </div>
          </div>

          {/* barra filtri */}
          <div className="mt-5 flex flex-col lg:flex-row gap-3">
            <SearchInput value={q} onChange={setQ} placeholder="Cerca azienda, CUAA o numero domanda…" className="flex-1" size="lg" shortcut />
            <div className="grid grid-cols-[1fr_1fr_auto] lg:flex gap-3">
              <Select
                value={filtro}
                onChange={(v) => { setFiltro(v); if (v !== "R") setEsito(null); }}
                size="lg"
                className="min-w-0 lg:w-56"
                options={[
                  { value: "tutte", label: `Tutti gli stati (${info.tot})` },
                  ...(["N", "C", "S", "R"] as StatoDomanda[]).map((s) => ({ value: s, label: `${STATI[s].label} (${info.counts[s]})`, icon: <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATI[s].color }} /> })),
                ]}
              />
              <Select
                value={esito}
                onChange={(v) => { setEsito(v); setFiltro("R"); }}
                clearable
                onClear={() => setEsito(null)}
                placeholder="Qualsiasi esito"
                size="lg"
                className="min-w-0 lg:w-56"
                options={(["I", "A", "P", "X"] as Esito[]).map((e) => ({ value: e, label: `${ESITI[e].label} (${esitiCount[e]})`, icon: <span className="h-2.5 w-2.5 rounded-full" style={{ background: ESITI[e].color }} /> }))}
              />
              <Button variant="secondary" size="icon" className="!h-14 !w-14 !rounded-2xl shrink-0" onClick={exportCsv} title="Esporta CSV"><Download size={19} /></Button>
            </div>
          </div>

          {/* elenco */}
          <div className="mt-4 card overflow-hidden">
            <div className="flex items-center gap-4 px-5 h-12 border-b border-ink-100 bg-ink-50/60 text-[12px] font-bold uppercase tracking-wider text-ink-400">
              <Checkbox checked={allSel} indeterminate={!allSel && filtrate.some((r) => sel.has(r.a.id))} onChange={(v) => setSel(v ? new Set(filtrate.map((r) => r.a.id)) : new Set())} />
              <span className="flex-1">{filtrate.length} aziende</span>
              <span className="hidden md:block w-44">Domanda</span>
              <span className="hidden lg:block w-44">Esito / importi</span>
              <span className="w-40 text-right pr-1">Stato</span>
            </div>
            {filtrate.length === 0 ? (
              <Empty icon={<ClipboardList size={26} />} title="Nessuna azienda in questo filtro" desc={filtro === "N" ? "Ottimo: tutte le aziende abbinate hanno avviato la domanda." : "Prova a cambiare filtro o ricerca."} />
            ) : (
              <div className="divide-y divide-ink-100">
                {filtrate.slice(0, limit).map(({ a, d, motivo }, i) => (
                  <Riga key={a.id} a={a} d={d} p={pratica} i={i} selected={sel.has(a.id)} onSelect={() => toggle(a.id)} onOpen={() => apriDomanda(a.id, pratica.id)} manuale={motivo === "incluso"} />
                ))}
              </div>
            )}
            {filtrate.length > limit && (
              <div className="p-4 flex justify-center border-t border-ink-100"><Button variant="secondary" onClick={() => setLimit((l) => l + 80)}>Mostra altre</Button></div>
            )}
          </div>

          <BulkBar sel={sel} clear={() => setSel(new Set())} pratica={pratica} />
        </>
      )}
    </div>
  );
}

function Riga({ a, d, p, i, selected, onSelect, onOpen, manuale }: { a: Azienda; d?: Domanda; p: Pratica; i: number; selected: boolean; onSelect: () => void; onOpen: () => void; manuale: boolean }) {
  const st = d?.stato ?? "N";
  const pag = statoPagamento(d, p);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: Math.min(i, 15) * 0.015 } }}
      onClick={onOpen}
      className={clsx("group flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors", selected ? "bg-brand-50/70" : "hover:bg-ink-50/80")}
    >
      <Checkbox checked={selected} onChange={onSelect} />
      <span className="w-1 self-stretch rounded-full -my-1" style={{ background: STATI[st].color, opacity: st === "N" ? 0.35 : 0.9 }} />
      <Avatar name={a.denominazione} size={40} square={a.tipo === "PG"} />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[15px] tracking-tight truncate group-hover:text-brand-900 transition-colors">{titleCase(a.denominazione)}</div>
        <div className="text-[12.5px] text-ink-500 font-mono flex items-center gap-2">{a.cuaa}{manuale && <span className="font-sans chip !h-5 !px-1.5 !text-[10px] bg-ink-100 text-ink-500">aggiunta a mano</span>}</div>
      </div>
      <div className="hidden md:block w-44 text-[13px]">
        {d?.numero ? <div className="font-mono font-semibold text-ink-800 truncate">{d.numero}</div> : <div className="text-ink-300">—</div>}
        {d?.data_presentazione && <div className="text-ink-500 text-xs">{fmtDate(d.data_presentazione)}</div>}
      </div>
      <div className="hidden lg:flex w-44 flex-col items-start gap-1">
        {st === "R" ? (
          <>
            <EsitoPill esito={d!.esito} className="!h-6 !text-[11px]" />
            {p.unita === "litri" ? (d!.litri_assegnati != null && <span className="text-xs text-ink-500">{litri(d!.litri_assegnati)} assegnati</span>)
              : pag && pag !== "attesa" ? <span className="text-xs"><PagamentoPillMini stato={pag} /> {d!.importo_pagato ? eur(d!.importo_pagato) : d!.importo_ammesso ? eur(d!.importo_ammesso) : ""}</span>
                : d!.importo_richiesto ? <span className="text-xs text-ink-500">Richiesti {eur(d!.importo_richiesto)}</span> : null}
          </>
        ) : d?.importo_richiesto ? <span className="text-xs text-ink-500">Richiesti {eur(d.importo_richiesto)}</span> : <span className="text-ink-300 text-sm">—</span>}
      </div>
      <div className="w-40 flex justify-end" onClick={(e) => e.stopPropagation()}>
        <QuickStato a={a} p={p} stato={st} />
      </div>
    </motion.div>
  );
}

function PagamentoPillMini({ stato }: { stato: NonNullable<ReturnType<typeof statoPagamento>> }) {
  return <span className="font-semibold text-ink-700">{stato === "pagata" ? "Pagata" : stato === "parziale" ? "Parziale" : stato === "non_pagata" ? "Da pagare" : ""}</span>;
}

const QUICK_ICON: Record<StatoDomanda, React.ReactNode> = { N: <Undo2 size={16} />, C: <PenLine size={16} />, S: <Printer size={16} />, R: <Send size={16} /> };

/** Pillola stato cliccabile: cambio rapido senza aprire la domanda. */
function QuickStato({ a, p, stato }: { a: Azienda; p: Pratica; stato: StatoDomanda }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const salva = useSalvaDomanda();
  const multi = useStatoMultiplo();
  const { toast } = useFeedback();
  const change = async (s: StatoDomanda) => {
    setOpen(false);
    if (s === stato) return;
    try {
      if (s === "N") await multi.mutateAsync({ pratica_id: p.id, aziende: [a.id], stato: "N" });
      else await salva.mutateAsync({ azienda_id: a.id, pratica_id: p.id, stato: s });
      toast("success", STATI[s].label, titleCase(a.denominazione), { label: "Annulla", onClick: () => {
        if (stato === "N") multi.mutate({ pratica_id: p.id, aziende: [a.id], stato: "N" });
        else salva.mutate({ azienda_id: a.id, pratica_id: p.id, stato });
      } });
    } catch (e) { toast("error", "Errore", (e as Error).message); }
  };
  const busy = salva.isPending || multi.isPending;
  return (
    <>
      <button ref={ref} onClick={() => setOpen((o) => !o)} className={clsx("group/st inline-flex items-center gap-1 rounded-full transition-all", busy && "opacity-50")}>
        <StatoPill stato={stato} className="group-hover/st:ring-2 transition-shadow" />
        <ChevronDown size={14} className={clsx("text-ink-400 transition-transform", open && "rotate-180")} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={ref} align="end" minWidth={230}>
        <div className="p-1.5">
          <div className="px-3 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">Cambia stato</div>
          {(["C", "S", "R", "N"] as StatoDomanda[]).map((s) => (
            <button key={s} onClick={() => change(s)} className={clsx("w-full flex items-center gap-3 px-3 h-11 rounded-xl text-[14px] font-semibold transition-colors hover:bg-ink-50", s === stato && "bg-ink-50")}>
              <span className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: STATI[s].color + "18", color: STATI[s].color }}>{QUICK_ICON[s]}</span>
              <span className="flex-1 text-left">{s === "N" ? "Segna come non fatta" : STATI[s].label}</span>
              {s === stato && <Check size={16} className="text-brand-600" />}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

function BulkBar({ sel, clear, pratica }: { sel: Set<string>; clear: () => void; pratica: Pratica }) {
  const multi = useStatoMultiplo();
  const abb = useAbbina();
  const { toast, confirm } = useFeedback();
  const ids = [...sel];
  const run = async (s: StatoDomanda) => {
    if (s === "N" && !(await confirm({ title: `Riportare ${ids.length} aziende a «Non fatta»?`, message: "Le domande selezionate verranno rimosse con i loro dati.", danger: true, confirmLabel: "Conferma" }))) return;
    try { await multi.mutateAsync({ pratica_id: pratica.id, aziende: ids, stato: s }); toast("success", `${ids.length} domande aggiornate`, STATI[s].label); clear(); }
    catch (e) { toast("error", "Errore", (e as Error).message); }
  };
  const escludi = async () => {
    if (!(await confirm({ title: `Escludere ${ids.length} aziende da ${pratica.nome}?`, message: "Non compariranno più tra le aziende da seguire per questa pratica (le domande già avviate restano).", confirmLabel: "Escludi" }))) return;
    await abb.mutateAsync({ pratica_id: pratica.id, aziende: ids, tipo: "escluso" });
    toast("info", "Aziende escluse dalla pratica");
    clear();
  };
  return (
    <AnimatePresence>
      {sel.size > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 lg:ml-[132px] z-40 bg-ink-900 text-white rounded-[22px] shadow-pop pl-5 pr-2 py-2 flex items-center gap-2 max-w-[calc(100vw-24px)] overflow-x-auto"
        >
          <span className="font-bold text-[14px] whitespace-nowrap pr-2">{sel.size} selezionate</span>
          <span className="h-6 w-px bg-white/15" />
          {(["C", "S", "R"] as StatoDomanda[]).map((s) => (
            <button key={s} disabled={multi.isPending} onClick={() => run(s)} className="h-11 px-3.5 rounded-xl text-[13.5px] font-semibold flex items-center gap-2 hover:bg-white/10 transition whitespace-nowrap">
              <span className="h-2 w-2 rounded-full" style={{ background: STATI[s].color }} />{STATI[s].label}
            </button>
          ))}
          <button onClick={() => run("N")} className="h-11 px-3.5 rounded-xl text-[13.5px] font-semibold flex items-center gap-2 hover:bg-white/10 transition whitespace-nowrap"><Undo2 size={15} /> Non fatta</button>
          <button onClick={escludi} className="h-11 px-3.5 rounded-xl text-[13.5px] font-semibold flex items-center gap-2 hover:bg-white/10 transition whitespace-nowrap text-white/70"><Ban size={15} /> Escludi</button>
          <button onClick={clear} className="h-11 w-11 rounded-xl grid place-items-center hover:bg-white/10 transition shrink-0" aria-label="Deseleziona"><X size={18} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

