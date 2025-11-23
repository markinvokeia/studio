'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MiscellaneousTransaction, MiscellaneousCategory, User, CajaSesion, PaymentMethod } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, PlusCircle, ChevronsUpDown, Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ColumnDef, ColumnFiltersState, PaginationState, VisibilityState } from '@tanstack/react-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { useAuth } from '@/context/AuthContext';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';

const transactionFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    category_id: z.string().min(1, t('categoryRequired')),
    transaction_date: z.date({ required_error: t('dateRequired')}),
    amount: z.coerce.number().positive(t('amountPositive')),
    description: z.string().min(10, t('descriptionMin')),
    beneficiary_id: z.string().optional(),
    currency: z.enum(['UYU', 'USD', 'EUR']).default('UYU'),
    exchange_rate: z.coerce.number().optional().default(1),
    external_reference: z.string().optional(),
    tags: z.array(z.string()).optional(),
});

type TransactionFormValues = z.infer<ReturnType<typeof transactionFormSchema>>;

const completeTransactionSchema = (t: (key: string) => string) => z.object({
  cash_session_id: z.string().min(1, t('sessionRequired')),
  payment_method_id: z.string().min(1, t('paymentMethodRequired')),
});

type CompleteTransactionFormValues = z.infer<ReturnType<typeof completeTransactionSchema>>;

const MOCK_DATA: MiscellaneousTransaction[] = [
    { id: '1', transaction_number: 'MISC202411-0001', transaction_date: '2024-11-15', category_name: 'Salarios', category_type: 'expense', beneficiary_name: 'John Doe', beneficiary_type: 'Empleado', amount: 2500, currency: 'USD', exchange_rate: 1, converted_amount: 2500, payment_method_name: 'Bank Transfer', external_reference: 'INV-123', description: 'Pago de salario mensual', status: 'pending', created_by: 'Admin', created_at: '2024-11-15T10:00:00Z', completed_at: null, cash_session_id: null, tags: ['payroll', 'monthly'] },
    { id: '2', transaction_number: 'MISC202411-0002', transaction_date: '2024-11-14', category_name: 'Venta de Activos', category_type: 'income', beneficiary_name: 'Comprador Anónimo', beneficiary_type: 'Otro', amount: 500, currency: 'USD', exchange_rate: 1, converted_amount: 500, payment_method_name: 'Cash', external_reference: 'REC-456', description: 'Venta de silla de oficina usada', status: 'completed', created_by: 'Admin', created_at: '2024-11-14T15:30:00Z', completed_at: '2024-11-14T15:32:00Z', cash_session_id: 'SESS-001', tags: ['asset-sale'] },
];

const getColumns = (t: (key: string) => string): ColumnDef<MiscellaneousTransaction>[] => [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.id')} /> },
    { accessorKey: 'transaction_number', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.transactionNumber')} /> },
    { accessorKey: 'transaction_date', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.date')} /> },
    { accessorKey: 'category_name', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.category')} />,
      cell: ({ row }) => {
        const type = row.original.category_type;
        return <Badge variant={type === 'income' ? 'success' : 'destructive'}>{row.original.category_name}</Badge>
      }
    },
    { accessorKey: 'category_type', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.type')} /> },
    { accessorKey: 'beneficiary_name', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.beneficiary')} /> },
    { accessorKey: 'beneficiary_type', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.beneficiaryType')} /> },
    { accessorKey: 'amount', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.amount')} />,
      cell: ({ row }) => {
        const type = row.original.category_type;
        const amount = parseFloat(row.original.amount.toString());
        const colorClass = type === 'income' ? 'text-green-600' : 'text-red-600';
        return <div className={cn("font-medium text-right", colorClass)}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: row.original.currency }).format(amount)}</div>;
      }
    },
    { accessorKey: 'currency', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.currency')} /> },
    { accessorKey: 'exchange_rate', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.exchangeRate')} /> },
    { accessorKey: 'converted_amount', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.convertedAmount')} />,
      cell: ({ row }) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'UYU' }).format(row.original.converted_amount)
    },
    { accessorKey: 'payment_method_name', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.paymentMethod')} /> },
    { accessorKey: 'external_reference', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.reference')} /> },
    { accessorKey: 'description', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.description')} /> },
    { accessorKey: 'status', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.status')} />,
      cell: ({ row }) => {
        const status = row.original.status;
        const variant = status === 'completed' ? 'success' : status === 'pending' ? 'info' : 'destructive';
        return <Badge variant={variant} className="capitalize">{status}</Badge>
      }
    },
    { accessorKey: 'created_by', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.createdBy')} /> },
    { accessorKey: 'created_at', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.createdAt')} />, cell: ({row}) => format(parseISO(row.original.created_at), 'yyyy-MM-dd HH:mm')},
    { accessorKey: 'completed_at', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.completedAt')} />, cell: ({row}) => row.original.completed_at ? format(parseISO(row.original.completed_at), 'yyyy-MM-dd HH:mm') : '-'},
    { accessorKey: 'cash_session_id', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.cashSession')} /> },
    { accessorKey: 'tags', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.tags')} />,
      cell: ({ row }) => <div className="flex flex-wrap gap-1">{row.original.tags?.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
    },
];

export default function MiscellaneousTransactionsPage() {
    const t = useTranslations('MiscellaneousTransactionsPage');
    const tValidation = useTranslations('MiscellaneousTransactionsPage.validation');
    const [transactions, setTransactions] = React.useState<MiscellaneousTransaction[]>(MOCK_DATA);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingTransaction, setEditingTransaction] = React.useState<MiscellaneousTransaction | null>(null);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [visibility, setVisibility] = React.useState<VisibilityState>({ id: false });
    const [quickFilter, setQuickFilter] = React.useState('pending');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [totalIncome, setTotalIncome] = React.useState(0);
    const [totalExpense, setTotalExpense] = React.useState(0);

    const form = useForm<TransactionFormValues>({
        resolver: zodResolver(transactionFormSchema(tValidation)),
    });

    const columns = getColumns(t);
    
    // TODO: Connect to backend
    const loadTransactions = React.useCallback(() => {
        setIsRefreshing(true);
        // This would fetch from backend, applying filters
        setTimeout(() => {
            setTransactions(MOCK_DATA);
            setTotalIncome(500);
            setTotalExpense(2500);
            setIsRefreshing(false);
        }, 500);
    }, []);

    React.useEffect(() => {
        loadTransactions();
    }, [loadTransactions]);

    const handleCreate = () => {
        setEditingTransaction(null);
        form.reset({
            transaction_date: new Date(),
            currency: 'UYU',
            exchange_rate: 1,
        });
        setIsDialogOpen(true);
    };

    const QuickFilterButton = ({ filter, label }: { filter: string, label: string }) => (
        <Button variant={quickFilter === filter ? 'default' : 'outline'} size="sm" onClick={() => setQuickFilter(filter)}>{label}</Button>
    );

  return (
    <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('dashboard.totalIncome')}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-green-600">${totalIncome.toFixed(2)}</p></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('dashboard.totalExpense')}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-red-600">${totalExpense.toFixed(2)}</p></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('dashboard.balance')}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-blue-600">${(totalIncome - totalExpense).toFixed(2)}</p></CardContent>
            </Card>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm">
                                {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, 'LLL dd, y')} - ${format(dateRange.to, 'LLL dd, y')}` : format(dateRange.from, 'LLL dd, y')) : t('filters.dateRange')}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="range" selected={dateRange} onSelect={setDateRange} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <div className="flex flex-wrap items-center gap-1">
                        <QuickFilterButton filter="pending" label={t('filters.pending')} />
                        <QuickFilterButton filter="completed_today" label={t('filters.completedToday')} />
                        <QuickFilterButton filter="income_month" label={t('filters.incomeMonth')} />
                        <QuickFilterButton filter="expense_month" label={t('filters.expenseMonth')} />
                        <QuickFilterButton filter="salaries" label={t('filters.salaries')} />
                        <QuickFilterButton filter="services" label={t('filters.services')} />
                        <QuickFilterButton filter="taxes" label={t('filters.taxes')} />
                    </div>
                </div>
                <DataTable
                    columns={columns}
                    data={transactions}
                    pageCount={Math.ceil(transactions.length / pagination.pageSize)}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                    columnFilters={columnFilters}
                    onColumnFiltersChange={setColumnFilters}
                    columnVisibility={visibility}
                    onColumnVisibilityChange={setVisibility}
                    manualPagination={true}
                    filterColumnId="description"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={handleCreate}
                    onRefresh={loadTransactions}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        {/* Dialogs will go here */}
    </div>
  );
}
