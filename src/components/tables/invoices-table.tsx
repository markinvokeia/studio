
'use client';

import * as React from 'react';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Invoice, PaymentMethod, User, Order, Quote, Service, InvoiceItem, Credit } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MoreHorizontal, AlertTriangle, ArrowRight, Box, Printer, Send, FileUp, PlusCircle, CheckCircle, Trash2 } from 'lucide-react';
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
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '../ui/command';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';


const paymentFormSchema = (t: (key: string) => string) => z.object({
  amount: z.coerce.number().positive(t('validation.amountPositive')),
  method: z.string().min(1, t('validation.methodRequired')),
  status: z.enum(['pending', 'completed', 'failed']),
  payment_date: z.date({
    required_error: t('validation.dateRequired'),
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

const createInvoiceFormSchema = z.object({
    user_id: z.string().min(1, 'A user or provider is required.'),
    total: z.coerce.number().min(0, 'Total must be a non-negative number.'),
    currency: z.enum(['UYU', 'USD']),
    invoice_ref: z.string().optional(),
    order_id: z.string().optional(),
    quote_id: z.string().optional(),
    items: z.array(z.object({
      id: z.string().optional(),
      service_id: z.string().min(1, 'Service name is required'),
      quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
      unit_price: z.coerce.number().min(0, 'Unit price cannot be negative'),
      total: z.coerce.number().optional(),
    })).min(1, 'At least one item is required.'),
    type: z.enum(['invoice', 'credit_note']),
});
type CreateInvoiceFormValues = z.infer<typeof createInvoiceFormSchema>;

async function getServices(isSales: boolean): Promise<Service[]> {
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services?is_sales=${isSales}`, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return [];
    const data = await response.json();
    const servicesData = Array.isArray(data) ? data : (data.services || data.data || []);
    return servicesData.map((s: any) => ({ ...s, id: String(s.id) }));
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

const getColumns = (
    t: (key: string) => string,
    tStatus: (key: string) => string,
    tMethods: (key: string) => string,
    columnTranslations: { [key: string]: string },
    onPrint?: (invoice: Invoice) => void,
    onSendEmail?: (invoice: Invoice) => void,
    onAddPayment?: (invoice: Invoice) => void,
    onConfirm?: (invoice: Invoice) => void
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
};


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
  setRowSelection?: (selection: RowSelectionState) => void;
  columnTranslations?: { [key: string]: string };
  filterOptions?: { label: string; value: string }[];
  onFilterChange?: (value: string) => void;
  filterValue?: string;
  isSales?: boolean;
}

export function InvoicesTable({ invoices, isLoading = false, onRowSelectionChange, onRefresh, onPrint, onSendEmail, onCreate, onImport, onConfirm, isRefreshing, rowSelection, setRowSelection, columnTranslations = {}, filterOptions, onFilterChange, filterValue, isSales = true }: InvoicesTableProps) {
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
  const [userCredits, setUserCredits] = React.useState<Credit[]>([]);
  const [appliedCredits, setAppliedCredits] = React.useState<Map<string, number>>(new Map());

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

  const totalAppliedCredits = React.useMemo(() => {
    return Array.from(appliedCredits.values()).reduce((sum, amount) => sum + amount, 0);
  }, [appliedCredits]);

  const remainingAmountToPay = React.useMemo(() => {
    if (!selectedInvoiceForPayment) return 0;
    const amountPaid = form.getValues('amount') || 0;
    return selectedInvoiceForPayment.total - amountPaid - totalAppliedCredits;
  }, [selectedInvoiceForPayment, form, totalAppliedCredits]);

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

  const fetchUserCredits = React.useCallback(async (userId: string | undefined) => {
    if (!userId) {
        setUserCredits([]);
        return;
    };
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_credit?user_id=${userId}`);
        if(response.ok) {
            const data = await response.json();
            setUserCredits(data || []);
        } else {
            setUserCredits([]);
        }
    } catch (error) {
        console.error("Failed to fetch user credits", error);
        setUserCredits([]);
    }
  }, []);

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
            fetchUserCredits(invoice.user_id);
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
            setAppliedCredits(new Map());
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
            credit_payment: Array.from(appliedCredits.entries()).map(([id, amount]) => {
                const credit = userCredits.find(c => c.source_id === id);
                return {
                    source_id: id,
                    amount: amount,
                    type: credit?.type,
                    currency: credit?.currency,
                };
            }),
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
                is_sales: isSales
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

  const columns = React.useMemo(() => getColumns(t, tStatus, tMethods, columnTranslations, onPrint, onSendEmail, handleAddPaymentClick, onConfirm), [t, tStatus, tMethods, columnTranslations, onPrint, onSendEmail, onConfirm]);

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
      filterOptions={filterOptions}
      onFilterChange={onFilterChange}
      filterValue={filterValue}
      extraButtons={
         <>
          {onImport && (
            <Button variant="outline" size="sm" className="h-9" onClick={onImport}>
              <FileUp className="mr-2 h-4 w-4" /> Import
            </Button>
          )}
        </>
      }
    />

    <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
      <DialogContent className="max-w-2xl">
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
                {selectedInvoiceForPayment && (
                    <div className="flex justify-between items-center bg-muted p-3 rounded-md">
                        <span className="font-semibold text-lg">{t('paymentDialog.remainingAmount')}</span>
                        <span className="font-bold text-lg">{new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedInvoiceForPayment.currency || 'USD' }).format(remainingAmountToPay)}</span>
                    </div>
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

                 <div className={cn("space-y-2", userCredits.length === 0 && "opacity-50")}>
                    <h4 className="font-semibold">Use available Credit</h4>
                    <ScrollArea className="h-32 border rounded-md p-2">
                        {userCredits.length > 0 ? (
                            userCredits.map(credit => (
                                <div key={credit.source_id} className="flex items-center justify-between p-2">
                                    <div className="flex items-center gap-2">
                                        <Checkbox 
                                            id={`credit-${credit.source_id}`}
                                            onCheckedChange={(checked) => {
                                                const newApplied = new Map(appliedCredits);
                                                if (checked) {
                                                    const available = Number(credit.available_balance) || 0;
                                                    newApplied.set(credit.source_id, available);
                                                } else {
                                                    newApplied.delete(credit.source_id);
                                                }
                                                setAppliedCredits(newApplied);
                                            }}
                                            checked={appliedCredits.has(credit.source_id)}
                                        />
                                        <Label htmlFor={`credit-${credit.source_id}`}>
                                            {credit.type === 'credit_note' ? 'Credit Note' : 'Payment'} #{credit.source_id} ({credit.currency})
                                        </Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            className="h-8 w-24"
                                            max={credit.available_balance}
                                            value={appliedCredits.get(credit.source_id) || ''}
                                            onChange={(e) => {
                                                const newApplied = new Map(appliedCredits);
                                                const value = Math.min(Number(e.target.value), Number(credit.available_balance) || 0);
                                                newApplied.set(credit.source_id, value);
                                                setAppliedCredits(newApplied);
                                            }}
                                            disabled={!appliedCredits.has(credit.source_id)}
                                        />
                                        <span className="text-sm text-muted-foreground">/ {Number(credit.available_balance ?? 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                No credits available for this user.
                            </div>
                        )}
                    </ScrollArea>
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
  const [users, setUsers] = React.useState<User[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const { toast } = useToast();
  
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  const form = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceFormSchema),
    defaultValues: {
      type: 'invoice',
      user_id: '',
      currency: 'USD',
      items: [],
      total: 0,
    },
  });
  
  const items = form.watch('items');

  React.useEffect(() => {
    const total = items.reduce((sum, item) => sum + (item.total || 0), 0);
    form.setValue('total', total);
  }, [items, form]);
  
  React.useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const filterType = isSales ? 'PACIENTE' : 'PROVEEDOR';
          const [usersRes, servicesRes] = await Promise.all([
            fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users?filter_type=${filterType}`),
            fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services?is_sales=${isSales}`)
          ]);

          if (usersRes.ok) {
            const data = await usersRes.json();
            const usersData = (Array.isArray(data) && data.length > 0) ? data[0].data : (data.data || []);
            setUsers(usersData);
          }
          if (servicesRes.ok) {
            const data = await servicesRes.json();
            const servicesData = Array.isArray(data) ? data : (data.services || []);
            setServices(servicesData);
          }
        } catch (error) {
          console.error('Failed to fetch initial data', error);
        }
      };
      fetchData();
    }
  }, [isOpen, isSales]);


  const onSubmit = async (values: CreateInvoiceFormValues) => {
    setSubmissionError(null);
    try {
      const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/invoices/upsert', {
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
      form.reset();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : t('errors.generic'));
    }
  };

  const handleAddItem = () => {
    form.setValue('items', [...items, { service_id: '', quantity: 1, unit_price: 0, total: 0 }]);
  };
  
  const handleRemoveItem = (index: number) => {
    form.setValue('items', items.filter((_, i) => i !== index));
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{t('type')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="UYU">UYU</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}/>
                 <div className="text-right pt-7">
                    <span className="font-semibold text-lg">{t('total')}: {new Intl.NumberFormat('en-US', { style: 'currency', currency: form.watch('currency') }).format(form.watch('total'))}</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <FormField control={form.control} name="user_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('user')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t('selectUser')} /></SelectTrigger></FormControl>
                    <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="invoice_ref" render={({ field }) => (<FormItem><FormLabel>{t('invoiceRef')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
            </div>
            
            <Card>
              <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Invoice Items</CardTitle>
                    <Button type="button" size="sm" variant="outline" onClick={handleAddItem}>{t('addItem')}</Button>
                  </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <div className="flex-1">Service</div>
                        <div className="w-20">Quantity</div>
                        <div className="w-28">Unit Price</div>
                        <div className="w-28">Total</div>
                        <div className="w-10"></div>
                  </div>
                  {items.map((item, index) => (
                    <div key={index} className="flex flex-col md:flex-row md:items-start gap-2">
                       <FormField control={form.control} name={`items.${index}.service_id`} render={({ field }) => (
                         <FormItem className="flex-1">
                           <Select onValueChange={(value) => {
                               field.onChange(value);
                               const service = services.find(s => s.id === value);
                               if(service) {
                                const quantity = form.getValues(`items.${index}.quantity`) || 1;
                                form.setValue(`items.${index}.unit_price`, service.price);
                                form.setValue(`items.${index}.total`, service.price * quantity);
                               }
                           }} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Service" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                           </Select>
                           <FormMessage />
                         </FormItem>
                       )} />
                        <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                            <FormItem className="w-full md:w-20"><FormControl><Input type="number" {...field} onChange={(e) => {
                                field.onChange(e);
                                const price = form.getValues(`items.${index}.unit_price`) || 0;
                                form.setValue(`items.${index}.total`, price * Number(e.target.value));
                            }} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name={`items.${index}.unit_price`} render={({ field }) => (
                           <FormItem className="w-full md:w-28"><FormControl><Input type="number" {...field} onChange={(e) => {
                                field.onChange(e);
                                const quantity = form.getValues(`items.${index}.quantity`) || 1;
                                form.setValue(`items.${index}.total`, quantity * Number(e.target.value));
                            }} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name={`items.${index}.total`} render={({ field }) => (
                          <FormItem className="w-full md:w-28"><FormControl><Input type="number" readOnly disabled {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveItem(index)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                  ))}
                   <FormMessage>{form.formState.errors.items?.root?.message}</FormMessage>
                </div>
              </CardContent>
            </Card>

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
