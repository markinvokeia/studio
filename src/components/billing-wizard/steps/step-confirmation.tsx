'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { getDocumentFileName } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Invoice } from '@/lib/types';
import type { CreatedPayment } from './step-payment';

interface StepConfirmationProps {
  invoiceId?: string;
  invoiceDocNo?: string;
  invoices?: Invoice[];
  payments: CreatedPayment[];
  patientName?: string;
  total?: number;
  totalPaid?: number;
  pendingAfter?: number;
  currency?: string;
  appliedCredits?: Array<{ source_id: string; amount: number; currency: string; type: string }>;
  creditsTotal?: number;
  isSales: boolean;
  onClose: () => void;
}

function fmtCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amount);
}

function fmtDate(dateStr?: string) {
  if (!dateStr) return null;
  try {
    const d = dateStr.includes('T') ? parseISO(dateStr) : new Date(dateStr);
    return format(d, 'dd/MM/yyyy HH:mm');
  } catch {
    return null;
  }
}

export function StepConfirmation({
  invoiceId,
  invoiceDocNo,
  invoices,
  payments,
  patientName,
  total,
  totalPaid,
  pendingAfter,
  currency = 'USD',
  appliedCredits,
  creditsTotal,
  isSales,
  onClose,
}: StepConfirmationProps) {
  const { toast } = useToast();
  const [printingInvoiceId, setPrintingInvoiceId] = React.useState<string | null>(null);
  const [printingPaymentId, setPrintingPaymentId] = React.useState<string | null>(null);

  const handlePrintInvoice = async (id: string, docNo?: string) => {
    setPrintingInvoiceId(id);
    try {
      const endpoint = isSales ? API_ROUTES.SALES.API_INVOICE_PRINT : API_ROUTES.PURCHASES.API_INVOICE_PRINT;
      const blob = await api.getBlob(endpoint, { id });
      const fileName = getDocumentFileName({ id, doc_no: docNo, invoice_doc_no: docNo }, 'invoice');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch {
      toast({ title: 'Error al imprimir la factura', variant: 'destructive' });
    } finally {
      setPrintingInvoiceId(null);
    }
  };

  const handlePrintPayment = async (payment: CreatedPayment) => {
    if (!payment.transactionId) {
      toast({ title: 'No se encontró el recibo del pago', variant: 'destructive' });
      return;
    }
    setPrintingPaymentId(payment.transactionId);
    try {
      const endpoint = isSales ? API_ROUTES.SALES.API_PAYMENT_PRINT : API_ROUTES.PURCHASES.API_PAYMENT_PRINT;
      const blob = await api.getBlob(endpoint, {
        transaction_id: payment.transactionId,
        transaction_type: payment.transactionType || 'direct_payment',
      });
      const fileName = getDocumentFileName(
        { id: payment.transactionId, doc_no: payment.docNo, payment_doc_no: payment.docNo },
        'payment',
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch {
      toast({ title: 'Error al imprimir el recibo', variant: 'destructive' });
    } finally {
      setPrintingPaymentId(null);
    }
  };

  const hasPayments = payments.length > 0;

  return (
    <div className="flex flex-col gap-5 py-2">
      {/* Success icon + title */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <div className="text-center space-y-0.5">
          <h3 className="text-base font-semibold">
            {hasPayments ? '¡Cobro registrado!' : '¡Factura creada!'}
          </h3>
          {patientName && <p className="text-sm text-muted-foreground">{patientName}</p>}
        </div>
      </div>

      {/* Document summary */}
      <div className="w-full rounded-lg border divide-y text-sm">
        {/* Invoice rows */}
        {invoices && invoices.length > 0 ? (
          invoices.map((inv) => (
            <div key={inv.id} className="flex justify-between items-center px-4 py-2.5">
              <span className="text-muted-foreground shrink-0">Factura</span>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">#{inv.doc_no || inv.invoice_doc_no || inv.id}</span>
                <button
                  type="button"
                  onClick={() => handlePrintInvoice(inv.id, inv.doc_no || inv.invoice_doc_no)}
                  disabled={printingInvoiceId === inv.id}
                  className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                  title="Imprimir factura"
                >
                  {printingInvoiceId === inv.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Printer className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))
        ) : invoiceDocNo ? (
          <div className="flex justify-between items-center px-4 py-2.5">
            <span className="text-muted-foreground shrink-0">Factura</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium truncate">#{invoiceDocNo}</span>
              {invoiceId && (
                <button
                  type="button"
                  onClick={() => handlePrintInvoice(invoiceId, invoiceDocNo)}
                  disabled={printingInvoiceId === invoiceId}
                  className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                  title="Imprimir factura"
                >
                  {printingInvoiceId === invoiceId
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Printer className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Payment rows */}
        {payments.map((p, i) => (
          (p.docNo || p.transactionId) && (
            <div
              key={i}
              className={`flex justify-between items-start gap-3 px-4 py-2.5 ${p.isNew ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}
            >
              {/* Left: label */}
              <span className="text-muted-foreground shrink-0 flex items-center gap-1.5 pt-0.5">
                {payments.length > 1 ? `Pago ${i + 1}` : 'Pago'}
                {p.isNew && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1 rounded">
                    Nuevo
                  </span>
                )}
              </span>

              {/* Right: two-line detail + print icon */}
              <div className="flex items-start gap-2 min-w-0 ml-auto">
                <div className="flex flex-col items-end gap-0.5 min-w-0">
                  {/* Top line: doc no (or transaction ref) + amount + currency */}
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">
                      {p.docNo ? `#${p.docNo}` : `Ref. #${p.transactionId}`}
                    </span>
                    {p.amount != null && p.currency && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="tabular-nums whitespace-nowrap">{fmtCurrency(p.amount, p.currency)}</span>
                      </>
                    )}
                  </div>
                  {/* Bottom line: date + method */}
                  {(p.date || p.methodName) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {fmtDate(p.date) && <span>{fmtDate(p.date)}</span>}
                      {fmtDate(p.date) && p.methodName && <span>·</span>}
                      {p.methodName && <span>{p.methodName}</span>}
                    </div>
                  )}
                </div>
                {p.transactionId && (
                  <button
                    type="button"
                    onClick={() => handlePrintPayment(p)}
                    disabled={printingPaymentId === p.transactionId}
                    className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors mt-0.5"
                    title="Imprimir recibo"
                  >
                    {printingPaymentId === p.transactionId
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Printer className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          )
        ))}

        {/* Applied credits */}
        {appliedCredits && appliedCredits.length > 0 && (
          <>
            {appliedCredits.map((c) => (
              <div key={c.source_id} className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-muted-foreground shrink-0">
                  {c.type === 'credit_note' ? 'Nota de crédito' : 'Referencia de pago'} #{c.source_id}
                </span>
                <span className="tabular-nums font-medium text-emerald-600">
                  − {new Intl.NumberFormat('es-UY', { style: 'currency', currency: c.currency }).format(c.amount)}
                </span>
              </div>
            ))}
            {creditsTotal !== undefined && creditsTotal > 0 && (
              <div className="flex justify-between px-4 py-2.5 text-sm font-semibold">
                <span>Total créditos aplicados</span>
                <span className="tabular-nums text-emerald-600">
                  − {new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(creditsTotal)}
                </span>
              </div>
            )}
          </>
        )}

        {/* Totals */}
        {total !== undefined && (
          <div className="flex justify-between px-4 py-2.5 font-semibold">
            <span>Total facturado</span>
            <span className="tabular-nums text-primary">{fmtCurrency(total, currency)}</span>
          </div>
        )}
        {totalPaid !== undefined && totalPaid > 0 && (
          <div className="flex justify-between px-4 py-2.5 font-semibold">
            <span>
              Total pagado{' '}
              <span className="font-normal text-muted-foreground text-xs">(en esta sesión)</span>
            </span>
            <span className="tabular-nums text-emerald-600">{fmtCurrency(totalPaid, currency)}</span>
          </div>
        )}
        {pendingAfter !== undefined && (
          <div className="flex justify-between px-4 py-2.5 font-semibold">
            <span>Total pendiente</span>
            <span className={`tabular-nums ${pendingAfter > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {fmtCurrency(pendingAfter, currency)}
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
