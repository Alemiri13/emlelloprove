import { motion } from "framer-motion";
import { FileSpreadsheet, UploadCloud, X, Check, AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";
import clsx from "clsx";
import { Select } from "../../components/ui/Select";
import { fileSize } from "../../lib/format";
import type { Tabella } from "../../lib/excel";

export function DropExcel({ file, onFile, fogli, foglio, onFoglio, righe, errore }: {
  file: File | null; onFile: (f: File | null) => void; fogli: string[]; foglio: string | null; onFoglio: (f: string) => void; righe?: number; errore?: string | null;
}) {
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      {!file ? (
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0] ?? null); }}
          onClick={() => input.current?.click()}
          animate={{ scale: drag ? 1.015 : 1 }}
          className={clsx("cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition-colors", drag ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/40")}
        >
          <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center mb-4"><UploadCloud size={30} /></div>
          <div className="font-bold text-lg">Trascina qui il file Excel</div>
          <div className="text-sm text-ink-500 mt-1">oppure <span className="text-brand-700 font-semibold">sfoglia</span> · .xlsx, .xls, .csv</div>
        </motion.div>
      ) : (
        <div className="rounded-2xl ring-1 ring-ink-100 bg-ink-50/60 p-4 flex items-center gap-3">
          <span className="h-12 w-12 rounded-xl bg-green-50 text-green-700 grid place-items-center"><FileSpreadsheet size={24} /></span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{file.name}</div>
            <div className="text-xs text-ink-500">{fileSize(file.size)}{righe != null ? ` · ${righe} righe di dati` : ""}</div>
          </div>
          <button onClick={() => onFile(null)} className="h-9 w-9 grid place-items-center rounded-full hover:bg-white text-ink-500"><X size={17} /></button>
        </div>
      )}
      {fogli.length > 1 && (
        <div className="mt-4 max-w-sm">
          <span className="label">Foglio da importare</span>
          <Select value={foglio} onChange={onFoglio} options={fogli.map((f) => ({ value: f, label: f }))} />
        </div>
      )}
      {errore && <div className="mt-4 rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm font-medium flex gap-2"><AlertTriangle size={17} />{errore}</div>}
      <input ref={input} type="file" accept=".xlsx,.xls,.xlsm,.csv,.ods" className="hidden" onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
    </div>
  );
}

export interface CampoDef<K extends string> { k: K; l: string; obbligatorio?: boolean; hint?: string }

/** Tabella di abbinamento campo → colonna del file, con anteprima dei valori. */
export function MappaColonne<K extends string>({ campi, tabella, mappa, onChange }: {
  campi: CampoDef<K>[]; tabella: Tabella; mappa: Partial<Record<K, number>>; onChange: (k: K, col: number | null) => void;
}) {
  const opzioni = [{ value: "-1", label: "— non importare —" }, ...tabella.intestazioni.map((h, i) => ({ value: String(i), label: h, hint: anteprima(tabella, i) }))];
  return (
    <div className="rounded-2xl ring-1 ring-ink-100 divide-y divide-ink-100">
      {campi.map((c) => {
        const col = mappa[c.k];
        return (
          <div key={c.k} className="flex items-center gap-4 px-4 py-2.5">
            <span className={clsx("h-6 w-6 rounded-full grid place-items-center shrink-0", col != null ? "bg-brand-600 text-white" : c.obbligatorio ? "bg-red-50 text-red-500" : "bg-ink-100 text-ink-300")}>
              {col != null ? <Check size={13} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
            </span>
            <div className="w-44 shrink-0">
              <div className="text-[14px] font-semibold">{c.l}{c.obbligatorio && <span className="text-red-500"> *</span>}</div>
              {c.hint && <div className="text-[11.5px] text-ink-400 leading-tight">{c.hint}</div>}
            </div>
            <Select size="sm" className="flex-1 min-w-0" value={col == null ? "-1" : String(col)} onChange={(v) => onChange(c.k, v === "-1" ? null : Number(v))} options={opzioni} menuMinWidth={280} />
            <div className="hidden md:block w-48 text-[12px] text-ink-500 truncate font-mono">{col != null ? anteprima(tabella, col) : ""}</div>
          </div>
        );
      })}
    </div>
  );
}

function anteprima(t: Tabella, i: number) {
  return t.righe.slice(0, 3).map((r) => {
    const v = r[i];
    if (v instanceof Date) return v.toLocaleDateString("it-IT");
    return v == null ? "" : String(v);
  }).filter(Boolean).join(" · ");
}

export function Avanzamento({ msg, p }: { msg: string; p: number }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center mb-5"><FileSpreadsheet size={28} className="animate-pulse" /></div>
      <div className="font-bold text-lg">{msg}</div>
      <div className="mt-5 h-2.5 max-w-md mx-auto rounded-full bg-ink-100 overflow-hidden">
        <motion.div className="h-full bg-brand-600 rounded-full" animate={{ width: `${Math.max(4, p * 100)}%` }} transition={{ duration: 0.4 }} />
      </div>
      <div className="text-sm text-ink-500 mt-2 tabular-nums">{Math.round(p * 100)}%</div>
    </div>
  );
}

export function Numero({ v, l, tone = "neutral", onClick, attivo }: { v: number; l: string; tone?: "neutral" | "green" | "blue" | "amber" | "red"; onClick?: () => void; attivo?: boolean }) {
  const c = { neutral: "#5E6B64", green: "#16A34A", blue: "#2563EB", amber: "#EA8C0C", red: "#DC2626" }[tone];
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={clsx("rounded-2xl px-4 py-3 text-left border-2 transition-all", attivo ? "" : "border-transparent bg-ink-50", onClick && "hover:bg-ink-100 active:scale-[.98]")}
      style={attivo ? { borderColor: c, background: c + "10" } : undefined}>
      <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: c }}><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</div>
      <div className="text-[26px] font-extrabold tabular-nums tracking-tight leading-tight">{v}</div>
    </button>
  );
}
