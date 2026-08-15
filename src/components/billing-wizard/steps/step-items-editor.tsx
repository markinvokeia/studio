'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DiscountControl, DocumentTotals } from '@/components/ui/discount-control';
import { Input } from '@/components/ui/input';
import { ServiceSelector } from '@/components/ui/service-selector';
import { useDiscountSettings } from '@/hooks/useDiscountSettings';
import { computeDiscountAmount, computeGrossTotal, computeLineTotals, roundCurrency } from '@/lib/discounts';
import { cn } from '@/lib/utils';
import type { DiscountMode, Service } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EditableItem {
  tempId: string;
  service_id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
  /** Importe NETO: ya lleva aplicado el descuento de la linea, si lo hay. */
  total: number;
  discount_mode?: DiscountMode | null;
  discount_value?: number | null;
}

interface StepItemsEditorProps {
  items: EditableItem[];
  onItemsChange: (items: EditableItem[]) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  isSales?: boolean;
  /** Descuento sobre el total. Solo se usa con ambito 'total'. */
  documentDiscount?: { mode: DiscountMode | null; value: number | null };
  onDocumentDiscountChange?: (next: { mode: DiscountMode | null; value: number | null }) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amount);
}

function makeTempId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StepItemsEditor({
  items,
  onItemsChange,
  currency,
  onCurrencyChange,
  isSales = true,
  documentDiscount,
  onDocumentDiscountChange,
}: StepItemsEditorProps) {
  const [showSelector, setShowSelector] = React.useState(false);
  const discounts = useDiscountSettings();

  /**
   * Totales SIEMPRE derivados de precio x cantidad y del descuento aplicado;
   * nunca de `item.total`, que solo sirve para mostrar la linea.
   */
  const totals = React.useMemo(() => {
    let gross = 0;
    let lineDiscounts = 0;
    for (const item of items) {
      const lineGross = computeGrossTotal(item.unit_price, item.quantity);
      gross += lineGross;
      if (discounts.showLineDiscount) {
        lineDiscounts += computeDiscountAmount(lineGross, { mode: item.discount_mode, value: item.discount_value });
      }
    }
    const grossTotal = roundCurrency(gross);
    const netAfterLines = roundCurrency(grossTotal - roundCurrency(lineDiscounts));
    if (!discounts.showTotalDiscount) {
      return { grossTotal, discountAmount: roundCurrency(grossTotal - netAfterLines), total: netAfterLines };
    }
    const discountAmount = computeDiscountAmount(grossTotal, { mode: documentDiscount?.mode, value: documentDiscount?.value });
    return { grossTotal, discountAmount, total: roundCurrency(grossTotal - discountAmount) };
  }, [items, discounts.showLineDiscount, discounts.showTotalDiscount, documentDiscount]);


  /** Aplica o quita el descuento de una linea y deja su importe al dia. */
  const setLineDiscount = React.useCallback(
    (tempId: string, next: { mode: DiscountMode | null | undefined; value: number | null | undefined }) => {
      onItemsChange(items.map((item) => {
        if (item.tempId !== tempId) return item;
        const discount = { mode: next.mode ?? null, value: next.value ?? null };
        return { ...item, ...discount, total: computeLineTotals(item.unit_price, item.quantity, discount).total };
      }));
    },
    [items, onItemsChange],
  );

  const handleServiceSelect = React.useCallback(
    (_serviceId: string, service?: Service) => {
      if (!service) return;
      // Sin descuento: se aplica a mano con el boton «Aplicar descuentos».
      const newItem: EditableItem = {
        tempId: makeTempId(),
        service_id: String(service.id),
        service_name: service.name,
        unit_price: Number(service.price || 0),
        quantity: 1,
        total: computeGrossTotal(service.price || 0, 1),
        discount_mode: null,
        discount_value: null,
      };
      onItemsChange([...items, newItem]);
      setShowSelector(false);
    },
    [items, onItemsChange],
  );

  const handleQuantityChange = React.useCallback(
    (tempId: string, value: string) => {
      const qty = Math.max(1, parseInt(value, 10) || 1);
      onItemsChange(
        items.map((item) =>
          item.tempId === tempId
            ? { ...item, quantity: qty, total: computeLineTotals(item.unit_price, qty, discounts.showLineDiscount ? { mode: item.discount_mode, value: item.discount_value } : null).total }
            : item,
        ),
      );
    },
    [items, onItemsChange, discounts.showLineDiscount],
  );

  const handlePriceChange = React.useCallback(
    (tempId: string, value: string) => {
      const price = Math.max(0, parseFloat(value) || 0);
      onItemsChange(
        items.map((item) =>
          item.tempId === tempId
            ? { ...item, unit_price: price, total: computeLineTotals(price, item.quantity, discounts.showLineDiscount ? { mode: item.discount_mode, value: item.discount_value } : null).total }
            : item,
        ),
      );
    },
    [items, onItemsChange, discounts.showLineDiscount],
  );

  const handleDelete = React.useCallback(
    (tempId: string) => {
      onItemsChange(items.filter((item) => item.tempId !== tempId));
    },
    [items, onItemsChange],
  );

  return (
    <div className="space-y-4">
      {/* Currency selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Moneda:</span>
        <div className="flex rounded-md border overflow-hidden">
          {(['UYU', 'USD'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onCurrencyChange(c)}
              className={cn(
                'px-3 py-1 text-xs font-medium transition-colors',
                currency === c
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      {items.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Servicios a facturar
          </p>

          {/* Column headers */}
          <div
            className={cn(
              'grid gap-2 px-3 py-1 text-xs font-medium text-muted-foreground',
              discounts.showLineDiscount
                ? 'grid-cols-[1fr_56px_88px_76px_auto_32px]'
                : 'grid-cols-[1fr_64px_96px_80px_32px]',
            )}
          >
            <span>Servicio</span>
            <span className="text-center">Cant.</span>
            <span className="text-center">Precio unit.</span>
            <span className="text-right">Total</span>
            {discounts.showLineDiscount && <span />}
            <span />
          </div>

          <div className="divide-y rounded-lg border overflow-hidden">
            {items.map((item) => (
              <div
                key={item.tempId}
                className={cn(
                  'grid gap-2 items-center px-3 py-2 bg-background',
                  discounts.showLineDiscount
                    ? 'grid-cols-[1fr_56px_88px_76px_auto_32px]'
                    : 'grid-cols-[1fr_64px_96px_80px_32px]',
                )}
              >
                {/* Service name */}
                <span className="text-sm truncate min-w-0">{item.service_name}</span>

                {/* Quantity */}
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange(item.tempId, e.target.value)}
                  className="h-7 text-sm text-center px-1 tabular-nums"
                />

                {/* Unit price */}
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => handlePriceChange(item.tempId, e.target.value)}
                  className="h-7 text-sm text-right px-1 tabular-nums"
                />

                {/* Row total */}
                <span className="text-sm font-medium text-right tabular-nums">
                  {fmtCurrency(item.total, currency)}
                </span>

                {/* Descuento, inline junto al total */}
                {discounts.showLineDiscount && (
                  <DiscountControl
                    mode={item.discount_mode}
                    value={item.discount_value}
                    base={computeGrossTotal(item.unit_price, item.quantity)}
                    currency={currency}
                    maxPct={discounts.maxPct}
                    defaultPct={discounts.defaultPct}
                    canApply={discounts.canApply}
                    onApply={(next) => setLineDiscount(item.tempId, next)}
                    onRemove={() => setLineDiscount(item.tempId, { mode: null, value: null })}
                  />
                )}

                {/* Delete */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(item.tempId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Eliminar</span>
                </Button>
              </div>
            ))}
          </div>

          {/* Grand total */}
          <div className="flex flex-col items-end gap-2 px-3 pt-2">
            {/* Con ambito de documento el campo se ofrece directo, en 0. */}
            {discounts.showTotalDiscount && onDocumentDiscountChange && (
              <DiscountControl
                mode={documentDiscount?.mode}
                value={documentDiscount?.value}
                base={totals.grossTotal}
                currency={currency}
                maxPct={discounts.maxPct}
                defaultPct={discounts.defaultPct}
                canApply={discounts.canApply}
                onApply={(next) => onDocumentDiscountChange({ mode: next.mode ?? null, value: next.value ?? null })}
                onRemove={() => onDocumentDiscountChange({ mode: null, value: null })}
              />
            )}
            <DocumentTotals
              grossTotal={totals.grossTotal}
              discountAmount={totals.discountAmount}
              total={totals.total}
              currency={currency}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No hay servicios. Agrega al menos uno para continuar.
          </p>
        </div>
      )}

      {/* Add service */}
      <div className={cn('space-y-2')}>
        {showSelector ? (
          <div className="space-y-2">
            <ServiceSelector
              isSales={isSales}
              onValueChange={handleServiceSelect}
              placeholder="Buscar servicio..."
              triggerText="Seleccionar servicio"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setShowSelector(false)}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowSelector(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar servicio
          </Button>
        )}
      </div>
    </div>
  );
}
