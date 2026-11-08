import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Popover } from "./Popover";
import { normalizeSearch } from "../../lib/format";

export interface Option<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
  icon?: ReactNode;
  group?: string;
  disabled?: boolean;
}

interface SelectProps<T extends string> {
  value: T | null | undefined;
  onChange: (v: T) => void;
  options: Option<T>[];
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  className?: string;
  size?: "md" | "lg" | "sm";
  icon?: ReactNode;
  label?: string;
  disabled?: boolean;
  align?: "start" | "end";
  menuMinWidth?: number;
}

export function Select<T extends string>({
  value, onChange, options, placeholder = "Seleziona…", searchable, clearable, onClear, className, size = "md", icon, label, disabled, align = "start", menuMinWidth = 240,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sel = options.find((o) => o.value === value);
  const showSearch = searchable ?? options.length > 8;

  const filtered = useMemo(() => {
    if (!q) return options;
    const n = normalizeSearch(q);
    return options.filter((o) => normalizeSearch(o.label + " " + (o.hint ?? "")).includes(n));
  }, [q, options]);

  useEffect(() => {
    if (open) {
      setQ("");
      const i = Math.max(0, options.findIndex((o) => o.value === value));
      setActive(i);
      setTimeout(() => {
        if (showSearch) searchRef.current?.focus();
        else list.current?.focus();
        list.current?.querySelector(`[data-idx="${i}"]`)?.scrollIntoView({ block: "nearest" });
      }, 30);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (o: Option<T>) => {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    btn.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(filtered.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); const o = filtered[active]; if (o) pick(o); }
    else if (e.key === "Tab") setOpen(false);
  };

  const H = size === "lg" ? "h-14 text-[15px] rounded-2xl px-5" : size === "sm" ? "h-9 text-[13px] rounded-xl px-3" : "h-12 text-[15px] rounded-xl px-4";
  let lastGroup: string | undefined;

  return (
    <div className={clsx("relative", className)}>
      {label && <span className="label">{label}</span>}
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(true); } }}
        className={clsx(
          "group w-full flex items-center gap-2.5 bg-white border text-left transition-[border-color,box-shadow] duration-200",
          open ? "border-brand-400 shadow-ring" : "border-ink-200 hover:border-ink-300",
          disabled && "opacity-50 pointer-events-none",
          H,
        )}
      >
        {(icon || sel?.icon) && <span className="text-ink-500 shrink-0 flex">{sel?.icon ?? icon}</span>}
        <span className={clsx("flex-1 truncate", sel ? "text-ink-900 font-medium" : "text-ink-400")}>{sel?.label ?? placeholder}</span>
        {clearable && sel && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onClear?.(); }}
            className="shrink-0 h-6 w-6 grid place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown size={18} className={clsx("shrink-0 text-ink-400 transition-transform duration-300", open && "rotate-180 text-brand-600")} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={btn} matchWidth minWidth={menuMinWidth} align={align}>
        {showSearch && (
          <div className="p-2 border-b border-ink-100">
            <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-ink-50">
              <Search size={16} className="text-ink-400" />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setActive(0); }}
                onKeyDown={onKey}
                placeholder="Cerca…"
                className="flex-1 bg-transparent text-sm"
              />
            </div>
          </div>
        )}
        <div ref={list} tabIndex={-1} onKeyDown={onKey} className="max-h-72 overflow-y-auto p-1.5 outline-none">
          {filtered.length === 0 && <div className="px-3 py-6 text-center text-sm text-ink-400">Nessun risultato</div>}
          {filtered.map((o, i) => {
            const header = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            const isSel = o.value === value;
            return (
              <div key={o.value}>
                {header && <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">{header}</div>}
                <button
                  type="button"
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  disabled={o.disabled}
                  className={clsx(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[14px] transition-colors",
                    i === active && "bg-brand-50",
                    isSel ? "text-brand-900 font-semibold" : "text-ink-700",
                    o.disabled && "opacity-40",
                  )}
                >
                  {o.icon && <span className="shrink-0 flex">{o.icon}</span>}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block text-xs text-ink-400 font-normal truncate">{o.hint}</span>}
                  </span>
                  <Check size={16} className={clsx("shrink-0 text-brand-600 transition-opacity", isSel ? "opacity-100" : "opacity-0")} />
                </button>
              </div>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}
