'use client';

import { QuoteItemsTable } from '@/components/tables/quote-items-table';
import { QuoteBillingDialog } from '@/components/sales/quotes/quote-billing-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ServiceSelector } from '@/components/ui/service-selector';
import { ResizableSheet, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PURCHASES_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { checkPreferencesByEmails, getDisabledEmails } from '@/hooks/use-communication-preferences';
import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';
import { Quote, QuoteItem, QuoteClinicSession, Service, UserDetailMode, Order, OrderItem, Invoice } from '@/lib/types';
import { fetchQuoteInvoicesForFinancials } from '@/services/quote-financials';
import { OrderItemsTable } from '@/components/tables/order-items-table';
import { formatDisplayDate, getDocumentFileName, sortQuoteItems } from '@/lib/utils';
import { api } from '@/services/api';
import { getPurchaseServices, getSalesServices } from '@/services/services';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { CheckCircle, ChevronDown, CreditCard, Eye, FileText, Loader2, Pencil, Printer, Receipt, RefreshCw, Send, Stethoscope, Trash2, XCircle, Zap } from 'lucide-react';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { DataCard } from '@/components/ui/data-card';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';

// ── Schemas ───────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  service_id: z.string().min(1, 'Selecciona un servicio'),
  quantity: z.coerce.number().min(1, 'Mínimo 1'),
  unit_price: z.coerce.number().min(0, 'Precio inválido'),
  tooth_number: z.coerce.number().optional(),
});
type ItemFormValues = z.infer<typeof itemSchema>;

const quoteEditSchema = z.object({
  currency: z.enum(['USD', 'UYU']),
  exchange_rate: z.coerce.number().min(0.0001, 'Tasa de cambio inválida'),
  notes: z.string().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    service_id: z.string().min(1, 'Selecciona un servicio'),
    service_name: z.string().optional(),
    quantity: z.coerce.number().int().min(1, 'Mínimo 1'),
    unit_price: z.coerce.number().min(0, 'Precio inválido'),
    total: z.coerce.number().min(0),
    tooth_number: z.coerce.number().int().optional().or(z.literal('')),
  })).default([]),
});
type QuoteEditFormValues = z.infer<typeof quoteEditSchema>;

// ── Clinic Session types ────────────────────────────────────────────────────────
async function getQuoteClinicSessions(quoteId: string): Promise<QuoteClinicSession[]> {
  try {
    const data = await api.get(API_ROUTES.SALES.QUOTE_CLINIC_SESSIONS, { quote_id: quoteId });
    const raw = Array.isArray(data) ? data : (data.sessions || data.data || data.result || []);
    return raw
      .filter((s: any) => {
        if (Object.keys(s).length === 0) return false;
        return s.id != null;
      })
      .map((s: any) => ({
        id: s.id || '',
        paciente_id: s.paciente_id || '',
        doctor_id: s.doctor_id || '',
        fecha_sesion: s.fecha_sesion || '',
        procedimiento_realizado: s.procedimiento_realizado || '',
        plan_proxima_cita: s.plan_proxima_cita || null,
        diagnostico: s.diagnostico || null,
        notas_clinicas: s.notas_clinicas || '',
        fecha_proxima_cita: s.fecha_proxima_cita || null,
        quote_id: s.quote_id || 0,
        paciente_nombre: s.paciente_nombre || '',
        doctor_nombre: s.doctor_nombre || null,
      }));
  } catch {
    return [];
  }
}

function getClinicSessionColumns(t: (key: string) => string): ColumnDef<QuoteClinicSession>[] {
  return [
    {
      accessorKey: 'fecha_sesion',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.date')} />,
      cell: ({ row }) => {
        const val: string = row.getValue('fecha_sesion');
        if (!val) return <span className="text-muted-foreground">—</span>;
        const d = new Date(val);
        return <span>{d.toLocaleDateString()}</span>;
      },
    },
    {
      accessorKey: 'procedimiento_realizado',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.procedure')} />,
      cell: ({ row }) => (
        <span className="truncate max-w-[300px] block" title={row.getValue('procedimiento_realizado')}>
          {row.getValue('procedimiento_realizado')}
        </span>
      ),
    },
    {
      accessorKey: 'doctor_nombre',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.doctor')} />,
      cell: ({ row }) => {
        const val: string | null = row.getValue('doctor_nombre');
        return <span>{val || '—'}</span>;
      },
    },
    {
      accessorKey: 'notas_clinicas',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.notes')} />,
      cell: ({ row }) => {
        const val: string = row.getValue('notas_clinicas');
        if (!val) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="truncate max-w-[200px] block text-xs" title={val}>
            {val.length > 50 ? `${val.substring(0, 50)}...` : val}
          </span>
        );
      },
    },
  ];
}

// ── Invoices / Payments tab types & columns ──────────────────────────────────
interface QuotePaymentRow {
  id: string;
  doc_no?: string;
  invoice_doc_no?: string;
  amount: number;
  currency: string;
  method?: string;
  payment_date?: string;
  createdAt?: string;
  transaction_id?: string;
  transaction_type?: string;
}

const invoiceStatusVariant = (status?: string) =>
  ({ booked: 'success', draft: 'outline', overdue: 'destructive' }[status?.toLowerCase() ?? ''] ?? 'default') as any;

const paymentStatusLabel = (t: (key: string) => string, status?: string) =>
  status === 'paid'
    ? t('UserQuotes.columns.paid')
    : status?.includes('partial')
      ? t('UserQuotes.columns.partiallyPaid')
      : t('UserQuotes.columns.unpaid');

const transactionTypeLabel = (t: (key: string) => string, type?: string) =>
  type === 'credit_note_allocation'
    ? t('UserQuotes.columns.creditNote')
    : type === 'payment_allocation'
      ? t('UserQuotes.columns.allocation')
      : type ?? '';

function getInvoiceColumns(t: (key: string) => string): ColumnDef<Invoice>[] {
  return [
    {
      accessorKey: 'doc_no',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.invoiceNo')} />,
      cell: ({ row }) => <span className="font-semibold">#{row.original.doc_no || row.original.invoice_doc_no || row.original.id}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.date')} />,
      cell: ({ row }) => <span>{formatDisplayDate(row.original.createdAt)}</span>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.status')} />,
      cell: ({ row }) =>
        row.original.status ? (
          <Badge variant={invoiceStatusVariant(row.original.status)} className="text-[10px] font-normal capitalize">
            {t(`InvoicesPage.status.${row.original.status.toLowerCase()}`)}
          </Badge>
        ) : <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'payment_status',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.paymentStatus')} />,
      cell: ({ row }) => {
        const ps = row.original.payment_status;
        return (
          <Badge variant={(ps === 'paid' ? 'success' : ps?.includes('partial') ? 'info' : 'outline') as any} className="text-[10px] font-normal">
            {paymentStatusLabel(t, ps)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'paid_amount',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.paidAmount')} />,
      cell: ({ row }) => <span className="tabular-nums text-emerald-600">{formatCurrency(row.original.paid_amount || 0, row.original.currency)}</span>,
    },
    {
      accessorKey: 'due_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.dueDate')} />,
      cell: ({ row }) => row.original.due_date ? <span>{formatDisplayDate(row.original.due_date)}</span> : <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'total',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.total')} />,
      cell: ({ row }) => <span className="font-bold tabular-nums">{formatCurrency(row.original.total, row.original.currency)}</span>,
    },
  ];
}

function getPaymentColumns(
  t: (key: string) => string,
  onPrintReceipt: (pay: QuotePaymentRow) => void,
): ColumnDef<QuotePaymentRow>[] {
  return [
    {
      accessorKey: 'doc_no',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.paymentNo')} />,
      cell: ({ row }) => <span className="font-semibold">#{row.original.doc_no || row.original.id}</span>,
    },
    {
      accessorKey: 'payment_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.date')} />,
      cell: ({ row }) => row.original.payment_date ? <span>{formatDisplayDate(row.original.payment_date)}</span> : <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'method',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.method')} />,
      cell: ({ row }) => row.original.method ? <Badge variant="outline" className="text-[10px] font-normal capitalize">{row.original.method}</Badge> : <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'invoice_doc_no',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.invoice')} />,
      cell: ({ row }) => row.original.invoice_doc_no ? <span>#{row.original.invoice_doc_no}</span> : <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'transaction_type',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.transactionType')} />,
      cell: ({ row }) => {
        const tt = row.original.transaction_type;
        return tt && tt !== 'direct_payment'
          ? <Badge variant="info" className="text-[10px] font-normal">{transactionTypeLabel(t, tt)}</Badge>
          : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserQuotes.columns.amount')} />,
      cell: ({ row }) => <span className="font-bold tabular-nums text-emerald-600">{formatCurrency(row.original.amount, row.original.currency)}</span>,
    },
    {
      id: 'actions',
      header: () => null,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.transaction_id ? (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => onPrintReceipt(row.original)}>
            <Printer className="h-3 w-3" />{t('UserQuotes.columns.printReceipt')}
          </Button>
        ) : null,
    },
  ];
}

// ── Order helpers for confirmed quotes ───────────────────────────────────────
async function getOrdersForQuote(quoteId: string, isSales: boolean): Promise<Order[]> {
  if (!quoteId) return [];
  try {
    const route = isSales ? API_ROUTES.SALES.QUOTES_ORDERS : API_ROUTES.PURCHASES.QUOTES_ORDERS;
    const data = await api.get(route, { quote_id: quoteId, is_sales: isSales ? 'true' : 'false' });
    const ordersData = Array.isArray(data) ? data : (data.orders || data.data || []);
    return ordersData.map((o: any) => ({
      id: o.id ? String(o.id) : '',
      doc_no: o.doc_no || '',
      user_id: o.user_id,
      quote_id: o.quote_id,
      quote_doc_no: o.quote_doc_no || '',
      user_name: o.user_name || o.name || '',
      status: o.status,
      createdAt: o.created_at || o.createdAt || new Date().toISOString(),
      updatedAt: o.updated_at || o.updatedAt || new Date().toISOString(),
      currency: o.currency || 'UYU',
    }));
  } catch {
    return [];
  }
}

async function getOrderItemsForOrder(orderId: string, isSales: boolean): Promise<OrderItem[]> {
  if (!orderId) return [];
  try {
    const route = isSales ? API_ROUTES.SALES.ORDER_ITEMS : API_ROUTES.PURCHASES.ORDER_ITEMS;
    const data = await api.get(route, { order_id: orderId, is_sales: isSales ? 'true' : 'false' });
    const itemsData = Array.isArray(data) ? data : (data.order_items || data.data || data.result || []);
    return itemsData.map((i: any) => ({
      id: i.order_item_id ? String(i.order_item_id) : '',
      service_id: i.service_id || i.id,
      service_name: i.service_name || '',
      unit_price: i.unit_price,
      quantity: i.quantity,
      total: i.total,
      tooth_number: i.tooth_number ? Number(i.tooth_number) : undefined,
      status: i.status || 'scheduled',
      scheduled_date: i.scheduled_date,
      completed_date: i.completed_date,
      quote_item_id: i.quote_item_id != null ? String(i.quote_item_id) : undefined,
      invoiced_date: i.invoiced_date,
    }));
  } catch {
    return [];
  }
}

// ── Columns ───────────────────────────────────────────────────────────────────
const getColumns = (t: (key: string) => string): ColumnDef<Quote>[] => [
  {
    id: 'select',
    header: () => null,
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Seleccionar fila"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.quoteId')} />,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserColumns.status')} />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant = ({ accepted: 'success', confirmed: 'success', sent: 'default', pending: 'info', draft: 'outline', rejected: 'destructive' }[status.toLowerCase()] ?? 'default') as any;
      return <Badge variant={variant} className="capitalize">{t(`QuotesPage.quoteDialog.${status.toLowerCase()}`)}</Badge>;
    },
  },
  {
    accessorKey: 'total',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.total')} />,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('total'));
      return <div className="font-medium">{formatCurrency(Math.round(amount * 100) / 100, row.original.currency)}</div>;
    },
  },
  {
    accessorKey: 'amount_invoiced',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.amountInvoiced')} />,
    cell: ({ row }) => <div className="font-medium">{formatCurrency(Number(row.getValue('amount_invoiced')), row.original.currency)}</div>,
  },
  {
    accessorKey: 'amount_pending_invoice',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.pendingInvoice')} />,
    cell: ({ row }) => <div className="font-medium">{formatCurrency(Number(row.getValue('amount_pending_invoice')), row.original.currency)}</div>,
  },
  {
    accessorKey: 'amount_paid',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.amountPaid')} />,
    cell: ({ row }) => <div className="font-medium">{formatCurrency(Number(row.getValue('amount_paid')), row.original.currency)}</div>,
  },
  {
    accessorKey: 'amount_pending_payment',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.pendingPayment')} />,
    cell: ({ row }) => <div className="font-medium">{formatCurrency(Number(row.getValue('amount_pending_payment')), row.original.currency)}</div>,
  },
  {
    accessorKey: 'payment_status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('Navigation.Payments')} />,
    cell: ({ row }) => {
      const status = (row.getValue('payment_status') as string).toLowerCase().trim();
      const keyMap: Record<string, string> = { paid: 'paid', partial: 'partial', 'partially paid': 'partiallyPaid', partially_paid: 'partiallyPaid', unpaid: 'unpaid' };
      const variant = ({ paid: 'success', partial: 'info', 'partially paid': 'info', unpaid: 'outline' }[status] ?? 'default') as any;
      return <Badge variant={variant} className="capitalize">{t(`QuotesPage.quoteDialog.${keyMap[status] || 'unpaid'}`)}</Badge>;
    },
  },
  {
    accessorKey: 'billing_status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.billingStatus')} />,
    cell: ({ row }) => {
      const status = (row.getValue('billing_status') as string).toLowerCase().trim();
      const keyMap: Record<string, string> = { invoiced: 'invoiced', 'partially invoiced': 'partiallyInvoiced', partially_invoiced: 'partiallyInvoiced', 'not invoiced': 'notInvoiced', not_invoiced: 'notInvoiced' };
      const variant = ({ invoiced: 'success', 'partially invoiced': 'info', 'not invoiced': 'outline' }[status] ?? 'default') as any;
      return <Badge variant={variant} className="capitalize">{t(`QuotesPage.quoteDialog.${keyMap[status] || 'notInvoiced'}`)}</Badge>;
    },
  },
  {
    accessorKey: 'currency',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.currency')} />,
    cell: ({ row }) => {
      const currency = row.getValue('currency') as string;
      return <div className="font-medium">{currency || 'USD'}</div>;
    },
  },
  {
    accessorKey: 'exchange_rate',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.exchangeRate')} />,
    cell: ({ row }) => {
      const rate = row.getValue('exchange_rate') as number;
      return <div className="font-medium">{rate || '-'}</div>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.createdAt')} />,
    cell: ({ row }) => formatDisplayDate(row.original.createdAt),
  },
];

// ── Data fetching ─────────────────────────────────────────────────────────────
async function getQuotesForUser(userId: string): Promise<Quote[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_QUOTES, { user_id: userId });
    const raw = Array.isArray(data) ? data : (data.user_quotes || data.data || data.result || []);
    return raw.filter((q: any) => q && q.id != null).map((q: any) => ({
      id: q.id ? String(q.id) : `qt_${Math.random().toString(36).substr(2, 9)}`,
      doc_no: q.doc_no || 'N/A',
      user_id: q.user_id || 'N/A',
      user_name: q.user_name || q.userName || q.name || '',
      userEmail: q.userEmail || q.user_email || q.email || '',
      total: Number(q.total_presupuesto ?? q.total ?? 0),
      status: normalizeQuoteStatus(q.status),
      payment_status: normalizeQuotePaymentStatus(q.payment_status),
      billing_status: String(q.billing_status || 'not invoiced').toLowerCase(),
      currency: q.currency || 'USD',
      exchange_rate: Number(q.exchange_rate || 1),
      notes: q.notes || '',
      createdAt: q.createdAt || q.created_at || new Date().toISOString().split('T')[0],
      amount_invoiced: Number(q.monto_facturado ?? q.amount_invoiced ?? 0),
      amount_paid: Number(q.monto_pagado ?? q.amount_paid ?? 0),
      amount_pending_invoice: Number(q.pendiente_facturar ?? q.amount_pending_invoice ?? 0),
      amount_pending_payment: Number(q.pendiente_pago_facturado ?? q.amount_pending_payment ?? 0),
    }));
  } catch {
    return [];
  }
}

// ── Item total display (read-only, computed from quantity × unit_price) ───────
function ItemTotalField({ form }: { form: ReturnType<typeof useForm<ItemFormValues>> }) {
  const quantity = useWatch({ control: form.control, name: 'quantity' }) ?? 0;
  const unitPrice = useWatch({ control: form.control, name: 'unit_price' }) ?? 0;
  const total = (Number(quantity) * Number(unitPrice));
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">Total</label>
      <Input value={formatted} readOnly disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
    </div>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, any> = { accepted: 'success', confirmed: 'success', sent: 'default', pending: 'info', draft: 'outline', rejected: 'destructive' };
const PAYMENT_BADGE: Record<string, any> = { paid: 'success', partial: 'info', partially_paid: 'info', unpaid: 'outline' };
const BILLING_BADGE: Record<string, any> = { invoiced: 'success', partially_invoiced: 'info', 'partially invoiced': 'info', 'not invoiced': 'outline', not_invoiced: 'outline' };

function formatCurrency(amount: number | undefined, currency: string | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(Number(amount || 0));
}

function normalizeQuoteStatus(status: unknown): Quote['status'] {
  const normalized = String(status || 'draft').toLowerCase();
  switch (normalized) {
    case 'draft':
    case 'sent':
    case 'accepted':
    case 'rejected':
    case 'pending':
    case 'confirmed':
      return normalized;
    default:
      return 'draft';
  }
}

function normalizeQuotePaymentStatus(status: unknown): Quote['payment_status'] {
  const normalized = String(status || 'unpaid').toLowerCase().trim();
  switch (normalized) {
    case 'paid':
      return 'paid';
    case 'partially_paid':
      return 'partially_paid';
    case 'partial':
    case 'partially paid':
      return 'partial';
    default:
      return 'unpaid';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
interface UserQuotesProps {
  userId: string;
  onQuoteSelect?: (quote: Quote | null) => void;
  mode?: UserDetailMode;
  onDataChange?: () => void;
  refreshTrigger?: number;
}

export function UserQuotes({ userId, onQuoteSelect, mode = 'sales', onDataChange, refreshTrigger }: UserQuotesProps) {
  const t = useTranslations();
  const tQuotes = useTranslations('QuotesPage');
  const { toast } = useToast();
  const { activeCashSession } = useAuth();
  const { hasPermission } = usePermissions();
  const { open: openBillingWizard } = useBillingWizard();
  const { printQuote, printPayment } = usePrintDocument();
  const isSales = mode === 'sales';
  const isViewportNarrow = useViewportNarrow();
  const [userQuotes, setUserQuotes] = React.useState<Quote[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isQuoteBillingDialogOpen, setIsQuoteBillingDialogOpen] = React.useState(false);

  // Sync selectedQuote when userQuotes array changes
  React.useEffect(() => {
    if (selectedQuote && userQuotes.length > 0) {
      const updatedQuote = userQuotes.find(q => q.id === selectedQuote.id);
      if (updatedQuote) {
        const hasChanges =
          updatedQuote.status !== selectedQuote.status ||
          updatedQuote.total !== selectedQuote.total ||
          updatedQuote.billing_status !== selectedQuote.billing_status ||
          updatedQuote.payment_status !== selectedQuote.payment_status ||
          updatedQuote.amount_invoiced !== selectedQuote.amount_invoiced ||
          updatedQuote.amount_pending_invoice !== selectedQuote.amount_pending_invoice ||
          updatedQuote.amount_paid !== selectedQuote.amount_paid ||
          updatedQuote.amount_pending_payment !== selectedQuote.amount_pending_payment;
        if (hasChanges) {
          setSelectedQuote(updatedQuote);
        }
      } else {
        setSelectedQuote(null);
        setRowSelection({});
      }
    }
  }, [selectedQuote, userQuotes]);

  // Items
  const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);
  const [quoteItemsQuoteId, setQuoteItemsQuoteId] = React.useState<string | null>(null);
  const [isLoadingItems, setIsLoadingItems] = React.useState(false);
  const [services, setServices] = React.useState<Service[]>([]);

  // Item dialogs
  const [isItemDialogOpen, setIsItemDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<QuoteItem | null>(null);
  const [deletingItem, setDeletingItem] = React.useState<QuoteItem | null>(null);
  const [isSubmittingItem, setIsSubmittingItem] = React.useState(false);

  // Record-level dialogs
  const [isEditQuoteOpen, setIsEditQuoteOpen] = React.useState(false);
  const [isSubmittingQuote, setIsSubmittingQuote] = React.useState(false);
  const [isDeletingQuote, setIsDeletingQuote] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<'confirm' | 'reject' | null>(null);
  const [actionNotes, setActionNotes] = React.useState('');
  const [isSubmittingAction, setIsSubmittingAction] = React.useState(false);

  // Email dialog states
  const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
  const [selectedQuoteForEmail, setSelectedQuoteForEmail] = React.useState<Quote | null>(null);
  const [emailRecipients, setEmailRecipients] = React.useState('');
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  const [isWarningDialogOpen, setIsWarningDialogOpen] = React.useState(false);
  const [disabledEmails, setDisabledEmails] = React.useState<string[]>([]);

  // Clinic Sessions state
  const [clinicSessions, setClinicSessions] = React.useState<QuoteClinicSession[]>([]);
  const [isLoadingClinicSessions, setIsLoadingClinicSessions] = React.useState(false);

  // Quote Invoices / Payments tabs
  const [quoteDetailInvoices, setQuoteDetailInvoices] = React.useState<Invoice[]>([]);
  const [isLoadingQuoteDetailInvoices, setIsLoadingQuoteDetailInvoices] = React.useState(false);
  const [quoteDetailPayments, setQuoteDetailPayments] = React.useState<QuotePaymentRow[]>([]);
  const [isLoadingQuoteDetailPayments, setIsLoadingQuoteDetailPayments] = React.useState(false);

  // Order state for confirmed quotes
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = React.useState(false);
  const [isLoadingOrderItems, setIsLoadingOrderItems] = React.useState(false);

  const columns = React.useMemo(() => getColumns(t), [t]);
  const isDraft = selectedQuote?.status?.toLowerCase() === 'draft';
  const canUpdateQuote = hasPermission(isSales ? SALES_PERMISSIONS.QUOTES_UPDATE : PURCHASES_PERMISSIONS.QUOTES_UPDATE);
  const canDeleteQuote = hasPermission(isSales ? SALES_PERMISSIONS.QUOTES_DELETE : PURCHASES_PERMISSIONS.QUOTES_DELETE);
  const canConfirmQuote = hasPermission(isSales ? SALES_PERMISSIONS.QUOTES_CONFIRM : PURCHASES_PERMISSIONS.QUOTES_CONFIRM);
  const canRejectQuote = isSales
    ? hasPermission(SALES_PERMISSIONS.QUOTES_REJECT)
    : canConfirmQuote;
  const canPrintQuote = isSales ? hasPermission(SALES_PERMISSIONS.QUOTES_PRINT) : true;
  const canSendQuote = isSales ? hasPermission(SALES_PERMISSIONS.QUOTES_SEND_EMAIL) : true;
  const canAddItem = hasPermission(isSales ? SALES_PERMISSIONS.QUOTES_ADD_ITEM : PURCHASES_PERMISSIONS.QUOTES_CREATE);
  const canUpdateItem = hasPermission(isSales ? SALES_PERMISSIONS.QUOTES_UPDATE_ITEM : PURCHASES_PERMISSIONS.QUOTES_UPDATE);
  const canDeleteItem = hasPermission(isSales ? SALES_PERMISSIONS.QUOTES_DELETE_ITEM : PURCHASES_PERMISSIONS.QUOTES_DELETE);
  const canEditItems = canUpdateItem && ['draft', 'pending'].includes(selectedQuote?.status?.toLowerCase() || '');
  const canScheduleItem = isSales && hasPermission(SALES_PERMISSIONS.ORDERS_SCHEDULE_ITEM);
  const canCompleteItem = isSales && hasPermission(SALES_PERMISSIONS.ORDERS_COMPLETE_ITEM);
  const canInvoiceQuote = isSales
    ? hasPermission(SALES_PERMISSIONS.INVOICES_CREATE) || hasPermission(SALES_PERMISSIONS.ORDERS_INVOICE_FROM_ORDER)
    : hasPermission(PURCHASES_PERMISSIONS.INVOICES_CREATE) || hasPermission(PURCHASES_PERMISSIONS.ORDERS_CONVERT_INVOICE);
  const canSend = canSendQuote;
  const isQuoteReadyToInvoice = ['accepted', 'confirmed'].includes(selectedQuote?.status?.toLowerCase() || '');
  const pendingInvoiceAmount = Number(selectedQuote?.amount_pending_invoice || 0);
  const latestQuoteItemsRequestRef = React.useRef<string | null>(null);
  const showInvoiceFromOrderButton =
    canInvoiceQuote &&
    isQuoteReadyToInvoice &&
    pendingInvoiceAmount > 0.009;

  const canCreatePayment = isSales
    ? hasPermission(SALES_PERMISSIONS.PAYMENTS_CREATE)
    : hasPermission(PURCHASES_PERMISSIONS.PAYMENTS_CREATE);
  const pendingPaymentAmount = Number(selectedQuote?.amount_pending_payment || 0);
  const showQuickBillButton =
    isQuoteReadyToInvoice &&
    (pendingInvoiceAmount > 0.009 || pendingPaymentAmount > 0.009) &&
    (canInvoiceQuote || canCreatePayment);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadQuotes = React.useCallback(async (silent = false) => {
    if (!userId) return;
    silent ? setIsRefreshing(true) : setIsLoading(true);
    const data = await getQuotesForUser(userId);
    setUserQuotes(data);
    silent ? setIsRefreshing(false) : setIsLoading(false);
  }, [userId]);

  const loadItems = React.useCallback(async (quoteId: string) => {
    latestQuoteItemsRequestRef.current = quoteId;
    setIsLoadingItems(true);
    try {
      const data = await api.get(
        isSales ? API_ROUTES.SALES.QUOTES_ITEMS : API_ROUTES.PURCHASES.QUOTES_ITEMS,
        { quote_id: quoteId, is_sales: isSales ? 'true' : 'false' }
      );
      const raw = Array.isArray(data) ? data : (data.items || data.data || []);
      const quoteItems = raw.map((i: any) => ({
        id: String(i.id),
        service_id: String(i.service_id),
        service_name: i.service_name || '',
        unit_price: parseFloat(i.unit_price) || 0,
        quantity: parseInt(i.quantity) || 1,
        total: parseFloat(i.total) || 0,
        tooth_number: i.tooth_number ?? undefined,
      }));
      if (latestQuoteItemsRequestRef.current === quoteId) {
        setQuoteItems(sortQuoteItems(quoteItems));
        setQuoteItemsQuoteId(quoteId);
      }
    } catch {
      if (latestQuoteItemsRequestRef.current === quoteId) {
        setQuoteItems([]);
        setQuoteItemsQuoteId(quoteId);
      }
    } finally {
      if (latestQuoteItemsRequestRef.current === quoteId) {
        setIsLoadingItems(false);
      }
    }
  }, [isSales]);

  const loadServices = React.useCallback(async () => {
    if (services.length > 0) return;
    try {
      const data = await (isSales ? getSalesServices({ limit: 500 }) : getPurchaseServices({ limit: 500 }));
      setServices(data.items || []);
    } catch { /* silent */ }
  }, [isSales, services.length]);

  const loadQuoteClinicSessions = React.useCallback(async (quoteId: string) => {
    setIsLoadingClinicSessions(true);
    try {
      const sessions = await getQuoteClinicSessions(quoteId);
      setClinicSessions(sessions);
    } catch {
      setClinicSessions([]);
    } finally {
      setIsLoadingClinicSessions(false);
    }
  }, []);

  const loadOrders = React.useCallback(async (quoteId: string) => {
    setIsLoadingOrders(true);
    setOrders(await getOrdersForQuote(quoteId, isSales));
    setIsLoadingOrders(false);
  }, [isSales]);

  const loadOrderItems = React.useCallback(async (orderId: string) => {
    setIsLoadingOrderItems(true);
    setOrderItems(await getOrderItemsForOrder(orderId, isSales));
    setIsLoadingOrderItems(false);
  }, [isSales]);

  const loadQuoteDetailInvoices = React.useCallback(async (quoteId: string) => {
    setIsLoadingQuoteDetailInvoices(true);
    try {
      const invoices = await fetchQuoteInvoicesForFinancials(quoteId, isSales);
      setQuoteDetailInvoices(invoices.filter((inv) => inv.type !== 'credit_note'));
    } catch {
      setQuoteDetailInvoices([]);
    } finally {
      setIsLoadingQuoteDetailInvoices(false);
    }
  }, [isSales]);

  const loadQuoteDetailPayments = React.useCallback(async (quoteId: string) => {
    setIsLoadingQuoteDetailPayments(true);
    try {
      const endpoint = isSales ? API_ROUTES.SALES.QUOTES_PAYMENTS : API_ROUTES.PURCHASES.QUOTES_PAYMENTS;
      const data = await api.get(endpoint, { quote_id: quoteId, is_sales: isSales ? 'true' : 'false' });
      const raw = Array.isArray(data) ? data : (data.payments || data.data || []);
      setQuoteDetailPayments(
        raw
          .filter((p: any) => p && (p.transaction_id != null || p.id != null))
          .map((p: any) => ({
            id: String(p.transaction_id || p.id),
            doc_no: p.doc_no || p.payment_doc_no || '',
            invoice_doc_no: p.invoice_doc_no || '',
            amount: Math.abs(Number(p.amount_applied ?? p.amount ?? 0)),
            currency: p.invoice_currency || p.source_currency || p.currency || 'UYU',
            method: p.payment_method_name || p.method || p.payment_method || '',
            payment_date: p.payment_date || p.created_at || '',
            createdAt: p.created_at || '',
            transaction_id: p.transaction_id ? String(p.transaction_id) : String(p.id || ''),
            transaction_type: p.transaction_type || 'direct_payment',
          })),
      );
    } catch {
      setQuoteDetailPayments([]);
    } finally {
      setIsLoadingQuoteDetailPayments(false);
    }
  }, [isSales]);

  React.useEffect(() => { loadQuotes(); }, [loadQuotes]);

  React.useEffect(() => {
    if (isQuoteReadyToInvoice && orders.length > 0) {
      setSelectedOrder(orders[0]);
    }
  }, [isQuoteReadyToInvoice, orders]);

  React.useEffect(() => {
    if (selectedOrder) {
      loadOrderItems(selectedOrder.id);
    } else {
      setOrderItems([]);
    }
  }, [selectedOrder, loadOrderItems]);

  // Efecto para refrescar cuando cambia refreshTrigger
  React.useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadQuotes(true);
      if (selectedQuote) {
        loadQuoteClinicSessions(selectedQuote.id);
      }
    }
  }, [loadQuoteClinicSessions, loadQuotes, refreshTrigger, selectedQuote]);

  // ── Row selection ────────────────────────────────────────────────────────────
  const handleRowSelectionChange = React.useCallback((selectedRows: Quote[]) => {
    const quote = selectedRows[0] ?? null;
    setSelectedQuote(quote);
    setOrders([]);
    setSelectedOrder(null);
    setOrderItems([]);
    setQuoteItems([]);
    setQuoteItemsQuoteId(null);
    if (!quote) {
      setIsSheetOpen(false);
    } else if (['accepted', 'confirmed'].includes(quote.status?.toLowerCase() || '')) {
      loadOrders(quote.id);
    }
    onQuoteSelect?.(quote);
  }, [loadOrders, onQuoteSelect]);

  const handleOpenSheet = React.useCallback((quote: Quote) => {
    setIsSheetOpen(true);
    setQuoteItems([]);
    setQuoteItemsQuoteId(null);
    loadItems(quote.id);
    loadServices();
    loadQuoteClinicSessions(quote.id);
    loadQuoteDetailInvoices(quote.id);
    loadQuoteDetailPayments(quote.id);
    setOrders([]);
    setSelectedOrder(null);
    setOrderItems([]);
    if (['accepted', 'confirmed'].includes(quote.status?.toLowerCase() || '')) {
      loadOrders(quote.id);
    }
  }, [loadItems, loadServices, loadQuoteClinicSessions, loadQuoteDetailInvoices, loadQuoteDetailPayments, loadOrders]);

  const handleOpenBillingDialog = React.useCallback(async () => {
    if (!selectedQuote) return;
    if (quoteItems.length === 0) {
      await loadItems(selectedQuote.id);
    }
    setIsQuoteBillingDialogOpen(true);
  }, [loadItems, quoteItems.length, selectedQuote]);

  // ── Record actions ──────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!selectedQuote || !canPrintQuote) return;
    printQuote(selectedQuote, isSales);
  };

  const handleSend = async () => {
    if (!selectedQuote || !canSendQuote) return;
    try {
      await api.post(API_ROUTES.PURCHASES.QUOTES_SEND, { quote_id: selectedQuote.id, is_sales: isSales });
      toast({ title: tQuotes('sendEmailDialog.success') });
      await loadQuotes(true);
    } catch {
      toast({ title: t('UserQuotes.toasts.errorSending'), variant: 'destructive' });
    }
  };

  const handleSendEmailClick = (quote: Quote) => {
    setSelectedQuoteForEmail(quote);
    setEmailRecipients(quote.userEmail || '');
    setIsSendEmailDialogOpen(true);
  };

  const sendEmail = async (emails: string[]) => {
    if (!selectedQuoteForEmail) return;

    setIsSendingEmail(true);
    try {
      await api.post(
        API_ROUTES.PURCHASES.QUOTES_SEND,
        {
          quote_id: selectedQuoteForEmail.id,
          is_sales: isSales,
          emails,
        }
      );
      toast({ title: tQuotes('sendEmailDialog.success') });
      setIsSendEmailDialogOpen(false);
      setSelectedQuoteForEmail(null);
      setEmailRecipients('');
    } catch {
      toast({ title: tQuotes('sendEmailDialog.error'), variant: 'destructive' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleConfirmSendEmail = async () => {
    if (!selectedQuoteForEmail) return;

    const emails = emailRecipients
      .split(',')
      .map(e => e.trim())
      .filter(e => e);

    if (emails.length === 0) {
      toast({ title: tQuotes('sendEmailDialog.errorNoEmail'), variant: 'destructive' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(e => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      toast({ title: tQuotes('sendEmailDialog.errorInvalidEmails', { emails: invalidEmails.join(', ') }), variant: 'destructive' });
      return;
    }

    // Check communication preferences
    const preferences = await checkPreferencesByEmails(emails, 'email', 'billing');
    const disabled = getDisabledEmails(preferences);

    if (disabled.length > 0) {
      setDisabledEmails(disabled);
      setIsWarningDialogOpen(true);
      return;
    }

    await sendEmail(emails);
  };

  const handleWarningConfirm = async () => {
    setIsWarningDialogOpen(false);
    await sendEmail(emailRecipients.split(',').map(e => e.trim()).filter(e => e));
  };

  const handleConfirmAction = async () => {
    if (!selectedQuote || !confirmAction) return;
    setIsSubmittingAction(true);
    try {
      const route = confirmAction === 'confirm'
        ? (isSales ? API_ROUTES.SALES.QUOTE_CONFIRM : API_ROUTES.PURCHASES.QUOTE_CONFIRM)
        : (isSales ? API_ROUTES.SALES.QUOTE_REJECT : API_ROUTES.PURCHASES.QUOTE_REJECT);
      const res = await api.post(route, {
        quote_number: selectedQuote.id,
        confirm_reject: confirmAction,
        is_sales: isSales,
        notes: actionNotes,
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: confirmAction === 'confirm' ? t('UserQuotes.toasts.quoteConfirmed') : t('UserQuotes.toasts.quoteRejected') });
      setConfirmAction(null);
      setActionNotes('');
      await loadQuotes(true);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || t('QuotesPage.toast.quoteActionError', { action: confirmAction }), variant: 'destructive' });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Confirm directly (no notes popup) — used for "Confirmar" action only
  const handleConfirmQuoteDirect = React.useCallback(async () => {
    if (!selectedQuote) return;
    setIsSubmittingAction(true);
    try {
      const route = isSales ? API_ROUTES.SALES.QUOTE_CONFIRM : API_ROUTES.PURCHASES.QUOTE_CONFIRM;
      const res = await api.post(route, {
        quote_number: selectedQuote.id,
        confirm_reject: 'confirm',
        is_sales: isSales,
        notes: '',
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: t('UserQuotes.toasts.quoteConfirmed') });
      await loadQuotes(true);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || t('QuotesPage.toast.quoteActionError', { action: 'confirm' }), variant: 'destructive' });
    } finally {
      setIsSubmittingAction(false);
    }
  }, [selectedQuote, isSales, loadQuotes, onDataChange, t]);

  const handleDeleteQuote = async () => {
    if (!selectedQuote) return;
    try {
      const res = await api.delete(
        isSales ? API_ROUTES.SALES.QUOTE_DELETE : API_ROUTES.PURCHASES.QUOTE_DELETE,
        { id: selectedQuote.id, is_sales: isSales }
      );
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: t('UserQuotes.toasts.quoteDeleted') });
      setIsDeletingQuote(false);
      setIsSheetOpen(false);
      setRowSelection({});
      setSelectedQuote(null);
      onQuoteSelect?.(null);
      await loadQuotes(true);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || t('UserQuotes.toasts.errorDeleting'), variant: 'destructive' });
    }
  };

  // ── Quote edit form ──────────────────────────────────────────────────────────
  const getSessionExchangeRate = React.useCallback(() => {
    if (!activeCashSession?.data?.opening_details?.date_rate) return 1;
    return activeCashSession.data.opening_details.date_rate;
  }, [activeCashSession]);

  const quoteEditForm = useForm<QuoteEditFormValues>({ resolver: zodResolver(quoteEditSchema) });
  const { fields: editItemFields, append: appendEditItem, remove: removeEditItem, update: updateEditItem } = useFieldArray({
    control: quoteEditForm.control,
    name: 'items',
  });

  React.useEffect(() => {
    if (!isEditQuoteOpen || !selectedQuote) return;
    const currency = (selectedQuote.currency as 'USD' | 'UYU') ?? 'USD';
    const exchangeRate = currency === 'UYU' ? 1 : (selectedQuote.exchange_rate || getSessionExchangeRate());
    const hasCurrentQuoteItems = quoteItemsQuoteId === selectedQuote.id;
    const mappedItems = (hasCurrentQuoteItems ? quoteItems : []).map(i => ({
      id: i.id,
      service_id: i.service_id,
      service_name: i.service_name || '',
      quantity: i.quantity,
      unit_price: i.unit_price,
      total: i.total,
      tooth_number: i.tooth_number ?? ('' as const),
    }));
    quoteEditForm.reset({ currency, exchange_rate: exchangeRate, notes: selectedQuote.notes ?? '', items: mappedItems });
    if (!hasCurrentQuoteItems) loadItems(selectedQuote.id);
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditQuoteOpen, quoteItems, quoteItemsQuoteId, selectedQuote]);

  // Auto-update exchange_rate when currency changes
  const watchedEditCurrency = quoteEditForm.watch('currency');
  const watchedEditExchangeRate = quoteEditForm.watch('exchange_rate');
  React.useEffect(() => {
    if (!isEditQuoteOpen) return;
    if (watchedEditCurrency === 'UYU') {
      if (watchedEditExchangeRate !== 1) quoteEditForm.setValue('exchange_rate', 1);
    } else {
      const sessionRate = getSessionExchangeRate();
      if (!watchedEditExchangeRate || watchedEditExchangeRate === 1) {
        quoteEditForm.setValue('exchange_rate', sessionRate);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedEditCurrency, isEditQuoteOpen]);

  // Re-populate items into form once loaded
  React.useEffect(() => {
    if (!isEditQuoteOpen || quoteItems.length === 0) return;
    const current = quoteEditForm.getValues('items');
    if (current.length === 0) {
      quoteEditForm.setValue('items', quoteItems.map(i => ({
        id: i.id,
        service_id: i.service_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.total,
        tooth_number: i.tooth_number ?? ('' as const),
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteItems, isEditQuoteOpen]);

  const handleSubmitQuoteEdit = async (values: QuoteEditFormValues) => {
    if (!selectedQuote) return;
    setIsSubmittingQuote(true);
    try {
      const calculatedTotal = values.items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
      const res = await api.post(isSales ? API_ROUTES.SALES.QUOTES_UPSERT : API_ROUTES.PURCHASES.QUOTES_UPSERT, {
        id: selectedQuote.id,
        user_id: selectedQuote.user_id,
        total: calculatedTotal,
        status: selectedQuote.status,
        payment_status: selectedQuote.payment_status,
        billing_status: selectedQuote.billing_status,
        currency: values.currency,
        exchange_rate: values.exchange_rate,
        notes: values.notes || '',
        items: values.items.map(i => ({
          id: i.id,
          service_id: i.service_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total,
          tooth_number: isSales && i.tooth_number ? Number(i.tooth_number) : null,
        })),
        is_sales: isSales,
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: t('UserQuotes.toasts.quoteUpdated') });
      setIsEditQuoteOpen(false);
      await loadQuotes(true);
      loadItems(selectedQuote.id);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || t('UserQuotes.toasts.errorUpdating'), variant: 'destructive' });
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  // ── Item form ────────────────────────────────────────────────────────────────
  const itemForm = useForm<ItemFormValues>({ resolver: zodResolver(itemSchema) });

  React.useEffect(() => {
    if (!isItemDialogOpen) return;
    if (editingItem) {
      itemForm.reset({ service_id: editingItem.service_id, quantity: editingItem.quantity, unit_price: editingItem.unit_price, tooth_number: editingItem.tooth_number });
    } else {
      itemForm.reset({ service_id: '', quantity: 1, unit_price: 0 });
    }
  }, [isItemDialogOpen, editingItem, itemForm]);

  const handleSubmitItem = async (values: ItemFormValues) => {
    if (!selectedQuote) return;
    setIsSubmittingItem(true);
    try {
      const res = await api.post(isSales ? API_ROUTES.SALES.QUOTES_LINES_UPSERT : API_ROUTES.PURCHASES.QUOTES_LINES_UPSERT, {
        ...(editingItem ? { id: editingItem.id } : {}),
        quote_id: selectedQuote.id,
        service_id: values.service_id,
        quantity: values.quantity,
        unit_price: values.unit_price,
        total: values.quantity * values.unit_price,
        tooth_number: isSales ? (values.tooth_number || null) : null,
        is_sales: isSales,
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: editingItem ? t('UserQuotes.toasts.itemUpdated') : t('UserQuotes.toasts.itemAdded') });
      setIsItemDialogOpen(false);
      loadItems(selectedQuote.id);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || t('UserQuotes.toasts.errorSavingItem'), variant: 'destructive' });
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!deletingItem || !selectedQuote) return;
    try {
      const res = await api.delete(
        isSales ? API_ROUTES.SALES.QUOTES_LINES_DELETE : API_ROUTES.PURCHASES.QUOTES_LINES_DELETE,
        { id: deletingItem.id, quote_id: selectedQuote.id, is_sales: isSales }
      );
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: t('UserQuotes.toasts.itemDeleted') });
      setDeletingItem(null);
      loadItems(selectedQuote.id);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || t('UserQuotes.toasts.errorDeletingItem'), variant: 'destructive' });
    }
  };

  // ── Toolbar actions ───────────────────────────────────────────────────────────
  const toolbarActions = selectedQuote ? (
    <div className="flex items-center gap-1.5">
      {/* Acciones principales fuera del dropdown */}
      {isDraft && canConfirmQuote && (
        <>
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
            onClick={handleConfirmQuoteDirect} disabled={isSubmittingAction}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {t('UserQuotes.actions.confirm')}
          </Button>
        </>
      )}
      {isDraft && canRejectQuote && (
        <>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => { setConfirmAction('reject'); setActionNotes(''); }}
          >
            <XCircle className="h-3.5 w-3.5" />
            {t('UserQuotes.actions.reject')}
          </Button>
        </>
      )}
      {showQuickBillButton && (
        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() =>
            selectedQuote &&
            openBillingWizard(
              {
                quoteId: selectedQuote.id,
                patientId: selectedQuote.user_id,
                patientName: selectedQuote.user_name,
                isSales,
                quote: selectedQuote,
              },
              () => loadQuotes(true),
            )
          }
        >
          <Zap className="h-3.5 w-3.5" />
          Cobrar
        </Button>
      )}
      {showInvoiceFromOrderButton && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleOpenBillingDialog}
        >
          <Receipt className="h-3.5 w-3.5" />
          {tQuotes('actions.invoice')}
        </Button>
      )}
      {/* Determinar si hay acciones disponibles para el dropdown */}
      {((canPrintQuote || canSend || (isDraft && (canUpdateQuote || canDeleteQuote)))) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              {t('UserQuotes.actions.title')}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canPrintQuote && (
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                {t('UserQuotes.actions.print')}
              </DropdownMenuItem>
            )}
            {canSend && (
              <DropdownMenuItem onClick={() => handleSendEmailClick(selectedQuote)}>
                <Send className="h-4 w-4 mr-2" />
                {t('UserQuotes.actions.send')}
              </DropdownMenuItem>
            )}
            {isDraft && (canUpdateQuote || canDeleteQuote) && (
              <>
                <DropdownMenuSeparator />
                {canUpdateQuote && (
                  <DropdownMenuItem onClick={() => setIsEditQuoteOpen(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    {t('UserQuotes.actions.edit')}
                  </DropdownMenuItem>
                )}
                {canDeleteQuote && (
                  <DropdownMenuItem onClick={() => setIsDeletingQuote(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('UserQuotes.actions.delete')}
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleOpenSheet(selectedQuote)}>
        <Eye className="h-3.5 w-3.5" />
        {t('UserQuotes.actions.viewDetails')}
      </Button>
    </div>
  ) : null;

  const viewportNarrow = useViewportNarrow();

  // Builds a printable Payment from a quote-detail payment row and prints its receipt.
  const handlePrintReceipt = React.useCallback((pay: QuotePaymentRow) => {
    const p: import('@/lib/types').Payment = {
      id: pay.id,
      doc_no: pay.doc_no,
      payment_doc_no: pay.doc_no,
      order_id: '',
      invoice_id: null,
      quote_id: null,
      user_name: selectedQuote?.user_name || '',
      payment_date: pay.payment_date || pay.createdAt || '',
      amount_applied: pay.amount,
      source_amount: pay.amount,
      source_currency: (pay.currency as 'UYU' | 'USD') || 'UYU',
      payment_method: pay.method || '',
      transaction_type: (pay.transaction_type as import('@/lib/types').Payment['transaction_type']) || 'direct_payment',
      transaction_id: pay.transaction_id || null,
      status: 'completed',
      createdAt: pay.createdAt || '',
      updatedAt: pay.createdAt || '',
      amount: pay.amount,
      method: pay.method || '',
      type: null,
    };
    printPayment(p, isSales);
  }, [printPayment, isSales, selectedQuote]);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <>
      <Card className="flex-1 flex flex-col min-h-0 shadow-none border-0">
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          <DataTable
            columns={columns}
            data={userQuotes}
            filterColumnId="doc_no"
            filterPlaceholder={t('UserQuotes.filterPlaceholder')}
            onRowSelectionChange={handleRowSelectionChange}
            enableSingleRowSelection
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            onRefresh={() => loadQuotes(true)}
            isRefreshing={isRefreshing}
            extraButtons={toolbarActions}
            columnTranslations={{
              doc_no: t('QuoteColumns.quoteId'),
              total: t('QuoteColumns.total'),
              amount_invoiced: t('QuoteColumns.amountInvoiced'),
              amount_pending_invoice: t('QuoteColumns.pendingInvoice'),
              amount_paid: t('QuoteColumns.amountPaid'),
              amount_pending_payment: t('QuoteColumns.pendingPayment'),
              status: t('UserColumns.status'),
              payment_status: t('Navigation.Payments'),
              billing_status: t('QuoteColumns.billingStatus'),
              currency: t('QuoteColumns.currency'),
              exchange_rate: t('QuoteColumns.exchangeRate'),
            }}
            isNarrow={isViewportNarrow}
            renderCard={(quote: Quote, _isSelected: boolean) => (
              <DataCard isSelected={_isSelected}
                title={quote.doc_no}
                subtitle={formatDisplayDate(quote.createdAt)}
                badge={<Badge variant={({ accepted: 'success', confirmed: 'success', sent: 'default', pending: 'info', draft: 'outline', rejected: 'destructive' }[(quote.status || '').toLowerCase()] ?? 'default') as any} className="capitalize text-[10px]">{quote.status}</Badge>}
                fields={[
                  { label: t('QuoteColumns.total'), value: formatCurrency(quote.total, quote.currency), primary: true },
                  { label: t('QuoteColumns.amountInvoiced'), value: formatCurrency(quote.amount_invoiced, quote.currency) },
                  { label: t('QuoteColumns.pendingInvoice'), value: formatCurrency(quote.amount_pending_invoice, quote.currency) },
                  { label: t('QuoteColumns.amountPaid'), value: formatCurrency(quote.amount_paid, quote.currency) },
                  { label: t('QuoteColumns.pendingPayment'), value: formatCurrency(quote.amount_pending_payment, quote.currency) },
                  { label: t('Navigation.Payments'), value: quote.payment_status || '-' },
                  { label: t('QuoteColumns.billingStatus'), value: quote.billing_status || '-' },
                ]}
              />
            )}
          />
        </CardContent>
      </Card>

      {/* ── Detail Sheet ── */}
      <ResizableSheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) { setRowSelection({}); setSelectedQuote(null); setQuoteItems([]); setQuoteItemsQuoteId(null); setClinicSessions([]); onQuoteSelect?.(null); }
        }}
        defaultWidth={800}
        minWidth={560}
        maxWidth={1400}
        storageKey="user-quotes-sheet-width"
      >
        {selectedQuote && (
          <>
            {/* Header estilo ficha del paciente */}
            <div className="flex-none bg-card shadow-sm border-b border-border">
              {/* Título, Estado Facturación, Creado + badges de estado */}
              <div className="px-6 py-4 border-b border-border/50 pr-12 sm:pr-20">
                <SheetTitle className="text-2xl font-bold text-card-foreground">{selectedQuote.doc_no}</SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground mt-0.5">
                  {t('UserQuotes.budget.title')}
                  <span className="ml-2 text-xs">{formatDisplayDate(selectedQuote.createdAt)}</span>
                </SheetDescription>
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <Badge variant={(BILLING_BADGE[selectedQuote.billing_status.toLowerCase()] ?? 'outline') as any} className="text-xs capitalize">
                    {(() => {
                      const status = selectedQuote.billing_status.toLowerCase().trim();
                      const keyMap: Record<string, string> = { invoiced: 'invoiced', 'partially invoiced': 'partiallyInvoiced', partially_invoiced: 'partiallyInvoiced', 'not invoiced': 'notInvoiced', not_invoiced: 'notInvoiced' };
                      return t(`QuotesPage.quoteDialog.${keyMap[status] || 'notInvoiced'}`);
                    })()}
                  </Badge>
                  <Badge variant={(STATUS_BADGE[selectedQuote.status.toLowerCase()] ?? 'default') as any} className="text-xs capitalize">
                    {t(`QuotesPage.quoteDialog.${selectedQuote.status.toLowerCase()}`)}
                  </Badge>
                  <Badge variant={(PAYMENT_BADGE[selectedQuote.payment_status.toLowerCase()] ?? 'outline') as any} className="text-xs capitalize">
                    {(() => {
                      const status = selectedQuote.payment_status.toLowerCase().trim();
                      const keyMap: Record<string, string> = { paid: 'paid', partial: 'partial', 'partially paid': 'partiallyPaid', partially_paid: 'partiallyPaid', unpaid: 'unpaid' };
                      return t(`QuotesPage.quoteDialog.${keyMap[status] || 'unpaid'}`);
                    })()}
                  </Badge>
                </div>
              </div>

              {/* Notas del presupuesto (los totales se muestran en el footer) */}
              {selectedQuote.notes && (
                <div className="px-6 py-3">
                  <p className="text-xs text-muted-foreground italic">{selectedQuote.notes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-b bg-muted/30">
              {/* Acciones principales */}
              {isDraft && canConfirmQuote && (
                <Button variant="default" size="sm" className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirmQuoteDirect} disabled={isSubmittingAction}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  {t('UserQuotes.actions.confirm')}
                </Button>
              )}
              {isDraft && canRejectQuote && (
                <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setConfirmAction('reject'); setActionNotes(''); }}>
                  <XCircle className="h-3.5 w-3.5" />
                  {t('UserQuotes.actions.reject')}
                </Button>
              )}
              {showInvoiceFromOrderButton && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleOpenBillingDialog}>
                  <Receipt className="h-3.5 w-3.5" />
                  {tQuotes('actions.invoice')}
                </Button>
              )}
              {/* Separator only when there are left-side AND right-side actions */}
              {((isDraft && canConfirmQuote) || (isDraft && canRejectQuote) || showInvoiceFromOrderButton) &&
               (canPrintQuote || canSend || (isDraft && canUpdateQuote) || (isDraft && canDeleteQuote)) && (
                <Separator orientation="vertical" className="h-6 mx-1" />
              )}
              {/* Acciones secundarias */}
              {canPrintQuote && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
                  <Printer className="h-3.5 w-3.5" />
                  {t('UserQuotes.actions.print')}
                </Button>
              )}
              {canSend && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleSendEmailClick(selectedQuote)}>
                  <Send className="h-3.5 w-3.5" />
                  {t('UserQuotes.actions.send')}
                </Button>
              )}
              {isDraft && canUpdateQuote && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsEditQuoteOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  {t('UserQuotes.actions.edit')}
                </Button>
              )}
              {isDraft && canDeleteQuote && (
                <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsDeletingQuote(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('UserQuotes.actions.delete')}
                </Button>
              )}
            </div>

            {/* Tabs: Ítems / Sesiones / Facturas / Pagos */}
            <div className="flex-1 flex flex-col overflow-hidden px-4 py-3">
              <Tabs defaultValue="items" className="flex-1 flex flex-col min-h-0">
                <TabsList className="gap-1 rounded-xl border border-border bg-muted/30 p-1 h-auto">
                  <TabsTrigger value="items" className="rounded-lg border border-transparent px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Ítems</TabsTrigger>
                  <TabsTrigger value="facturas" className="rounded-lg border border-transparent px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-1.5" onClick={() => !quoteDetailInvoices.length && loadQuoteDetailInvoices(selectedQuote.id)}>
                    <FileText className="h-3.5 w-3.5" />
                    Facturas
                  </TabsTrigger>
                  <TabsTrigger value="pagos" className="rounded-lg border border-transparent px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-1.5" onClick={() => !quoteDetailPayments.length && loadQuoteDetailPayments(selectedQuote.id)}>
                    <CreditCard className="h-3.5 w-3.5" />
                    Pagos
                  </TabsTrigger>
                  <TabsTrigger value="clinic-sessions" className="rounded-lg border border-transparent px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-1.5">
                    <Stethoscope className="h-3.5 w-3.5" />
                    {t('UserQuotes.clinicSessions')}
                  </TabsTrigger>
                </TabsList>
                <div className="flex-1 min-h-0 mt-4 flex flex-col overflow-hidden">
                  <TabsContent value="items" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                    {selectedQuote.status?.toLowerCase() === 'confirmed' && isSales ? (
                      <OrderItemsTable
                        items={orderItems}
                        isLoading={isLoadingOrders || isLoadingOrderItems}
                        onItemsUpdate={() => selectedOrder && loadOrderItems(selectedOrder.id)}
                        quoteId={selectedOrder?.quote_id}
                        quoteDocNo={selectedOrder?.quote_doc_no}
                        userId={userId}
                        patient={{ id: userId, name: selectedQuote.user_name || '', email: selectedQuote.userEmail || '', phone_number: '', is_active: true, avatar: '' }}
                        isSales={true}
                        canSchedule={canScheduleItem}
                        canComplete={canCompleteItem}
                      />
                    ) : (
                      <>
                        <p className="text-sm font-semibold mb-2">{t('UserQuotes.items.title')}</p>
                        <QuoteItemsTable
                          items={quoteItems}
                          isLoading={isLoadingItems}
                          canEdit={canEditItems}
                          onCreate={canAddItem ? () => { setEditingItem(null); setIsItemDialogOpen(true); loadServices(); } : () => { }}
                          onEdit={canUpdateItem ? (item) => { setEditingItem(item); setIsItemDialogOpen(true); loadServices(); } : () => { }}
                          onDelete={canDeleteItem ? setDeletingItem : () => { }}
                          onRefresh={() => loadItems(selectedQuote.id)}
                          showToothNumber={isSales}
                        />
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="clinic-sessions" className="m-0 h-full overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col">
                    <DataTable
                      columns={getClinicSessionColumns(t)}
                      data={clinicSessions}
                      isLoading={isLoadingClinicSessions}
                      isRefreshing={isLoadingClinicSessions}
                      onRefresh={() => loadQuoteClinicSessions(selectedQuote.id)}
                      useGlobalFilter
                      filterPlaceholder={t('OrderItemsTable.filterPlaceholder')}
                    />
                  </TabsContent>

                  {/* Facturas tab */}
                  <TabsContent value="facturas" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                    <Card className="h-full flex flex-col min-h-0">
                      <CardContent className="flex flex-col p-4 flex-1 min-h-0">
                        <DataTable
                          columns={getInvoiceColumns(t)}
                          data={quoteDetailInvoices}
                          isLoading={isLoadingQuoteDetailInvoices}
                          onRefresh={() => loadQuoteDetailInvoices(selectedQuote.id)}
                          isRefreshing={isLoadingQuoteDetailInvoices}
                          useGlobalFilter
                          filterPlaceholder={t('OrderItemsTable.filterPlaceholder')}
                          isNarrow={viewportNarrow}
                          renderCard={(inv) => (
                            <DataCard
                              title={`#${inv.doc_no || inv.invoice_doc_no || inv.id}`}
                              subtitle={formatDisplayDate(inv.createdAt)}
                              fields={[
                                ...(inv.status ? [{
                                  label: t('UserQuotes.columns.status'),
                                  value: (
                                    <Badge variant={invoiceStatusVariant(inv.status)} className="text-[10px] font-normal capitalize">
                                      {t(`InvoicesPage.status.${inv.status.toLowerCase()}`)}
                                    </Badge>
                                  ),
                                }] : []),
                                {
                                  label: t('UserQuotes.columns.paymentStatus'),
                                  value: (
                                    <Badge
                                      variant={(inv.payment_status === 'paid' ? 'success' : inv.payment_status?.includes('partial') ? 'info' : 'outline') as any}
                                      className="text-[10px] font-normal"
                                    >
                                      {paymentStatusLabel(t, inv.payment_status)}
                                    </Badge>
                                  ),
                                },
                                ...((inv.paid_amount || 0) > 0 ? [{
                                  label: t('UserQuotes.columns.paidAmount'),
                                  value: formatCurrency(inv.paid_amount || 0, inv.currency),
                                }] : []),
                                ...(inv.due_date ? [{
                                  label: t('UserQuotes.columns.dueDate'),
                                  value: formatDisplayDate(inv.due_date),
                                }] : []),
                                {
                                  label: t('UserQuotes.columns.total'),
                                  value: formatCurrency(inv.total, inv.currency),
                                  primary: true,
                                },
                              ]}
                            />
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Pagos tab */}
                  <TabsContent value="pagos" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                    <Card className="h-full flex flex-col min-h-0">
                      <CardContent className="flex flex-col p-4 flex-1 min-h-0">
                        <DataTable
                          columns={getPaymentColumns(t, handlePrintReceipt)}
                          data={quoteDetailPayments}
                          isLoading={isLoadingQuoteDetailPayments}
                          onRefresh={() => loadQuoteDetailPayments(selectedQuote.id)}
                          isRefreshing={isLoadingQuoteDetailPayments}
                          useGlobalFilter
                          filterPlaceholder={t('OrderItemsTable.filterPlaceholder')}
                          isNarrow={viewportNarrow}
                          renderCard={(pay) => (
                            <DataCard
                              title={`#${pay.doc_no || pay.id}`}
                              subtitle={pay.payment_date ? formatDisplayDate(pay.payment_date) : undefined}
                              fields={[
                                ...(pay.method ? [{
                                  label: t('UserQuotes.columns.method'),
                                  value: <Badge variant="outline" className="text-[10px] font-normal capitalize">{pay.method}</Badge>,
                                }] : []),
                                ...(pay.invoice_doc_no ? [{
                                  label: t('UserQuotes.columns.invoice'),
                                  value: `#${pay.invoice_doc_no}`,
                                }] : []),
                                ...(pay.transaction_type && pay.transaction_type !== 'direct_payment' ? [{
                                  label: t('UserQuotes.columns.transactionType'),
                                  value: <Badge variant="info" className="text-[10px] font-normal">{transactionTypeLabel(t, pay.transaction_type)}</Badge>,
                                }] : []),
                                {
                                  label: t('UserQuotes.columns.amount'),
                                  value: <span className="text-emerald-600">{formatCurrency(pay.amount, pay.currency)}</span>,
                                  primary: true,
                                },
                              ]}
                              actions={pay.transaction_id ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs gap-1 -ml-1"
                                  onClick={(e) => { e.stopPropagation(); handlePrintReceipt(pay); }}
                                >
                                  <Printer className="h-3 w-3" />{t('UserQuotes.columns.printReceipt')}
                                </Button>
                              ) : undefined}
                            />
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            </div>

            {/* ── Financial Footer ── */}
            <div className="flex-none border-t bg-muted/30 px-6 py-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">{t('QuoteColumns.total')}</p>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(selectedQuote.total, selectedQuote.currency)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">{t('QuoteColumns.amountInvoiced')}</p>
                  <p className={`text-sm font-semibold tabular-nums ${Number(selectedQuote.amount_invoiced) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {formatCurrency(selectedQuote.amount_invoiced, selectedQuote.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">{t('QuoteColumns.pendingInvoice')}</p>
                  <p className={`text-sm font-semibold tabular-nums ${Number(selectedQuote.amount_pending_invoice) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatCurrency(selectedQuote.amount_pending_invoice, selectedQuote.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">{t('QuoteColumns.amountPaid')}</p>
                  <p className={`text-sm font-semibold tabular-nums ${Number(selectedQuote.amount_paid) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {formatCurrency(selectedQuote.amount_paid, selectedQuote.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">{t('QuoteColumns.pendingPayment')}</p>
                  <p className={`text-sm font-semibold tabular-nums ${Number(selectedQuote.amount_pending_payment) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatCurrency(selectedQuote.amount_pending_payment, selectedQuote.currency)}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </ResizableSheet>

      <QuoteBillingDialog
        open={isQuoteBillingDialogOpen}
        onOpenChange={setIsQuoteBillingDialogOpen}
        quote={selectedQuote}
        quoteItems={quoteItems}
        orderId={selectedOrder?.id}
        isSales={isSales}
        onSuccess={async () => {
          await loadQuotes(true);
          if (selectedQuote) {
            await loadItems(selectedQuote.id);
            if (selectedOrder?.id) {
              await loadOrderItems(selectedOrder.id);
            }
          }
          onDataChange?.();
        }}
      />

      {/* ── Edit quote dialog ── */}
      <Dialog open={isEditQuoteOpen} onOpenChange={setIsEditQuoteOpen}>
        <DialogContent maxWidth="4xl">
          <Form {...quoteEditForm}>
            <form onSubmit={quoteEditForm.handleSubmit(handleSubmitQuoteEdit)} className="flex flex-col flex-1 overflow-hidden" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { e.preventDefault(); if ((e.target as HTMLInputElement).name?.startsWith('items.')) { loadServices(); appendEditItem({ service_id: '', quantity: 1, unit_price: 0, total: 0, tooth_number: '' as any }); } } }}>
              <DialogHeader>
                <DialogTitle>{t('UserQuotes.dialogs.editQuote.title')}</DialogTitle>
                <DialogDescription>{t('UserQuotes.dialogs.editQuote.description', { docNo: selectedQuote?.doc_no })}</DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4 py-4 px-6">
                {/* Currency + Exchange rate */}
                <div className={`grid gap-4 ${watchedEditCurrency === 'UYU' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <FormField control={quoteEditForm.control} name="currency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('UserQuotes.dialogs.editQuote.currency')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="UYU">UYU</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {watchedEditCurrency !== 'UYU' && (
                    <FormField control={quoteEditForm.control} name="exchange_rate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('UserQuotes.dialogs.editQuote.exchangeRate')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.0001"
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>

                {/* Notes */}
                <FormField control={quoteEditForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('UserQuotes.dialogs.editQuote.notesOptional')}</FormLabel>
                    <FormControl><Textarea rows={2} placeholder={t('UserQuotes.dialogs.editQuote.notesPlaceholder')} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Items */}
                <Card>
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <p className="text-sm font-semibold">{t('UserQuotes.dialogs.editQuote.items')}</p>
                      {canAddItem && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => { loadServices(); appendEditItem({ service_id: '', quantity: 1, unit_price: 0, total: 0, tooth_number: '' as any }); }}
                        >
                          {t('UserQuotes.dialogs.editQuote.addItem')}
                        </Button>
                      )}
                    </div>
                    <div className="overflow-x-auto px-4 pb-4">
                      {isLoadingItems ? (
                        <div className="space-y-2 py-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground text-center border-b">
                              <th className="text-left font-semibold p-2">{t('UserQuotes.items.service')}</th>
                              <th className="font-semibold p-2 w-24">{t('UserQuotes.items.quantity')}</th>
                              <th className="font-semibold p-2 w-28">{t('UserQuotes.items.unitPrice')}</th>
                              <th className="font-semibold p-2 w-28">{t('UserQuotes.items.total')}</th>
                              {isSales && <th className="font-semibold p-2 w-24">{t('UserQuotes.items.toothNumber')}</th>}
                              <th className="p-2 w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {editItemFields.map((fieldItem, index) => (
                              <tr key={fieldItem.id} className="align-top border-b last:border-0">
                                <td className="p-1">
                                  <FormField control={quoteEditForm.control} name={`items.${index}.service_id`} render={({ field }) => (
                                    <FormItem>
                                      <ServiceSelector
                                        isSales={isSales}
                                        value={field.value}
                                        selectedServiceName={quoteEditForm.getValues(`items.${index}.service_name`) || undefined}
                                        onValueChange={(serviceId, service) => {
                                          field.onChange(serviceId);
                                          if (service) {
                                            const qty = quoteEditForm.getValues(`items.${index}.quantity`) || 1;
                                            updateEditItem(index, { ...quoteEditForm.getValues(`items.${index}`), service_id: serviceId, service_name: service.name, unit_price: Number(service.price), total: Number(service.price) * qty });
                                          }
                                        }}
                                        placeholder={t('QuotesPage.itemDialog.searchService')}
                                        noResultsText={t('QuotesPage.itemDialog.noServiceFound')}
                                        triggerText={t('QuotesPage.itemDialog.selectService')}
                                      />
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </td>
                                <td className="p-1">
                                  <FormField control={quoteEditForm.control} name={`items.${index}.quantity`} render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input type="number" step="1" min="1" {...field}
                                          onChange={e => {
                                            field.onChange(e);
                                            const qty = parseInt(e.target.value) || 0;
                                            const price = quoteEditForm.getValues(`items.${index}.unit_price`) || 0;
                                            quoteEditForm.setValue(`items.${index}.total`, qty * price, { shouldValidate: true, shouldDirty: true });
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </td>
                                <td className="p-1">
                                  <FormField control={quoteEditForm.control} name={`items.${index}.unit_price`} render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input type="number" step="0.01" min="0" {...field}
                                          onChange={e => {
                                            field.onChange(e);
                                            const price = parseFloat(e.target.value) || 0;
                                            const qty = quoteEditForm.getValues(`items.${index}.quantity`) || 0;
                                            quoteEditForm.setValue(`items.${index}.total`, qty * price, { shouldValidate: true, shouldDirty: true });
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </td>
                                <td className="p-1">
                                  <FormField control={quoteEditForm.control} name={`items.${index}.total`} render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          readOnly
                                          disabled
                                          value={new Intl.NumberFormat('en-US', { style: 'currency', currency: watchedEditCurrency || 'USD' }).format(Number(field.value) || 0)}
                                          className="bg-muted text-muted-foreground cursor-not-allowed"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )} />
                                </td>
                                {isSales && (
                                  <td className="p-1">
                                    <FormField control={quoteEditForm.control} name={`items.${index}.tooth_number`} render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={11}
                                            max={85}
                                            placeholder="—"
                                            {...field}
                                            value={field.value ?? ''}
                                            onChange={e => field.onChange(e.target.value === '' ? '' : parseInt(e.target.value))}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )} />
                                  </td>
                                )}
                                <td className="p-1 text-center">
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeEditItem(index)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {editItemFields.length === 0 && (
                              <tr><td colSpan={isSales ? 6 : 5} className="text-center text-muted-foreground text-xs py-4">{t('UserQuotes.dialogs.noItems')}</td></tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                    {editItemFields.length > 0 && (
                      <div className="flex justify-end px-4 pb-3">
                        <span className="text-sm font-semibold">
                          Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: watchedEditCurrency || 'USD' }).format(
                            editItemFields.reduce((sum, _, i) => sum + (Number(quoteEditForm.getValues(`items.${i}.total`)) || 0), 0)
                          )}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditQuoteOpen(false)}>{t('UserQuotes.dialogs.editQuote.cancel')}</Button>
                <Button type="submit" disabled={isSubmittingQuote}>
                  {isSubmittingQuote && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('UserQuotes.dialogs.editQuote.save')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Reject dialog (notes required for rejection only) ── */}
      <Dialog open={confirmAction === 'reject'} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t('UserQuotes.dialogs.confirmAction.rejectTitle')}</DialogTitle>
            <DialogDescription>
              {t('UserQuotes.dialogs.confirmAction.rejectDescription', { docNo: selectedQuote?.doc_no })}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-2">
            <label className="text-sm font-medium">{t('UserQuotes.dialogs.confirmAction.notesLabel')} <span className="text-muted-foreground">{t('UserQuotes.dialogs.confirmAction.optional')}</span></label>
            <Textarea rows={3} placeholder={t('UserQuotes.dialogs.confirmAction.notesPlaceholder')} value={actionNotes} onChange={e => setActionNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>{t('UserQuotes.dialogs.confirmAction.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={handleConfirmAction}
              disabled={isSubmittingAction}
            >
              {isSubmittingAction && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('UserQuotes.dialogs.confirmAction.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete quote dialog ── */}
      <Dialog open={isDeletingQuote} onOpenChange={setIsDeletingQuote}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('UserQuotes.dialogs.deleteQuote.title')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="px-6 py-4">
            <p className="text-sm text-muted-foreground">{t('UserQuotes.dialogs.deleteQuote.description', { docNo: selectedQuote?.doc_no })}</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeletingQuote(false)}>{t('UserQuotes.dialogs.deleteQuote.cancel')}</Button>
            <Button variant="destructive" onClick={handleDeleteQuote}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('UserQuotes.dialogs.deleteQuote.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Item create/edit dialog ── */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? t('UserQuotes.dialogs.itemDialog.editTitle') : t('UserQuotes.dialogs.itemDialog.title')}</DialogTitle>
            <DialogDescription>{t('UserQuotes.dialogs.itemDialog.description')}</DialogDescription>
          </DialogHeader>
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(handleSubmitItem)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault(); }}>
              <div className="px-6 py-4 space-y-4">
                <FormField control={itemForm.control} name="service_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('UserQuotes.dialogs.itemDialog.service')}</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      const svc = services.find(s => s.id === val);
                      if (svc && !editingItem) itemForm.setValue('unit_price', svc.price);
                    }} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t('UserQuotes.dialogs.itemDialog.selectService')} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={itemForm.control} name="quantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('UserQuotes.dialogs.itemDialog.quantity')}</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={itemForm.control} name="unit_price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('UserQuotes.dialogs.itemDialog.unitPrice')}</FormLabel>
                      <FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <ItemTotalField form={itemForm} />
                {isSales && (
                  <FormField control={itemForm.control} name="tooth_number" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('UserQuotes.dialogs.itemDialog.toothNumberOptional')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={99} placeholder="—" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)}>{t('UserQuotes.dialogs.itemDialog.cancel')}</Button>
                <Button type="submit" disabled={isSubmittingItem}>
                  {isSubmittingItem && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingItem ? t('UserQuotes.dialogs.itemDialog.save') : t('UserQuotes.dialogs.itemDialog.add')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete item dialog ── */}
      <Dialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('UserQuotes.dialogs.deleteItem.title')}</DialogTitle>
            <DialogDescription>{t('UserQuotes.dialogs.deleteItem.description', { itemName: deletingItem?.service_name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingItem(null)}>{t('UserQuotes.dialogs.deleteItem.cancel')}</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteItem}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('UserQuotes.dialogs.deleteItem.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Email Dialog ── */}
      <Dialog open={isSendEmailDialogOpen} onOpenChange={setIsSendEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tQuotes('sendEmailDialog.title')}</DialogTitle>
            <DialogDescription>
              {tQuotes('sendEmailDialog.description', { id: selectedQuoteForEmail?.id || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 px-6">
            <Label htmlFor="email-recipients">{tQuotes('sendEmailDialog.recipients')}</Label>
            <Input
              id="email-recipients"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder={tQuotes('sendEmailDialog.placeholder')}
            />
            <p className="text-sm text-muted-foreground mt-1">
              {tQuotes('sendEmailDialog.helperText')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)}>
              {tQuotes('sendEmailDialog.cancel')}
            </Button>
            <Button onClick={handleConfirmSendEmail} disabled={isSendingEmail}>
              {isSendingEmail ? tQuotes('sendEmailDialog.sending') : tQuotes('sendEmailDialog.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Warning Dialog ── */}
      <CommunicationWarningDialog
        open={isWarningDialogOpen}
        onOpenChange={setIsWarningDialogOpen}
        disabledItems={disabledEmails}
        onConfirm={handleWarningConfirm}
      />
    </>
  );
}
