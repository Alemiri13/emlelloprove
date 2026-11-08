export const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
export const MESI_BREVI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
export const GIORNI_BREVI = ["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"];

export function todayISO() {
  return toISO(new Date());
}
export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseISO(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
export function fmtDate(s: string | null | undefined) {
  const d = parseISO(s);
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
export function fmtDateLong(s: string | null | undefined) {
  const d = parseISO(s);
  if (!d) return "—";
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtDateTime(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) + " · " +
    d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}
export function daysBetween(a: Date, b: Date) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}
export function daysFromToday(s: string | null | undefined) {
  const d = parseISO(s);
  if (!d) return null;
  return daysBetween(new Date(), d);
}
export function relDays(n: number | null) {
  if (n == null) return "";
  if (n === 0) return "oggi";
  if (n === 1) return "domani";
  if (n === -1) return "ieri";
  return n > 0 ? `tra ${n} giorni` : `${-n} giorni fa`;
}
export function eur(n: number | null | undefined, digits = 0) {
  if (n == null || isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: 2 });
}
export function num(n: number | null | undefined, digits = 2) {
  if (n == null || isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("it-IT", { maximumFractionDigits: digits });
}
export function ha(n: number | null | undefined) {
  if (n == null) return "—";
  return `${num(n)} ha`;
}
export function litri(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Number(n).toLocaleString("it-IT")} L`;
}
export function initials(name: string) {
  const parts = name.replace(/[^A-Za-zÀ-ÿ' ]/g, " ").split(/\s+/).filter((p) => p.length > 1 && !/^(DI|DE|DEL|DELLA|D'|SOCIETA'|S\.S\.|SRL|SPA)$/i.test(p));
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}
export function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s'’(-])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase());
}
export function parseNumber(s: string): number | null {
  const v = s.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (v === "" || v === "-") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
export function fileSize(n: number | null | undefined) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
export function normalizeSearch(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
