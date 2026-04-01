'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { QuoteItemsTable } from '@/components/tables/quote-items-table';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Quote, QuoteItem, Service } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { getSalesServices } from '@/services/services';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle, ChevronDown, Eye, Loader2, Pencil, Printer, Send, Trash2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
  notes: z.string().optional(),
});
type QuoteEditFormValues = z.infer<typeof quoteEditSchema>;

// ── Columns ───────────────────────────────────────────────────────────────────
const getColumns = (t: (key: string) => string): ColumnDef<Quote>[] => [
  {
    id: 'select',
    header: () => null,
    cell: ({ row, table }) => {
      const isSelected = row.getIsSelected();
      return (
        <RadioGroup value={isSelected ? row.id : ''} onValueChange={() => { table.toggleAllPageRowsSelected(false); row.toggleSelected(true); }}>
          <RadioGroupItem value={row.id} id={row.id} aria-label="Select row" />
        </RadioGroup>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.quoteId')} />,
  },
  {
    accessorKey: 'total',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.total')} />,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('total'));
      return <div className="font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.round(amount * 100) / 100)}</div>;
    },
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
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
];

// ── Data fetching ─────────────────────────────────────────────────────────────
async function getQuotesForUser(userId: string): Promise<Quote[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_QUOTES, { user_id: userId });
    const raw = Array.isArray(data) ? data : (data.user_quotes || data.data || data.result || []);
    return raw.map((q: any) => ({
      id: q.id ? String(q.id) : `qt_${Math.random().toString(36).substr(2, 9)}`,
      doc_no: q.doc_no || 'N/A',
      user_id: q.user_id || 'N/A',
      total: q.total || 0,
      status: q.status || 'draft',
      payment_status: q.payment_status || 'unpaid',
      billing_status: q.billing_status || 'not invoiced',
      currency: q.currency || 'USD',
      exchange_rate: q.exchange_rate || 1,
      notes: q.notes || '',
      createdAt: q.createdAt || q.created_at || new Date().toISOString().split('T')[0],
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

// ── Component ─────────────────────────────────────────────────────────────────
interface UserQuotesProps {
  userId: string;
  onQuoteSelect?: (quote: Quote | null) => void;
}

export function UserQuotes({ userId, onQuoteSelect }: UserQuotesProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const [userQuotes, setUserQuotes] = React.useState<Quote[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Items
  const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);
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

  const columns = React.useMemo(() => getColumns(t), [t]);
  const isDraft = selectedQuote?.status?.toLowerCase() === 'draft';
  const canEditItems = ['draft', 'pending'].includes(selectedQuote?.status?.toLowerCase() || '');
  const canSend = ['draft', 'pending'].includes(selectedQuote?.status?.toLowerCase() || '');

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadQuotes = React.useCallback(async (silent = false) => {
    if (!userId) return;
    silent ? setIsRefreshing(true) : setIsLoading(true);
    const data = await getQuotesForUser(userId);
    setUserQuotes(data);
    silent ? setIsRefreshing(false) : setIsLoading(false);
  }, [userId]);

  const loadItems = React.useCallback(async (quoteId: string) => {
    setIsLoadingItems(true);
    try {
      const data = await api.get(API_ROUTES.SALES.QUOTES_ITEMS, { quote_id: quoteId });
      const raw = Array.isArray(data) ? data : (data.items || data.data || []);
      setQuoteItems(raw.map((i: any) => ({
        id: String(i.id),
        service_id: String(i.service_id),
        service_name: i.service_name || '',
        unit_price: parseFloat(i.unit_price) || 0,
        quantity: parseInt(i.quantity) || 1,
        total: parseFloat(i.total) || 0,
        tooth_number: i.tooth_number ?? undefined,
      })));
    } catch {
      setQuoteItems([]);
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

  React.useEffect(() => { loadQuotes(); }, [loadQuotes]);

  // ── Row selection ────────────────────────────────────────────────────────────
  const handleRowSelectionChange = React.useCallback((selectedRows: Quote[]) => {
    const quote = selectedRows[0] ?? null;
    setSelectedQuote(quote);
    if (!quote) {
      setIsSheetOpen(false);
      setQuoteItems([]);
    }
    onQuoteSelect?.(quote);
  }, [onQuoteSelect]);

  const handleOpenSheet = React.useCallback((quote: Quote) => {
    setIsSheetOpen(true);
    loadItems(quote.id);
    loadServices();
  }, [loadItems, loadServices]);

  // ── Record actions ──────────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (!selectedQuote) return;
    try {
      const blob = await api.getBlob(API_ROUTES.PURCHASES.QUOTES_PRINT, { quote_id: selectedQuote.id });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error al imprimir', variant: 'destructive' });
    }
  };

  const handleSend = async () => {
    if (!selectedQuote) return;
    try {
      await api.post(API_ROUTES.PURCHASES.QUOTES_SEND, { quote_id: selectedQuote.id, is_sales: true });
      toast({ title: 'Presupuesto enviado' });
      await loadQuotes(true);
    } catch {
      toast({ title: 'Error al enviar', variant: 'destructive' });
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedQuote || !confirmAction) return;
    setIsSubmittingAction(true);
    try {
      const route = confirmAction === 'confirm' ? API_ROUTES.SALES.QUOTE_CONFIRM : API_ROUTES.SALES.QUOTE_REJECT;
      const res = await api.post(route, { quote_number: selectedQuote.id, confirm_reject: confirmAction, is_sales: true, notes: actionNotes });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: confirmAction === 'confirm' ? 'Presupuesto confirmado' : 'Presupuesto rechazado' });
      setConfirmAction(null);
      setActionNotes('');
      await loadQuotes(true);
    } catch (e: any) {
      toast({ title: e?.message || 'Error al procesar la acción', variant: 'destructive' });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDeleteQuote = async () => {
    if (!selectedQuote) return;
    try {
      const res = await api.delete(API_ROUTES.SALES.QUOTE_DELETE, { id: selectedQuote.id, is_sales: true });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: 'Presupuesto eliminado' });
      setIsDeletingQuote(false);
      setIsSheetOpen(false);
      setRowSelection({});
      setSelectedQuote(null);
      onQuoteSelect?.(null);
      await loadQuotes(true);
    } catch (e: any) {
      toast({ title: e?.message || 'Error al eliminar', variant: 'destructive' });
    }
  };

  // ── Quote edit form ──────────────────────────────────────────────────────────
  const quoteEditForm = useForm<QuoteEditFormValues>({ resolver: zodResolver(quoteEditSchema) });

  React.useEffect(() => {
    if (!isEditQuoteOpen || !selectedQuote) return;
    quoteEditForm.reset({ currency: (selectedQuote.currency as 'USD' | 'UYU') ?? 'USD', notes: selectedQuote.notes ?? '' });
    // Ensure items are loaded for the upsert payload
    if (quoteItems.length === 0) loadItems(selectedQuote.id);
  }, [isEditQuoteOpen, selectedQuote, quoteEditForm]);

  const handleSubmitQuoteEdit = async (values: QuoteEditFormValues) => {
    if (!selectedQuote) return;
    setIsSubmittingQuote(true);
    try {
      // Load items if not already available
      let items = quoteItems;
      if (items.length === 0) {
        const data = await api.get(API_ROUTES.SALES.QUOTES_ITEMS, { quote_id: selectedQuote.id });
        const raw = Array.isArray(data) ? data : (data.items || data.data || []);
        items = raw.map((i: any) => ({
          id: String(i.id),
          service_id: String(i.service_id),
          service_name: i.service_name || '',
          unit_price: parseFloat(i.unit_price) || 0,
          quantity: parseInt(i.quantity) || 1,
          total: parseFloat(i.total) || 0,
          tooth_number: i.tooth_number ?? undefined,
        }));
      }
      const res = await api.post(API_ROUTES.SALES.QUOTES_UPSERT, {
        id: selectedQuote.id,
        user_id: selectedQuote.user_id,
        total: selectedQuote.total,
        status: selectedQuote.status,
        payment_status: selectedQuote.payment_status,
        billing_status: selectedQuote.billing_status,
        currency: values.currency,
        exchange_rate: selectedQuote.exchange_rate ?? 1,
        notes: values.notes || '',
        items: items.map(i => ({
          id: i.id,
          service_id: i.service_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total,
          tooth_number: i.tooth_number ?? null,
        })),
        is_sales: true,
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: 'Presupuesto actualizado' });
      setIsEditQuoteOpen(false);
      await loadQuotes(true);
    } catch (e: any) {
      toast({ title: e?.message || 'Error al actualizar', variant: 'destructive' });
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
      const res = await api.post(API_ROUTES.SALES.QUOTES_LINES_UPSERT, {
        ...(editingItem ? { id: editingItem.id } : {}),
        quote_id: selectedQuote.id,
        service_id: values.service_id,
        quantity: values.quantity,
        unit_price: values.unit_price,
        total: values.quantity * values.unit_price,
        tooth_number: values.tooth_number || null,
        is_sales: true,
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: editingItem ? 'Ítem actualizado' : 'Ítem agregado' });
      setIsItemDialogOpen(false);
      loadItems(selectedQuote.id);
    } catch (e: any) {
      toast({ title: e?.message || 'Error al guardar ítem', variant: 'destructive' });
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!deletingItem || !selectedQuote) return;
    try {
      const res = await api.delete(API_ROUTES.SALES.QUOTES_LINES_DELETE, { id: deletingItem.id, quote_id: selectedQuote.id, is_sales: true });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: 'Ítem eliminado' });
      setDeletingItem(null);
      loadItems(selectedQuote.id);
    } catch (e: any) {
      toast({ title: e?.message || 'Error al eliminar', variant: 'destructive' });
    }
  };

  // ── Toolbar actions ───────────────────────────────────────────────────────────
  const toolbarActions = selectedQuote ? (
    <div className="flex items-center gap-1.5">
      {isDraft && (
        <>
          <Button size="sm" className="h-8 gap-1.5 text-xs rounded-none bg-green-600 hover:bg-green-700 text-white border-0 shadow-none" onClick={() => { setConfirmAction('confirm'); setActionNotes(''); }}>
            <CheckCircle className="h-3.5 w-3.5" />
            Confirmar
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs rounded-none bg-red-600 hover:bg-red-700 text-white border-0 shadow-none" onClick={() => { setConfirmAction('reject'); setActionNotes(''); }}>
            <XCircle className="h-3.5 w-3.5" />
            Rechazar
          </Button>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="h-8 gap-1.5 text-xs rounded-none bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-none">
            Acciones
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </DropdownMenuItem>
          {isDraft && (
            <DropdownMenuItem onClick={() => setIsEditQuoteOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
          )}
          {canSend && (
            <DropdownMenuItem onClick={handleSend}>
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </DropdownMenuItem>
          )}
          {isDraft && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsDeletingQuote(true)} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-none" onClick={() => handleOpenSheet(selectedQuote)}>
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
              status: t('UserColumns.status'),
              payment_status: t('Navigation.Payments'),
              billing_status: t('QuoteColumns.billingStatus'),
              currency: t('QuoteColumns.currency'),
              exchange_rate: t('QuoteColumns.exchangeRate'),
            }}
          />
        </CardContent>
      </Card>

      {/* ── Detail Sheet ── */}
      <Sheet open={isSheetOpen} onOpenChange={(open) => {
        setIsSheetOpen(open);
        if (!open) { setRowSelection({}); setSelectedQuote(null); setQuoteItems([]); onQuoteSelect?.(null); }
      }}>
        <SheetContent side="right" className="sm:max-w-[640px] w-full flex flex-col p-0 gap-0">
          {selectedQuote && (
            <>
              <SheetHeader className="px-6 py-4 border-b">
                <div className="flex items-start justify-between gap-4 pr-10">
                  <div>
                    <SheetTitle className="text-lg">{selectedQuote.doc_no}</SheetTitle>
                    <SheetDescription>Presupuesto</SheetDescription>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <Badge variant={(STATUS_BADGE[selectedQuote.status.toLowerCase()] ?? 'default') as any} className="capitalize">
                      {t(`QuotesPage.quoteDialog.${selectedQuote.status.toLowerCase()}`)}
                    </Badge>
                    <Badge variant={(PAYMENT_BADGE[selectedQuote.payment_status.toLowerCase()] ?? 'outline') as any} className="capitalize">
                      {selectedQuote.payment_status}
                    </Badge>
                  </div>
                </div>
              </SheetHeader>

              {/* Meta info */}
              <div className="px-6 py-3 grid grid-cols-3 gap-x-6 gap-y-2 text-sm border-b">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Total</p>
                  <p className="font-semibold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedQuote.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Facturación</p>
                  <Badge variant={(BILLING_BADGE[selectedQuote.billing_status.toLowerCase()] ?? 'outline') as any} className="text-xs font-normal capitalize">
                    {selectedQuote.billing_status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Creado</p>
                  <p className="text-xs">{formatDateTime(selectedQuote.createdAt)}</p>
                </div>
                {selectedQuote.notes && (
                  <div className="col-span-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Notas</p>
                    <p className="text-xs">{selectedQuote.notes}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-b bg-muted/30">
                {isDraft && (
                  <Button size="sm" className="h-8 gap-1.5 text-xs rounded-none bg-green-600 hover:bg-green-700 text-white border-0 shadow-none" onClick={() => { setConfirmAction('confirm'); setActionNotes(''); }}>
                    <CheckCircle className="h-3.5 w-3.5" />
                    Confirmar
                  </Button>
                )}
                {isDraft && (
                  <Button size="sm" className="h-8 gap-1.5 text-xs rounded-none bg-red-600 hover:bg-red-700 text-white border-0 shadow-none" onClick={() => { setConfirmAction('reject'); setActionNotes(''); }}>
                    <XCircle className="h-3.5 w-3.5" />
                    Rechazar
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </Button>
                {isDraft && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsEditQuoteOpen(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                )}
                {canSend && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSend}>
                    <Send className="h-3.5 w-3.5" />
                    Enviar
                  </Button>
                )}
                {isDraft && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => setIsDeletingQuote(true)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                )}
              </div>

              {/* Items */}
              <div className="flex-1 flex flex-col overflow-hidden px-4 py-3">
                <p className="text-sm font-semibold mb-2">Ítems del presupuesto</p>
                <div className="flex-1 overflow-hidden">
                  <QuoteItemsTable
                    items={quoteItems}
                    isLoading={isLoadingItems}
                    canEdit={canEditItems}
                    onCreate={() => { setEditingItem(null); setIsItemDialogOpen(true); loadServices(); }}
                    onEdit={(item) => { setEditingItem(item); setIsItemDialogOpen(true); loadServices(); }}
                    onDelete={setDeletingItem}
                    onRefresh={() => loadItems(selectedQuote.id)}
                  />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Edit quote dialog ── */}
      <Dialog open={isEditQuoteOpen} onOpenChange={setIsEditQuoteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Editar presupuesto</DialogTitle>
            <DialogDescription>Modifica los datos del presupuesto {selectedQuote?.doc_no}.</DialogDescription>
          </DialogHeader>
          <Form {...quoteEditForm}>
            <form onSubmit={quoteEditForm.handleSubmit(handleSubmitQuoteEdit)}>
              <div className="px-6 py-4 space-y-4">
                <FormField control={quoteEditForm.control} name="currency" render={({ field }) => (
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
                <FormField control={quoteEditForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas <span className="text-muted-foreground">(opcional)</span></FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Observaciones..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditQuoteOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmittingQuote}>
                  {isSubmittingQuote && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Confirm / Reject dialog ── */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{confirmAction === 'confirm' ? 'Confirmar presupuesto' : 'Rechazar presupuesto'}</DialogTitle>
            <DialogDescription>
              {confirmAction === 'confirm'
                ? `¿Confirmar el presupuesto ${selectedQuote?.doc_no}?`
                : `¿Rechazar el presupuesto ${selectedQuote?.doc_no}? Esta acción no se puede deshacer.`}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-2">
            <label className="text-sm font-medium">Notas <span className="text-muted-foreground">(opcional)</span></label>
            <Textarea rows={3} placeholder="Agrega una observación..." value={actionNotes} onChange={e => setActionNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            <Button
              variant={confirmAction === 'reject' ? 'destructive' : 'default'}
              onClick={handleConfirmAction}
              disabled={isSubmittingAction}
            >
              {isSubmittingAction && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {confirmAction === 'confirm' ? 'Confirmar' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete quote dialog ── */}
      <Dialog open={isDeletingQuote} onOpenChange={setIsDeletingQuote}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Eliminar presupuesto</DialogTitle>
            <DialogDescription>¿Estás seguro de que deseas eliminar <strong>{selectedQuote?.doc_no}</strong>? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeletingQuote(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteQuote}>
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Item create/edit dialog ── */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar ítem' : 'Agregar ítem'}</DialogTitle>
            <DialogDescription>Completa los datos del ítem del presupuesto.</DialogDescription>
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
                <FormField control={itemForm.control} name="tooth_number" render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° de diente <span className="text-muted-foreground">(opcional)</span></FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={99} placeholder="—" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
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
