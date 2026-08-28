
'use client';

import { useBillingWizard } from '@/stores/billing-wizard-store';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  Dialog,
  DialogBody,
  DialogCancelButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ParentInvoiceSelector } from '@/components/ui/parent-invoice-selector';
import { SedeSelector } from '@/components/ui/sede-selector';
import { ServiceSelector } from '@/components/ui/service-selector';
import { API_ROUTES } from '@/constants/routes';
import { PURCHASES_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { DiscountControl, DocumentTotals } from '@/components/ui/discount-control';
import { useDiscountSettings } from '@/hooks/useDiscountSettings';
import {
  buildDiscountedDocument,
  computeDiscountAmount,
  computeGrossTotal,
  computeLineTotals,
  isDiscountWithinLimit,
  roundCurrency,
} from '@/lib/discounts';
import type { DiscountMode } from '@/lib/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/context/AuthContext';
import { Invoice, Service, SessionPreloadedService, User } from '@/lib/types';
import { cn, formatDate, formatDisplayDate, toLocalISOString } from '@/lib/utils';
import { api } from '@/services/api';
import { getPurchaseServices, getSalesServices } from '@/services/services';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { addDays, format, parseISO } from 'date-fns';
import { AlertTriangle, ArrowRight, Box, CalendarIcon, Check, ChevronsUpDown, Download, FileUp, Link2, Loader2, MoreHorizontal, Printer, Receipt, Send, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Checkbox } from '../ui/checkbox';
import { DataTableAdvancedToolbar } from '../ui/data-table-advanced-toolbar';
import { DataListRow } from '@/components/ui/data-list-row';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';
import { useTableViewMode } from '@/hooks/use-table-view-mode';
import { DatePickerInput } from '../ui/date-picker';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { DialogDescription } from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ScrollArea } from '../ui/scroll-area';


const getCreateInvoiceFormSchema = (t: (key: string) => string, maxDiscountPct: number) => z.object({
  user_id: z.string().min(1, t('validation.userRequired')),
  doctor_id: z.string().optional(),
  sede_id: z.string().optional(),
  total: z.coerce.number().min(0, t('validation.totalNonNegative')),
  /** Descuento sobre el total del documento. Solo con ambito 'total'. */
  discount_mode: z.enum(['percent', 'amount']).nullish(),
  discount_value: z.coerce.number().min(0).nullish(),
  currency: z.enum(['UYU', 'USD']),
  order_id: z.string().optional(),
  quote_id: z.string().optional(),
  created_at: z.date({ required_error: t('validation.dateRequired') }),
  due_date: z.date().optional(),
  notes: z.string().optional(),
  is_historical: z.boolean().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    service_id: z.string().min(1, t('validation.serviceRequired')),
    service_name: z.string().optional(),
    quantity: z.coerce.number().min(1, t('validation.quantityMin')),
    unit_price: z.coerce.number().min(0, t('validation.unitPriceNonNegative')),
    total: z.coerce.number().optional(),
    /** Descuento de la linea. Solo con ambito 'line'. */
    discount_mode: z.enum(['percent', 'amount']).nullish(),
    discount_value: z.coerce.number().min(0).nullish(),
  })),
  type: z.enum(['invoice', 'credit_note']),
  parent_id: z.string().optional(),
}).superRefine((values, ctx) => {
  // El tope se valida aqui porque un descuento en importe necesita la base
  // (precio x cantidad), que el campo por si solo no conoce.
  (values.items ?? []).forEach((item, index) => {
    const base = computeGrossTotal(item.unit_price, item.quantity);
    if (!isDiscountWithinLimit(base, { mode: item.discount_mode, value: item.discount_value }, maxDiscountPct)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'discount_value'], message: t('validation.discountOverLimit') });
    }
  });
  const grossTotal = roundCurrency((values.items ?? []).reduce((sum, item) => sum + computeGrossTotal(item.unit_price, item.quantity), 0));
  if (!isDiscountWithinLimit(grossTotal, { mode: values.discount_mode, value: values.discount_value }, maxDiscountPct)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discount_value'], message: t('validation.discountOverLimit') });
  }
});
type CreateInvoiceFormValues = z.infer<ReturnType<typeof getCreateInvoiceFormSchema>>;

const getColumns = (
  t: (key: string) => string,
  tStatus: (key: string) => string,
  tMethods: (key: string) => string,
  columnTranslations: { [key: string]: string },
  invoices: Invoice[],
  onPrint?: (invoice: Invoice) => void,
  onSendEmail?: (invoice: Invoice) => void,
  onAddPayment?: (invoice: Invoice, isHistorical?: boolean) => void,
  onConfirm?: (invoice: Invoice) => void,
  onEdit?: (invoice: Invoice) => void
): ColumnDef<Invoice>[] => {
  const isPaymentActionVisible = (invoice: Invoice) => {
    const status = invoice.status.toLowerCase();
    const paymentStatus = invoice.payment_status?.toLowerCase();
    return status === 'booked' && paymentStatus !== 'paid';
  };
  return [
    {
      id: 'select',
      header: () => null,
      cell: ({ row, table }) => {
        const isSelected = row.getIsSelected();
        return (
          <RadioGroup
            value={isSelected ? row.id : ''}
            onValueChange={() => {
              table.toggleAllPageRowsSelected(false);
              row.toggleSelected(true);
            }}
          >
            <RadioGroupItem value={row.id} id={row.id} aria-label="Select row" />
          </RadioGroup>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Doc. No" />
      ),
      cell: ({ row }) => {
        const value = row.getValue('doc_no') as string;
        const invoice = row.original;
        const isLinked = invoice.type === 'credit_note'
          ? !!(invoice.invoice_id || invoice.parent_id)
          : invoices.some(inv => inv.type === 'credit_note' && (inv.invoice_id === invoice.id || inv.parent_id === invoice.id));
        return (
          <div className="font-medium flex items-center gap-1.5">
            {value || `INV-${invoice.id}`}
            {isLinked && <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          </div>
        );
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
      accessorKey: 'currency',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={columnTranslations.currency || "Currency"} />
      ),
      cell: ({ row }) => row.original.currency || 'N/A',
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
      accessorKey: 'type',
      header: ({ column }) => <DataTableColumnHeader column={column} title={columnTranslations.type || "Type"} />,
      cell: ({ row }) => {
        const type = row.original.type;
        return <div className="capitalize">{type ? type.replace('_', ' ') : '-'}</div>;
      },
    },
    {
      accessorKey: 'payment_status',
      header: ({ column }) => <DataTableColumnHeader column={column} title={columnTranslations.payment_status || "Payment"} />,
      cell: ({ row }) => {
        const status = row.original.payment_status;
        const variant = {
          paid: 'success',
          partial: 'info',
          unpaid: 'outline',
          partially_paid: 'info'
        }[status?.toLowerCase() ?? ('default' as any)];
        return <Badge variant={variant as any} className="capitalize">{status ? tStatus(status.toLowerCase()) : ''}</Badge>;
      },
    },
    {
      accessorKey: 'paid_amount',
      header: ({ column }) => <DataTableColumnHeader column={column} title={columnTranslations.paid_amount || "Paid Amount"} />,
      cell: ({ row }) => {
        const amount = row.original.paid_amount ? parseFloat(row.original.paid_amount.toString()) : 0;
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: row.original.currency || 'USD',
        }).format(amount);
        return <div className="text-right font-medium pr-4">{formatted}</div>;
      },
    },
    {
      accessorKey: 'due_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={columnTranslations.due_date || "Due Date"} />
      ),
      cell: ({ row }) => {
        const dueDate = row.original.due_date;
        return <div className="font-medium">{dueDate ? formatDisplayDate(dueDate) : '-'}</div>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={columnTranslations.createdAt || "Created At"} />
      ),
      cell: ({ row }) => formatDisplayDate(row.original.createdAt),
    },
    {
      accessorKey: 'external_id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={columnTranslations.external_id || "External ID"} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.external_id ?? '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">{t('actions.openMenu')}</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('actions.title')}</DropdownMenuLabel>
                {onAddPayment && isPaymentActionVisible(invoice) && (
                  <DropdownMenuItem onClick={() => onAddPayment(invoice)}>
                    {t('paymentDialog.add')}
                  </DropdownMenuItem>
                )}
                {onConfirm && invoice.status.toLowerCase() === 'draft' && (
                  <DropdownMenuItem onClick={() => onConfirm(invoice)}>
                    {t('confirmInvoice')}
                  </DropdownMenuItem>
                )}
                {onEdit && invoice.status.toLowerCase() === 'draft' && (
                  <DropdownMenuItem onClick={() => onEdit(invoice)}>
                    {t('actions.edit') || 'Edit'}
                  </DropdownMenuItem>
                )}
                {onPrint && (
                  <DropdownMenuItem onClick={() => onPrint(invoice)}>
                    <Printer className="mr-2 h-4 w-4" />
                    <span>{t('actions.print')}</span>
                  </DropdownMenuItem>
                )}
                {onSendEmail && (
                  <DropdownMenuItem onClick={() => onSendEmail(invoice)}>
                    <Send className="mr-2 h-4 w-4" />
                    <span>{t('actions.sendEmail')}</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
};


export function InvoicesTable({ invoices, isLoading = false, onRowSelectionChange, onRefresh, onPrint, onSendEmail, onCreate, onImport, onConfirm, isRefreshing, rowSelection, setRowSelection, columnTranslations = {}, filterOptions, onFilterChange, filterValue, onEdit, isSales = true, isCompact = false, className, title, description, standalone = false, canCreate = true, onExport, manualPagination, pagination, onPaginationChange, pageCount, rowCount, columnFilters, onColumnFiltersChange }: InvoicesTableProps) {
  const t = useTranslations('InvoicesPage');
  const tStatus = useTranslations('InvoicesPage.status');
  const tMethods = useTranslations('InvoicesPage.methods');
  const { user, checkActiveSession } = useAuth();
  const { isNarrow: panelNarrow } = useNarrowMode();
  const viewportNarrow = useViewportNarrow();
  const [viewMode, setViewMode] = useTableViewMode('invoices', 'table');
  const showToggle = !viewportNarrow;
  const useListView = showToggle && viewMode === 'list';
  const isNarrow = panelNarrow || viewportNarrow || useListView;
  const viewToggleEl = showToggle ? <ViewModeToggle value={viewMode} onChange={setViewMode} /> : undefined;
  const locale = useLocale();

  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [isFormDialogOpen, setIsFormDialogOpen] = React.useState(false);
  const [editingInvoice, setEditingInvoice] = React.useState<Invoice | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = React.useState(false);
  const [confirmingInvoice, setConfirmingInvoice] = React.useState<Invoice | null>(null);
  const { open: openBillingWizard } = useBillingWizard();

  const handleAddPaymentClick = React.useCallback((invoice: Invoice) => {
    openBillingWizard(
      {
        invoiceId: invoice.id,
        invoice,
        patientId: invoice.user_id,
        patientName: invoice.user_name,
        isSales,
      },
      () => { if (onRefresh) onRefresh(); },
    );
  }, [openBillingWizard, isSales, onRefresh]);

  const handleConfirmInvoiceInternal = async (invoice: Invoice) => {
    try {
      await api.post(isSales ? API_ROUTES.SALES.INVOICES_CONFIRM : API_ROUTES.PURCHASES.INVOICES_CONFIRM, { id: parseInt(invoice.id, 10) });
      toast({
        title: 'Invoice Confirmed',
        description: `Invoice #${invoice.id} has been confirmed.`,
      });
      setIsConfirmDialogOpen(false);
      setConfirmingInvoice(null);
      if (onRefresh) onRefresh();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    }
  };

  const mergedColumnTranslations = React.useMemo(() => ({
    doc_no: "Doc. No",
    user_name: isSales ? t('columns.patient') : t('columns.provider'),
    total: t('columns.total'),
    currency: t('columns.currency'),
    status: t('columns.status'),
    type: t('columns.type'),
    payment_status: t('columns.paymentStatus'),
    paid_amount: t('columns.paidAmount'),
    due_date: t('columns.dueDate'),
    createdAt: t('columns.createdAt'),
    external_id: t('columns.externalId'),
    ...columnTranslations,
  }), [t, isSales, columnTranslations]);

  const columns = React.useMemo(() => getColumns(
    t,
    tStatus,
    tMethods,
    mergedColumnTranslations,
    invoices,
    onPrint,
    onSendEmail,
    handleAddPaymentClick,
    (inv) => { setConfirmingInvoice(inv); setIsConfirmDialogOpen(true); },
    (invoice) => {
      setEditingInvoice(invoice);
      setIsFormDialogOpen(true);
    }
  ), [t, tStatus, tMethods, mergedColumnTranslations, invoices, onPrint, onSendEmail, handleAddPaymentClick]);

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
      <Card className={cn("h-full flex-1 flex flex-col min-h-0 border-0 lg:border shadow-none lg:shadow-sm", className)}>
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
          <DataTable
            columns={columns}
            data={invoices}
            isLoading={isLoading}
            filterColumnId="doc_no"
            manualPagination={manualPagination}
            pagination={pagination}
            onPaginationChange={onPaginationChange}
            pageCount={pageCount}
            rowCount={rowCount}
            columnFilters={columnFilters}
            onColumnFiltersChange={onColumnFiltersChange}
            onRowSelectionChange={onRowSelectionChange}
            enableSingleRowSelection={true}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            onCreate={canCreate ? () => {
              setEditingInvoice(null);
              setIsFormDialogOpen(true);
            } : undefined}
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            getRowClassName={(row: Invoice) => row.is_historical ? 'bg-amber-50/50 dark:bg-amber-950/30' : ''}
            customToolbar={standalone ? (table, pagination) => (
              <DataTableAdvancedToolbar
                table={table}
                endSlot={pagination}
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
                onCreate={canCreate ? () => {
                  setEditingInvoice(null);
                  setIsFormDialogOpen(true);
                } : undefined}
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
                filters={[
                  ...(filterOptions?.map(opt => ({
                    value: opt.value,
                    label: opt.label,
                    group: t('columns.type') || "Type",
                    isActive: filterValue === opt.value,
                    onSelect: () => onFilterChange?.(opt.value)
                  })) || [])
                ]}
                onClearFilters={() => onFilterChange?.('')}
                columnTranslations={mergedColumnTranslations}
                viewControls={viewToggleEl}
                extraButtons={
                  <>
                    {onImport && (
                      <Button variant="outline" size="sm" className="h-9" onClick={onImport}>
                        <FileUp className="mr-2 h-4 w-4" /> {t('import')}
                      </Button>
                    )}
                    {onExport && hasPermission(isSales ? SALES_PERMISSIONS.INVOICES_EXPORT : PURCHASES_PERMISSIONS.INVOICES_EXPORT) && (
                      <Button variant="outline" size="sm" className="h-9" onClick={onExport}>
                        <Download className="mr-2 h-4 w-4" /> {t('export')}
                      </Button>
                    )}
                  </>
                }
              />
            ) : undefined}
            columnTranslations={mergedColumnTranslations}
            filterOptions={filterOptions}
            onFilterChange={onFilterChange}
            filterValue={filterValue}
            isNarrow={isNarrow}
            viewControls={viewToggleEl}
            cardListClassName={useListView ? 'gap-0 px-0 py-0 rounded-md border' : undefined}
            renderCard={(row: Invoice, _isSelected: boolean) => {
              const amount = row.total != null
                ? [row.currency, new Intl.NumberFormat('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(row.total))].filter(Boolean).join(' ')
                : undefined;
              if (useListView) {
                return (
                  <DataListRow
                    isSelected={_isSelected}
                    onClick={() => onRowSelectionChange?.([row])}
                    title={row.doc_no || String(row.id)}
                    badge={row.status ? <Badge variant={({ paid: 'success', sent: 'default', draft: 'outline', overdue: 'destructive', booked: 'info' }[row.status?.toLowerCase()] ?? 'default') as any} className="capitalize text-[10px]">{tStatus(row.status?.toLowerCase() || '')}</Badge> : undefined}
                    meta={(
                      <>
                        {row.user_name ? <span>{row.user_name}</span> : null}
                        <span>{formatDisplayDate(row.createdAt)}</span>
                        {amount ? <span className="font-medium text-foreground">{t('columns.total')}: {amount}</span> : null}
                        {row.due_date ? <span>{mergedColumnTranslations.due_date}: {formatDisplayDate(row.due_date)}</span> : null}
                      </>
                    )}
                  />
                );
              }
              return (
                <DataCard isSelected={_isSelected}
                  title={row.doc_no || String(row.id)}
                  subtitle={[
                    row.user_name,
                    formatDisplayDate(row.createdAt),
                    amount,
                    row.status,
                  ].filter(Boolean).join(' · ')}
                  fields={[
                    { label: columnTranslations.due_date || "Due Date", value: row.due_date ? formatDisplayDate(row.due_date) : '-' },
                  ]}
                  showArrow
                  onClick={() => onRowSelectionChange?.([row])}
                />
              );
            }}
          />
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <Check className="h-5 w-5" />
              </div>
              <div className="flex flex-col text-left">
                <AlertDialogTitle>{t('confirmInvoiceDialog.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('confirmInvoiceDialog.description', { id: confirmingInvoice?.id })}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('confirmInvoiceDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmingInvoice && handleConfirmInvoiceInternal(confirmingInvoice)}>{t('confirmInvoiceDialog.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface InvoiceFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onInvoiceCreated: (invoiceId?: string) => void;
  isSales: boolean;
  invoice?: Invoice | null;
  initialUser?: User;
  /** Servicios pre-cargados por IA desde la sesión clínica actual */
  initialItems?: SessionPreloadedService[];
}

export function InvoiceFormDialog({ isOpen, onOpenChange, onInvoiceCreated, isSales, invoice, initialUser, initialItems }: InvoiceFormDialogProps) {
  const t = useTranslations('InvoicesPage.createDialog');
  const tRoot = useTranslations('InvoicesPage');
  const { activeSede } = useAuth();
  const [users, setUsers] = React.useState<User[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [userSearchTerm, setUserSearchTerm] = React.useState('');
  const debouncedUserSearch = useDebounce(userSearchTerm, 300);
  const [isLoadingUsers, setIsLoadingUsers] = React.useState(false);
  const { toast } = useToast();

  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = React.useState(false);
  const [userSearchOpen, setUserSearchOpen] = React.useState(false);
  const [userSearchQuery, setUserSearchQuery] = React.useState('');
  const isUserLocked = Boolean(initialUser);
  const [serviceSearchOpen, setServiceSearchOpen] = React.useState<Record<number, boolean>>({});
  const [serviceSearchQuery, setServiceSearchQuery] = React.useState('');
  const [isSearchingServices, setIsSearchingServices] = React.useState(false);
  const [doctorName, setDoctorName] = React.useState('');

  const discounts = useDiscountSettings();
  const createInvoiceFormSchema = React.useMemo(() => getCreateInvoiceFormSchema(t, discounts.maxPct), [t, discounts.maxPct]);

  // Reset search when dialog closes
  React.useEffect(() => {
    if (!isOpen) {
      setUserSearchTerm('');
      setUsers([]);
    }
  }, [isOpen]);

  // Fetch users when popover opens (initial load with empty search)
  React.useEffect(() => {
    if (userSearchOpen && users.length === 0) {
      const fetchInitialUsers = async () => {
        setIsLoadingUsers(true);
        try {
          const filterType = isSales ? 'PACIENTE' : 'PROVEEDOR';
          const usersData = await api.get(API_ROUTES.USERS, { filter_type: filterType });
          const usersDataNormalized = (Array.isArray(usersData) && usersData.length > 0) ? usersData[0].data : (usersData.data || []);
          setUsers(usersDataNormalized.map((u: any) => ({ ...u, id: String(u.id) })));
        } catch (error) {
          console.error('Failed to fetch initial users', error);
        } finally {
          setIsLoadingUsers(false);
        }
      };
      fetchInitialUsers();
    }
  }, [userSearchOpen, isSales, users.length]);

  const form = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceFormSchema),
    defaultValues: {
      type: 'invoice',
      user_id: '',
      doctor_id: '',
      sede_id: '',
      currency: 'UYU',
      items: [],
      total: 0,
      created_at: new Date(),
      due_date: undefined,
      notes: '',
      is_historical: false,
    },
  });

  const isEditing = !!invoice;
  const watchedItems = useWatch({ control: form.control, name: 'items' });
  // Referencia estable: sin esto el memo de totales se recalcula en cada render.
  const items = React.useMemo(() => watchedItems ?? [], [watchedItems]);
  const invoiceType = form.watch('type');
  const selectedUserId = form.watch('user_id');
  const createdAt = form.watch('created_at');

  const invoiceDiscountMode = form.watch('discount_mode');
  const invoiceDiscountValue = form.watch('discount_value');

  /** Unico punto de recalculo del importe de una linea. */
  const recalcLine = React.useCallback((index: number) => {
    const item = form.getValues(`items.${index}`);
    if (!item) return;
    // Con ambito 'total' la linea no lleva descuento propio: se reparte al guardar.
    const lineDiscount = discounts.showLineDiscount
      ? { mode: item.discount_mode, value: item.discount_value }
      : null;
    const { total } = computeLineTotals(item.unit_price, item.quantity, lineDiscount);
    form.setValue(`items.${index}.total`, total, { shouldDirty: true });
  }, [form, discounts.showLineDiscount]);

  /** Aplica o quita el descuento de una linea y deja su importe al dia. */
  const setLineDiscount = React.useCallback((index: number, next: { mode: DiscountMode | null | undefined; value: number | null | undefined }) => {
    form.setValue(`items.${index}.discount_mode`, next.mode ?? null, { shouldDirty: true });
    form.setValue(`items.${index}.discount_value`, next.value ?? null, { shouldDirty: true, shouldValidate: true });
    recalcLine(index);
  }, [form, recalcLine]);

  /**
   * Totales del documento, SIEMPRE derivados de precio x cantidad y del
   * descuento aplicado; nunca de `item.total`, que es solo para mostrar.
   */
  const documentTotals = React.useMemo(() => {
    let gross = 0;
    let lineDiscounts = 0;
    for (const item of items as any[]) {
      const lineGross = computeGrossTotal(item?.unit_price, item?.quantity);
      gross += lineGross;
      if (discounts.showLineDiscount) {
        lineDiscounts += computeDiscountAmount(lineGross, { mode: item?.discount_mode, value: item?.discount_value });
      }
    }
    const grossTotal = roundCurrency(gross);
    const netAfterLines = roundCurrency(grossTotal - roundCurrency(lineDiscounts));
    if (!discounts.showTotalDiscount) {
      return { grossTotal, discountAmount: roundCurrency(grossTotal - netAfterLines), total: netAfterLines };
    }
    const discountAmount = computeDiscountAmount(grossTotal, { mode: invoiceDiscountMode, value: invoiceDiscountValue });
    return { grossTotal, discountAmount, total: roundCurrency(grossTotal - discountAmount) };
  }, [items, discounts.showLineDiscount, discounts.showTotalDiscount, invoiceDiscountMode, invoiceDiscountValue]);

  const calculatedTotal = documentTotals.total;

  React.useEffect(() => {
    form.setValue('total', calculatedTotal);
  }, [calculatedTotal, form]);

  React.useEffect(() => {
    if (!isOpen || isEditing || !createdAt) return;
    form.setValue('due_date', addDays(createdAt, 30));
  }, [createdAt, form, isEditing, isOpen]);

  // Debounced User Search
  React.useEffect(() => {
    const handler = setTimeout(async () => {
      // Always fetch initially if open, or when searching
      if (!isOpen) return;

      setIsSearchingUsers(true);
      try {
        const filterType = isSales ? 'PACIENTE' : 'PROVEEDOR';
        const data = await api.get(API_ROUTES.USERS, { search: userSearchQuery, filter_type: filterType });

        let usersData: any[] = [];
        if (Array.isArray(data) && data.length > 0) {
          const firstElement = data[0];
          if (firstElement.json && typeof firstElement.json === 'object') {
            usersData = firstElement.json.data || [];
          } else if (firstElement.data) {
            usersData = firstElement.data;
          } else if (firstElement.result && Array.isArray(firstElement.result)) {
            usersData = firstElement.result;
          }
        } else if (typeof data === 'object' && data !== null) {
          usersData = data.data || data.users || data.result || [];
        }

        const normalizedUsers = usersData.map((u: any) => ({ ...u, id: String(u.id) }));

        // If editing or one is already selected, ensure it stays in the list
        const currentUserId = form.getValues('user_id');
        if (currentUserId && !normalizedUsers.find((u: User) => u.id === currentUserId)) {
          // If editing, we can get the name from the invoice
          if (invoice && (Array.isArray(invoice.user_id) ? String(invoice.user_id[0]) : String(invoice.user_id)) === currentUserId) {
            normalizedUsers.unshift({
              id: currentUserId,
              name: invoice.user_name || 'Selected User',
              email: invoice.userEmail || '',
              phone_number: '',
              is_active: true,
              avatar: '',
            } as User);
          }
        }

        setUsers(normalizedUsers);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [userSearchQuery, isSales, isOpen]);

  // Debounced Service Search
  React.useEffect(() => {
    const handler = setTimeout(async () => {
      if (!isOpen) return;

      setIsSearchingServices(true);
      try {
        const servicesData = await api.get(API_ROUTES.SERVICES, { is_sales: isSales ? 'true' : 'false', search: serviceSearchQuery });
        const servicesDataNormalized = Array.isArray(servicesData) ? servicesData : (servicesData.services || []);
        setServices(servicesDataNormalized.map((s: any) => ({ ...s, id: String(s.id) })));
      } catch (error) {
        console.error("Failed to fetch services:", error);
      } finally {
        setIsSearchingServices(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [serviceSearchQuery, isSales, isOpen]);

  // Initial Data & Invoice Setup
  React.useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const filterType = isSales ? 'PACIENTE' : 'PROVEEDOR';
          // Fetch services (users are fetched on demand with search; parent invoices are
          // fetched on demand by the ParentInvoiceSelector once a patient is selected)
          const servicesResult = isSales ? await getSalesServices({ limit: 100 }) : await getPurchaseServices({ limit: 100 });

          const servicesDataNormalized = servicesResult.items || [];
          setServices(servicesDataNormalized.map((s: any) => ({ ...s, id: String(s.id) })));

          if (invoice) {
            // When editing, fetch the user associated with this invoice
            const userId = Array.isArray(invoice.user_id) ? String(invoice.user_id[0]) : String(invoice.user_id || '');
            if (userId) {
              try {
                const userData = await api.get(API_ROUTES.USERS, { id: userId, filter_type: filterType });
                const userDataNormalized = (Array.isArray(userData) && userData.length > 0) ? userData[0].data : (userData.data || []);
                if (Array.isArray(userDataNormalized)) {
                  setUsers(userDataNormalized.map((u: any) => ({ ...u, id: String(u.id) })));
                }
              } catch (error) {
                console.error('Failed to fetch invoice user', error);
              }
            }

            const itemsEndpoint = isSales ? API_ROUTES.SALES.INVOICE_ITEMS : API_ROUTES.PURCHASES.INVOICE_ITEMS;
            const itemsData = await api.get(itemsEndpoint, { invoice_id: invoice.id, is_sales: isSales ? 'true' : 'false' });
            const itemsNormalized = Array.isArray(itemsData) ? itemsData : (itemsData.invoice_items || itemsData.data || itemsData.result || []);

            setDoctorName(invoice.doctor_name || '');
            form.reset({
              type: (invoice.type?.toString().includes('credit') ? 'credit_note' : 'invoice') as any,
              user_id: userId,
              doctor_id: invoice.doctor_id ? String(invoice.doctor_id) : '',
              sede_id: invoice.sede_id ? String(invoice.sede_id) : (activeSede?.id || ''),
              currency: (invoice.currency?.toUpperCase() as any) || 'UYU',
              total: Number(invoice.total || 0),
              order_id: invoice.order_id ? String(invoice.order_id) : undefined,
              quote_id: invoice.quote_id ? String(invoice.quote_id) : undefined,
              created_at: invoice.createdAt ? parseISO(formatDate(invoice.createdAt)) : new Date(),
              due_date: invoice.due_date ? parseISO(formatDate(invoice.due_date)) : undefined,
              items: itemsNormalized.map((item: any) => {
                const rawServiceId = item.service_id || item.product_id;
                const serviceId = Array.isArray(rawServiceId) ? String(rawServiceId[0]) : String(rawServiceId || '');
                return {
                  id: item.id ? String(item.id) : undefined,
                  service_id: serviceId,
                  service_name: item.service_name || item.product_name || item.name || item.display_name || (Array.isArray(rawServiceId) ? rawServiceId[1] : ''),
                  quantity: Number(item.quantity || item.product_uom_qty || 1),
                  unit_price: Number(item.unit_price || item.price_unit || 0),
                  total: Number(item.total || item.price_total || 0),
                  // Se rehidrata lo guardado, no la preferencia actual de la clinica.
                  discount_mode: item.discount_mode ?? null,
                  discount_value: item.discount_value != null ? Number(item.discount_value) : null,
                };
              }),
              discount_mode: (invoice as any).discount_mode ?? null,
              discount_value: (invoice as any).discount_value != null ? Number((invoice as any).discount_value) : null,
            });
          } else {
            if (initialUser) {
              setUsers([initialUser]);
            }
            setDoctorName('');
            // Pre-cargar ítems generados por IA si están disponibles
            const preloadedItems = initialItems
              ?.filter(i => i.service_id)
              .map(i => ({
                service_id: i.service_id!,
                service_name: i.service_name ?? '',
                quantity: i.quantity ?? 1,
                unit_price: i.unit_price ?? 0,
                total: (i.unit_price ?? 0) * (i.quantity ?? 1),
                // Aplicar descuento es decision del usuario, no algo heredado.
                discount_mode: null,
                discount_value: null,
              })) ?? [];
            form.reset({
              type: 'invoice',
              user_id: initialUser ? initialUser.id : '',
              doctor_id: '',
              sede_id: activeSede?.id || '',
              currency: 'UYU',
              items: preloadedItems,
              total: 0,
              created_at: new Date(),
              due_date: addDays(new Date(), 30),
            });
          }
        } catch (error) {
          console.error('Failed to fetch initial data', error);
        }
      };
      fetchData();
    }
  }, [isOpen, invoice, isSales, form]);

  const parentId = form.watch('parent_id');

  // Fetch users when search term changes (debounced)
  React.useEffect(() => {
    const fetchUsers = async () => {
      if (!userSearchOpen) return;

      setIsLoadingUsers(true);
      try {
        const filterType = isSales ? 'PACIENTE' : 'PROVEEDOR';
        const queryParams: Record<string, string> = {
          filter_type: filterType,
        };

        // Add search term if provided
        if (debouncedUserSearch && debouncedUserSearch.trim()) {
          queryParams.search = debouncedUserSearch.trim();
        }

        const usersData = await api.get(API_ROUTES.USERS, queryParams);
        const usersDataNormalized = (Array.isArray(usersData) && usersData.length > 0) ? usersData[0].data : (usersData.data || []);
        setUsers(usersDataNormalized.map((u: any) => ({ ...u, id: String(u.id) })));
      } catch (error) {
        console.error('Failed to fetch users', error);
        setUsers([]);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [debouncedUserSearch, userSearchOpen]);

  // Reset the selected parent invoice (and its items) when the patient changes,
  // since parent invoices are scoped to the selected patient. Skip the first run
  // so editing/preloading an invoice doesn't wipe its data.
  const prevUserIdRef = React.useRef<string | undefined>(selectedUserId);
  React.useEffect(() => {
    if (prevUserIdRef.current === selectedUserId) return;
    prevUserIdRef.current = selectedUserId;

    if (invoiceType === 'credit_note' && parentId) {
      form.setValue('parent_id', '');
      form.setValue('items', []);
    }
  }, [selectedUserId, invoiceType, parentId, form]);

  // Load the parent invoice items into the form when a parent invoice is selected.
  React.useEffect(() => {
    if (invoiceType !== 'credit_note' || !parentId) return;

    const fetchParentItems = async () => {
      try {
        const itemsEndpoint = isSales ? API_ROUTES.SALES.INVOICE_ITEMS : API_ROUTES.PURCHASES.INVOICE_ITEMS;
        const itemsData = await api.get(itemsEndpoint, { invoice_id: parentId, is_sales: isSales ? 'true' : 'false' });
        const itemsNormalized = Array.isArray(itemsData) ? itemsData : (itemsData.invoice_items || itemsData.data || itemsData.result || []);
        const mappedItems = itemsNormalized.map((item: any) => {
          const rawServiceId = item.service_id || item.product_id;
          const serviceId = Array.isArray(rawServiceId) ? String(rawServiceId[0]) : String(rawServiceId || '');
          return {
            id: item.id ? String(item.id) : undefined,
            service_id: serviceId,
            service_name: item.service_name || item.product_name || item.name || item.display_name || (Array.isArray(rawServiceId) ? rawServiceId[1] : ''),
            quantity: Number(item.quantity || item.product_uom_qty || 1),
            unit_price: Number(item.unit_price || item.price_unit || 0),
            total: Number(item.total || item.price_total || 0),
          };
        });
        form.setValue('items', mappedItems);
      } catch (error) {
        console.error('Failed to fetch parent invoice items', error);
      }
    };
    fetchParentItems();
  }, [parentId, invoiceType, isSales, form]);

  const onSubmit = async (values: CreateInvoiceFormValues) => {
    setSubmissionError(null);
    setIsSubmitting(true);
    try {
      if (values.type === 'invoice' && (!values.items || values.items.length === 0)) {
        throw new Error(t('atLeastOneItem') || 'Debe agregar al menos un artículo.');
      }
      if (values.type === 'credit_note' && (!values.items || values.items.length === 0)) {
        throw new Error(t('atLeastOneItem') || 'Debe agregar al menos un artículo.');
      }
      if (values.type === 'credit_note' && !values.parent_id) {
        throw new Error(t('validation.parentInvoiceRequired'));
      }
      if (values.type === 'invoice' && !values.sede_id) {
        throw new Error(t('validation.sedeRequired'));
      }

      const endpoint = isSales ? API_ROUTES.SALES.INVOICES_UPSERT : API_ROUTES.PURCHASES.INVOICES_UPSERT;
      // Los importes finales y el reparto del descuento del total salen de aqui.
      const { items: normalizedItems, document } = buildDiscountedDocument(
        (values.items || []).map(item => ({
          id: item.id,
          service_id: item.service_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_mode: item.discount_mode,
          discount_value: item.discount_value,
        })),
        {
          enabled: discounts.enabled,
          scope: discounts.scope,
          documentDiscount: { mode: values.discount_mode, value: values.discount_value },
        },
      );
      const payload = isEditing && invoice
        ? {
            ...values,
            ...document,
            items: normalizedItems,
            id: invoice.id,
            created_at: toLocalISOString(values.created_at),
            due_date: values.due_date ? toLocalISOString(values.due_date) : undefined,
            is_sales: isSales,
          }
        : {
            ...values,
            ...document,
            items: normalizedItems,
            created_at: toLocalISOString(values.created_at),
            due_date: values.due_date ? toLocalISOString(values.due_date) : undefined,
            is_sales: isSales,
          };

      const responseData = await api.post(endpoint, payload);

      if (responseData.error && responseData.code >= 400) {
        throw new Error(responseData.message || t('errors.generic'));
      }

      toast({ title: t('success.title'), description: isEditing ? (t('success.updateDescription') || 'Invoice updated successfully') : t('success.description') });

      const createdResult = Array.isArray(responseData) ? responseData[0] : responseData;
      const createdInvoiceId = createdResult?.id ?? createdResult?.invoice_id ?? createdResult?.invoiceId;
      onInvoiceCreated(createdInvoiceId != null ? String(createdInvoiceId) : undefined);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Invoice submission failed:', error);
      setSubmissionError(error instanceof Error ? error.message : t('errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddItem = () => {
    // Sin descuento: se aplica a mano con el boton «Aplicar descuentos».
    form.setValue('items', [...items, { service_id: '', service_name: '', quantity: 1, unit_price: 0, total: 0, discount_mode: null, discount_value: null }]);
  };

  const handleRemoveItem = (index: number) => {
    if (invoiceType === 'credit_note' && items.length <= 1) {
      toast({ variant: 'destructive', title: t('validation.errorTitle') || 'Error', description: t('atLeastOneItem') || 'Debe agregar al menos un artículo.' });
      return;
    }
    form.setValue('items', items.filter((_, i) => i !== index));
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="4xl" confirmOnClose isDirty={form.formState.isDirty}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 w-full overflow-hidden" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { e.preventDefault(); if ((e.target as HTMLInputElement).name?.startsWith('items.')) handleAddItem(); } }}>
            <DialogHeader>
              <div className="flex items-start gap-3">
                <div className="header-icon-circle mt-0.5">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="flex flex-col text-left">
                  <DialogTitle>{isEditing ? tRoot('editDialog.title') || 'Edit Invoice' : t('title')}</DialogTitle>
                  <DialogDescription>{isEditing ? tRoot('editDialog.description') || 'Change invoice details and lines.' : t('description')}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <DialogBody className="space-y-4 py-4 px-6">
              {submissionError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('errors.title')}</AlertTitle>
                  <AlertDescription>{submissionError}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="user_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isSales ? t('client') : t('provider')}
                    </FormLabel>
                    <Popover
                      open={userSearchOpen}
                      onOpenChange={(open) => {
                        if (isUserLocked) return;
                        setUserSearchOpen(open);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                            disabled={isUserLocked}
                          >
                            <span className="truncate mr-2 text-left">
                              {field.value
                                ? (users.find(user => user.id === field.value)?.name || (isEditing && invoice?.user_name) || (isSales ? t('selectPatient') : t('selectProvider')))
                                : (isSales ? t('selectPatient') : t('selectProvider'))}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder={tRoot('createDialog.searchUser')}
                            value={userSearchTerm}
                            onValueChange={setUserSearchTerm}
                          />
                          <CommandList>
                            {isLoadingUsers ? (
                              <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">Buscando...</span>
                              </div>
                            ) : (
                              <>
                                <CommandEmpty>{tRoot('createDialog.noUserFound')}</CommandEmpty>
                                <CommandGroup>
                                  {users.map((user) => (
                                    <CommandItem
                                      value={user.name}
                                      key={user.id}
                                      onSelect={() => {
                                        form.setValue("user_id", user.id);
                                        setUserSearchOpen(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", user.id === field.value ? "opacity-100" : "opacity-0")} />
                                      {user.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('type')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="invoice">{t('types.invoice')}</SelectItem>
                          <SelectItem value="credit_note">{t('types.credit_note')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('currency')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="UYU">UYU</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="doctor_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('doctor')}</FormLabel>
                    <FormControl>
                      <DoctorSelector
                        value={field.value}
                        selectedDoctorName={doctorName}
                        onValueChange={(doctorId, doctor) => {
                          field.onChange(doctorId);
                          setDoctorName(doctor?.name || '');
                        }}
                        placeholder={t('searchDoctor')}
                        triggerText={t('selectDoctor')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {invoiceType !== 'credit_note' && (
                  <FormField control={form.control} name="sede_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('sede')}</FormLabel>
                      <FormControl>
                        <SedeSelector
                          value={field.value}
                          onValueChange={(sedeId) => field.onChange(sedeId)}
                          placeholder={t('searchSede')}
                          triggerText={t('selectSede')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
              {invoiceType === 'credit_note' && (
                <FormField
                  control={form.control}
                  name="parent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('parentInvoice')}</FormLabel>
                      <FormControl>
                        <ParentInvoiceSelector
                          isSales={isSales}
                          userId={selectedUserId}
                          value={field.value}
                          onValueChange={(invoiceId, parentInvoice) => {
                            field.onChange(invoiceId);
                            // Una nota de crédito hereda la sede de la factura que revierte —
                            // no se le pide al usuario que la elija de nuevo.
                            if (parentInvoice?.sede_id) form.setValue('sede_id', String(parentInvoice.sede_id));
                          }}
                          disabled={!selectedUserId}
                          triggerText={selectedUserId ? t('selectParentInvoice') : (isSales ? t('selectPatient') : t('selectProvider'))}
                          placeholder={t('searchParentInvoice')}
                          noResultsText={t('noInvoicesFound')}
                          loadMoreText={t('loadMoreInvoices')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="created_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createdAt')}</FormLabel>
                      <FormControl>
                        <DatePickerInput
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(iso) => field.onChange(iso ? parseISO(iso) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tRoot('columns.dueDate')}</FormLabel>
                      <FormControl>
                        <DatePickerInput
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(iso) => field.onChange(iso ? parseISO(iso) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_historical"
                render={({ field }) => (
                  <>
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          {tRoot('invoiceDialog.isHistorical')}
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          {tRoot('invoiceDialog.isHistoricalDescription')}
                        </p>
                      </div>
                    </FormItem>
                    {field.value && (
                      <Alert variant="default" className="bg-amber-50 border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800 text-sm">{tRoot('invoiceDialog.isHistoricalWarning')}</AlertTitle>
                        <AlertDescription className="text-amber-700 text-xs">
                          {tRoot('invoiceDialog.isHistoricalDescription')}
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              />

              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>{t('items.title')}</CardTitle>
                    {invoiceType !== 'credit_note' && (
                      <Button type="button" size="sm" variant="outline" onClick={handleAddItem}>{t('addItem')}</Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="bg-card">
                  <div className="space-y-4">
                    <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      {/* min-w-0 para que el selector de servicios ceda ancho en vez
                          de empujar al resto: con el descuento inline la fila iba justa. */}
                      <div className="min-w-0 flex-1">{t('items.service')}</div>
                      <div className="w-16 shrink-0">{t('items.quantity')}</div>
                      <div className="w-24 shrink-0">{t('items.unitPrice')}</div>
                      <div className="w-24 shrink-0">{t('items.total')}</div>
                      {discounts.showLineDiscount && invoiceType !== 'credit_note' && <div className="w-20 shrink-0" />}
                      <div className="w-10 shrink-0"></div>
                    </div>
                    {items.map((item, index) => (
                      <div key={index} className="flex flex-col md:flex-row md:items-start gap-2">
                        <FormField control={form.control} name={`items.${index}.service_id`} render={({ field }) => (
                          <FormItem className="min-w-0 flex-1">
                            <ServiceSelector
                              isSales={isSales}
                              value={field.value}
                              selectedServiceName={form.getValues(`items.${index}.service_name`) || undefined}
                              onValueChange={(serviceId, service) => {
                                field.onChange(serviceId);
                                if (service) {
                                  form.setValue(`items.${index}.service_name`, service.name);
                                  form.setValue(`items.${index}.unit_price`, service.price);
                                  recalcLine(index);
                                }
                              }}
                              disabled={invoiceType === 'credit_note'}
                              placeholder={t('items.selectService')}
                              triggerText={field.value ? services.find(s => s.id === field.value)?.name || t('items.selectService') : t('items.selectService')}
                            />
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                          <FormItem className="w-full shrink-0 md:w-16"><FormControl><Input type="number" {...field} readOnly={invoiceType === 'credit_note'} onChange={(e) => {
                            if (invoiceType !== 'credit_note') {
                              field.onChange(e);
                              form.setValue(`items.${index}.quantity`, Number(e.target.value), { shouldDirty: true });
                              recalcLine(index);
                            }
                          }} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name={`items.${index}.unit_price`} render={({ field: { onChange, value } }) => {
                          const [inputValue, setInputValue] = React.useState(value ? String(value) : '');

                          React.useEffect(() => {
                            setInputValue(value ? String(value) : '');
                          }, [value]);

                          const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                            const rawValue = e.target.value;
                            const sanitized = rawValue.replace(/[^0-9.]/g, '');
                            const parts = sanitized.split('.');
                            let formatted = parts[0];
                            if (parts.length > 1) {
                              formatted += '.' + parts[1].slice(0, 2);
                            }
                            setInputValue(formatted);
                            const numValue = formatted === '' ? 0 : parseFloat(formatted);
                            onChange(isNaN(numValue) ? 0 : numValue);
                            if (invoiceType !== 'credit_note') {
                              form.setValue(`items.${index}.unit_price`, isNaN(numValue) ? 0 : numValue, { shouldDirty: true });
                              recalcLine(index);
                            }
                          };

                          const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
                            const numValue = parseFloat(e.target.value);
                            if (!isNaN(numValue) && numValue >= 0) {
                              onChange(numValue);
                              setInputValue(numValue.toFixed(2));
                              if (invoiceType !== 'credit_note') {
                                form.setValue(`items.${index}.unit_price`, numValue, { shouldDirty: true });
                                recalcLine(index);
                              }
                            } else if (e.target.value !== '') {
                              onChange(0);
                              setInputValue('');
                            }
                          };

                          return (
                            <FormItem className="w-full shrink-0 md:w-24">
                              <FormControl>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={inputValue}
                                  onChange={handleChange}
                                  onBlur={handleBlur}
                                  readOnly={invoiceType === 'credit_note'}
                                  placeholder="0.00"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }} />
                        <FormField control={form.control} name={`items.${index}.total`} render={({ field }) => (
                          <FormItem className="w-full shrink-0 md:w-24"><FormControl><Input type="number" readOnly disabled {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        {/* Inline, junto al total. Los items de una nota de credito
                            se copian de la factura madre: no se re-editan. */}
                        {discounts.showLineDiscount && invoiceType !== 'credit_note' && (
                          <DiscountControl
                            className="shrink-0"
                            mode={(items as any[])[index]?.discount_mode}
                            value={(items as any[])[index]?.discount_value}
                            base={computeGrossTotal((items as any[])[index]?.unit_price ?? 0, (items as any[])[index]?.quantity ?? 0)}
                            currency={form.watch('currency') || 'UYU'}
                            maxPct={discounts.maxPct}
                            defaultPct={discounts.defaultPct}
                            canApply={discounts.canApply}
                            onApply={(next) => setLineDiscount(index, next)}
                            onRemove={() => setLineDiscount(index, { mode: null, value: null })}
                          />
                        )}
                        <Button type="button" variant="destructive" size="icon" className="shrink-0" onClick={() => handleRemoveItem(index)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <FormMessage>{form.formState.errors.items?.root?.message}</FormMessage>
                  </div>
                  <div className="mt-4 flex flex-col items-end gap-2 border-t border-dashed pt-4">
                    {/* Con ambito de documento el campo se ofrece directo, en 0. */}
                    {discounts.showTotalDiscount && invoiceType !== 'credit_note' && (
                      <DiscountControl
                        mode={invoiceDiscountMode}
                        value={invoiceDiscountValue}
                        base={documentTotals.grossTotal}
                        currency={form.watch('currency') || 'UYU'}
                        maxPct={discounts.maxPct}
                        defaultPct={discounts.defaultPct}
                        canApply={discounts.canApply}
                        onApply={(next) => {
                          form.setValue('discount_mode', next.mode ?? null, { shouldDirty: true });
                          form.setValue('discount_value', next.value ?? null, { shouldDirty: true, shouldValidate: true });
                        }}
                        onRemove={() => {
                          form.setValue('discount_mode', null, { shouldDirty: true });
                          form.setValue('discount_value', null, { shouldDirty: true, shouldValidate: true });
                        }}
                      />
                    )}
                    <DocumentTotals
                      grossTotal={documentTotals.grossTotal}
                      discountAmount={documentTotals.discountAmount}
                      total={documentTotals.total}
                      currency={form.watch('currency') || 'UYU'}
                    />
                  </div>
                </CardContent>
              </Card>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('notes')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('notesPlaceholder')} {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

            </DialogBody>

            <DialogFooter>
              <DialogCancelButton disabled={isSubmitting}>{t('cancel')}</DialogCancelButton>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface InvoicesTableProps {
  invoices: Invoice[];
  isLoading?: boolean;
  onRowSelectionChange?: (selectedRows: Invoice[]) => void;
  onRefresh?: () => void;
  onPrint?: (invoice: Invoice) => void;
  onSendEmail?: (invoice: Invoice) => void;
  onCreate?: () => void;
  onImport?: () => void;
  onConfirm?: (invoice: Invoice) => void;
  isRefreshing?: boolean;
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
  onExport?: () => void;
  /** Enables server-side pagination — the table no longer paginates/filters in the client */
  manualPagination?: boolean;
  pagination?: PaginationState;
  onPaginationChange?: React.Dispatch<React.SetStateAction<PaginationState>>;
  pageCount?: number;
  rowCount?: number;
  /** Controlled column filters (server-side search); enables manual filtering in DataTable */
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
}
