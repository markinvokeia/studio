'use client';

import { ImportField, ImportSchema } from '@/config/import-schemas';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export type ColumnMapping = Record<string, string | null>;

interface StepMapColumnsProps {
  csvHeaders: string[];
  schema: ImportSchema;
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

function normalizeKey(s: string) {
  return s.toLowerCase().replace(/[\s_-]+/g, '_').trim();
}

export function buildAutoMapping(csvHeaders: string[], fields: ImportField[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  csvHeaders.forEach((header) => {
    const normalizedHeader = normalizeKey(header);
    const match = fields.find((f) => normalizeKey(f.key) === normalizedHeader);
    mapping[header] = match ? match.key : null;
  });
  return mapping;
}

export function StepMapColumns({ csvHeaders, schema, mapping, onChange }: StepMapColumnsProps) {
  const t = useTranslations('ImportPage.mapping');

  const handleChange = (csvHeader: string, fieldKey: string | null) => {
    onChange({ ...mapping, [csvHeader]: fieldKey });
  };

  const isAutoMapped = (csvHeader: string, fieldKey: string | null) => {
    if (!fieldKey) return false;
    return normalizeKey(csvHeader) === normalizeKey(fieldKey);
  };

  const isUnmapped = (csvHeader: string) => {
    const value = mapping[csvHeader];
    return value === null || value === undefined;
  };

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-1/2">
              {t('csvColumn')}
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-1/2">
              {t('entityField')}
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-24">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {csvHeaders.map((header) => {
            const currentValue = mapping[header] ?? null;
            const autoMapped = isAutoMapped(header, currentValue);
            const unmapped = isUnmapped(header);

            return (
              <tr key={header} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-block rounded px-2 py-0.5 font-mono text-xs',
                      unmapped
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    {header}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={currentValue ?? ''}
                    onChange={(e) => handleChange(header, e.target.value || null)}
                    className={cn(
                      'w-full rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50',
                      unmapped ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-background'
                    )}
                  >
                    <option value="">{t('noMap')}</option>
                    {schema.fields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label}
                        {field.required ? ` (${t('required')})` : ''}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  {unmapped ? (
                    <span className="text-xs text-muted-foreground italic">{t('noMap')}</span>
                  ) : autoMapped ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {t('autoMapped')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Manual
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Field reference */}
      <div className="border-t bg-muted/30 px-4 py-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Campos disponibles en el sistema:</p>
        <div className="flex flex-wrap gap-1.5">
          {schema.fields.map((field) => (
            <span
              key={field.key}
              className={cn(
                'inline-block rounded-full px-2 py-0.5 text-xs',
                field.required
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'bg-muted text-muted-foreground'
              )}
              title={field.hint}
            >
              {field.label}
              {field.required ? ' *' : ''}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">* campos requeridos</p>
      </div>
    </div>
  );
}
