'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { parseTeeth } from '@/components/lab-orders/lab-order-shared';

import { cn } from '@/lib/utils';

/** Cuadrantes FDI como se ven de frente al paciente: derecha del paciente a la izquierda. */
const PERMANENT = {
  upper: [[18, 17, 16, 15, 14, 13, 12, 11], [21, 22, 23, 24, 25, 26, 27, 28]],
  lower: [[48, 47, 46, 45, 44, 43, 42, 41], [31, 32, 33, 34, 35, 36, 37, 38]],
};
const PRIMARY = {
  upper: [[55, 54, 53, 52, 51], [61, 62, 63, 64, 65]],
  lower: [[85, 84, 83, 82, 81], [71, 72, 73, 74, 75]],
};

/** Ícono de muela, sin depender de un set de íconos. */
function ToothIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 3c-2.2 0-4 1.8-4 4.2 0 2.3.9 3.6 1.5 5.3.6 1.7.6 3.3 1.1 5.4.4 1.8 1 3.1 2 3.1 1.6 0 1.4-4.5 2.4-6 .5-.8 1.5-.8 2 0 1 1.5.8 6 2.4 6 1 0 1.6-1.3 2-3.1.5-2.1.5-3.7 1.1-5.4.6-1.7 1.5-3 1.5-5.3C21 4.8 19.2 3 17 3c-1.9 0-2.9 1-5 1S8.9 3 7 3Z" />
    </svg>
  );
}

/**
 * Piezas a un toque: odontograma chico (FDI) que escribe en el mismo campo de texto. Lo que se
 * escribe a mano se ve marcado; con un valor que no se entiende, la grilla arranca vacía.
 */
export function LabTeethPicker({ value, onChange, disabled }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('LabOrdersPage.teethPicker');
  const selected = parseTeeth(value) ?? [];
  const hasPrimary = selected.some((n) => n >= 51);
  const [showPrimary, setShowPrimary] = React.useState(hasPrimary);
  const chart = showPrimary ? PRIMARY : PERMANENT;

  const toggle = (tooth: number) => {
    const next = selected.includes(tooth) ? selected.filter((n) => n !== tooth) : [...selected, tooth];
    onChange(next.sort((a, b) => a - b).join(', '));
  };

  const row = (halves: number[][]) => (
    <div className="flex justify-center gap-2">
      {halves.map((half, i) => (
        <div key={i} className={cn('flex gap-0.5', i === 0 && 'border-r border-dashed border-border pr-2')}>
          {half.map((tooth) => {
            const on = selected.includes(tooth);
            return (
              <button
                key={tooth}
                type="button"
                onClick={() => toggle(tooth)}
                aria-pressed={on}
                aria-label={t('tooth', { tooth })}
                className={cn(
                  'h-7 w-7 rounded-md border text-[11px] font-medium tabular-nums transition-colors',
                  on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted',
                )}
              >
                {tooth}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={disabled}
          aria-label={t('open')}
          title={t('open')}
          data-help-id="lab-orders.btn.teeth-picker"
        >
          <ToothIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto space-y-2 p-3" data-help-id="lab-orders.section.teeth-picker">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">{t('title')}</p>
          <div className="inline-flex rounded-md border border-border p-0.5 text-[11px]" role="group" aria-label={t('dentition')}>
            {([false, true] as const).map((primary) => (
              <button
                key={String(primary)}
                type="button"
                onClick={() => setShowPrimary(primary)}
                aria-pressed={showPrimary === primary}
                className={cn('rounded px-2 py-0.5', showPrimary === primary ? 'bg-muted font-semibold' : 'text-muted-foreground')}
              >
                {primary ? t('primary') : t('permanent')}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          {row(chart.upper)}
          <div className="border-t border-border" />
          {row(chart.lower)}
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span>{selected.length > 0 ? t('selected', { teeth: selected.join(', ') }) : t('none')}</span>
          {selected.length > 0 && (
            <button type="button" className="text-primary hover:underline" onClick={() => onChange('')}>{t('clear')}</button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
