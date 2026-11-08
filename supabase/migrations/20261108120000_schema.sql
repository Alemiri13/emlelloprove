-- =====================================================================
-- CIA Gestionale — schema iniziale
-- Uffici (Scerni, San Salvo, Vasto), aziende, colture, pratiche, domande,
-- documenti e storico. Accesso solo per gli utenti presenti in `profili`.
-- =====================================================================

create extension if not exists pgcrypto;
create schema if not exists private;

-- ---------- Uffici ----------
create table public.uffici (
  id          text primary key,
  nome        text not null,
  indirizzo   text,
  telefono    text,
  ordine      smallint not null default 0
);

-- ---------- Profili (whitelist utenti) ----------
create table public.profili (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         text not null unique,
  nome             text not null,
  ufficio_preferito text references public.uffici(id),
  created_at       timestamptz not null default now()
);

-- Funzione di controllo accesso: true solo per utenti nella whitelist
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profili p where p.id = (select auth.uid()));
$$;

create or replace function private.nome_utente()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.nome from public.profili p where p.id = (select auth.uid())), 'sistema');
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.nome_utente() to authenticated;

-- ---------- Aziende (anagrafica) ----------
create table public.aziende (
  id            uuid primary key default gen_random_uuid(),
  ufficio_id    text not null references public.uffici(id),
  cuaa          text not null unique
                check (cuaa ~ '^([A-Z0-9]{16}|[0-9]{11})$'),
  denominazione text not null check (length(trim(denominazione)) > 0),
  tipo          text generated always as (case when length(cuaa) = 11 then 'PG' else 'PF' end) stored,
  data_nascita  date,
  sesso         char(1) check (sesso in ('M','F')),
  comune        text,
  indirizzo     text,
  cap           text,
  telefono      text,
  email         text,
  pec           text,
  iban          text,
  sau_ha        numeric(10,2) check (sau_ha is null or sau_ha >= 0),
  biologico     boolean not null default false,
  iap           boolean not null default false,
  uma           boolean not null default false,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index aziende_ufficio_idx on public.aziende(ufficio_id);
create index aziende_denominazione_idx on public.aziende(ufficio_id, denominazione);

-- ---------- Colture ----------
create table public.colture (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  categoria  text not null default 'Altro'
             check (categoria in ('Arboree','Seminativi','Orticole','Foraggere','Vivai e fiori','Altro')),
  colore     text not null default '#5BB44A',
  created_at timestamptz not null default now()
);

create table public.azienda_colture (
  id            uuid primary key default gen_random_uuid(),
  azienda_id    uuid not null references public.aziende(id) on delete cascade,
  coltura_id    uuid not null references public.colture(id) on delete restrict,
  superficie_ha numeric(10,2) check (superficie_ha is null or superficie_ha >= 0),
  varieta       text,
  note          text,
  created_at    timestamptz not null default now(),
  unique (azienda_id, coltura_id)
);
create index azienda_colture_coltura_idx on public.azienda_colture(coltura_id);

-- ---------- Pratiche (annuali e bandi, comuni a tutti gli uffici) ----------
create table public.pratiche (
  id             text primary key,
  codice         text,
  nome           text not null,
  categoria      text not null default 'annuale' check (categoria in ('annuale','bando')),
  ente           text,
  campagna       text,
  unita          text not null default 'euro' check (unita in ('euro','litri')),
  ha_contributo  boolean not null default true,
  apertura       date,
  scadenza       date,
  quota_default  numeric(10,2),
  motivi_tipici  text[] not null default '{}',
  -- criteri di abbinamento: {tipo, etaMin, etaMax, colture:[uuid], biologico, iap, uma, sauMin}
  criteri        jsonb not null default '{"tipo":"tutti"}'::jsonb,
  esempio        boolean not null default false,
  attivo         boolean not null default true,
  note           text,
  ordine         smallint not null default 0,
  created_at     timestamptz not null default now()
);

-- Inclusioni / esclusioni manuali dall'abbinamento automatico
create table public.pratica_abbinamenti (
  pratica_id text not null references public.pratiche(id) on delete cascade,
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  tipo       text not null check (tipo in ('incluso','escluso')),
  created_at timestamptz not null default now(),
  primary key (pratica_id, azienda_id)
);
create index pratica_abbinamenti_azienda_idx on public.pratica_abbinamenti(azienda_id);

-- ---------- Domande ----------
create table public.domande (
  id                      uuid primary key default gen_random_uuid(),
  azienda_id              uuid not null references public.aziende(id) on delete cascade,
  pratica_id              text not null references public.pratiche(id) on delete cascade,
  stato                   char(1) not null default 'C' check (stato in ('N','C','S','R')),
  numero                  text,
  data_presentazione      date,
  esito                   char(1) not null default 'I' check (esito in ('I','A','P','X')),
  motivi                  text[] not null default '{}',
  data_esito              date,
  riesame                 text,
  importo_richiesto       numeric(12,2),
  importo_ammesso         numeric(12,2),
  importo_pagato          numeric(12,2),
  data_pagamento          date,
  stato_pagamento_manuale text check (stato_pagamento_manuale in ('pagata','parziale','non_pagata','non_dovuto')),
  litri_richiesti         integer,
  litri_assegnati         integer,
  n_libretto              text,
  quota_importo           numeric(10,2),
  quota_incassata         boolean not null default false,
  quota_data              date,
  note                    text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  updated_by              text,
  unique (azienda_id, pratica_id)
);
create index domande_pratica_idx on public.domande(pratica_id);

-- ---------- Documenti ----------
create table public.documenti (
  id           uuid primary key default gen_random_uuid(),
  azienda_id   uuid not null references public.aziende(id) on delete cascade,
  pratica_id   text references public.pratiche(id) on delete set null,
  categoria    text not null default 'altro',
  tipo         text not null default 'Altro',
  titolo       text not null,
  numero       text,
  data_doc     date,
  scadenza     date,
  storage_path text,
  file_name    text,
  mime         text,
  size         bigint,
  note         text,
  created_at   timestamptz not null default now(),
  created_by   text
);
create index documenti_azienda_idx on public.documenti(azienda_id);
create index documenti_pratica_idx on public.documenti(pratica_id);

-- ---------- Storico ----------
create table public.storico (
  id         bigint generated always as identity primary key,
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  testo      text not null,
  utente     text,
  created_at timestamptz not null default now()
);
create index storico_azienda_idx on public.storico(azienda_id, created_at desc);

-- =====================================================================
-- Trigger
-- =====================================================================

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger aziende_touch before update on public.aziende
  for each row execute function private.touch_updated_at();

-- Normalizzazione domanda al salvataggio (regole di dominio)
create or replace function private.normalizza_domanda()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_quota numeric;
begin
  -- un pagamento senza esito imposta Ammessa
  if coalesce(new.importo_pagato, 0) > 0 and new.esito = 'I' then
    new.esito := 'A';
  end if;
  -- un esito o un pagamento portano lo stato a Rilasciata
  if new.esito <> 'I' or coalesce(new.importo_pagato, 0) > 0 then
    new.stato := 'R';
  end if;
  -- l'esito ha senso solo per le rilasciate
  if new.stato <> 'R' then
    new.esito := 'I';
    new.motivi := '{}';
  end if;
  -- i motivi solo per le non ammesse
  if new.esito <> 'X' then
    new.motivi := '{}';
  end if;
  -- prima volta Rilasciata: quota servizio CIA di default
  if new.stato = 'R' and new.quota_importo is null
     and (tg_op = 'INSERT' or old.stato is distinct from 'R') then
    select p.quota_default into v_quota from public.pratiche p where p.id = new.pratica_id;
    new.quota_importo := v_quota;
  end if;
  if new.quota_incassata and new.quota_data is null then
    new.quota_data := current_date;
  end if;
  if not new.quota_incassata then
    new.quota_data := null;
  end if;
  new.updated_at := now();
  new.updated_by := private.nome_utente();
  return new;
end $$;

create trigger domande_normalizza before insert or update on public.domande
  for each row execute function private.normalizza_domanda();

-- Storico automatico
create or replace function private.log_storico()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_az uuid;
  v_txt text;
  v_pratica text;
  v_lbl text;
begin
  if tg_table_name = 'aziende' then
    v_az := new.id;
    v_txt := case when tg_op = 'INSERT' then 'Azienda inserita in anagrafica' else 'Dati anagrafici aggiornati' end;
  elsif tg_table_name = 'domande' then
    if tg_op = 'DELETE' then
      v_az := old.azienda_id;
      select nome into v_pratica from public.pratiche where id = old.pratica_id;
      v_txt := 'Domanda rimossa: ' || coalesce(v_pratica, old.pratica_id);
    else
      v_az := new.azienda_id;
      select nome into v_pratica from public.pratiche where id = new.pratica_id;
      v_lbl := case new.stato when 'R' then 'Rilasciata' when 'S' then 'Stampata' when 'C' then 'In compilazione' else 'Non fatta' end;
      if tg_op = 'INSERT' then
        v_txt := 'Nuova domanda ' || coalesce(v_pratica, new.pratica_id) || ' · ' || v_lbl;
      elsif old.stato is distinct from new.stato then
        v_txt := coalesce(v_pratica, new.pratica_id) || ': stato → ' || v_lbl;
      elsif old.esito is distinct from new.esito then
        v_txt := coalesce(v_pratica, new.pratica_id) || ': esito → ' ||
          case new.esito when 'A' then 'Ammessa' when 'P' then 'Ammessa in parte' when 'X' then 'Non ammessa' else 'In istruttoria' end;
      else
        v_txt := coalesce(v_pratica, new.pratica_id) || ': domanda aggiornata';
      end if;
    end if;
  elsif tg_table_name = 'documenti' then
    if tg_op = 'DELETE' then
      v_az := old.azienda_id; v_txt := 'Documento eliminato: ' || old.titolo;
    else
      v_az := new.azienda_id; v_txt := 'Documento archiviato: ' || new.tipo || ' (' || new.titolo || ')';
    end if;
  elsif tg_table_name = 'azienda_colture' then
    if tg_op = 'DELETE' then
      v_az := old.azienda_id;
      select nome into v_lbl from public.colture where id = old.coltura_id;
      v_txt := 'Coltura rimossa: ' || coalesce(v_lbl, '?');
    else
      v_az := new.azienda_id;
      select nome into v_lbl from public.colture where id = new.coltura_id;
      v_txt := case when tg_op = 'INSERT' then 'Coltura aggiunta: ' else 'Coltura aggiornata: ' end || coalesce(v_lbl, '?');
    end if;
  end if;

  if v_az is not null and exists (select 1 from public.aziende where id = v_az) then
    insert into public.storico(azienda_id, testo, utente) values (v_az, v_txt, private.nome_utente());
  end if;
  return coalesce(new, old);
end $$;

create trigger aziende_storico after insert or update on public.aziende
  for each row execute function private.log_storico();
create trigger domande_storico after insert or update or delete on public.domande
  for each row execute function private.log_storico();
create trigger documenti_storico after insert or delete on public.documenti
  for each row execute function private.log_storico();
create trigger azienda_colture_storico after insert or update or delete on public.azienda_colture
  for each row execute function private.log_storico();

-- =====================================================================
-- RLS: accesso solo agli utenti in whitelist
-- =====================================================================
alter table public.uffici              enable row level security;
alter table public.profili             enable row level security;
alter table public.aziende             enable row level security;
alter table public.colture             enable row level security;
alter table public.azienda_colture     enable row level security;
alter table public.pratiche            enable row level security;
alter table public.pratica_abbinamenti enable row level security;
alter table public.domande             enable row level security;
alter table public.documenti           enable row level security;
alter table public.storico             enable row level security;

create policy "staff legge uffici" on public.uffici for select to authenticated using ((select private.is_staff()));
create policy "staff legge profili" on public.profili for select to authenticated using ((select private.is_staff()));
create policy "utente aggiorna il proprio profilo" on public.profili for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['aziende','colture','azienda_colture','pratiche','pratica_abbinamenti','domande','documenti']
  loop
    execute format('create policy "staff gestisce %1$s" on public.%1$I for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t);
  end loop;
end $$;

create policy "staff legge storico" on public.storico for select to authenticated using ((select private.is_staff()));

-- =====================================================================
-- Storage: archivio documenti (privato)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('documenti', 'documenti', false, 20971520)
on conflict (id) do nothing;

create policy "staff legge documenti" on storage.objects for select to authenticated
  using (bucket_id = 'documenti' and (select private.is_staff()));
create policy "staff carica documenti" on storage.objects for insert to authenticated
  with check (bucket_id = 'documenti' and (select private.is_staff()));
create policy "staff elimina documenti" on storage.objects for delete to authenticated
  using (bucket_id = 'documenti' and (select private.is_staff()));

-- ---------- Uffici di base ----------
insert into public.uffici (id, nome, indirizzo, ordine) values
  ('scerni',    'Scerni',    'Scerni (CH)',    1),
  ('san-salvo', 'San Salvo', 'San Salvo (CH)', 2),
  ('vasto',     'Vasto',     'Vasto (CH)',     3);
