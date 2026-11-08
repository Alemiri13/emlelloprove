import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { FeedbackProvider } from "./components/ui/Feedback";
import { ErroreApp, erroreVersione, ricaricaUnaVolta } from "./components/ErroreApp";
import "./index.css";

// dopo un aggiornamento una pagina rimasta aperta può cercare file JS che non esistono più: ricarico una volta
window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); ricaricaUnaVolta(); });
window.addEventListener("unhandledrejection", (e) => { if (erroreVersione(e.reason)) ricaricaUnaVolta(); });

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErroreApp>
    <QueryClientProvider client={qc}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <AuthProvider>
            <FeedbackProvider>
              <App />
            </FeedbackProvider>
          </AuthProvider>
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
    </ErroreApp>
  </React.StrictMode>,
);
