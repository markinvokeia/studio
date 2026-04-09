'use client';

import { Badge } from '@/components/ui/badge';
import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { API_ROUTES } from '@/constants/routes';
import { Invoice, InvoiceItem, Payment } from '@/lib/types';
import { api } from '@/services/api';
import { SHEET_TAB_CLASS, hasValidPayments } from '@/components/appointments/sheet-utils';
import { Receipt } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  try {
    const data = await api.get(API_ROUTES.SALES.INVOICE_ITEMS, { invoice_id: invoiceId, is_sales: 'true' });
    const raw: any[] = Array.isArray(data) ? data : (data.invoice_items || data.data || []);
    return raw.map((a: any) => {
      const rawId = a.service_id || a.product_id;
      return {
        id: String(a.id || `ii_${Math.random().toString(36).slice(2, 9)}`),
        service_id: Array.isArray(rawId) ? String(rawId[0]) : String(rawId || ''),
        service_name: a.service_name || a.product_name || a.name || a.display_name ||
          (Array.isArray(rawId) ? rawId[1] : ''),
        quantity: a.quantity || a.product_uom_qty || 0,
        unit_price: a.unit_price || a.price_unit || 0,
        total: a.total || a.price_total || 0,
      };
    });
  } catch { return []; }
}


async function fetchInvoicePayments(invoiceId: string): Promise<Payment[]> {
  try {
    const data = await api.get(API_ROUTES.SALES.INVOICE_PAYMENTS, { invoice_id: invoiceId, is_sales: 'true' });
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
      amount: isNew ? parseFloat(a.amount_applied) : (parseFloat(a.amount_applied) || 0),
      amount_applied: isNew ? parseFloat(a.amount_applied) : (parseFloat(a.amount_applied) || 0),
      source_amount: isNew ? parseFloat(a.source_amount) : (parseFloat(a.source_amount) || 0),
      source_currency: (a.source_currency || 'USD') as 'UYU' | 'USD',
      method: a.payment_method_name || a.payment_method || '',
      payment_method: a.payment_method_name || a.payment_method || '',
      payment_method_code: a.payment_method_code,
      status: a.status || 'completed',
      createdAt: a.payment_date || a.created_at || '',
      updatedAt: a.payment_date || a.updated_at || a.created_at || '',
      payment_date: a.payment_date || a.created_at || '',
      currency: isNew ? a.invoice_currency : (a.source_currency || 'USD'),
      exchange_rate: parseFloat(a.exchange_rate) || 1,
      transaction_type: (a.transaction_type || 'direct_payment') as 'direct_payment' | 'credit_note_allocation' | 'payment_allocation',
      transaction_id: a.transaction_id ? String(a.transaction_id) : null,
      type: (a.type || null) as 'invoice' | 'credit_note' | null,
      notes: a.notes || '',
      is_historical: a.is_historical || false,
    }));
  } catch { return []; }
}

// ── Status helpers ────────────────────────────────────────────────────────────

function statusVariant(status: string): 'success' | 'destructive' | 'info' | 'outline' | 'default' {
  switch (status.toLowerCase()) {
    case 'confirmed': case 'posted': case 'paid': return 'success';
    case 'cancelled': case 'cancel': return 'destructive';
    case 'draft': return 'outline';
    default: return 'default';
  }
}

function paymentVariant(status: string): 'success' | 'info' | 'outline' | 'default' {
  switch (status.toLowerCase()) {
    case 'paid': return 'success';
    case 'partial': case 'partially_paid': return 'info';
    default: return 'outline';
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface InvoiceDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
}

export function InvoiceDetailSheet({ open, onOpenChange, invoice }: InvoiceDetailSheetProps) {
  const t = useTranslations('InvoicesPage');
  const [activeTab, setActiveTab] = React.useState('items');
  const [isLoading, setIsLoading] = React.useState(true);
  const [items, setItems] = React.useState<InvoiceItem[]>([]);
  const [payments, setPayments] = React.useState<Payment[]>([]);

  React.useEffect(() => {
    if (!open || !invoice?.id) return;
    let active = true;
    setIsLoading(true);
    Promise.all([
      fetchInvoiceItems(invoice.id),
      fetchInvoicePayments(invoice.id),
    ]).then(([i, p]) => {
      if (!active) return;
      setItems(i);
      setPayments(p);
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [open, invoice?.id]);

  const docLabel = invoice.doc_no || invoice.invoice_ref || invoice.id;
  const totalFormatted = new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: invoice.currency || 'USD',
    minimumFractionDigits: 2,
  }).format(invoice.total || 0);

  return (
    <ResizableSheet
      open={open}
      onOpenChange={onOpenChange}
      defaultWidth={800}
      minWidth={480}
      maxWidth={1200}
      storageKey="invoice-detail-sheet-width"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-none border-b border-border bg-card px-6 py-5 pr-14">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
              <Receipt className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-lg font-semibold">
                  {t('columns.docNo')}: {docLabel}
                </SheetTitle>
                <Badge variant={statusVariant(invoice.status)} className="text-xs capitalize">
                  {invoice.status}
                </Badge>
                <Badge variant={paymentVariant(invoice.payment_status || '')} className="text-xs capitalize">
                  {invoice.payment_status?.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {invoice.user_name && (
                  <span className="text-sm text-muted-foreground">{invoice.user_name}</span>
                )}
                <span className="text-sm font-medium">{totalFormatted}</span>
              </div>
              <SheetDescription className="sr-only">{t('title')}</SheetDescription>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-6 pb-6 pt-3">
          {isLoading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="bg-transparent p-0 border-b border-border rounded-none gap-0 overflow-x-auto overflow-y-hidden flex-nowrap shrink-0 justify-start h-auto">
                <TabsTrigger value="items" className={SHEET_TAB_CLASS}>{t('InvoiceItemsTable.title')}</TabsTrigger>
                <TabsTrigger value="payments" className={SHEET_TAB_CLASS}>{t('tabs.payments')}</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-auto mt-3">
                <TabsContent value="items" className="m-0">
                  <InvoiceItemsTable items={items} canEdit={false} />
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
