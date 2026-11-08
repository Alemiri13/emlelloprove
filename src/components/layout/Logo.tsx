import clsx from "clsx";

export function Logo({ className, white }: { className?: string; white?: boolean }) {
  return (
    <img
      src="/logo-cia.png"
      alt="CIA"
      draggable={false}
      className={clsx("select-none", white && "brightness-0 invert", className)}
    />
  );
}
