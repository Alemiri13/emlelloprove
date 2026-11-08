-- Elenchi delle pratiche indipendenti dall'anagrafica.
-- pratica_file: i file Excel caricati (elenco «da fare» = modello, e file delle domande fatte),
--               con le righe già normalizzate per poter rifare il riscontro e il file originale in Storage.
-- pratica_voci: le righe dell'elenco «da fare» (modificabili); lo stato si ricava dal riscontro con i file
--               delle fatte, salvo uno stato impostato a mano (stato_manuale).
create table if not exists public.pratica_file (
  id                uuid primary key default gen_random_uuid(),
  pratica_id        text not null references public.pratiche(id) on delete cascade,
  ufficio_id        text not null references public.uffici(id),
  tipo              text not null check (tipo in ('modello', 'fatte')),
  nome              text not null,
  righe             jsonb not null default '[]'::jsonb,
  colonne           jsonb not null default '{}'::jsonb,
  stato_predefinito char(1) not null default 'R' check (stato_predefinito in ('C','S','R')),
  n_righe           integer not null default 0,
  storage_path      text,
  created_at        timestamptz not null default now(),
  created_by        text
);
create index if not exists pratica_file_idx on public.pratica_file(pratica_id, ufficio_id, created_at);

create table if not exists public.pratica_voci (
  id                 uuid primary key default gen_random_uuid(),
  pratica_id         text not null references public.pratiche(id) on delete cascade,
  ufficio_id         text not null references public.uffici(id),
  file_id            uuid references public.pratica_file(id) on delete set null,
  cuaa               text,
  denominazione      text,
  extra              jsonb not null default '{}'::jsonb,
  stato_manuale      char(1) check (stato_manuale in ('N','C','S','R')),
  numero             text,
  data_presentazione date,
  esito              char(1) check (esito in ('I','A','P','X')),
  motivi             text[] not null default '{}',
  riesame            text,
  note               text,
  ordine             integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         text
);
create index if not exists pratica_voci_idx on public.pratica_voci(pratica_id, ufficio_id);

create or replace function private.firma_voce()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := private.nome_utente();
  return new;
end $$;
create trigger pratica_voci_firma before insert or update on public.pratica_voci
  for each row execute function private.firma_voce();

alter table public.pratica_file enable row level security;
alter table public.pratica_voci enable row level security;
create policy "staff gestisce file pratiche" on public.pratica_file for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "staff gestisce voci pratiche" on public.pratica_voci for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "staff aggiorna documenti" on storage.objects for update to authenticated using (bucket_id = 'documenti' and (select private.is_staff()));
