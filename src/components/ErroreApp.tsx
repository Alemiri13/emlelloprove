import { Component, type ErrorInfo, type ReactNode } from "react";

const CHIAVE = "cia-ricaricato";

/** Errori tipici di una versione vecchia rimasta aperta dopo un aggiornamento (i file JS non esistono più). */
export function erroreVersione(e: unknown) {
  const m = String((e as Error)?.message ?? e);
  return /dynamically imported module|Importing a module script failed|error loading dynamically|Loading chunk|ChunkLoadError|Unable to preload CSS/i.test(m);
}

/** Ricarica una sola volta (per non entrare in un ciclo se il problema è un altro). */
export function ricaricaUnaVolta() {
  try {
    const ultimo = Number(sessionStorage.getItem(CHIAVE) ?? 0);
    if (Date.now() - ultimo < 30_000) return false;
    sessionStorage.setItem(CHIAVE, String(Date.now()));
  } catch { /* storage non disponibile: ricarico comunque */ }
  window.location.reload();
  return true;
}

/** Al posto dello schermo bianco: messaggio chiaro e pulsante per ricaricare. */
export class ErroreApp extends Component<{ children: ReactNode; resetKey?: unknown; compatto?: boolean }, { errore: Error | null }> {
  state = { errore: null as Error | null };
  static getDerivedStateFromError(errore: Error) { return { errore }; }
  componentDidCatch(errore: Error, info: ErrorInfo) {
    console.error("Errore nell'interfaccia:", errore, info.componentStack);
    if (erroreVersione(errore)) ricaricaUnaVolta();
  }
  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (this.state.errore && prev.resetKey !== this.props.resetKey) this.setState({ errore: null });
  }
  render() {
    const e = this.state.errore;
    if (!e) return this.props.children;
    const versione = erroreVersione(e);
    return (
      <div className={this.props.compatto ? "py-16 px-4" : "min-h-screen grid place-items-center px-4 bg-[#F7F9F7]"}>
        <div className="max-w-md mx-auto text-center rounded-3xl bg-white border border-[#E5EAE6] shadow-[0_20px_50px_-30px_rgba(0,60,30,.35)] p-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-[#EAF4EC] text-[#0B5A2E] grid place-items-center text-2xl font-black">!</div>
          <h1 className="mt-5 text-[22px] font-extrabold tracking-tight text-[#14201A]">{versione ? "È uscita una nuova versione" : "Qualcosa non ha funzionato"}</h1>
          <p className="mt-2 text-[14.5px] text-[#5E6B64]">
            {versione ? "Ricarica la pagina per usare l'ultima versione dell'app." : "I tuoi dati sono al sicuro. Ricarica la pagina; se l'errore si ripete, comunica il messaggio qui sotto."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={() => window.location.reload()} className="h-12 px-6 rounded-2xl bg-[#0B5A2E] text-white font-semibold hover:bg-[#08451F] transition">Ricarica la pagina</button>
            {!this.props.compatto && <button onClick={() => { window.location.href = "/uffici"; }} className="h-12 px-5 rounded-2xl border border-[#E5EAE6] font-semibold text-[#14201A] hover:bg-[#F2F5F3] transition">Vai agli uffici</button>}
          </div>
          {!versione && <pre className="mt-5 text-left text-[11.5px] text-[#8A968F] bg-[#F7F9F7] rounded-xl p-3 whitespace-pre-wrap break-words max-h-32 overflow-auto">{e.message}</pre>}
        </div>
      </div>
    );
  }
}
