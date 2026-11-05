'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Printer, Receipt } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { SALES_PERMISSIONS } from '@/constants/permissions';
import { useAsyncAction } from '@/hooks/use-async-action';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/currency';
import { cn, formatDisplayDate } from '@/lib/utils';
import { linkAestheticInvoice } from '@/services/aesthetic-record';
import { fetchInvoicePayments, type InvoicePaymentSummary } from '@/services/billing-links';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import { useClinicCurrency } from '@/stores/clinic-info-store';

import type { AestheticSessionInvoice, Invoice, Payment } from '@/lib/types';
import { useAestheticErrorMessage } from './aesthetic-errors';
import { useSessionFlow } from './session-flow-context';

export interface BillingItem {
  id: string;
  serviceId?: string | null;
  name: string;
  color: string;
  price: number | null;
}

const STATE_STYLES: Record<string, string> = {
  paid: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
  partially_paid: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  unpaid: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

/**
 * What was charged for the session: the suggested amount until there is an invoice, then that
 * invoice with its balance and payments. One invoice per session, so charging again never creates
 * a second one. It stays available on a closed session: closing locks the clinical record, not
 * the money. A voided session can't be charged, and only shows the invoice it already had.
 */
export function SessionBillingCard({ items }: { items: BillingItem[] }) {
  const t = useTranslations('AestheticRecord');
  const { toast } = useToast();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const { open: openBillingWizard } = useBillingWizard();
  const { printInvoice, printPayment } = usePrintDocument();
  const describeError = useAestheticErrorMessage();
  const clinicCurrency = useClinicCurrency();
  const { stored, readOnly, ensureSaved, updateSession, patientId, patientName } = useSessionFlow();

  const invoice = stored?.invoice ?? null;
  const voided = stored?.status === 'void';
  const canCreate = hasAnyPermission([SALES_PERMISSIONS.INVOICES_CREATE, SALES_PERMISSIONS.PAYMENTS_CREATE]);
  const canPay = hasPermission(SALES_PERMISSIONS.PAYMENTS_CREATE);
  const canSeeInvoice = hasAnyPermission([SALES_PERMISSIONS.INVOICES_VIEW_LIST, SALES_PERMISSIONS.INVOICES_VIEW_DETAIL, SALES_PERMISSIONS.INVOICES_CREATE, SALES_PERMISSIONS.PAYMENTS_CREATE]);

  // The invoice being charged, known before the session is: the wizard's callback outlives this render
  const pendingRef = React.useRef<{ sessionId: string; invoiceId: string } | null>(null);
  const [unlinked, setUnlinked] = React.useState(false);

  const link = useAsyncAction(
    async () => {
      const target = pendingRef.current;
      return target ? { target, session: await linkAestheticInvoice(target.sessionId, target.invoiceId) } : null;
    },
    {
      onSuccess: (result) => {
        if (!result) return;
        // Only the invoice and its event: the draft and the rest of the session are not this card's
        updateSession(result.target.sessionId, (s) => ({ ...s, invoice: result.session.invoice, events: result.session.events }));
        setUnlinked(false);
      },
      onError: (error) => {
        setUnlinked(true);
        toast({ variant: 'destructive', title: t('flow.close.billing.linkError'), description: describeError(error) });
      },
      showErrorToast: false,
    },
  );

  const start = useAsyncAction(
    async () => {
      const sessionId = readOnly && stored ? stored.id : await ensureSaved();
      openBillingWizard(
        {
          patientId,
          patientName,
          isSales: true,
          preloadedItems: items.filter((i) => i.serviceId).map((i) => ({
            tempId: i.id,
            service_id: i.serviceId!,
            service_name: i.name,
            unit_price: i.price ?? 0,
            quantity: 1,
            total: i.price ?? 0,
          })),
          onInvoiceCreated: async (invoiceId) => {
            pendingRef.current = { sessionId, invoiceId };
            await link.run();
          },
        },
        // After a payment: linking the same invoice again brings its amounts up to date
        () => { void link.run(); },
      );
    },
    { errorTitle: t('flow.close.billing.startError'), describeError },
  );

  function payInvoice(target: AestheticSessionInvoice) {
    if (stored) pendingRef.current = { sessionId: stored.id, invoiceId: target.id };
    openBillingWizard({ invoiceId: target.id, patientId, patientName, isSales: true }, () => { void link.run(); });
  }

  const charge = items.reduce((sum, i) => sum + (i.price ?? 0), 0);

  return (
    <section className="flex flex-col gap-2 rounded-2xl border bg-card p-3.5">
      {unlinked && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1">{t('flow.close.billing.unlinked')}</span>
            <Button type="button" size="sm" variant="outline" loading={link.isPending} onClick={() => link.run()}>{t('flow.close.billing.retry')}</Button>
          </AlertDescription>
        </Alert>
      )}
      {invoice ? (
        canSeeInvoice
          ? <InvoiceDetails
              invoice={invoice}
              items={items}
              canPay={canPay && !voided}
              onPay={() => payInvoice(invoice)}
              onPrintInvoice={() => printInvoice(toPrintableInvoice(invoice, patientId, patientName), true)}
              onPrintPayment={(p) => printPayment(toPrintablePayment(p, patientName, invoice.currency), true)}
            />
          : <p className="text-sm text-muted-foreground">{t('flow.close.billing.issuedNoAccess')}</p>
      ) : (
        <>
          <h3 className="text-[15px] font-semibold">{t('flow.close.charge')}</h3>
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-[13px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: i.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{i.name}</span>
              <span className="tabular-nums">{i.price != null ? formatMoney(i.price, clinicCurrency) : '—'}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 border-t pt-2 text-[13px] font-semibold">
            <span className="flex-1">{t('flow.close.suggestedTotal')}</span>
            <span className="tabular-nums">{formatMoney(charge, clinicCurrency)}</span>
          </div>
          {canCreate && !voided && !unlinked && (
            <Button type="button" size="sm" variant="outline" className="self-start" disabled={!items.length} loading={start.isPending} onClick={() => start.run()}>
              <Receipt className="mr-1.5 h-4 w-4" />{t('flow.close.bill')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function InvoiceDetails({ invoice, items, canPay, onPay, onPrintInvoice, onPrintPayment }: {
  invoice: AestheticSessionInvoice;
  items: BillingItem[];
  canPay: boolean;
  onPay: () => void;
  onPrintInvoice: () => void;
  onPrintPayment: (payment: InvoicePaymentSummary) => void;
}) {
  const t = useTranslations('AestheticRecord');
  const { hasAnyPermission } = usePermissions();
  const canSeePayments = hasAnyPermission([SALES_PERMISSIONS.PAYMENTS_VIEW_LIST, SALES_PERMISSIONS.PAYMENTS_VIEW_DETAIL, SALES_PERMISSIONS.PAYMENTS_CREATE]);
  const balance = Math.max(0, invoice.total - invoice.paidAmount);
  const state = invoice.paymentState in STATE_STYLES ? invoice.paymentState : balance <= 0 ? 'paid' : invoice.paidAmount > 0 ? 'partially_paid' : 'unpaid';
  const money = (amount: number) => formatMoney(amount, invoice.currency);
  const notInvoiced = invoice.serviceIds.length
    ? items.filter((i) => i.serviceId && !invoice.serviceIds.includes(i.serviceId)).map((i) => i.name)
    : [];

  const [payments, setPayments] = React.useState<InvoicePaymentSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const hasPayments = invoice.paidAmount > 0 && canSeePayments;

  // Follows the paid amount, so a payment just made shows up. An older answer never overwrites a newer one
  React.useEffect(() => {
    if (!hasPayments) { setPayments([]); return; }
    let active = true;
    setLoading(true);
    setFailed(false);
    fetchInvoicePayments(invoice.id, true, invoice.currency)
      .then((list) => { if (active) setPayments(list); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [invoice.id, invoice.currency, invoice.paidAmount, hasPayments, attempt]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold">{t('flow.close.billing.invoice')} {invoice.docNo}</h3>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATE_STYLES[state])}>{t(`flow.close.billing.states.${state}`)}</span>
      </div>
      {invoice.createdAt && <p className="text-xs text-muted-foreground">{t('flow.close.billing.issuedOn', { date: formatDisplayDate(invoice.createdAt) })}</p>}

      <dl className="flex flex-col gap-1 text-[13px]">
        <div className="flex justify-between gap-2"><dt>{t('flow.close.billing.total')}</dt><dd className="tabular-nums">{money(invoice.total)}</dd></div>
        <div className="flex justify-between gap-2"><dt>{t('flow.close.billing.paid')}</dt><dd className="tabular-nums">{money(invoice.paidAmount)}</dd></div>
        <div className="flex justify-between gap-2 border-t pt-1 font-semibold"><dt>{t('flow.close.billing.balance')}</dt><dd className="tabular-nums">{money(balance)}</dd></div>
      </dl>

      {notInvoiced.length > 0 && (
        <p className="flex gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t('flow.close.billing.notInvoiced', { services: notInvoiced.join(', ') })}
        </p>
      )}

      {hasPayments && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('flow.close.billing.payments')}</p>
          {loading && !payments.length && <p className="text-xs text-muted-foreground">{t('flow.close.billing.loadingPayments')}</p>}
          {failed && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-destructive">
              {t('flow.close.billing.paymentsError')}
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setAttempt((a) => a + 1)}>{t('flow.close.billing.retry')}</Button>
            </p>
          )}
          {payments.map((p) => (
            <div key={p.transactionId} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[13px] font-semibold">{p.docNo || p.methodName || t('flow.close.billing.payment')}</b>
                <span className="block truncate text-xs text-muted-foreground">
                  {[p.date && formatDisplayDate(p.date), p.docNo && p.methodName].filter(Boolean).join(' · ')}
                </span>
              </div>
              <span className="whitespace-nowrap text-[13px] tabular-nums">{p.amount != null ? formatMoney(p.amount, p.currency || invoice.currency) : '—'}</span>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 max-sm:h-9 max-sm:w-9" aria-label={t('flow.close.billing.printReceipt')} title={t('flow.close.billing.printReceipt')} onClick={() => onPrintPayment(p)}>
                <Printer className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canPay && balance > 0 && (
          <Button type="button" size="sm" onClick={onPay}>
            <Receipt className="mr-1.5 h-4 w-4" />{invoice.paidAmount > 0 ? t('flow.close.billing.payBalance') : t('flow.close.bill')}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={onPrintInvoice}>
          <Printer className="mr-1.5 h-4 w-4" />{t('flow.close.billing.printInvoice')}
        </Button>
      </div>
    </>
  );
}

/** The printing helpers take a whole document and load the rest by id */
function toPrintableInvoice(invoice: AestheticSessionInvoice, patientId: string, patientName?: string): Invoice {
  return {
    id: invoice.id,
    doc_no: invoice.docNo,
    invoice_doc_no: invoice.docNo,
    invoice_ref: invoice.docNo || invoice.id,
    order_id: '',
    quote_id: '',
    user_name: patientName || '',
    user_id: patientId,
    total: invoice.total,
    currency: invoice.currency,
    status: invoice.status as Invoice['status'],
    payment_status: invoice.paymentState as Invoice['payment_status'],
    paid_amount: invoice.paidAmount,
    createdAt: invoice.createdAt,
    updatedAt: invoice.createdAt,
  };
}

function toPrintablePayment(payment: InvoicePaymentSummary, patientName: string | undefined, currency: string): Payment {
  const date = payment.date || '';
  const amount = payment.amount ?? 0;
  return {
    id: payment.transactionId,
    doc_no: payment.docNo,
    payment_doc_no: payment.docNo,
    order_id: '',
    invoice_id: null,
    quote_id: null,
    user_name: patientName || '',
    payment_date: date,
    amount_applied: amount,
    source_amount: amount,
    source_currency: payment.currency || currency,
    payment_method: payment.methodName || '',
    transaction_type: (payment.transactionType as Payment['transaction_type']) || 'direct_payment',
    transaction_id: payment.transactionId,
    status: 'completed',
    notes: payment.notes || '',
    createdAt: date,
    updatedAt: date,
    amount,
    method: payment.methodName || '',
    type: null,
  };
}
