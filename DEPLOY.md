# Guida: branch principale e deploy su Vercel

## 1. Impostare `main` come branch principale su GitHub

Il branch `main` esiste già ed è allineato all'ultima versione. Per renderlo il branch predefinito:

1. Apri il repository su GitHub → **Settings** (in alto a destra, serve essere proprietario o admin).
2. Nel menu a sinistra, **General** → sezione **Default branch**.
3. Clicca l'icona delle frecce ⇄ accanto al branch attuale, scegli **`main`** e conferma con **Update** → *I understand, update the default branch*.

Consigliato, per un versionamento ordinato:

4. **Settings → Branches → Add branch ruleset** (o *Add rule*) per `main`: attiva *Require a pull request before merging*. Così ogni modifica passa da una PR e resta nello storico.
5. Le versioni si marcano con i tag: da GitHub → **Releases → Draft a new release** → tag `v2.1.0` sul branch `main`. (Il numero di versione è anche in `package.json`.)
6. Facoltativo: una volta che `main` è il predefinito, i vecchi branch `claude/...` possono essere eliminati da **Branches** dopo il merge.

Flusso di lavoro consigliato: sviluppo su un branch dedicato → Pull Request verso `main` → merge → Vercel pubblica automaticamente.

---

## 2. Deploy su Vercel

L'app è un sito statico (React + Vite): Vercel compila e pubblica la cartella `dist`. La configurazione è già nel repository (`vercel.json`): comando di build, cartella di output, redirect delle rotte interne su `index.html` (necessario per aprire direttamente link come `/u/vasto/domande`), cache dei file e header di sicurezza.

### 2.1 Primo deploy

1. Vai su <https://vercel.com> e accedi con l'account GitHub.
2. **Add New… → Project** → scegli il repository `emlelloprove` → **Import**.
   Se non compare: *Adjust GitHub App Permissions* e dai accesso al repository.
3. Nella schermata di configurazione:
   - **Framework Preset**: `Vite` (viene rilevato da solo)
   - **Root Directory**: `./`
   - **Build Command** / **Output Directory** / **Install Command**: lascia i valori proposti (vengono letti da `vercel.json`: `npm run build`, `dist`, `npm ci`)
4. Apri **Environment Variables** e aggiungi (per *Production*, *Preview* e *Development*):

   | Nome | Valore |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://cbfarrrsamwmlenxlugx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `sb_publishable_auaQxErCxa6i-ubDhjTU1A_7rLINgDD` |
   | `VITE_LOGIN_DOMAIN` | `cia-gestionale.it` |

   Sono valori pubblici (la chiave *publishable* è fatta per stare nel browser: i dati sono protetti dalle policy RLS del database). Se mancassero, l'app usa comunque questi stessi valori come predefiniti.
   **Non** inserire mai la chiave `service_role` di Supabase.
5. **Deploy**. Dopo circa un minuto ottieni un indirizzo tipo `https://emlelloprove.vercel.app`.

### 2.2 Branch di produzione

In **Project → Settings → Git** verifica che **Production Branch** sia `main`.
Da quel momento:
- ogni push/merge su `main` → nuovo deploy in **produzione**;
- ogni altro branch o Pull Request → deploy di **anteprima** con un suo indirizzo, utile per provare le modifiche prima del merge.

### 2.3 Configurazione Supabase per il dominio

Il login con nome utente e password funziona già, ma conviene registrare il dominio:

1. Supabase → progetto **Cia Project** → **Authentication → URL Configuration**.
2. **Site URL**: l'indirizzo Vercel (es. `https://emlelloprove.vercel.app`, o il dominio personalizzato).
3. **Redirect URLs**: aggiungi `https://emlelloprove.vercel.app/**` e, se usi le anteprime, `https://*-<tuo-team>.vercel.app/**`.

Sicurezza consigliata (una volta sola):
- **Authentication → Providers → Email**: disattiva *Allow new users to sign up* (gli utenti sono solo alessandro ed emmanuel).
- **Authentication → Settings**: attiva la protezione contro le password compromesse.

### 2.4 Dominio personalizzato (facoltativo)

Vercel → **Project → Settings → Domains → Add** (es. `gestionale.tuodominio.it`) e segui le istruzioni DNS (record `CNAME` verso `cname.vercel-dns.com`). Poi aggiorna *Site URL* su Supabase come al punto 2.3.

### 2.5 Verifica dopo il deploy

- [ ] La pagina di login si apre e mostra il logo
- [ ] Accesso con `alessandro` ed `emmanuel`
- [ ] Ricaricando una pagina interna (es. `/u/scerni/domande`) non compare un errore 404
- [ ] Cambio ufficio Scerni / San Salvo / Vasto con dati diversi
- [ ] **Caricamento intelligente**: trascina un PDF e una foto di un documento → vengono riconosciuti; l'OCR alla prima foto scarica il dizionario italiano (qualche secondo)
- [ ] Apertura di un documento archiviato (link firmato di Supabase Storage)

### 2.6 Problemi frequenti

| Sintomo | Causa e soluzione |
|---|---|
| Pagina bianca, in console «Invalid API key» | Variabile `VITE_SUPABASE_ANON_KEY` errata: correggila e fai **Redeploy** (le variabili `VITE_*` sono incluse in fase di build) |
| 404 ricaricando una pagina interna | `vercel.json` non presente nel branch pubblicato |
| Login rifiutato | Utente o password errati, oppure utente non presente in `public.profili` |
| Si entra ma non si vedono dati | L'utente non è nella tabella `profili` (RLS) |
| OCR fermo su «Riconoscimento del testo» | La rete blocca `cdn.jsdelivr.net` (da dove si scarica il motore OCR): consentilo, oppure carica PDF con testo |

### 2.7 Prova in locale come in produzione

```bash
npm ci
npm run build
npm run preview
```

Poi apri <http://localhost:4173>.
