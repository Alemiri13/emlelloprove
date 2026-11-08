export type StatoDomanda = "N" | "C" | "S" | "R";
export type Esito = "I" | "A" | "P" | "X";

export interface Ufficio { id: string; nome: string; indirizzo: string | null; telefono: string | null; ordine: number }
export interface Profilo { id: string; username: string; nome: string; ufficio_preferito: string | null }

export interface Coltura { id: string; nome: string; categoria: string; colore: string; created_at: string }
export interface AziendaColtura { id: string; azienda_id: string; coltura_id: string; superficie_ha: number | null; varieta: string | null; note: string | null }

export interface Azienda {
  id: string; ufficio_id: string; cuaa: string; denominazione: string; tipo: "PF" | "PG";
  data_nascita: string | null; sesso: "M" | "F" | null; comune: string | null; indirizzo: string | null; cap: string | null;
  telefono: string | null; email: string | null; pec: string | null; iban: string | null;
  sau_ha: number | null; biologico: boolean; iap: boolean; uma: boolean; note: string | null;
  created_at: string; updated_at: string;
  azienda_colture?: AziendaColtura[];
}

export interface Criteri {
  tipo?: "tutti" | "PF" | "PG"; etaMin?: number | null; etaMax?: number | null; colture?: string[];
  biologico?: boolean; iap?: boolean; uma?: boolean; sauMin?: number | null;
}

export interface Pratica {
  id: string; codice: string | null; nome: string; categoria: "annuale" | "bando"; ente: string | null; campagna: string | null;
  unita: "euro" | "litri"; apertura: string | null; scadenza: string | null;
  motivi_tipici: string[]; criteri: Criteri; esempio: boolean; attivo: boolean; note: string | null; ordine: number;
  tipo_domanda_id: string | null;
  /** calcolato per l'ufficio corrente: è stato caricato l'elenco delle domande da fare */
  modello?: boolean;
}

export interface TipoDomanda {
  id: string; nome: string; codice: string | null; tipologia: "annuale" | "una_tantum"; ambito: string; ente: string | null;
  periodo: string | null; descrizione: string | null; unita: "euro" | "litri"; criteri: Criteri; parole: string[]; fonte: string | null; ordine: number;
}

export interface Caricamento {
  id: string; pratica_id: string; ufficio_id: string; tipo: "modello" | "fatte"; file_names: string[]; righe: number;
  riepilogo: Record<string, unknown>; created_at: string; created_by: string | null;
}

export interface Abbinamento { pratica_id: string; azienda_id: string; tipo: "incluso" | "escluso" }

export interface Domanda {
  id: string; azienda_id: string; pratica_id: string; stato: StatoDomanda; numero: string | null; data_presentazione: string | null;
  esito: Esito; motivi: string[]; data_esito: string | null; riesame: string | null;
  litri_richiesti: number | null; litri_assegnati: number | null; n_libretto: string | null; note: string | null;
  created_at: string; updated_at: string; updated_by: string | null;
}

export interface Documento {
  id: string; azienda_id: string; pratica_id: string | null; categoria: string; tipo: string; titolo: string; numero: string | null;
  data_doc: string | null; scadenza: string | null; storage_path: string | null; file_name: string | null; mime: string | null;
  size: number | null; note: string | null; created_at: string; created_by: string | null;
  analisi?: AnalisiSalvata | null; testo?: string | null; importo?: number | null; controparte?: string | null;
  foglio?: string | null; particelle?: string | null; superficie_ha?: number | null;
}

/** Sintesi dell'analisi automatica salvata con il documento. */
export interface AnalisiSalvata {
  versione: number; metodo: string; tipo: string; categoria: string; confidenza: number;
  indizi: string[]; alternative: { tipo: string; confidenza: number }[]; cuaa_trovati: string[]; corretto: boolean;
}

export interface Storico { id: number; azienda_id: string; testo: string; utente: string | null; created_at: string }

/** Riga normalizzata di un file Excel caricato in una pratica. */
export interface RigaFile {
  riga: number; cuaa: string | null; denominazione: string | null; stato: StatoDomanda | null;
  numero: string | null; data: string | null; esito: Esito | null; note: string | null;
}

export interface PraticaFile {
  id: string; pratica_id: string; ufficio_id: string; tipo: "modello" | "fatte"; nome: string; righe: RigaFile[];
  colonne: Record<string, string>; stato_predefinito: "C" | "S" | "R"; n_righe: number; storage_path: string | null;
  created_at: string; created_by: string | null;
}

/** Riga dell'elenco «domande da fare» di una pratica (indipendente dall'anagrafica). */
export interface Voce {
  id: string; pratica_id: string; ufficio_id: string; file_id: string | null; cuaa: string | null; denominazione: string | null;
  extra: Record<string, unknown>; stato_manuale: StatoDomanda | null; numero: string | null; data_presentazione: string | null;
  esito: Esito | null; motivi: string[]; riesame: string | null; note: string | null; ordine: number;
  created_at: string; updated_at: string; updated_by: string | null;
}
