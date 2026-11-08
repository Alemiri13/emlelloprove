export type StatoDomanda = "N" | "C" | "S" | "R";
export type Esito = "I" | "A" | "P" | "X";
export type StatoPagamento = "pagata" | "parziale" | "non_pagata" | "non_dovuto" | "attesa";

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
  unita: "euro" | "litri"; ha_contributo: boolean; apertura: string | null; scadenza: string | null; quota_default: number | null;
  motivi_tipici: string[]; criteri: Criteri; esempio: boolean; attivo: boolean; note: string | null; ordine: number;
}

export interface Abbinamento { pratica_id: string; azienda_id: string; tipo: "incluso" | "escluso" }

export interface Domanda {
  id: string; azienda_id: string; pratica_id: string; stato: StatoDomanda; numero: string | null; data_presentazione: string | null;
  esito: Esito; motivi: string[]; data_esito: string | null; riesame: string | null;
  importo_richiesto: number | null; importo_ammesso: number | null; importo_pagato: number | null; data_pagamento: string | null;
  stato_pagamento_manuale: Exclude<StatoPagamento, "attesa"> | null;
  litri_richiesti: number | null; litri_assegnati: number | null; n_libretto: string | null;
  quota_importo: number | null; quota_incassata: boolean; quota_data: string | null; note: string | null;
  created_at: string; updated_at: string; updated_by: string | null;
}

export interface Documento {
  id: string; azienda_id: string; pratica_id: string | null; categoria: string; tipo: string; titolo: string; numero: string | null;
  data_doc: string | null; scadenza: string | null; storage_path: string | null; file_name: string | null; mime: string | null;
  size: number | null; note: string | null; created_at: string; created_by: string | null;
}

export interface Storico { id: number; azienda_id: string; testo: string; utente: string | null; created_at: string }
