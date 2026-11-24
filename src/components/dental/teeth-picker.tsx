'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { useAutoHelpId } from '@/components/help/help-scope';

import { parseTeeth } from '@/lib/fdi-teeth';
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
export function ToothIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 3c-2.2 0-4 1.8-4 4.2 0 2.3.9 3.6 1.5 5.3.6 1.7.6 3.3 1.1 5.4.4 1.8 1 3.1 2 3.1 1.6 0 1.4-4.5 2.4-6 .5-.8 1.5-.8 2 0 1 1.5.8 6 2.4 6 1 0 1.6-1.3 2-3.1.5-2.1.5-3.7 1.1-5.4.6-1.7 1.5-3 1.5-5.3C21 4.8 19.2 3 17 3c-1.9 0-2.9 1-5 1S8.9 3 7 3Z" />
    </svg>
  );
}

export interface TeethPickerProps {
  /** Texto del campo: "16, 21" en modo `multi`, "16" o "" en modo `single`. */
  value: string;
  onChange: (value: string) => void;
  /** `single`: una pieza por campo (líneas de presupuesto/factura, tratamientos); elegir otra la reemplaza y cierra. */
  mode?: 'single' | 'multi';
  disabled?: boolean;
  /** `sm` para filas de tablas con inputs de h-7/h-8. */
  size?: 'default' | 'sm';
  /** `ghost`: el ícono va dentro del input (posicionado por `className`) en vez de un botón al lado. */
  variant?: 'outline' | 'ghost';
  className?: string;
  /** Ids explícitos; sin ellos salen del scope de la pantalla (`<scope>.btn.teeth-picker`). */
  helpId?: string;
  sectionHelpId?: string;
}

/**
 * Piezas a un toque: odontograma chico (FDI) que escribe en el mismo campo de texto. Lo que se
 * escribe a mano se ve marcado; con un valor que no se entiende, la grilla arranca vacía.
 */
export function TeethPicker({ value, onChange, mode = 'multi', disabled, size = 'default', variant = 'outline', className, helpId, sectionHelpId }: TeethPickerProps) {
  const t = useTranslations('Common.teethPicker');
  const single = mode === 'single';
  const selected = parseTeeth(value ?? '') ?? [];
  const [open, setOpen] = React.useState(false);
  const [showPrimary, setShowPrimary] = React.useState(false);
  const chart = showPrimary ? PRIMARY : PERMANENT;
  const autoHelpId = useAutoHelpId('btn', 'teeth-picker', helpId);
  const autoSectionHelpId = useAutoHelpId('section', 'teeth-picker', sectionHelpId);

  // Al abrir, mostrar la dentición de lo que ya está elegido.
  const handleOpenChange = (next: boolean) => {
    if (next) setShowPrimary(selected.length > 0 && selected.every((n) => n >= 51));
    setOpen(next);
  };

  const toggle = (tooth: number) => {
    if (single) {
      onChange(selected.includes(tooth) ? '' : String(tooth));
      if (!selected.includes(tooth)) setOpen(false);
      return;
    }
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

  const label = single ? t('openOne') : t('open');

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="icon"
          className={cn('shrink-0', size === 'sm' ? 'h-7 w-7' : 'h-9 w-9', className)}
          disabled={disabled}
          aria-label={label}
          title={label}
          data-help-id={autoHelpId}
        >
          <ToothIcon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto space-y-2 p-3" data-help-id={autoSectionHelpId}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">{single ? t('titleOne') : t('title')}</p>
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
          <span>
            {selected.length === 0
              ? t('none')
              : single
                ? t('selectedOne', { tooth: selected[0] })
                : t('selected', { teeth: selected.join(', ') })}
          </span>
          {selected.length > 0 && (
            <button type="button" className="text-primary hover:underline" onClick={() => onChange('')}>{t('clear')}</button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Input de una sola pieza con el selector como ícono a la izquierda, dentro del campo: entra en
 * columnas angostas (tablas de líneas) sin un botón aparte. El input hijo necesita `pl-7`.
 */
export function ToothInputWithPicker({ value, onChange, disabled, size = 'default', className, children }: {
  value: string | number | null | undefined;
  /** Recibe "21" o "" — el que llama lo convierte al tipo de su campo. */
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: 'default' | 'sm';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('relative', className)}>
      <TeethPicker
        mode="single"
        variant="ghost"
        size="sm"
        disabled={disabled}
        className={cn('absolute left-0.5 top-1/2 z-10 w-6 -translate-y-1/2 text-muted-foreground', size === 'sm' ? 'h-6' : 'h-7')}
        value={value == null ? '' : String(value)}
        onChange={onChange}
      />
      {children}
    </div>
  );
}
