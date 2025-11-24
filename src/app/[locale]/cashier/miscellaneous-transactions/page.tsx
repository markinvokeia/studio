
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
import { AlertTriangle, PlusCircle, ChevronsUpDown, Check, X, MoreHorizontal } from 'lucide-react';
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

type GetTransactionsResponse = {
  transactions: MiscellaneousTransaction[];
  total: number;
};

async function getMiscellaneousTransactions(pagination: PaginationState, searchQuery: string): Promise<GetTransactionsResponse> {
    try {
        const params = new URLSearchParams({
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
            search: searchQuery,
        });
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/misc_transactions?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const responseData = await response.json();
        const data = Array.isArray(responseData) ? responseData : (responseData.data || []);

        const transactionsData = data || [];
        const total = Number(responseData.total) || transactionsData.length;

        return {
            transactions: transactionsData.map((t: any) => ({
                id: String(t.id),
                transaction_number: t.transaction_number,
                transaction_date: t.transaction_date,
                amount: parseFloat(t.amount),
                currency: t.currency,
                exchange_rate: parseFloat(t.exchange_rate),
                converted_amount: parseFloat(t.converted_amount),
                description: t.description,
                external_reference: t.reference_number,
                status: t.status,
                category_id: t.category_id,
                category_code: t.category_code,
                category_name: t.category_name,
                category_type: t.category_type,
                beneficiary_id: t.beneficiary_id,
                beneficiary_name: t.beneficiary_name,
                beneficiary_type: t.beneficiary_type,
                created_by: t.created_by_name,
                created_at: t.created_at,
                payment_method_id: t.payment_method_id,
                payment_method_name: t.payment_method_name,
                cash_session_id: t.cash_session_id,
                tags: t.tags,
                is_recurring: t.is_recurring,
                recurrence_pattern: t.recurrence_pattern,
                completed_at: t.completed_at,
            })),
            total
        };
    } catch (error) {
        console.error("Failed to fetch miscellaneous transactions:", error);
        return { transactions: [], total: 0 };
    }
}

async function upsertMiscellaneousTransaction(transactionData: TransactionFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/misc_transactions/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400) || responseData.error) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message) || 'Failed to save transaction';
        throw new Error(message);
    }
    return responseData;
}

async function deleteMiscellaneousTransaction(id: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/misc_transactions/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400) || responseData.error) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message) || 'Failed to delete transaction';
        throw new Error(message);
    }
    return responseData;
}


export default function MiscellaneousTransactionsPage() {
    const t = useTranslations('MiscellaneousTransactionsPage');
    const tValidation = useTranslations('MiscellaneousTransactionsPage.validation');
    const { toast } = useToast();
    const [transactions, setTransactions] = React.useState<MiscellaneousTransaction[]>([]);
    const [transactionCount, setTransactionCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingTransaction, setEditingTransaction] = React.useState<MiscellaneousTransaction | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingTransaction, setDeletingTransaction] = React.useState<MiscellaneousTransaction | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
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

    const handleEdit = (transaction: MiscellaneousTransaction) => {
        setEditingTransaction(transaction);
        form.reset({
            id: transaction.id,
            category_id: transaction.category_id,
            transaction_date: new Date(transaction.transaction_date),
            amount: transaction.amount,
            description: transaction.description,
            beneficiary_id: transaction.beneficiary_id,
            currency: transaction.currency as any,
            exchange_rate: transaction.exchange_rate,
            external_reference: transaction.external_reference,
            tags: transaction.tags,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (transaction: MiscellaneousTransaction) => {
        setDeletingTransaction(transaction);
        setIsDeleteDialogOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!deletingTransaction) return;
        try {
            await deleteMiscellaneousTransaction(deletingTransaction.id);
            toast({ title: "Transaction Deleted", description: `Transaction #${deletingTransaction.transaction_number} deleted.` });
            setIsDeleteDialogOpen(false);
            setDeletingTransaction(null);
            loadTransactions();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : "Could not delete transaction.",
            });
        }
    };


    const getColumns = (t: (key: string) => string): ColumnDef<MiscellaneousTransaction>[] => [
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.id')} /> },
        { accessorKey: 'transaction_number', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.transactionNumber')} /> },
        { accessorKey: 'transaction_date', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.date')} />, cell: ({row}) => format(parseISO(row.original.transaction_date), 'yyyy-MM-dd') },
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
         {
            id: 'actions',
            cell: ({ row }) => {
                const transaction = row.original;
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
                        <DropdownMenuItem onClick={() => handleEdit(transaction)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(transaction)} className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];
    const columns = getColumns(t);
    
    const loadTransactions = React.useCallback(async () => {
        setIsRefreshing(true);
        const searchQuery = (columnFilters.find(f => f.id === 'description')?.value as string) || '';
        const { transactions, total } = await getMiscellaneousTransactions(pagination, searchQuery);
        setTransactions(transactions);
        setTransactionCount(total);
        setTotalIncome(transactions.filter(t => t.category_type === 'income').reduce((sum, t) => sum + t.amount, 0));
        setTotalExpense(transactions.filter(t => t.category_type === 'expense').reduce((sum, t) => sum + t.amount, 0));
        setIsRefreshing(false);
    }, [pagination, columnFilters]);

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

    const onSubmit = async (values: TransactionFormValues) => {
        setSubmissionError(null);
        try {
            await upsertMiscellaneousTransaction(values);
            toast({ title: editingTransaction ? "Transaction Updated" : "Transaction Created", description: "Transaction saved successfully." });
            setIsDialogOpen(false);
            loadTransactions();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : "An unexpected error occurred.");
        }
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
                    pageCount={Math.ceil(transactionCount / pagination.pageSize)}
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
         <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Create Transaction'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                         {submissionError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{submissionError}</AlertDescription></Alert>}
                        {/* Form fields will be added here */}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit">{editingTransaction ? 'Save Changes' : 'Create'}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
         <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete transaction #{deletingTransaction?.transaction_number}.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
