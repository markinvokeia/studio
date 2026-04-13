'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResizableSheet, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/resizable-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuoteItemsTable } from '@/components/tables/quote-items-table';
import { OrdersTable } from '@/components/tables/orders-table';
import { InvoicesTable } from '@/components/tables/invoices-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { Can } from '@/components/auth/Can';
import { API_ROUTES } from '@/constants/routes';
import { normalizeApiResponse } from '@/lib/api-utils';
import { Invoice, Order, Payment, Quote, QuoteItem } from '@/lib/types';
import { api } from '@/services/api';
import { confirmQuote, rejectQuote, sendQuoteEmail } from '@/services/quotes';
import { useToast } from '@/hooks/use-toast';
import { SHEET_TAB_CLASS, hasValidPayments } from '@/components/appointments/sheet-utils';
import { Check, FileText, Loader2, Mail, Printer, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  try {
    const data = await api.get(API_ROUTES.SALES.QUOTES_ITEMS, { quote_id: quoteId, is_sales: 'true' });
    const { items } = normalizeApiResponse<any>(data);
    return items.map((a: any) => ({
      id: String(a.id || ''),
      service_id: String(a.service_id || ''),
      service_name: a.service_name || '',
      unit_price: Number(a.unit_price) || 0,
      quantity: Number(a.quantity) || 0,
      total: Number(a.total) || 0,
      tooth_number: a.tooth_number ? Number(a.tooth_number) : undefined,
    }));
  } catch { return []; }
}

async function fetchQuoteOrders(quoteId: string): Promise<Order[]> {
  try {
    const data = await api.get(API_ROUTES.SALES.QUOTES_ORDERS, { quote_id: quoteId });
    const raw: any[] = Array.isArray(data) ? data : (data.orders || data.data || []);
    return raw.map((a: any) => ({
      id: String(a.id || ''),
      doc_no: a.doc_no,
      user_id: a.user_id,
      quote_id: a.quote_id,
      quote_doc_no: a.quote_doc_no,
      user_name: a.user_name || a.name,
      status: a.status,
      is_invoiced: a.is_invoiced ?? false,
      createdAt: a.created_at || a.createdAt || '',
      updatedAt: a.updated_at || a.updatedAt || '',
      currency: a.currency,
    }));
  } catch { return []; }
}

async function fetchQuoteInvoices(quoteId: string): Promise<Invoice[]> {
  try {
    const data = await api.get(API_ROUTES.SALES.QUOTES_INVOICES, { quote_id: quoteId });
    const raw: any[] = Array.isArray(data) ? data : (data.invoices || data.data || []);
    return raw.map((a: any) => ({
      id: String(a.id || ''),
      invoice_ref: a.invoice_ref || '',
      doc_no: a.doc_no || '',
      order_id: a.order_id || '',
      order_doc_no: a.order_doc_no,
      quote_id: a.quote_id,
      quote_doc_no: a.quote_doc_no,
      user_name: a.user_name || '',
      user_id: a.user_id || '',
      total: parseFloat(a.total) || 0,
      status: a.status || 'draft',
      payment_status: a.payment_state || a.payment_status || 'unpaid',
      paid_amount: parseFloat(a.paid_amount) || 0,
      type: a.type || 'invoice',
      createdAt: a.created_at || a.createdAt || '',
      updatedAt: a.updated_at || a.updatedAt || '',
      currency: a.currency,
      is_historical: a.is_historical || false,
    }));
  } catch { return []; }
}


async function fetchQuotePayments(quoteId: string): Promise<Payment[]> {
  try {
    const data = await api.get(API_ROUTES.SALES.QUOTES_PAYMENTS, { quote_id: quoteId });
    const raw: any[] = Array.isArray(data) ? data : (data.payments || data.data || []);
    if (!hasValidPayments(raw)) return [];
    const isNew = raw[0]?.amount_applied !== undefined && typeof raw[0].amount_applied === 'string';
    return raw.map((a: any) => ({
      id: String(a.transaction_id || a.id || ''),
      doc_no: a.doc_no || String(a.transaction_doc_no || 'N/A'),
      invoice_id: a.invoice_id || null,
      invoice_doc_no: a.invoice_doc_no || '',
      order_id: a.order_id || '',
      order_doc_no: a.order_doc_no || '',
      quote_id: a.quote_id || null,
      user_name: a.user_name || '',
      amount: isNew ? parseFloat(a.amount_applied) : (parseFloat(a.amount) || 0),
      amount_applied: isNew ? parseFloat(a.amount_applied) : (parseFloat(a.amount) || 0),
      source_amount: isNew ? parseFloat(a.source_amount) : (parseFloat(a.amount) || 0),
      source_currency: ((isNew ? a.source_currency : a.currency) || 'UYU') as 'UYU' | 'USD',
      method: a.payment_method_name || a.method || '',
      payment_method: a.payment_method_name || a.method || '',
      payment_method_code: a.payment_method_code,
      status: a.status || 'completed',
      createdAt: a.payment_date || a.created_at || '',
      updatedAt: a.payment_date || a.updated_at || a.created_at || '',
      payment_date: a.payment_date || a.created_at || '',
      currency: isNew ? a.invoice_currency : a.currency,
      exchange_rate: parseFloat(a.exchange_rate) || 1,
      transaction_type: (a.transaction_type || 'direct_payment') as 'direct_payment' | 'credit_note_allocation' | 'payment_allocation',
      transaction_id: a.transaction_id ? String(a.transaction_id) : null,
      type: (a.type || null) as 'invoice' | 'credit_note' | null,
      notes: a.notes || '',
      is_historical: a.is_historical || false,
    }));
  } catch { return []; }
}

// ── Component ────────────────────────────────────────────────────────────────

interface QuoteDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  quoteDocNo?: string;
  patientName?: string;
  quoteStatus?: string;
  onDataChange?: () => void;
}

export function QuoteDetailSheet({
  open,
  onOpenChange,
  quoteId,
  quoteDocNo,
  patientName,
  quoteStatus,
  onDataChange,
}: QuoteDetailSheetProps) {
  const t = useTranslations('QuotesPage');
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState('items');
  const [isLoading, setIsLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Local state for quote data (refreshed after actions)
  const [quoteData, setQuoteData] = React.useState<Quote | null>(null);

  // Fetch quote data when refreshKey changes
  const fetchQuoteData = React.useCallback(async () => {
    if (!quoteId) return;
    try {
      const data = await api.get(API_ROUTES.SALES.QUOTES, { id: quoteId, is_sales: 'true' });
      const quote = Array.isArray(data) ? data[0] : (data.quote || data.data || data);
      if (quote) setQuoteData(quote);
    } catch { /* ignore */ }
  }, [quoteId]);

  const [items, setItems] = React.useState<QuoteItem[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [payments, setPayments] = React.useState<Payment[]>([]);

  React.useEffect(() => {
    if (!open || !quoteId) return;
    let active = true;
    setIsLoading(true);
    Promise.all([
      fetchQuoteItems(quoteId),
      fetchQuoteOrders(quoteId),
      fetchQuoteInvoices(quoteId),
      fetchQuotePayments(quoteId),
      fetchQuoteData(),
    ]).then(([i, o, inv, p]) => {
      if (!active) return;
      setItems(i);
      setOrders(o);
      setInvoices(inv);
      setPayments(p);
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [open, quoteId, refreshKey, fetchQuoteData]);

  const handleConfirm = React.useCallback(async () => {
    setActionLoading('confirm');
    try {
      await confirmQuote(quoteId);
      toast({ title: t('actions.confirmSuccess') || 'Presupuesto confirmado' });
      setRefreshKey(prev => prev + 1);
      onDataChange?.();
    } catch {
      toast({ variant: 'destructive', title: t('actions.confirmError') || 'Error al confirmar' });
    } finally {
      setActionLoading(null);
    }
  }, [quoteId, toast, onDataChange, t]);

  const handleReject = React.useCallback(async () => {
    setActionLoading('reject');
    try {
      await rejectQuote(quoteId);
      toast({ title: t('actions.rejectSuccess') || 'Presupuesto rechazado' });
      setRefreshKey(prev => prev + 1);
      onDataChange?.();
    } catch {
      toast({ variant: 'destructive', title: t('actions.rejectError') || 'Error al rechazar' });
    } finally {
      setActionLoading(null);
    }
  }, [quoteId, toast, onDataChange, t]);

  const handlePrint = React.useCallback(async () => {
    setIsPrinting(true);
    try {
      const blob = await api.getBlob(API_ROUTES.SALES.QUOTE_PRINT, { quote_id: quoteId });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `presupuesto-${quoteDocNo || quoteId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({ variant: 'destructive', title: t('actions.printError') || 'Error al descargar' });
    } finally {
      setIsPrinting(false);
    }
  }, [quoteId, quoteDocNo, toast, t]);

  const handleSendEmail = React.useCallback(async () => {
    setActionLoading('email');
    try {
      await sendQuoteEmail(quoteId);
      toast({ title: t('actions.emailSuccess') || 'Presupuesto enviado por email' });
    } catch {
      toast({ variant: 'destructive', title: t('actions.emailError') || 'Error al enviar' });
    } finally {
      setActionLoading(null);
    }
  }, [quoteId, toast, t]);

  const currentStatus = quoteData?.status || quoteStatus;
  const canShowActions = currentStatus === 'draft' || currentStatus === 'pending';

  return (
    <ResizableSheet
      open={open}
      onOpenChange={onOpenChange}
      defaultWidth={900}
      minWidth={520}
      maxWidth={1300}
      storageKey="quote-detail-sheet-width"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-none border-b border-border bg-card px-6 py-5 pr-14">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-lg font-semibold">
                  {t('quoteId')}: {quoteDocNo || quoteId}
                </SheetTitle>
                {patientName && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {patientName}
                  </Badge>
                )}
              </div>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                {t('title')}
              </SheetDescription>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-6 py-3">
          {isLoading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="bg-transparent p-0 border-b border-border rounded-none gap-0 overflow-x-auto overflow-y-hidden flex-nowrap shrink-0 justify-start h-auto">
                <TabsTrigger value="items" className={SHEET_TAB_CLASS}>{t('tabs.items')}</TabsTrigger>
                <TabsTrigger value="orders" className={SHEET_TAB_CLASS}>{t('tabs.orders')}</TabsTrigger>
                <TabsTrigger value="invoices" className={SHEET_TAB_CLASS}>{t('tabs.invoices')}</TabsTrigger>
                <TabsTrigger value="payments" className={SHEET_TAB_CLASS}>{t('tabs.payments')}</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-auto mt-3">
                <TabsContent value="items" className="m-0">
                  <QuoteItemsTable
                    items={items}
                    canEdit={false}
                    onCreate={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                </TabsContent>
                <TabsContent value="orders" className="m-0">
                  <OrdersTable
                    orders={orders}
                    isSales={true}
                    columnsToHide={['user_name', 'quote_doc_no']}
                  />
                </TabsContent>
                <TabsContent value="invoices" className="m-0">
                  <InvoicesTable
                    invoices={invoices}
                    isSales={true}
                    canCreate={false}
                  />
                </TabsContent>
                <TabsContent value="payments" className="m-0">
                  <PaymentsTable payments={payments} />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>

        {/* Footer with Actions */}
        <SheetFooter className="flex-col gap-2 sm:flex-row border-t border-border px-6 py-4">
          <div className="flex gap-2 flex-wrap">
            <Can permission="SALES_QUOTES_PRINT">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
                {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                {t('actions.print') || 'Imprimir'}
              </Button>
            </Can>
            <Can permission="SALES_QUOTES_SEND_EMAIL">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendEmail}
                disabled={actionLoading === 'email'}
              >
                {actionLoading === 'email' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                {t('actions.sendEmail') || 'Enviar Email'}
              </Button>
            </Can>
          </div>

          {canShowActions && (
            <div className="flex gap-2 flex-wrap">
              <Can permission="SALES_QUOTES_CONFIRM">
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={actionLoading === 'confirm'}
                >
                  {actionLoading === 'confirm' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {t('actions.confirm') || 'Confirmar'}
                </Button>
              </Can>
              <Can permission="SALES_QUOTES_REJECT">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleReject}
                  disabled={actionLoading === 'reject'}
                >
                  {actionLoading === 'reject' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                  {t('actions.reject') || 'Rechazar'}
                </Button>
              </Can>
            </div>
          )}
        </SheetFooter>
      </div>

    </ResizableSheet>
  );
}
