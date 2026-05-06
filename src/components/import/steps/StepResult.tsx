'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  error_details?: { row: number; name: string; error: string }[];
}

interface StepResultProps {
  result: ImportResult;
}

export function StepResult({ result }: StepResultProps) {
  const t = useTranslations('ImportPage.result');
  const total = result.inserted + result.updated + result.skipped + result.errors;
  const allSuccessful = result.errors === 0 && result.skipped === 0;

  return (
    <div className="flex flex-col gap-6 py-2">
      {/* Status icon + title */}
      <div className="flex items-center gap-4">
        <div
          className={
            allSuccessful
              ? 'flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30'
              : 'flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30'
          }
        >
          {allSuccessful ? (
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          ) : (
            <XCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <div>
          <h3 className="text-base font-semibold leading-tight">
            {allSuccessful ? '¡Importación exitosa!' : 'Importación completada con observaciones'}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total} registro(s) procesado(s) en total
          </p>
        </div>
      </div>

      {/* Stats — 2×2 on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col items-center gap-1 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-900/10">
          <span className="text-2xl font-bold text-green-600 dark:text-green-400">{result.inserted}</span>
          <span className="text-xs text-green-600 dark:text-green-400 text-center">{t('inserted')}</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{result.updated}</span>
          <span className="text-xs text-blue-600 dark:text-blue-400 text-center">{t('updated')}</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border bg-muted/40 p-4">
          <span className="text-2xl font-bold text-muted-foreground">{result.skipped}</span>
          <span className="text-xs text-muted-foreground text-center">{t('skipped')}</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
          <span className="text-2xl font-bold text-red-600 dark:text-red-400">{result.errors}</span>
          <span className="text-xs text-red-600 dark:text-red-400 text-center">{t('errors')}</span>
        </div>
      </div>

      {/* Error details — scrollable, no expande ilimitado */}
      {result.error_details && result.error_details.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Registros con error</p>

          {/* Mobile: error cards */}
          <div className="flex flex-col gap-2 sm:hidden max-h-48 overflow-y-auto pr-1">
            {result.error_details.map((err, i) => (
              <div key={i} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Fila {err.row}</span>
                  {err.name && <span className="text-xs font-medium text-foreground">{err.name}</span>}
                </div>
                <p className="text-xs text-destructive">{err.error}</p>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-hidden rounded-lg border">
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fila</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.error_details.map((err, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-1.5 font-mono text-muted-foreground">{err.row}</td>
                      <td className="px-4 py-1.5">{err.name || '—'}</td>
                      <td className="px-4 py-1.5 text-destructive">{err.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
