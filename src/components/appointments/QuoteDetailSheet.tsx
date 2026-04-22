'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResizableSheet, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/resizable-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip';
import type { VerticalTab } from '@/components/ui/vertical-tab-strip';
import { QuoteItemsTable } from '@/components/tables/quote-items-table';
import { InvoicesTable } from '@/components/tables/invoices-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { Can } from '@/components/auth/Can';
import { API_ROUTES } from '@/constants/routes';
import { normalizeApiResponse } from '@/lib/api-utils';
import { Invoice, Payment, QuoteItem } from '@/lib/types';
import { api } from '@/services/api';
import { hasValidPayments } from '@/components/appointments/sheet-utils';
import { FileText, ListChecks, Receipt, CreditCard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useToast } from '@/hooks/use-toast';

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

  // Local status override — updated after confirm/reject actions without an extra fetch
  const [localStatus, setLocalStatus] = React.useState<string | undefined>(undefined);

  // Reset local status when the quote changes
  React.useEffect(() => { setLocalStatus(undefined); }, [quoteId]);

  const [items, setItems] = React.useState<QuoteItem[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [payments, setPayments] = React.useState<Payment[]>([]);

  React.useEffect(() => {
    if (!open || !quoteId) return;
    let active = true;
    setIsLoading(true);
    Promise.all([
      fetchQuoteItems(quoteId),
      fetchQuoteInvoices(quoteId),
      fetchQuotePayments(quoteId),
    ]).then(([i, inv, p]) => {
      if (!active) return;
      setItems(i);
      setInvoices(inv);
      setPayments(p);
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [open, quoteId]);

  const tabs: VerticalTab[] = [
    { id: 'items', icon: ListChecks, label: t('tabs.items') },
    { id: 'invoices', icon: Receipt, label: t('tabs.invoices') },
    { id: 'payments', icon: CreditCard, label: t('tabs.payments') },
  ];

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
        <div className="flex-none border-b border-border bg-card px-6 py-4 pr-14">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted shrink-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-base font-semibold leading-tight">
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

        {/* Body */}
        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden min-h-0">
            <VerticalTabStrip
              tabs={tabs}
              activeTabId={activeTab}
              onTabClick={(tab) => setActiveTab(tab.id)}
            />
            <div className="flex-1 overflow-auto p-3">
              {activeTab === 'items' && (
                <QuoteItemsTable
                  items={items}
                  canEdit={false}
                  onCreate={() => {}}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              )}
              {activeTab === 'invoices' && (
                <InvoicesTable
                  invoices={invoices}
                  isSales={true}
                  canCreate={false}
                />
              )}
              {activeTab === 'payments' && <PaymentsTable payments={payments} />}
            </div>
          </div>
        )}
      </div>

    </ResizableSheet>
  );
}
