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

/** Barra flottante delle azioni sulla selezione. */
export function BarraAzioni({ n, azioni, onClear, nome = "selezionati" }: { n: number; azioni: Azione[]; onClear: () => void; nome?: string }) {
  return (
    <AnimatePresence>
      {n > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 lg:ml-[132px] z-40 bg-ink-900 text-white rounded-[22px] shadow-pop pl-5 pr-2 py-2 flex items-center gap-1 max-w-[calc(100vw-24px)] overflow-x-auto"
        >
          <span className="font-bold text-[14px] whitespace-nowrap pr-2 tabular-nums">{n} {nome}</span>
          <span className="h-6 w-px bg-white/15 mx-1" />
          {azioni.map((a) => <BottoneAzione key={a.label} a={a} />)}
          <button onClick={onClear} className="h-11 w-11 rounded-xl grid place-items-center hover:bg-white/10 transition shrink-0" aria-label="Deseleziona"><X size={18} /></button>
        </motion.div>
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
          "h-11 px-3.5 rounded-xl text-[13.5px] font-semibold flex items-center gap-2 transition whitespace-nowrap disabled:opacity-40",
          a.tone === "danger" ? "text-red-300 hover:bg-red-500/20 hover:text-red-200" : a.tone === "muted" ? "text-white/70 hover:bg-white/10" : "hover:bg-white/10",
        )}
      >
        {a.icon}{a.label}{a.menu && <ChevronUp size={14} className={clsx("transition-transform", !open && "rotate-180")} />}
      </button>
      {a.menu && (
        <Popover open={open} onClose={() => setOpen(false)} anchor={ref} align="start" minWidth={220}>
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
