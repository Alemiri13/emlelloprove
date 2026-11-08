import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft" | "outline";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "text-white bg-brand-800 shadow-[0_1px_0_rgba(255,255,255,.12)_inset,0_1px_2px_rgba(0,40,20,.25),0_6px_16px_-6px_rgba(0,80,42,.55)] hover:bg-brand-900 hover:shadow-[0_1px_0_rgba(255,255,255,.12)_inset,0_2px_4px_rgba(0,40,20,.25),0_10px_22px_-8px_rgba(0,80,42,.6)]",
  secondary: "text-ink-900 bg-white border border-ink-200 shadow-soft hover:border-ink-300 hover:bg-ink-50",
  outline: "text-brand-800 bg-white border border-brand-200 hover:bg-brand-50 hover:border-brand-300",
  ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
  soft: "text-brand-800 bg-brand-50 hover:bg-brand-100",
  danger: "text-white bg-red-600 shadow-[0_6px_16px_-6px_rgba(220,38,38,.55)] hover:bg-red-700",
};
const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-xl gap-1.5",
  md: "h-11 px-5 text-[14px] rounded-xl gap-2",
  lg: "h-14 px-7 text-[15px] rounded-2xl gap-2.5",
  icon: "h-11 w-11 rounded-xl",
  "icon-sm": "h-9 w-9 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, iconRight, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        "relative inline-flex items-center justify-center font-semibold tracking-[-0.01em] select-none whitespace-nowrap",
        "transition-[background-color,box-shadow,border-color,color,transform,opacity] duration-200 ease-out active:scale-[.97]",
        "disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      <span className={clsx("inline-flex items-center justify-center gap-[inherit]", loading && "opacity-0")}>
        {icon}
        {children}
        {iconRight}
      </span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner className={variant === "primary" || variant === "danger" ? "text-white" : "text-brand-700"} />
        </span>
      )}
    </button>
  );
});
