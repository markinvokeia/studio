'use client';

import { useTranslations } from 'next-intl';

interface ParsedData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

interface StepPreviewProps {
  data: ParsedData;
}

const PREVIEW_ROWS = 5;

export function StepPreview({ data }: StepPreviewProps) {
  const t = useTranslations('ImportPage.preview');
  const previewRows = data.rows.slice(0, PREVIEW_ROWS);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5">
          <span className="text-muted-foreground">{t('columns')}:</span>
          <span className="font-semibold">{data.headers.length}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5">
          <span className="text-muted-foreground">{t('totalRows')}:</span>
          <span className="font-semibold">{data.totalRows}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5">
          <span className="text-muted-foreground">{t('showing')}:</span>
          <span className="font-semibold">{Math.min(PREVIEW_ROWS, data.totalRows)} {t('rows')}</span>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border" style={{ maxHeight: '260px' }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
              {data.headers.map((header, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 text-xs text-muted-foreground">{rowIndex + 1}</td>
                {data.headers.map((_, colIndex) => (
                  <td key={colIndex} className="px-3 py-2 text-xs">
                    <span className="max-w-[180px] truncate block" title={row[colIndex] ?? ''}>
                      {row[colIndex] ?? <span className="text-muted-foreground italic">vacío</span>}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
