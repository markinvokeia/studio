'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CASHIER_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Credit, Invoice, PaymentMethod, Service, User } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { format } from 'date-fns';
import { AlertTriangle, ArrowRight, Box, CalendarIcon, Check, CreditCard, Edit3, FileUp, Loader2, MoreHorizontal, Printer, Receipt, Send, Trash2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Checkbox } from '../ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { DataTableAdvancedToolbar } from '../ui/data-table-advanced-toolbar';
import { DatePicker } from '../ui/date-picker';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DataTablePagination } from '../ui/data-table-pagination';

const paymentFormSchema = (t: (key: string) => string) => z.object({
  amount: z.coerce.number().min(0, t('validation.amountPositive')),
  method: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed']),
  payment_date: z.date({
    required_error: t('validation.dateRequired'),
  }),
  invoice_currency: z.string(),
  payment_currency: z.string(),
  exchange_rate: z.coerce.number().optional(),
}).refine(data => {
  if (data.amount > 0 && !data.method) {
    return false;
  }
  return true;
}, {
  message: 'Method is required when paying an amount.',
  path: ['method'],
}).refine(data => {
  if (data.invoice_currency !== data.payment_currency) {
    return data.exchange_rate && data.exchange_rate > 0;
  }
  return true;
}, {
  message: 'Exchange rate is required when currencies are different.',
  path: ['exchange_rate'],
});

type PaymentFormValues = z.infer<ReturnType<typeof paymentFormSchema>>;

const createInvoiceFormSchema = z.object({
  user_id: z.string().min(1, 'A user or provider is required.'),
  total: z.coerce.number().min(0, 'Total must be a non-negative number.'),
  currency: z.enum(['UYU', 'USD']),
  order_id: z.string().optional(),
  quote_id: z.string().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    service_id: z.string().min(1, 'Service name is required'),
    quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
    unit_price: z.coerce.number().min(0, 'Unit price cannot be negative'),
    total: z.coerce.number().optional(),
  })),
  type: z.enum(['invoice', 'credit_note']),
  parent_id: z.string().optional(),
});
type CreateInvoiceFormValues = z.infer<typeof createInvoiceFormSchema>;

const getColumns = (
  t: any,
  tStatus: any,
  columnTranslations: { [key: string]: string },
  onRowSelectionChange?: (selectedRows: Invoice[]) => void
): ColumnDef<Invoice>[] => {
  return [
    {
      id: 'select',
      header: () => null,
      cell: ({ row, table }) => (
        <RadioGroup
          value={row.getIsSelected() ? row.id : ''}
          onValueChange={() => {
            table.toggleAllPageRowsSelected(false);
            row.toggleSelected(true);
            if (onRowSelectionChange) {
              onRowSelectionChange([row.original]);
            }
          }}
        >
          <RadioGroupItem value={row.id} />
        </RadioGroup>
      ),
      size: 40,
    },
    {
      accessorKey: 'doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Doc. No" />
      ),
      cell: ({ row }) => {
        const value = row.getValue('doc_no') as string;
        return <div className="font-medium">{value || `INV-${row.original.id}`}</div>;
      },
    },
    {
      accessorKey: 'user_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={columnTranslations.user_name || "User"} />,
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={columnTranslations.total || "Total"} />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('total'));
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: row.original.currency || 'USD',
        }).format(amount);
        return <div className="text-right font-medium pr-4">{formatted}</div>;
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title={columnTranslations.status || "Status"} />,
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const variant = {
          paid: 'success',
          sent: 'default',
          draft: 'outline',
          overdue: 'destructive',
          booked: 'info'
        }[status?.toLowerCase()] ?? ('default' as any);
        return <Badge variant={variant} className="capitalize">{tStatus(status.toLowerCase())}</Badge>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={columnTranslations.createdAt || "Created At"} />
      ),
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
  ];
};

interface InvoicesTableProps {
  invoices: Invoice[];
  isLoading?: boolean;
  onRowSelectionChange?: (selectedRows: Invoice[]) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onPrint?: (invoice: Invoice) => void;
  onSendEmail?: (invoice: Invoice) => void;
  onCreate?: () => void;
  onImport?: () => void;
  onConfirm?: (invoice: Invoice) => void;
  rowSelection?: RowSelectionState;
  setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  columnTranslations?: { [key: string]: string };
  filterOptions?: { label: string; value: string }[];
  onFilterChange?: (value: string) => void;
  filterValue?: string;
  onEdit?: (invoice: Invoice) => void;
  isCompact?: boolean;
  isSales?: boolean;
  className?: string;
  title?: string;
  description?: string;
  standalone?: boolean;
  canCreate?: boolean;
}

export function InvoicesTable({ invoices, isLoading = false, onRowSelectionChange, onRefresh, onPrint, onSendEmail, onCreate, onImport, onConfirm, isRefreshing, rowSelection, setRowSelection, columnTranslations = {}, filterOptions, onFilterChange, filterValue, onEdit, isSales = true, isCompact = false, className, title, description, standalone = false, canCreate = true }: InvoicesTableProps) {
  const t = useTranslations('InvoicesPage');
  const tStatus = useTranslations('InvoicesPage.status');
  const { user, checkActiveSession } = useAuth();
  const locale = useLocale();

  const { toast } = useToast();
  const { validateActiveSession, showCashSessionError } = useCashSessionValidation();
  const { hasPermission } = usePermissions();
  const canAccessCashier = hasPermission(CASHIER_PERMISSIONS.VIEW_MENU);
  const [isFormDialogOpen, setIsFormDialogOpen] = React.useState(false);
  const [editingInvoice, setEditingInvoice] = React.useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [isNoSessionAlertOpen, setIsNoSessionAlertOpen] = React.useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = React.useState(false);
  const [confirmingInvoice, setConfirmingInvoice] = React.useState<Invoice | null>(null);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = React.useState<Invoice | null>(null);
  const [activeCashSessionId, setActiveCashSessionId] = React.useState<string | null>(null);
  const [paymentSubmissionError, setPaymentSubmissionError] = React.useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [userCredits, setUserCredits] = React.useState<Credit[]>([]);
  const [appliedCredits, setAppliedCredits] = React.useState<Map<string, number>>(new Map());
  const [companyCurrency, setCompanyCurrency] = React.useState<string>('USD');
  const [sessionExchangeRate, setSessionExchangeRate] = React.useState<number>(1);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema(t)),
    defaultValues: {
      status: 'completed',
    }
  });

  const columns = React.useMemo(() => getColumns(
    t,
    tStatus,
    columnTranslations,
    onRowSelectionChange
  ), [t, tStatus, columnTranslations, onRowSelectionChange]);

  const table = useReactTable({
    data: invoices,
    columns,
    state: {
      rowSelection: rowSelection ?? {},
    },
    enableRowSelection: true,
    enableMultiRowSelection: false,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedInvoice = React.useMemo(() => {
    const rows = table.getFilteredSelectedRowModel().rows;
    return rows.length > 0 ? rows[0].original : null;
  }, [rowSelection, invoices]);

  const handleAddPaymentClick = React.useCallback(async (invoice: Invoice) => {
    if (!user) return;
    try {
      const sessionValidation = await validateActiveSession();
      if (!sessionValidation.isValid) {
        setIsNoSessionAlertOpen(true);
        return;
      }
      const clinicData = await api.get(API_ROUTES.CLINIC);
      if (sessionValidation.exchangeRate) setSessionExchangeRate(sessionValidation.exchangeRate);
      setSelectedInvoiceForPayment(invoice);
      setActiveCashSessionId(sessionValidation.sessionId!);
      const currency = clinicData.currency || 'USD';
      setCompanyCurrency(currency);
      const invoiceCurrency = invoice.currency || 'USD';
      const initialExchangeRate = invoiceCurrency === currency ? 1 : (sessionValidation.exchangeRate || 1);
      form.reset({
        amount: invoice.total - (invoice.paid_amount || 0),
        method: '',
        status: 'completed',
        payment_date: new Date(),
        invoice_currency: invoiceCurrency,
        payment_currency: invoiceCurrency,
        exchange_rate: initialExchangeRate,
      });
      setPaymentSubmissionError(null);
      setAppliedCredits(new Map());
      setIsPaymentDialogOpen(true);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: t('toast.sessionCheckError') });
    }
  }, [user, validateActiveSession, form, toast, t]);

  const handlePaymentSubmit = async (values: PaymentFormValues) => {
    if (!selectedInvoiceForPayment || !activeCashSessionId) return;
    try {
      const payload = {
        invoice_id: selectedInvoiceForPayment.id,
        cash_session_id: activeCashSessionId,
        user: user,
        query: JSON.stringify({ ...values, is_sales: isSales }),
      };
      await api.post(isSales ? API_ROUTES.SALES.INVOICE_PAYMENT : API_ROUTES.PURCHASES.INVOICE_PAYMENT, payload);
      toast({ title: t('paymentDialog.success') });
      if (onRefresh) onRefresh();
      setIsPaymentDialogOpen(false);
    } catch (error) {
      setPaymentSubmissionError(error instanceof Error ? error.message : 'Error');
    }
  };

  const handleConfirmInvoiceInternal = async (invoice: Invoice) => {
    try {
      await api.post(isSales ? API_ROUTES.SALES.INVOICES_CONFIRM : API_ROUTES.PURCHASES.INVOICES_CONFIRM, { id: parseInt(invoice.id, 10) });
      toast({ title: 'Invoice Confirmed' });
      setIsConfirmDialogOpen(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Error' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <>
      <InvoiceFormDialog
        isOpen={isFormDialogOpen}
        onOpenChange={(open) => {
          setIsFormDialogOpen(open);
          if (!open) setEditingInvoice(null);
        }}
        onInvoiceCreated={onRefresh || (() => { })}
        isSales={isSales}
        invoice={editingInvoice}
      />
      <Card className={cn("h-full flex-1 flex flex-col min-h-0 rounded-t-none shadow-none border-t-0", className)}>
        {title && (
          <CardHeader className="flex-none p-4">
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <Receipt className="h-5 w-5" />
              </div>
              <div className="flex flex-col text-left">
                <CardTitle className="text-lg">{title}</CardTitle>
                {description && <CardDescription className="text-xs">{description}</CardDescription>}
              </div>
            </div>
          </CardHeader>
        )}
        <CardContent className="flex-1 flex flex-col min-h-0 p-4 overflow-hidden bg-card">
          <DataTableAdvancedToolbar
            table={table}
            isCompact={isCompact}
            filterPlaceholder={t('filterPlaceholder')}
            searchQuery={(table.getState().columnFilters.find((f: any) => f.id === 'doc_no')?.value as string) || ''}
            onSearchChange={(value) => {
              table.setColumnFilters((prev: any) => {
                const newFilters = prev.filter((f: any) => f.id !== 'doc_no');
                if (value) {
                  newFilters.push({ id: 'doc_no', value });
                }
                return newFilters;
              });
            }}
            onCreate={canCreate ? () => { setEditingInvoice(null); setIsFormDialogOpen(true); } : undefined}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            extraButtons={selectedInvoice && (
              <div className="flex items-center gap-1 mr-2 px-2 border-r">
                {selectedInvoice.status.toLowerCase() === 'booked' && selectedInvoice.payment_status?.toLowerCase() !== 'paid' && (
                  <Button variant="ghost" size="sm" onClick={() => handleAddPaymentClick(selectedInvoice)} className="h-8 px-2 gap-1 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10">
                    <CreditCard className="h-3.5 w-3.5" />
                    {t('paymentDialog.add')}
                  </Button>
                )}
                {selectedInvoice.status.toLowerCase() === 'draft' && (
                  <Button variant="ghost" size="sm" onClick={() => { setConfirmingInvoice(selectedInvoice); setIsConfirmDialogOpen(true); }} className="h-8 px-2 gap-1 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10">
                    <Check className="h-3.5 w-3.5" />
                    {t('confirmInvoice')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onPrint?.(selectedInvoice)} className="h-8 px-2 gap-1 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10">
                  <Printer className="h-3.5 w-3.5" />
                  {t('actions.print')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onSendEmail?.(selectedInvoice)} className="h-8 px-2 gap-1 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10">
                  <Send className="h-3.5 w-3.5" />
                  {t('actions.sendEmail')}
                </Button>
              </div>
            )}
          />
          <div className="rounded-md border overflow-auto flex-1 min-h-0 relative">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow 
                      key={row.id} 
                      data-state={row.getIsSelected() && 'selected'} 
                      className="cursor-pointer"
                      onClick={() => {
                        table.toggleAllPageRowsSelected(false);
                        row.toggleSelected(true);
                        if (onRowSelectionChange) {
                          onRowSelectionChange([row.original]);
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No results.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} />
        </CardContent>
      </Card>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('paymentDialog.title')}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePaymentSubmit)} className="space-y-4 py-4 px-6">
              {paymentSubmissionError && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{paymentSubmissionError}</AlertDescription></Alert>}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel>{t('paymentDialog.amount')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="method" render={({ field }) => (
                  <FormItem><FormLabel>{t('paymentDialog.method')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter><Button type="submit">Save Payment</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmInvoiceDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmInvoiceDialog.description', { id: confirmingInvoice?.id })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmingInvoice && handleConfirmInvoiceInternal(confirmingInvoice)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface InvoiceFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onInvoiceCreated: () => void;
  isSales: boolean;
  invoice?: Invoice | null;
}

export function InvoiceFormDialog({ isOpen, onOpenChange, onInvoiceCreated, isSales, invoice }: InvoiceFormDialogProps) {
  const t = useTranslations('InvoicesPage.createDialog');
  const form = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceFormSchema),
    defaultValues: { type: 'invoice', user_id: '', currency: 'UYU', items: [], total: 0 },
  });

  const onSubmit = async (values: CreateInvoiceFormValues) => {
    try {
      const endpoint = isSales ? API_ROUTES.SALES.INVOICES_UPSERT : API_ROUTES.PURCHASES.INVOICES_UPSERT;
      await api.post(endpoint, { ...values, is_sales: isSales });
      onInvoiceCreated();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>{invoice ? 'Edit Invoice' : t('title')}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 px-6">
            <DialogFooter><Button type="submit">Save</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
