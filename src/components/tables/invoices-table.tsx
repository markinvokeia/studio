
'use client';

import { InvoicePaymentDialog } from '@/components/invoices/invoice-payment-dialog';
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
import { ServiceSelector } from '@/components/ui/service-selector';
import { API_ROUTES } from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/context/AuthContext';
import { Invoice, Service, User } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { getPurchaseServices, getSalesServices } from '@/services/services';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { format } from 'date-fns';
import { AlertTriangle, ArrowRight, Box, CalendarIcon, Check, ChevronsUpDown, CreditCard, FileUp, Loader2, MoreHorizontal, Printer, Receipt, Send, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Checkbox } from '../ui/checkbox';
import { DataTableAdvancedToolbar } from '../ui/data-table-advanced-toolbar';
import { DatePicker } from '../ui/date-picker';
import { DialogDescription } from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';


const createInvoiceFormSchema = z.object({
  user_id: z.string().min(1, 'A user or provider is required.'),
  total: z.coerce.number().min(0, 'Total must be a non-negative number.'),
  currency: z.enum(['UYU', 'USD']),
  order_id: z.string().optional(),
  quote_id: z.string().optional(),
  notes: z.string().optional(),
  is_historical: z.boolean().optional(),
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
  t: (key: string) => string,
  tStatus: (key: string) => string,
  tMethods: (key: string) => string,
  columnTranslations: { [key: string]: string },
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
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={columnTranslations.createdAt || "Created At"} />
      ),
      cell: ({ row }) => formatDateTime(row.original.createdAt),
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


export function InvoicesTable({ invoices, isLoading = false, onRowSelectionChange, onRefresh, onPrint, onSendEmail, onCreate, onImport, onConfirm, isRefreshing, rowSelection, setRowSelection, columnTranslations = {}, filterOptions, onFilterChange, filterValue, onEdit, isSales = true, isCompact = false, className, title, description, standalone = false, canCreate = true }: InvoicesTableProps) {
  const t = useTranslations('InvoicesPage');
  const tStatus = useTranslations('InvoicesPage.status');
  const tMethods = useTranslations('InvoicesPage.methods');
  const { user, checkActiveSession } = useAuth();
  const { isNarrow: panelNarrow } = useNarrowMode();
  const viewportNarrow = useViewportNarrow();
  const isNarrow = isCompact || panelNarrow || viewportNarrow;
  const locale = useLocale();

  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [isFormDialogOpen, setIsFormDialogOpen] = React.useState(false);
  const [editingInvoice, setEditingInvoice] = React.useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = React.useState(false);
  const [confirmingInvoice, setConfirmingInvoice] = React.useState<Invoice | null>(null);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = React.useState<Invoice | null>(null);

  const handleAddPaymentClick = React.useCallback((invoice: Invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setIsPaymentDialogOpen(true);
  }, []);

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
    createdAt: t('columns.createdAt'),
    ...columnTranslations,
  }), [t, isSales, columnTranslations]);

  const columns = React.useMemo(() => getColumns(
    t,
    tStatus,
    tMethods,
    mergedColumnTranslations,
    onPrint,
    onSendEmail,
    handleAddPaymentClick,
    (inv) => { setConfirmingInvoice(inv); setIsConfirmDialogOpen(true); },
    (invoice) => {
      setEditingInvoice(invoice);
      setIsFormDialogOpen(true);
    }
  ), [t, tStatus, tMethods, mergedColumnTranslations, onPrint, onSendEmail, handleAddPaymentClick]);

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
            filterColumnId="doc_no"
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
            customToolbar={standalone ? (table) => (
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
                extraButtons={
                  <>
                    {onImport && (
                      <Button variant="outline" size="sm" className="h-9" onClick={onImport}>
                        <FileUp className="mr-2 h-4 w-4" /> {t('import')}
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
            renderCard={(row: Invoice, _isSelected: boolean) => (
              <DataCard isSelected={_isSelected}
                title={row.doc_no || String(row.id)}
                subtitle={[
                  row.user_name,
                  formatDateTime(row.createdAt).split(' ')[0],
                  row.total != null
                    ? [row.currency, new Intl.NumberFormat('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(row.total))].filter(Boolean).join(' ')
                    : undefined,
                  row.status,
                ].filter(Boolean).join(' · ')}
                showArrow
                onClick={() => onRowSelectionChange?.([row])}
              />
            )}
          />
        </CardContent>
      </Card>

      <InvoicePaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => { setIsPaymentDialogOpen(false); setSelectedInvoiceForPayment(null); }}
        invoice={selectedInvoiceForPayment}
        isSales={isSales}
        onSuccess={() => { if (onRefresh) onRefresh(); }}
      />

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
  onInvoiceCreated: () => void;
  isSales: boolean;
  invoice?: Invoice | null;
  initialUser?: User;
}

export function InvoiceFormDialog({ isOpen, onOpenChange, onInvoiceCreated, isSales, invoice, initialUser }: InvoiceFormDialogProps) {
  const t = useTranslations('InvoicesPage.createDialog');
  const tRoot = useTranslations('InvoicesPage');
  const [users, setUsers] = React.useState<User[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [bookedInvoices, setBookedInvoices] = React.useState<Invoice[]>([]);
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
      currency: 'UYU',
      items: [],
      total: 0,
      notes: '',
      is_historical: false,
    },
  });

  const isEditing = !!invoice;
  const items = useWatch({ control: form.control, name: 'items' }) || [];
  const invoiceType = form.watch('type');

  const calculatedTotal = items.reduce((sum: number, item: any) => sum + (Number(item?.total) || 0), 0);

  React.useEffect(() => {
    form.setValue('total', calculatedTotal);
  }, [calculatedTotal, form]);

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
          // Fetch services and booked invoices (not users - they are fetched on demand with search)
          const [servicesResult, invoicesData] = await Promise.all([
            isSales ? getSalesServices({ limit: 100 }) : getPurchaseServices({ limit: 100 }),
            api.get(isSales ? API_ROUTES.SALES.INVOICES_ALL : API_ROUTES.PURCHASES.INVOICES_ALL, { is_sales: isSales ? 'true' : 'false', status: 'booked', type: 'invoice' })
          ]);

          const servicesDataNormalized = servicesResult.items || [];
          setServices(servicesDataNormalized.map((s: any) => ({ ...s, id: String(s.id) })));

          const invoicesDataNormalized = Array.isArray(invoicesData) ? invoicesData : (invoicesData.invoices || invoicesData.data || []);
          setBookedInvoices(invoicesDataNormalized);

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

            form.reset({
              type: (invoice.type?.toString().includes('credit') ? 'credit_note' : 'invoice') as any,
              user_id: userId,
              currency: (invoice.currency?.toUpperCase() as any) || 'UYU',
              total: Number(invoice.total || 0),
              order_id: invoice.order_id ? String(invoice.order_id) : undefined,
              quote_id: invoice.quote_id ? String(invoice.quote_id) : undefined,
              items: itemsNormalized.map((item: any) => {
                const rawServiceId = item.service_id || item.product_id;
                const serviceId = Array.isArray(rawServiceId) ? String(rawServiceId[0]) : String(rawServiceId || '');
                return {
                  id: item.id ? String(item.id) : undefined,
                  service_id: serviceId,
                  quantity: Number(item.quantity || item.product_uom_qty || 1),
                  unit_price: Number(item.unit_price || item.price_unit || 0),
                  total: Number(item.total || item.price_total || 0),
                };
              }),
            });
          } else {
            if (initialUser) {
              setUsers([initialUser]);
            }
            form.reset({
              type: 'invoice',
              user_id: initialUser ? initialUser.id : '',
              currency: 'UYU',
              items: [],
              total: 0,
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

  React.useEffect(() => {
    if (invoiceType === 'credit_note' && parentId && bookedInvoices.length > 0) {
      const parentInvoice = bookedInvoices.find(inv => String(inv.id) === parentId);
      if (parentInvoice) {
        form.setValue('user_id', String(parentInvoice.user_id));
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
      }
    }
  }, [parentId, invoiceType, bookedInvoices, isSales, form]);

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

      const endpoint = isSales ? API_ROUTES.SALES.INVOICES_UPSERT : API_ROUTES.PURCHASES.INVOICES_UPSERT;
      const payload = isEditing && invoice
        ? { ...values, id: invoice.id, is_sales: isSales }
        : { ...values, is_sales: isSales };

      const responseData = await api.post(endpoint, payload);

      if (responseData.error && responseData.code >= 400) {
        throw new Error(responseData.message || t('errors.generic'));
      }

      toast({ title: t('success.title'), description: isEditing ? (t('success.updateDescription') || 'Invoice updated successfully') : t('success.description') });

      onInvoiceCreated();
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
    form.setValue('items', [...items, { service_id: '', quantity: 1, unit_price: 0, total: 0 }]);
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
      <DialogContent maxWidth="4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 w-full overflow-hidden">
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
                <div className="text-right pt-7">
                  <span className="font-semibold text-lg">{t('total')}: {new Intl.NumberFormat('en-US', { style: 'currency', currency: form.watch('currency') }).format(calculatedTotal)}</span>
                </div>
              </div>
              {invoiceType === 'credit_note' && (
                <FormField
                  control={form.control}
                  name="parent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('parentInvoice')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectParentInvoice')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bookedInvoices.map(inv => (
                            <SelectItem key={inv.id} value={String(inv.id)}>
                              {inv.doc_no} - {inv.user_name} - ${inv.total}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="grid grid-cols-2 gap-4">
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

              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('notes')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('notesPlaceholder')} {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

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
                      <div className="flex-1">{t('items.service')}</div>
                      <div className="w-20">{t('items.quantity')}</div>
                      <div className="w-28">{t('items.unitPrice')}</div>
                      <div className="w-28">{t('items.total')}</div>
                      <div className="w-10"></div>
                    </div>
                    {items.map((item, index) => (
                      <div key={index} className="flex flex-col md:flex-row md:items-start gap-2">
                        <FormField control={form.control} name={`items.${index}.service_id`} render={({ field }) => (
                          <FormItem className="flex-1">
                            <ServiceSelector
                              isSales={isSales}
                              value={field.value}
                              onValueChange={(serviceId, service) => {
                                field.onChange(serviceId);
                                if (service) {
                                  const quantity = form.getValues(`items.${index}.quantity`) || 1;
                                  form.setValue(`items.${index}.unit_price`, service.price);
                                  form.setValue(`items.${index}.total`, service.price * quantity);
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
                          <FormItem className="w-full md:w-20"><FormControl><Input type="number" {...field} readOnly={invoiceType === 'credit_note'} onChange={(e) => {
                            if (invoiceType !== 'credit_note') {
                              field.onChange(e);
                              const price = form.getValues(`items.${index}.unit_price`) || 0;
                              form.setValue(`items.${index}.total`, price * Number(e.target.value), { shouldValidate: true });
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
                              const quantity = form.getValues(`items.${index}.quantity`) || 1;
                              form.setValue(`items.${index}.total`, quantity * numValue, { shouldValidate: true });
                            }
                          };

                          const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
                            const numValue = parseFloat(e.target.value);
                            if (!isNaN(numValue) && numValue >= 0) {
                              onChange(numValue);
                              setInputValue(numValue.toFixed(2));
                              if (invoiceType !== 'credit_note') {
                                const quantity = form.getValues(`items.${index}.quantity`) || 1;
                                form.setValue(`items.${index}.total`, quantity * numValue, { shouldValidate: true });
                              }
                            } else if (e.target.value !== '') {
                              onChange(0);
                              setInputValue('');
                            }
                          };

                          return (
                            <FormItem className="w-full md:w-28">
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
                          <FormItem className="w-full md:w-28"><FormControl><Input type="number" readOnly disabled {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveItem(index)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <FormMessage>{form.formState.errors.items?.root?.message}</FormMessage>
                  </div>
                </CardContent>
              </Card>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>{t('cancel')}</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? t('save') || 'Save Changes' : t('create')}
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
}
