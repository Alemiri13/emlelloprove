import { motion } from "framer-motion";
import { Check, FilePlus2, PenLine, Printer, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Wizard } from "../components/ui/Wizard";
import { ChoiceCard, Field, NumberInput, SearchInput, TextInput } from "../components/ui/Inputs";
import { DatePicker } from "../components/ui/DatePicker";
import { Avatar, Badge, StatoPill } from "../components/ui/Misc";
import { useFeedback } from "../components/ui/Feedback";
import { abbinate, STATI } from "../lib/domain";
import { eur, fmtDate, litri as fmtLitri, normalizeSearch, relDays, daysFromToday, titleCase, todayISO } from "../lib/format";
import { useSalvaDomanda } from "../lib/queries";
import { useModals, useUfficio } from "../lib/ufficio";
import type { StatoDomanda } from "../lib/types";
import { Riga } from "./NuovaAziendaWizard";
import { sigla } from "../pages/Pratiche";

export function NuovaDomandaWizard({ state, onClose }: { state: { aziendaId?: string; praticaId?: string } | null; onClose: () => void }) {
  const { aziende, pratiche, azById, praticaById, domandaByKey, abbinamenti, domande, ufficio } = useUfficio();
  const { apriDomanda } = useModals();
  const salva = useSalvaDomanda();
  const { toast } = useFeedback();
  const [step, setStep] = useState(0);
  const [az, setAz] = useState<string | null>(null);
  const [pr, setPr] = useState<string | null>(null);
  const [stato, setStato] = useState<StatoDomanda | null>(null);
  const [numero, setNumero] = useState("");
  const [data, setData] = useState<string | null>(null);
  const [importo, setImporto] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const skipAz = !!state?.aziendaId;
  useEffect(() => {
    if (state) {
      setAz(state.aziendaId ?? null); setPr(state.praticaId ?? null); setStato(null); setNumero(""); setData(null); setImporto(null); setQ("");
      setStep(0);
    }
  }, [state]);

  const azienda = az ? azById.get(az) : undefined;
  const pratica = pr ? praticaById.get(pr) : undefined;

  const listaAz = useMemo(() => {
    const n = normalizeSearch(q.trim());
    const base = pratica ? [...abbinate(aziende, pratica, abbinamenti, domande).keys()].map((id) => azById.get(id)!).filter(Boolean) : aziende;
    const l = n ? base.filter((a) => normalizeSearch(a.denominazione + " " + a.cuaa).includes(n)) : base;
    return l.slice(0, 50);
  }, [q, aziende, pratica, abbinamenti, domande, azById]);

  const finish = async () => {
    if (!az || !pr || !stato) return;
    try {
      await salva.mutateAsync({
        azienda_id: az, pratica_id: pr, stato, numero: numero.trim() || null,
        data_presentazione: data ?? (stato === "R" ? todayISO() : null),
        ...(pratica?.unita === "litri" ? { litri_richiesti: importo == null ? null : Math.round(importo) } : { importo_richiesto: importo }),
      });
      toast("success", "Domanda registrata", `${titleCase(azienda!.denominazione)} · ${STATI[stato].label}`);
      onClose();
    } catch (e) { toast("error", "Errore", (e as Error).message); }
  };

  const stepAzienda = {
    key: "azienda", title: "Azienda", question: "Per quale azienda?", hint: pratica ? `Aziende abbinate a ${pratica.nome}` : `Aziende dell'ufficio di ${ufficio.nome}`, canNext: !!az,
    content: (
      <div>
        <SearchInput value={q} onChange={setQ} placeholder="Cerca per nome o CUAA…" size="lg" autoFocus />
        <div className="mt-4 space-y-2 max-h-[34vh] overflow-y-auto -mx-1 px-1 pb-1">
          {listaAz.map((a) => {
            const on = az === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => { setAz(a.id); setStep(step + 1); }}
                className={clsx("w-full flex items-center gap-3.5 rounded-2xl border-2 px-4 py-3 text-left transition-all active:scale-[.99]", on ? "border-brand-500 bg-brand-50/60" : "border-ink-100 hover:border-ink-200")}
              >
                <Avatar name={a.denominazione} size={40} square={a.tipo === "PG"} />
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">{titleCase(a.denominazione)}</span>
                  <span className="block text-xs font-mono text-ink-500">{a.cuaa}</span>
                </span>
                {pratica && domandaByKey.get(a.id + "|" + pratica.id) && <StatoPill stato={domandaByKey.get(a.id + "|" + pratica.id)!.stato} size="sm" />}
                {on && <span className="h-6 w-6 rounded-full bg-brand-600 grid place-items-center"><Check size={14} className="text-white" strokeWidth={3} /></span>}
              </button>
            );
          })}
          {listaAz.length === 0 && <div className="text-center text-ink-400 py-10">Nessuna azienda trovata</div>}
        </div>
      </div>
    ),
  };

  const stepPratica = {
    key: "pratica", title: "Pratica", question: "Quale pratica?", hint: azienda ? titleCase(azienda.denominazione) : undefined, canNext: !!pr,
    content: (
      <div className="grid sm:grid-cols-2 gap-3">
        {pratiche.filter((p) => p.attivo).map((p) => {
          const d = az ? domandaByKey.get(az + "|" + p.id) : undefined;
          const g = daysFromToday(p.scadenza);
          return (
            <ChoiceCard
              key={p.id}
              selected={pr === p.id}
              onClick={() => {
                if (d && az) { onClose(); setTimeout(() => apriDomanda(az, p.id), 220); return; }
                setPr(p.id); setStep(step + 1);
              }}
              icon={<span className="text-[11px] font-extrabold">{sigla(p)}</span>}
              title={p.nome}
              desc={
                <span className="flex items-center gap-2 flex-wrap mt-1">
                  {d ? <StatoPill stato={d.stato} size="sm" /> : p.scadenza ? <span className={clsx(g != null && g >= 0 && g <= 15 && "text-red-600 font-semibold")}>Scade {fmtDate(p.scadenza)}{g != null && g >= 0 ? ` · ${relDays(g)}` : ""}</span> : <span>{p.ente ?? (p.categoria === "bando" ? "Bando" : "Annuale")}</span>}
                  {d && <span className="text-ink-400">· tocca per modificarla</span>}
                </span>
              }
            />
          );
        })}
      </div>
    ),
  };

  const stepStato = {
    key: "stato", title: "Stato", question: "A che punto è?", canNext: !!stato,
    content: (
      <div className="grid gap-3">
        {([["C", <PenLine size={22} key="c" />], ["S", <Printer size={22} key="s" />], ["R", <Send size={22} key="r" />]] as const).map(([k, icon]) => (
          <ChoiceCard key={k} selected={stato === k} onClick={() => { setStato(k); setStep(step + 1); }} icon={icon} title={STATI[k].label} desc={STATI[k].desc} color={STATI[k].color} className="!p-5" />
        ))}
      </div>
    ),
  };

  const stepDettagli = {
    key: "dettagli", title: "Dettagli", question: "Hai già qualche dato?", hint: "Tutto facoltativo: puoi completarlo in seguito.", optional: true,
    content: (
      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="Numero domanda"><TextInput autoFocus value={numero} onChange={(e) => setNumero(e.target.value)} className="font-mono" placeholder={pratica?.codice ? `${pratica.codice}-…` : ""} /></Field>
        <Field label="Data di presentazione"><DatePicker value={data} onChange={setData} /></Field>
        {pratica?.unita === "litri" ? (
          <Field label="Litri richiesti"><NumberInput value={importo} onChange={setImporto} suffix="L" decimals={0} /></Field>
        ) : pratica?.ha_contributo ? (
          <Field label="Importo richiesto"><NumberInput value={importo} onChange={setImporto} suffix="€" /></Field>
        ) : null}
      </div>
    ),
  };

  const goto = (k: string) => setStep(finalSteps.findIndex((x) => x.key === k));
  const has = (k: string) => (k === "azienda" ? !skipAz : k === "pratica" ? !(state?.praticaId && !skipAz) : true);

  const stepRiepilogo = {
    key: "riepilogo", title: "Riepilogo", question: "Registriamo la domanda?",
    content: (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl border border-ink-100 divide-y divide-ink-100">
        <Riga label="Azienda" value={azienda ? titleCase(azienda.denominazione) : "—"} onEdit={has("azienda") ? () => goto("azienda") : undefined} />
        <Riga label="Pratica" value={pratica?.nome ?? "—"} onEdit={has("pratica") ? () => goto("pratica") : undefined} />
        <Riga label="Stato" value={stato ? <StatoPill stato={stato} /> : "—"} onEdit={() => goto("stato")} />
        <Riga label="Numero" value={numero || "—"} />
        <Riga label="Data" value={data ? fmtDate(data) : stato === "R" ? `${fmtDate(todayISO())} (oggi)` : "—"} />
        {importo != null && <Riga label={pratica?.unita === "litri" ? "Litri" : "Importo"} value={pratica?.unita === "litri" ? fmtLitri(importo) : eur(importo)} />}
        {stato === "R" && pratica?.quota_default != null && <Riga label="Quota CIA" value={<span className="flex items-center gap-2">{eur(pratica.quota_default)} <Badge>da incassare</Badge></span>} />}
      </motion.div>
    ),
  };

  const steps = skipAz ? [stepPratica, stepStato, stepDettagli, stepRiepilogo] : [stepAzienda, stepPratica, stepStato, stepDettagli, stepRiepilogo];
  // se la pratica è già scelta (dalla pagina Domande) e manca l'azienda, si parte dall'azienda e si salta la pratica
  const finalSteps = state?.praticaId && !skipAz ? [stepAzienda, stepStato, stepDettagli, stepRiepilogo] : steps;

  return (
    <Wizard
      open={!!state}
      onClose={onClose}
      steps={finalSteps}
      index={Math.min(step, finalSteps.length - 1)}
      setIndex={setStep}
      title="Nuova domanda"
      icon={<FilePlus2 size={20} />}
      onFinish={finish}
      loading={salva.isPending}
      finishLabel="Registra domanda"
    />
  );
}
