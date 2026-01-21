
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MiscellaneousCategory, MiscellaneousTransaction, PaymentMethod, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { normalizeApiResponse } from '@/lib/api-utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState, VisibilityState } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Check, ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { DateRange } from 'react-day-picker';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const transactionFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    category_id: z.string().min(1, t('validation.categoryRequired')),
    transaction_date: z.string().min(1, t('validation.dateRequired')),
    amount: z.coerce.number().positive(t('validation.amountPositive')),
    description: z.string().min(1, t('validation.descriptionRequired')),
    beneficiary_id: z.string().optional(),
    currency: z.enum(['UYU', 'USD', 'EUR']).default('UYU'),
    exchange_rate: z.coerce.number().optional().default(1),
    external_reference: z.string().optional(),
    tags: z.string().optional(),
    payment_method_id: z.string().optional(),
});

type TransactionFormValues = z.infer<ReturnType<typeof transactionFormSchema>>;

const completeTransactionSchema = (t: (key: string) => string) => z.object({
    cash_session_id: z.string().min(1, t('validation.sessionRequired')),
    payment_method_id: z.string().min(1, t('validation.paymentMethodRequired')),
});

type CompleteTransactionFormValues = z.infer<ReturnType<typeof completeTransactionSchema>>;

type GetTransactionsResponse = {
    transactions: MiscellaneousTransaction[];
    total: number;
};

async function getMiscellaneousTransactions(pagination: PaginationState, searchQuery: string): Promise<GetTransactionsResponse> {
    try {
        const data = await api.get(API_ROUTES.CASHIER.MISCELLANEOUS_TRANSACTIONS_GET, {
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
            search: searchQuery,
        });

        if (!data) return { transactions: [], total: 0 };

        const normalized = normalizeApiResponse(data);

        return {
            transactions: normalized.items.map((t: any) => ({
                id: String(t.id),
                doc_no: t.doc_no,
                transaction_date: t.transaction_date,
                amount: parseFloat(t.amount),
                currency: t.currency || t.transaction_currency,
                exchange_rate: parseFloat(t.exchange_rate),
                converted_amount: parseFloat(t.converted_amount),
                description: t.description,
                external_reference: t.reference_number,
                status: t.status,
                category_id: t.category_id ? String(t.category_id) : (t.category?.id ? String(t.category.id) : ''),
                category_code: t.category_code || t.category?.code,
                category_name: t.category_name || t.category?.name,
                category_type: t.category_type || t.category?.type || t.category?.category_type,
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
            total: normalized.total
        };
    } catch (error) {
        console.error("Failed to fetch miscellaneous transactions:", error);
        return { transactions: [], total: 0 };
    }
}

async function getBeneficiaries(searchQuery: string): Promise<User[]> {
    try {
        const data = await api.get(API_ROUTES.USERS, { search: searchQuery });
        if (!data) return [];
        const parsedData = Array.isArray(data) && data.length > 0 ? data[0] : data;
        const usersData = parsedData?.data || [];
        return usersData.map((user: any) => ({ ...user, id: String(user.id) }));
    } catch (error) {
        console.error("Failed to fetch beneficiaries:", error);
        return [];
    }
}

async function getCategories(): Promise<MiscellaneousCategory[]> {
    try {
        const data = await api.get(API_ROUTES.CASHIER.MISCELLANEOUS_CATEGORIES_GET, {
            page: '1',
            limit: '1000',
            search: '',
        });
        if (!data) return [];

        // Handle different API response formats
        let categoriesData: any[] = [];

        if (Array.isArray(data)) {
            if (data.length > 0 && data[0]?.data) {
                categoriesData = data[0].data || [];
            } else {
                categoriesData = data;
            }
        } else if (data?.data) {
            categoriesData = data.data;
        } else {
            return [];
        }

        return categoriesData.map((cat: any) => ({
            ...cat,
            id: String(cat.id),
            category_type: cat.type || cat.category_type
        }));
    } catch (error) {
        console.error("Failed to fetch categories:", error);
        return [];
    }
}

async function getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
        const data = await api.get(API_ROUTES.CASHIER.PAYMENT_METHODS);
        if (!data) return [];
        const methodsData = data?.payment_methods || data?.data || (Array.isArray(data) ? data : []);
        return methodsData.map((m: any) => ({ ...m, id: String(m.id) }));
    } catch (error) {
        console.error("Failed to fetch payment methods:", error);
        return [];
    }
}




async function upsertMiscellaneousTransaction(transactionData: TransactionFormValues, userId: string) {
    const payload = {
        ...transactionData,
        user_id: userId,
        tags: transactionData.tags?.split(',').map(t => t.trim()).filter(t => t),
        beneficiary_id: transactionData.beneficiary_id || null,
        payment_method_id: transactionData.payment_method_id ? parseInt(transactionData.payment_method_id, 10) : null,
        category_id: parseInt(transactionData.category_id, 10),
    };

    const response = await api.post(API_ROUTES.CASHIER.MISCELLANEOUS_TRANSACTIONS_UPSERT, payload);
    if (Array.isArray(response) && response[0]?.code >= 400) {
        const message = response[0]?.message || 'Failed to save transaction';
        throw new Error(message);
    }
    if (response.error) {
        throw new Error(response.message || 'Failed to save transaction');
    }
    return response;
}

async function deleteMiscellaneousTransaction(id: string) {
    const response = await api.delete(API_ROUTES.CASHIER.MISCELLANEOUS_TRANSACTIONS_DELETE, { id });
    if (Array.isArray(response) && response[0]?.code >= 400) {
        const message = response[0]?.message || 'Failed to delete transaction';
        throw new Error(message);
    }
    if (response.error) {
        throw new Error(response.message || 'Failed to delete transaction');
    }
    return response;
}


export default function MiscellaneousTransactionsPage() {
    const t = useTranslations('MiscellaneousTransactionsPage');
    // const tValidation = useTranslations('MiscellaneousTransactionsPage.validation'); // No longer needed as separate namespace if accessing via full path or if t covers it
    const { toast } = useToast();
    const { user, activeCashSession } = useAuth();
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
        resolver: zodResolver(transactionFormSchema(t)),
    });

    React.useEffect(() => {
        getCategories().then(setCategories);
        getPaymentMethods().then(setPaymentMethods);
    }, []);

    React.useEffect(() => {
        const handler = setTimeout(() => {
            getBeneficiaries(beneficiarySearch).then(setBeneficiaries);
        }, 300);
        return () => clearTimeout(handler);
    }, [beneficiarySearch]);

    React.useEffect(() => {
        if (isDialogOpen) {
            if (editingTransaction) {
                // Helper to prevent "undefined" or "null" strings
                const cleanValue = (val: any) => {
                    if (val === null || val === undefined) return '';
                    const str = String(val);
                    return (str === 'null' || str === 'undefined') ? '' : str;
                };

                form.reset({
                    id: editingTransaction.id,
                    category_id: cleanValue(editingTransaction.category_id),
                    transaction_date: format(parseISO(editingTransaction.transaction_date), 'yyyy-MM-dd'),
                    amount: editingTransaction.amount,
                    description: editingTransaction.description,
                    beneficiary_id: cleanValue(editingTransaction.beneficiary_id) || undefined,
                    currency: editingTransaction.currency as any,
                    exchange_rate: editingTransaction.exchange_rate,
                    external_reference: editingTransaction.external_reference,
                    tags: Array.isArray(editingTransaction.tags) ? editingTransaction.tags.join(', ') : '',
                    payment_method_id: editingTransaction.payment_method_id?.toString(),
                });
            } else {
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
            }
        }
    }, [isDialogOpen, editingTransaction, form]);

    const handleCreate = () => {
        setEditingTransaction(null);
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (transaction: MiscellaneousTransaction) => {
        setEditingTransaction(transaction);
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
            toast({ title: t('toasts.deletedTitle'), description: t('toasts.deletedDesc', { number: deletingTransaction.doc_no }) });
            setIsDeleteDialogOpen(false);
            setDeletingTransaction(null);
            loadTransactions();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toasts.deleteError'),
            });
        }
    };

    const getColumns = (t: (key: string) => string): ColumnDef<MiscellaneousTransaction>[] => [
        { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.id')} /> },
        { accessorKey: 'doc_no', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.docNo')} /> },
        { accessorKey: 'transaction_date', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.date')} />, cell: ({ row }) => format(parseISO(row.original.transaction_date), 'yyyy-MM-dd') },
        {
            accessorKey: 'category_name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.category')} />,
            cell: ({ row }) => {
                const type = row.original.category_type;
                return <Badge variant={type === 'income' ? 'success' : 'destructive'}>{row.original.category_name}</Badge>
            }
        },
        { accessorKey: 'beneficiary_name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.beneficiary')} /> },
        {
            accessorKey: 'amount', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.amount')} />,
            cell: ({ row }) => {
                const type = row.original.category_type;
                const amount = parseFloat(row.original.amount.toString());
                const colorClass = type === 'income' ? 'text-green-600' : 'text-red-600';
                return <div className={cn("font-medium text-right", colorClass)}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: row.original.currency }).format(amount)}</div>;
            }
        },
        {
            accessorKey: 'status', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.status')} />,
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
                                <span className="sr-only">{t('actions.openMenu')}</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('columns.actions')}</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEdit(transaction)}>{t('actions.edit')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(transaction)} className="text-destructive">{t('actions.delete')}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];
    const columns = getColumns(t);

    const loadTransactions = React.useCallback(async () => {
        setIsRefreshing(true);
        const searchQuery = (columnFilters.find(f => f.id === 'beneficiary_name')?.value as string) || '';
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

    const onSubmit = async (values: TransactionFormValues) => {
        if (!user) return;
        setSubmissionError(null);

        try {
            // Check if there's an active cash session
            if (!activeCashSession) {
                setSubmissionError(t('validation.noActiveSession'));
                toast({
                    variant: 'destructive',
                    title: t('toasts.errorTitle'),
                    description: t('validation.noActiveSession'),
                });
                return;
            }

            await upsertMiscellaneousTransaction(values, user.id);
            toast({ title: editingTransaction ? t('toasts.updatedTitle') : t('toasts.createdTitle'), description: t('toasts.savedDesc') });
            setIsDialogOpen(false);
            loadTransactions();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toasts.genericError'));
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
                        filterColumnId="beneficiary_name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={handleCreate}
                        onRefresh={loadTransactions}
                        isRefreshing={isRefreshing}
                        columnTranslations={{
                            id: t('columns.id'),
                            doc_no: t('columns.docNo'),
                            transaction_date: t('columns.date'),
                            category_name: t('columns.category'),
                            beneficiary_name: t('columns.beneficiary'),
                            amount: t('columns.amount'),
                            status: t('columns.status'),
                        }}
                    />
                </CardContent>
            </Card>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingTransaction ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            {submissionError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>{t('toasts.errorTitle')}</AlertTitle><AlertDescription>{submissionError}</AlertDescription></Alert>}
                            <FormField control={form.control} name="category_id" render={({ field }) => (
                                <FormItem><FormLabel>{t('dialog.category')}</FormLabel>
                                    <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}><PopoverTrigger asChild><FormControl>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                            {field.value
                                                ? (categories.find(c => String(c.id) === String(field.value))?.name || t('dialog.selectCategory'))
                                                : t('dialog.selectCategory')}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl></PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput /><CommandList><CommandEmpty>No category found.</CommandEmpty><CommandGroup>
                                            {categories.map(c => <CommandItem value={c.name} key={c.id} onSelect={() => { form.setValue("category_id", String(c.id)); setIsCategoryOpen(false); }}><Check className={cn("mr-2", String(c.id) === String(field.value) ? "opacity-100" : "opacity-0")} />{c.name}</CommandItem>)}
                                        </CommandGroup></CommandList></Command></PopoverContent>
                                    </Popover><FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="beneficiary_id" render={({ field }) => (
                                <FormItem><FormLabel>{t('dialog.beneficiary')}</FormLabel>
                                    <Popover open={isBeneficiaryOpen} onOpenChange={setIsBeneficiaryOpen}><PopoverTrigger asChild><FormControl>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">{field.value ? beneficiaries.find(b => b.id === field.value)?.name : t('dialog.selectBeneficiary')}<ChevronsUpDown /></Button>
                                    </FormControl></PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput onValueChange={setBeneficiarySearch} /><CommandList><CommandEmpty>No beneficiary found.</CommandEmpty><CommandGroup>
                                            {beneficiaries.map(b => <CommandItem value={b.name} key={b.id} onSelect={() => { form.setValue("beneficiary_id", b.id); setIsBeneficiaryOpen(false); }}><Check className={cn("mr-2", b.id === field.value ? "opacity-100" : "opacity-0")} />{b.name}</CommandItem>)}
                                        </CommandGroup></CommandList></Command></PopoverContent>
                                    </Popover><FormMessage />
                                </FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="transaction_date" render={({ field }) => (<FormItem><FormLabel>{t('dialog.date')}</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField
                                    control={form.control}
                                    name="payment_method_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.paymentMethod')}</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectMethod')} /></SelectTrigger></FormControl>
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
                                <FormField control={form.control} name="amount" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>{t('dialog.amount')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>{t('dialog.currency')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="UYU">UYU</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>{t('dialog.description')}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="external_reference" render={({ field }) => (<FormItem><FormLabel>{t('dialog.reference')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="tags" render={({ field }) => (<FormItem><FormLabel>{t('dialog.tags')}</FormLabel><FormControl><Input placeholder="tag1, tag2, tag3" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('dialog.cancel')}</Button>
                                <Button type="submit">{editingTransaction ? t('dialog.save') : t('dialog.create')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('dialog.areYouSure')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('dialog.deleteConfirmation', { number: deletingTransaction?.doc_no })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('dialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('dialog.deleteAction')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
