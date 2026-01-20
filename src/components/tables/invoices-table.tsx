
'use client';

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Credit, Invoice, PaymentMethod, Service, User } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { format } from 'date-fns';
import { AlertTriangle, ArrowRight, Box, CalendarIcon, FileUp, Loader2, MoreHorizontal, Printer, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Calendar } from '../ui/calendar';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';


const paymentFormSchema = (t: (key: string) => string) => z.object({
  amount: z.coerce.number().min(0, t('validation.amountPositive')), // Allow 0
  method: z.string().optional(), // Optional
  status: z.enum(['pending', 'completed', 'failed']),
  payment_date: z.date({
    required_error: t('validation.dateRequired'),
  }),
  invoice_currency: z.string(),
  payment_currency: z.string(),
  exchange_rate: z.coerce.number().optional(),
}).refine(data => {
  if (data.amount > 0 && !data.method) {
    return false; // Method required if paying cash
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
  })).min(1, 'At least one item is required.'),
  type: z.enum(['invoice', 'credit_note']),
  parent_id: z.string().optional(),
});
type CreateInvoiceFormValues = z.infer<typeof createInvoiceFormSchema>;

async function getServices(isSales: boolean): Promise<Service[]> {
  try {
    const data = await api.get(API_ROUTES.SERVICES, { is_sales: isSales ? 'true' : 'false' });
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
      accessorKey: 'invoice_ref',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={columnTranslations.invoice_ref || "Invoice Ref"} />
      ),
      cell: ({ row }) => {
        const value = row.getValue('invoice_ref') as string;
        return <div className="font-medium">{value || '-'}</div>;
      },
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
  isSales?: boolean;
}

export function InvoicesTable({ invoices, isLoading = false, onRowSelectionChange, onRefresh, onPrint, onSendEmail, onCreate, onImport, onConfirm, isRefreshing, rowSelection, setRowSelection, columnTranslations = {}, filterOptions, onFilterChange, filterValue, isSales = true }: InvoicesTableProps) {
  const t = useTranslations('InvoicesPage');
  const tStatus = useTranslations('InvoicesPage.status');
  const tMethods = useTranslations('InvoicesPage.methods');
  const { user } = useAuth();
  const locale = useLocale();

  const { toast } = useToast();
  const [isFormDialogOpen, setIsFormDialogOpen] = React.useState(false);
  const [editingInvoice, setEditingInvoice] = React.useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [isNoSessionAlertOpen, setIsNoSessionAlertOpen] = React.useState(false);
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

  const watchedAmount = form.watch('amount');
  const watchedPaymentCurrency = form.watch('payment_currency');
  const watchedInvoiceCurrency = form.watch('invoice_currency');
  const watchedExchangeRate = form.watch('exchange_rate');

  const showExchangeRate = watchedInvoiceCurrency && watchedPaymentCurrency && watchedInvoiceCurrency !== watchedPaymentCurrency;

  const totalAppliedCredits = React.useMemo(() => {
    return Array.from(appliedCredits.values()).reduce((sum, amount) => sum + amount, 0);
  }, [appliedCredits]);

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

  // Update exchange rate when currencies change or session rate is loaded
  React.useEffect(() => {
    if (showExchangeRate) {
      form.setValue('exchange_rate', sessionExchangeRate);
    }
  }, [showExchangeRate, sessionExchangeRate, form]);

  const remainingAmountToPay = React.useMemo(() => {
    if (!selectedInvoiceForPayment) return 0;
    const invoiceTotal = selectedInvoiceForPayment.total || 0;
    const paidAmount = selectedInvoiceForPayment.paid_amount || 0;
    const invoiceCurrency = selectedInvoiceForPayment.currency || 'USD';

    // 1. Convert Manual Payment Amount to Invoice Currency
    let paymentAmountInInvoiceCurrency = 0;
    if (watchedAmount) {
      if (showExchangeRate && equivalentAmount) {
        paymentAmountInInvoiceCurrency = equivalentAmount;
      } else {
        paymentAmountInInvoiceCurrency = watchedAmount;
      }
    }

    // 2. Convert Credits to Invoice Currency
    const creditsTotalInInvoiceCurrency = Array.from(appliedCredits.entries()).reduce((sum, [creditId, amount]) => {
      const credit = userCredits.find(c => c.source_id === creditId);
      if (!credit) return sum;

      let creditAmountConverted = amount;

      // If credit currency differs from invoice currency, convert it
      if (credit.currency !== invoiceCurrency) {
        // Assuming sessionExchangeRate is always UYU per USD (or Local per Base)
        // If Invoice is USD and Credit is UYU: Divide by rate
        if (invoiceCurrency === 'USD' && credit.currency === 'UYU') {
          creditAmountConverted = amount / sessionExchangeRate;
        }
        // If Invoice is UYU and Credit is USD: Multiply by rate
        else if (invoiceCurrency === 'UYU' && credit.currency === 'USD') {
          creditAmountConverted = amount * sessionExchangeRate;
        }
      }
      return sum + creditAmountConverted;
    }, 0);

    return Math.max(0, invoiceTotal - paidAmount - paymentAmountInInvoiceCurrency - creditsTotalInInvoiceCurrency);
  }, [selectedInvoiceForPayment, watchedAmount, showExchangeRate, equivalentAmount, appliedCredits, userCredits, sessionExchangeRate]);

  const fetchPaymentMethods = async () => {
    try {
      const data = await api.get(API_ROUTES.PAYMENT_METHODS);
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
      const data = await api.get(API_ROUTES.USER_CREDIT, { user_id: userId });
      setUserCredits(data || []);
    } catch (error) {
      console.error("Failed to fetch user credits", error);
      setUserCredits([]);
    }
  }, []);

  const handleAddPaymentClick = async (invoice: Invoice) => {
    if (!user) return;

    try {
      const [sessionData, clinicData] = await Promise.all([
        api.get(API_ROUTES.CASHIER.CASH_POINTS_STATUS, { user_id: user.id }),
        api.get(API_ROUTES.CLINIC)
      ]);

      // Handle potential array response from n8n
      const sessionDataNormalized = Array.isArray(sessionData) ? sessionData[0] : (sessionData || {});

      console.log("Session Data:", sessionDataNormalized); // Debug log

      if (sessionDataNormalized && sessionDataNormalized.active_session_id) {
        setSelectedInvoiceForPayment(invoice);
        setActiveCashSessionId(sessionDataNormalized.active_session_id);

        // Set session exchange rate from opening_details if available, default to 1
        const rate = sessionDataNormalized.opening_details?.date_rate ? Number(sessionDataNormalized.opening_details.date_rate) : 1;
        setSessionExchangeRate(rate);

        // Set company currency
        const currency = clinicData.currency || 'USD';
        setCompanyCurrency(currency);

        fetchPaymentMethods();
        fetchUserCredits(invoice.user_id);

        form.reset({
          amount: invoice.total - (invoice.paid_amount || 0),
          method: '',
          status: 'completed',
          payment_date: new Date(),
          invoice_currency: invoice.currency || 'USD',
          payment_currency: invoice.currency || 'USD', // Default to invoice currency initially
          exchange_rate: 1, // Will be updated by useEffect or manual input
        });
        setPaymentSubmissionError(null);
        setAppliedCredits(new Map());
        setIsPaymentDialogOpen(true);
      } else {
        setIsNoSessionAlertOpen(true);
      }
    } catch (error) {
      console.error("Payment session check error:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: t('toast.sessionCheckError'),
      });
    }
  };

  const handlePaymentSubmit = async (values: PaymentFormValues) => {
    if (!selectedInvoiceForPayment || !activeCashSessionId) return;

    // Validate that we are paying SOMETHING
    const totalCredits = Array.from(appliedCredits.values()).reduce((a, b) => a + b, 0);
    if (values.amount <= 0 && totalCredits <= 0) {
      setPaymentSubmissionError(t('validation.noPaymentAmount'));
      return;
    }

    // Validate Overpayment
    const invoiceTotal = selectedInvoiceForPayment.total || 0;
    const paidAmount = selectedInvoiceForPayment.paid_amount || 0;
    const invoiceCurrency = selectedInvoiceForPayment.currency || 'USD';

    let paymentAmountInInvoiceCurrency = 0;
    if (values.amount) {
      if (showExchangeRate && equivalentAmount) {
        paymentAmountInInvoiceCurrency = equivalentAmount;
      } else {
        paymentAmountInInvoiceCurrency = values.amount;
      }
    }

    const creditsTotalInInvoiceCurrency = Array.from(appliedCredits.entries()).reduce((sum, [creditId, amount]) => {
      const credit = userCredits.find(c => c.source_id === creditId);
      if (!credit) return sum;

      let creditAmountConverted = amount;
      if (credit.currency !== invoiceCurrency) {
        if (invoiceCurrency === 'USD' && credit.currency === 'UYU') {
          creditAmountConverted = amount / sessionExchangeRate;
        }
        else if (invoiceCurrency === 'UYU' && credit.currency === 'USD') {
          creditAmountConverted = amount * sessionExchangeRate;
        }
      }
      return sum + creditAmountConverted;
    }, 0);

    const totalAttemptedPayment = paymentAmountInInvoiceCurrency + creditsTotalInInvoiceCurrency;
    const remainingBalance = invoiceTotal - paidAmount;

    // 1. Validate that the credit portion does not exceed the remaining balance
    if (creditsTotalInInvoiceCurrency > remainingBalance + 0.01) {
      setPaymentSubmissionError(t('validation.overpayment'));
      return;
    }

    // 2. Validate that credit-only payments do not exceed the balance
    // (If values.amount is 0 or less, totalAttemptedPayment must be <= remaining balance)
    if (values.amount <= 0 && totalAttemptedPayment > remainingBalance + 0.01) {
      setPaymentSubmissionError(t('validation.overpayment'));
      return;
    }

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
        client_user: { id: selectedInvoiceForPayment.user_id, name: selectedInvoiceForPayment.user_name, email: selectedInvoiceForPayment.userEmail },
        credit_payment: Array.from(appliedCredits.entries()).map(([id, amount]) => {
          const credit = userCredits.find(c => c.source_id === id);
          const invoiceCurrency = selectedInvoiceForPayment?.currency || 'USD';
          const exchangeRate = credit?.currency === invoiceCurrency ? 1 : sessionExchangeRate;
          return {
            source_id: id,
            amount: amount,
            type: credit?.type,
            currency: credit?.currency,
            exchange_rate: exchangeRate,
          };
        }),
        query: JSON.stringify({
          invoice_id: parseInt(selectedInvoiceForPayment.id, 10),
          payment_date: values.payment_date.toISOString(),
          amount: values.amount,
          converted_amount: convertedAmount,
          method: selectedMethod?.name || 'Credit', // Fallback name if only credit
          payment_method_id: values.method,
          status: values.status,
          user_id: selectedInvoiceForPayment.user_id,
          invoice_currency: selectedInvoiceForPayment.currency,
          payment_currency: values.payment_currency,
          exchange_rate: values.exchange_rate || 1,
          is_sales: isSales,
          total_paid: totalAttemptedPayment
        }),
      };

      const endpoint = isSales ? API_ROUTES.SALES.INVOICE_PAYMENT : API_ROUTES.PURCHASES.INVOICE_PAYMENT;
      const responseData = await api.post(endpoint, payload);

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
      const errorMessage = error instanceof Error ? error.message : 'Failed to add payment.';
      setPaymentSubmissionError(errorMessage);
    }
  };

  const columns = React.useMemo(() => getColumns(
    t,
    tStatus,
    tMethods,
    columnTranslations,
    onPrint,
    onSendEmail,
    handleAddPaymentClick,
    onConfirm,
    (invoice) => {
      setEditingInvoice(invoice);
      setIsFormDialogOpen(true);
    }
  ), [t, tStatus, tMethods, columnTranslations, onPrint, onSendEmail, onConfirm]);

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
      <DataTable
        columns={columns}
        data={invoices}
        filterColumnId="invoice_ref"
        filterPlaceholder={t('filterPlaceholder')}
        onRowSelectionChange={onRowSelectionChange}
        enableSingleRowSelection={!!onRowSelectionChange}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        onCreate={() => {
          setEditingInvoice(null);
          setIsFormDialogOpen(true);
        }}
        rowSelection={rowSelection}
        setRowSelection={setRowSelection}
columnTranslations={{
          invoice_ref: t('columns.invoiceRef'),
          user_name: t('columns.userName'),
          order_id: t('columns.orderId'),
          quote_id: t('columns.quoteId'),
          total: t('columns.total'),
          currency: t('columns.currency'),
          status: t('columns.status'),
          type: t('columns.type'),
          payment_status: t('columns.paymentStatus'),
          paid_amount: t('columns.paidAmount'),
          createdAt: t('columns.createdAt'),
        }}
        filterOptions={filterOptions}
        onFilterChange={onFilterChange}
        filterValue={filterValue}
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
              {selectedInvoiceForPayment?.type !== 'credit_note' && (
                <div className="space-y-2">
                  <h4 className="font-semibold">{t('paymentDialog.useCredits')}</h4>
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
                              {credit.type === 'credit_note' ? t('paymentDialog.creditNote') : t('paymentDialog.paymentRef')} #{credit.source_id} ({credit.currency})
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              className="h-8 w-24"
                              max={Number(credit.available_balance) || 0}
                              value={appliedCredits.get(credit.source_id) || ''}
                              onChange={(e) => {
                                const newApplied = new Map(appliedCredits);
                                const value = Math.min(Number(e.target.value), Number(credit.available_balance) || 0);
                                newApplied.set(credit.source_id, value);
                                setAppliedCredits(newApplied);
                              }}
                              disabled={!appliedCredits.has(credit.source_id)}
                            />
                            <span className="text-sm text-muted-foreground">/ {Number(credit.available_balance).toFixed(2)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        {t('paymentDialog.noCredits')}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-semibold text-sm">{t('paymentDialog.manualPayment')}</h4>
                <div className="grid grid-cols-2 gap-4">
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
                    name="payment_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('paymentDialog.date')}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
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
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
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
                        <FormLabel>{t('paymentDialog.currency')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('paymentDialog.selectCurrency')} />
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
              </div>

              {showExchangeRate && (
                <div className="grid grid-cols-2 gap-4 rounded-md border p-4 mt-4">
                  <FormField
                    control={form.control}
                    name="exchange_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('paymentDialog.exchangeRate')}</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {equivalentAmount !== null && (
                    <FormItem>
                      <FormLabel>{t('paymentDialog.equivalentAmount')} ({watchedInvoiceCurrency})</FormLabel>
                      <FormControl>
                        <Input type="number" value={equivalentAmount.toFixed(2)} readOnly disabled />
                      </FormControl>
                    </FormItem>
                  )}
                </div>
              )}
              <div className="rounded-md border p-4 bg-muted/50 space-y-3 mt-4">
                <h4 className="font-semibold text-sm">{t('paymentDialog.summary')}</h4>

                {showExchangeRate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('paymentDialog.exchangeRateApplied')}:</span>
                    <span>{sessionExchangeRate}</span>
                  </div>
                )}

                {appliedCredits.size > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">{t('paymentDialog.creditsApplied')}:</span>
                    {Array.from(appliedCredits.entries()).map(([id, amount]) => {
                      const credit = userCredits.find(c => c.source_id === id);
                      const invoiceCurrency = selectedInvoiceForPayment?.currency || 'USD';
                      let converted = amount;
                      if (credit && credit.currency !== invoiceCurrency) {
                        if (invoiceCurrency === 'USD' && credit.currency === 'UYU') converted = amount / sessionExchangeRate;
                        else if (invoiceCurrency === 'UYU' && credit.currency === 'USD') converted = amount * sessionExchangeRate;
                      }

                      return (
                        <div key={id} className="flex justify-between text-sm pl-2">
                          <span>#{id} ({credit?.currency})</span>
                          <div className="flex flex-col items-end">
                            <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: credit?.currency }).format(amount)}</span>
                            {credit?.currency !== invoiceCurrency && (
                              <span className="text-xs text-muted-foreground">
                                ≈ {new Intl.NumberFormat('en-US', { style: 'currency', currency: invoiceCurrency }).format(converted)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {watchedAmount > 0 && (
                  <div className="space-y-1 pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{t('paymentDialog.manualPayment')}:</span>
                      <div className="flex flex-col items-end">
                        <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: watchedPaymentCurrency }).format(watchedAmount)}</span>
                        {watchedPaymentCurrency !== (selectedInvoiceForPayment?.currency || 'USD') && equivalentAmount && (
                          <span className="text-xs text-muted-foreground">
                            ≈ {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedInvoiceForPayment?.currency || 'USD' }).format(equivalentAmount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t font-semibold">
                  <span>{t('paymentDialog.totalPayment')}:</span>
                  <span>
                    {(() => {
                      const invoiceCurrency = selectedInvoiceForPayment?.currency || 'USD';
                      let total = 0;
                      // Manual
                      if (watchedAmount) {
                        const amountVal = Number(watchedAmount);
                        total += (showExchangeRate && equivalentAmount) ? equivalentAmount : amountVal;
                      }
                      // Credits
                      Array.from(appliedCredits.entries()).forEach(([id, amount]) => {
                        const credit = userCredits.find(c => c.source_id === id);
                        let converted = amount;
                        if (credit && credit.currency !== invoiceCurrency) {
                          if (invoiceCurrency === 'USD' && credit.currency === 'UYU') converted = amount / sessionExchangeRate;
                          else if (invoiceCurrency === 'UYU' && credit.currency === 'USD') converted = amount * sessionExchangeRate;
                        }
                        total += converted;
                      });
                      return new Intl.NumberFormat('en-US', { style: 'currency', currency: invoiceCurrency }).format(total);
                    })()}
                  </span>
                </div>
              </div>

              {selectedInvoiceForPayment && (
                <div className="flex justify-between items-center bg-muted p-3 rounded-md">
                  <span className="font-semibold text-lg">{t('paymentDialog.remainingAmount')}</span>
                  <span className="font-bold text-lg">{new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedInvoiceForPayment.currency || 'USD' }).format(remainingAmountToPay)}</span>
                </div>
              )}
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

interface InvoiceFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onInvoiceCreated: () => void;
  isSales: boolean;
  invoice?: Invoice | null;
}

export function InvoiceFormDialog({ isOpen, onOpenChange, onInvoiceCreated, isSales, invoice }: InvoiceFormDialogProps) {
  const t = useTranslations('InvoicesPage.createDialog');
  const tRoot = useTranslations('InvoicesPage');
  const [users, setUsers] = React.useState<User[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [bookedInvoices, setBookedInvoices] = React.useState<Invoice[]>([]);
  const { toast } = useToast();

  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceFormSchema),
    defaultValues: {
      type: 'invoice',
      user_id: '',
      currency: 'UYU',
      items: [],
      total: 0,
    },
  });

  const isEditing = !!invoice;

  const items = form.watch('items');
  const invoiceType = form.watch('type');

  React.useEffect(() => {
    const total = items.reduce((sum, item) => sum + (item.total || 0), 0);
    form.setValue('total', total);
  }, [items, form]);

  React.useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const filterType = isSales ? 'PACIENTE' : 'PROVEEDOR';
          const [usersData, servicesData, invoicesData] = await Promise.all([
            api.get(API_ROUTES.USERS, { filter_type: filterType }),
            api.get(API_ROUTES.SERVICES, { is_sales: isSales ? 'true' : 'false' }),
            api.get(isSales ? API_ROUTES.SALES.INVOICES_ALL : API_ROUTES.PURCHASES.INVOICES_ALL, { is_sales: isSales ? 'true' : 'false', status: 'booked', type: 'invoice' })
          ]);

          const usersDataNormalized = (Array.isArray(usersData) && usersData.length > 0) ? usersData[0].data : (usersData.data || []);
          setUsers(usersDataNormalized.map((u: any) => ({ ...u, id: String(u.id) })));

          const servicesDataNormalized = Array.isArray(servicesData) ? servicesData : (servicesData.services || []);
          setServices(servicesDataNormalized.map((s: any) => ({ ...s, id: String(s.id) })));

          const invoicesDataNormalized = Array.isArray(invoicesData) ? invoicesData : (invoicesData.invoices || invoicesData.data || []);
          setBookedInvoices(invoicesDataNormalized);

          if (invoice) {
            // Load items for the invoice
            const itemsEndpoint = isSales ? API_ROUTES.SALES.INVOICE_ITEMS : API_ROUTES.PURCHASES.INVOICE_ITEMS;
            const itemsData = await api.get(itemsEndpoint, { invoice_id: invoice.id, is_sales: isSales ? 'true' : 'false' });
            const itemsNormalized = Array.isArray(itemsData) ? itemsData : (itemsData.invoice_items || itemsData.data || itemsData.result || []);

form.reset({
              type: (invoice.type?.toString().includes('credit') ? 'credit_note' : 'invoice') as any,
              user_id: Array.isArray(invoice.user_id) ? String(invoice.user_id[0]) : String(invoice.user_id || ''),
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
            form.reset({
              type: 'invoice',
              user_id: '',
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
  }, [isOpen, isSales, invoice, form]);


  const onSubmit = async (values: CreateInvoiceFormValues) => {
    setSubmissionError(null);
    setIsSubmitting(true);
    try {
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
    form.setValue('items', items.filter((_, i) => i !== index));
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? tRoot('editDialog.title') || 'Edit Invoice' : t('title')}</DialogTitle>
          <DialogDescription>{isEditing ? tRoot('editDialog.description') || 'Change invoice details and lines.' : t('description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
            console.error('Validation errors:', errors);
            toast({ variant: 'destructive', title: t('validation.errorTitle') || 'Submission Error', description: t('validation.checkFields') || 'Please check the form for errors.' });
          })} className="space-y-4 py-4">
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
                <span className="font-semibold text-lg">{t('total')}: {new Intl.NumberFormat('en-US', { style: 'currency', currency: form.watch('currency') }).format(form.watch('total'))}</span>
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
                            Invoice #{inv.id} - {inv.user_name} - ${inv.total}
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
                  <FormLabel>{t('user')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t('selectUser')} /></SelectTrigger></FormControl>
                    <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              
            </div>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{t('items.title')}</CardTitle>
                  <Button type="button" size="sm" variant="outline" onClick={handleAddItem}>{t('addItem')}</Button>
                </div>
              </CardHeader>
              <CardContent>
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
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              const service = services.find(s => s.id === value);
                              if (service) {
                                const quantity = form.getValues(`items.${index}.quantity`) || 1;
                                form.setValue(`items.${index}.unit_price`, service.price);
                                form.setValue(`items.${index}.total`, service.price * quantity);
                              }
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('items.selectService')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
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
                      )} />
                      <FormField control={form.control} name={`items.${index}.unit_price`} render={({ field }) => (
                        <FormItem className="w-full md:w-28"><FormControl><Input type="number" {...field} onChange={(e) => {
                          field.onChange(e);
                          const quantity = form.getValues(`items.${index}.quantity`) || 1;
                          form.setValue(`items.${index}.total`, quantity * Number(e.target.value));
                        }} /></FormControl><FormMessage /></FormItem>
                      )} />
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
