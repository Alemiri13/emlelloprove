// Prova della lettura dei requisiti di un bando (testo fittizio). Esecuzione: npm run test:analisi
import { leggiBando } from "./bando";
const t = `REGIONE ABRUZZO\nBando pubblico intervento SRE01 - Insediamento giovani agricoltori nel comparto vitivinicolo\nPossono presentare domanda le persone fisiche che abbiano un'età compresa tra 18 e\n40 anni, ovvero che non abbiano compiuto 41 anni. L'azienda deve condurre una superficie agricola utilizzata minima di 2 ettari. Sono ammissibili le aziende operanti nel settore vitivinicolo. Le domande sono presentabili dal 01/12/2026 ed entro e non oltre il 31/03/2027.`;
const r = leggiBando(t, [{ id: "v", nome: "Vite da vino", categoria: "", colore: "", created_at: "" }, { id: "t", nome: "Vite da tavola", categoria: "", colore: "", created_at: "" }, { id: "o", nome: "Olivo", categoria: "", colore: "", created_at: "" }]);
console.log(JSON.stringify({ ...r, evidenze: undefined }));
const atteso = { tipo: "PF", etaMin: 18, etaMax: 40, sauMin: 2 };
for (const [k, v] of Object.entries(atteso)) if ((r.criteri as Record<string, unknown>)[k] !== v) { console.log("FAIL", k); process.exitCode = 1; }
if (r.scadenza !== "2027-03-31" || r.codice !== "SRE01") { console.log("FAIL date/codice"); process.exitCode = 1; }
