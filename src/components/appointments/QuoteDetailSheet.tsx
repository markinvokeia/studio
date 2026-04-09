'use client';

import { Badge } from '@/components/ui/badge';
import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuoteItemsTable } from '@/components/tables/quote-items-table';
import { OrdersTable } from '@/components/tables/orders-table';
import { InvoicesTable } from '@/components/tables/invoices-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { API_ROUTES } from '@/constants/routes';
import { normalizeApiResponse } from '@/lib/api-utils';
import { Invoice, Order, Payment, QuoteItem } from '@/lib/types';
import { api } from '@/services/api';
import { SHEET_TAB_CLASS, hasValidPayments } from '@/components/appointments/sheet-utils';
import { FileText } from 'lucide-react';
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
}

export function QuoteDetailSheet({
  open,
  onOpenChange,
  quoteId,
  quoteDocNo,
  patientName,
}: QuoteDetailSheetProps) {
  const t = useTranslations('QuotesPage');
  const [activeTab, setActiveTab] = React.useState('items');
  const [isLoading, setIsLoading] = React.useState(true);

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
    ]).then(([i, o, inv, p]) => {
      if (!active) return;
      setItems(i);
      setOrders(o);
      setInvoices(inv);
      setPayments(p);
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [open, quoteId]);

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
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-6 pb-6 pt-3">
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
      </div>
    </ResizableSheet>
  );
}
