"use client";

import * as XLSX from "xlsx";

export function ExportExcelButton({
  rows,
  filename,
  sheetName = "Data",
}: {
  rows: Record<string, string | number>[];
  filename: string;
  sheetName?: string;
}) {
  function handleExport() {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  }

  return (
    <button onClick={handleExport} disabled={rows.length === 0}>
      Export Excel
    </button>
  );
}
