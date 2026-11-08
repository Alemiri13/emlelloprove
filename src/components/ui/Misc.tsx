import { motion } from "framer-motion";
import { useId, type ReactNode } from "react";
import clsx from "clsx";
import { ESITI, PAGAMENTI, STATI } from "../../lib/domain";
import type { Esito, StatoDomanda, StatoPagamento } from "../../lib/types";
import { initials } from "../../lib/format";

export function StatoPill({ stato, size = "md", className }: { stato: StatoDomanda; size?: "sm" | "md"; className?: string }) {
  const s = STATI[stato];
  return (
    <span className={clsx("chip ring-1 ring-inset", s.bg, s.text, s.ring, size === "sm" && "!h-6 !px-2 !text-[11px]", className)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export function EsitoPill({ esito, className }: { esito: Esito; className?: string }) {
  const e = ESITI[esito];
  return <span className={clsx("chip", e.bg, e.text, className)}>{e.label}</span>;
}

export function PagamentoPill({ stato }: { stato: StatoPagamento }) {
  const p = PAGAMENTI[stato];
  return <span className={clsx("chip", p.bg, p.text)}>{p.label}</span>;
}

const AVATAR_COLORS = ["#E8F3E4", "#E4EFF5", "#F5EEE1", "#EFE7F3", "#F4E6E6", "#E3F1EE"];
const AVATAR_TEXT = ["#1C6326", "#1E5A7A", "#8A5A12", "#5B3A7A", "#8A2A2A", "#1F6B5E"];
export function Avatar({ name, size = 44, square, className }: { name: string; size?: number; square?: boolean; className?: string }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const i = h % AVATAR_COLORS.length;
  return (
    <span
      className={clsx("shrink-0 grid place-items-center font-bold tracking-tight", square ? "rounded-2xl" : "rounded-full", className)}
      style={{ width: size, height: size, background: AVATAR_COLORS[i], color: AVATAR_TEXT[i], fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

export function Empty({ icon, title, desc, action }: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center py-16 px-6">
      <div className="h-16 w-16 rounded-3xl bg-brand-50 text-brand-700 grid place-items-center mb-5">{icon}</div>
      <div className="text-lg font-bold tracking-tight">{title}</div>
      {desc && <div className="text-sm text-ink-500 mt-1.5 max-w-sm">{desc}</div>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number; icon?: ReactNode }[]; className?: string }) {
  const id = useId();
  return (
    <div className={clsx("flex gap-1 border-b border-ink-100 overflow-x-auto", className)}>
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={clsx("relative h-12 px-4 text-[14px] font-semibold whitespace-nowrap flex items-center gap-2 transition-colors", on ? "text-brand-900" : "text-ink-500 hover:text-ink-800")}
          >
            {t.icon}
            {t.label}
            {t.count != null && <span className={clsx("text-[11px] font-bold tabular-nums rounded-full px-1.5 h-5 min-w-[20px] grid place-items-center", on ? "bg-brand-100 text-brand-800" : "bg-ink-100 text-ink-500")}>{t.count}</span>}
            {on && <motion.span layoutId={id + "tab"} className="absolute left-2 right-2 -bottom-px h-[3px] rounded-full bg-brand-600" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          </button>
        );
      })}
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "blue" | "red"; className?: string }) {
  const t = { neutral: "bg-ink-100 text-ink-600", green: "bg-brand-50 text-brand-800", amber: "bg-amber-50 text-amber-700", blue: "bg-blue-50 text-blue-700", red: "bg-red-50 text-red-700" }[tone];
  return <span className={clsx("chip !h-6 !px-2 !text-[11px]", t, className)}>{children}</span>;
}

/** Barra segmentata con i 4 stati. */
export function ProgressStati({ counts, total, className, height = 8 }: { counts: Record<StatoDomanda, number>; total: number; className?: string; height?: number }) {
  return (
    <div className={clsx("flex w-full rounded-full overflow-hidden bg-ink-100 gap-[2px]", className)} style={{ height }}>
      {(["R", "S", "C", "N"] as StatoDomanda[]).map((s) =>
        counts[s] > 0 ? (
          <motion.div key={s} initial={{ width: 0 }} animate={{ width: `${(counts[s] / Math.max(1, total)) * 100}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} style={{ background: STATI[s].color, opacity: s === "N" ? 0.55 : 1 }} />
        ) : null,
      )}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-center justify-between mb-3", className)}>
      <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink-400">{children}</h3>
      {action}
    </div>
  );
}

export function InfoRow({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="py-3 flex items-start justify-between gap-4 border-b border-ink-100 last:border-0">
      <span className="text-[13px] text-ink-500">{label}</span>
      <span className={clsx("text-[14px] font-semibold text-ink-900 text-right", mono && "font-mono tracking-tight")}>{children || <span className="text-ink-300 font-normal">—</span>}</span>
    </div>
  );
}
