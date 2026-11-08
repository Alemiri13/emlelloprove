import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Popover } from "./Popover";
import { GIORNI_BREVI, MESI, MESI_BREVI, parseISO, toISO } from "../../lib/format";

interface Props {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  label?: string;
  size?: "md" | "lg";
  className?: string;
  min?: string;
  max?: string;
  presets?: { label: string; value: string }[];
}

function maskInput(s: string) {
  const d = s.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function fromTyped(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (dt.getDate() !== Number(m[1]) || dt.getMonth() !== Number(m[2]) - 1) return null;
  return toISO(dt);
}
function toTyped(iso: string | null | undefined) {
  const d = parseISO(iso);
  return d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : "";
}

export function DatePicker({ value, onChange, placeholder = "gg/mm/aaaa", label, size = "md", className, min, max, presets }: Props) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(toTyped(value));
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => setTyped(toTyped(value)), [value]);

  const commitTyped = () => {
    if (!typed) { if (value) onChange(null); return; }
    const iso = fromTyped(typed);
    if (iso) onChange(iso); else setTyped(toTyped(value));
  };

  return (
    <div className={className}>
      {label && <span className="label">{label}</span>}
      <div
        ref={wrap}
        className={clsx(
          "flex items-center gap-2 bg-white border transition-[border-color,box-shadow] duration-200",
          size === "lg" ? "h-14 rounded-2xl pl-5 pr-2 text-[15px]" : "h-12 rounded-xl pl-4 pr-1.5 text-[15px]",
          open ? "border-brand-400 shadow-ring" : "border-ink-200 hover:border-ink-300 focus-within:border-brand-400 focus-within:shadow-ring",
        )}
      >
        <input
          value={typed}
          inputMode="numeric"
          placeholder={placeholder}
          onChange={(e) => setTyped(maskInput(e.target.value))}
          onBlur={commitTyped}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitTyped(); } if (e.key === "ArrowDown") setOpen(true); }}
          className="flex-1 min-w-0 bg-transparent font-medium tabular-nums"
        />
        {value && (
          <button type="button" onClick={() => onChange(null)} className="h-8 w-8 grid place-items-center rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100" aria-label="Cancella data">
            <X size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={clsx("h-9 w-9 grid place-items-center rounded-lg transition-colors", open ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-ink-100 hover:text-ink-800")}
          aria-label="Apri calendario"
        >
          <CalendarDays size={18} />
        </button>
      </div>
      <Popover open={open} onClose={() => setOpen(false)} anchor={wrap} align="start" minWidth={312}>
        <Calendar
          value={value}
          min={min}
          max={max}
          presets={presets}
          onPick={(v) => { onChange(v); setOpen(false); }}
        />
      </Popover>
    </div>
  );
}

function Calendar({ value, onPick, min, max, presets }: { value?: string | null; onPick: (v: string | null) => void; min?: string; max?: string; presets?: { label: string; value: string }[] }) {
  const sel = parseISO(value);
  const today = new Date();
  const [view, setView] = useState(() => new Date((sel ?? today).getFullYear(), (sel ?? today).getMonth(), 1));
  const [mode, setMode] = useState<"days" | "months" | "years">("days");
  const [dir, setDir] = useState(0);

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [view]);

  const move = (n: number) => {
    setDir(n);
    if (mode === "days") setView(new Date(view.getFullYear(), view.getMonth() + n, 1));
    else if (mode === "months") setView(new Date(view.getFullYear() + n, view.getMonth(), 1));
    else setView(new Date(view.getFullYear() + n * 12, view.getMonth(), 1));
  };
  const disabled = (d: Date) => (min && toISO(d) < min) || (max && toISO(d) > max);
  const yearStart = view.getFullYear() - (view.getFullYear() % 12);

  return (
    <div className="p-3 w-[312px] select-none">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => move(-1)} className="h-9 w-9 grid place-items-center rounded-xl text-ink-500 hover:bg-ink-100 hover:text-ink-900 active:scale-95 transition"><ChevronLeft size={18} /></button>
        <button
          type="button"
          onClick={() => setMode(mode === "days" ? "months" : mode === "months" ? "years" : "days")}
          className="px-3 h-9 rounded-xl text-[15px] font-bold tracking-tight text-ink-900 hover:bg-ink-100 transition capitalize"
        >
          {mode === "days" && `${MESI[view.getMonth()]} ${view.getFullYear()}`}
          {mode === "months" && view.getFullYear()}
          {mode === "years" && `${yearStart} – ${yearStart + 11}`}
        </button>
        <button type="button" onClick={() => move(1)} className="h-9 w-9 grid place-items-center rounded-xl text-ink-500 hover:bg-ink-100 hover:text-ink-900 active:scale-95 transition"><ChevronRight size={18} /></button>
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={mode + view.toISOString()}
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {mode === "days" && (
              <>
                <div className="grid grid-cols-7 mb-1">
                  {GIORNI_BREVI.map((g) => <div key={g} className="h-8 grid place-items-center text-[11px] font-bold uppercase tracking-wider text-ink-400">{g}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5">
                  {days.map((d) => {
                    const iso = toISO(d);
                    const other = d.getMonth() !== view.getMonth();
                    const isSel = sel && iso === toISO(sel);
                    const isToday = iso === toISO(today);
                    const dis = disabled(d);
                    const weekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <button
                        type="button"
                        key={iso}
                        disabled={!!dis}
                        onClick={() => onPick(iso)}
                        className={clsx(
                          "relative h-10 w-10 mx-auto rounded-full text-[14px] font-medium tabular-nums transition-all duration-150",
                          isSel ? "bg-brand-800 text-white shadow-[0_4px_12px_-4px_rgba(0,80,42,.6)] scale-105"
                            : other ? "text-ink-300 hover:bg-ink-50"
                              : weekend ? "text-ink-500 hover:bg-brand-50 hover:text-brand-900" : "text-ink-800 hover:bg-brand-50 hover:text-brand-900",
                          dis && "opacity-30 pointer-events-none",
                        )}
                      >
                        {d.getDate()}
                        {isToday && !isSel && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-500" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {mode === "months" && (
              <div className="grid grid-cols-3 gap-2 py-1">
                {MESI_BREVI.map((m, i) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => { setView(new Date(view.getFullYear(), i, 1)); setMode("days"); }}
                    className={clsx("h-14 rounded-2xl text-sm font-semibold capitalize transition",
                      i === view.getMonth() ? "bg-brand-800 text-white" : "text-ink-700 hover:bg-brand-50")}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            {mode === "years" && (
              <div className="grid grid-cols-3 gap-2 py-1">
                {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => (
                  <button
                    type="button"
                    key={y}
                    onClick={() => { setView(new Date(y, view.getMonth(), 1)); setMode("months"); }}
                    className={clsx("h-14 rounded-2xl text-sm font-semibold tabular-nums transition",
                      y === view.getFullYear() ? "bg-brand-800 text-white" : y === today.getFullYear() ? "text-brand-800 bg-brand-50" : "text-ink-700 hover:bg-brand-50")}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-ink-100">
        <button type="button" onClick={() => onPick(toISO(today))} className="h-8 px-3 rounded-lg text-[13px] font-semibold text-brand-800 bg-brand-50 hover:bg-brand-100 transition">Oggi</button>
        {presets?.map((p) => (
          <button type="button" key={p.label} onClick={() => onPick(p.value)} className="h-8 px-3 rounded-lg text-[13px] font-semibold text-ink-600 hover:bg-ink-100 transition">{p.label}</button>
        ))}
        <div className="flex-1" />
        {value && <button type="button" onClick={() => onPick(null)} className="h-8 px-3 rounded-lg text-[13px] font-semibold text-ink-500 hover:bg-ink-100 transition">Cancella</button>}
      </div>
    </div>
  );
}
