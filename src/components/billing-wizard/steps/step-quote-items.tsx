'use client';

import * as React from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Plus, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import type { Invoice, Quote, QuoteItem } from '@/lib/types';
import type { QuoteFinancialSummary } from '@/services/quote-financials';
import { StepInvoiceSelect } from './step-invoice-select';

export interface QuoteBillingLine {
  quoteItemId: string;
  serviceId: string;
  serviceName: string;
  toothNumber?: number;
  originalTotal: number;
  alreadyInvoiced: number;
  pendingAmount: number;
  amountToInvoice: number;
  selected: boolean;
}

interface StepQuoteItemsProps {
  quote: Quote | null;
  quoteItems: QuoteItem[];
  existingInvoices: Invoice[];
  financialSummary: QuoteFinancialSummary | null;
  isLoading: boolean;
  error: string | null;
  patientName?: string;
  isSales: boolean;
  lines: QuoteBillingLine[];
  onLinesChange: (lines: QuoteBillingLine[]) => void;
  onFetchingChange?: (isFetching: boolean) => void;
  /** Unpaid invoices the user can select for payment (without creating a new invoice) */
  availableInvoices?: Invoice[];
  selectedInvoiceIds?: Set<string>;
  onToggleInvoice?: (id: string) => void;
}

function fmtCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amount);
}

async function fetchPerItemInvoicedAmounts(
  invoices: Invoice[],
  quoteItems: QuoteItem[],
  isSales: boolean,
): Promise<Map<string, number>> {
  const invoicedByItem = new Map<string, number>();
  const endpoint = isSales ? API_ROUTES.SALES.INVOICE_ITEMS : API_ROUTES.PURCHASES.INVOICE_ITEMS;

  await Promise.all(
    invoices
      .filter((inv) => inv.type !== 'credit_note')
      .map(async (invoice) => {
        try {
          const data = await api.get(endpoint, {
            invoice_id: invoice.id,
            is_sales: isSales ? 'true' : 'false',
          });
          const items: any[] = Array.isArray(data) ? data : (data.invoice_items || data.data || []);
          for (const item of items) {
            const amount = Math.abs(Number(item.total || 0));
            const quoteItemId: string | null =
              item.quote_item_id != null ? String(item.quote_item_id) : null;
            if (quoteItemId) {
              invoicedByItem.set(quoteItemId, (invoicedByItem.get(quoteItemId) || 0) + amount);
            } else {
              // Fallback: match by service_id
              const match = quoteItems.find(
                (qi) => String(qi.service_id) === String(item.service_id),
              );
              if (match) {
                invoicedByItem.set(match.id, (invoicedByItem.get(match.id) || 0) + amount);
              }
            }
          }
        } catch {
          // ignore per-invoice fetch errors
        }
      }),
  );

  return invoicedByItem;
}

export function StepQuoteItems({
  quote,
  quoteItems,
  existingInvoices,
  financialSummary,
  isLoading,
  error,
  patientName,
  isSales,
  lines,
  onLinesChange,
  onFetchingChange,
  availableInvoices,
  selectedInvoiceIds,
  onToggleInvoice,
}: StepQuoteItemsProps) {
  const currency = quote?.currency || 'USD';
  const [isFetchingInvoiced, setIsFetchingInvoiced] = React.useState(false);
  // Stores the last computed per-item invoiced amounts so restoreLine can use correct values
  const [invoicedByItemMap, setInvoicedByItemMap] = React.useState<Map<string, number>>(new Map());

  const setFetching = React.useCallback((val: boolean) => {
    setIsFetchingInvoiced(val);
    onFetchingChange?.(val);
  }, [onFetchingChange]);

  // Collapsible services section — starts expanded; auto-collapses once when fully invoiced
  const [servicesExpanded, setServicesExpanded] = React.useState(true);
  const didAutoCollapseRef = React.useRef(false);
  React.useEffect(() => {
    if (isFetchingInvoiced || didAutoCollapseRef.current) return;
    if (lines.length > 0 && lines.every((l) => l.pendingAmount <= 0)) {
      didAutoCollapseRef.current = true;
      setServicesExpanded(false);
    }
  }, [isFetchingInvoiced, lines]);

  // Keep a ref to the latest lines without including it in effect deps
  const linesRef = React.useRef(lines);
  React.useLayoutEffect(() => { linesRef.current = lines; });

  // Single effect: initialises lines with correct alreadyInvoiced amounts.
  // Runs whenever quoteItems or existingInvoices change (i.e. on first load and after resets).
  // Uses linesRef to preserve any edits the user has already made when re-running.
  React.useEffect(() => {
    if (quoteItems.length === 0) return;

    const nonCreditInvoices = existingInvoices.filter((inv) => inv.type !== 'credit_note');

    setFetching(true);
    const fetchPromise = nonCreditInvoices.length > 0
      ? fetchPerItemInvoicedAmounts(nonCreditInvoices, quoteItems, isSales)
      : Promise.resolve(new Map<string, number>());

    fetchPromise
      .then((invoicedByItem) => {
        setInvoicedByItemMap(invoicedByItem);
        const currentLines = linesRef.current;
        const initial: QuoteBillingLine[] = quoteItems
          .filter((qi) => Number(qi.total) > 0)
          .map((qi) => {
            const invoiced = invoicedByItem.get(qi.id) || 0;
            const pending = Math.max(0, Number(qi.total) - invoiced);
            const existingLine = currentLines.find((l) => l.quoteItemId === qi.id);
            return {
              quoteItemId: qi.id,
              serviceId: qi.service_id,
              serviceName: qi.service_name,
              toothNumber: qi.tooth_number,
              originalTotal: Number(qi.total),
              alreadyInvoiced: invoiced,
              pendingAmount: pending,
              // Preserve user edits but cap at new pending
              amountToInvoice: existingLine
                ? Math.min(existingLine.amountToInvoice, pending)
                : pending,
              // Preserve user selection; force-deselect if no pending
              selected: existingLine
                ? (pending > 0 ? existingLine.selected : false)
                : pending > 0,
            };
          });
        onLinesChange(initial);
      })
      .finally(() => setFetching(false));
  // linesRef is a ref, no need in deps. onLinesChange is stable setState.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteItems, existingInvoices, isSales]);

  // Track which quoteItemIds have been explicitly removed so we can offer to restore them
  const removedQuoteItems = React.useMemo(
    () =>
      quoteItems.filter(
        (qi) => Number(qi.total) > 0 && !lines.some((l) => l.quoteItemId === qi.id),
      ),
    [quoteItems, lines],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
        ))}
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

  const totalToInvoice = lines
    .filter((l) => l.selected)
    .reduce((sum, l) => sum + l.amountToInvoice, 0);

  const updateLine = (quoteItemId: string, patch: Partial<QuoteBillingLine>) =>
    onLinesChange(
      lines.map((l) => {
        if (l.quoteItemId !== quoteItemId) return l;
        const merged = { ...l, ...patch };
        if (merged.amountToInvoice > merged.pendingAmount) {
          merged.amountToInvoice = merged.pendingAmount;
        }
        return merged;
      }),
    );

  const removeLine = (quoteItemId: string) =>
    onLinesChange(lines.filter((l) => l.quoteItemId !== quoteItemId));

  const restoreLine = (qi: QuoteItem) => {
    const invoiced = invoicedByItemMap.get(qi.id) || 0;
    const pending = Math.max(0, Number(qi.total) - invoiced);
    onLinesChange([
      ...lines,
      {
        quoteItemId: qi.id,
        serviceId: qi.service_id,
        serviceName: qi.service_name,
        toothNumber: qi.tooth_number,
        originalTotal: Number(qi.total),
        alreadyInvoiced: invoiced,
        pendingAmount: pending,
        amountToInvoice: pending,
        selected: pending > 0,
      },
    ]);
  };

  return (
    <div className="space-y-4">
      {/* Quote header */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1">
        {patientName && <p className="text-sm font-semibold">{patientName}</p>}
        {quote && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Presupuesto #{quote.doc_no || quote.id}</span>
            {quote.status && (
              <Badge
                variant="outline"
                className={cn('text-[10px]', {
                  'border-emerald-400 text-emerald-700': ['confirmed', 'accepted'].includes(
                    quote.status,
                  ),
                  'border-amber-400 text-amber-700': ['draft', 'pending', 'sent'].includes(
                    quote.status,
                  ),
                })}
              >
                {quote.status}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Selectable unpaid invoices — embedded invoice selector */}
      {availableInvoices && availableInvoices.length > 0 && (
        <StepInvoiceSelect
          invoices={availableInvoices}
          selectedIds={selectedInvoiceIds ?? new Set()}
          onToggle={onToggleInvoice ?? (() => {})}
          isLoading={false}
          isSales={isSales}
          embedded
        />
      )}

      {/* Servicios — collapsible section */}
      {(() => {
        const allFullyInvoiced = lines.length > 0 && lines.every((l) => l.pendingAmount <= 0);
        const hasPendingServices = lines.some((l) => l.pendingAmount > 0);
        const sectionTitle = allFullyInvoiced ? 'Servicios Facturados' : 'Servicios a facturar';

        return (
          <div className="space-y-1.5">
            {/* Header toggle */}
            <button
              type="button"
              onClick={() => setServicesExpanded((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {sectionTitle}
                </p>
                {!isFetchingInvoiced && lines.length > 0 && (
                  <span
                    className={cn(
                      'text-[10px] font-medium rounded-full px-2 py-0.5',
                      allFullyInvoiced
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {allFullyInvoiced ? 'Completamente facturado' : 'Con servicios pendientes'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {isFetchingInvoiced && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Calculando...
                  </span>
                )}
                {servicesExpanded
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                }
              </div>
            </button>

            {/* Status message when collapsed */}
            {!servicesExpanded && !isFetchingInvoiced && (
              <p className={cn('text-xs px-0.5 italic', allFullyInvoiced ? 'text-emerald-700' : 'text-amber-700')}>
                {allFullyInvoiced
                  ? 'Este presupuesto ha sido completamente facturado.'
                  : hasPendingServices
                    ? 'Este presupuesto no ha sido completamente facturado.'
                    : 'Este presupuesto no tiene servicios facturados aún.'}
              </p>
            )}

            {/* Collapsible content */}
            {servicesExpanded && (
              <>
                {lines.length === 0 ? (
                  <p className="py-3 text-center text-sm text-muted-foreground italic">
                    No hay servicios en el presupuesto.
                  </p>
                ) : (
                  <div className="divide-y rounded-lg border overflow-hidden">
                    {lines.map((line) => {
                      const fullyInvoiced = line.pendingAmount <= 0;
                      return (
                        <div
                          key={line.quoteItemId}
                          className={cn(
                            'px-3 py-2.5 bg-background',
                            (fullyInvoiced || !line.selected) && 'opacity-60 bg-muted/20',
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <Checkbox
                              checked={line.selected}
                              disabled={fullyInvoiced || isFetchingInvoiced}
                              onCheckedChange={(checked) =>
                                updateLine(line.quoteItemId, { selected: !!checked })
                              }
                              className="mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm truncate">{line.serviceName}</span>
                                {line.toothNumber && (
                                  <span className="shrink-0 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    D.{line.toothNumber}
                                  </span>
                                )}
                                {fullyInvoiced && (
                                  <span className="shrink-0 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                    Facturado
                                  </span>
                                )}
                              </div>
                              {!isFetchingInvoiced && (
                                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                  <span>Presup. {fmtCurrency(line.originalTotal, currency)}</span>
                                  {line.alreadyInvoiced > 0 && (
                                    <>
                                      <span>·</span>
                                      <span>Fact. {fmtCurrency(line.alreadyInvoiced, currency)}</span>
                                    </>
                                  )}
                                  {!fullyInvoiced && (
                                    <>
                                      <span>·</span>
                                      <span className="font-medium">
                                        Pend. {fmtCurrency(line.pendingAmount, currency)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            {!fullyInvoiced && (
                              <div className="flex flex-col items-end gap-0.5 shrink-0">
                                <div className="flex items-center gap-1.5">
                                  <FormattedNumberInput
                                    value={line.amountToInvoice}
                                    onChange={(val) =>
                                      updateLine(line.quoteItemId, {
                                        amountToInvoice: Math.max(0, Math.min(val, line.pendingAmount)),
                                      })
                                    }
                                    disabled={!line.selected || isFetchingInvoiced}
                                    className="h-7 w-24 text-right text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeLine(line.quoteItemId)}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                    title="Quitar línea"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                {line.selected && line.pendingAmount > 0 && (
                                  <span className="text-[10px] tabular-nums text-muted-foreground">
                                    Máx. {fmtCurrency(line.pendingAmount, currency)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Restore removed lines */}
                {removedQuoteItems.length > 0 && (
                  <div className="pt-1 space-y-1">
                    <p className="text-xs text-muted-foreground">Líneas quitadas (click para restaurar):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {removedQuoteItems.map((qi) => (
                        <button
                          key={qi.id}
                          type="button"
                          onClick={() => restoreLine(qi)}
                          className="flex items-center gap-1 text-xs border rounded-md px-2 py-1 hover:bg-muted transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          {qi.service_name}
                          {qi.tooth_number ? ` (D.${qi.tooth_number})` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Financial summary */}
                {financialSummary && (
                  <div className="rounded-lg border bg-muted/30 divide-y text-sm">
                    <div className="flex justify-between px-4 py-2">
                      <span className="text-muted-foreground">Total presupuesto</span>
                      <span className="tabular-nums">
                        {fmtCurrency(Number(quote?.total || 0), currency)}
                      </span>
                    </div>
                    {financialSummary.amount_invoiced > 0 && (
                      <div className="flex justify-between px-4 py-2">
                        <span className="text-muted-foreground">Ya facturado</span>
                        <span className="tabular-nums text-muted-foreground">
                          {fmtCurrency(financialSummary.amount_invoiced, currency)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between px-4 py-2">
                      <span className="text-muted-foreground">Pendiente de facturar</span>
                      <span className="tabular-nums">
                        {fmtCurrency(financialSummary.amount_pending_invoice, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-2 font-semibold">
                      <span>A facturar ahora</span>
                      <span className="tabular-nums text-primary">{fmtCurrency(totalToInvoice, currency)}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
