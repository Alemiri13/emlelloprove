// Prove del riscontro elenco / file delle fatte (dati fittizi). Esecuzione: npm run test:analisi
import { riscontro } from "./riscontro";
import type { PraticaFile, RigaFile, Voce } from "./types";
let ko = 0;
const ok = (n: string, c: boolean, info = "") => { if (!c) { ko++; process.exitCode = 1; } console.log(c ? "OK  " : "FAIL", n, info); };
const voce = (id: string, cuaa: string | null, den: string, extra: Partial<Voce> = {}): Voce => ({ id, pratica_id: "p", ufficio_id: "u", file_id: null, cuaa, denominazione: den, extra: {}, stato_manuale: null, numero: null, data_presentazione: null, esito: null, motivi: [], riesame: null, note: null, ordine: 0, created_at: "", updated_at: "", updated_by: null, ...extra });
const riga = (cuaa: string | null, den: string | null, stato: RigaFile["stato"] = null, numero: string | null = null): RigaFile => ({ riga: 1, cuaa, denominazione: den, stato, numero, data: null, esito: null, note: null });
const file = (id: string, righe: RigaFile[], def: "R" | "S" | "C" = "R", created_at = "2026-11-01"): PraticaFile => ({ id, pratica_id: "p", ufficio_id: "u", tipo: "fatte", nome: id, righe: righe.map((r) => (r.stato ? r : { ...r, stato: def })), colonne: {}, stato_predefinito: def, n_righe: righe.length, storage_path: null, created_at, created_by: null });

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

// elenco da fare: righe senza stato restano non fatte, righe con stato indicato nel file contano
const mod: PraticaFile = { ...file("modello", []), righe: [riga("RSSMRA80A41E372Q", "ROSSI MARIA"), riga("BNCLGU75C12I520K", "BIANCHI LUIGI", "S")], tipo: "modello", colonne: { _usa_stati: "si" } };
const r3b = riscontro([voce("2", "BNCLGU75C12I520K", "BIANCHI LUIGI")], [{ ...mod, colonne: {} }]);
ok("elenco con stato ma senza consenso: non fatta", r3b.voci[0].stato === "N", r3b.voci[0].stato);
const r3 = riscontro([voce("1", "RSSMRA80A41E372Q", "ROSSI MARIA"), voce("2", "BNCLGU75C12I520K", "BIANCHI LUIGI")], [mod]);
ok("elenco senza stati: non fatta", r3.voci[0].stato === "N", r3.voci[0].stato);
ok("elenco con «data stampa»: stampata", r3.voci[1].stato === "S" && r3.fuori.length === 0, r3.voci[1].stato);

// confronto per persona: CUAA oppure nominativo
const r4 = riscontro(
  [voce("a", "RSSMRA80A41E372Q", "ROSSI MARIA"), voce("b", "01234567897", "D'ANGELO LUIGI"), voce("c", null, "Verdi Società Agricola S.S."), voce("d", "BNCLGU75C12I520K", "BIANCHI LUIGI"), voce("e", "NRIFNC90E50E372S", "NERI FRANCA"), voce("f", "GLLPLA58M21B865X", "NERI FRANCA")],
  [file("x", [
    riga("XXXXXX00A01H501Z", "Maria Rossi"),            // CUAA diverso ma stesso nominativo → si abbina per nome
    riga(null, "DANGELO LUIGI", "S"),                     // apostrofo diverso
    riga(null, "VERDI SOC. AGR.", "C"),                   // forma societaria
    riga("BNCLGU75C12I520K", "BIANCHI L.", "R"),          // nome abbreviato ma stesso CUAA
    riga(null, "NERI FRANCA", "R"),                       // omonimi nell'elenco: per nome non si abbina
    riga("BNCLGU75C12I520K", "GALLI PAOLA", "R"),         // CUAA di Bianchi: va a Bianchi, non per nome
  ])],
);
const s4 = (id: string) => r4.voci.find((v) => v.voce.id === id)!.stato;
ok("nominativo con CUAA diverso", s4("a") === "R", s4("a"));
ok("nominativo con apostrofo", s4("b") === "S", s4("b"));
ok("nominativo con forma societaria", s4("c") === "C", s4("c"));
ok("CUAA con nominativo diverso", s4("d") === "R", s4("d"));
ok("omonimi: solo per CUAA", s4("e") === "N" && s4("f") === "N", s4("e") + s4("f"));
const r5 = riscontro([voce("z", "RSSMRA80A41E372Q", "ROSSI MARIA")], [{ ...file("senza", []), righe: [riga("RSSMRA80A41E372Q", "ROSSI MARIA")] }]);
ok("riga senza stato: non fatta", r5.voci[0].stato === "N", r5.voci[0].stato);
console.log(ko ? `${ko} prove fallite` : "Tutte le prove superate");
