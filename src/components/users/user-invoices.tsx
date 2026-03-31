
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { API_ROUTES } from '@/constants/routes';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { useToast } from '@/hooks/use-toast';
import { Invoice, InvoiceItem, PaymentMethod, Service } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { getSalesServices } from '@/services/services';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, CheckCircle, ChevronDown, CreditCard, Eye, Loader2, Pencil, Printer, Send, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';

// ── Schemas ───────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  service_id: z.string().min(1, 'Selecciona un servicio'),
  quantity: z.coerce.number().min(1, 'Mínimo 1'),
  unit_price: z.coerce.number().min(0, 'Precio inválido'),
});
type ItemFormValues = z.infer<typeof itemSchema>;

const invoiceEditSchema = z.object({
  currency: z.enum(['USD', 'UYU']),
  notes: z.string().optional(),
});
type InvoiceEditFormValues = z.infer<typeof invoiceEditSchema>;

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Monto requerido'),
  payment_method_id: z.string().min(1, 'Selecciona un método de pago'),
  payment_date: z.string().min(1, 'Fecha requerida'),
  notes: z.string().optional(),
  is_historical: z.boolean().optional(),
});
type PaymentFormValues = z.infer<typeof paymentSchema>;

// ── Item total display ────────────────────────────────────────────────────────
function ItemTotalField({ form }: { form: ReturnType<typeof useForm<ItemFormValues>> }) {
  const quantity = useWatch({ control: form.control, name: 'quantity' }) ?? 0;
  const unitPrice = useWatch({ control: form.control, name: 'unit_price' }) ?? 0;
  const total = Number(quantity) * Number(unitPrice);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">Total</label>
      <Input
        value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
        readOnly
        disabled
        className="bg-muted text-muted-foreground cursor-not-allowed"
      />
    </div>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, any> = { paid: 'success', booked: 'success', sent: 'default', draft: 'outline', overdue: 'destructive' };
const PAYMENT_BADGE: Record<string, any> = { paid: 'success', partial: 'info', partially_paid: 'info', unpaid: 'outline' };

// ── Columns ───────────────────────────────────────────────────────────────────
const getColumns = (t: (key: string) => string, tStatus: (key: string) => string): ColumnDef<Invoice>[] => [
  {
    accessorKey: 'doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.docNo')} />,
    cell: ({ row }) => <div className="font-medium">{row.getValue('doc_no') || `INV-${row.original.id}`}</div>,
  },
  {
    accessorKey: 'order_doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.orderDocNo')} />,
    cell: ({ row }) => {
      const v = row.getValue('order_doc_no') as string;
      return <div className="font-medium">{v || (row.original.order_id ? `ORD-${row.original.order_id}` : '-')}</div>;
    },
  },
  {
    accessorKey: 'total',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.total')} />,
    cell: ({ row }) => (
      <div className="font-medium">
        {new Intl.NumberFormat('en-US', { style: 'currency', currency: row.original.currency || 'USD' }).format(parseFloat(row.getValue('total')))}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.status')} />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      return <Badge variant={(STATUS_BADGE[status?.toLowerCase()] ?? 'default') as any} className="capitalize">{tStatus(status.toLowerCase())}</Badge>;
    },
  },
  {
    accessorKey: 'payment_status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.payment')} />,
    cell: ({ row }) => {
      const status = row.original.payment_status;
      return <Badge variant={(PAYMENT_BADGE[status?.toLowerCase()] ?? 'default') as any} className="capitalize">{status ? tStatus(status.toLowerCase()) : ''}</Badge>;
    },
  },
  {
    accessorKey: 'due_date',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.dueDate')} />,
    cell: ({ row }) => {
      const dueDate = row.original.due_date;
      return <div className="font-medium">{dueDate ? formatDateTime(dueDate) : '-'}</div>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.createdAt')} />,
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
];

// ── Data fetching ─────────────────────────────────────────────────────────────
async function getInvoicesForUser(userId: string): Promise<Invoice[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_INVOICES, { user_id: userId });
    const invoicesData = Array.isArray(data) ? data : (data.invoices || data.data || []);
    return invoicesData.map((d: any) => ({
      id: d.id.toString(),
      invoice_ref: d.invoice_ref || 'N/A',
      doc_no: d.doc_no || null,
      order_id: d.order_id?.toString() ?? 'N/A',
      order_doc_no: d.order_doc_no || 'N/A',
      quote_id: d.quote_id?.toString() ?? 'N/A',
      user_id: d.user_id?.toString() ?? userId,
      user_name: d.user_name || '',
      type: d.type || 'invoice',
      total: parseFloat(d.total),
      status: d.status,
      payment_status: d.payment_state || d.payment_status,
      notes: d.notes || '',
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      currency: d.currency || 'USD',
      is_historical: d.is_historical || false,
      due_date: d.due_date || null,
    }));
  } catch (error) {
    console.error('Failed to fetch user invoices:', error);
    return [];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
interface UserInvoicesProps {
  userId: string;
}

export function UserInvoices({ userId }: UserInvoicesProps) {
  const t = useTranslations();
  const tStatus = useTranslations('InvoicesPage.status');
  const { toast } = useToast();
  const { validateActiveSession, showCashSessionError } = useCashSessionValidation();
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Items
  const [invoiceItems, setInvoiceItems] = React.useState<InvoiceItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = React.useState(false);
  const [services, setServices] = React.useState<Service[]>([]);

  // Item dialogs
  const [isItemDialogOpen, setIsItemDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<InvoiceItem | null>(null);
  const [deletingItem, setDeletingItem] = React.useState<InvoiceItem | null>(null);
  const [isSubmittingItem, setIsSubmittingItem] = React.useState(false);

  // Record-level dialogs
  const [isEditInvoiceOpen, setIsEditInvoiceOpen] = React.useState(false);
  const [isSubmittingInvoice, setIsSubmittingInvoice] = React.useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = React.useState(false);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);

  const columns = React.useMemo(() => getColumns(t, tStatus), [t, tStatus]);
  const isDraft = selectedInvoice?.status?.toLowerCase() === 'draft';
  const isBookedUnpaid = selectedInvoice?.status?.toLowerCase() === 'booked'
    && !['paid'].includes(selectedInvoice?.payment_status?.toLowerCase() || '');
  const canEditItems = isDraft;

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadInvoices = React.useCallback(async (silent = false) => {
    if (!userId) return;
    silent ? setIsRefreshing(true) : setIsLoading(true);
    const data = await getInvoicesForUser(userId);
    setInvoices(data);
    silent ? setIsRefreshing(false) : setIsLoading(false);
  }, [userId]);

  const loadItems = React.useCallback(async (invoiceId: string) => {
    setIsLoadingItems(true);
    try {
      const data = await api.get(API_ROUTES.SALES.INVOICE_ITEMS, { invoice_id: invoiceId, is_sales: 'true' });
      const raw = Array.isArray(data) ? data : (data.items || data.data || []);
      setInvoiceItems(raw.map((i: any) => ({
        id: String(i.id),
        service_id: String(i.service_id),
        service_name: i.service_name || '',
        unit_price: parseFloat(i.unit_price) || 0,
        quantity: parseInt(i.quantity) || 1,
        total: parseFloat(i.total) || 0,
      })));
    } catch {
      setInvoiceItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  const loadServices = React.useCallback(async () => {
    if (services.length > 0) return;
    try {
      const data = await getSalesServices({ limit: 500 });
      setServices(data.items || []);
    } catch { /* silent */ }
  }, [services.length]);

  const loadPaymentMethods = React.useCallback(async () => {
    if (paymentMethods.length > 0) return;
    try {
      const data = await api.get(API_ROUTES.PAYMENT_METHODS);
      const raw = Array.isArray(data) ? data : (data.payment_methods || data.data || []);
      setPaymentMethods(raw.map((m: any) => ({ id: String(m.id), name: m.name, code: m.code, is_cash_equivalent: m.is_cash_equivalent, is_active: m.is_active })));
    } catch { /* silent */ }
  }, [paymentMethods.length]);

  React.useEffect(() => { loadInvoices(); }, [loadInvoices]);

  // ── Row selection ────────────────────────────────────────────────────────────
  const handleRowSelectionChange = React.useCallback((selectedRows: Invoice[]) => {
    const invoice = selectedRows[0] ?? null;
    setSelectedInvoice(invoice);
    if (!invoice) { setIsSheetOpen(false); setInvoiceItems([]); }
  }, []);

  const handleOpenSheet = React.useCallback((invoice: Invoice) => {
    setIsSheetOpen(true);
    loadItems(invoice.id);
  }, [loadItems]);

  // ── Record actions ──────────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (!selectedInvoice) return;
    try {
      const blob = await api.getBlob(API_ROUTES.SALES.API_INVOICE_PRINT, { id: selectedInvoice.id });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error al imprimir', variant: 'destructive' });
    }
  };

  const handleSend = async () => {
    if (!selectedInvoice) return;
    try {
      await api.post(API_ROUTES.SALES.API_INVOICE_SEND, { invoiceId: selectedInvoice.id });
      toast({ title: 'Factura enviada' });
      await loadInvoices(true);
    } catch {
      toast({ title: 'Error al enviar', variant: 'destructive' });
    }
  };

  const handleConfirm = async () => {
    if (!selectedInvoice) return;
    try {
      await api.post(API_ROUTES.SALES.INVOICES_CONFIRM, { id: parseInt(selectedInvoice.id, 10) });
      toast({ title: 'Factura confirmada' });
      await loadInvoices(true);
    } catch {
      toast({ title: 'Error al confirmar', variant: 'destructive' });
    }
  };

  // ── Edit invoice form ─────────────────────────────────────────────────────────
  const invoiceEditForm = useForm<InvoiceEditFormValues>({ resolver: zodResolver(invoiceEditSchema) });

  React.useEffect(() => {
    if (!isEditInvoiceOpen || !selectedInvoice) return;
    invoiceEditForm.reset({ currency: (selectedInvoice.currency as 'USD' | 'UYU') ?? 'USD', notes: selectedInvoice.notes ?? '' });
    if (invoiceItems.length === 0) loadItems(selectedInvoice.id);
  }, [isEditInvoiceOpen, selectedInvoice, invoiceEditForm]);

  const handleSubmitInvoiceEdit = async (values: InvoiceEditFormValues) => {
    if (!selectedInvoice) return;
    setIsSubmittingInvoice(true);
    try {
      let items = invoiceItems;
      if (items.length === 0) {
        const data = await api.get(API_ROUTES.SALES.INVOICE_ITEMS, { invoice_id: selectedInvoice.id, is_sales: 'true' });
        const raw = Array.isArray(data) ? data : (data.items || data.data || []);
        items = raw.map((i: any) => ({
          id: String(i.id), service_id: String(i.service_id), service_name: i.service_name || '',
          unit_price: parseFloat(i.unit_price) || 0, quantity: parseInt(i.quantity) || 1, total: parseFloat(i.total) || 0,
        }));
      }
      await api.post(API_ROUTES.SALES.INVOICES_UPSERT, {
        id: selectedInvoice.id,
        user_id: selectedInvoice.user_id,
        type: selectedInvoice.type || 'invoice',
        currency: values.currency,
        total: selectedInvoice.total,
        order_id: selectedInvoice.order_id !== 'N/A' ? selectedInvoice.order_id : undefined,
        quote_id: selectedInvoice.quote_id !== 'N/A' ? selectedInvoice.quote_id : undefined,
        notes: values.notes || '',
        is_sales: true,
        items: items.map(i => ({ id: i.id, service_id: i.service_id, quantity: i.quantity, unit_price: i.unit_price, total: i.total })),
      });
      toast({ title: 'Factura actualizada' });
      setIsEditInvoiceOpen(false);
      await loadInvoices(true);
    } catch (e: any) {
      toast({ title: e?.message || 'Error al actualizar', variant: 'destructive' });
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  // ── Payment form ──────────────────────────────────────────────────────────────
  const paymentForm = useForm<PaymentFormValues>({ resolver: zodResolver(paymentSchema) });

  React.useEffect(() => {
    if (!isPaymentDialogOpen || !selectedInvoice) return;
    paymentForm.reset({ 
      amount: selectedInvoice.total, 
      payment_method_id: '', 
      payment_date: new Date().toISOString().split('T')[0], 
      notes: '',
      is_historical: selectedInvoice.is_historical || false 
    });
    loadPaymentMethods();
  }, [isPaymentDialogOpen, selectedInvoice, paymentForm]);

  const handleSubmitPayment = async (values: PaymentFormValues) => {
    if (!selectedInvoice) return;

    let cashSessionId: string | null = null;

    // Validate cash session only for non-historical payments
    if (!values.is_historical) {
      const { isValid, sessionId, error } = await validateActiveSession();
      if (!isValid) {
        showCashSessionError(error);
        return;
      }
      cashSessionId = sessionId || null;
    }

    setIsSubmittingPayment(true);
    try {
      const method = paymentMethods.find(m => m.id === values.payment_method_id);
      const paymentDate = new Date(values.payment_date).toISOString();
      await api.post(API_ROUTES.SALES.INVOICE_PAYMENT, {
        cash_session_id: cashSessionId,
        credit_payment: [],
        client_user: { id: userId, name: '', email: '' },
        query: {
          invoice_id: parseInt(selectedInvoice.id, 10),
          payment_date: paymentDate,
          amount: values.amount,
          converted_amount: values.amount,
          method: method?.name || '',
          payment_method_id: values.payment_method_id,
          status: 'completed',
          user_id: userId,
          invoice_currency: selectedInvoice.currency || 'USD',
          payment_currency: selectedInvoice.currency || 'USD',
          exchange_rate: 1,
          is_sales: true,
          total_paid: values.amount,
          notes: values.notes || '',
          is_historical: values.is_historical || false,
        },
      });
      toast({ title: 'Pago registrado' });
      setIsPaymentDialogOpen(false);
      await loadInvoices(true);
    } catch (e: any) {
      toast({ title: e?.message || 'Error al registrar el pago', variant: 'destructive' });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // ── Item form ────────────────────────────────────────────────────────────────
  const itemForm = useForm<ItemFormValues>({ resolver: zodResolver(itemSchema) });

  React.useEffect(() => {
    if (!isItemDialogOpen) return;
    editingItem
      ? itemForm.reset({ service_id: editingItem.service_id, quantity: editingItem.quantity, unit_price: editingItem.unit_price })
      : itemForm.reset({ service_id: '', quantity: 1, unit_price: 0 });
  }, [isItemDialogOpen, editingItem, itemForm]);

  const handleSubmitItem = async (values: ItemFormValues) => {
    if (!selectedInvoice) return;
    setIsSubmittingItem(true);
    try {
      await api.post(API_ROUTES.SALES.INVOICES_ITEMS_UPSERT, {
        ...(editingItem ? { id: parseInt(editingItem.id, 10) } : {}),
        invoice_id: parseInt(selectedInvoice.id, 10),
        service_id: parseInt(values.service_id, 10),
        quantity: values.quantity,
        unit_price: values.unit_price,
        total: values.quantity * values.unit_price,
        is_sales: true,
      });
      toast({ title: editingItem ? 'Ítem actualizado' : 'Ítem agregado' });
      setIsItemDialogOpen(false);
      loadItems(selectedInvoice.id);
    } catch {
      toast({ title: 'Error al guardar ítem', variant: 'destructive' });
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!deletingItem) return;
    try {
      await api.post(API_ROUTES.SALES.INVOICES_ITEMS_DELETE, { id: parseInt(deletingItem.id, 10) });
      toast({ title: 'Ítem eliminado' });
      setDeletingItem(null);
      if (selectedInvoice) loadItems(selectedInvoice.id);
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    }
  };

  // ── Toolbar actions ───────────────────────────────────────────────────────────
  const toolbarActions = selectedInvoice ? (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            Acciones
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSend}>
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </DropdownMenuItem>
          {isDraft && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsEditInvoiceOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleConfirm} className="text-green-600 focus:text-green-600">
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar
              </DropdownMenuItem>
            </>
          )}
          {isBookedUnpaid && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsPaymentDialogOpen(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Agregar pago
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleOpenSheet(selectedInvoice)}>
        <Eye className="h-3.5 w-3.5" />
        Ver detalles
      </Button>
    </div>
  ) : null;

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
            data={invoices}
            filterColumnId="doc_no"
            filterPlaceholder={t('InvoicesPage.filterPlaceholder')}
            onRowSelectionChange={handleRowSelectionChange}
            enableSingleRowSelection
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            onRefresh={() => loadInvoices(true)}
            isRefreshing={isRefreshing}
            extraButtons={toolbarActions}
            columnTranslations={{
              doc_no: t('InvoicesPage.columns.docNo'),
              order_doc_no: t('InvoicesPage.columns.orderDocNo'),
              total: t('InvoicesPage.columns.total'),
              status: t('InvoicesPage.columns.status'),
              payment_status: t('InvoicesPage.columns.payment'),
              due_date: t('InvoicesPage.columns.dueDate'),
              createdAt: t('InvoicesPage.columns.createdAt'),
            }}
          />
        </CardContent>
      </Card>

      {/* ── Detail Sheet ── */}
      <Sheet open={isSheetOpen} onOpenChange={(open) => {
        setIsSheetOpen(open);
        if (!open) { setRowSelection({}); setSelectedInvoice(null); setInvoiceItems([]); }
      }}>
        <SheetContent side="right" className="sm:max-w-[640px] w-full flex flex-col p-0 gap-0">
          {selectedInvoice && (
            <>
              <SheetHeader className="px-6 py-4 border-b">
                <div className="flex items-start justify-between gap-4 pr-10">
                  <div>
                    <SheetTitle className="text-lg">{selectedInvoice.doc_no || `INV-${selectedInvoice.id}`}</SheetTitle>
                    <SheetDescription>Factura</SheetDescription>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <Badge variant={(STATUS_BADGE[selectedInvoice.status?.toLowerCase()] ?? 'default') as any} className="capitalize">
                      {tStatus(selectedInvoice.status?.toLowerCase() || '')}
                    </Badge>
                    {selectedInvoice.payment_status && (
                      <Badge variant={(PAYMENT_BADGE[selectedInvoice.payment_status?.toLowerCase()] ?? 'outline') as any} className="capitalize">
                        {selectedInvoice.payment_status}
                      </Badge>
                    )}
                  </div>
                </div>
              </SheetHeader>

              {/* Meta info */}
              <div className="px-6 py-3 grid grid-cols-3 gap-x-6 gap-y-2 text-sm border-b">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Total</p>
                  <p className="font-semibold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedInvoice.currency || 'USD' }).format(selectedInvoice.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Orden</p>
                  <p className="text-xs font-medium">{selectedInvoice.order_doc_no !== 'N/A' ? selectedInvoice.order_doc_no : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Creado</p>
                  <p className="text-xs">{formatDateTime(selectedInvoice.createdAt)}</p>
                </div>
                {selectedInvoice.notes && (
                  <div className="col-span-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Notas</p>
                    <p className="text-xs">{selectedInvoice.notes}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-b bg-muted/30">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSend}>
                  <Send className="h-3.5 w-3.5" />
                  Enviar
                </Button>
                {isDraft && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsEditInvoiceOpen(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                )}
                {isDraft && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-green-600 hover:text-green-600" onClick={handleConfirm}>
                    <CheckCircle className="h-3.5 w-3.5" />
                    Confirmar
                  </Button>
                )}
                {isBookedUnpaid && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsPaymentDialogOpen(true)}>
                    <CreditCard className="h-3.5 w-3.5" />
                    Agregar pago
                  </Button>
                )}
              </div>

              {/* Items */}
              <div className="flex-1 flex flex-col overflow-hidden px-4 py-3">
                <p className="text-sm font-semibold mb-2">Ítems de la factura</p>
                <div className="flex-1 overflow-hidden">
                  <InvoiceItemsTable
                    items={invoiceItems}
                    isLoading={isLoadingItems}
                    canEdit={canEditItems}
                    onEdit={(item) => { setEditingItem(item); setIsItemDialogOpen(true); loadServices(); }}
                    onDelete={setDeletingItem}
                  />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Edit invoice dialog ── */}
      <Dialog open={isEditInvoiceOpen} onOpenChange={setIsEditInvoiceOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Editar factura</DialogTitle>
            <DialogDescription>Modifica los datos de la factura {selectedInvoice?.doc_no}.</DialogDescription>
          </DialogHeader>
          <Form {...invoiceEditForm}>
            <form onSubmit={invoiceEditForm.handleSubmit(handleSubmitInvoiceEdit)}>
              <div className="px-6 py-4 space-y-4">
                <FormField control={invoiceEditForm.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
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
                <FormField control={invoiceEditForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas <span className="text-muted-foreground">(opcional)</span></FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Observaciones..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditInvoiceOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmittingInvoice}>
                  {isSubmittingInvoice && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Add payment dialog ── */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Agregar pago</DialogTitle>
            <DialogDescription>Registra un pago para la factura {selectedInvoice?.doc_no}.</DialogDescription>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handleSubmitPayment)}>
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={paymentForm.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto</FormLabel>
                      <FormControl><Input type="number" min={0.01} step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={paymentForm.control} name="payment_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={paymentForm.control} name="payment_method_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método de pago</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar método" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {paymentMethods.filter(m => m.is_active).map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={paymentForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas <span className="text-muted-foreground">(opcional)</span></FormLabel>
                    <FormControl><Textarea rows={2} placeholder="Observaciones..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField
                  control={paymentForm.control}
                  name="is_historical"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('InvoicesPage.paymentDialog.isHistorical')}</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                {paymentForm.watch('is_historical') && (
                  <Alert variant="warning" className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">{t('InvoicesPage.paymentDialog.isHistorical')}</AlertTitle>
                    <AlertDescription className="text-amber-700">
                      {t('InvoicesPage.paymentDialog.isHistoricalDescription')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmittingPayment}>
                  {isSubmittingPayment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Registrar pago
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Item create/edit dialog ── */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar ítem' : 'Agregar ítem'}</DialogTitle>
            <DialogDescription>Completa los datos del ítem de la factura.</DialogDescription>
          </DialogHeader>
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(handleSubmitItem)}>
              <div className="px-6 py-4 space-y-4">
                <FormField control={itemForm.control} name="service_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Servicio</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      const svc = services.find(s => s.id === val);
                      if (svc && !editingItem) itemForm.setValue('unit_price', svc.price);
                    }} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger></FormControl>
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
                      <FormLabel>Cantidad</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={itemForm.control} name="unit_price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio unitario</FormLabel>
                      <FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <ItemTotalField form={itemForm} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmittingItem}>
                  {isSubmittingItem && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingItem ? 'Guardar cambios' : 'Agregar'}
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
            <DialogTitle>Eliminar ítem</DialogTitle>
            <DialogDescription>¿Estás seguro de que deseas eliminar <strong>{deletingItem?.service_name}</strong>? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingItem(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteItem}>
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
