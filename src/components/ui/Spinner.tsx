import clsx from "clsx";

export function Spinner({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={clsx("animate-spin", className)} aria-hidden>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" fill="none" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}
