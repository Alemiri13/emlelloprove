import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { LoginPage } from "./pages/Login";
import { UfficiPage } from "./pages/Uffici";
import { AppShell } from "./components/layout/AppShell";
import { HomePage } from "./pages/Home";
import { AnagraficaPage } from "./pages/Anagrafica";
import { DomandePage } from "./pages/Domande";
import { ColturePage } from "./pages/Colture";
import { PratichePage } from "./pages/Pratiche";
import { DaFarePage } from "./pages/DaFare";
import { Spinner } from "./components/ui/Spinner";
import type { ReactNode } from "react";

function Protected({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="h-screen grid place-items-center"><Spinner size={28} className="text-brand-700" /></div>;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/uffici" element={<Protected><UfficiPage /></Protected>} />
      <Route path="/u/:ufficio" element={<Protected><AppShell /></Protected>}>
        <Route index element={<HomePage />} />
        <Route path="anagrafica" element={<AnagraficaPage />} />
        <Route path="domande" element={<DomandePage />} />
        <Route path="colture" element={<ColturePage />} />
        <Route path="pratiche" element={<PratichePage />} />
        <Route path="da-fare" element={<DaFarePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/uffici" replace />} />
    </Routes>
  );
}
