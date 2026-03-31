'use client';

import { ImportField, ImportSchema } from '@/config/import-schemas';
import { ColumnMapping } from '@/components/import/steps/StepMapColumns';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface ValidationError {
  row: number;
  field: string;
  error: string;
}

export interface ValidationResult {
  valid: number;
  invalid: number;
  errors: ValidationError[];
}

interface StepValidateProps {
  result: ValidationResult;
  onImportValid: () => void;
  onFixCsv: () => void;
  isImporting: boolean;
}

export function validateData(
  rows: string[][],
  headers: string[],
  mapping: ColumnMapping,
  schema: ImportSchema
): ValidationResult {
  const errors: ValidationError[] = [];
  const reverseMapping: Record<string, string> = {};

  // Build reverse map: fieldKey → csvHeader
  Object.entries(mapping).forEach(([csvHeader, fieldKey]) => {
    if (fieldKey) reverseMapping[fieldKey] = csvHeader;
  });

  const requiredFields = schema.fields.filter((f) => f.required);

  rows.forEach((row, rowIndex) => {
    requiredFields.forEach((field: ImportField) => {
      const csvHeader = reverseMapping[field.key];
      if (!csvHeader) {
        // Required field not mapped at all
        errors.push({
          row: rowIndex + 1,
          field: field.label,
          error: `Campo requerido no mapeado`,
        });
        return;
      }
      const colIndex = headers.indexOf(csvHeader);
      const value = colIndex >= 0 ? (row[colIndex] ?? '').trim() : '';
      if (!value) {
        errors.push({
          row: rowIndex + 1,
          field: field.label,
          error: `Valor requerido vacío`,
        });
      }
    });

    // Validate email format if email field is mapped
    const emailHeader = reverseMapping['email'];
    if (emailHeader) {
      const colIndex = headers.indexOf(emailHeader);
      const value = colIndex >= 0 ? (row[colIndex] ?? '').trim() : '';
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push({ row: rowIndex + 1, field: 'Email', error: 'Formato de email inválido' });
      }
    }

    // Validate date fields
    schema.fields
      .filter((f) => f.type === 'date')
      .forEach((field) => {
        const csvHeader = reverseMapping[field.key];
        if (!csvHeader) return;
        const colIndex = headers.indexOf(csvHeader);
        const value = colIndex >= 0 ? (row[colIndex] ?? '').trim() : '';
        if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          errors.push({
            row: rowIndex + 1,
            field: field.label,
            error: `Formato de fecha inválido (esperado YYYY-MM-DD)`,
          });
        }
      });

    // Validate number fields
    schema.fields
      .filter((f) => f.type === 'number')
      .forEach((field) => {
        const csvHeader = reverseMapping[field.key];
        if (!csvHeader) return;
        const colIndex = headers.indexOf(csvHeader);
        const value = colIndex >= 0 ? (row[colIndex] ?? '').trim() : '';
        if (value && isNaN(Number(value))) {
          errors.push({
            row: rowIndex + 1,
            field: field.label,
            error: `Valor numérico inválido`,
          });
        }
      });
  });

  // Group errors by row to count invalid rows
  const invalidRows = new Set(errors.map((e) => e.row));
  const invalid = invalidRows.size;
  const valid = rows.length - invalid;

  return { valid, invalid, errors };
}

export function StepValidate({ result, onImportValid, onFixCsv, isImporting }: StepValidateProps) {
  const t = useTranslations('ImportPage.validate');
  const totalRecords = result.valid + result.invalid;
  const allValid = result.invalid === 0;

  // Group errors by row for display
  const errorsByRow = result.errors.reduce<Record<number, ValidationError[]>>((acc, err) => {
    if (!acc[err.row]) acc[err.row] = [];
    acc[err.row].push(err);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1 rounded-lg border bg-card p-4">
          <span className="text-2xl font-bold">{totalRecords}</span>
          <span className="text-xs text-muted-foreground">{t('totalRecords')}</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-900/10">
          <span className="text-2xl font-bold text-green-600 dark:text-green-400">{result.valid}</span>
          <span className="text-xs text-green-600 dark:text-green-400">{t('validRecords')}</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
          <span className="text-2xl font-bold text-red-600 dark:text-red-400">{result.invalid}</span>
          <span className="text-xs text-red-600 dark:text-red-400">{t('invalidRecords')}</span>
        </div>
      </div>

      {allValid ? (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-900/10">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">{t('noErrors')}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Se encontraron errores en {result.invalid} fila(s). Podés importar solo los registros válidos o corregir el CSV.
            </p>
          </div>

          {/* Error table */}
          <div className="overflow-hidden rounded-lg border">
            <div className="border-b bg-muted/50 px-4 py-2">
              <p className="text-xs font-medium text-muted-foreground">{t('errorDetails')}</p>
            </div>
            <div>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">{t('row')}</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">{t('field')}</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">{t('error')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(errorsByRow).map(([rowNum, errs]) =>
                    errs.map((err, i) => (
                      <tr key={`${rowNum}-${i}`} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 font-mono text-muted-foreground">{rowNum}</td>
                        <td className="px-4 py-2">{err.field}</td>
                        <td className="px-4 py-2 text-destructive">{err.error}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {result.valid > 0 && (
          <button
            type="button"
            onClick={onImportValid}
            disabled={isImporting}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isImporting ? 'Importando...' : `${t('importValid')} (${result.valid})`}
          </button>
        )}
        <button
          type="button"
          onClick={onFixCsv}
          disabled={isImporting}
          className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          <XCircle className="h-4 w-4 text-muted-foreground" />
          {t('fixCsv')}
        </button>
      </div>
    </div>
  );
}
