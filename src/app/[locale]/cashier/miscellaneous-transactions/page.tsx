
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    transaction_date: z.string().min(1, t('dateRequired')),
    amount: z.coerce.number().positive(t('amountPositive')),
    description: z.string().min(1, t('descriptionRequired')),
    beneficiary_id: z.string().optional(),
    currency: z.enum(['UYU', 'USD', 'EUR']).default('UYU'),
    exchange_rate: z.coerce.number().optional().default(1),
    external_reference: z.string().optional(),
    tags: z.string().optional(),
    payment_method_id: z.string().optional(),
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
        
        const data = await response.json();

        const transactionsData = Array.isArray(data) ? data : (data.data || []);
        const total = Number(data[0]?.total) || transactionsData.length;

        return {
            transactions: transactionsData.map((t: any) => ({
                id: String(t.id),
                transaction_number: t.transaction_number,
                transaction_date: t.transaction_date,
                amount: parseFloat(t.amount),
                currency: t.currency || t.transaction_currency,
                exchange_rate: parseFloat(t.exchange_rate),
                converted_amount: parseFloat(t.converted_amount),
                description: t.description,
                external_reference: t.reference_number,
                status: t.status,
                category_id: String(t.category_id),
                category_code: t.category_code,
                category_name: t.category_name,
                category_type: t.category_type,
                beneficiary_id: t.beneficiary_id ? String(t.beneficiary_id) : undefined,
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

async function getBeneficiaries(searchQuery: string): Promise<User[]> {
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users?search=${searchQuery}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch beneficiaries');
        const data = await response.json();
        const usersData = (Array.isArray(data) && data.length > 0) ? data[0].data : (data.data || []);
        return usersData.map((user: any) => ({ ...user, id: String(user.id) }));
    } catch (error) {
        console.error("Failed to fetch beneficiaries:", error);
        return [];
    }
}

async function getCategories(): Promise<MiscellaneousCategory[]> {
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/misc_categories`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        return (data || []).map((cat: any) => ({ ...cat, id: String(cat.id), category_type: cat.type }));
    } catch (error) {
        console.error("Failed to fetch categories:", error);
        return [];
    }
}

async function getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/metodospago/all', {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();
        const methodsData = Array.isArray(data) ? data : (data.payment_methods || data.data || []);
        return methodsData.map((m: any) => ({ ...m, id: String(m.id) }));
    } catch (error) {
        console.error("Failed to fetch payment methods:", error);
        return [];
    }
}


async function upsertMiscellaneousTransaction(transactionData: TransactionFormValues, userId: string) {
    const payload = {
        ...transactionData,
        created_by: userId,
        tags: transactionData.tags?.split(',').map(t => t.trim()).filter(t => t),
        beneficiary_id: transactionData.beneficiary_id || null,
        payment_method_id: transactionData.payment_method_id ? parseInt(transactionData.payment_method_id, 10) : null,
        category_id: parseInt(transactionData.category_id, 10),
    };
    
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/misc_transactions/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    const { user } = useAuth();
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
    
    const [beneficiaries, setBeneficiaries] = React.useState<User[]>([]);
    const [categories, setCategories] = React.useState<MiscellaneousCategory[]>([]);
    const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
    const [beneficiarySearch, setBeneficiarySearch] = React.useState('');
    const [isBeneficiaryOpen, setIsBeneficiaryOpen] = React.useState(false);
    const [isCategoryOpen, setIsCategoryOpen] = React.useState(false);


    const form = useForm<TransactionFormValues>({
        resolver: zodResolver(transactionFormSchema(tValidation)),
    });
    
    React.useEffect(() => {
        if (isDialogOpen) {
            getCategories().then(setCategories);
            getPaymentMethods().then(setPaymentMethods);
        }
    }, [isDialogOpen]);
    
    React.useEffect(() => {
        const handler = setTimeout(() => {
            getBeneficiaries(beneficiarySearch).then(setBeneficiaries);
        }, 300);
        return () => clearTimeout(handler);
    }, [beneficiarySearch]);

    const handleEdit = (transaction: MiscellaneousTransaction) => {
        setEditingTransaction(transaction);
        form.reset({
            id: transaction.id,
            category_id: transaction.category_id,
            transaction_date: format(parseISO(transaction.transaction_date), 'yyyy-MM-dd'),
            amount: transaction.amount,
            description: transaction.description,
            beneficiary_id: transaction.beneficiary_id,
            currency: transaction.currency as any,
            exchange_rate: transaction.exchange_rate,
            external_reference: transaction.external_reference,
            tags: Array.isArray(transaction.tags) ? transaction.tags.join(', ') : '',
            payment_method_id: transaction.payment_method_id?.toString(),
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
        { accessorKey: 'beneficiary_name', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.beneficiary')} /> },
        { accessorKey: 'amount', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.amount')} />,
          cell: ({ row }) => {
            const type = row.original.category_type;
            const amount = parseFloat(row.original.amount.toString());
            const colorClass = type === 'income' ? 'text-green-600' : 'text-red-600';
            return <div className={cn("font-medium text-right", colorClass)}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: row.original.currency }).format(amount)}</div>;
          }
        },
        { accessorKey: 'status', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.status')} />,
          cell: ({ row }) => {
            const status = row.original.status;
            const variant = status === 'completed' ? 'success' : status === 'pending' ? 'info' : 'destructive';
            return <Badge variant={variant} className="capitalize">{status}</Badge>
          }
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
            transaction_date: format(new Date(), 'yyyy-MM-dd'),
            currency: 'UYU',
            exchange_rate: 1,
            description: '',
            beneficiary_id: '',
            category_id: '',
            amount: 0,
            tags: '',
            external_reference: '',
            payment_method_id: '',
        });
        setIsDialogOpen(true);
    };

    const onSubmit = async (values: TransactionFormValues) => {
        if (!user) return;
        setSubmissionError(null);
        try {
            await upsertMiscellaneousTransaction(values, user.id);
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
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Create Transaction'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                         {submissionError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{submissionError}</AlertDescription></Alert>}
                         <FormField control={form.control} name="category_id" render={({ field }) => (
                            <FormItem><FormLabel>Category</FormLabel>
                                <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}><PopoverTrigger asChild><FormControl>
                                <Button variant="outline" role="combobox" className="w-full justify-between">{field.value ? categories.find(c => c.id === field.value)?.name : "Select category"}<ChevronsUpDown /></Button>
                                </FormControl></PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput /><CommandList><CommandEmpty>No category found.</CommandEmpty><CommandGroup>
                                    {categories.map(c => <CommandItem value={c.name} key={c.id} onSelect={() => {form.setValue("category_id", c.id); setIsCategoryOpen(false);}}><Check className={cn("mr-2", c.id === field.value ? "opacity-100" : "opacity-0")}/>{c.name}</CommandItem>)}
                                </CommandGroup></CommandList></Command></PopoverContent>
                                </Popover><FormMessage />
                            </FormItem>
                         )} />
                         <FormField control={form.control} name="beneficiary_id" render={({ field }) => (
                            <FormItem><FormLabel>Beneficiary</FormLabel>
                                <Popover open={isBeneficiaryOpen} onOpenChange={setIsBeneficiaryOpen}><PopoverTrigger asChild><FormControl>
                                <Button variant="outline" role="combobox" className="w-full justify-between">{field.value ? beneficiaries.find(b => b.id === field.value)?.name : "Select beneficiary"}<ChevronsUpDown /></Button>
                                </FormControl></PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput onValueChange={setBeneficiarySearch} /><CommandList><CommandEmpty>No beneficiary found.</CommandEmpty><CommandGroup>
                                    {beneficiaries.map(b => <CommandItem value={b.name} key={b.id} onSelect={() => {form.setValue("beneficiary_id", b.id); setIsBeneficiaryOpen(false);}}><Check className={cn("mr-2", b.id === field.value ? "opacity-100" : "opacity-0")}/>{b.name}</CommandItem>)}
                                </CommandGroup></CommandList></Command></PopoverContent>
                                </Popover><FormMessage />
                            </FormItem>
                         )} />
                         <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="transaction_date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField
                                control={form.control}
                                name="payment_method_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Payment Method</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select method"/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {paymentMethods.map(pm => <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>)}
                                        </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                         </div>
                         <div className="grid grid-cols-3 gap-4">
                            <FormField control={form.control} name="amount" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Amount</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="UYU">UYU</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                         </div>
                         <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                         <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="external_reference" render={({ field }) => (<FormItem><FormLabel>Reference</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="tags" render={({ field }) => (<FormItem><FormLabel>Tags</FormLabel><FormControl><Input placeholder="tag1, tag2, tag3" {...field} /></FormControl><FormMessage /></FormItem>)} />
                         </div>
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


    