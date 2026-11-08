import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, FileStack, House, Plus, Sprout, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import { useAbbinamenti, useAziende, useColture, useDomande, usePraticaFile, usePratiche, useUffici, useVoci } from "../../lib/queries";
import { riscontro, type Riscontro } from "../../lib/riscontro";
import { ModalsCtx, UfficioCtx, type ModalsApi, type UfficioData } from "../../lib/ufficio";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import { Spinner } from "../ui/Spinner";
import { AziendaModal } from "../../features/AziendaModal";
import { VoceModal } from "../../features/pratica/VoceModal";
import { NuovaAziendaWizard } from "../../features/NuovaAziendaWizard";
import { NuovaDomanda } from "../../features/NuovaDomanda";
import { hasOpenModal } from "../ui/Modal";
import { ErroreApp } from "../ErroreApp";

const NAV = [
  { to: "", label: "Home", icon: House, end: true },
  { to: "anagrafica", label: "Anagrafica", icon: Users },
  { to: "domande", label: "Domande", icon: ClipboardList },
  { to: "colture", label: "Colture", icon: Sprout },
  { to: "pratiche", label: "Pratiche e bandi", icon: FileStack },
];

export function AppShell() {
  const { ufficio: ufficioId } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const uffici = useUffici();
  const aziende = useAziende(ufficioId);
  const domande = useDomande(ufficioId);
  const pratiche = usePratiche();
  const colture = useColture();
  const abb = useAbbinamenti();
  const voci = useVoci(ufficioId);
  const pfile = usePraticaFile(ufficioId);

  const [azModal, setAzModal] = useState<{ id: string; tab?: string } | null>(null);
  const [voceModal, setVoceModal] = useState<string | null>(null);
  const [newAz, setNewAz] = useState(false);
  const [newDom, setNewDom] = useState(false);

  useEffect(() => { try { if (ufficioId) localStorage.setItem("cia-ufficio", ufficioId); } catch { /* ignore */ } }, [ufficioId]);
  // chiudi i modali quando cambi ufficio
  useEffect(() => { setAzModal(null); setVoceModal(null); }, [ufficioId]);

  const ufficio = uffici.data?.find((u) => u.id === ufficioId);

  const data = useMemo<UfficioData | null>(() => {
    if (!ufficio) return null;
    const az = aziende.data ?? [];
    const dom = domande.data ?? [];
    const vo = voci.data ?? [];
    const pf = pfile.data ?? [];
    const pr = (pratiche.data ?? []).map((p) => ({ ...p, modello: pf.some((f) => f.pratica_id === p.id && f.tipo === "modello") }));
    const co = colture.data ?? [];
    const riscontri = new Map<string, Riscontro>();
    for (const p of pr) {
      const vp = vo.filter((v) => v.pratica_id === p.id);
      const fp = pf.filter((f) => f.pratica_id === p.id);
      if (vp.length || fp.length) riscontri.set(p.id, riscontro(vp, fp));
    }
    return {
      ufficio, uffici: uffici.data ?? [], aziende: az, domande: dom, pratiche: pr, colture: co, abbinamenti: abb.data ?? [], voci: vo, praticaFile: pf, riscontri,
      loading: aziende.isLoading || pratiche.isLoading || colture.isLoading || voci.isLoading || pfile.isLoading,
      azById: new Map(az.map((a) => [a.id, a])),
      praticaById: new Map(pr.map((p) => [p.id, p])),
      colturaById: new Map(co.map((c) => [c.id, c])),
      domandaByKey: new Map(dom.map((d) => [d.azienda_id + "|" + d.pratica_id, d])),
    };
  }, [ufficio, uffici.data, aziende.data, domande.data, pratiche.data, colture.data, abb.data, voci.data, pfile.data, aziende.isLoading, pratiche.isLoading, colture.isLoading, voci.isLoading, pfile.isLoading]);

  const modals = useMemo<ModalsApi>(() => ({
    apriAzienda: (id, tab) => setAzModal({ id, tab }),
    apriVoce: (id) => setVoceModal(id),
    nuovaAzienda: () => setNewAz(true),
    nuovaDomanda: () => setNewDom(true),
  }), []);


  // scorciatoia "/" per la ricerca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !hasOpenModal() && !(e.target as HTMLElement).closest("input,textarea")) {
        const el = document.querySelector<HTMLInputElement>("[data-search]");
        if (el) { e.preventDefault(); el.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (uffici.isLoading) return <div className="h-screen grid place-items-center"><Spinner size={28} className="text-brand-700" /></div>;
  if (!ufficio) return <Navigate to="/uffici" replace />;

  const section = loc.pathname.split("/")[3] ?? "";
  const switchUfficio = (id: string) => nav(`/u/${id}${section ? "/" + section : ""}`);

  return (
    <UfficioCtx.Provider value={data!}>
      <ModalsCtx.Provider value={modals}>
        <div className="min-h-screen bg-ink-50/70 lg:pl-[264px] overflow-x-clip">
          {/* sidebar */}
          <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] flex-col bg-white border-r border-ink-100 z-30">
            <div className="h-20 flex items-center px-7"><Logo className="h-9 w-auto" /></div>
            <div className="px-4">
              <button
                onClick={() => setNewDom(true)}
                className="w-full h-12 rounded-2xl bg-brand-800 text-white font-semibold text-[14px] flex items-center justify-center gap-2 shadow-[0_8px_20px_-8px_rgba(0,80,42,.65)] hover:bg-brand-900 active:scale-[.98] transition"
              >
                <Plus size={18} strokeWidth={2.5} /> Nuova domanda
              </button>
            </div>
            <nav className="mt-6 px-3 flex-1 space-y-1">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className="block">
                  {({ isActive }) => (
                    <span className={clsx("relative flex items-center gap-3.5 h-12 px-4 rounded-2xl text-[14.5px] font-semibold transition-colors", isActive ? "text-brand-900" : "text-ink-500 hover:text-ink-900 hover:bg-ink-50")}>
                      {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-2xl bg-brand-50 ring-1 ring-inset ring-brand-100" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                      <n.icon size={20} className="relative" strokeWidth={isActive ? 2.3 : 2} />
                      <span className="relative flex-1">{n.label}</span>
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="p-4 m-3 rounded-2xl bg-ink-50 text-xs text-ink-500">
              <div className="font-semibold text-ink-700 mb-0.5">Ufficio di {ufficio.nome}</div>
              {data?.aziende.length ?? 0} aziende · {data?.voci.length ?? 0} domande negli elenchi
            </div>
          </aside>

          {/* topbar */}
          <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-ink-100">
            <div className="h-[72px] px-4 sm:px-8 flex items-center gap-4">
              <Logo className="h-7 w-auto lg:hidden hidden sm:block" />
              <div className="flex-1 flex justify-center lg:justify-start overflow-x-auto">
                <UfficioSwitch value={ufficio.id} uffici={uffici.data ?? []} onChange={switchUfficio} />
              </div>
              <UserMenu />
            </div>
          </header>

          <main className="px-4 sm:px-8 py-8 pb-28 lg:pb-12 max-w-[1400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={ufficio.id + section}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {data && <ErroreApp compatto resetKey={loc.pathname}><Outlet /></ErroreApp>}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* bottom nav mobile */}
          <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-xl border-t border-ink-100 px-2 pb-[env(safe-area-inset-bottom)]">
            <div className="flex">
              {NAV.slice(0, 5).map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className="flex-1">
                  {({ isActive }) => (
                    <span className={clsx("flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold", isActive ? "text-brand-800" : "text-ink-400")}>
                      <n.icon size={21} />
                      {n.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>

        {data && (
          <>
            <AziendaModal state={azModal} onClose={() => setAzModal(null)} />
            <VoceModal id={voceModal} onClose={() => setVoceModal(null)} />
            <NuovaAziendaWizard open={newAz} onClose={() => setNewAz(false)} />
            <NuovaDomanda open={newDom} onClose={() => setNewDom(false)} />
          </>
        )}
      </ModalsCtx.Provider>
    </UfficioCtx.Provider>
  );
}

function UfficioSwitch({ value, uffici, onChange }: { value: string; uffici: { id: string; nome: string }[]; onChange: (id: string) => void }) {
  return (
    <div className="inline-flex items-center p-1 rounded-2xl bg-ink-100/80 gap-1">
      {uffici.map((u) => {
        const on = u.id === value;
        return (
          <button
            key={u.id}
            onClick={() => onChange(u.id)}
            className={clsx("relative h-10 sm:h-11 px-3 sm:px-6 rounded-xl text-[13px] sm:text-[14px] font-bold whitespace-nowrap transition-colors", on ? "text-white" : "text-ink-500 hover:text-ink-900")}
          >
            {on && <motion.span layoutId="ufficio-pill" className="absolute inset-0 rounded-xl bg-brand-800 shadow-[0_6px_16px_-6px_rgba(0,80,42,.7)]" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
            <span className="relative flex items-center gap-2">
              <span className={clsx("hidden sm:block h-1.5 w-1.5 rounded-full transition-colors", on ? "bg-brand-300" : "bg-ink-300")} />
              {u.nome}
            </span>
          </button>
        );
      })}
    </div>
  );
}
