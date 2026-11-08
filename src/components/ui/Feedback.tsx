import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Modal } from "./Modal";
import { Button } from "./Button";

type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; title: string; desc?: string; action?: { label: string; onClick: () => void } }

interface ConfirmOpts { title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean }

interface Ctx {
  toast: (kind: ToastKind, title: string, desc?: string, action?: Toast["action"]) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
}
const FeedbackCtx = createContext<Ctx>(null!);
export const useFeedback = () => useContext(FeedbackCtx);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [conf, setConf] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const seq = useRef(0);

  const toast = useCallback<Ctx["toast"]>((kind, title, desc, action) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, kind, title, desc, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6500 : 3800);
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setConf({ ...o, resolve })), []);
  const close = (v: boolean) => { conf?.resolve(v); setConf(null); };

  return (
    <FeedbackCtx.Provider value={{ toast, confirm }}>
      {children}
      {createPortal(
        <div className="fixed z-[90] bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 left-5 sm:left-auto flex flex-col items-end gap-2.5 pointer-events-none">
          <AnimatePresence initial={false}>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                transition={{ type: "spring", stiffness: 480, damping: 34 }}
                className="pointer-events-auto w-full sm:w-[380px] bg-white rounded-2xl shadow-pop border border-ink-100 p-4 flex items-start gap-3"
              >
                {t.kind === "success" && <CheckCircle2 className="text-brand-600 shrink-0" size={22} />}
                {t.kind === "error" && <XCircle className="text-red-600 shrink-0" size={22} />}
                {t.kind === "info" && <Info className="text-blue-600 shrink-0" size={22} />}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] text-ink-900">{t.title}</div>
                  {t.desc && <div className="text-[13px] text-ink-500 mt-0.5">{t.desc}</div>}
                </div>
                {t.action && (
                  <button onClick={() => { t.action!.onClick(); setToasts((x) => x.filter((y) => y.id !== t.id)); }} className="text-[13px] font-bold text-brand-700 hover:text-brand-900 px-2 py-1 rounded-lg hover:bg-brand-50">
                    {t.action.label}
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
      <Modal
        open={!!conf}
        onClose={() => close(false)}
        size="sm"
        hideClose
        footer={
          <>
            <div className="flex-1" />
            <Button variant="secondary" onClick={() => close(false)}>Annulla</Button>
            <Button variant={conf?.danger ? "danger" : "primary"} onClick={() => close(true)} data-autofocus>{conf?.confirmLabel ?? "Conferma"}</Button>
          </>
        }
      >
        <div className="pt-7 flex flex-col items-center text-center">
          <div className={`h-14 w-14 rounded-2xl grid place-items-center mb-4 ${conf?.danger ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700"}`}>
            <AlertTriangle size={26} />
          </div>
          <h3 className="text-lg font-bold tracking-tight">{conf?.title}</h3>
          {conf?.message && <div className="text-sm text-ink-500 mt-2 max-w-sm">{conf.message}</div>}
        </div>
      </Modal>
    </FeedbackCtx.Provider>
  );
}
