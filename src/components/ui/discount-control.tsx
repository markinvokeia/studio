'use client';

import { Percent, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import {
  computeDiscountAmount,
  hasDiscount as hasDiscountValue,
  isDiscountWithinLimit,
  readDiscountAmount,
  type DiscountInput as DiscountValue,
} from '@/lib/discounts';
import type { DiscountMode, LineDiscountFields } from '@/lib/types';
import { cn } from '@/lib/utils';

const _amountFmt = new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Formato de importe compartido por todas las piezas de descuento. */
export function formatDiscountAmount(amount: number): string {
  return _amountFmt.format(amount);
}

export interface DiscountControlProps {
  /** Descuento ya aplicado. `mode: null` ⇒ la línea no lleva descuento. */
  mode: DiscountMode | null | undefined;
  value: number | null | undefined;
  /** Importe sobre el que se calcula: el bruto de la línea o del documento. */
  base: number;
  currency: string;
  /** Tope de la clínica en % sobre la base. 100 ⇒ sin tope. */
  maxPct: number;
  /** Valor con el que se precarga el editor la primera vez. */
  defaultPct?: number;
  /** Sin permiso `SALES_APPLY_DISCOUNT` no se puede abrir ni editar. */
  canApply?: boolean;
  onApply: (next: DiscountValue) => void;
  onRemove: () => void;
  className?: string;
}

/**
 * Descuento de una línea o de un documento.
 *
 * El disparador vive **inline**, junto al precio o al total, y ocupa lo mismo
 * que un icono: que la clínica tenga descuentos habilitados no significa que se
 * apliquen a todo, así que lo normal es que sólo se vea ese botón. Los campos
 * se rellenan en un popover, para no ensanchar ni partir la fila.
 *
 * Estados:
 * 1. **Sin aplicar** — botón `%` con tooltip «Aplicar descuentos».
 * 2. **Editando** — popover con importe, selector %/moneda y aplicar/cancelar.
 * 3. **Aplicado** — la propia fila muestra `−10 %` como chip; se pulsa para
 *    reabrir el editor con lo ya aplicado, y lleva una ✕ para quitarlo.
 *
 * El valor sólo sale del componente al confirmar: cancelar deja lo que hubiera.
 */
export function DiscountControl({
  mode,
  value,
  base,
  currency,
  maxPct,
  defaultPct = 0,
  canApply = true,
  onApply,
  onRemove,
  className,
}: DiscountControlProps) {
  const t = useTranslations('Discounts');

  const applied = hasDiscountValue({ mode, value });
  const [isOpen, setIsOpen] = React.useState(false);
  const [draftMode, setDraftMode] = React.useState<DiscountMode>(mode ?? 'percent');
  const [draftValue, setDraftValue] = React.useState<string>('');

  const openEditor = (open: boolean) => {
    if (open) {
      // Se precarga con lo aplicado; si no hay nada, con el valor por defecto de
      // la clínica (0 ⇒ campo vacío).
      setDraftMode(mode ?? 'percent');
      setDraftValue(value != null ? String(value) : defaultPct > 0 ? String(defaultPct) : '');
    }
    setIsOpen(open);
  };

  const draftNumber = draftValue === '' ? 0 : Number(draftValue);
  const draft: DiscountValue = { mode: draftMode, value: draftNumber };
  const draftAmount = computeDiscountAmount(base, draft);
  const overLimit = !isDiscountWithinLimit(base, draft, maxPct);
  const canConfirm = !overLimit && draftNumber > 0;

  const confirm = () => {
    if (!canConfirm) return;
    onApply({ mode: draftMode, value: draftNumber });
    setIsOpen(false);
  };

  const appliedAmount = computeDiscountAmount(base, { mode, value });
  // Con un porcentaje, el numero suelto no dice nada: se acompaña del importe
  // que representa. Con importe fijo ese dato ya es el propio valor.
  const appliedLabel = mode === 'percent'
    ? `-${value} % · ${currency} ${formatDiscountAmount(appliedAmount)}`
    : `-${currency} ${formatDiscountAmount(appliedAmount)}`;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('inline-flex items-center gap-1', className)}>
        <Popover open={isOpen} onOpenChange={openEditor}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                {applied ? (
                  // Aplicado: el propio importe rebajado hace de disparador.
                  <button
                    type="button"
                    disabled={!canApply}
                    className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md border border-primary/30 bg-primary/10 px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {appliedLabel}
                  </button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    disabled={!canApply}
                    aria-label={t('applyAction')}
                  >
                    <Percent className="h-4 w-4" />
                  </Button>
                )}
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              {applied
                ? t('appliedSummary', { detail: appliedLabel, amount: formatDiscountAmount(appliedAmount), currency })
                : t('applyAction')}
            </TooltipContent>
          </Tooltip>

          <PopoverContent align="end" className="w-72 space-y-3 p-3">
            <p className="text-xs font-medium text-muted-foreground">{t('fieldLabel')}</p>
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={draftValue}
                placeholder="0"
                aria-label={t('fieldLabel')}
                aria-invalid={overLimit || undefined}
                onChange={(e) => setDraftValue(e.target.value)}
                onKeyDown={(e) => {
                  // Enter confirma en vez de enviar el formulario que lo contiene.
                  if (e.key === 'Enter') { e.preventDefault(); confirm(); }
                }}
                className={cn('h-8 flex-1', overLimit && 'border-destructive focus-visible:ring-destructive')}
              />
              <ModeToggle
                value={draftMode}
                currency={currency}
                onChange={setDraftMode}
                percentLabel={t('percentMode')}
                amountLabel={t('amountMode', { currency })}
              />
            </div>

            {overLimit ? (
              <p className="text-xs text-destructive">{t('overLimit', { max: maxPct })}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('resultingAmount', { amount: formatDiscountAmount(draftAmount), currency })}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="button" size="sm" disabled={!canConfirm} onClick={confirm}>
                {t('confirm')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {applied && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                disabled={!canApply}
                aria-label={t('remove')}
                onClick={onRemove}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">{t('remove')}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

/** Segmentado de dos posiciones: %, o el código de moneda de la venta. */
function ModeToggle({
  value,
  currency,
  onChange,
  percentLabel,
  amountLabel,
}: {
  value: DiscountMode;
  currency: string;
  onChange: (mode: DiscountMode) => void;
  percentLabel: string;
  amountLabel: string;
}) {
  const options: { mode: DiscountMode; text: string; label: string }[] = [
    { mode: 'percent', text: '%', label: percentLabel },
    { mode: 'amount', text: currency, label: amountLabel },
  ];

  return (
    // Violeta: el estado elegido tiene que leerse de un vistazo, y el gris del
    // resto de la UI no daba suficiente contraste entre las dos posiciones.
    <div className="inline-flex shrink-0 items-center rounded-md border border-violet-200 bg-violet-50 p-0.5 dark:border-violet-900 dark:bg-violet-950/40">
      {options.map(({ mode, text, label }) => (
        <button
          key={mode}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'inline-flex h-7 min-w-8 items-center justify-center rounded-[5px] px-2 text-xs font-semibold transition-colors',
            value === mode
              ? 'bg-violet-600 text-white shadow-sm hover:bg-violet-600 dark:bg-violet-500'
              : 'text-violet-700/70 hover:bg-violet-100 hover:text-violet-800 dark:text-violet-300/70 dark:hover:bg-violet-900/60 dark:hover:text-violet-200',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export interface DocumentTotalsProps {
  grossTotal: number;
  discountAmount: number;
  total: number;
  currency: string;
  className?: string;
}

/**
 * Pie de totales. Sin descuento se colapsa a una sola línea, para que un
 * documento sin rebajas se vea igual que antes de esta funcionalidad.
 */
export function DocumentTotals({ grossTotal, discountAmount, total, currency, className }: DocumentTotalsProps) {
  const t = useTranslations('Discounts');
  const showBreakdown = discountAmount > 0;

  return (
    <div className={cn('ml-auto w-full max-w-xs space-y-1 text-sm', className)}>
      {showBreakdown && (
        <>
          <div className="flex justify-between text-muted-foreground">
            <span>{t('subtotal')}</span>
            <span>{`${currency} ${formatDiscountAmount(grossTotal)}`}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t('discount')}</span>
            <span>{`- ${currency} ${formatDiscountAmount(discountAmount)}`}</span>
          </div>
        </>
      )}
      <div className={cn('flex justify-between font-semibold', showBreakdown && 'border-t pt-1 text-base')}>
        <span>{t('total')}</span>
        <span>{`${currency} ${formatDiscountAmount(total)}`}</span>
      </div>
    </div>
  );
}

export interface AppliedDiscountNoteProps {
  line: LineDiscountFields;
  currency: string;
  className?: string;
}

/**
 * Nota de solo lectura para tablas y fichas de detalle: deja ver que el importe
 * de esa linea ya viene rebajado. No renderiza nada si no hubo descuento, para
 * que los documentos sin rebajas se vean igual que antes.
 */
export function AppliedDiscountNote({ line, currency, className }: AppliedDiscountNoteProps) {
  const t = useTranslations('Discounts');
  const amount = readDiscountAmount(line);
  if (amount <= 0) return null;

  const detail = line.discount_mode === 'percent'
    ? `-${line.discount_value} %`
    : `-${currency} ${formatDiscountAmount(Number(line.discount_value ?? amount))}`;

  return (
    <span className={cn('block text-[11px] font-normal text-muted-foreground', className)}>
      {t('appliedSummary', { detail, amount: formatDiscountAmount(amount), currency })}
    </span>
  );
}
