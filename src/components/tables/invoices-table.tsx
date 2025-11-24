
'use client';

import * as React from 'react';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Invoice, PaymentMethod, User, Order, Quote } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MoreHorizontal, AlertTriangle, ArrowRight, Box, Printer, Send, FileUp } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';


const paymentFormSchema = (t: (key: string) => string) => z.object({
  amount: z.coerce.number().positive(t('amountPositive')),
  method: z.string().min(1, t('methodRequired')),
  status: z.enum(['pending', 'completed', 'failed']),
  payment_date: z.date({
    required_error: t('dateRequired'),
  }),
  invoice_currency: z.string(),
  payment_currency: z.string(),
  exchange_rate: z.coerce.number().optional(),
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

const invoiceFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  user_id: z.string().min(1, t('userRequired')),
  order_id: z.string().optional(),
  quote_id: z.string().optional(),
});
type InvoiceFormValues = z.infer<ReturnType<typeof invoiceFormSchema>>;

const getColumns = (
    t: (key: string) => string,
    tStatus: (key: string) => string,
    columnTranslations: { [key: string]: string },
    onPrint?: (invoice: Invoice) => void,
    onSendEmail?: (invoice: Invoice) => void,
    onAddPayment?: (invoice: Invoice) => void
  ): ColumnDef<Invoice>[] => [
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
        accessorKey: 'id',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={columnTranslations.id || "Invoice ID"} />
        ),
      },
      {
          accessorKey: 'user_name',
          header: ({ column }) => <DataTableColumnHeader column={column} title={columnTranslations.user_name || "User"} />,
      },
      {
          accessorKey: 'order_id',
          header: ({ column }) => <DataTableColumnHeader column={column} title={columnTranslations.order_id || "Order ID"} />,
      },
      {
          accessorKey: 'quote_id',
          header: ({ column }) => <DataTableColumnHeader column={column} title={columnTranslations.quote_id || "Quote ID"} />,
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
          return <div className="font-medium">{formatted}</div>;
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
          }[status?.toLowerCase()] ?? ('default' as any);
          return <Badge variant={variant} className="capitalize">{tStatus(status.toLowerCase())}</Badge>;
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
          return <Badge variant={variant} className="capitalize">{status ? tStatus(status.toLowerCase()) : ''}</Badge>;
        },
      },
       {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={columnTranslations.createdAt || "Created At"} />
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const invoice = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {onAddPayment && (
                    <DropdownMenuItem onClick={() => onAddPayment(invoice)}>
                        {t('paymentDialog.add')}
                    </DropdownMenuItem>
                )}
                {onPrint && (
                  <DropdownMenuItem onClick={() => onPrint(invoice)}>
                    <Printer className="mr-2 h-4 w-4" />
                    <span>Print</span>
                  </DropdownMenuItem>
                )}
                 {onSendEmail && (
                  <DropdownMenuItem onClick={() => onSendEmail(invoice)}>
                    <Send className="mr-2 h-4 w-4" />
                    <span>Send Email</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];

interface InvoicesTableProps {
  invoices: Invoice[];
  isLoading?: boolean;
  onRowSelectionChange?: (selectedRows: Invoice[]) => void;
  onRefresh?: () => void;
  onPrint?: (invoice: Invoice) => void;
  onSendEmail?: (invoice: Invoice) => void;
  onCreate?: () => void;
  onImport?: () => void;
  isRefreshing?: boolean;
  rowSelection?: RowSelectionState;
  setRowSelection?: (selection: RowSelectionState) => void;
  columnTranslations?: { [key: string]: string };
}

export function InvoicesTable({ invoices, isLoading = false, onRowSelectionChange, onRefresh, onPrint, onSendEmail, onCreate, onImport, isRefreshing, rowSelection, setRowSelection, columnTranslations = {} }: InvoicesTableProps) {
  const t = useTranslations('InvoicesPage');
  const tStatus = useTranslations('InvoicesPage.status');
  const tMethods = useTranslations('InvoicesPage.methods');
  const tValidation = useTranslations('InvoicesPage.validation');
  const { user } = useAuth();
  const locale = useLocale();

  const { toast } = useToast();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [isNoSessionAlertOpen, setIsNoSessionAlertOpen] = React.useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = React.useState<Invoice | null>(null);
  const [activeCashSessionId, setActiveCashSessionId] = React.useState<string | null>(null);
  const [paymentSubmissionError, setPaymentSubmissionError] = React.useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema(tValidation)),
    defaultValues: {
      status: 'completed',
    }
  });
  
  const watchedPaymentCurrency = form.watch('payment_currency');
  const watchedInvoiceCurrency = form.watch('invoice_currency');
  const watchedAmount = form.watch('amount');
  const watchedExchangeRate = form.watch('exchange_rate');

  const showExchangeRate = watchedInvoiceCurrency && watchedPaymentCurrency && watchedInvoiceCurrency !== watchedPaymentCurrency;

  const equivalentAmount = React.useMemo(() => {
    if (!showExchangeRate || !watchedAmount || !watchedExchangeRate) return null;
    if (watchedInvoiceCurrency === 'USD' && watchedPaymentCurrency === 'UYU') {
      return watchedAmount / watchedExchangeRate;
    }
    if (watchedInvoiceCurrency === 'UYU' && watchedPaymentCurrency === 'USD') {
      return watchedAmount * watchedExchangeRate;
    }
    return null;
  }, [showExchangeRate, watchedAmount, watchedExchangeRate, watchedInvoiceCurrency, watchedPaymentCurrency]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/metodospago/all');
      if (!response.ok) throw new Error('Failed to fetch payment methods');
      const data = await response.json();
      const methodsData = Array.isArray(data) ? data : (data.payment_methods || data.data || []);
      setPaymentMethods(methodsData.map((m: any) => ({ ...m, id: String(m.id) })));
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not load payment methods.'
      });
    }
  };

  const handleAddPaymentClick = async (invoice: Invoice) => {
    if (!user) return;

    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/active?user_id=${user.id}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();
        
        if (data.code === 200 && data.data?.id) {
            setSelectedInvoiceForPayment(invoice);
            setActiveCashSessionId(data.data.id);
            fetchPaymentMethods();
            form.reset({
                amount: invoice.total,
                method: '',
                status: 'completed',
                payment_date: new Date(),
                invoice_currency: invoice.currency || 'USD',
                payment_currency: invoice.currency || 'USD',
                exchange_rate: 1,
            });
            setPaymentSubmissionError(null);
            setIsPaymentDialogOpen(true);
        } else {
            setIsNoSessionAlertOpen(true);
        }
    } catch (error) {
        toast({
            variant: 'destructive',
            title: t('toast.error'),
            description: t('toast.sessionCheckError'),
        });
    }
  };
  
  const handlePaymentSubmit = async (values: PaymentFormValues) => {
    if (!selectedInvoiceForPayment || !activeCashSessionId) return;
    setPaymentSubmissionError(null);
    
    const selectedMethod = paymentMethods.find(pm => pm.id === values.method);

    let convertedAmount = values.amount;
    if (showExchangeRate && equivalentAmount) {
        convertedAmount = equivalentAmount;
    }

    try {
        const payload = {
            invoice_id: selectedInvoiceForPayment.id,
            cash_session_id: activeCashSessionId,
            user: user,
            query: JSON.stringify({
                invoice_id: parseInt(selectedInvoiceForPayment.id, 10),
                payment_date: values.payment_date.toISOString(),
                amount: values.amount,
                converted_amount: convertedAmount,
                method: selectedMethod?.name,
                payment_method_id: values.method,
                status: values.status,
                user: user,
                invoice_currency: selectedInvoiceForPayment.currency,
                payment_currency: values.payment_currency,
                exchange_rate: values.exchange_rate || 1,
            }),
        };

        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/invoice/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const responseData = await response.json();
        
        if (responseData.error || (responseData.code && responseData.code >= 400)) {
            const message = responseData.message || 'Failed to add payment.';
            throw new Error(message);
        }

        toast({
            title: t('paymentDialog.success'),
            description: t('paymentDialog.successDescription', { invoiceId: selectedInvoiceForPayment.id }),
        });
        
        if (onRefresh) {
            onRefresh();
        }

        setIsPaymentDialogOpen(false);
        setSelectedInvoiceForPayment(null);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t('paymentDialog.error');
        setPaymentSubmissionError(errorMessage);
    }
  };

    const columns = React.useMemo(() => getColumns(t, tStatus, columnTranslations, onPrint, onSendEmail, handleAddPaymentClick), [t, tStatus, columnTranslations, onPrint, onSendEmail]);

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
    <DataTable
      columns={columns}
      data={invoices}
      filterColumnId="id"
      filterPlaceholder={t('filterPlaceholder')}
      onRowSelectionChange={onRowSelectionChange}
      enableSingleRowSelection={!!onRowSelectionChange}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      onCreate={onCreate}
      rowSelection={rowSelection}
      setRowSelection={setRowSelection}
      columnTranslations={columnTranslations}
      extraButtons={onImport && (
        <Button variant="outline" size="sm" className="ml-2 h-8" onClick={onImport}>
          <FileUp className="mr-2 h-4 w-4" /> Import
        </Button>
      )}
    />

    <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('paymentDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('paymentDialog.description', { invoiceId: selectedInvoiceForPayment?.id })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePaymentSubmit)} className="space-y-4 py-4">
               {paymentSubmissionError && (
                  <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{t('toast.error')}</AlertTitle>
                      <AlertDescription>{paymentSubmissionError}</AlertDescription>
                  </Alert>
              )}
                <div className="grid grid-cols-3 gap-4">
                    <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem className="col-span-2">
                        <FormLabel>{t('paymentDialog.amount')} ({watchedPaymentCurrency})</FormLabel>
                        <FormControl>
                            <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="payment_currency"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="UYU">UYU</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>

                {showExchangeRate && (
                  <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
                    <FormField
                      control={form.control}
                      name="exchange_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exchange Rate</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {equivalentAmount !== null && (
                       <FormItem>
                          <FormLabel>Equivalent Amount ({watchedInvoiceCurrency})</FormLabel>
                          <FormControl>
                            <Input type="number" value={equivalentAmount.toFixed(2)} readOnly disabled />
                          </FormControl>
                        </FormItem>
                    )}
                  </div>
                )}

              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('paymentDialog.method')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('paymentDialog.selectMethod')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethods.map(method => (
                           <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('paymentDialog.status')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('paymentDialog.selectStatus')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="completed">{tStatus('completed')}</SelectItem>
                        <SelectItem value="pending">{tStatus('pending')}</SelectItem>
                        <SelectItem value="failed">{tStatus('failed')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('paymentDialog.date')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>{t('paymentDialog.pickDate')}</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsPaymentDialogOpen(false)}>{t('paymentDialog.cancel')}</Button>
                <Button type="submit">{t('paymentDialog.add')}</Button>
              </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={isNoSessionAlertOpen} onOpenChange={setIsNoSessionAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                    {t('noSessionDialog.title')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                    {t('noSessionDialog.description')}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{t('paymentDialog.cancel')}</AlertDialogCancel>
                <Link href={`/${locale}/cashier`} passHref>
                    <Button>
                        <Box className="mr-2 h-4 w-4" />
                        {t('noSessionDialog.openCashSession')}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </Link>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

interface CreateInvoiceDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onInvoiceCreated: () => void;
  isSales: boolean;
}

export function CreateInvoiceDialog({ isOpen, onOpenChange, onInvoiceCreated, isSales }: CreateInvoiceDialogProps) {
  const t = useTranslations('InvoicesPage.createDialog');
  const tValidation = useTranslations('InvoicesPage.createValidation');
  const [users, setUsers] = React.useState<User[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [quotes, setQuotes] = React.useState<Quote[]>([]);
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [isUserSearchOpen, setUserSearchOpen] = React.useState(false);
  const [isOrderSearchOpen, setOrderSearchOpen] = React.useState(false);
  const [isQuoteSearchOpen, setQuoteSearchOpen] = React.useState(false);
  const { toast } = useToast();
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema(tValidation)),
  });

  React.useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          const filterType = isSales ? 'PACIENTE' : 'PROVEEDOR';
          const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users?filter_type=${filterType}`);
          if (response.ok) {
            const data = await response.json();
            const usersData = (Array.isArray(data) && data.length > 0) ? data[0].data : (data.data || []);
            setUsers(usersData);
          }
        } catch (error) {
          console.error('Failed to fetch users', error);
        }
      };
      fetchUsers();
    }
  }, [isOpen, isSales]);

  React.useEffect(() => {
    if (selectedUserId) {
      const fetchUserOrders = async () => {
        try {
          const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_orders?user_id=${selectedUserId}&is_sales=${isSales}`);
          if (response.ok) {
            const data = await response.json();
            setOrders(data || []);
          }
        } catch (error) {
          console.error('Failed to fetch orders', error);
        }
      };
      const fetchUserQuotes = async () => {
        try {
          const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_quotes?user_id=${selectedUserId}&is_sales=${isSales}`);
          if (response.ok) {
            const data = await response.json();
            setQuotes(data || []);
          }
        } catch (error) {
          console.error('Failed to fetch quotes', error);
        }
      };
      fetchUserOrders();
      fetchUserQuotes();
      form.setValue('user_id', selectedUserId);
      form.setValue('order_id', undefined);
      form.setValue('quote_id', undefined);
    }
  }, [selectedUserId, form, isSales]);

  const onSubmit = async (values: InvoiceFormValues) => {
    setSubmissionError(null);
    try {
      const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...values, is_sales: isSales}),
      });
      const responseData = await response.json();
      if (!response.ok || (responseData.error && responseData.code >= 400)) {
        throw new Error(responseData.message || t('errors.generic'));
      }
      toast({ title: t('success.title'), description: t('success.description') });
      onInvoiceCreated();
      onOpenChange(false);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : t('errors.generic'));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             {submissionError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('errors.title')}</AlertTitle>
                <AlertDescription>{submissionError}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('user')}</FormLabel>
                   <Popover open={isUserSearchOpen} onOpenChange={setUserSearchOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                          {field.value ? users.find((user) => user.id === field.value)?.name : t('selectUser')}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder={t('searchUser')} />
                        <CommandList>
                          <CommandEmpty>{t('noUserFound')}</CommandEmpty>
                          <CommandGroup>
                            {users.map((user) => (
                              <CommandItem value={user.name} key={user.id} onSelect={() => { setSelectedUserId(user.id); setUserSearchOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", user.id === field.value ? "opacity-100" : "opacity-0")} />
                                {user.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('order')}</FormLabel>
                    <Popover open={isOrderSearchOpen} onOpenChange={setOrderSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" disabled={!selectedUserId} className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                            {field.value ? `Order #${field.value}` : t('selectOrder')}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder={t('searchOrder')} />
                          <CommandList>
                            <CommandEmpty>{t('noOrderFound')}</CommandEmpty>
                            <CommandGroup>
                              {orders.map((order) => (
                                <CommandItem value={order.id} key={order.id} onSelect={() => { form.setValue('order_id', order.id); setOrderSearchOpen(false); }}>
                                  <Check className={cn("mr-2 h-4 w-4", order.id === field.value ? "opacity-100" : "opacity-0")} />
                                  {`Order #${order.id}`}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quote_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('quote')}</FormLabel>
                    <Popover open={isQuoteSearchOpen} onOpenChange={setQuoteSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" disabled={!selectedUserId} className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                            {field.value ? `Quote #${field.value}` : t('selectQuote')}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder={t('searchQuote')} />
                          <CommandList>
                            <CommandEmpty>{t('noQuoteFound')}</CommandEmpty>
                            <CommandGroup>
                              {quotes.map((quote) => (
                                <CommandItem value={quote.id} key={quote.id} onSelect={() => { form.setValue('quote_id', quote.id); setQuoteSearchOpen(false); }}>
                                  <Check className={cn("mr-2 h-4 w-4", quote.id === field.value ? "opacity-100" : "opacity-0")} />
                                  {`Quote #${quote.id}`}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
              <Button type="submit">{t('create')}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    