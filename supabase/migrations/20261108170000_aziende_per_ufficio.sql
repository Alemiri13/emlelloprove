-- Ogni ufficio ha la propria anagrafica: lo stesso CUAA può esistere in più uffici,
-- ognuno con domande, colture e documenti propri.
alter table public.aziende drop constraint if exists aziende_cuaa_key;
alter table public.aziende add constraint aziende_ufficio_cuaa_key unique (ufficio_id, cuaa);
create index if not exists aziende_cuaa_idx on public.aziende(cuaa);
comment on table public.aziende is 'Anagrafica per ufficio: la stessa azienda (CUAA) può essere presente in più uffici, ognuno con le proprie domande e documenti';
