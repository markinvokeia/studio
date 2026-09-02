// Shared helpers for building/downloading .xlsx and .csv exports on the client.
// Kept framework-agnostic so both `useReportExport` and one-off exporters
// (e.g. patient-group exports) can reuse the same sanitisation rules.

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Excel sheet names: max 31 chars, no : \ / ? * [ ], and must be unique in the workbook
export function sanitizeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let candidate = base;
  let i = 2;
  while (used.has(candidate)) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  used.add(candidate);
  return candidate;
}

// Filesystem-safe file name (no reserved chars), unique within a set
export function sanitizeFileName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'archivo';
  let candidate = base;
  let i = 2;
  while (used.has(candidate)) {
    candidate = `${base} (${i})`;
    i++;
  }
  used.add(candidate);
  return candidate;
}

export function autoColWidths(aoa: unknown[][], colCount: number) {
  return Array.from({ length: colCount }, (_, i) => ({
    wch: Math.min(
      aoa.reduce((max, row) => Math.max(max, String(row[i] ?? '').length), 10),
      50,
    ),
  }));
}
