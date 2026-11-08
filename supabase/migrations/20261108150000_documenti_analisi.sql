-- Caricamento intelligente: metadati dell'analisi automatica dei documenti
alter table public.documenti
  add column if not exists analisi jsonb,
  add column if not exists testo text,
  add column if not exists importo numeric(12,2),
  add column if not exists controparte text,
  add column if not exists foglio text,
  add column if not exists particelle text,
  add column if not exists superficie_ha numeric(10,4);
comment on column public.documenti.analisi is 'Esito dell''analisi automatica: tipo riconosciuto, confidenza, indizi, campi estratti';
comment on column public.documenti.testo is 'Testo estratto dal file (PDF, OCR o XML), troncato, per la ricerca';
