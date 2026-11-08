import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

// pila dei modali aperti: ESC chiude solo quello in cima
const stack: string[] = [];
let lockCount = 0;
function lockScroll() {
  if (lockCount++ === 0) {
    const w = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = w ? `${w}px` : "";
  }
}
function unlockScroll() {
  if (--lockCount <= 0) {
    lockCount = 0;
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }
}
export function isTopModal(id: string) {
  return stack[stack.length - 1] === id;
}
export function hasOpenModal() {
  return stack.length > 0;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  hideClose?: boolean;
  className?: string;
  bodyClassName?: string;
  dismissable?: boolean;
}

const SIZES = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

export function Modal({ open, onClose, children, size = "md", title, subtitle, icon, footer, hideClose, className, bodyClassName, dismissable = true }: ModalProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    stack.push(id);
    lockScroll();
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current;
      el?.focus({ preventScroll: true });
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopModal(id) && !document.querySelector("[data-popover-open]")) {
        e.stopPropagation();
        if (dismissable) closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      const i = stack.lastIndexOf(id);
      if (i >= 0) stack.splice(i, 1);
      unlockScroll();
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, id, dismissable]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <motion.div
            className="absolute inset-0 bg-[#0b1f14]/35 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => dismissable && onClose()}
          />
          <motion.div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            className={clsx(
              "relative w-full bg-white sm:rounded-[28px] rounded-t-[28px] shadow-pop flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden",
              SIZES[size],
              className,
            )}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
          >
            {(title || !hideClose) && (
              <div className="flex items-start gap-4 px-7 pt-6 pb-4">
                {icon && <div className="shrink-0 grid place-items-center h-12 w-12 rounded-2xl bg-brand-50 text-brand-800">{icon}</div>}
                <div className="min-w-0 flex-1 pt-0.5">
                  {title && <h2 className="text-xl font-bold tracking-[-0.02em] text-ink-900 leading-tight">{title}</h2>}
                  {subtitle && <div className="text-sm text-ink-500 mt-1">{subtitle}</div>}
                </div>
                {!hideClose && (
                  <button
                    onClick={onClose}
                    className="shrink-0 -mr-2 -mt-1 h-10 w-10 grid place-items-center rounded-full text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors active:scale-95"
                    aria-label="Chiudi"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            )}
            <div className={clsx("px-7 pb-6 overflow-y-auto overscroll-contain flex-1", bodyClassName)}>{children}</div>
            {footer && <div className="px-7 py-4 border-t border-ink-100 bg-ink-50/60 flex items-center gap-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
