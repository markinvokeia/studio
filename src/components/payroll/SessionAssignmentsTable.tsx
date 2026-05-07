'use client';

import type { PayrollSessionAssignment } from '@/lib/types';
import { formatCurrency } from '@/components/payroll/payroll-utils';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface Props {
  assignments: PayrollSessionAssignment[];
  onToggle?: (id: string, included: boolean) => void;
  readonly?: boolean;
}

export function SessionAssignmentsTable({ assignments, onToggle, readonly }: Props) {
  const t = useTranslations('PayrollPage.periodDetail.sessionsList');

  if (assignments.length === 0) {
    return <p className="text-sm text-muted-foreground py-3 text-center">{t('noSessions')}</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground mb-1">{t('title')}</p>

      {/* Desktop */}
      <div className="hidden sm:block overflow-hidden rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b">
            <tr>
              {!readonly && <th className="px-3 py-2 text-left font-medium text-muted-foreground w-10">{t('include')}</th>}
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('date')}</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('services')}</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('billed')}</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('listed')}</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('hours')}</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((sa) => (
              <tr
                key={sa.id}
                className={cn(
                  'border-b last:border-0',
                  !sa.is_included && 'opacity-50 bg-muted/20'
                )}
              >
                {!readonly && (
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={sa.is_included}
                      onChange={(e) => onToggle?.(sa.id, e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                  </td>
                )}
                <td className="px-3 py-1.5 font-mono text-muted-foreground">{sa.session_date}</td>
                <td className="px-3 py-1.5 text-muted-foreground max-w-[180px] truncate">{sa.service_names ?? '—'}</td>
                <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(sa.revenue_billed)}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">{formatCurrency(sa.revenue_listed)}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">{sa.hours_billed}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-1.5 sm:hidden">
        {assignments.map((sa) => (
          <div
            key={sa.id}
            className={cn(
              'rounded-md border px-3 py-2 flex items-center gap-2',
              !sa.is_included && 'opacity-50 bg-muted/20'
            )}
          >
            {!readonly && (
              <input
                type="checkbox"
                checked={sa.is_included}
                onChange={(e) => onToggle?.(sa.id, e.target.checked)}
                className="h-4 w-4 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-muted-foreground">{sa.session_date}</span>
                <span className="text-xs font-medium">{formatCurrency(sa.revenue_billed)}</span>
              </div>
              {sa.service_names && (
                <p className="text-xs text-muted-foreground truncate">{sa.service_names}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
