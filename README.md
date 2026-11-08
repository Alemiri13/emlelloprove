# CIA Gestionale

Gestionale per gli uffici CIA di **Scerni**, **San Salvo** e **Vasto**: anagrafica delle aziende agricole, colture, domande (pratiche annuali e bandi), documenti e attività da fare.

Stack: React + TypeScript + Vite + Tailwind, Supabase (Postgres, Auth, Storage) con RLS.

## Avvio

```bash
npm install
cp .env.example .env   # URL e chiave pubblica del progetto Supabase "Cia Project"
npm run dev
```

Build di produzione: `npm run build` (output in `dist/`, sito statico deployabile su qualsiasi hosting).

## Struttura

- `supabase/migrations/` — schema del database: uffici, profili (whitelist utenti), aziende, colture, azienda_colture, pratiche, pratica_abbinamenti, domande, documenti, storico; trigger di normalizzazione delle domande e di storico; policy RLS; bucket privato `documenti`.
- `scripts/seed_from_export.py` — genera l'SQL di seed dall'export dell'artifact originale (`data/`). **L'export contiene dati personali reali: non va committato** (è in `.gitignore`).
- `src/lib/` — client Supabase, query (React Query), regole di dominio (stati, esiti, pagamenti, abbinamento automatico, attività), decodifica CUAA/codice fiscale.
- `src/components/ui/` — componenti su misura: select, calendario, modali, wizard a step, toggle, checkbox, toast, conferme. Nessun controllo nativo del browser.
- `src/pages/` e `src/features/` — schermate e modali.

## Caricamento intelligente dei documenti

Da Home, Anagrafica o dalla scheda di un'azienda: si trascinano uno o più file e l'app

1. **legge il contenuto**: testo dei PDF (pdf.js), OCR in italiano per foto e scansioni (Tesseract), tracciato delle fatture elettroniche XML/P7M;
2. **riconosce il tipo** tra gli oltre 60 previsti dall'archivio (visure, titoli di conduzione, identità, fascicolo, domande, fatture, certificazioni…) con un punteggio di confidenza, gli indizi trovati e le alternative più vicine;
3. **trova l'azienda** dal CUAA (codice fiscale o P.IVA) o dal nome citato nel documento, e avvisa se il documento sembra di un'altra azienda;
4. **compila i campi**: data del documento, scadenza (anche da «dal … al …» o dalla durata del contratto), numero, importo, foglio e particelle, superficie, controparte, pratica collegata.

Tutto avviene nel browser, senza servizi esterni a pagamento. L'esito dell'analisi e il testo letto vengono salvati con il documento (`documenti.analisi`, `documenti.testo`).
Il motore è in `src/lib/analisi/`; le prove con dati fittizi si lanciano con `npm run test:analisi`.

## Import da Excel

- **Aziende** (Anagrafica → *Importa Excel*): basta una colonna con il CUAA (e la denominazione per le nuove). Colonne riconosciute in automatico e correggibili; si sceglie in quali uffici inserirle. Le celle vuote non cancellano i dati esistenti; le colture citate vengono aggiunte al catalogo se mancano.
- **Domande** (Domande → *Importa da Excel*): si scrive la tipologia di domanda (esistente o nuova), si carica l'elenco dei nominativi e lo stato viene letto dal file (o applicato a tutti). I CUAA sconosciuti diventano nuove aziende dell'ufficio. Al termine un riepilogo mostra, per ogni pratica, le domande fatte, stampate, in compilazione e non fatte, con l'elenco dei nominativi. Un file con più tipi di domanda viene gestito abbinando ogni tipo a una pratica.

## Anagrafica per ufficio

Ogni ufficio ha la propria anagrafica completa (stesso CUAA in più uffici, con domande e documenti separati). Le aziende si possono selezionare ed eliminare in blocco, solo dall'ufficio corrente o da tutti.

## Bandi: confronto automatico

In *Pratiche e bandi* → *Carica bando* si trascina il PDF del bando: vengono letti nome, codice intervento, ente, apertura, scadenza e requisiti (età, tipo di soggetto, biologico, IAP, superficie minima, comparti), ognuno con il passaggio del testo da cui deriva. Le aziende dell'ufficio vengono divise in idonee, da verificare (dati mancanti), quasi idonee (un solo requisito recuperabile) e non idonee. Lo stesso confronto è disponibile per ogni pratica esistente.

## Anteprima documenti

Cliccando un documento archiviato si apre l'anteprima: PDF pagina per pagina con zoom, immagini, fatture elettroniche impaginate, con i dati estratti a fianco.

## Deploy

Vedi [DEPLOY.md](DEPLOY.md): branch principale su GitHub e pubblicazione su Vercel.

## Accesso

Solo gli utenti presenti nella tabella `profili` vedono i dati (RLS). Il login avviene con nome utente: l'app lo trasforma in `<username>@cia-gestionale.it` (configurabile con `VITE_LOGIN_DOMAIN`).

Per aggiungere un utente: crearlo in Supabase → Authentication, poi inserire una riga in `public.profili` con il suo `id`.
Consigliato: disattivare le registrazioni pubbliche in Authentication → Providers → Email.

## Regole di dominio

Le regole del gestionale originale sono preservate (vedi `src/lib/domain.ts` e il trigger `private.normalizza_domanda`):
stati R/S/C/N, esiti con motivi e riesame, pagamento calcolato dagli importi, quota servizio CIA proposta alla prima rilascio, abbinamento automatico azienda ↔ pratica sui requisiti con inclusioni/esclusioni manuali.
