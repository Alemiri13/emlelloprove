import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { type ReactNode } from "react";
import clsx from "clsx";
import { Modal } from "./Modal";
import { Button } from "./Button";

export interface WizardStep {
  key: string;
  title: string;
  question: string;
  hint?: string;
  canNext?: boolean;
  optional?: boolean;
  content: ReactNode;
}

/** Modale a step: una domanda alla volta, transizioni laterali, barra di avanzamento. */
export function Wizard({ open, onClose, steps, index, setIndex, onFinish, finishLabel = "Salva", loading, title, icon }: {
  open: boolean; onClose: () => void; steps: WizardStep[]; index: number; setIndex: (i: number) => void;
  onFinish: () => void; finishLabel?: string; loading?: boolean; title: string; icon?: ReactNode;
}) {
  const step = steps[index];
  const last = index === steps.length - 1;
  const next = () => (last ? onFinish() : setIndex(index + 1));

  return (
    <Modal open={open} onClose={onClose} size="lg" hideClose className="sm:min-h-[560px]" bodyClassName="!px-0 !pb-0 flex flex-col">
      {step && (
        <>
          <div className="px-8 pt-7">
            <div className="flex items-center gap-3 mb-6">
              {icon && <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand-50 text-brand-800">{icon}</span>}
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-ink-500">{title}</div>
                <div className="text-[12px] text-ink-400">Passo {index + 1} di {steps.length}</div>
              </div>
              <button onClick={onClose} className="h-10 px-4 rounded-full text-[13px] font-semibold text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition">Annulla</button>
            </div>
            <div className="flex gap-1.5">
              {steps.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => i < index && setIndex(i)}
                  className={clsx("group flex-1 text-left", i < index ? "cursor-pointer" : "cursor-default")}
                >
                  <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                    <motion.div className="h-full bg-brand-600 rounded-full" initial={false} animate={{ width: i < index || steps.length === 1 ? "100%" : i === index ? "50%" : "0%" }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                  <div className={clsx("mt-2 text-[11.5px] font-semibold truncate hidden sm:flex items-center gap-1 transition-colors", i === index ? "text-brand-800" : i < index ? "text-ink-500 group-hover:text-ink-800" : "text-ink-300")}>
                    {i < index && <Check size={12} strokeWidth={3} />}
                    {s.title}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="px-8 pt-8 pb-6 h-full overflow-y-auto max-h-[56vh]"
              >
                <h2 className="text-[26px] leading-tight font-extrabold tracking-[-0.03em] text-ink-900">{step.question}</h2>
                {step.hint && <p className="text-[15px] text-ink-500 mt-2">{step.hint}</p>}
                <div className="mt-7">{step.content}</div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="px-8 py-5 border-t border-ink-100 flex items-center gap-3 bg-white">
            {index > 0 ? (
              <Button variant="ghost" size="lg" icon={<ArrowLeft size={18} />} onClick={() => setIndex(index - 1)} className="!px-4">Indietro</Button>
            ) : <span />}
            <div className="flex-1" />
            {step.optional && !last && (
              <Button variant="ghost" size="lg" onClick={() => setIndex(index + 1)}>Salta</Button>
            )}
            <Button
              size="lg"
              onClick={next}
              disabled={step.canNext === false}
              loading={loading}
              iconRight={last ? <Check size={18} strokeWidth={2.5} /> : <ArrowRight size={18} />}
              className="min-w-[150px]"
            >
              {last ? finishLabel : "Avanti"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
