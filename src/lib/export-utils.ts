export interface ExportColumn {
  header: string;
  key: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildCSV(columns: ExportColumn[], rows: unknown[]): string {
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = columns.map((c) => escape(c.header)).join(',');
  const dataRows = rows.map((row) =>
    columns.map((c) => escape((row as Record<string, unknown>)[c.key])).join(','),
  );
  return [header, ...dataRows].join('\r\n');
}

export function downloadCSV(columns: ExportColumn[], rows: unknown[], filename: string): void {
  const csv = buildCSV(columns, rows);
  // BOM for Excel UTF-8 compatibility on Windows
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

export async function downloadExcel(
  columns: ExportColumn[],
  rows: unknown[],
  filename: string,
): Promise<void> {
  const { utils, writeFile } = await import('xlsx');

  const wsData: unknown[][] = [
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => (row as Record<string, unknown>)[c.key] ?? '')),
  ];

  const ws = utils.aoa_to_sheet(wsData);

  const colWidths = columns.map((c, i) => {
    const maxLen = wsData.reduce((max, row) => {
      const val = row[i];
      return Math.max(max, String(val ?? '').length);
    }, c.header.length);
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws['!cols'] = colWidths;

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Datos');
  writeFile(wb, `${filename}.xlsx`);
}
