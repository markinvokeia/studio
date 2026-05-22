'use client';

import * as React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDisplayDate } from '@/lib/utils';
import type { Invoice } from '@/lib/types';

interface StepInvoiceSelectProps {
  invoices: Invoice[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  isLoading: boolean;
  patientName?: string;
}

function fmtCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amount);
}

export function StepInvoiceSelect({
  invoices,
  selectedIds,
  onToggle,
  onNext,
  isLoading,
  patientName,
}: StepInvoiceSelectProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const currency = invoices[0]?.currency || 'USD';

  const totalSelected = invoices
    .filter((inv) => selectedIds.has(inv.id))
    .reduce((sum, inv) => sum + Math.max(0, (inv.total || 0) - (inv.paid_amount || 0)), 0);

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1">
        {patientName && <p className="text-sm font-semibold">{patientName}</p>}
        <p className="text-xs text-muted-foreground">
          Este presupuesto ya está completamente facturado. Selecciona las facturas que deseas cobrar.
        </p>
      </div>

      {/* Invoice list */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Facturas pendientes de pago
        </p>
        {invoices.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>No hay facturas pendientes de pago para este presupuesto.</AlertDescription>
          </Alert>
        ) : (
          <div className="divide-y rounded-lg border overflow-hidden">
            {invoices.map((inv) => {
              const pending = Math.max(0, (inv.total || 0) - (inv.paid_amount || 0));
              const isSelected = selectedIds.has(inv.id);
              const isPartial =
                inv.payment_status === 'partial' || inv.payment_status === 'partially_paid';

              return (
                <label
                  key={inv.id}
                  className="flex items-start gap-3 px-3 py-3 bg-background cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle(inv.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        Factura #{inv.doc_no || inv.invoice_doc_no || inv.id}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {fmtCurrency(pending, inv.currency || currency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {inv.createdAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDisplayDate(inv.createdAt)}
                        </span>
                      )}
                      {isPartial && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-400 text-amber-700"
                        >
                          Pago parcial
                        </Badge>
                      )}
                    </div>
                    {(inv.paid_amount || 0) > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Ya pagado: {fmtCurrency(inv.paid_amount || 0, inv.currency || currency)} —
                        Total: {fmtCurrency(inv.total || 0, inv.currency || currency)}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Total selected summary */}
      {selectedIds.size > 0 && (
        <div className="rounded-md bg-muted px-3 py-2.5 text-sm flex justify-between font-semibold">
          <span>Total a cobrar</span>
          <span className="tabular-nums text-primary">{fmtCurrency(totalSelected, currency)}</span>
        </div>
      )}
    </div>
  );
}
