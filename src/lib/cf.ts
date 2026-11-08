// Decodifica CUAA: 16 caratteri = codice fiscale persona fisica, 11 cifre = P.IVA società/ente.
const OMOCODIA: Record<string, string> = { L: "0", M: "1", N: "2", P: "3", Q: "4", R: "5", S: "6", T: "7", U: "8", V: "9" };
const MESI_CF = "ABCDEHLMPRST";

// Codici catastali dei comuni del territorio (estendibile)
const BELFIORE: Record<string, string> = {
  I520: "Scerni", A485: "Atessa", B865: "Casalbordino", E372: "Vasto", G799: "Pollutri", E435: "Lanciano",
  L961: "Villalfonsina", L218: "Torino di Sangro", D209: "Cupello", E052: "Gissi", D823: "Furci", G237: "Paglieta",
  C632: "Chieti", D738: "Fossacesia", I148: "San Salvo", F589: "Monteodorisio", F576: "Montenero di Bisaccia",
  H501: "Roma", A345: "L'Aquila", G482: "Pescara", L103: "Teramo", F205: "Milano", L219: "Torino",
};

export type CuaaInfo =
  | { valido: false; motivo: string }
  | { valido: true; tipo: "PG"; avviso?: string }
  | { valido: true; tipo: "PF"; dataNascita: string | null; sesso: "M" | "F"; comune: string | null; estero: boolean; avviso?: string };

export function normalizzaCuaa(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function checkPIVA(p: string) {
  let s = 0;
  for (let i = 0; i < 11; i++) {
    let n = Number(p[i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    s += n;
  }
  return s % 10 === 0;
}

const ODD: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
function checkCF(cf: string) {
  let s = 0;
  for (let i = 0; i < 15; i++) {
    const c = cf[i];
    if (i % 2 === 0) s += ODD[c] ?? 0;
    else s += /[0-9]/.test(c) ? Number(c) : c.charCodeAt(0) - 65;
  }
  return String.fromCharCode(65 + (s % 26)) === cf[15];
}

export function decodeCuaa(raw: string): CuaaInfo {
  const c = normalizzaCuaa(raw);
  if (/^\d{11}$/.test(c)) {
    return checkPIVA(c) ? { valido: true, tipo: "PG" } : { valido: true, tipo: "PG", avviso: "La cifra di controllo della P.IVA non torna: verifica il numero" };
  }
  if (c.length !== 16) return { valido: false, motivo: c.length < 11 ? "Troppo corto" : "Il CUAA deve avere 16 caratteri (CF) o 11 cifre (P.IVA)" };
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(c)) return { valido: false, motivo: "Formato del codice fiscale non valido" };
  const avviso = checkCF(c) ? undefined : "Il carattere di controllo non torna: verifica il codice";
  const s = c.split("");
  for (const i of [6, 7, 9, 10, 12, 13, 14]) if (OMOCODIA[s[i]]) s[i] = OMOCODIA[s[i]];
  const d = s.join("");
  const yy = Number(d.slice(6, 8));
  const mm = MESI_CF.indexOf(d[8]) + 1;
  let dd = Number(d.slice(9, 11));
  const sesso = dd > 40 ? "F" : "M";
  if (dd > 40) dd -= 40;
  const nowYY = new Date().getFullYear() % 100;
  const year = yy > nowYY ? 1900 + yy : 2000 + yy;
  const date = new Date(year, mm - 1, dd);
  const valid = mm > 0 && date.getMonth() === mm - 1 && date.getDate() === dd;
  const codice = d.slice(11, 15);
  return {
    valido: true, tipo: "PF", sesso,
    dataNascita: valid ? `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}` : null,
    comune: BELFIORE[codice] ?? null, estero: codice.startsWith("Z"), avviso,
  };
}

export function eta(dataNascita: string | null | undefined, al: Date = new Date()) {
  if (!dataNascita) return null;
  const [y, m, d] = dataNascita.split("-").map(Number);
  let e = al.getFullYear() - y;
  if (al.getMonth() + 1 < m || (al.getMonth() + 1 === m && al.getDate() < d)) e--;
  return e;
}
