/** Esporta un elenco in un file Excel (.xlsx). */
export async function esportaExcel(nomeFile: string, intestazioni: string[], righe: (string | number | null | undefined)[][], foglio = "Elenco") {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([intestazioni, ...righe.map((r) => r.map((c) => (c == null ? "" : c)))]);
  ws["!cols"] = intestazioni.map((h, i) => ({ wch: Math.min(48, Math.max(h.length, ...righe.slice(0, 200).map((r) => String(r[i] ?? "").length)) + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, foglio.slice(0, 31));
  XLSX.writeFile(wb, nomeFile.endsWith(".xlsx") ? nomeFile : `${nomeFile}.xlsx`);
}
