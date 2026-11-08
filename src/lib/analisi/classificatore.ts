/**
 * Classificatore dei documenti agricoli.
 *
 * Funziona interamente in locale (nessun servizio esterno): riceve il testo
 * estratto dal file e il nome del file e restituisce
 *  - il tipo di documento più probabile con una confidenza 0..1 e gli indizi trovati;
 *  - le alternative più vicine;
 *  - i campi estratti: CUAA citati, date (documento e scadenza), numero, importo,
 *    foglio e particelle, superficie, controparte, pratica collegata.
 *
 * Il punteggio di ogni tipo è la somma dei pesi dei segnali trovati
 * (parole chiave e formule tipiche). I segnali nel nome del file valgono un po' meno,
 * quelli in testa al documento (titolo) un po' di più.
 */

export interface Segnale { re: RegExp; peso: number; etichetta: string }
export interface Regola { tipo: string; cat: string; segnali: Segnale[]; soloSenzaTesto?: boolean }

const S = (re: RegExp, peso: number, etichetta: string): Segnale => ({ re, peso, etichetta });

export const REGOLE: Regola[] = [
  // ---------- identità e anagrafica ----------
  { tipo: "Documento d'identità", cat: "identita", segnali: [
    S(/carta (d ?i|di) ?identita|identity card|carte d.identite/, 11, "«Carta d'identità»"),
    S(/passaporto|passport/, 10, "«Passaporto»"),
    S(/patente di guida|driving licen[cs]e|\bpatente\b/, 9, "«Patente di guida»"),
    S(/ministero dell.interno/, 4, "Ministero dell'Interno"),
    S(/repubblica italiana/, 2, "Repubblica Italiana"),
    S(/statura|height/, 4, "campo «Statura»"),
    S(/luogo (e data )?di nascita|place of birth/, 3, "luogo di nascita"),
    S(/cittadinanza|nationality/, 2, "cittadinanza"),
    S(/\bc\.?i\.?e\b|carta d.identita elettronica/, 5, "CIE"),
    S(/scadenza|expiry|valid until/, 1.5, "data di scadenza"),
  ] },
  { tipo: "Codice fiscale / tessera sanitaria", cat: "identita", segnali: [
    S(/tessera sanitaria/, 11, "«Tessera sanitaria»"),
    S(/tessera europea di assicurazione malattia|\bteam\b/, 5, "TEAM"),
    S(/tesserino (del )?codice fiscale/, 9, "tesserino codice fiscale"),
    S(/servizio sanitario nazionale/, 3, "SSN"),
  ] },
  { tipo: "Visura camerale", cat: "identita", segnali: [
    S(/visura (ordinaria |storica )?(camerale|di (societa|impresa))/, 12, "«Visura camerale»"),
    S(/camera di commercio/, 5, "Camera di Commercio"),
    S(/registro (delle )?imprese/, 5, "Registro delle imprese"),
    S(/numero rea|\brea\b/, 4, "numero REA"),
    S(/infocamere|registroimprese/, 4, "InfoCamere"),
    S(/forma giuridica/, 2.5, "forma giuridica"),
    S(/sede legale/, 1.5, "sede legale"),
    S(/codice ateco|attivita prevalente/, 3, "codice ATECO"),
  ] },
  { tipo: "Attribuzione partita IVA", cat: "identita", segnali: [
    S(/attribuzione (del numero di )?partita iva/, 12, "«Attribuzione partita IVA»"),
    S(/modello aa[79]|\baa9\/|\baa7\//, 7, "modello AA9/AA7"),
    S(/dichiarazione di inizio attivita/, 5, "inizio attività"),
  ] },
  { tipo: "Statuto / atto costitutivo", cat: "identita", segnali: [
    S(/atto costitutivo/, 10, "«Atto costitutivo»"),
    S(/\bstatuto\b/, 6, "«Statuto»"),
    S(/patti sociali|capitale sociale/, 4, "patti / capitale sociale"),
    S(/repertorio n|raccolta n/, 2, "repertorio notarile"),
    S(/\bnotaio\b/, 2, "notaio"),
  ] },
  { tipo: "Delega / mandato CAA", cat: "identita", segnali: [
    S(/conferimento (del )?mandato|mandato (di assistenza|al caa)/, 10, "conferimento del mandato"),
    S(/centro di assistenza agricola|\bc\.?a\.?a\.?\b/, 6, "Centro di Assistenza Agricola"),
    S(/\bmandato\b/, 3.5, "«mandato»"),
    S(/\bdelega\b|delegato/, 3.5, "«delega»"),
    S(/revoca (del |di )?(precedente )?mandato/, 3, "revoca mandato precedente"),
    S(/fascicolo aziendale/, 1, "fascicolo aziendale"),
  ] },
  { tipo: "Informativa privacy", cat: "identita", segnali: [
    S(/informativa (sul|per il|al) trattamento|informativa privacy/, 10, "«Informativa»"),
    S(/trattamento dei dati personali/, 6, "trattamento dei dati personali"),
    S(/regolamento \(?ue\)? (n\.? )?2016\/679|\bgdpr\b/, 6, "Reg. UE 2016/679"),
    S(/titolare del trattamento/, 4, "titolare del trattamento"),
    S(/\bprivacy\b/, 3, "«privacy»"),
    S(/presto il consenso|esprimo il consenso/, 2, "consenso"),
  ] },
  { tipo: "Coordinate bancarie (IBAN)", cat: "identita", segnali: [
    S(/coordinate bancarie/, 9, "«Coordinate bancarie»"),
    S(/\biban\b/, 4, "IBAN"),
    S(/\bit ?\d{2} ?[a-z] ?\d{5} ?\d{5} ?[0-9a-z]{12}\b/, 5, "codice IBAN italiano"),
    S(/intestatario del conto|conto corrente intestato/, 4, "intestatario del conto"),
  ] },

  // ---------- catasto e terreni ----------
  { tipo: "Visura catastale", cat: "catasto", segnali: [
    S(/visura (per (soggetto|immobile|partita)|catastale|storica per immobile)/, 12, "«Visura catastale»"),
    S(/catasto (dei )?(terreni|fabbricati)/, 7, "Catasto terreni/fabbricati"),
    S(/ufficio provinciale.{0,20}territorio|direzione provinciale.{0,40}territorio/, 4, "Ufficio del Territorio"),
    S(/reddito dominicale/, 6, "reddito dominicale"),
    S(/reddito agrario/, 6, "reddito agrario"),
    S(/qualita\s*\/?\s*classe|qualita classe/, 4, "qualità/classe"),
    S(/\bparticella\b|\bpart\.\b/, 2, "particella"),
    S(/\bfoglio\b/, 1.5, "foglio"),
    S(/seminativo|uliveto|vigneto|pascolo|incolto/, 2, "qualità colturale"),
  ] },
  { tipo: "Estratto di mappa", cat: "catasto", segnali: [
    S(/estratto di mappa/, 12, "«Estratto di mappa»"),
    S(/mappa catastale/, 5, "mappa catastale"),
    S(/scala 1 ?: ?\d{3,5}/, 4, "scala grafica"),
  ] },
  { tipo: "Certificato di destinazione urbanistica (CDU)", cat: "catasto", segnali: [
    S(/certificato di destinazione urbanistica/, 13, "«Certificato di destinazione urbanistica»"),
    S(/destinazione urbanistica/, 5, "destinazione urbanistica"),
    S(/piano regolatore|\bp\.?r\.?g\.?\b|piano urbanistico/, 3, "piano regolatore"),
    S(/d\.?p\.?r\.? (n\.? )?380/, 3, "DPR 380/2001"),
    S(/zona (agricola|omogenea|e\d?)\b/, 3, "zona agricola"),
  ] },
  { tipo: "Planimetria / rilievo", cat: "catasto", segnali: [
    S(/planimetria/, 8, "«Planimetria»"),
    S(/rilievo (topografico|plano)/, 6, "rilievo"),
  ] },
  { tipo: "Analisi del terreno", cat: "catasto", segnali: [
    S(/analisi (chimic|fisic|del terren|del suolo)/, 9, "analisi del terreno"),
    S(/rapporto di prova/, 5, "rapporto di prova"),
    S(/sostanza organica/, 5, "sostanza organica"),
    S(/tessitura|scheletro|calcare attivo/, 3, "tessitura/calcare"),
    S(/\bph\b/, 2, "pH"),
  ] },

  // ---------- titoli di conduzione ----------
  { tipo: "Contratto d'affitto", cat: "titoli", segnali: [
    S(/contratto di affitto|affitto (di fondo rustico|agrario)|contratto agrario/, 12, "«Contratto d'affitto»"),
    S(/fondo rustico|fondi rustici/, 6, "fondo rustico"),
    S(/legge (n\.? )?203\/?(19)?82|\bl\.? ?203\/82/, 7, "Legge 203/1982"),
    S(/art(icolo|\.)? ?45/, 3, "art. 45 (patti in deroga)"),
    S(/\bcanone\b/, 4, "canone"),
    S(/affittuari[oa]|conduttore|locatari[oa]/, 4, "affittuario"),
    S(/concedente|locatore/, 3, "concedente"),
    S(/annata agraria|durata di (anni )?\d+ (anni|annate)/, 3, "durata in annate"),
    S(/registrat[oa] (a|presso)|agenzia delle entrate.{0,30}registrazione/, 2, "registrazione"),
  ] },
  { tipo: "Comodato verbale", cat: "titoli", segnali: [
    S(/comodato verbale|dichiarazione (sostitutiva )?di comodato verbale/, 14, "«Comodato verbale»"),
  ] },
  { tipo: "Comodato scritto", cat: "titoli", segnali: [
    S(/contratto di comodato|comodato (d.uso|gratuito)/, 11, "«Contratto di comodato»"),
    S(/\bcomodato\b/, 6, "«comodato»"),
    S(/comodante/, 5, "comodante"),
    S(/comodatari[oa]/, 5, "comodatario"),
    S(/a titolo gratuito|uso gratuito/, 3, "a titolo gratuito"),
  ] },
  { tipo: "Comproprietà (assenso comproprietari)", cat: "titoli", segnali: [
    S(/comproprietari|comproprieta/, 9, "comproprietari"),
    S(/pro ?indiviso|quota di \d+\/\d+/, 4, "quota indivisa"),
  ] },
  { tipo: "Atto di proprietà", cat: "titoli", segnali: [
    S(/atto di (compra)?vendita|compravendita/, 10, "compravendita"),
    S(/vende e trasferisce|acquista e accetta/, 5, "formula di trasferimento"),
    S(/repertorio n/, 2, "repertorio"),
    S(/\bnotaio\b/, 2, "notaio"),
    S(/donazione/, 5, "donazione"),
  ] },
  { tipo: "Usufrutto", cat: "titoli", segnali: [
    S(/usufrutto/, 9, "usufrutto"), S(/usufruttuari[oa]/, 5, "usufruttuario"), S(/nuda proprieta/, 4, "nuda proprietà"),
  ] },
  { tipo: "Enfiteusi / livello", cat: "titoli", segnali: [S(/enfiteusi|enfiteutic|\blivello\b/, 10, "enfiteusi / livello")] },
  { tipo: "Successione (dichiarazione)", cat: "titoli", segnali: [
    S(/dichiarazione di successione/, 13, "«Dichiarazione di successione»"),
    S(/de cuius/, 7, "de cuius"),
    S(/asse ereditario|eredi legittimi|chiamati all.eredita/, 5, "eredi"),
  ] },
  { tipo: "Concessione demaniale / ente pubblico", cat: "titoli", segnali: [
    S(/concessione demaniale|demanio/, 9, "demanio"),
    S(/atto di concessione/, 5, "atto di concessione"),
  ] },
  { tipo: "Uso civico", cat: "titoli", segnali: [S(/usi? civic[oi]/, 11, "uso civico")] },
  { tipo: "Assenso del proprietario", cat: "titoli", segnali: [
    S(/assenso (del|dei) proprietari?|dichiarazione di assenso/, 11, "dichiarazione di assenso"),
    S(/autorizza (il|la) sig/, 3, "autorizzazione"),
  ] },

  // ---------- fascicolo ----------
  { tipo: "Scheda di validazione fascicolo", cat: "fascicolo", segnali: [
    S(/scheda (di )?validazione/, 13, "«Scheda di validazione»"),
    S(/fascicolo aziendale/, 6, "fascicolo aziendale"),
    S(/consistenza territoriale|piano di coltivazione grafico/, 5, "consistenza territoriale"),
    S(/\bsian\b|sistema informativo agricolo nazionale/, 3, "SIAN"),
    S(/\bvalidazione\b/, 3, "validazione"),
  ] },
  { tipo: "Piano di coltivazione", cat: "fascicolo", segnali: [
    S(/piano (di )?coltivazione|piano colturale/, 11, "«Piano di coltivazione»"),
    S(/uso del suolo|occupazione del suolo/, 3, "uso del suolo"),
  ] },
  { tipo: "Schedario viticolo", cat: "fascicolo", segnali: [
    S(/schedario viticolo/, 13, "«Schedario viticolo»"),
    S(/unita vitata|superficie vitata/, 5, "unità vitata"),
    S(/vitigno|varieta di vite|portainnesto/, 3, "vitigno"),
  ] },
  { tipo: "Registro di stalla / BDN", cat: "fascicolo", segnali: [
    S(/registro di stalla/, 12, "«Registro di stalla»"),
    S(/\bbdn\b|banca dati nazionale|anagrafe zootecnica/, 6, "Anagrafe zootecnica"),
    S(/codice (aziendale )?asl|\bcapi\b|bovini|ovini|suini/, 2, "capi allevati"),
  ] },
  { tipo: "Certificato IAP / CD", cat: "fascicolo", segnali: [
    S(/imprenditore agricolo professionale/, 9, "«Imprenditore agricolo professionale»"),
    S(/\biap\b/, 5, "IAP"),
    S(/coltivatore diretto/, 6, "coltivatore diretto"),
    S(/attestazione|certificazione|riconoscimento della qualifica/, 2, "attestazione"),
  ] },
  { tipo: "Iscrizione INPS agricola", cat: "fascicolo", segnali: [
    S(/\binps\b/, 6, "INPS"),
    S(/gestione (dei )?(coltivatori diretti|imprenditori agricoli)|previdenza agricola|contributi agricoli unificati/, 6, "previdenza agricola"),
    S(/estratto contributivo|posizione contributiva/, 3, "posizione contributiva"),
  ] },

  // ---------- domande e pratiche ----------
  { tipo: "Domanda Unica", cat: "domande", segnali: [
    S(/domanda unica/, 11, "«Domanda unica»"),
    S(/pagamenti diretti|politica agricola comune|\bpac\b/, 5, "pagamenti diretti PAC"),
    S(/reg(olamento)?\.? \(?ue\)? (n\.? )?2021\/2115/, 5, "Reg. UE 2021/2115"),
    S(/sostegno di base al reddito|eco-?schema|\bbiss\b/, 5, "sostegno di base / eco-schemi"),
    S(/\bagea\b/, 2, "AGEA"),
    S(/\btitoli\b/, 1, "titoli"),
  ] },
  { tipo: "Libretto UMA", cat: "domande", segnali: [
    S(/utenti motori agricoli|\buma\b/, 9, "UMA"),
    S(/carburante agevolato|gasolio (agricolo|agevolato)|prodotti petroliferi/, 6, "gasolio agricolo"),
    S(/libretto/, 3, "libretto"),
    S(/assegnazione|litri/, 2, "litri assegnati"),
  ] },
  { tipo: "Domanda di bando", cat: "domande", segnali: [
    S(/domanda di (sostegno|aiuto|pagamento)/, 9, "domanda di sostegno"),
    S(/\bpsr\b|\bcsr\b|sviluppo rurale/, 5, "Sviluppo rurale"),
    S(/intervento \bsr[a-z]\d{2}\b|\bsr[a-z]\d{2}\b/, 6, "codice intervento SRxx"),
    S(/\bbando\b/, 3, "bando"),
  ] },
  { tipo: "Ricevuta di rilascio", cat: "domande", segnali: [
    S(/ricevuta (di )?(presentazione|rilascio|protocollazione|avvenuta)/, 12, "«Ricevuta di rilascio»"),
    S(/rilasciata (in data|il)|domanda rilasciata/, 4, "domanda rilasciata"),
    S(/\bbarcode\b|codice a barre/, 3, "codice a barre"),
  ] },
  { tipo: "Comunicazione di esito", cat: "domande", segnali: [
    S(/comunicazione (di |dell.)?esito/, 11, "«Comunicazione di esito»"),
    S(/esito (dell.)?istruttori/, 6, "esito istruttoria"),
    S(/ammissibil[ei] a finanziamento|graduatoria/, 3, "graduatoria"),
  ] },
  { tipo: "Preavviso di rigetto (10-bis)", cat: "domande", segnali: [
    S(/10[ -]?bis/, 10, "art. 10-bis"),
    S(/preavviso di rigetto|motivi ostativi/, 9, "motivi ostativi"),
  ] },
  { tipo: "Ricorso / riesame", cat: "domande", segnali: [
    S(/istanza di riesame|\briesame\b/, 9, "riesame"),
    S(/\bricorso\b/, 8, "ricorso"),
  ] },
  { tipo: "Polizza assicurativa agevolata", cat: "domande", segnali: [
    S(/polizza|certificato di assicurazione/, 7, "polizza"),
    S(/assicurazione agevolata|piano (di )?gestione (dei )?rischi/, 6, "assicurazione agevolata"),
    S(/grandine|avversita atmosferiche|gelo/, 4, "avversità atmosferiche"),
    S(/condifesa|consorzio di difesa/, 5, "Condifesa"),
  ] },

  // ---------- contratti ----------
  { tipo: "Contratto di servizio CIA", cat: "contratti", segnali: [
    S(/contratto di (servizio|consulenza|assistenza tecnica)/, 8, "contratto di servizio"),
    S(/confederazione italiana agricoltori|\bcia\b/, 4, "CIA"),
    S(/corrispettivo/, 2, "corrispettivo"),
  ] },
  { tipo: "Contratto di filiera / conferimento", cat: "contratti", segnali: [
    S(/conferimento (delle )?(uve|olive|prodotti)|contratto di conferimento/, 9, "conferimento"),
    S(/\bfiliera\b/, 6, "filiera"),
    S(/cantina sociale|oleificio|cooperativa agricola/, 3, "cantina / oleificio"),
  ] },
  { tipo: "Contratto di fornitura", cat: "contratti", segnali: [S(/contratto di fornitura/, 10, "contratto di fornitura"), S(/\bfornitore\b/, 2, "fornitore")] },
  { tipo: "Contratto di lavoro stagionale", cat: "contratti", segnali: [
    S(/lavoro (stagionale|subordinato|a tempo determinato)|operai[oa] agricol/, 8, "lavoro agricolo"),
    S(/lettera di assunzione|unilav|\bccnl\b/, 5, "assunzione / CCNL"),
  ] },

  // ---------- fatture e pagamenti ----------
  { tipo: "Fattura di acquisto", cat: "fatture", segnali: [
    S(/fattura (elettronica|n\.?|numero|differita|immediata)|\bfattura\b/, 8, "«Fattura»"),
    S(/fatturaelettronica|cedenteprestatore/, 10, "tracciato FatturaPA"),
    S(/imponibile/, 4, "imponibile"),
    S(/totale (documento|fattura|da pagare)/, 4, "totale documento"),
    S(/aliquota|\biva\b/, 2, "IVA"),
  ] },
  { tipo: "Preventivo", cat: "fatture", segnali: [S(/\bpreventivo\b|offerta (economica|n\.?)/, 9, "«Preventivo»"), S(/validita (dell.)?offerta/, 4, "validità offerta")] },
  { tipo: "Quietanza / bonifico", cat: "fatture", segnali: [
    S(/\bbonifico\b/, 8, "bonifico"), S(/quietanza/, 8, "quietanza"), S(/\bcro\b|\btrn\b/, 5, "CRO/TRN"), S(/ordinante|beneficiario/, 3, "ordinante/beneficiario"),
  ] },
  { tipo: "Ricevuta fiscale", cat: "fatture", segnali: [S(/ricevuta fiscale|scontrino|documento commerciale/, 10, "ricevuta / scontrino")] },
  { tipo: "Estratto pagamenti AGEA", cat: "pagamenti", segnali: [
    S(/estratto (dei )?pagamenti|pagamenti (effettuati|erogati|disposti)/, 10, "pagamenti erogati"),
    S(/\bagea\b|organismo pagatore/, 4, "organismo pagatore"),
  ] },
  { tipo: "Decreto di liquidazione", cat: "pagamenti", segnali: [
    S(/decreto di (liquidazione|concessione)|determina(zione)? dirigenziale/, 10, "decreto / determina"),
    S(/\bliquidazione\b/, 4, "liquidazione"),
  ] },
  { tipo: "Contabile bancaria", cat: "pagamenti", segnali: [S(/contabile|\baccredito\b/, 6, "accredito"), S(/estratto conto/, 6, "estratto conto")] },

  // ---------- certificazioni ----------
  { tipo: "Certificato biologico", cat: "cert", segnali: [
    S(/reg(olamento)?\.? \(?ue\)? (n\.? )?2018\/848|reg\.? \(?ce\)? 834\/2007/, 9, "Reg. UE 2018/848"),
    S(/organismo di controllo/, 6, "organismo di controllo"),
    S(/certificato di conformita|documento giustificativo/, 6, "certificato di conformità"),
    S(/agricoltura biologica|produzione biologica|\bbiologic/, 5, "biologico"),
    S(/\bicea\b|\bccpb\b|bioagricert|suolo e salute|\bqcertificazioni\b/, 6, "ente certificatore"),
  ] },
  { tipo: "DURC", cat: "cert", segnali: [
    S(/\bdurc\b|documento unico di regolarita contributiva/, 13, "DURC"),
    S(/risulta regolare nei confronti/, 5, "regolarità contributiva"),
  ] },
  { tipo: "Comunicazione antimafia", cat: "cert", segnali: [S(/antimafia/, 11, "antimafia"), S(/d\.?\s?lgs\.? (n\.? )?159\/2011/, 6, "D.Lgs 159/2011")] },
  { tipo: "Patentino fitosanitari", cat: "cert", segnali: [
    S(/prodotti fitosanitari/, 7, "prodotti fitosanitari"),
    S(/patentino|certificato di abilitazione (all.acquisto|all.utilizzo)/, 7, "abilitazione"),
  ] },
  { tipo: "Attestato di formazione", cat: "cert", segnali: [S(/\battestato\b/, 6, "attestato"), S(/corso di formazione|ha frequentato|ore di formazione/, 6, "corso di formazione")] },
  { tipo: "Autorizzazione / licenza", cat: "cert", segnali: [S(/\bautorizzazione\b|\blicenza\b|nulla osta/, 5, "autorizzazione")] },

  // ---------- altro ----------
  { tipo: "Corrispondenza", cat: "altro", segnali: [
    S(/posta elettronica certificata|\bpec\b/, 3, "PEC"), S(/\boggetto\s*:/, 3, "«Oggetto:»"), S(/spett\.?le|gentile|egregio/, 2, "lettera"),
  ] },
];

// ======================================================================
// Normalizzazione
// ======================================================================
export function normalizza(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’`´]/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ {2,}/g, " ");
}

// ======================================================================
// CUAA (codice fiscale / partita IVA)
// ======================================================================
const RE_CF = /\b[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]\b/g;
const RE_PIVA = /\b\d{11}\b/g;

function pivaValida(p: string) {
  let s = 0;
  for (let i = 0; i < 11; i++) { let n = Number(p[i]); if (i % 2) { n *= 2; if (n > 9) n -= 9; } s += n; }
  return s % 10 === 0 && !/^0+$/.test(p);
}

export function trovaCuaa(testoOriginale: string): string[] {
  const t = testoOriginale.toUpperCase();
  const out = new Set<string>();
  for (const m of t.matchAll(RE_CF)) out.add(m[0]);
  for (const m of t.matchAll(RE_PIVA)) if (pivaValida(m[0])) out.add(m[0]);
  return [...out];
}

// ======================================================================
// Date
// ======================================================================
const MESI: Record<string, number> = { gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 };

export interface DataTrovata { iso: string; pos: number }

function iso(y: number, m: number, d: number) {
  if (y < 100) y += y > 50 ? 1900 : 2000;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d || y < 1900 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function trovaDate(t: string): DataTrovata[] {
  const out: DataTrovata[] = [];
  for (const m of t.matchAll(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/g)) {
    const v = iso(Number(m[3]), Number(m[2]), Number(m[1]));
    if (v) out.push({ iso: v, pos: m.index! });
  }
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const v = iso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (v) out.push({ iso: v, pos: m.index! });
  }
  for (const m of t.matchAll(/\b(\d{1,2})(?:°|º)? (gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\.? (\d{4})\b/g)) {
    const v = iso(Number(m[3]), MESI[m[2]], Number(m[1]));
    if (v) out.push({ iso: v, pos: m.index! });
  }
  return out.sort((a, b) => a.pos - b.pos);
}

export function dataDopo(t: string, date: DataTrovata[], re: RegExp, finestra = 70) {
  for (const m of t.matchAll(re)) {
    const fine = m.index! + m[0].length;
    const d = date.find((x) => x.pos >= m.index! && x.pos - fine <= finestra);
    if (d) return d.iso;
  }
  return null;
}

// ======================================================================
// Altri campi
// ======================================================================
export function numeroIt(s: string) {
  const v = s.replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(v)) return Number(v.replace(/\./g, "").replace(",", "."));
  if (/^\d+(,\d+)?$/.test(v)) return Number(v.replace(",", "."));
  if (/^\d+(\.\d{1,2})$/.test(v)) return Number(v);
  return null;
}

export interface Campi {
  cuaa: string[];
  dataDocumento: string | null;
  scadenza: string | null;
  numero: string | null;
  importo: number | null;
  foglio: string | null;
  particelle: string | null;
  superficieHa: number | null;
  controparte: string | null;
  pratica: string | null;
  anno: number | null;
}

export function estraiCampi(testo: string, tipo: string, codiciPratiche: { id: string; codice: string | null; parole: RegExp | null }[] = [], oggi = new Date()): Campi {
  const t = normalizza(testo);
  const date = trovaDate(t);
  const oggiIso = oggi.toISOString().slice(0, 10);

  // scadenza
  let scadenza = dataDopo(t, date, /data di scadenza|scadenza|scade il|valid[oa] fino al|validita fino al|expiry|valid until|fino al|termine (ultimo|finale)/g);
  // contratti: "dal ... al ..."
  let inizio: string | null = null;
  const dalAl = t.match(/\bdal(?:l')?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2} \w+ \d{4})\s*(?:al|fino al)\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2} \w+ \d{4})/);
  if (dalAl) {
    const d1 = trovaDate(dalAl[1])[0]?.iso ?? null;
    const d2 = trovaDate(dalAl[2])[0]?.iso ?? null;
    if (d1) inizio = d1;
    if (d2 && (!scadenza || tipo.startsWith("Contratto") || tipo.startsWith("Comodato"))) scadenza = d2;
  }
  if (!scadenza && /contratto d'affitto|comodato scritto/i.test(tipo)) {
    const dur = t.match(/durata (?:di )?(?:anni )?(\d{1,2}) ?(?:\(\w+\) )?(anni|annate)/);
    const dec = dataDopo(t, date, /decorr\w*|a partire dal|con inizio (dal|il)/g);
    if (dur && dec) {
      const d = new Date(dec);
      d.setFullYear(d.getFullYear() + Number(dur[1]));
      d.setDate(d.getDate() - 1);
      scadenza = d.toISOString().slice(0, 10);
      inizio = inizio ?? dec;
    }
  }

  // data del documento
  const nascite = new Set<string>();
  for (const m of t.matchAll(/nat[oa] (a|il)|data di nascita|nascita/g)) {
    const d = date.find((x) => x.pos >= m.index! && x.pos - m.index! < 70);
    if (d) nascite.add(d.iso);
  }
  let dataDocumento = dataDopo(t, date, /data (di )?(rilascio|emissione|documento|del documento|stampa|elaborazione)|rilasciat[oa] (il|in data)|emess[oa] il|data fattura|\bdata\s*:|\baddi\b|\bli\b,?/g, 40) ?? inizio;
  if (!dataDocumento) {
    const candidate = date.map((d) => d.iso).filter((d) => d !== scadenza && !nascite.has(d) && d <= oggiIso && d >= "2000-01-01");
    dataDocumento = candidate.sort().pop() ?? null;
  }
  if (dataDocumento && nascite.has(dataDocumento)) dataDocumento = null;

  // numero
  let numero: string | null = null;
  const cie = testo.toUpperCase().match(/\b(C[A-Z]\d{5}[A-Z]{2}|[A-Z]{2} ?\d{7})\b/);
  if (tipo === "Documento d'identità" && cie) numero = cie[1].replace(" ", "");
  if (!numero) {
    const re = /(?:fattura|documento|domanda|contratto|protocollo|prot\.?|pratica|numero|num\.|\bn\.|\bn°|\bnr\.?)\s*(?:n\.?|n°|nr\.?|numero)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\/\-_.]{0,24}\d[A-Z0-9\/\-_]*)/gi;
    for (const m of testo.matchAll(re)) {
      const prima = normalizza(testo.slice(Math.max(0, m.index! - 40), m.index! + m[0].length));
      // esclude i riferimenti normativi (legge n. 203, d.lgs. n. 159, reg. n. ...)
      if (/(legge|\bl\.|decreto|d\.?\s?lgs|d\.?p\.?r|regolamento|\breg\.|art\.|articolo|circolare)[^\n]{0,30}$/.test(prima.slice(0, prima.length - m[1].length))) continue;
      if (/^\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}$/.test(m[1])) continue;
      if (/^\d{1,2}$/.test(m[1])) continue;
      numero = m[1].replace(/[.\-/]+$/, "");
      break;
    }
  }

  // importo
  let importo: number | null = null;
  const tot = t.match(/totale (?:documento|fattura|da pagare|complessivo|generale)?\s*(?:euro|eur|€)?\s*:?\s*(?:euro|eur|€)?\s*([\d.]+,\d{2}|\d+\.\d{2})/);
  if (tot) importo = numeroIt(tot[1]);
  if (importo == null) {
    const tutti = [...t.matchAll(/(?:€|euro|eur)\s*([\d.]+,\d{2})|([\d.]+,\d{2})\s*(?:€|euro|eur)\b/g)].map((m) => numeroIt(m[1] ?? m[2])).filter((x): x is number => x != null);
    if (tutti.length) importo = Math.max(...tutti);
  }

  // catasto
  const fg = t.match(/\bfoglio\s*(?:n\.?|n°|nr\.?)?\s*:?\s*(\d{1,4})\b|\bfg\.?\s*(\d{1,4})\b/);
  const foglio = fg ? (fg[1] ?? fg[2]) : null;
  const pt = t.match(/\b(?:particell[ae]|mappal[ei]|part\.|p\.lla|p\.lle)\s*(?:n\.?|nn\.?|n°)?\s*:?\s*(\d{1,5}(?:\s*(?:,|e|-|\/)\s*\d{1,5})*)/);
  const particelle = pt ? pt[1].replace(/\s*e\s*/g, ", ").replace(/\s*,\s*/g, ", ") : null;

  // superficie
  let superficieHa: number | null = null;
  const haAreCa = t.match(/(?:ha|ettari)\s*(\d{1,4})\s*(?:are|a)\s*(\d{1,2})\s*(?:ca|centiare)\s*(\d{1,2})/);
  const haNum = t.match(/(\d{1,4}(?:[.,]\d{1,4})?)\s*(?:ha|ettari)\b/);
  const mq = t.match(/(\d{1,3}(?:\.\d{3})+|\d{3,7})\s*(?:mq|m2|metri quadr)/);
  if (haAreCa) superficieHa = Number(haAreCa[1]) + Number(haAreCa[2]) / 100 + Number(haAreCa[3]) / 10000;
  else if (haNum) superficieHa = numeroIt(haNum[1]) ?? Number(haNum[1].replace(",", "."));
  else if (mq) superficieHa = Number(mq[1].replace(/\./g, "")) / 10000;
  if (superficieHa != null && (isNaN(superficieHa) || superficieHa <= 0 || superficieHa > 5000)) superficieHa = null;

  // pratica
  let pratica: string | null = null;
  for (const p of codiciPratiche) {
    if (p.codice && new RegExp(`\\b${p.codice.toLowerCase().replace(/[^a-z0-9]/g, "\\W?")}\\b`).test(t)) { pratica = p.id; break; }
  }
  if (!pratica) for (const p of codiciPratiche) if (p.parole && p.parole.test(t)) { pratica = p.id; break; }

  const anno = Number((dataDocumento ?? "").slice(0, 4)) || null;
  return { cuaa: trovaCuaa(testo), dataDocumento, scadenza, numero, importo, foglio, particelle, superficieHa, controparte: null, pratica, anno };
}

// ======================================================================
// Classificazione
// ======================================================================
export interface Candidato { tipo: string; cat: string; punteggio: number; confidenza: number; indizi: string[] }

export function classifica(testo: string, nomeFile: string, opzioni: { immagineSenzaTesto?: boolean } = {}): Candidato[] {
  const t = normalizza(testo);
  const testa = t.slice(0, 220);
  const nf = normalizza(nomeFile.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " "));
  const risultati: Candidato[] = [];

  for (const r of REGOLE) {
    let p = 0;
    const indizi: string[] = [];
    for (const s of r.segnali) {
      const inTesto = s.re.test(t);
      s.re.lastIndex = 0;
      const inTesta = inTesto && s.re.test(testa);
      s.re.lastIndex = 0;
      const inNome = s.re.test(nf);
      s.re.lastIndex = 0;
      if (inTesto) {
        // segnale ripetuto: piccolo bonus, con tetto
        const occ = Math.min(3, (t.match(new RegExp(s.re.source, "g")) ?? []).length);
        p += s.peso * (1 + (occ - 1) * 0.15) * (inTesta ? 1.25 : 1);
        indizi.push(s.etichetta + (inTesta ? " (nel titolo)" : ""));
      }
      if (inNome) { p += s.peso * 0.8; if (!inTesto) indizi.push(`${s.etichetta} nel nome del file`); }
    }
    if (p > 0) risultati.push({ tipo: r.tipo, cat: r.cat, punteggio: p, confidenza: 0, indizi });
  }

  // regole di disambiguazione
  const bump = (tipo: string, f: number) => { const c = risultati.find((x) => x.tipo === tipo); if (c) c.punteggio *= f; };
  if (/comodato verbale/.test(t + " " + nf)) bump("Comodato scritto", 0.5);
  if (/fatturaelettronica|cedenteprestatore/.test(t)) { bump("Fattura di acquisto", 1.6); }
  if (/visura (ordinaria |storica )?camerale|registro (delle )?imprese/.test(t)) bump("Visura catastale", 0.4);
  if (/visura (per soggetto|per immobile|catastale)/.test(t)) bump("Visura camerale", 0.4);
  if (/scheda (di )?validazione/.test(t)) { bump("Piano di coltivazione", 0.6); bump("Domanda Unica", 0.6); }
  if (/ricevuta (di )?(presentazione|rilascio|protocollazione)/.test(t)) { bump("Domanda Unica", 0.7); bump("Libretto UMA", 0.7); bump("Domanda di bando", 0.7); }

  risultati.sort((a, b) => b.punteggio - a.punteggio);

  if (opzioni.immagineSenzaTesto && (risultati[0]?.punteggio ?? 0) < 4) {
    return [{ tipo: "Foto / sopralluogo", cat: "altro", punteggio: 4, confidenza: 0.45, indizi: ["immagine senza testo leggibile"] }];
  }

  const s1 = risultati[0]?.punteggio ?? 0;
  const s2 = risultati[1]?.punteggio ?? 0;
  const forza = 1 - Math.exp(-s1 / 9);
  const margine = s1 / (s1 + s2 + 1e-9);
  for (const r of risultati) {
    const f = 1 - Math.exp(-r.punteggio / 9);
    const m = r.punteggio / (s1 + s2 + 1e-9);
    r.confidenza = Math.round(Math.min(0.99, f * (0.45 + 0.55 * m)) * 100) / 100;
  }
  if (risultati[0]) risultati[0].confidenza = Math.round(Math.min(0.99, forza * (0.45 + 0.55 * margine)) * 100) / 100;
  return risultati.slice(0, 4);
}

// ======================================================================
// FatturaPA (XML)
// ======================================================================
export interface DatiFattura {
  numero: string | null; data: string | null; totale: number | null;
  cedente: { nome: string | null; codici: string[] }; cessionario: { nome: string | null; codici: string[] };
}

function tag(xml: string, nome: string) {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nome}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${nome}>`));
  return m ? m[1] : null;
}
function txt(s: string | null) {
  return s ? s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null : null;
}

export function leggiFatturaPA(xml: string): DatiFattura | null {
  if (!/FatturaElettronica/i.test(xml)) return null;
  const parte = (blocco: string | null) => {
    if (!blocco) return { nome: null, codici: [] as string[] };
    const den = txt(tag(blocco, "Denominazione"));
    const nome = den ?? ([txt(tag(blocco, "Cognome")), txt(tag(blocco, "Nome"))].filter(Boolean).join(" ") || null);
    const codici = [txt(tag(blocco, "CodiceFiscale")), txt(tag(tag(blocco, "IdFiscaleIVA") ?? "", "IdCodice"))].filter((x): x is string => !!x).map((x) => x.toUpperCase());
    return { nome, codici };
  };
  const generali = tag(xml, "DatiGeneraliDocumento") ?? xml;
  let totale = numeroIt(txt(tag(generali, "ImportoTotaleDocumento")) ?? "") ?? (Number(txt(tag(generali, "ImportoTotaleDocumento"))) || null);
  if (totale == null) {
    const riepiloghi = [...xml.matchAll(/<(?:\w+:)?DatiRiepilogo>([\s\S]*?)<\/(?:\w+:)?DatiRiepilogo>/g)];
    const somma = riepiloghi.reduce((s, r) => s + (Number(txt(tag(r[1], "ImponibileImporto"))) || 0) + (Number(txt(tag(r[1], "Imposta"))) || 0), 0);
    totale = somma || null;
  }
  return {
    numero: txt(tag(generali, "Numero")),
    data: txt(tag(generali, "Data")),
    totale,
    cedente: parte(tag(xml, "CedentePrestatore")),
    cessionario: parte(tag(xml, "CessionarioCommittente")),
  };
}
