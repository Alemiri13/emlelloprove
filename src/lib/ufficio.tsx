import { createContext, useContext } from "react";
import type { Abbinamento, Azienda, Caricamento, Coltura, Domanda, Pratica, Ufficio } from "./types";

export interface UfficioData {
  ufficio: Ufficio;
  uffici: Ufficio[];
  aziende: Azienda[];
  domande: Domanda[];
  pratiche: Pratica[];
  colture: Coltura[];
  abbinamenti: Abbinamento[];
  caricamenti: Caricamento[];
  loading: boolean;
  azById: Map<string, Azienda>;
  praticaById: Map<string, Pratica>;
  colturaById: Map<string, Coltura>;
  domandaByKey: Map<string, Domanda>;
}
export const UfficioCtx = createContext<UfficioData>(null!);
export const useUfficio = () => useContext(UfficioCtx);

export interface ModalsApi {
  apriAzienda: (id: string, tab?: string) => void;
  apriDomanda: (aziendaId: string, praticaId: string) => void;
  nuovaAzienda: () => void;
  nuovaDomanda: () => void;
}
export const ModalsCtx = createContext<ModalsApi>(null!);
export const useModals = () => useContext(ModalsCtx);
