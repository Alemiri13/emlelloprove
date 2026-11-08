import { createContext, useContext } from "react";
import type { Abbinamento, Azienda, Coltura, Domanda, Pratica, PraticaFile, Ufficio, Voce } from "./types";
import type { Riscontro } from "./riscontro";

export interface UfficioData {
  ufficio: Ufficio;
  uffici: Ufficio[];
  aziende: Azienda[];
  domande: Domanda[];
  pratiche: Pratica[];
  colture: Coltura[];
  abbinamenti: Abbinamento[];
  voci: Voce[];
  praticaFile: PraticaFile[];
  /** riscontro elenco/file fatte per ogni pratica dell'ufficio */
  riscontri: Map<string, Riscontro>;
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
  apriVoce: (voceId: string) => void;
  nuovaAzienda: () => void;
  nuovaDomanda: () => void;
}
export const ModalsCtx = createContext<ModalsApi>(null!);
export const useModals = () => useContext(ModalsCtx);
