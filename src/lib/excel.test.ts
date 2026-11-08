// Prove del riconoscimento Excel con dati fittizi. Esecuzione: npm run test:analisi
import { analizzaFile, CAMPI_AZIENDA, CAMPI_DOMANDA, cuaaDa, stato, valore, type Foglio } from "./excel";

const CF = ["RSSMRA80A41E372Q", "BNCLGU75C12I520K", "VRDGPP62T05A485M", "NRIFNC90E50E372S", "GLLPLA58M21B865X", "MRNLCU77H10D209Z"];
let falliti = 0;
function verifica(nome: string, ok: boolean, info = "") {
  if (!ok) { falliti++; process.exitCode = 1; }
  console.log(ok ? "OK  " : "FAIL", nome, info);
}

// 1. titolo, riga vuota, intestazioni con abbreviazioni ed errori di battitura
const f1: Foglio = { nome: "Foglio1", righe: [
  ["ELENCO DOMANDE UFFICIO SCERNI"], [], ["N.", "Cod. Fisc.", "Nominativo", "Stato pratica", "Nr. domanda", "Dt. rilascio"],
  ...CF.map((c, i) => [i + 1, c, ["ROSSI MARIA", "BIANCHI LUIGI", "VERDI GIUSEPPE", "NERI FRANCESCA", "GALLI PAOLA", "MARINI LUCA"][i], ["Rilasciata", "Stampata", "In compilazione", "rilasciata", "RILASCIATA", "bozza"][i], `DU-2026-0000${i}`, new Date(2026, 4, 10 + i)]),
] };
const a1 = analizzaFile([f1], CAMPI_DOMANDA)[0];
verifica("titolo + abbreviazioni: CUAA", a1.mappa.cuaa?.col === 1, JSON.stringify(a1.mappa.cuaa));
verifica("titolo + abbreviazioni: nominativo", a1.mappa.denominazione?.col === 2);
verifica("titolo + abbreviazioni: stato", a1.mappa.stato?.col === 3);
verifica("titolo + abbreviazioni: numero (non il progressivo)", a1.mappa.numero?.col === 4, JSON.stringify(a1.mappa.numero));
verifica("titolo + abbreviazioni: data", a1.mappa.data_presentazione?.col === 5);

// 2. nessuna intestazione: solo dati
const f2: Foglio = { nome: "Export", righe: CF.map((c, i) => [c, ["ROSSI MARIA", "BIANCHI LUIGI", "VERDI GIUSEPPE", "NERI FRANCESCA", "GALLI PAOLA", "MARINI LUCA"][i], "Rilasciata"]) };
const a2 = analizzaFile([f2], CAMPI_DOMANDA)[0];
verifica("senza intestazione: CUAA dal contenuto", a2.mappa.cuaa?.col === 0 && a2.righe.length === 6, JSON.stringify(a2.mappa));
verifica("senza intestazione: nominativo dal contenuto", a2.mappa.denominazione?.col === 1);
verifica("senza intestazione: stato dal contenuto", a2.mappa.stato?.col === 2);

// 3. cognome e nome separati, errore di battitura "Codce fiscale", P.IVA numerica senza zero iniziale
const f3: Foglio = { nome: "Anagrafica", righe: [
  ["Cognome", "Nome", "Codce fiscale", "Comune", "Telefono", "PEC"],
  ["ROSSI", "MARIA", "RSSMRA80A41E372Q", "Vasto", "333 1234567", "rossi@pec.it"],
  ["BIANCHI", "LUIGI", 243570694, "Scerni", "0873 123456", "bianchi@legalmail.it"],
  ["VERDI", "GIUSEPPE", "vrdgpp62t05a485m", "Atessa", "", ""],
] };
const a3 = analizzaFile([f3], CAMPI_AZIENDA)[0];
verifica("errore di battitura: CUAA", a3.mappa.cuaa?.col === 2, JSON.stringify(a3.mappa.cuaa));
verifica("cognome+nome separati", a3.mappa.cognome?.col === 0 && a3.mappa.nome?.col === 1 && valore(a3, a3.righe[0], "denominazione") === "ROSSI MARIA");
verifica("P.IVA con zeri ripristinati", cuaaDa(243570694)?.cuaa === "00243570694");
verifica("CF minuscolo", cuaaDa("vrdgpp62t05a485m")?.cuaa === "VRDGPP62T05A485M");
verifica("PEC", a3.mappa.pec?.col === 5);

// 4. intestazione su due righe (celle unite già espanse)
const f4: Foglio = { nome: "Domande", righe: [
  ["Dati azienda", "Dati azienda", "Domanda", "Domanda"],
  ["CUAA", "Ragione sociale", "Stato", "Data"],
  ...CF.slice(0, 4).map((c, i) => [c, "AZIENDA AGRICOLA " + ["ALFA", "BETA", "GAMMA", "DELTA"][i], i % 2 ? "Stampata" : "Rilasciata", "12/05/2026"]),
] };
const a4 = analizzaFile([f4], CAMPI_DOMANDA)[0];
verifica("intestazione doppia", a4.mappa.cuaa?.col === 0 && a4.mappa.denominazione?.col === 1 && a4.mappa.stato?.col === 2 && a4.righe.length === 4, JSON.stringify(a4.mappa));

// 5. scelta del foglio giusto
const istruzioni: Foglio = { nome: "Istruzioni", righe: [["Compilare il foglio Domande"], ["Le celle vuote non cancellano i dati"]] };
const best = analizzaFile([istruzioni, f1], CAMPI_DOMANDA)[0];
verifica("sceglie il foglio con i dati", best.foglio === "Foglio1");

// 6. colonna «Fatta» SI/NO usata come stato
const f6: Foglio = { nome: "x", righe: [["Codice fiscale", "Denominazione", "Fatta"], ...CF.map((c, i) => [c, "AZIENDA " + i, i % 2 ? "NO" : "SI"])] };
const a6 = analizzaFile([f6], CAMPI_DOMANDA)[0];
verifica("colonna SI/NO come stato", a6.mappa.stato?.col === 2 && stato("SI") === "R" && stato("NO") === "N");

// 7. valori di stato
const casi: [string, string][] = [["Rilasciata", "R"], ["da rilasciare", "S"], ["Stampata", "S"], ["In compilazione", "C"], ["bozza", "C"], ["Non presentata", "N"], ["presentata", "R"], ["Protocollata", "R"]];
verifica("valori di stato", casi.every(([v, e]) => stato(v) === e), casi.map(([v]) => `${v}=${stato(v)}`).join(" "));

console.log(falliti ? `${falliti} prove fallite` : "Tutte le prove superate");
