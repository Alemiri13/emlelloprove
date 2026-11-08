import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Checkbox } from "./Inputs";
import { Popover } from "./Popover";

/** Selezione multipla riutilizzabile. Si azzera quando cambia `reset`. */
export function useSelezione(reset?: unknown) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => setSel(new Set()), [reset]);
  const toggle = useCallback((id: string, v?: boolean) => setSel((s) => {
    const n = new Set(s);
    if (v ?? !n.has(id)) n.add(id); else n.delete(id);
    return n;
  }), []);
  const imposta = useCallback((ids: string[]) => setSel(new Set(ids)), []);
  const svuota = useCallback(() => setSel(new Set()), []);
  return { sel, toggle, imposta, svuota, n: sel.size, ids: useMemo(() => [...sel], [sel]) };
}

/** Casella «seleziona tutti» per un elenco filtrato. */
export function SelezionaTutti({ ids, sel, onChange, etichetta }: { ids: string[]; sel: Set<string>; onChange: (ids: string[]) => void; etichetta?: ReactNode }) {
  const tutti = ids.length > 0 && ids.every((id) => sel.has(id));
  const alcuni = !tutti && ids.some((id) => sel.has(id));
  return (
    <div className="flex items-center gap-3">
      <Checkbox checked={tutti} indeterminate={alcuni} onChange={(v) => onChange(v ? ids : [])} />
      {etichetta && <span className="text-[13px] text-ink-500 font-medium">{etichetta}</span>}
    </div>
  );
}

export interface Azione {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  tone?: "danger" | "muted";
  /** sotto-azioni: apre un piccolo menu */
  menu?: { label: string; icon?: ReactNode; onClick: () => void; dot?: string }[];
  disabled?: boolean;
}

/**
 * Barra delle azioni sulla selezione: compare in alto, sotto l'intestazione, centrata nell'area dei contenuti.
 * I pulsanti vanno a capo se lo spazio non basta (niente scorrimento fuori schermo).
 */
export function BarraAzioni({ n, azioni, onClear, nome = "selezionati" }: { n: number; azioni: Azione[]; onClear: () => void; nome?: string }) {
  return (
    <AnimatePresence>
      {n > 0 && (
        <div className="fixed inset-x-0 top-[80px] lg:left-[264px] z-40 flex justify-center px-3 sm:px-6 pointer-events-none">
          <motion.div
            initial={{ y: -16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -16, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 460, damping: 36 }}
            role="toolbar"
            aria-label="Azioni sulla selezione"
            className="pointer-events-auto max-w-full bg-white/95 backdrop-blur-xl rounded-[20px] shadow-pop ring-1 ring-ink-100 p-1.5 flex flex-wrap items-center gap-1"
          >
            <span className="h-10 pl-2 pr-3 flex items-center gap-2 font-bold text-[13.5px] whitespace-nowrap tabular-nums text-brand-900">
              <span className="h-7 min-w-[28px] px-2 rounded-full bg-brand-700 text-white grid place-items-center text-[12.5px]">{n}</span>{nome}
            </span>
            <span className="hidden sm:block h-6 w-px bg-ink-100 mx-0.5" />
            {azioni.map((a) => <BottoneAzione key={a.label} a={a} />)}
            <button onClick={onClear} className="h-10 w-10 rounded-xl grid place-items-center text-ink-400 hover:bg-ink-100 hover:text-ink-800 transition shrink-0" aria-label="Deseleziona" title="Deseleziona"><X size={18} /></button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function BottoneAzione({ a }: { a: Azione }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        disabled={a.disabled}
        onClick={() => (a.menu ? setOpen((o) => !o) : a.onClick?.())}
        className={clsx(
          "h-10 px-3 rounded-xl text-[13.5px] font-semibold flex items-center gap-2 transition whitespace-nowrap disabled:opacity-40",
          a.tone === "danger" ? "text-red-600 hover:bg-red-50" : a.tone === "muted" ? "text-ink-500 hover:bg-ink-100" : "text-ink-800 hover:bg-ink-100",
          open && "bg-ink-100",
        )}
      >
        {a.icon}{a.label}{a.menu && <ChevronUp size={14} className={clsx("transition-transform", !open && "rotate-180")} />}
      </button>
      {a.menu && (
        <Popover open={open} onClose={() => setOpen(false)} anchor={ref} align="center" minWidth={220}>
          <div className="p-1.5">
            {a.menu.map((m) => (
              <button key={m.label} onClick={() => { setOpen(false); m.onClick(); }} className="w-full flex items-center gap-3 px-3 h-10 rounded-xl text-[13.5px] font-semibold text-ink-700 hover:bg-ink-50 text-left">
                {m.dot && <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.dot }} />}
                {m.icon}{m.label}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}
