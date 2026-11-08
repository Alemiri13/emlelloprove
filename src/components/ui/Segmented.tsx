import { motion } from "framer-motion";
import { useId, type ReactNode } from "react";
import clsx from "clsx";

export interface SegOption<T extends string> { value: T; label: ReactNode; count?: number; dot?: string; icon?: ReactNode }

export function Segmented<T extends string>({ value, onChange, options, size = "md", className, full }: {
  value: T; onChange: (v: T) => void; options: SegOption<T>[]; size?: "sm" | "md" | "lg"; className?: string; full?: boolean;
}) {
  const id = useId();
  const H = size === "lg" ? "h-12 text-[15px] px-5" : size === "sm" ? "h-8 text-[12.5px] px-3" : "h-10 text-[13.5px] px-4";
  return (
    <div className={clsx("inline-flex items-center gap-1 p-1 rounded-2xl bg-ink-100/80", full && "w-full", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={clsx("relative rounded-xl font-semibold whitespace-nowrap transition-colors duration-200 flex items-center justify-center gap-2", H, full && "flex-1", on ? "text-ink-900" : "text-ink-500 hover:text-ink-800")}
          >
            {on && (
              <motion.span
                layoutId={id + "pill"}
                className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_2px_rgba(16,40,24,.08),0_4px_12px_-4px_rgba(16,40,24,.14)]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {o.dot && <span className="h-2 w-2 rounded-full" style={{ background: o.dot }} />}
              {o.icon}
              {o.label}
              {o.count != null && (
                <span className={clsx("tabular-nums text-[11.5px] font-bold rounded-full px-1.5 min-w-[22px] h-[20px] grid place-items-center transition-colors", on ? "bg-brand-50 text-brand-800" : "bg-white/70 text-ink-500")}>
                  {o.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
