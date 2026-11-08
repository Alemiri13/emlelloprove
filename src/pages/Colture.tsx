import { motion } from "framer-motion";
import { Check, ChevronRight, Pencil, Plus, Sprout, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useModals, useUfficio } from "../lib/ufficio";
import { CATEGORIE_COLTURE, COLORI_COLTURE } from "../lib/domain";
import { ha, normalizeSearch, titleCase } from "../lib/format";
import { useEliminaColtura, useSalvaColtura } from "../lib/queries";
import { Button } from "../components/ui/Button";
import { Field, SearchInput, TextInput } from "../components/ui/Inputs";
import { Segmented } from "../components/ui/Segmented";
import { Modal } from "../components/ui/Modal";
import { Avatar, Empty } from "../components/ui/Misc";
import { useFeedback } from "../components/ui/Feedback";
import { PageHeader } from "./Anagrafica";
import type { Coltura } from "../lib/types";

export function ColturePage() {
  const { colture, aziende, ufficio } = useUfficio();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("tutte");
  const [edit, setEdit] = useState<Coltura | "new" | null>(null);
  const [detail, setDetail] = useState<Coltura | null>(null);

  const stats = useMemo(() => {
    const m = new Map<string, { n: number; ha: number }>();
    for (const a of aziende) for (const c of a.azienda_colture ?? []) {
      const s = m.get(c.coltura_id) ?? { n: 0, ha: 0 };
      s.n++; s.ha += c.superficie_ha ?? 0;
      m.set(c.coltura_id, s);
    }
    return m;
  }, [aziende]);

  const totHa = useMemo(() => [...stats.values()].reduce((s, x) => s + x.ha, 0), [stats]);

  const list = useMemo(() => {
    const n = normalizeSearch(q);
    return colture
      .filter((c) => (cat === "tutte" || c.categoria === cat) && (!n || normalizeSearch(c.nome).includes(n)))
      .sort((a, b) => (stats.get(b.id)?.ha ?? 0) - (stats.get(a.id)?.ha ?? 0) || a.nome.localeCompare(b.nome));
  }, [colture, cat, q, stats]);

  const cats = CATEGORIE_COLTURE.filter((c) => colture.some((x) => x.categoria === c));

  return (
    <div>
      <PageHeader
        title="Colture"
        subtitle={`Cosa si coltiva nelle aziende dell'ufficio di ${ufficio.nome}`}
        action={<Button size="lg" icon={<Plus size={19} strokeWidth={2.5} />} onClick={() => setEdit("new")}>Nuova coltura</Button>}
      />

      {/* composizione */}
      {totHa > 0 && (
        <div className="card p-6 mb-6">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-[13px] text-ink-500 font-medium">Superficie coltivata nell'ufficio</div>
              <div className="text-[28px] font-extrabold tracking-tight tabular-nums">{ha(totHa)}</div>
            </div>
          </div>
          <div className="h-4 rounded-full overflow-hidden flex gap-[2px] bg-ink-100">
            {list.filter((c) => stats.get(c.id)?.ha).map((c) => (
              <motion.button
                key={c.id}
                onClick={() => setDetail(c)}
                title={`${c.nome} · ${ha(stats.get(c.id)!.ha)}`}
                initial={{ width: 0 }}
                animate={{ width: `${(stats.get(c.id)!.ha / totHa) * 100}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="h-full hover:brightness-110 transition"
                style={{ background: c.colore }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
            {list.filter((c) => stats.get(c.id)?.ha).slice(0, 8).map((c) => (
              <span key={c.id} className="text-[13px] text-ink-600 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.colore }} />{c.nome}
                <span className="font-bold text-ink-800 tabular-nums">{Math.round((stats.get(c.id)!.ha / totHa) * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <SearchInput value={q} onChange={setQ} placeholder="Cerca coltura…" size="lg" className="lg:w-80" />
        <div className="overflow-x-auto">
          <Segmented value={cat} onChange={setCat} size="lg" options={[{ value: "tutte", label: "Tutte" }, ...cats.map((c) => ({ value: c, label: c }))]} />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card"><Empty icon={<Sprout size={28} />} title="Nessuna coltura" action={<Button icon={<Plus size={18} />} onClick={() => setEdit("new")}>Aggiungi coltura</Button>} /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((c, i) => {
            const s = stats.get(c.id);
            return (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.03 } }}
                whileHover={{ y: -3 }}
                onClick={() => setDetail(c)}
                className="group relative text-left card p-6 hover:shadow-lift transition-shadow duration-300 overflow-hidden"
              >
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[0.10] group-hover:opacity-20 group-hover:scale-125 transition-all duration-500" style={{ background: c.colore }} />
                <div className="relative flex items-start justify-between">
                  <span className="h-14 w-14 rounded-2xl grid place-items-center" style={{ background: c.colore + "1F", color: c.colore }}><Sprout size={26} /></span>
                  <span className="chip bg-ink-50 text-ink-500">{c.categoria}</span>
                </div>
                <div className="relative mt-6 text-[21px] font-extrabold tracking-[-0.025em]">{c.nome}</div>
                <div className="relative mt-4 flex items-end justify-between">
                  <div className="flex gap-6">
                    <div><div className="text-[20px] font-bold tabular-nums">{s?.n ?? 0}</div><div className="text-xs text-ink-500">aziende</div></div>
                    <div><div className="text-[20px] font-bold tabular-nums">{s ? ha(s.ha) : "—"}</div><div className="text-xs text-ink-500">superficie</div></div>
                  </div>
                  <ChevronRight size={20} className="text-ink-300 group-hover:text-brand-700 group-hover:translate-x-1 transition-all" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <ColturaEditor value={edit} onClose={() => setEdit(null)} />
      <ColturaDetail c={detail} onClose={() => setDetail(null)} onEdit={(c) => { setDetail(null); setEdit(c); }} />
    </div>
  );
}

function ColturaDetail({ c, onClose, onEdit }: { c: Coltura | null; onClose: () => void; onEdit: (c: Coltura) => void }) {
  const { aziende } = useUfficio();
  const { apriAzienda } = useModals();
  const [last, setLast] = useState(c);
  useEffect(() => { if (c) setLast(c); }, [c]);
  const x = c ?? last;
  const rows = useMemo(() => x ? aziende.flatMap((a) => (a.azienda_colture ?? []).filter((ac) => ac.coltura_id === x.id).map((ac) => ({ a, ha: ac.superficie_ha }))).sort((p, q) => (q.ha ?? 0) - (p.ha ?? 0)) : [], [x, aziende]);
  return (
    <Modal open={!!c} onClose={onClose} size="md" title={x?.nome} subtitle={`${x?.categoria} · ${rows.length} aziende in questo ufficio`}
      icon={x && <Sprout size={22} style={{ color: x.colore }} />}
      footer={x && <><div className="flex-1" /><Button variant="secondary" icon={<Pencil size={16} />} onClick={() => onEdit(x)}>Modifica coltura</Button></>}
    >
      {rows.length === 0 ? <Empty icon={<Sprout size={26} />} title="Nessuna azienda" desc="Nessuna azienda di questo ufficio la coltiva." /> : (
        <div className="space-y-2">
          {rows.map(({ a, ha: h }) => (
            <button key={a.id} onClick={() => { onClose(); setTimeout(() => apriAzienda(a.id, "colture"), 200); }} className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-ink-50 transition text-left">
              <Avatar name={a.denominazione} size={38} square={a.tipo === "PG"} />
              <span className="flex-1 min-w-0"><span className="block font-semibold truncate">{titleCase(a.denominazione)}</span><span className="block text-xs text-ink-500">{a.comune ?? a.cuaa}</span></span>
              <span className="font-bold tabular-nums">{ha(h)}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ColturaEditor({ value, onClose }: { value: Coltura | "new" | null; onClose: () => void }) {
  const salva = useSalvaColtura();
  const elimina = useEliminaColtura();
  const { toast, confirm } = useFeedback();
  const [nome, setNome] = useState("");
  const [cat, setCat] = useState<string>("Arboree");
  const [col, setCol] = useState(COLORI_COLTURE[0]);
  const isNew = value === "new";
  useEffect(() => {
    if (value === "new") { setNome(""); setCat("Arboree"); setCol(COLORI_COLTURE[Math.floor(Math.random() * COLORI_COLTURE.length)]); }
    else if (value) { setNome(value.nome); setCat(value.categoria); setCol(value.colore); }
  }, [value]);

  const save = async () => {
    if (!nome.trim()) return;
    try {
      await salva.mutateAsync({ id: isNew ? undefined : (value as Coltura).id, nome: nome.trim(), categoria: cat, colore: col });
      toast("success", isNew ? "Coltura aggiunta" : "Coltura aggiornata", nome.trim());
      onClose();
    } catch (e) { toast("error", "Errore", (e as Error).message); }
  };
  const del = async () => {
    if (!value || isNew) return;
    if (!(await confirm({ title: `Eliminare «${value.nome}»?`, danger: true, confirmLabel: "Elimina" }))) return;
    try { await elimina.mutateAsync(value.id); toast("success", "Coltura eliminata"); onClose(); } catch (e) { toast("error", "Non eliminabile", (e as Error).message); }
  };

  return (
    <Modal
      open={!!value}
      onClose={onClose}
      size="md"
      title={isNew ? "Nuova coltura" : "Modifica coltura"}
      subtitle="Il catalogo delle colture è comune a tutti gli uffici."
      icon={<Sprout size={22} />}
      footer={
        <>
          {!isNew && <Button variant="ghost" className="!text-red-600 hover:!bg-red-50" icon={<Trash2 size={16} />} onClick={del}>Elimina</Button>}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>Annulla</Button>
          <Button onClick={save} loading={salva.isPending} disabled={!nome.trim()}>{isNew ? "Aggiungi" : "Salva"}</Button>
        </>
      }
    >
      <div className="space-y-6 pt-1">
        <Field label="Nome"><TextInput size="lg" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Vite da vino" onKeyDown={(e) => e.key === "Enter" && save()} /></Field>
        <div>
          <span className="label">Categoria</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIE_COLTURE.map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)} className={clsx("h-12 rounded-xl border-2 text-[14px] font-semibold transition-all active:scale-[.97]", cat === c ? "border-brand-500 bg-brand-50 text-brand-900" : "border-ink-100 text-ink-600 hover:border-ink-200")}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Colore</span>
          <div className="flex flex-wrap gap-2.5">
            {COLORI_COLTURE.map((c) => (
              <button key={c} type="button" onClick={() => setCol(c)} className={clsx("h-11 w-11 rounded-full grid place-items-center transition-all", col === c ? "scale-110 ring-4 ring-offset-2" : "hover:scale-105")} style={{ background: c, ["--tw-ring-color" as string]: c + "55" }}>
                {col === c && <Check size={18} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-ink-50 p-4 flex items-center gap-3">
          <span className="h-12 w-12 rounded-xl grid place-items-center" style={{ background: col + "22", color: col }}><Sprout size={22} /></span>
          <div><div className="font-bold">{nome || "Anteprima"}</div><div className="text-xs text-ink-500">{cat}</div></div>
        </div>
      </div>
    </Modal>
  );
}
