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

## Flusso delle domande

1. **Nuova domanda** → si sceglie la pratica: tra quelle in uso, dal **catalogo dei tipi di domanda** (annuali e una tantum: DU, UMA, vendemmia, giacenza, SRA, SRB01, titoli, SRF01, SRE01, SRD01/02, RRV, ISMEA, ISI INAIL…) oppure creandone una nuova.
2. Nella pagina della pratica, **passo 1**: si carica l'Excel delle **domande da fare** (il modello). **L'anagrafica non viene toccata**: l'elenco vive solo nella pratica (tabella `pratica_voci`). Si può modificare riga per riga (stato a mano, numero, data, esito, note, aggiungere o togliere nominativi), sostituire o integrare con un nuovo file, scaricare l'originale ed eliminare.
3. **Passo 2**: si caricano uno o più Excel delle domande **fatte, stampate o in compilazione** (tabella `pratica_file`). Il riscontro (`src/lib/riscontro.ts`) abbina solo per persona: stesso CUAA **oppure** stesso nominativo (senza accenti, apostrofi, punteggiatura, forme societarie e in qualsiasi ordine di nome e cognome; con due omonimi nell'elenco vale solo il CUAA) mette il pallino a ogni riga dell'elenco: 🟢 fatta, 🔵 stampata, 🟠 in compilazione, 🔴 non fatta; vale lo stato più avanzato, e uno stato messo a mano ha la precedenza. Lo stato di ogni riga si ricava dalla colonna «stato», dalle colonne indizio (per esempio «Data stampa» → stampata, «Data rilascio» o «Protocollo» → fatta, «Data compilazione» o «Bozza» → in compilazione) o da una parola di stato scritta in una cella; le righe senza nessuno stato riconoscibile restano **non fatte** (si può indicare a mano cosa contiene il file). L'elenco da fare parte sempre tutto «non fatto»: lo stato scritto nell'elenco si usa solo se lo si attiva esplicitamente al caricamento. I nominativi «fuori elenco» vengono segnalati e si possono aggiungere all'elenco. Ogni file si può scaricare o eliminare (anche i vecchi, in blocco): il riscontro si ricalcola subito.
4. Tutto si gestisce dalla pagina della pratica (o da **Domande**): filtro «Non fatte», stato a mano, esportazione.

Importi, pagamenti e quota servizio non fanno parte del gestionale.

## Filtri e azioni multiple

Ogni elenco ha ricerca, filtri, «seleziona tutti» ed esportazione in Excel; la selezione apre una barra di azioni:

- **Anagrafica**: filtri per tipo, requisiti, coltura, comune, situazione (con/senza domande, senza SAU, senza colture, senza contatti). Azioni: esporta, imposta biologico/IAP/UMA, aggiungi a una pratica, copia o sposta in un altro ufficio, elimina (anche da tutti gli uffici).
- **Pratiche e bandi**: filtri per tipo, attive, senza elenco, in scadenza, scadute. Azioni: attiva, disattiva, esporta, elimina.
- **Pagina della pratica**: filtro per stato o «stato a mano»; azioni: imposta stato (o torna automatico dai file), esporta, togli dall'elenco; file delle domande fatte eliminabili in blocco; fuori elenco aggiungibili in blocco.
- **Domande**: stesso elenco con il riscontro, per pratica.
- **Colture** e **documenti** dell'azienda: elimina ed esporta in blocco.

## Riconoscimento degli Excel

`src/lib/excel.ts`: trova da solo il foglio giusto e la riga d'intestazione (anche dopo righe di titolo, su due righe con celle unite, o assente), profila il contenuto di ogni colonna (codici fiscali con carattere di controllo, partite IVA anche senza gli zeri iniziali tolti da Excel, date, stati, esiti, nominativi, codici, sì/no, email, PEC, telefoni…), confronta le intestazioni con un dizionario di sinonimi con espansione delle abbreviazioni e tolleranza agli errori di battitura, e assegna ogni campo alla colonna migliore con una confidenza e una spiegazione. Gestisce cognome e nome in colonne separate, righe di totale e colonne vuote. Le prove (`npm run test:analisi`) coprono questi casi.

## Import aziende

Anagrafica → *Importa Excel*: basta una colonna con il CUAA (e la denominazione per le nuove). Si sceglie in quali uffici inserirle; le celle vuote non cancellano i dati esistenti.

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

## Brogliaccio (colture dell'azienda)

Nella scheda dell'azienda, tab **Colture → Carica il brogliaccio**: dall'Excel del fascicolo (`src/lib/brogliaccio.ts`) si riconoscono la colonna della coltura (occupazione / uso del suolo / prodotto, con destinazione, uso e varietà) e quella della superficie (utilizzata > condotta > catastale; ettari, metri quadri, «ha.aa.ca» o colonne Ha/Are/Ca). Le superfici si sommano per coltura e si abbinano al catalogo (sinonimi: uliveto → Olivo, vigneto → Vite da vino, frumento duro → Grano duro…); tare, fabbricati e incolti non si contano. Si può correggere ogni abbinamento, creare colture nuove, sostituire le colture attuali, aggiornare la SAU e archiviare il file tra i documenti. Se il CUAA scritto nel file è diverso da quello dell'azienda compare un avviso.
