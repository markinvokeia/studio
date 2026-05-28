'use client';

import * as React from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { cn, formatDisplayDate } from '@/lib/utils';
import type { Invoice } from '@/lib/types';

// ── Internal types ────────────────────────────────────────────────────────────

interface InvoiceLineItem {
  id: string;
  description: string;
  toothNumber?: number;
  quantity: number;
  total: number;
}

interface InvoicePaymentEntry {
  id: string;
  docNo?: string;
  method?: string;
  date?: string;
  amount: number;
  currency: string;
}

interface InvoiceDetail {
  items: InvoiceLineItem[];
  payments: InvoicePaymentEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function paymentStatusBadge(status?: string): { label: string; cls: string } | null {
  switch (status) {
    case 'paid':          return { label: 'Pagado',       cls: 'border-emerald-400 text-emerald-700' };
    case 'partial':
    case 'partially_paid': return { label: 'Pago parcial', cls: 'border-amber-400 text-amber-700' };
    case 'unpaid':        return { label: 'Sin pagar',    cls: 'border-slate-300 text-slate-500' };
    case 'overdue':       return { label: 'Vencido',      cls: 'border-red-400 text-red-600' };
    case 'cancelled':     return { label: 'Cancelado',    cls: 'border-slate-300 text-slate-500' };
    case 'pending':       return { label: 'Pendiente',    cls: 'border-amber-300 text-amber-600' };
    default:              return null;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface StepInvoiceSelectProps {
  invoices: Invoice[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onNext?: () => void;
  isLoading: boolean;
  isSales: boolean;
  patientName?: string;
  subtitle?: string;
  newlyCreatedInvoiceId?: string;
  /** When true, hides the top header section (for embedding inside another step) */
  embedded?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amount);
}

function fmtDateTime(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr);
    return new Intl.DateTimeFormat('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return null;
  }
}

async function fetchInvoiceDetail(
  invoiceId: string,
  isSales: boolean,
  fallbackCurrency: string,
): Promise<InvoiceDetail> {
  const itemsEndpoint = isSales
    ? API_ROUTES.SALES.INVOICE_ITEMS
    : API_ROUTES.PURCHASES.INVOICE_ITEMS;
  const paymentsEndpoint = isSales
    ? API_ROUTES.SALES.INVOICE_PAYMENTS
    : API_ROUTES.PURCHASES.INVOICE_PAYMENTS;
  const params = { invoice_id: invoiceId, is_sales: isSales ? 'true' : 'false' };

  const [itemsData, paymentsData] = await Promise.all([
    api.get(itemsEndpoint, params).catch(() => []),
    api.get(paymentsEndpoint, params).catch(() => []),
  ]);

  const rawItems: any[] = Array.isArray(itemsData)
    ? itemsData
    : (itemsData.invoice_items || itemsData.data || []);

  const rawPayments: any[] = Array.isArray(paymentsData)
    ? paymentsData
    : (paymentsData.payments || paymentsData.data || []);

  const items: InvoiceLineItem[] = rawItems.map((item: any) => ({
    id: String(item.id || item.invoice_item_id || Math.random()),
    description:
      item.service_name || item.description || item.name || `Servicio #${item.service_id}`,
    toothNumber: item.tooth_number ? Number(item.tooth_number) : undefined,
    quantity: Number(item.quantity || 1),
    total: Math.abs(Number(item.total || item.amount || 0)),
  }));

  const payments: InvoicePaymentEntry[] = rawPayments
    .filter((p: any) => p?.status !== 'failed' && (p?.transaction_id || p?.id))
    .map((p: any) => ({
      id: String(p.transaction_id ?? p.id),
      docNo: p.doc_no || p.payment_doc_no || undefined,
      method: p.method || p.payment_method || undefined,
      date: p.payment_date || p.created_at || undefined,
      amount: Math.abs(Number(p.amount_applied ?? p.amount ?? 0)),
      currency: p.currency || fallbackCurrency,
    }));

  return { items, payments };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StepInvoiceSelect({
  invoices,
  selectedIds,
  onToggle,
  isLoading,
  isSales,
  patientName,
  subtitle,
  newlyCreatedInvoiceId,
  embedded = false,
}: StepInvoiceSelectProps) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  // null = currently loading; InvoiceDetail = loaded
  const [detailCache, setDetailCache] = React.useState<Map<string, InvoiceDetail | null>>(
    new Map(),
  );

  const toggleDetails = React.useCallback(
    async (e: React.MouseEvent, inv: Invoice) => {
      e.preventDefault();
      e.stopPropagation();

      const invoiceId = inv.id;

      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(invoiceId)) {
          next.delete(invoiceId);
        } else {
          next.add(invoiceId);
        }
        return next;
      });

      if (!detailCache.has(invoiceId)) {
        setDetailCache((prev) => new Map(prev).set(invoiceId, null)); // mark as loading
        try {
          const detail = await fetchInvoiceDetail(
            invoiceId,
            isSales,
            inv.currency || 'USD',
          );
          setDetailCache((prev) => new Map(prev).set(invoiceId, detail));
        } catch {
          setDetailCache((prev) =>
            new Map(prev).set(invoiceId, { items: [], payments: [] }),
          );
        }
      }
    },
    [detailCache, isSales],
  );

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
      {/* Header — hidden in embedded mode */}
      {!embedded && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1">
          {patientName && <p className="text-sm font-semibold">{patientName}</p>}
          <p className="text-xs text-muted-foreground">
            {subtitle ??
              'Este presupuesto ya está completamente facturado. Selecciona las facturas que deseas cobrar.'}
          </p>
        </div>
      )}

      {/* Invoice list */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Facturas pendientes de pago
        </p>
        {invoices.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No hay facturas pendientes de pago para este presupuesto.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="divide-y rounded-lg border overflow-hidden">
            {invoices.map((inv) => {
              const invCurrency = inv.currency || currency;
              const pending = Math.max(0, (inv.total || 0) - (inv.paid_amount || 0));
              const isSelected = selectedIds.has(inv.id);
              const statusBadge = paymentStatusBadge(inv.payment_status);
              const isExpanded = expandedIds.has(inv.id);
              const cachedDetail = detailCache.get(inv.id);
              const isLoadingDetail = isExpanded && cachedDetail === null;

              return (
                <div key={inv.id} className="bg-background">
                  {/* Main row */}
                  <div
                    className="flex items-start gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => onToggle(inv.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggle(inv.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-medium truncate">
                            Factura #{inv.doc_no || inv.invoice_doc_no || inv.id}
                          </span>
                          {newlyCreatedInvoiceId && inv.id === newlyCreatedInvoiceId && (
                            <Badge
                              variant="outline"
                              className="shrink-0 text-[10px] border-emerald-400 text-emerald-700"
                            >
                              Nueva
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-primary shrink-0">
                          {fmtCurrency(pending, invCurrency)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {inv.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatDisplayDate(inv.createdAt)}
                          </span>
                        )}
                        {statusBadge && (
                          <Badge
                            variant="outline"
                            className={cn('text-[10px]', statusBadge.cls)}
                          >
                            {statusBadge.label}
                          </Badge>
                        )}
                        {(inv.paid_amount || 0) > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Pagado: {fmtCurrency(inv.paid_amount || 0, invCurrency)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detalle toggle */}
                    <button
                      type="button"
                      onClick={(e) => toggleDetails(e, inv)}
                      className="shrink-0 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                    >
                      {isLoadingDetail ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      <span>Detalle</span>
                    </button>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="border-t bg-muted/30 divide-y">
                      {isLoadingDetail ? (
                        <div className="px-4 py-3 space-y-2">
                          <Skeleton className="h-3.5 w-3/4" />
                          <Skeleton className="h-3.5 w-1/2" />
                          <Skeleton className="h-3.5 w-2/3" />
                        </div>
                      ) : !cachedDetail || (cachedDetail.items.length === 0 && cachedDetail.payments.length === 0) ? (
                        <p className="px-4 py-3 text-xs text-muted-foreground italic">
                          Sin detalle disponible.
                        </p>
                      ) : (
                        <>
                          {/* ── Services ── */}
                          {cachedDetail.items.length > 0 && (
                            <div className="px-4 py-2.5 space-y-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Servicios facturados
                              </p>
                              {cachedDetail.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-baseline justify-between gap-3 text-xs"
                                >
                                  <span className="truncate text-foreground">
                                    {item.description}
                                    {item.toothNumber ? (
                                      <span className="ml-1 text-muted-foreground">
                                        D.{item.toothNumber}
                                      </span>
                                    ) : null}
                                    {item.quantity > 1 ? (
                                      <span className="ml-1 text-muted-foreground">
                                        ×{item.quantity}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="tabular-nums shrink-0 text-foreground">
                                    {fmtCurrency(item.total, invCurrency)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* ── Payments ── */}
                          {cachedDetail.payments.length > 0 && (
                            <div className="px-4 py-2.5 space-y-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Cobros registrados
                              </p>
                              {cachedDetail.payments.map((pmt) => (
                                <div
                                  key={pmt.id}
                                  className="flex items-start justify-between gap-3 text-xs"
                                >
                                  <div className="min-w-0">
                                    {pmt.docNo && (
                                      <span className="text-foreground font-medium">
                                        #{pmt.docNo}
                                        {' '}
                                      </span>
                                    )}
                                    {pmt.method && (
                                      <span className="text-muted-foreground">{pmt.method}</span>
                                    )}
                                    {pmt.date && (
                                      <span className={cn('text-muted-foreground', (pmt.docNo || pmt.method) && 'ml-1')}>
                                        · {fmtDateTime(pmt.date)}
                                      </span>
                                    )}
                                  </div>
                                  <span className="tabular-nums shrink-0 text-emerald-700 font-medium">
                                    {fmtCurrency(pmt.amount, pmt.currency)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* ── Totals ── */}
                          <div className="px-4 py-2.5 space-y-1">
                            <div className="flex justify-between text-xs font-semibold">
                              <span>Total factura</span>
                              <span className="tabular-nums">
                                {fmtCurrency(inv.total || 0, invCurrency)}
                              </span>
                            </div>
                            {(inv.paid_amount || 0) > 0 && (
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Cobrado</span>
                                <span className="tabular-nums text-emerald-700">
                                  {fmtCurrency(inv.paid_amount || 0, invCurrency)}
                                </span>
                              </div>
                            )}
                            <div
                              className={cn(
                                'flex justify-between text-xs font-semibold',
                                pending > 0 ? 'text-amber-700' : 'text-emerald-700',
                              )}
                            >
                              <span>Pendiente</span>
                              <span className="tabular-nums">{fmtCurrency(pending, invCurrency)}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
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
