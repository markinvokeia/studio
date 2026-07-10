'use client';

import { REPORTS_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import type { ColumnDef } from '@tanstack/react-table';
import { useCallback } from 'react';

interface ExportColumn {
  header: string;
  key: string;
}

function deriveExportColumns<T>(columns: ColumnDef<T>[]): ExportColumn[] {
  return columns
    .filter((col) => {
      const c = col as unknown as Record<string, unknown>;
      return typeof c.accessorKey === 'string' && typeof col.header === 'string';
    })
    .map((col) => ({
      header: col.header as string,
      key: (col as unknown as Record<string, unknown>).accessorKey as string,
    }));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Excel sheet names: max 31 chars, no : \ / ? * [ ], and must be unique in the workbook
function sanitizeSheetName(name: string, used: Set<string>): string {
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

// Filesystem-safe file name (no reserved chars), unique within the zip
function sanitizeFileName(name: string, used: Set<string>): string {
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

function buildCSV(
  exportCols: ExportColumn[],
  rows: unknown[],
): string {
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = exportCols.map((c) => escape(c.header)).join(',');
  const dataRows = rows.map((row) =>
    exportCols.map((c) => escape((row as Record<string, unknown>)[c.key])).join(','),
  );
  return [header, ...dataRows].join('\r\n');
}

// A block of rows with its own header row — lets one sheet/file stack several
// blocks that don't share a column shape (e.g. a day-by-day detail followed by
// a per-doctor summary) instead of forcing everything into one flat table.
export interface ExportSection {
  title?: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
}

function sectionsToAOA(sections: ExportSection[]): unknown[][] {
  const aoa: unknown[][] = [];
  sections.forEach((section, idx) => {
    if (!section.rows.length) return;
    if (idx > 0) aoa.push([]);
    if (section.title) aoa.push([section.title]);
    aoa.push(section.columns.map((c) => c.header));
    for (const row of section.rows) {
      aoa.push(section.columns.map((c) => row[c.key] ?? ''));
    }
  });
  return aoa;
}

function sectionsToCSV(sections: ExportSection[]): string {
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines: string[] = [];
  sections.forEach((section, idx) => {
    if (!section.rows.length) return;
    if (idx > 0) lines.push('');
    if (section.title) lines.push(escape(section.title));
    lines.push(section.columns.map((c) => escape(c.header)).join(','));
    for (const row of section.rows) {
      lines.push(section.columns.map((c) => escape(row[c.key])).join(','));
    }
  });
  return lines.join('\r\n');
}

function autoColWidths(aoa: unknown[][], colCount: number) {
  return Array.from({ length: colCount }, (_, i) => ({
    wch: Math.min(
      aoa.reduce((max, row) => Math.max(max, String(row[i] ?? '').length), 10),
      50,
    ),
  }));
}

interface ReportWorkbook {
  name: string;
  sheets: { name: string; sections: ExportSection[] }[];
}

interface ReportExportOptions {
  // One entry per Excel sheet (and, for the single-sheet case, per CSV file).
  // Each sheet stacks one or more sections, each with its own header row —
  // lets a report mix blocks with different column shapes without forcing
  // every row into one flat table. When provided, this fully replaces the
  // flat `columns`/`data` based export for both CSV and Excel (unless
  // `workbooks` is also provided, in which case Excel uses that instead).
  sheets?: { name: string; sections: ExportSection[] }[];
  // Excel only: one .xlsx workbook per entry (each with its own sheets), e.g.
  // one workbook per document type. Bundled into a .zip when there's more
  // than one. Falls back to `sheets` (single workbook) when omitted.
  workbooks?: ReportWorkbook[];
}

function buildWorkbookSheets(utils: typeof import('xlsx').utils, wb: import('xlsx').WorkBook, sheets: { name: string; sections: ExportSection[] }[]) {
  const usedNames = new Set<string>();
  for (const sheet of sheets) {
    const nonEmpty = sheet.sections.filter((s) => s.rows.length);
    if (!nonEmpty.length) continue;
    const aoa = sectionsToAOA(nonEmpty);
    const ws = utils.aoa_to_sheet(aoa);
    const colCount = Math.max(...nonEmpty.map((s) => s.columns.length));
    ws['!cols'] = autoColWidths(aoa, colCount);
    utils.book_append_sheet(wb, ws, sanitizeSheetName(sheet.name, usedNames));
  }
}

export function useReportExport<T>(
  columns: ColumnDef<T>[],
  data: T[] | null,
  filename: string,
  options?: ReportExportOptions,
) {
  const { hasPermission } = usePermissions();
  const canExportData = hasPermission(REPORTS_PERMISSIONS.EXPORT_EXCEL);
  const canExportPDF = hasPermission(REPORTS_PERMISSIONS.EXPORT_PDF);
  const sheets = options?.sheets;
  const workbooks = options?.workbooks;

  const exportCSV = useCallback(async () => {
    if (!data?.length) return;

    if (sheets?.length) {
      const nonEmptySheets = sheets.filter((s) => s.sections.some((sec) => sec.rows.length));
      if (!nonEmptySheets.length) return;

      if (nonEmptySheets.length === 1) {
        const csv = sectionsToCSV(nonEmptySheets[0].sections);
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `${filename}.csv`);
        return;
      }

      // CSV has no concept of multiple sheets: bundle one .csv per sheet into a .zip
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (const sheet of nonEmptySheets) {
        const csv = sectionsToCSV(sheet.sections);
        zip.file(`${sanitizeFileName(sheet.name, usedNames)}.csv`, '﻿' + csv);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${filename}.zip`);
      return;
    }

    const exportCols = deriveExportColumns(columns);
    const csv = buildCSV(exportCols, data);
    // BOM for Excel UTF-8 compatibility on Windows
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${filename}.csv`);
  }, [columns, data, filename, sheets]);

  const exportExcel = useCallback(async () => {
    if (!data?.length) return;
    const { utils, writeFile, write } = await import('xlsx');

    if (workbooks?.length) {
      const nonEmptyWorkbooks = workbooks.filter((w) => w.sheets.some((s) => s.sections.some((sec) => sec.rows.length)));
      if (!nonEmptyWorkbooks.length) return;

      if (nonEmptyWorkbooks.length === 1) {
        const wb = utils.book_new();
        buildWorkbookSheets(utils, wb, nonEmptyWorkbooks[0].sheets);
        writeFile(wb, `${filename}.xlsx`);
        return;
      }

      // One workbook per entry (e.g. per document type): bundle into a .zip
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (const workbook of nonEmptyWorkbooks) {
        const wb = utils.book_new();
        buildWorkbookSheets(utils, wb, workbook.sheets);
        const buffer = write(wb, { type: 'array', bookType: 'xlsx' });
        zip.file(`${sanitizeFileName(workbook.name, usedNames)}.xlsx`, buffer);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${filename}.zip`);
      return;
    }

    const wb = utils.book_new();
    if (sheets?.length) {
      buildWorkbookSheets(utils, wb, sheets);
    } else {
      const exportCols = deriveExportColumns(columns);
      const wsData: unknown[][] = [
        exportCols.map((c) => c.header),
        ...data.map((row) => exportCols.map((c) => (row as Record<string, unknown>)[c.key] ?? '')),
      ];
      const ws = utils.aoa_to_sheet(wsData);
      ws['!cols'] = autoColWidths(wsData, exportCols.length);
      utils.book_append_sheet(wb, ws, 'Datos');
    }

    writeFile(wb, `${filename}.xlsx`);
  }, [columns, data, filename, sheets, workbooks]);

  const exportPDF = useCallback(() => {
    window.print();
  }, []);

  return {
    exportCSV: canExportData && data?.length ? exportCSV : undefined,
    exportExcel: canExportData && data?.length ? exportExcel : undefined,
    exportPDF: canExportPDF && data?.length ? exportPDF : undefined,
  };
}
