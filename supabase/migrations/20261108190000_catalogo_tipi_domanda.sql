-- Applicata. Domande senza importi/pagamenti/quota (regole) e catalogo dei tipi di domanda.
create or replace function private.normalizza_domanda()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.esito <> 'I' then new.stato := 'R'; end if;
  if new.stato <> 'R' then new.esito := 'I'; end if;
  if new.esito <> 'X' then new.motivi := '{}'; end if;
  new.updated_at := now();
  new.updated_by := private.nome_utente();
  return new;
end $$;

create table if not exists public.tipi_domanda (
  id           text primary key,
  nome         text not null,
  codice       text,
  tipologia    text not null check (tipologia in ('annuale', 'una_tantum')),
  ambito       text not null default 'Altro',
  ente         text,
  periodo      text,
  descrizione  text,
  unita        text not null default 'euro' check (unita in ('euro', 'litri')),
  criteri      jsonb not null default '{"tipo":"tutti"}'::jsonb,
  parole       text[] not null default '{}',
  fonte        text,
  ordine       smallint not null default 0
);
alter table public.tipi_domanda enable row level security;
create policy "staff legge catalogo" on public.tipi_domanda for select to authenticated using ((select private.is_staff()));
create policy "staff gestisce catalogo" on public.tipi_domanda for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

alter table public.pratiche add column if not exists tipo_domanda_id text references public.tipi_domanda(id) on delete set null;
