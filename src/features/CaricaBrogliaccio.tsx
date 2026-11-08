import { motion } from "framer-motion";
import { AlertTriangle, Check, FileSpreadsheet, Sprout, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Checkbox, Toggle } from "../components/ui/Inputs";
import { Select } from "../components/ui/Select";
import { Spinner } from "../components/ui/Spinner";
import { useFeedback } from "../components/ui/Feedback";
import { useUfficio } from "../lib/ufficio";
import { COLORI_COLTURE } from "../lib/domain";
import { ha, titleCase } from "../lib/format";
import { leggiExcel, type Foglio } from "../lib/excel";
import { categoriaPer, leggiBrogliaccio, type LetturaBrogliaccio, type Unita } from "../lib/brogliaccio";
import { chiaveCuaa } from "../lib/riscontro";
import { useApplicaBrogliaccio, type VoceBrogliaccio } from "../lib/queries";
import type { Azienda } from "../lib/types";

const NUOVA = "__nuova";
interface Scelta { incluso: boolean; target: string }

/** Carica il brogliaccio dell'azienda e ricava colture e superfici. */
export function CaricaBrogliaccio({ open, onClose, azienda }: { open: boolean; onClose: () => void; azienda: Azienda }) {
  const { colture } = useUfficio();
  const applica = useApplicaBrogliaccio();
  const { toast } = useFeedback();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fogli, setFogli] = useState<Foglio[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [lettura, setLettura] = useState(false);
  const [unita, setUnita] = useState<Unita | null>(null);
  const [scelte, setScelte] = useState<Record<string, Scelta>>({});
  const [sostituisci, setSostituisci] = useState(true);
  const [aggiornaSau, setAggiornaSau] = useState(true);
  const [archivia, setArchivia] = useState(true);
  const [drag, setDrag] = useState(false);

  useEffect(() => { if (open) { setFile(null); setFogli(null); setErrore(null); setUnita(null); setScelte({}); setSostituisci(true); setAggiornaSau(true); setArchivia(true); } }, [open]);

  const l: LetturaBrogliaccio | null = useMemo(() => (fogli ? leggiBrogliaccio(fogli, colture, unita ?? undefined) : null), [fogli, colture, unita]);
  // proposta iniziale per ogni gruppo
  useEffect(() => {
    if (!l) return;
    setScelte((s) => Object.fromEntries(l.gruppi.map((g) => [g.chiave, s[g.chiave] ?? { incluso: !g.nonColtivato, target: g.colturaId ?? NUOVA }])));
  }, [l]);

  const carica = async (f: File | undefined) => {
    if (!f) return;
    setFile(f); setErrore(null); setLettura(true);
    try { setFogli(await leggiExcel(f)); } catch (e) { setErrore("Impossibile leggere il file: " + (e as Error).message); setFogli(null); }
    finally { setLettura(false); }
  };

  const inclusi = l ? l.gruppi.filter((g) => scelte[g.chiave]?.incluso) : [];
  const totale = inclusi.reduce((s, g) => s + g.superficie, 0);
  const cuaaDiverso = l && l.cuaa.length > 0 && !l.cuaa.some((c) => chiaveCuaa(c) === chiaveCuaa(azienda.cuaa));
  const nuove = new Set(inclusi.filter((g) => scelte[g.chiave]?.target === NUOVA).map((g) => g.descrizione.toLowerCase())).size;

  const salva = async () => {
    if (!l || !file) return;
    const voci: VoceBrogliaccio[] = inclusi.map((g, i) => {
      const t = scelte[g.chiave].target;
      const nome = titleCase(g.descrizione).slice(0, 60);
      return t === NUOVA
        ? { coltura_id: null, nuova: { nome, categoria: categoriaPer(g.descrizione), colore: COLORI_COLTURE[(colture.length + i) % COLORI_COLTURE.length] }, superficie_ha: g.superficie, varieta: g.varieta.join(", ") || null }
        : { coltura_id: t, superficie_ha: g.superficie, varieta: g.varieta.join(", ") || null };
    });
    try {
      const r = await applica.mutateAsync({ azienda_id: azienda.id, voci, sostituisci, sau: aggiornaSau ? totale : null, archivia: archivia ? { file, titolo: `Brogliaccio · ${file.name}` } : undefined });
      toast("success", `${r.colture} colture salvate`, `${ha(totale)} in totale${r.nuove ? ` · ${r.nuove} nuove nel catalogo` : ""}`);
      onClose();
    } catch (e) { toast("error", "Salvataggio non riuscito", (e as Error).message); }
  };

  const opzioni = useMemo(() => [
    { value: NUOVA, label: "Nuova coltura (la aggiungo al catalogo)", group: " " },
    ...colture.map((c) => ({ value: c.id, label: c.nome, hint: c.categoria, group: c.categoria, icon: <span className="h-3 w-3 rounded-full" style={{ background: c.colore }} /> })).sort((x, y) => x.group.localeCompare(y.group)),
  ], [colture]);

  return (
    <Modal open={open} onClose={() => { if (!applica.isPending) onClose(); }} size="xl" icon={<Sprout size={22} />} title="Carica il brogliaccio" subtitle={`${titleCase(azienda.denominazione)} · colture e superfici dal fascicolo`}
      footer={l && l.gruppi.length > 0 ? (
        <>
          <div className="text-[13.5px] text-ink-600 flex-1"><b className="text-ink-900 tabular-nums">{ha(totale)}</b> in {inclusi.length} colture{nuove ? ` · ${nuove} nuove nel catalogo` : ""}</div>
          <Button variant="secondary" size="lg" onClick={onClose}>Annulla</Button>
          <Button size="lg" icon={<Check size={18} strokeWidth={2.5} />} onClick={salva} loading={applica.isPending} disabled={!inclusi.length}>Salva le colture</Button>
        </>
      ) : undefined}>
      {!l ? (
        <div className="space-y-4">
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); carica(e.dataTransfer.files[0]); }}
            onClick={() => input.current?.click()} animate={{ scale: drag ? 1.015 : 1 }}
            className={clsx("cursor-pointer rounded-3xl border-2 border-dashed text-center p-12 transition-colors", drag ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/40")}>
            <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center mb-4">{lettura ? <Spinner size={26} className="text-brand-700" /> : <UploadCloud size={30} />}</div>
            <div className="font-bold text-lg">{lettura ? "Leggo il file…" : "Trascina qui il brogliaccio in Excel"}</div>
            <div className="text-sm text-ink-500 mt-1">oppure <span className="text-brand-700 font-semibold">sfoglia</span> · riconosco coltura e superficie (ettari, metri quadri o ha.aa.ca)</div>
          </motion.div>
          <input ref={input} type="file" accept=".xlsx,.xls,.xlsm,.csv,.ods" className="hidden" onChange={(e) => { carica(e.target.files?.[0]); e.target.value = ""; }} />
          {errore && <div className="text-sm text-red-700 flex gap-2"><AlertTriangle size={16} />{errore}</div>}
        </div>
      ) : (
        <div className="space-y-5">
          {/* file e colonne riconosciute */}
          <div className="rounded-2xl ring-1 ring-ink-100 p-4 flex flex-wrap items-center gap-3">
            <span className="h-11 w-11 rounded-xl bg-green-50 text-green-700 grid place-items-center"><FileSpreadsheet size={22} /></span>
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold truncate">{file?.name}</div>
              <div className="text-xs text-ink-500">
                {l.analisi ? `foglio «${l.analisi.foglio}» · ${l.righe} righe` : ""}
                {l.analisi?.mappa.coltura && <> · coltura da «{l.analisi.intestazioni[l.analisi.mappa.coltura.col]}»</>}
                {l.colonnaSuperficie && <> · superficie da «{l.colonnaSuperficie.intestazione}»</>}
              </div>
            </div>
            {l.colonnaSuperficie && (
              <Select size="sm" className="w-44" value={l.colonnaSuperficie.unita} onChange={(v) => setUnita(v as Unita)} options={[
                { value: "ha", label: "In ettari" }, { value: "mq", label: "In metri quadri" }, { value: "haaaca", label: "In ha.aa.ca" },
              ]} />
            )}
            <Button variant="ghost" size="sm" onClick={() => { setFogli(null); setFile(null); }}>Cambia file</Button>
          </div>
          {cuaaDiverso && (
            <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-[13.5px] text-amber-900 flex gap-2">
              <AlertTriangle size={17} className="shrink-0 mt-0.5" />
              <span>Nel file c'è il CUAA <b className="font-mono">{l.cuaa.join(", ")}</b>, diverso da quello dell'azienda (<span className="font-mono">{azienda.cuaa}</span>). Controlla che sia il brogliaccio giusto.</span>
            </div>
          )}
          {l.avvisi.map((w) => <div key={w} className="text-[13px] text-amber-800 flex gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{w}</div>)}

          {l.gruppi.length === 0 ? (
            <div className="text-center py-10 text-ink-500">Non ho trovato righe con coltura e superficie. Controlla che il file sia il brogliaccio.</div>
          ) : (
            <div className="rounded-2xl ring-1 ring-ink-100 divide-y divide-ink-100">
              <div className="px-4 h-10 flex items-center gap-3 text-[12px] font-bold uppercase tracking-wider text-ink-400 bg-ink-50/60 rounded-t-2xl">
                <span className="w-5" /><span className="flex-1">Nel brogliaccio</span><span className="w-28 text-right">Superficie</span><span className="hidden md:block w-72">Coltura</span>
              </div>
              {l.gruppi.map((g) => {
                const s = scelte[g.chiave] ?? { incluso: !g.nonColtivato, target: g.colturaId ?? NUOVA };
                const set = (x: Partial<Scelta>) => setScelte((all) => ({ ...all, [g.chiave]: { ...s, ...x } }));
                return (
                  <div key={g.chiave} className={clsx("px-4 py-3 flex flex-wrap md:flex-nowrap items-center gap-3", !s.incluso && "opacity-55")}>
                    <Checkbox checked={s.incluso} onChange={(v) => set({ incluso: v })} />
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-semibold text-[14px]">{g.descrizione}</div>
                      <div className="text-[12px] text-ink-500">{g.particelle} {g.particelle === 1 ? "riga" : "righe"}{g.varieta.length ? ` · ${g.varieta.join(", ")}` : ""}{g.nonColtivato ? " · superficie non coltivata" : ""}</div>
                    </div>
                    <div className="w-28 text-right font-bold tabular-nums">{ha(g.superficie)}</div>
                    <Select size="sm" className="w-full md:w-72" value={s.target} onChange={(v) => set({ target: v, incluso: true })} searchable options={opzioni} menuMinWidth={300} />
                  </div>
                );
              })}
            </div>
          )}

          {l.gruppi.length > 0 && (
            <div className="grid md:grid-cols-3 gap-2.5">
              <Opzione on={sostituisci} set={setSostituisci} titolo="Sostituisci le colture attuali" desc={sostituisci ? "Tolgo quelle che non sono nel brogliaccio" : "Aggiorno solo quelle del brogliaccio"} />
              <Opzione on={aggiornaSau} set={setAggiornaSau} titolo={`SAU a ${ha(totale)}`} desc={`Ora: ${ha(azienda.sau_ha)}`} />
              <Opzione on={archivia} set={setArchivia} titolo="Archivia il file" desc="Nei documenti, come piano di coltivazione" />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Opzione({ on, set, titolo, desc }: { on: boolean; set: (v: boolean) => void; titolo: string; desc: string }) {
  return (
    <div onClick={() => set(!on)} className={clsx("flex items-center gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer transition-colors", on ? "border-brand-300 bg-brand-50/50" : "border-ink-100")}>
      <Toggle checked={on} onChange={set} size="sm" />
      <div className="min-w-0"><div className="font-bold text-[13.5px] truncate">{titolo}</div><div className="text-[12px] text-ink-500 truncate">{desc}</div></div>
    </div>
  );
}
