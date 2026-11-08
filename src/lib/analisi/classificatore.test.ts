// Prove del classificatore con dati fittizi. Esecuzione: npm run test:analisi
import { classifica, estraiCampi, leggiFatturaPA } from "./classificatore";
const casi: [string, string, string][] = [
  ["Visura catastale", "visura_123.pdf", `Direzione Provinciale di Chieti Ufficio Provinciale - Territorio
Visura per soggetto Situazione degli atti informatizzati al 03/10/2026
Catasto dei Terreni Foglio 12 Particella 345 Qualità Classe ULIVETO 2 Superficie ha 1 are 23 ca 40
Reddito Dominicale Euro 45,10 Reddito Agrario Euro 30,20 ROSSI MARIA RSSMRA80A41E372Q`],
  ["Documento d'identità", "IMG_2041.jpg", `REPUBBLICA ITALIANA MINISTERO DELL'INTERNO CARTA DI IDENTITA CA12345BB
COGNOME ROSSI NOME MARIA LUOGO E DATA DI NASCITA VASTO 01.01.1980 SESSO F STATURA 165
EMISSIONE 12.03.2021 SCADENZA 01.01.2032`],
  ["Contratto d'affitto", "contratto.pdf", `CONTRATTO DI AFFITTO DI FONDO RUSTICO ai sensi dell'art. 45 della Legge 203/82
Il concedente Sig. Bianchi ... concede in affitto all'affittuario ... il fondo rustico sito in Scerni foglio 7 particelle 12, 13 e 15
per la durata di anni 6 dal 11/11/2024 al 10/11/2030. Canone annuo euro 1.200,00`],
  ["DURC", "doc.pdf", `Documento Unico di Regolarità Contributiva Numero Protocollo INPS_41234567 Data richiesta 01/09/2026 Scadenza validità 30/12/2026 Il sottoscritto risulta REGOLARE nei confronti di INPS INAIL`],
  ["Scheda di validazione fascicolo", "x.pdf", `AGEA SIAN Scheda di validazione del fascicolo aziendale CUAA 01234567897 Consistenza territoriale Data validazione 15/02/2026`],
  ["Comodato verbale", "comodato verbale.pdf", `Dichiarazione sostitutiva di comodato verbale il comodante concede in uso gratuito al comodatario`],
  ["Informativa privacy", "x.pdf", `Informativa sul trattamento dei dati personali ai sensi del Regolamento (UE) 2016/679 titolare del trattamento`],
];
for (const [atteso, nome, testo] of casi) {
  const c = classifica(testo, nome);
  const f = estraiCampi(testo, c[0]?.tipo ?? "", [], new Date("2026-11-08"));
  if (c[0]?.tipo !== atteso) process.exitCode = 1;
  console.log((c[0]?.tipo === atteso ? "OK  " : "FAIL") , atteso, "=>", c[0]?.tipo, c[0]?.confidenza, "| alt:", c[1]?.tipo, c[1]?.confidenza);
  console.log("     ", JSON.stringify({ d: f.dataDocumento, s: f.scadenza, n: f.numero, imp: f.importo, fg: f.foglio, pt: f.particelle, ha: f.superficieHa, cuaa: f.cuaa }));
}
const xml = `<?xml version="1.0"?><p:FatturaElettronica xmlns:p="x"><FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>AGRARIA SANGRO SRL</Denominazione></Anagrafica></DatiAnagrafici></CedentePrestatore><CessionarioCommittente><DatiAnagrafici><CodiceFiscale>RSSMRA80A41E372Q</CodiceFiscale></DatiAnagrafici></CessionarioCommittente></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><Data>2026-10-02</Data><Numero>145/A</Numero><ImportoTotaleDocumento>1220.00</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali></FatturaElettronicaBody></p:FatturaElettronica>`;
console.log(JSON.stringify(leggiFatturaPA(xml)));
console.log(classifica(xml, "IT01234567890_abc.xml")[0]);
