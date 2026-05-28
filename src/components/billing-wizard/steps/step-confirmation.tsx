'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { getDocumentFileName } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import type { Invoice, Payment } from '@/lib/types';
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
  const { printInvoice, printPayment } = usePrintDocument();

  const handlePrintInvoice = (inv: Invoice) => {
    printInvoice(inv, isSales);
  };

  const handlePrintInvoiceById = (id: string, docNo?: string) => {
    const inv: Invoice = {
      id,
      doc_no: docNo,
      invoice_doc_no: docNo,
      invoice_ref: docNo || id,
      order_id: '',
      quote_id: '',
      user_name: patientName || '',
      user_id: '',
      total: total ?? 0,
      currency: currency as 'UYU' | 'USD',
      status: 'booked',
      payment_status: 'unpaid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    printInvoice(inv, isSales);
  };

  const handlePrintPayment = (payment: CreatedPayment) => {
    if (!payment.transactionId) {
      toast({ title: 'No se encontró el recibo del pago', variant: 'destructive' });
      return;
    }
    const p: Payment = {
      id: payment.transactionId,
      doc_no: payment.docNo,
      payment_doc_no: payment.docNo,
      order_id: '',
      invoice_id: null,
      quote_id: null,
      user_name: patientName || '',
      payment_date: payment.date || new Date().toISOString(),
      amount_applied: payment.amount ?? 0,
      source_amount: payment.amount ?? 0,
      source_currency: (payment.currency as 'UYU' | 'USD') || 'UYU',
      payment_method: payment.methodName || '',
      transaction_type: (payment.transactionType as Payment['transaction_type']) || 'direct_payment',
      transaction_id: payment.transactionId,
      status: 'completed',
      createdAt: payment.date || new Date().toISOString(),
      updatedAt: payment.date || new Date().toISOString(),
      amount: payment.amount ?? 0,
      method: payment.methodName || '',
      type: null,
    };
    printPayment(p, isSales);
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
                <span className="tabular-nums whitespace-nowrap font-semibold text-emerald-600">
                  {fmtCurrency(inv.total || 0, inv.currency || currency)}
                </span>
                <button
                  type="button"
                  onClick={() => handlePrintInvoice(inv)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  title="Imprimir factura"
                >
                  <Printer className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : invoiceDocNo ? (
          <div className="flex justify-between items-center px-4 py-2.5">
            <span className="text-muted-foreground shrink-0">Factura</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium truncate">#{invoiceDocNo}</span>
              {total !== undefined && (
                <span className="tabular-nums whitespace-nowrap font-semibold text-emerald-600">
                  {fmtCurrency(total, currency)}
                </span>
              )}
              {invoiceId && (
                <button
                  type="button"
                  onClick={() => handlePrintInvoiceById(invoiceId!, invoiceDocNo)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  title="Imprimir factura"
                >
                  <Printer className="h-3.5 w-3.5" />
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
                  <span className="text-[10px] text-muted-foreground">(en esta sesión)</span>
                )}
              </span>

              {/* Right: two-line detail + print icon */}
              <div className="flex items-start gap-2 min-w-0 ml-auto">
                <div className="flex flex-col items-end gap-0.5 min-w-0">
                  {/* Top line: doc no (or transaction ref) + amount + currency */}
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">
                      {p.docNo
                        ? `#${p.docNo}`
                        : (p.transactionType === 'payment_allocation' || p.transactionType === 'credit_note_allocation' || p.methodName === 'Crédito')
                          ? 'Crédito aplicado'
                          : p.transactionId
                            ? `Ref. #${p.transactionId}`
                            : '—'}
                    </span>
                    {p.amount != null && p.currency && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="tabular-nums whitespace-nowrap text-red-600 dark:text-red-400">−{fmtCurrency(p.amount, p.currency)}</span>
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
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                    title="Imprimir recibo"
                  >
                    <Printer className="h-3.5 w-3.5" />
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
                  {c.type === 'credit_note' ? 'Nota de crédito' : 'Crédito'} #{c.source_id}
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

        {/* Total pendiente */}
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
