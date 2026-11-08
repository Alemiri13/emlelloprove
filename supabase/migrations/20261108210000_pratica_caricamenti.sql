-- Caricamenti Excel per pratica e ufficio: il primo «modello» definisce le domande da fare
-- (le aziende entrano nella pratica come abbinamenti «incluso»), i successivi «fatte» aggiornano gli stati.
create table if not exists public.pratica_caricamenti (
  id          uuid primary key default gen_random_uuid(),
  pratica_id  text not null references public.pratiche(id) on delete cascade,
  ufficio_id  text not null references public.uffici(id),
  tipo        text not null check (tipo in ('modello', 'fatte')),
  file_names  text[] not null default '{}',
  righe       integer not null default 0,
  riepilogo   jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  created_by  text
);
create index if not exists pratica_caricamenti_idx on public.pratica_caricamenti(pratica_id, ufficio_id, created_at desc);
alter table public.pratica_caricamenti enable row level security;
create policy "staff gestisce caricamenti" on public.pratica_caricamenti for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

-- collegamento delle pratiche esistenti al catalogo
update public.pratiche set tipo_domanda_id = 'du' where id = 'du2026';
update public.pratiche set tipo_domanda_id = 'uma' where id = 'uma2026';
update public.pratiche set tipo_domanda_id = 'vendemmia' where id = 'dichiarazioni-di-vendemmia';
update public.pratiche set tipo_domanda_id = 'sre01' where id = 'sre01';
update public.pratiche set tipo_domanda_id = 'sra29' where id = 'sra29';
update public.pratiche set tipo_domanda_id = 'credito-carburanti' where id = 'rimborso-gasolio';
