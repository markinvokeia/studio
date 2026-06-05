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

export function useReportExport<T>(
  columns: ColumnDef<T>[],
  data: T[] | null,
  filename: string,
) {
  const { hasPermission } = usePermissions();
  const canExportData = hasPermission(REPORTS_PERMISSIONS.EXPORT_EXCEL);
  const canExportPDF = hasPermission(REPORTS_PERMISSIONS.EXPORT_PDF);

  const exportCSV = useCallback(() => {
    if (!data?.length) return;
    const exportCols = deriveExportColumns(columns);
    const csv = buildCSV(exportCols, data);
    // BOM for Excel UTF-8 compatibility on Windows
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${filename}.csv`);
  }, [columns, data, filename]);

  const exportExcel = useCallback(async () => {
    if (!data?.length) return;
    const exportCols = deriveExportColumns(columns);
    const { utils, writeFile } = await import('xlsx');

    const wsData: unknown[][] = [
      exportCols.map((c) => c.header),
      ...data.map((row) => exportCols.map((c) => (row as Record<string, unknown>)[c.key] ?? '')),
    ];

    const ws = utils.aoa_to_sheet(wsData);

    // Auto-size columns based on max content length
    const colWidths = exportCols.map((c, i) => {
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
  }, [columns, data, filename]);

  const exportPDF = useCallback(() => {
    window.print();
  }, []);

  return {
    exportCSV: canExportData && data?.length ? exportCSV : undefined,
    exportExcel: canExportData && data?.length ? exportExcel : undefined,
    exportPDF: canExportPDF && data?.length ? exportPDF : undefined,
  };
}
