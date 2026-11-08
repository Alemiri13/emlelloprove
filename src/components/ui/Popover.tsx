import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement>;
  children: ReactNode;
  align?: "start" | "end" | "center";
  matchWidth?: boolean;
  minWidth?: number;
  className?: string;
  offset?: number;
}

/** Pannello flottante ancorato a un elemento, renderizzato in un portal (non viene tagliato dai modali). */
export function Popover({ open, onClose, anchor, children, align = "start", matchWidth, minWidth = 0, className, offset = 8 }: PopoverProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);

  const place = useCallback(() => {
    const a = anchor.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const ph = panel.current?.offsetHeight ?? 320;
    const pw = Math.max(matchWidth ? r.width : 0, minWidth, panel.current?.offsetWidth ?? 0);
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const up = r.bottom + offset + ph > vh - 12 && r.top - offset - ph > 12;
    let left = align === "end" ? r.right - pw : align === "center" ? r.left + r.width / 2 - pw / 2 : r.left;
    left = Math.max(12, Math.min(left, vw - pw - 12));
    const top = up ? r.top - offset - ph : r.bottom + offset;
    setPos({ top, left, width: matchWidth ? r.width : 0, up });
  }, [anchor, align, matchWidth, minWidth, offset]);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    place();
    const raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    const onScroll = (e: Event) => {
      if (panel.current && panel.current.contains(e.target as Node)) return;
      place();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, onClose, anchor, place]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panel}
          data-popover-open
          className={clsx("fixed z-[70] bg-white rounded-2xl border border-ink-100 shadow-pop overflow-hidden", className)}
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width || undefined, minWidth: minWidth || undefined, transformOrigin: pos?.up ? "bottom" : "top" }}
          initial={{ opacity: 0, scale: 0.96, y: pos?.up ? 6 : -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
          transition={{ type: "spring", stiffness: 520, damping: 34 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
