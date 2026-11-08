// Prove del riscontro elenco / file delle fatte (dati fittizi). Esecuzione: npm run test:analisi
import { riscontro } from "./riscontro";
import type { PraticaFile, RigaFile, Voce } from "./types";
let ko = 0;
const ok = (n: string, c: boolean, info = "") => { if (!c) { ko++; process.exitCode = 1; } console.log(c ? "OK  " : "FAIL", n, info); };
const voce = (id: string, cuaa: string | null, den: string, extra: Partial<Voce> = {}): Voce => ({ id, pratica_id: "p", ufficio_id: "u", file_id: null, cuaa, denominazione: den, extra: {}, stato_manuale: null, numero: null, data_presentazione: null, esito: null, motivi: [], riesame: null, note: null, ordine: 0, created_at: "", updated_at: "", updated_by: null, ...extra });
const riga = (cuaa: string | null, den: string | null, stato: RigaFile["stato"] = null, numero: string | null = null): RigaFile => ({ riga: 1, cuaa, denominazione: den, stato, numero, data: null, esito: null, note: null });
const file = (id: string, righe: RigaFile[], def: "R" | "S" | "C" = "R", created_at = "2026-11-01"): PraticaFile => ({ id, pratica_id: "p", ufficio_id: "u", tipo: "fatte", nome: id, righe, colonne: {}, stato_predefinito: def, n_righe: righe.length, storage_path: null, created_at, created_by: null });

const voci = [voce("1", "RSSMRA80A41E372Q", "ROSSI MARIA"), voce("2", "BNCLGU75C12I520K", "BIANCHI LUIGI"), voce("3", null, "VERDI GIUSEPPE"), voce("4", "00243570694", "COMUNE DI PROVA"), voce("5", "NRIFNC90E50E372S", "NERI FRANCESCA", { stato_manuale: "S" })];
const fA = file("rilasciate", [riga("RSSMRA80A41E372Q", "ROSSI MARIA", null, "D-1"), riga("243570694", "COMUNE DI PROVA")]);
const fB = file("stati", [riga("RSSMRA80A41E372Q", "ROSSI MARIA", "S"), riga(null, "Verdi Giuseppe", "C"), riga("GLLPLA58M21B865X", "GALLI PAOLA", "R")], "R", "2026-11-05");
const r = riscontro(voci, [fA, fB]);
const st = (id: string) => r.voci.find((v) => v.voce.id === id)!.stato;
ok("stato più avanzato tra più file", st("1") === "R" && r.voci[0].numero === "D-1");
ok("non presente nei file = non fatta", st("2") === "N");
ok("abbinamento per nome se manca il CUAA", st("3") === "C");
ok("P.IVA senza zeri iniziali", st("4") === "R");
ok("stato manuale prevale", st("5") === "S");
ok("fuori elenco", r.fuori.length === 1 && r.fuori[0].riga.denominazione === "GALLI PAOLA");
ok("conteggi", r.conteggi.R === 2 && r.conteggi.S === 1 && r.conteggi.C === 1 && r.conteggi.N === 1, JSON.stringify(r.conteggi));
const r2 = riscontro(voci, [fB]);
ok("eliminando un file si ricalcola", r2.voci.find((v) => v.voce.id === "1")!.stato === "S" && r2.voci.find((v) => v.voce.id === "4")!.stato === "N");
console.log(ko ? `${ko} prove fallite` : "Tutte le prove superate");
