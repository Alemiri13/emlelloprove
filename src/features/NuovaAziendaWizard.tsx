import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BadgeCheck, Building2, Cake, Check, Leaf, Mail, MapPin, Phone, Tractor, User, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Wizard } from "../components/ui/Wizard";
import { Field, NumberInput, TextInput, ToggleCard } from "../components/ui/Inputs";
import { useFeedback } from "../components/ui/Feedback";
import { decodeCuaa, eta, normalizzaCuaa } from "../lib/cf";
import { fmtDateLong, ha, titleCase } from "../lib/format";
import { cercaCuaa, useSalvaAzienda } from "../lib/queries";
import { useModals, useUfficio } from "../lib/ufficio";
import { CATEGORIE_COLTURE } from "../lib/domain";

export function NuovaAziendaWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ufficio, uffici, colture } = useUfficio();
  const { apriAzienda } = useModals();
  const salva = useSalvaAzienda();
  const { toast } = useFeedback();
  const [step, setStep] = useState(0);
  const [cuaa, setCuaa] = useState("");
  const [dup, setDup] = useState<{ denominazione: string; ufficio_id: string } | null | "checking">(null);
  const [den, setDen] = useState("");
  const [comune, setComune] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [cap, setCap] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [pec, setPec] = useState("");
  const [sau, setSau] = useState<number | null>(null);
  const [bio, setBio] = useState(false);
  const [iap, setIap] = useState(false);
  const [uma, setUma] = useState(false);
  const [colt, setColt] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (open) {
      setStep(0); setCuaa(""); setDup(null); setDen(""); setComune(""); setIndirizzo(""); setCap(""); setTel(""); setEmail(""); setPec("");
      setSau(null); setBio(false); setIap(false); setUma(false); setColt({});
    }
  }, [open]);

  const c = normalizzaCuaa(cuaa);
  const info = useMemo(() => (c.length >= 11 ? decodeCuaa(c) : null), [c]);

  useEffect(() => {
    if (!info?.valido) { setDup(null); return; }
    setDup("checking");
    const t = setTimeout(async () => {
      try { setDup(await cercaCuaa(c)); } catch { setDup(null); }
    }, 300);
    return () => clearTimeout(t);
  }, [c, info?.valido]);

  useEffect(() => {
    if (info?.valido && info.tipo === "PF" && info.comune && !comune) setComune(info.comune);
  }, [info]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = async () => {
    try {
      const row = await salva.mutateAsync({
        data: {
          ufficio_id: ufficio.id, cuaa: c, denominazione: den.trim().toUpperCase(),
          data_nascita: info?.valido && info.tipo === "PF" ? info.dataNascita : null,
          sesso: info?.valido && info.tipo === "PF" ? info.sesso : null,
          comune: comune.trim() || null, indirizzo: indirizzo.trim() || null, cap: cap.trim() || null,
          telefono: tel.trim() || null, email: email.trim() || null, pec: pec.trim() || null,
          sau_ha: sau, biologico: bio, iap, uma,
        },
        colture: Object.entries(colt).map(([coltura_id, superficie_ha]) => ({ coltura_id, superficie_ha })),
      });
      toast("success", "Azienda inserita", titleCase(row.denominazione));
      onClose();
      setTimeout(() => apriAzienda(row.id), 250);
    } catch (e) { toast("error", "Non è stato possibile salvare", (e as Error).message); }
  };

  const nomeUfficio = (id: string) => uffici.find((u) => u.id === id)?.nome ?? id;
  const okCuaa = !!info?.valido && dup === null;
  const perCat = CATEGORIE_COLTURE.map((cat) => ({ cat, items: colture.filter((x) => x.categoria === cat) })).filter((g) => g.items.length);

  return (
    <Wizard
      open={open}
      onClose={onClose}
      index={step}
      setIndex={setStep}
      title={`Nuova azienda · ${ufficio.nome}`}
      icon={<UserPlus size={20} />}
      loading={salva.isPending}
      finishLabel="Crea azienda"
      onFinish={finish}
      steps={[
        {
          key: "cuaa", title: "CUAA", question: "Qual è il CUAA dell'azienda?", hint: "Codice fiscale (16 caratteri) per le persone fisiche, partita IVA (11 cifre) per società ed enti.", canNext: okCuaa,
          content: (
            <div>
              <TextInput
                size="lg"
                data-autofocus
                autoFocus
                value={cuaa}
                onChange={(e) => setCuaa(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter" && okCuaa) setStep(1); }}
                maxLength={20}
                placeholder="RSSMRA80A01I520X"
                className="!text-[22px] font-mono tracking-[0.08em] !h-16"
                invalid={!!info && !info.valido}
                suffix={<span className="tabular-nums">{c.length}/{c.length > 11 || /[A-Z]/.test(c) ? 16 : 11}</span>}
              />
              <AnimatePresence mode="wait">
                {info && (
                  <motion.div key={info.valido ? "ok" + info.tipo : "ko"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5">
                    {!info.valido ? (
                      <div className="rounded-2xl bg-red-50 text-red-700 px-5 py-4 font-medium flex items-center gap-3"><AlertTriangle size={20} />{info.motivo}</div>
                    ) : (
                      <div className="rounded-2xl bg-brand-50/70 ring-1 ring-brand-100 p-5">
                        <div className="flex items-center gap-3">
                          <span className="h-11 w-11 rounded-xl bg-brand-700 text-white grid place-items-center">{info.tipo === "PF" ? <User size={20} /> : <Building2 size={20} />}</span>
                          <div>
                            <div className="font-bold text-brand-900">{info.tipo === "PF" ? "Persona fisica" : "Società o ente"}</div>
                            <div className="text-sm text-brand-800/70">{info.tipo === "PF" ? "Dati ricavati dal codice fiscale" : "Partita IVA"}</div>
                          </div>
                        </div>
                        {info.tipo === "PF" && (
                          <div className="grid grid-cols-3 gap-3 mt-4">
                            <Mini icon={<Cake size={15} />} label="Nascita" value={info.dataNascita ? fmtDateLong(info.dataNascita) : "—"} />
                            <Mini icon={<User size={15} />} label="Età e sesso" value={`${eta(info.dataNascita) ?? "?"} anni · ${info.sesso === "F" ? "F" : "M"}`} />
                            <Mini icon={<MapPin size={15} />} label="Luogo" value={info.comune ?? (info.estero ? "Estero" : "—")} />
                          </div>
                        )}
                        {info.avviso && <div className="mt-4 text-sm text-amber-700 flex items-center gap-2"><AlertTriangle size={15} />{info.avviso}</div>}
                      </div>
                    )}
                    {dup && dup !== "checking" && (
                      <div className="mt-3 rounded-2xl bg-amber-50 text-amber-800 px-5 py-4 text-sm font-medium flex items-center gap-3">
                        <AlertTriangle size={18} />
                        <span>Questo CUAA è già registrato: <b>{titleCase(dup.denominazione)}</b> (ufficio di {nomeUfficio(dup.ufficio_id)}).</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ),
        },
        {
          key: "nome", title: "Nome", question: info?.valido && info.tipo === "PG" ? "Come si chiama la società?" : "Come si chiama?", hint: info?.valido && info.tipo === "PF" ? "Cognome e nome, come sul codice fiscale." : "Ragione sociale completa.", canNext: den.trim().length > 1,
          content: (
            <div className="space-y-5">
              <TextInput size="lg" autoFocus value={den} onChange={(e) => setDen(e.target.value)} placeholder={info?.valido && info.tipo === "PG" ? "AZIENDA AGRICOLA… S.S." : "ROSSI MARIO"} className="!h-16 !text-[20px] uppercase" onKeyDown={(e) => { if (e.key === "Enter" && den.trim().length > 1) setStep(2); }} />
              <div className="grid sm:grid-cols-[1fr_1fr_120px] gap-4">
                <Field label="Comune"><TextInput value={comune} onChange={(e) => setComune(e.target.value)} icon={<MapPin size={16} />} placeholder="Scerni" /></Field>
                <Field label="Indirizzo" optional><TextInput value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} placeholder="Via, numero civico" /></Field>
                <Field label="CAP" optional><TextInput value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))} maxLength={5} inputMode="numeric" /></Field>
              </div>
            </div>
          ),
        },
        {
          key: "contatti", title: "Contatti", question: "Come possiamo contattarla?", hint: "Puoi saltare questo passaggio e aggiungerli dopo.", optional: true,
          content: (
            <div className="space-y-4">
              <Field label="Telefono"><TextInput size="lg" autoFocus value={tel} onChange={(e) => setTel(e.target.value)} icon={<Phone size={18} />} inputMode="tel" placeholder="333 123 4567" /></Field>
              <Field label="Email"><TextInput size="lg" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail size={18} />} type="email" placeholder="nome@esempio.it" /></Field>
              <Field label="PEC"><TextInput size="lg" value={pec} onChange={(e) => setPec(e.target.value)} placeholder="nome@pec.it" /></Field>
            </div>
          ),
        },
        {
          key: "terreni", title: "Terreni", question: "Quanta terra coltiva?", hint: "La superficie agricola utilizzata e i requisiti servono ad abbinare l'azienda alle pratiche giuste.",
          content: (
            <div className="space-y-5">
              <div className="max-w-xs"><NumberInput size="lg" autoFocus value={sau} onChange={setSau} suffix="ettari" placeholder="0,00" /></div>
              <div className="space-y-3">
                <ToggleCard checked={bio} onChange={setBio} icon={<Leaf size={20} />} title="Agricoltura biologica" desc="Certificata o in conversione" />
                <ToggleCard checked={iap} onChange={setIap} icon={<BadgeCheck size={20} />} title="IAP o coltivatore diretto" desc="Imprenditore agricolo professionale" />
                <ToggleCard checked={uma} onChange={setUma} icon={<Tractor size={20} />} title="Utente UMA" desc="Ha diritto al gasolio agricolo agevolato" />
              </div>
            </div>
          ),
        },
        {
          key: "colture", title: "Colture", question: "Cosa coltiva?", hint: "Tocca le colture praticate. La superficie è facoltativa.", optional: true,
          content: (
            <div className="space-y-6">
              {perCat.map((g) => (
                <div key={g.cat}>
                  <div className="text-[12px] font-bold uppercase tracking-wider text-ink-400 mb-2.5">{g.cat}</div>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((x) => {
                      const on = x.id in colt;
                      return (
                        <motion.button
                          key={x.id}
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setColt((o) => { const n = { ...o }; if (on) delete n[x.id]; else n[x.id] = null; return n; })}
                          className={clsx("h-11 pl-3 pr-4 rounded-2xl border-2 text-[14px] font-semibold flex items-center gap-2 transition-colors", on ? "text-ink-900" : "border-ink-100 text-ink-600 hover:border-ink-200")}
                          style={on ? { borderColor: x.colore, background: x.colore + "14" } : undefined}
                        >
                          <span className={clsx("h-5 w-5 rounded-full grid place-items-center transition-all")} style={{ background: on ? x.colore : x.colore + "33" }}>
                            {on && <Check size={12} className="text-white" strokeWidth={3} />}
                          </span>
                          {x.nome}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {Object.keys(colt).length > 0 && (
                <div className="rounded-2xl bg-ink-50 p-4 space-y-2.5">
                  <div className="text-[13px] font-semibold text-ink-600">Superficie per coltura</div>
                  {Object.keys(colt).map((id) => {
                    const x = colture.find((y) => y.id === id)!;
                    return (
                      <div key={id} className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ background: x.colore }} />
                        <span className="flex-1 font-medium">{x.nome}</span>
                        <div className="w-40"><NumberInput value={colt[id]} onChange={(v) => setColt((o) => ({ ...o, [id]: v }))} suffix="ha" /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ),
        },
        {
          key: "riepilogo", title: "Riepilogo", question: "Tutto corretto?", hint: `L'azienda verrà inserita nell'ufficio di ${ufficio.nome}.`,
          content: (
            <div className="rounded-3xl border border-ink-100 divide-y divide-ink-100">
              <Riga label="CUAA" value={<span className="font-mono">{c}</span>} onEdit={() => setStep(0)} />
              <Riga label="Denominazione" value={den.toUpperCase()} onEdit={() => setStep(1)} />
              <Riga label="Comune" value={[comune, indirizzo].filter(Boolean).join(" · ") || "—"} onEdit={() => setStep(1)} />
              <Riga label="Contatti" value={[tel, email, pec].filter(Boolean).join(" · ") || "—"} onEdit={() => setStep(2)} />
              <Riga label="Terreni" value={[sau != null ? ha(sau) : null, bio && "Biologica", iap && "IAP", uma && "UMA"].filter(Boolean).join(" · ") || "—"} onEdit={() => setStep(3)} />
              <Riga label="Colture" value={Object.keys(colt).map((id) => colture.find((x) => x.id === id)?.nome).join(", ") || "—"} onEdit={() => setStep(4)} />
            </div>
          ),
        },
      ]}
    />
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3.5 py-3">
      <div className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider flex items-center gap-1.5">{icon}{label}</div>
      <div className="font-bold text-[14px] mt-1">{value}</div>
    </div>
  );
}

export function Riga({ label, value, onEdit }: { label: string; value: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="w-32 text-[13px] text-ink-500 shrink-0">{label}</span>
      <span className="flex-1 font-semibold text-[15px] min-w-0 break-words">{value}</span>
      {onEdit && <button type="button" onClick={onEdit} className="text-[13px] font-semibold text-brand-700 hover:text-brand-900 px-2.5 py-1 rounded-lg hover:bg-brand-50">Modifica</button>}
    </div>
  );
}
