// Prove della lettura del brogliaccio con dati fittizi. Esecuzione: npm run test:analisi
import { abbinaColtura, leggiBrogliaccio, superficieHa, unitaColonna } from "./brogliaccio";
import type { Foglio } from "./excel";

let ko = 0;
const ok = (n: string, c: boolean, info = "") => { if (!c) { ko++; process.exitCode = 1; } console.log(c ? "OK  " : "FAIL", n, info); };
const CAT = ["Olivo", "Vite da vino", "Vite da tavola", "Grano duro", "Grano tenero", "Orzo", "Mais", "Erba medica", "Prato pascolo", "Ortive in pieno campo", "Pesco", "Leguminose da granella"].map((nome, i) => ({ id: "c" + i, nome }));
const id = (nome: string) => CAT.find((c) => c.nome === nome)!.id;
const nomeDi = (cid: string | null) => CAT.find((c) => c.id === cid)?.nome ?? "—";

// 1. tracciato tipo SIAN: titolo con CUAA, superficie utilizzata in ettari, occupazione + destinazione + uso
const f1: Foglio = { nome: "Brogliaccio", righe: [
  ["BROGLIACCIO CONSISTENZA TERRITORIALE"], ["CUAA: RSSMRA80A41E372Q", null, "ROSSI MARIA"], [],
  ["Comune", "Foglio", "Particella", "Sub", "Sup. catastale (mq)", "Sup. condotta (ha)", "Occupazione suolo", "Destinazione", "Uso", "Varietà", "Sup. utilizzata (ha)"],
  ["SCERNI", 12, 101, null, 15000, 1.5, "OLIVO", "OLIO", "-", "Gentile di Chieti", 1.4],
  ["SCERNI", 12, 102, null, 8000, 0.8, "OLIVO", "OLIO", "-", "Leccino", 0.75],
  ["SCERNI", 14, 33, null, 20000, 2, "VITE", "VINO", "DOC", "Montepulciano", 1.9],
  ["SCERNI", 15, 7, null, 30000, 3, "FRUMENTO DURO", "GRANELLA", "-", null, 3],
  ["SCERNI", 15, 8, null, 1000, 0.1, "TARE E INCOLTI", "-", "-", null, 0.1],
  ["TOTALE", null, null, null, null, null, null, null, null, null, 7.15],
] };
const l1 = leggiBrogliaccio([f1], CAT);
const g1 = Object.fromEntries(l1.gruppi.map((g) => [nomeDi(g.colturaId), Math.round(g.superficie * 10000) / 10000]));
ok("SIAN: colonna coltura", l1.analisi.intestazioni[l1.analisi.mappa.coltura?.col ?? -1] === "Occupazione suolo", JSON.stringify(l1.analisi.mappa.coltura));
ok("SIAN: usa la superficie utilizzata", l1.colonnaSuperficie?.intestazione === "Sup. utilizzata (ha)" && l1.colonnaSuperficie.unita === "ha", JSON.stringify(l1.colonnaSuperficie));
ok("SIAN: olivo sommato", g1["Olivo"] === 2.15, JSON.stringify(g1));
ok("SIAN: vite da vino", g1["Vite da vino"] === 1.9);
ok("SIAN: grano duro", g1["Grano duro"] === 3);
ok("SIAN: tare non contate", l1.totale === 7.05 && l1.gruppi.some((g) => g.nonColtivato), `totale ${l1.totale}`);
ok("SIAN: riga totale scartata", !l1.gruppi.some((g) => /totale/i.test(g.descrizione)));
ok("SIAN: varietà", l1.gruppi.find((g) => g.colturaId === id("Olivo"))!.varieta.length === 2);
ok("SIAN: CUAA dal titolo", l1.cuaa.includes("RSSMRA80A41E372Q"), l1.cuaa.join(","));

// 2. formato ha.aa.ca
const f2: Foglio = { nome: "Foglio1", righe: [["Foglio", "Mappale", "Coltura", "Superficie"], [3, 45, "Uliveto", "1.23.45"], [3, 46, "Erba medica", "0.50.00"], [4, 1, "Prato pascolo", "2.00.10"]] };
const l2 = leggiBrogliaccio([f2], CAT);
ok("ha.aa.ca riconosciuto", l2.colonnaSuperficie?.unita === "haaaca", JSON.stringify(l2.colonnaSuperficie));
ok("ha.aa.ca convertito", Math.abs(l2.totale - 3.7355) < 1e-9, String(l2.totale));
ok("ha.aa.ca: uliveto → olivo", l2.gruppi[0] && nomeDi(l2.gruppi.find((g) => /ulivet/i.test(g.descrizione))!.colturaId) === "Olivo");

// 3. superficie in metri quadri senza unità nell'intestazione
const f3: Foglio = { nome: "Piano", righe: [["Particella", "Prodotto", "Superficie"], [1, "MAIS DA GRANELLA", 25000], [2, "MAIS DA GRANELLA", 12500], [3, "FAVINO", 8000]] };
const l3 = leggiBrogliaccio([f3], CAT);
ok("metri quadri dedotti", l3.colonnaSuperficie?.unita === "mq" && l3.totale === 4.55, `${l3.colonnaSuperficie?.unita} ${l3.totale}`);
ok("favino → leguminose", nomeDi(l3.gruppi.find((g) => /favino/i.test(g.descrizione))!.colturaId) === "Leguminose da granella");

// 4. Ha / Are / Ca in colonne separate
const f4: Foglio = { nome: "x", righe: [["Foglio", "Particella", "Uso del suolo", "Ha", "Are", "Ca"], [1, 2, "PESCO", 1, 20, 0], [1, 3, "ORTIVE", 0, 45, 50]] };
const l4 = leggiBrogliaccio([f4], CAT);
ok("Ha/Are/Ca separati", Math.abs(l4.totale - 1.655) < 1e-9, String(l4.totale) + " " + JSON.stringify(l4.analisi.mappa));

// abbinamenti e unità
ok("abbina: vigneto doc", abbinaColtura("VIGNETO DOC", CAT) === id("Vite da vino"));
ok("abbina: uva da tavola", abbinaColtura("VITE - UVA DA TAVOLA", CAT) === id("Vite da tavola"));
ok("abbina: sconosciuta", abbinaColtura("ZAFFERANO", CAT) === null);
ok("unità da intestazione mq", unitaColonna("Superficie (mq)", [1.5]) === "mq");
ok("superficie con virgola", superficieHa("1,2345", "ha") === 1.2345);

console.log(ko ? `${ko} prove fallite` : "Tutte le prove superate");
