'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

interface StepResultProps {
  result: ImportResult;
  onClose: () => void;
  onImportAnother: () => void;
}

export function StepResult({ result, onClose, onImportAnother }: StepResultProps) {
  const t = useTranslations('ImportPage.result');
  const total = result.imported + result.skipped + result.errors;
  const allSuccessful = result.errors === 0 && result.skipped === 0;

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div
        className={
          allSuccessful
            ? 'flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30'
            : 'flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30'
        }
      >
        {allSuccessful ? (
          <CheckCircle2 className="h-9 w-9 text-green-600 dark:text-green-400" />
        ) : (
          <XCircle className="h-9 w-9 text-amber-600 dark:text-amber-400" />
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold">
          {allSuccessful ? '¡Importación exitosa!' : 'Importación completada con observaciones'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} registro(s) procesado(s) en total
        </p>
      </div>

      <div className="grid w-full max-w-sm grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-900/10">
          <span className="text-2xl font-bold text-green-600 dark:text-green-400">{result.imported}</span>
          <span className="text-xs text-green-600 dark:text-green-400">{t('imported')}</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border bg-muted/40 p-4">
          <span className="text-2xl font-bold text-muted-foreground">{result.skipped}</span>
          <span className="text-xs text-muted-foreground">{t('skipped')}</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
          <span className="text-2xl font-bold text-red-600 dark:text-red-400">{result.errors}</span>
          <span className="text-xs text-red-600 dark:text-red-400">{t('errors')}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onImportAnother}
          className="rounded-md border px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          {t('importAnother')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
