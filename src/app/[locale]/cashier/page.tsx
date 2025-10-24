
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Box, Briefcase, DollarSign, LogOut, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CajaSesion } from '@/lib/types';

const openSessionSchema = (t: (key: string) => string) => z.object({
  montoApertura: z.coerce.number().positive(t('validation.openingAmountRequired')),
});

const closeSessionSchema = (t: (key: string) => string) => z.object({
    declaradoEfectivo: z.coerce.number().min(0, t('validation.amountRequired')),
    declaradoTarjeta: z.coerce.number().min(0, t('validation.amountRequired')),
    declaradoTransferencia: z.coerce.number().min(0, t('validation.amountRequired')),
    declaradoOtro: z.coerce.number().min(0, t('validation.amountRequired')),
    notas: z.string().optional(),
});

const expenseSchema = (t: (key: string) => string) => z.object({
    monto: z.coerce.number().positive(t('validation.amountRequired')),
    descripcion: z.string().min(1, t('validation.descriptionRequired')),
});

type OpenSessionFormValues = z.infer<ReturnType<typeof openSessionSchema>>;
type CloseSessionFormValues = z.infer<ReturnType<typeof closeSessionSchema>>;
type ExpenseFormValues = z.infer<ReturnType<typeof expenseSchema>>;

export default function CashierPage() {
    const t = useTranslations('CashierPage');
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [activeSession, setActiveSession] = React.useState<CajaSesion | null>(null);
    const [closedSessionReport, setClosedSessionReport] = React.useState<CajaSesion | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [serverError, setServerError] = React.useState<string | null>(null);

    const openSessionForm = useForm<OpenSessionFormValues>({ resolver: zodResolver(openSessionSchema(t)) });
    const closeSessionForm = useForm<CloseSessionFormValues>({ resolver: zodResolver(closeSessionSchema(t)) });
    const expenseForm = useForm<ExpenseFormValues>({ resolver: zodResolver(expenseSchema(t)) });

    const checkActiveSession = React.useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setServerError(null);
        try {
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/caja/sesion/activa`);
            if (response.status === 404) {
                setActiveSession(null);
                return;
            }
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.message || 'Failed to check active session.');
            }
            const sessionData = await response.json();
            setActiveSession(sessionData);
        } catch (error) {
            setServerError(error instanceof Error ? error.message : String(error));
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    React.useEffect(() => {
        checkActiveSession();
    }, [checkActiveSession]);

    const handleOpenSession = async (values: OpenSessionFormValues) => {
        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/caja/abrir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...values, puntoDeCajaId: 'Recepcion-1' }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || t('toast.openError'));
            }
            toast({ title: t('toast.openSuccessTitle'), description: t('toast.openSuccessDescription') });
            checkActiveSession();
            return true;
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.error'), description: error instanceof Error ? error.message : t('toast.openError') });
            return false;
        }
    };
    
    const handleRegisterExpense = async (values: ExpenseFormValues) => {
        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/caja/registrar-egreso', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || t('toast.expenseError'));
            }
            toast({ title: t('toast.expenseSuccessTitle'), description: t('toast.expenseSuccessDescription') });
            return true;
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.error'), description: error instanceof Error ? error.message : t('toast.expenseError') });
            return false;
        }
    };

    const handleCloseSession = async (values: CloseSessionFormValues) => {
        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/caja/cerrar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
             const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || t('toast.closeError'));
            }
            setClosedSessionReport(data);
            setActiveSession(null);
            toast({ title: t('toast.closeSuccessTitle'), description: t('toast.closeSuccessDescription') });
            return true;
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.error'), description: error instanceof Error ? error.message : t('toast.closeError') });
            return false;
        }
    };
    
    if (isLoading) {
        return <Skeleton className="h-[400px] w-full" />;
    }
    
    if (serverError) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('toast.error')}</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
            </Alert>
        );
    }
    
    if (closedSessionReport) {
        return <CloseSessionReport report={closedSessionReport} onNewSession={() => setClosedSessionReport(null)} />;
    }

    return activeSession ? (
        <ActiveSessionDashboard 
            session={activeSession}
            expenseForm={expenseForm}
            closeSessionForm={closeSessionForm}
            onRegisterExpense={handleRegisterExpense}
            onCloseSession={handleCloseSession}
        />
    ) : (
        <OpenSessionDashboard form={openSessionForm} onOpenSession={handleOpenSession} />
    );
}

// Components
function OpenSessionDashboard({ form, onOpenSession }: { form: any, onOpenSession: (values: any) => Promise<boolean> }) {
    const t = useTranslations('CashierPage');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    
    const onSubmit = async (values: OpenSessionFormValues) => {
        setIsSubmitting(true);
        await onOpenSession(values);
        setIsSubmitting(false);
    };

    return (
        <div className="flex items-center justify-center h-[calc(100vh-20rem)]">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>{t('openSession.title')}</CardTitle>
                    <CardDescription>{t('openSession.description')}</CardDescription>
                </CardHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <CardContent>
                            <FormField
                                control={form.control}
                                name="montoApertura"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('openSession.openingAmount')}</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input type="number" placeholder="0.00" className="pl-8" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full" disabled={isSubmitting}>{t('openSession.openButton')}</Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>
    );
}

function ActiveSessionDashboard({ session, expenseForm, closeSessionForm, onRegisterExpense, onCloseSession }: { session: any, expenseForm: any, closeSessionForm: any, onRegisterExpense: any, onCloseSession: any }) {
    const t = useTranslations('CashierPage');
    const [isExpenseDialogOpen, setIsExpenseDialogOpen] = React.useState(false);
    const [isCloseDialogOpen, setIsCloseDialogOpen] = React.useState(false);

    const onExpenseSubmit = async (values: ExpenseFormValues) => {
        const success = await onRegisterExpense(values);
        if (success) {
            setIsExpenseDialogOpen(false);
            expenseForm.reset();
        }
    };
    
    const onCloseSubmit = async (values: CloseSessionFormValues) => {
        const success = await onCloseSession(values);
        if (success) {
            setIsCloseDialogOpen(false);
            closeSessionForm.reset();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('activeSession.title')}</CardTitle>
                <CardDescription>{t('activeSession.description', { user: session.usuarioId, location: session.puntoDeCajaId })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{t('activeSession.openingAmount')}</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${session.montoApertura.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground">{new Date(session.fechaApertura).toLocaleString()}</p>
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
            <CardFooter className="gap-2">
                 <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline"><TrendingDown className="mr-2 h-4 w-4" />{t('activeSession.registerExpense')}</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t('expenseDialog.title')}</DialogTitle>
                            <DialogDescription>{t('expenseDialog.description')}</DialogDescription>
                        </DialogHeader>
                        <Form {...expenseForm}>
                            <form onSubmit={expenseForm.handleSubmit(onExpenseSubmit)} className="space-y-4 py-4">
                                 <FormField
                                    control={expenseForm.control}
                                    name="monto"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('expenseDialog.amount')}</FormLabel>
                                            <FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={expenseForm.control}
                                    name="descripcion"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('expenseDialog.descriptionLabel')}</FormLabel>
                                            <FormControl><Textarea placeholder={t('expenseDialog.descriptionPlaceholder')} {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <Button variant="outline" type="button" onClick={() => setIsExpenseDialogOpen(false)}>{t('cancel')}</Button>
                                    <Button type="submit">{t('expenseDialog.saveButton')}</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>

                <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><LogOut className="mr-2 h-4 w-4" />{t('activeSession.closeSession')}</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>{t('closeDialog.title')}</DialogTitle>
                            <DialogDescription>{t('closeDialog.description')}</DialogDescription>
                        </DialogHeader>
                        <Form {...closeSessionForm}>
                            <form onSubmit={closeSessionForm.handleSubmit(onCloseSubmit)} className="space-y-4 py-4">
                                <FormField control={closeSessionForm.control} name="declaradoEfectivo" render={({ field }) => (<FormItem><FormLabel>{t('closeDialog.cash')}</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={closeSessionForm.control} name="declaradoTarjeta" render={({ field }) => (<FormItem><FormLabel>{t('closeDialog.card')}</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={closeSessionForm.control} name="declaradoTransferencia" render={({ field }) => (<FormItem><FormLabel>{t('closeDialog.transfer')}</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={closeSessionForm.control} name="declaradoOtro" render={({ field }) => (<FormItem><FormLabel>{t('closeDialog.other')}</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={closeSessionForm.control} name="notas" render={({ field }) => (<FormItem><FormLabel>{t('closeDialog.notes')}</FormLabel><FormControl><Textarea placeholder={t('closeDialog.notesPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <DialogFooter>
                                    <Button variant="outline" type="button" onClick={() => setIsCloseDialogOpen(false)}>{t('cancel')}</Button>
                                    <Button type="submit">{t('closeDialog.submitButton')}</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </CardFooter>
        </Card>
    );
}

function CloseSessionReport({ report, onNewSession }: { report: CajaSesion, onNewSession: () => void }) {
    const t = useTranslations('CashierPage.report');
    
    const formatCurrency = (value: number | null | undefined) => {
        if (value === null || value === undefined) return '$0.00';
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };
    
    const data = [
        { method: t('cash'), calculated: report.montoCierreCalculadoEfectivo, declared: report.montoCierreDeclaradoEfectivo, difference: report.descuadreEfectivo },
        { method: t('card'), calculated: report.montoCierreCalculadoTarjeta, declared: report.montoCierreDeclaradoTarjeta, difference: report.descuadreTarjeta },
        { method: t('transfer'), calculated: report.montoCierreCalculadoTransferencia, declared: report.montoCierreDeclaradoTransferencia, difference: report.descuadreTransferencia },
        { method: t('other'), calculated: report.montoCierreCalculadoOtro, declared: report.montoCierreDeclaradoOtro, difference: report.descuadreOtro },
    ];
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description', { date: new Date(report.fechaCierre!).toLocaleDateString() })}</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('paymentMethod')}</TableHead>
                            <TableHead className="text-right">{t('systemAmount')}</TableHead>
                            <TableHead className="text-right">{t('declaredAmount')}</TableHead>
                            <TableHead className="text-right">{t('difference')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((row, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium">{row.method}</TableCell>
                                <TableCell className="text-right">{formatCurrency(row.calculated)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(row.declared)}</TableCell>
                                <TableCell className={cn("text-right font-semibold", (row.difference ?? 0) < 0 ? "text-destructive" : (row.difference ?? 0) > 0 ? "text-green-600" : "")}>{formatCurrency(row.difference)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {report.notasCierre && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold">{t('notes')}</h4>
                        <p className="text-sm text-muted-foreground">{report.notasCierre}</p>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button onClick={onNewSession}><Box className="mr-2 h-4 w-4" />{t('newSessionButton')}</Button>
            </CardFooter>
        </Card>
    );
}

