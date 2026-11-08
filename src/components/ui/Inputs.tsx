import { motion } from "framer-motion";
import { Check, Search, X } from "lucide-react";
import { forwardRef, useEffect, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import { num, parseNumber } from "../../lib/format";

export function Field({ label, hint, error, children, className, optional }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string; optional?: boolean }) {
  return (
    <label className={clsx("block", className)}>
      {label && (
        <span className="label flex items-center gap-2">
          {label}
          {optional && <span className="text-[11px] font-medium text-ink-400">facoltativo</span>}
        </span>
      )}
      {children}
      {error ? <span className="block text-xs text-red-600 mt-1.5 font-medium">{error}</span> : hint ? <span className="hint block">{hint}</span> : null}
    </label>
  );
}

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  icon?: ReactNode;
  suffix?: ReactNode;
  size?: "md" | "lg";
  invalid?: boolean;
}
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput({ icon, suffix, size = "md", invalid, className, ...rest }, ref) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2.5 bg-white border transition-[border-color,box-shadow] duration-200 focus-within:shadow-ring",
        invalid ? "border-red-300 focus-within:border-red-400" : "border-ink-200 hover:border-ink-300 focus-within:border-brand-400",
        size === "lg" ? "h-14 rounded-2xl px-5 text-[17px]" : "h-12 rounded-xl px-4 text-[15px]",
        className,
      )}
    >
      {icon && <span className="text-ink-400 shrink-0 flex">{icon}</span>}
      <input ref={ref} className="flex-1 min-w-0 bg-transparent font-medium" {...rest} />
      {suffix && <span className="text-ink-400 text-sm font-semibold shrink-0">{suffix}</span>}
    </div>
  );
});

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        "w-full min-h-[96px] rounded-xl bg-white border border-ink-200 px-4 py-3 text-[15px] resize-none transition-[border-color,box-shadow] duration-200 hover:border-ink-300 focus:border-brand-400 focus:shadow-ring",
        props.className,
      )}
    />
  );
}

/** Input numerico in formato italiano (virgola), senza spinner nativi. */
export function NumberInput({ value, onChange, suffix, placeholder, size = "md", decimals = 2, icon, autoFocus }: {
  value: number | null | undefined; onChange: (v: number | null) => void; suffix?: ReactNode; placeholder?: string; size?: "md" | "lg"; decimals?: number; icon?: ReactNode; autoFocus?: boolean;
}) {
  const [txt, setTxt] = useState(value == null ? "" : num(value, decimals));
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setTxt(value == null ? "" : num(value, decimals)); }, [value, focus, decimals]);
  return (
    <TextInput
      size={size}
      icon={icon}
      autoFocus={autoFocus}
      inputMode="decimal"
      value={txt}
      placeholder={placeholder}
      suffix={suffix}
      className="tabular-nums"
      onFocus={() => setFocus(true)}
      onBlur={() => { setFocus(false); setTxt(value == null ? "" : num(value, decimals)); }}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d.,-]/g, "");
        setTxt(v);
        onChange(parseNumber(v));
      }}
    />
  );
}

export function SearchInput({ value, onChange, placeholder = "Cerca…", size = "md", autoFocus, className, shortcut }: {
  value: string; onChange: (v: string) => void; placeholder?: string; size?: "md" | "lg"; autoFocus?: boolean; className?: string; shortcut?: boolean;
}) {
  return (
    <div
      className={clsx(
        "group flex items-center gap-3 bg-white border border-ink-200 transition-[border-color,box-shadow] duration-200 hover:border-ink-300 focus-within:border-brand-400 focus-within:shadow-ring",
        size === "lg" ? "h-14 rounded-2xl px-5" : "h-11 rounded-xl px-4",
        className,
      )}
    >
      <Search size={size === "lg" ? 20 : 17} className="text-ink-400 group-focus-within:text-brand-600 transition-colors shrink-0" />
      <input
        type="search"
        data-search
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={clsx("flex-1 min-w-0 bg-transparent font-medium", size === "lg" ? "text-[16px]" : "text-[14px]")}
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} className="h-7 w-7 grid place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"><X size={15} /></button>
      ) : shortcut ? <span className="kbd hidden sm:inline-flex">/</span> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, size = "md", disabled }: { checked: boolean; onChange: (v: boolean) => void; size?: "sm" | "md"; disabled?: boolean }) {
  const w = size === "sm" ? 36 : 46;
  const h = size === "sm" ? 22 : 28;
  const k = h - 6;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={clsx("relative shrink-0 rounded-full transition-colors duration-300 disabled:opacity-50", checked ? "bg-brand-600" : "bg-ink-200 hover:bg-ink-300")}
      style={{ width: w, height: h }}
    >
      <motion.span
        className="absolute top-[3px] left-[3px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2),0_1px_1px_rgba(0,0,0,.06)]"
        style={{ width: k, height: k }}
        animate={{ x: checked ? w - k - 6 : 0 }}
        transition={{ type: "spring", stiffness: 600, damping: 35 }}
      />
    </button>
  );
}

export function Checkbox({ checked, onChange, indeterminate, size = 20, className }: { checked: boolean; onChange: (v: boolean) => void; indeterminate?: boolean; size?: number; className?: string }) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={clsx(
        "shrink-0 grid place-items-center rounded-[7px] border-[1.5px] transition-all duration-200 active:scale-90",
        on ? "bg-brand-700 border-brand-700 shadow-[0_2px_6px_-2px_rgba(0,80,42,.5)]" : "bg-white border-ink-300 hover:border-brand-400",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {indeterminate ? (
        <span className="block h-[2px] w-2.5 rounded bg-white" />
      ) : (
        <motion.svg viewBox="0 0 16 16" width={size - 6} height={size - 6} initial={false} animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.5 }} transition={{ duration: 0.15 }}>
          <motion.path d="M3.5 8.5l3 3 6-7" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={false} animate={{ pathLength: checked ? 1 : 0 }} transition={{ duration: 0.2 }} />
        </motion.svg>
      )}
    </button>
  );
}

/** Grande scelta a riquadro (per wizard e modali). */
export function ChoiceCard({ selected, onClick, icon, title, desc, color, className, disabled, badge }: {
  selected: boolean; onClick: () => void; icon?: ReactNode; title: ReactNode; desc?: ReactNode; color?: string; className?: string; disabled?: boolean; badge?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "group relative text-left rounded-2xl border-2 p-4 transition-all duration-200 active:scale-[.98] disabled:opacity-45 disabled:pointer-events-none",
        selected ? "border-brand-500 bg-brand-50/60 shadow-[0_8px_24px_-12px_rgba(0,80,42,.45)]" : "border-ink-100 bg-white hover:border-ink-200 hover:shadow-card hover:-translate-y-0.5",
        className,
      )}
      style={selected && color ? { borderColor: color, backgroundColor: color + "0D", boxShadow: `0 8px 24px -12px ${color}88` } : undefined}
    >
      <div className="flex items-start gap-3.5">
        {icon && (
          <span
            className={clsx("shrink-0 grid place-items-center h-11 w-11 rounded-xl transition-colors", !color && (selected ? "bg-brand-700 text-white" : "bg-ink-50 text-ink-600 group-hover:bg-brand-50 group-hover:text-brand-700"))}
            style={color ? { backgroundColor: selected ? color : color + "16", color: selected ? "white" : color } : undefined}
          >
            {icon}
          </span>
        )}
        <span className="flex-1 min-w-0 pt-0.5">
          <span className="flex items-center gap-2 font-bold text-[15px] text-ink-900 tracking-tight">{title}{badge}</span>
          {desc && <span className="block text-[13px] text-ink-500 mt-0.5 leading-snug">{desc}</span>}
        </span>
        <span
          className={clsx("shrink-0 h-6 w-6 rounded-full grid place-items-center border-2 transition-all duration-200", selected ? "border-transparent scale-100" : "border-ink-200 scale-90")}
          style={selected ? { backgroundColor: color ?? "#2C7C28" } : undefined}
        >
          {selected && <Check size={14} className="text-white" strokeWidth={3} />}
        </span>
      </div>
    </button>
  );
}

/** Riga con interruttore grande, usata per i flag (bio, IAP, UMA). */
export function ToggleCard({ checked, onChange, icon, title, desc }: { checked: boolean; onChange: (v: boolean) => void; icon: ReactNode; title: string; desc?: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!checked); } }}
      className={clsx(
        "flex items-center gap-4 rounded-2xl border-2 px-4 py-3.5 cursor-pointer transition-all duration-200 select-none active:scale-[.99]",
        checked ? "border-brand-400 bg-brand-50/60" : "border-ink-100 bg-white hover:border-ink-200",
      )}
    >
      <span className={clsx("grid place-items-center h-11 w-11 rounded-xl transition-colors", checked ? "bg-brand-700 text-white" : "bg-ink-50 text-ink-500")}>{icon}</span>
      <span className="flex-1">
        <span className="block font-bold text-[15px] tracking-tight">{title}</span>
        {desc && <span className="block text-[13px] text-ink-500">{desc}</span>}
      </span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export function CheckIcon({ ok }: { ok: boolean }) {
  return (
    <span className={clsx("grid place-items-center h-6 w-6 rounded-full", ok ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-300")}>
      {ok ? <Check size={14} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
    </span>
  );
}
