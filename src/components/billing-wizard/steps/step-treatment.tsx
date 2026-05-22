'use client';

import * as React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Quote, QuoteItem } from '@/lib/types';
import type { QuoteFinancialSummary } from '@/services/quote-financials';
import { cn } from '@/lib/utils';

interface StepTreatmentProps {
  quote: Quote | null;
  items: QuoteItem[];
  financialSummary: QuoteFinancialSummary | null;
  isLoading: boolean;
  error: string | null;
  patientName?: string;
}

function fmtCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amount);
}

export function StepTreatment({
  quote,
  items,
  financialSummary,
  isLoading,
  error,
  patientName,
}: StepTreatmentProps) {
  const currency = quote?.currency || 'USD';

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-5/6" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const pendingItems = items.filter((item) => Number(item.total) > 0);

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1">
        {patientName && (
          <p className="text-sm font-semibold">{patientName}</p>
        )}
        {quote && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Presupuesto #{quote.doc_no || quote.id}
            {quote.status && (
              <Badge
                variant="outline"
                className={cn('text-[10px]', {
                  'border-emerald-400 text-emerald-700': ['confirmed', 'accepted'].includes(quote.status),
                  'border-amber-400 text-amber-700': ['draft', 'pending', 'sent'].includes(quote.status),
                })}
              >
                {quote.status}
              </Badge>
            )}
          </span>
        )}
      </div>

      {/* Items list */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Servicios a facturar
        </p>
        {pendingItems.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin servicios pendientes de facturación.</p>
        ) : (
          <div className="divide-y rounded-lg border overflow-hidden">
            {pendingItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-background text-sm">
                <span className="flex-1 min-w-0 truncate">{item.service_name}</span>
                {item.tooth_number && (
                  <span className="text-xs text-muted-foreground mr-3">Diente {item.tooth_number}</span>
                )}
                <span className="font-medium tabular-nums">
                  {fmtCurrency(Number(item.total), currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Financial summary */}
      {financialSummary && (
        <div className="rounded-lg border bg-muted/30 divide-y text-sm">
          <div className="flex justify-between px-4 py-2">
            <span className="text-muted-foreground">Total presupuesto</span>
            <span className="tabular-nums">{fmtCurrency(Number(quote?.total || 0), currency)}</span>
          </div>
          {financialSummary.amount_invoiced > 0 && (
            <div className="flex justify-between px-4 py-2">
              <span className="text-muted-foreground">Ya facturado</span>
              <span className="tabular-nums text-muted-foreground">
                {fmtCurrency(financialSummary.amount_invoiced, currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between px-4 py-2 font-semibold">
            <span>Pendiente de facturar</span>
            <span className="tabular-nums text-primary">
              {fmtCurrency(financialSummary.amount_pending_invoice, currency)}
            </span>
          </div>
        </div>
      )}

      {financialSummary?.amount_pending_invoice === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Este presupuesto ya está completamente facturado.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
