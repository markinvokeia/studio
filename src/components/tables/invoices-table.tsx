
'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DataTable } from '@/components/ui/data-table';
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

  const watchedAmount = form.watch('amount');
  const watchedPaymentCurrency = form.watch('payment_currency');
  const watchedInvoiceCurrency = form.watch('invoice_currency');
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

  React.useEffect(() => {
    const isSameAsClinicCurrency = watchedInvoiceCurrency === companyCurrency;
    if (showExchangeRate && watchedInvoiceCurrency !== watchedPaymentCurrency) {
      form.setValue('exchange_rate', isSameAsClinicCurrency ? 1 : sessionExchangeRate);
    } else if (!showExchangeRate) {
      form.setValue('exchange_rate', 1);
    }
  }, [showExchangeRate, sessionExchangeRate, form, watchedInvoiceCurrency, watchedPaymentCurrency, companyCurrency]);

  const creditsTotalInInvoiceCurrency = React.useMemo(() => {
    if (!selectedInvoiceForPayment) return 0;
    const invoiceCurrency = selectedInvoiceForPayment.currency || 'USD';

    return Array.from(appliedCredits.entries()).reduce((sum, [creditId, amount]) => {
      const credit = userCredits.find(c => c.source_id === creditId);
      if (!credit) return sum;

      let creditAmountConverted = amount;
      if (credit.currency !== invoiceCurrency) {
        if (invoiceCurrency === 'USD' && credit.currency === 'UYU') {
          creditAmountConverted = amount / sessionExchangeRate;
        } else if (invoiceCurrency === 'UYU' && credit.currency === 'USD') {
          creditAmountConverted = amount * sessionExchangeRate;
        }
      }
      return sum + creditAmountConverted;
    }, 0);
  }, [appliedCredits, userCredits, selectedInvoiceForPayment, sessionExchangeRate]);

  React.useEffect(() => {
    if (!selectedInvoiceForPayment) return;

    const invoiceTotal = selectedInvoiceForPayment.total || 0;
    const paidAmount = selectedInvoiceForPayment.paid_amount || 0;
    const invoiceCurrency = selectedInvoiceForPayment.currency || 'USD';
    const remainingBalance = Math.max(0, invoiceTotal - paidAmount - creditsTotalInInvoiceCurrency);

    const currentAmount = form.getValues('amount') || 0;
    const paymentCurrency = form.getValues('payment_currency') || invoiceCurrency;

    // Automatically adjust the manual amount to cover the remaining balance whenever credits change
    let amountToSet = remainingBalance;
    if (paymentCurrency !== invoiceCurrency && sessionExchangeRate > 0) {
      if (invoiceCurrency === 'USD' && paymentCurrency === 'UYU') {
        amountToSet = remainingBalance * sessionExchangeRate;
      } else if (invoiceCurrency === 'UYU' && paymentCurrency === 'USD') {
        amountToSet = remainingBalance / sessionExchangeRate;
      }
    }

    amountToSet = Math.round(amountToSet * 100) / 100;
    form.setValue('amount', amountToSet);
  }, [creditsTotalInInvoiceCurrency, selectedInvoiceForPayment, form, sessionExchangeRate, appliedCredits.size]);

  const remainingAmountToPay = React.useMemo(() => {
    if (!selectedInvoiceForPayment) return 0;
    const invoiceTotal = selectedInvoiceForPayment.total || 0;
    const paidAmount = selectedInvoiceForPayment.paid_amount || 0;

    let paymentAmountInInvoiceCurrency = 0;
    if (watchedAmount) {
      if (showExchangeRate && equivalentAmount) {
        paymentAmountInInvoiceCurrency = equivalentAmount;
      } else {
        paymentAmountInInvoiceCurrency = watchedAmount;
      }
    }

    const balance = invoiceTotal - paidAmount - paymentAmountInInvoiceCurrency - creditsTotalInInvoiceCurrency;
    // Round to 2 decimals to fix floating point issues (e.g., -0.00)
    const roundedBalance = Math.round(balance * 100) / 100;
    // Fix for -0.00 display: if balance is effectively 0, ensure it's positive 0
    return roundedBalance === 0 ? 0 : roundedBalance;
  }, [selectedInvoiceForPayment, watchedAmount, showExchangeRate, equivalentAmount, creditsTotalInInvoiceCurrency]);

  const fetchPaymentMethods = React.useCallback(async () => {
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
  }, [toast]);

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

  const handleAddPaymentClick = React.useCallback(async (invoice: Invoice) => {
    if (!user) return;

    try {
      const sessionValidation = await validateActiveSession();

      if (!sessionValidation.isValid) {
        setIsNoSessionAlertOpen(true);
        return;
      }

      const clinicData = await api.get(API_ROUTES.CLINIC);

      if (sessionValidation.exchangeRate) {
        setSessionExchangeRate(sessionValidation.exchangeRate);
      }

      setSelectedInvoiceForPayment(invoice);
      setActiveCashSessionId(sessionValidation.sessionId!);

      const currency = clinicData.currency || 'USD';
      setCompanyCurrency(currency);

      fetchPaymentMethods();
      fetchUserCredits(invoice.user_id);

      const invoiceCurrency = invoice.currency || 'USD';
      const exchangeRateFromSession = sessionValidation.exchangeRate || 1;
      const initialExchangeRate = invoiceCurrency === currency ? 1 : exchangeRateFromSession;

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
      console.error("Payment session check error:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: t('toast.sessionCheckError'),
      });
    }
  }, [user, validateActiveSession, form, toast, t, fetchPaymentMethods, fetchUserCredits]);

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

  const handlePaymentSubmit = async (values: PaymentFormValues) => {
    if (!selectedInvoiceForPayment || !activeCashSessionId) return;

    const totalCredits = Array.from(appliedCredits.values()).reduce((a, b) => a + b, 0);
    if (values.amount <= 0 && totalCredits <= 0) {
      setPaymentSubmissionError(t('validation.noPaymentAmount'));
      return;
    }

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

    if (creditsTotalInInvoiceCurrency > remainingBalance + 0.01) {
      setPaymentSubmissionError(t('validation.overpayment'));
      return;
    }

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
          method: selectedMethod?.name || 'Credit',
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
        description: t('paymentDialog.successDescription', { invoiceId: selectedInvoiceForPayment.doc_no || selectedInvoiceForPayment.id }),
      });

      await checkActiveSession();

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
            enableSingleRowSelection={!!onRowSelectionChange}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            onCreate={canCreate ? () => {
              setEditingInvoice(null);
              setIsFormDialogOpen(true);
            } : undefined}
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
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
          />
        </CardContent>
      </Card>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent maxWidth="2xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePaymentSubmit)} className="flex flex-col flex-1 w-full overflow-hidden">
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className="header-icon-circle mt-0.5">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <DialogTitle>{t('paymentDialog.title')}</DialogTitle>
                    <DialogDescription>
                      {t('paymentDialog.description', { invoiceId: selectedInvoiceForPayment?.doc_no || selectedInvoiceForPayment?.id })}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <DialogBody className="space-y-4 py-4 px-6">
                {paymentSubmissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('toast.error')}</AlertTitle>
                    <AlertDescription>{paymentSubmissionError}</AlertDescription>
                  </Alert>
                )}
                {selectedInvoiceForPayment?.type !== 'credit_note' && userCredits.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">{t('paymentDialog.useCredits')}</h4>
                    <ScrollArea className="h-32 border rounded-md p-2">
                      {userCredits.map(credit => (
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
                      ))}
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
                              <DatePicker
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date: Date) =>
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
                      render={({ field: { onChange, value } }) => (
                        <FormItem>
                          <FormLabel>{t('paymentDialog.amount')} ({watchedPaymentCurrency})</FormLabel>
                          <FormControl>
                            <FormattedNumberInput
                              value={value}
                              onChange={onChange}
                              placeholder="0.00"
                            />
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
                      render={({ field: { onChange, value } }) => (
                        <FormItem>
                          <FormLabel>{t('paymentDialog.exchangeRate')}</FormLabel>
                          <FormControl>
                            <FormattedNumberInput
                              value={value}
                              onChange={onChange}
                              placeholder="0.00"
                            />
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
                      <span>{Number(sessionExchangeRate).toFixed(2)}</span>
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
                        let total = creditsTotalInInvoiceCurrency;
                        if (watchedAmount) {
                          const amountVal = Number(watchedAmount);
                          total += (showExchangeRate && equivalentAmount) ? equivalentAmount : amountVal;
                        }
                        return new Intl.NumberFormat('en-US', { style: 'currency', currency: invoiceCurrency }).format(Math.round(total * 100) / 100);
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
              </DialogBody>
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
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="flex flex-col text-left">
                <AlertDialogTitle>{t('noSessionDialog.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('noSessionDialog.description')}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('paymentDialog.cancel')}</AlertDialogCancel>
            {canAccessCashier && (
              <Link href={`/${locale}/cashier`} passHref>
                <Button>
                  <Box className="mr-2 h-4 w-4" />
                  {t('noSessionDialog.openCashSession')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  const [isSearchingUsers, setIsSearchingUsers] = React.useState(false);
  const [userSearchOpen, setUserSearchOpen] = React.useState(false);
  const [userSearchQuery, setUserSearchQuery] = React.useState('');
  const [serviceSearchOpen, setServiceSearchOpen] = React.useState<Record<number, boolean>>({});
  const [serviceSearchQuery, setServiceSearchQuery] = React.useState('');
  const [isSearchingServices, setIsSearchingServices] = React.useState(false);

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
          const invoicesData = await api.get(isSales ? API_ROUTES.SALES.INVOICES_ALL : API_ROUTES.PURCHASES.INVOICES_ALL, { is_sales: isSales ? 'true' : 'false', status: 'booked', type: 'invoice' });
          const invoicesDataNormalized = Array.isArray(invoicesData) ? invoicesData : (invoicesData.invoices || invoicesData.data || []);
          setBookedInvoices(invoicesDataNormalized);

          if (invoice) {
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
  }, [isOpen, invoice, isSales, form]);

  const parentId = form.watch('parent_id');

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
                    <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
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
                        <Command>
                          <CommandInput
                            placeholder={isSales ? t('searchPatient') : t('searchProvider')}
                            onValueChange={setUserSearchQuery}
                          />
                          <CommandList>
                            <CommandEmpty>{isSearchingUsers ? tRoot('createDialog.searching') : tRoot('createDialog.noUserFound')}</CommandEmpty>
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
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

              </div>

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
                            <Popover 
                              open={serviceSearchOpen[index]} 
                              onOpenChange={(open) => {
                                setServiceSearchOpen(prev => ({ ...prev, [index]: open }));
                                if (open) setServiceSearchQuery('');
                              }}
                            >
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button 
                                    variant="outline" 
                                    role="combobox" 
                                    className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                    disabled={invoiceType === 'credit_note'}
                                  >
                                    <span className="truncate mr-2 text-left">
                                      {field.value
                                        ? (services.find(s => s.id === field.value)?.name || t('items.selectService'))
                                        : t('items.selectService')}
                                    </span>
                                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                  <CommandInput
                                    placeholder={t('items.searchService')}
                                    onValueChange={setServiceSearchQuery}
                                  />
                                  <CommandList>
                                    <CommandEmpty>{isSearchingServices ? t('searching') : t('noUserFound')}</CommandEmpty>
                                    <CommandGroup>
                                      {services.map((s) => (
                                        <CommandItem
                                          value={s.name}
                                          key={s.id}
                                          onSelect={() => {
                                            field.onChange(s.id);
                                            const quantity = form.getValues(`items.${index}.quantity`) || 1;
                                            form.setValue(`items.${index}.unit_price`, s.price, { shouldValidate: true });
                                            form.setValue(`items.${index}.total`, s.price * quantity, { shouldValidate: true });
                                            setServiceSearchOpen(prev => ({ ...prev, [index]: false }));
                                          }}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4", s.id === field.value ? "opacity-100" : "opacity-0")} />
                                          {s.name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
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
