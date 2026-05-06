'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/context/AuthContext';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { useToast } from '@/hooks/use-toast';
import { PaymentMethod, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, formatISO, parseISO } from 'date-fns';
import { AlertTriangle, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const prepaidFormSchema = (t: (key: string) => string) => z.object({
    user_id: z.string().min(1, t('validation.userRequired')),
    payment_amount: z.coerce.number().positive(t('validation.amountPositive')),
    payment_method_id: z.string().min(1, t('validation.methodRequired')),
    created_at: z.date({ required_error: t('validation.dateRequired') }),
    currency: z.enum(['UYU', 'USD']),
    notes: z.string().optional(),
    is_historical: z.boolean().default(false),
});

type PrepaidFormValues = z.infer<ReturnType<typeof prepaidFormSchema>>;

async function getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
        const data = await api.get(API_ROUTES.CASHIER.PAYMENT_METHODS);
        const methodsData = Array.isArray(data) ? data : (data.payment_methods || data.data || []);
        return methodsData.map((m: any) => ({ ...m, id: String(m.id) }));
    } catch {
        return [];
    }
}

export interface PurchasePrepaidFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialUser?: User;
    onSaveSuccess?: () => void;
}

export function PurchasePrepaidFormDialog({ open, onOpenChange, initialUser, onSaveSuccess }: PurchasePrepaidFormDialogProps) {
    const t = useTranslations('purchases');
    const tValidation = useTranslations('InvoicesPage');
    const { toast } = useToast();
    const { user, checkActiveSession } = useAuth();
    const { validateActiveSession, showCashSessionError } = useCashSessionValidation();

    const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
    const [users, setUsers] = React.useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = React.useState(false);
    const [userSearchTerm, setUserSearchTerm] = React.useState('');
    const [isUserPopoverOpen, setIsUserPopoverOpen] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
    const [pendingData, setPendingData] = React.useState<PrepaidFormValues | null>(null);

    const form = useForm<PrepaidFormValues>({
        resolver: zodResolver(prepaidFormSchema(tValidation)),
        defaultValues: {
            user_id: '',
            payment_amount: 0,
            payment_method_id: '',
            created_at: new Date(),
            currency: 'UYU',
            notes: '',
            is_historical: false,
        },
    });

    // Reset & load data when dialog opens
    React.useEffect(() => {
        if (!open) return;
        setSubmissionError(null);
        setUserSearchTerm('');
        if (initialUser) {
            setUsers([initialUser]);
        } else {
            setUsers([]);
        }
        form.reset({
            user_id: initialUser?.id || '',
            payment_amount: 0,
            payment_method_id: '',
            created_at: new Date(),
            currency: 'UYU',
            notes: '',
            is_historical: false,
        });
        getPaymentMethods().then(setPaymentMethods);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Debounced user search — only when no initialUser
    React.useEffect(() => {
        if (!open || initialUser) return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            setIsLoadingUsers(true);
            try {
                const params: Record<string, string> = { filter_type: 'PROVEEDOR' };
                if (userSearchTerm.trim()) params.search = userSearchTerm.trim();
                const responseData = await api.get(API_ROUTES.USERS, params);
                let usersData: any[] = [];
                if (Array.isArray(responseData) && responseData.length > 0) {
                    const first = responseData[0];
                    usersData = first.json?.data || first.data || responseData;
                } else if (responseData?.data) {
                    usersData = responseData.data;
                }
                if (!cancelled) {
                    setUsers(usersData.map((u: any) => ({
                        id: String(u.id),
                        name: u.name || 'Sin nombre',
                        email: u.email || '',
                        phone_number: u.phone_number || '',
                        is_active: u.is_active ?? true,
                        avatar: '',
                        identity_document: '',
                    })));
                }
            } catch {
                if (!cancelled) setUsers([]);
            } finally {
                if (!cancelled) setIsLoadingUsers(false);
            }
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [userSearchTerm, open, initialUser]);

    const onSubmit = (data: PrepaidFormValues) => {
        setSubmissionError(null);
        setPendingData(data);
        setIsConfirmOpen(true);
    };

    const handleConfirm = async () => {
        if (!pendingData || !user) return;
        try {
            let sessionId: string | null = null;
            if (!pendingData.is_historical) {
                const validation = await validateActiveSession();
                if (!validation.isValid) {
                    showCashSessionError(validation.error);
                    return;
                }
                sessionId = validation.sessionId ?? null;
            }

            const selectedMethod = paymentMethods.find(pm => pm.id === pendingData.payment_method_id);
            const clientUser = users.find(u => u.id === pendingData.user_id) || initialUser;

            const payload = {
                cash_session_id: sessionId,
                user,
                client_user: clientUser,
                query: {
                    payment_date: formatISO(pendingData.created_at),
                    amount: pendingData.payment_amount,
                    method: selectedMethod?.name,
                    payment_method_id: pendingData.payment_method_id,
                    status: 'completed',
                    user_id: pendingData.user_id,
                    is_sales: false,
                    is_prepaid: true,
                    invoice_currency: pendingData.currency,
                    payment_currency: pendingData.currency,
                    exchange_rate: 1,
                    notes: pendingData.notes || '',
                    is_historical: pendingData.is_historical,
                },
            };

            await api.post(API_ROUTES.PURCHASES.INVOICE_PAYMENT, payload);
            toast({ title: t('prepaidDialog.toasts.successTitle'), description: t('prepaidDialog.toasts.successDescription') });
            await checkActiveSession();
            setIsConfirmOpen(false);
            onOpenChange(false);
            onSaveSuccess?.();
        } catch (error) {
            setIsConfirmOpen(false);
            setSubmissionError(error instanceof Error ? error.message : t('prepaidDialog.toasts.errorDescription'));
            toast({ variant: 'destructive', title: t('prepaidDialog.toasts.errorTitle'), description: error instanceof Error ? error.message : t('prepaidDialog.toasts.errorDescription') });
        }
    };

    const isHistorical = form.watch('is_historical');

    return (
        <>
            <Dialog open={open} onOpenChange={(o) => { if (!isConfirmOpen) onOpenChange(o); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('prepaidDialog.title')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                            <DialogBody className="space-y-4 px-6 py-4">
                                {submissionError && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>Error</AlertTitle>
                                        <AlertDescription>{submissionError}</AlertDescription>
                                    </Alert>
                                )}

                                {/* Supplier field — locked if pre-filled */}
                                <FormField control={form.control} name="user_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('prepaidDialog.supplier')}</FormLabel>
                                        {initialUser ? (
                                            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed">
                                                {initialUser.name}
                                            </div>
                                        ) : (
                                            <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant="outline" role="combobox" className={cn('w-full justify-between', !field.value && 'text-muted-foreground')}>
                                                            {field.value ? users.find(u => u.id === field.value)?.name : t('prepaidDialog.selectSupplier')}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command shouldFilter={false}>
                                                        <CommandInput placeholder={t('prepaidDialog.searchSupplier')} value={userSearchTerm} onValueChange={setUserSearchTerm} />
                                                        <CommandList>
                                                            {isLoadingUsers ? (
                                                                <div className="flex items-center justify-center p-4">
                                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                                    <span className="text-sm text-muted-foreground">{t('prepaidDialog.searching')}</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <CommandEmpty>{t('prepaidDialog.noSupplier')}</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {users.map(u => (
                                                                            <CommandItem value={u.name} key={u.id} onSelect={() => { form.setValue('user_id', u.id); setIsUserPopoverOpen(false); }}>
                                                                                <Check className={cn('mr-2 h-4 w-4', u.id === field.value ? 'opacity-100' : 'opacity-0')} />
                                                                                {u.name}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </>
                                                            )}
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* Amount + Currency */}
                                <div className="grid grid-cols-3 gap-4">
                                    <FormField control={form.control} name="payment_amount" render={({ field: { onChange, value } }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel>{t('prepaidDialog.amount')}</FormLabel>
                                            <FormControl>
                                                <FormattedNumberInput value={value} onChange={onChange} placeholder="0.00" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="currency" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('prepaidDialog.currency')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
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

                                {/* Payment method */}
                                <FormField control={form.control} name="payment_method_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('prepaidDialog.paymentMethod')}</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder={t('prepaidDialog.selectMethod')} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {paymentMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* Date */}
                                <FormField control={form.control} name="created_at" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>{t('prepaidDialog.paymentDate')}</FormLabel>
                                        <FormControl>
                                            <DatePickerInput
                                                value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                                                onChange={(iso) => field.onChange(iso ? parseISO(iso) : undefined)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* Notes */}
                                <FormField control={form.control} name="notes" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('prepaidDialog.notes')}</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder={t('prepaidDialog.notesPlaceholder')} {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* Historical */}
                                <FormField control={form.control} name="is_historical" render={({ field }) => (
                                    <>
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>{t('prepaidDialog.isHistorical')}</FormLabel>
                                                <p className="text-xs text-muted-foreground">{t('prepaidDialog.isHistoricalDescription')}</p>
                                            </div>
                                        </FormItem>
                                        {isHistorical && (
                                            <Alert className="bg-amber-50 border-amber-200">
                                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                                <AlertTitle className="text-amber-800 text-sm">{t('prepaidDialog.isHistoricalWarning')}</AlertTitle>
                                                <AlertDescription className="text-amber-700 text-xs">{t('prepaidDialog.isHistoricalDescription')}</AlertDescription>
                                            </Alert>
                                        )}
                                    </>
                                )} />
                            </DialogBody>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('prepaidDialog.cancel')}</Button>
                                <Button type="submit">{t('prepaidDialog.save')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('prepaidDialog.confirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('prepaidDialog.confirmDescription')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('prepaidDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm}>{t('prepaidDialog.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
