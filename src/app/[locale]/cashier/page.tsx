
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Box, Briefcase, DollarSign, LogOut, TrendingDown, TrendingUp, ArrowLeft, ArrowRight, BookOpenCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CajaSesion, CajaMovimiento, CashPoint, PaymentMethod, SystemConfiguration } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

const denominations = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];

const openSessionSchema = (t: (key: string) => string) => z.object({
  montoApertura: z.coerce.number().positive(t('validation.openingAmountRequired')),
  cashPointId: z.string(),
  denominations_details: z.record(z.number()).optional(),
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

type WizardStep = 'REVIEW' | 'DECLARE' | 'REPORT';

interface CashPointStatus extends CashPoint {
  status: 'OPEN' | 'CLOSED';
  session?: CajaSesion & { user_name: string };
}


export default function CashierPage() {
    const t = useTranslations('CashierPage');
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [activeSession, setActiveSession] = React.useState<CajaSesion | null>(null);
    const [cashPoints, setCashPoints] = React.useState<CashPointStatus[]>([]);
    const [sessionMovements, setSessionMovements] = React.useState<CajaMovimiento[]>([]);
    const [closedSessionReport, setClosedSessionReport] = React.useState<CajaSesion | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [serverError, setServerError] = React.useState<string | null>(null);
    const [wizardStep, setWizardStep] = React.useState<WizardStep>('REVIEW');
    const [showClosingWizard, setShowClosingWizard] = React.useState(false);
    const [showDenominations, setShowDenominations] = React.useState(false);

    const closeSessionForm = useForm<CloseSessionFormValues>({
        resolver: zodResolver(closeSessionSchema(t)),
        defaultValues: {
            declaradoEfectivo: 0,
            declaradoTarjeta: 0,
            declaradoTransferencia: 0,
            declaradoOtro: 0,
            notas: '',
        },
    });
    const expenseForm = useForm<ExpenseFormValues>({ resolver: zodResolver(expenseSchema(t)) });

    const fetchSystemConfigs = React.useCallback(async () => {
        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/configs');
            if (response.ok) {
                const data = await response.json();
                const configsData = Array.isArray(data) ? data : (data.configs || data.data || data.result || []);
                const denominationsConfig = configsData.find((c: SystemConfiguration) => c.key === 'show-denominations');
                if (denominationsConfig && denominationsConfig.value === 'true') {
                    setShowDenominations(true);
                }
            }
        } catch (error) {
            console.error("Failed to fetch system configurations", error);
        }
    }, []);

    const fetchCashPointStatus = React.useCallback(async () => {
        setIsLoading(true);
        setServerError(null);
        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash_points/status');
            if (!response.ok) throw new Error('Failed to fetch cash points status');
            const data = await response.json();
             const cashPointsData = (Array.isArray(data) ? data : (data.data || [])) as any[];

            const mappedCashPoints: CashPointStatus[] = cashPointsData.map(cp => ({
                id: String(cp.cash_point_id),
                name: cp.cash_point_name,
                is_active: cp.is_active,
                created_at: '', 
                updated_at: '',
                status: cp.session_status,
                session: cp.session_status === 'OPEN' ? {
                    id: String(cp.active_session_id),
                    usuarioId: cp.active_user_id,
                    user_name: cp.active_user_name,
                    puntoDeCajaId: String(cp.cash_point_id),
                    cash_point_name: cp.cash_point_name,
                    estado: 'ABIERTA',
                    fechaApertura: cp.session_start_time || new Date().toISOString(), 
                    montoApertura: Number(cp.opening_amount) || 0,
                } : undefined,
            }));
            setCashPoints(mappedCashPoints);
        } catch (error) {
            setServerError(error instanceof Error ? error.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchSessionMovements = React.useCallback(async (sessionId: string) => {
        try {
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/movements?cash_session_id=${sessionId}`);
            if (!response.ok) throw new Error('Failed to fetch session movements');
            const data = await response.json();
            const movementsData = Array.isArray(data) ? data : (data.data || []);
            setSessionMovements(movementsData.map((mov: any): CajaMovimiento => ({
                id: String(mov.movement_id),
                cajaSesionId: sessionId,
                tipo: mov.type === 'INFLOW' ? 'INGRESO' : 'EGRESO',
                monto: parseFloat(mov.amount),
                descripcion: mov.description,
                fecha: mov.created_at,
                usuarioId: mov.registered_by_user, // This might need adjustment if you have user IDs
                metodoPago: (mov.payment_method_name || 'otro').toUpperCase() as any,
            })));
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch session movements.' });
            setSessionMovements([]);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchSystemConfigs();
        fetchCashPointStatus();
    }, [fetchSystemConfigs, fetchCashPointStatus]);

    React.useEffect(() => {
        if (activeSession) {
            fetchSessionMovements(activeSession.id);
        }
    }, [activeSession, fetchSessionMovements]);

    React.useEffect(() => {
    // Reset state on component unmount to ensure fresh view on re-navigation
    return () => {
      setActiveSession(null);
      setShowClosingWizard(false);
      setWizardStep('REVIEW');
    };
  }, []);

    const handleOpenSession = async (values: OpenSessionFormValues) => {
        if (!user) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/open', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    cash_point_id: values.cashPointId,
                    opening_amount: values.montoApertura,
                    user_id: user.id,
                    denominations_details: values.denominations_details ? JSON.stringify(values.denominations_details) : undefined,
                }),
            });
            const data = await response.json();
            
            const result = Array.isArray(data) ? data[0] : data;

            if (!response.ok || result.code !== 200 || result.error) {
                 toast({ variant: "destructive", title: "No se pudo abrir la caja", description: result.message || 'An unknown error occurred.' });
                 return;
            }
            
            const sessionData = result.session || result.data;

            if (!sessionData) {
                toast({ variant: "destructive", title: "Error", description: "No session data received from server."});
                return;
            }
            
            const cashPoint = cashPoints.find(cp => cp.id === values.cashPointId);

            const newActiveSession: CajaSesion = {
                id: String(sessionData.id),
                usuarioId: String(sessionData.user_id),
                user_name: user.name,
                puntoDeCajaId: String(sessionData.cash_point_id),
                cash_point_name: cashPoint?.name || '',
                estado: sessionData.status,
                fechaApertura: sessionData.opened_at,
                montoApertura: Number(sessionData.opening_amount),
            };

            setActiveSession(newActiveSession);
            toast({ title: t('toast.openSuccessTitle'), description: t('toast.openSuccessDescription') });
            fetchCashPointStatus();

        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: error instanceof Error ? error.message : t('toast.openError') });
        }
    };
    
    const handleRegisterExpense = async (values: ExpenseFormValues) => {
        if (!activeSession || !user) return false;

        const newMovement: CajaMovimiento = {
            id: `mov_${Date.now()}`,
            cajaSesionId: activeSession.id,
            tipo: 'EGRESO',
            metodoPago: 'EFECTIVO',
            monto: values.monto,
            descripcion: values.descripcion,
            fecha: new Date().toISOString(),
            usuarioId: user.id,
        };
        
        setSessionMovements(prev => [...prev, newMovement]);
        toast({ title: t('toast.expenseSuccessTitle'), description: t('toast.expenseSuccessDescription') });
        return true;
    };

    const handleCalculateReport = async (values: CloseSessionFormValues) => {
        if (!activeSession) return;

        try {
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/totales?cash_session_id=${activeSession.id}`);
            if (!response.ok) {
                throw new Error('Failed to fetch session totals');
            }
            const totalsData = await response.json();
            
            let montoCalculadoEfectivo = 0;
            let montoCalculadoTarjeta = 0;
            let montoCalculadoTransferencia = 0;
            let montoCalculadoOtro = 0;

            const totals = Array.isArray(totalsData) ? totalsData : (totalsData.data || []);
            
            totals.forEach((item: any) => {
                const total = parseFloat(item.total);
                if (item.is_cash_equivalent) {
                    montoCalculadoEfectivo += total;
                } else if (item.code === 'CREDIT_CARD' || item.code === 'DEBIT_CARD') {
                    montoCalculadoTarjeta += total;
                } else if (item.code === 'BANK_TRANSFER') {
                    montoCalculadoTransferencia += total;
                } else {
                    montoCalculadoOtro += total;
                }
            });

            const totalEgresosEfectivo = sessionMovements.filter(m => m.tipo === 'EGRESO').reduce((sum, m) => sum + m.monto, 0);
            montoCalculadoEfectivo += activeSession.montoApertura - totalEgresosEfectivo;

            const report: CajaSesion = {
                ...activeSession,
                estado: 'CERRADA',
                fechaCierre: new Date().toISOString(),
                montoCierreDeclaradoEfectivo: values.declaradoEfectivo,
                montoCierreDeclaradoTarjeta: values.declaradoTarjeta,
                montoCierreDeclaradoTransferencia: values.declaradoTransferencia,
                montoCierreDeclaradoOtro: values.declaradoOtro,
                montoCierreCalculadoEfectivo: montoCalculadoEfectivo,
                montoCierreCalculadoTarjeta: montoCalculadoTarjeta,
                montoCierreCalculadoTransferencia: montoCalculadoTransferencia,
                montoCierreCalculadoOtro: montoCalculadoOtro,
                totalEgresosEfectivo: totalEgresosEfectivo,
                descuadreEfectivo: values.declaradoEfectivo - montoCalculadoEfectivo,
                descuadreTarjeta: values.declaradoTarjeta - montoCalculadoTarjeta,
                descuadreTransferencia: values.declaradoTransferencia - montoCalculadoTransferencia,
                descuadreOtro: values.declaradoOtro - montoCalculadoOtro,
                notasCierre: values.notas,
            };

            setClosedSessionReport(report);
            setWizardStep('REPORT');
        } catch (error) {
            console.error('Error calculating report:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not calculate session report. Please try again.'
            });
        }
    };


    const handleConfirmClose = async (report: CajaSesion) => {
        try {
            const totalCashInflow = (report.montoCierreCalculadoEfectivo ?? 0) - report.montoApertura + (report.totalEgresosEfectivo ?? 0);
            const payload = {
              cash_session_id: report.id,
              openingAmount: report.montoApertura,
              declaredCash: report.montoCierreDeclaradoEfectivo,
              totalCashInflow: totalCashInflow,
              totalCashOutflow: report.totalEgresosEfectivo,
              totalCardInflow: report.montoCierreCalculadoTarjeta,
              totalTransferInflow: report.montoCierreCalculadoTransferencia,
              totalOtherInflow: report.montoCierreCalculadoOtro,
              calculatedCash: report.montoCierreCalculadoEfectivo,
              calculatedCard: report.montoCierreCalculadoTarjeta,
              calculatedTransfer: report.montoCierreCalculadoTransferencia,
              calculatedOther: report.montoCierreCalculadoOtro,
              cashDiscrepancy: report.descuadreEfectivo,
              notes: report.notasCierre,
            };

            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            const responseData = await response.json();
            if (!response.ok || (responseData.error || (Array.isArray(responseData) && responseData[0]?.code >= 400))) {
                throw new Error(responseData.message || t('toast.closeError'));
            }

            toast({ title: t('toast.closeSuccessTitle'), description: t('toast.closeSuccessDescription') });
            return true;
        } catch (error) {
             toast({ variant: 'destructive', title: t('toast.error'), description: error instanceof Error ? error.message : t('toast.closeError') });
             return false;
        }
    };


     const handleSetActiveSession = (session: CajaSesion) => {
        setActiveSession(session);
    };
    
    if (isLoading) {
        return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
        </div>;
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
    
    if (activeSession) {
        if(showClosingWizard) {
          return <CloseSessionWizard
                    currentStep={wizardStep}
                    setCurrentStep={setWizardStep}
                    onExitWizard={() => {
                      setShowClosingWizard(false);
                      setWizardStep('REVIEW');
                      setClosedSessionReport(null);
                      setActiveSession(null);
                      fetchCashPointStatus();
                    }}
                    activeSessionDashboard={
                        <ActiveSessionDashboard 
                            session={activeSession}
                            movements={sessionMovements}
                            onCloseSession={() => setWizardStep('DECLARE')}
                            isWizardOpen={true}
                        />
                    }
                    blindCloseForm={
                        <BlindCloseForm
                            form={closeSessionForm}
                            onSubmit={handleCalculateReport}
                            onBack={() => setWizardStep('REVIEW')}
                        />
                    }
                    closeSessionReport={
                        closedSessionReport ?
                        <CloseSessionReport 
                            report={closedSessionReport} 
                            onConfirm={async () => {
                                const success = await handleConfirmClose(closedSessionReport);
                                if(success) {
                                    setActiveSession(null);
                                    setSessionMovements([]);
                                    setShowClosingWizard(false);
                                    fetchCashPointStatus();
                                }
                                return success;
                            }}
                            onBack={() => setWizardStep('DECLARE')}
                            onNewSession={() => {
                                setShowClosingWizard(false);
                                setWizardStep('REVIEW');
                                setClosedSessionReport(null);
                                setActiveSession(null);
                                setSessionMovements([]);
                                fetchCashPointStatus();
                            }}
                        />
                        : <Skeleton className="h-[400px] w-full" />
                    }
                />
        }

        return (
            <ActiveSessionDashboard 
                session={activeSession}
                movements={sessionMovements}
                onCloseSession={() => setShowClosingWizard(true)}
            />
        );
    }

    return <OpenSessionDashboard cashPoints={cashPoints} onOpenSession={handleOpenSession} setActiveSession={handleSetActiveSession} showDenominations={showDenominations} />;
}

function CashPointCardForm({ cashPoint, onOpenSession, showDenominations }: { cashPoint: CashPointStatus, onOpenSession: (values: any) => void, showDenominations: boolean }) {
    const t = useTranslations('CashierPage');
    const [denominationQuantities, setDenominationQuantities] = React.useState<Record<string, number>>(() =>
        Object.fromEntries(denominations.map(d => [d.toString(), 0]))
    );

    const form = useForm<{ montoApertura: number }>({
        resolver: zodResolver(z.object({
            montoApertura: z.coerce.number().positive(t('validation.openingAmountRequired')),
        })),
        defaultValues: { montoApertura: 0 }
    });
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleDenominationChange = (denomination: number, quantity: string) => {
        const numQuantity = parseInt(quantity, 10) || 0;
        setDenominationQuantities(prev => ({ ...prev, [denomination]: numQuantity }));
    };

    React.useEffect(() => {
        if (showDenominations) {
            const total = denominations.reduce((acc, den) => acc + (denominationQuantities[den] * den), 0);
            form.setValue('montoApertura', total);
        }
    }, [denominationQuantities, form, showDenominations]);

    const onSubmit = async (values: { montoApertura: number }) => {
        setIsSubmitting(true);
        const payload: OpenSessionFormValues = {
            ...values,
            cashPointId: cashPoint.id,
        };
        if (showDenominations) {
            payload.denominations_details = denominationQuantities;
        }
        await onOpenSession(payload);
        setIsSubmitting(false);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent>
                    {showDenominations ? (
                        <div className="space-y-4">
                            <ScrollArea className="h-64">
                                <div className="space-y-3 p-1">
                                    {denominations.map(den => (
                                        <div key={den} className="grid grid-cols-3 items-center gap-2">
                                            <Label htmlFor={`den-${den}`} className="text-right">
                                                $ {den}
                                            </Label>
                                            <Input
                                                id={`den-${den}`}
                                                type="number"
                                                placeholder="Qty"
                                                min="0"
                                                value={denominationQuantities[den] || ''}
                                                onChange={(e) => handleDenominationChange(den, e.target.value)}
                                            />
                                            <span className="text-sm text-muted-foreground font-mono w-20 text-right">
                                                $ {(denominationQuantities[den] * den).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <FormField
                                control={form.control}
                                name="montoApertura"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('openSession.openingAmount')}</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input type="number" placeholder="0.00" className="pl-8" {...field} readOnly />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    ) : (
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
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? t('openSession.openingButton') : t('openSession.openButton')}
                    </Button>
                </CardFooter>
            </form>
        </Form>
    );
}

function OpenSessionDashboard({ cashPoints, onOpenSession, setActiveSession, showDenominations }: { cashPoints: CashPointStatus[], onOpenSession: (values: any) => void, setActiveSession: (session: CajaSesion) => void, showDenominations: boolean }) {
    const t = useTranslations('CashierPage');
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cashPoints.map(cp => (
                <Card key={cp.id} className="w-full">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            {cp.name}
                            <span className={`h-3 w-3 rounded-full ${cp.status === 'OPEN' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                        </CardTitle>
                        <CardDescription>{cp.status === 'OPEN' ? t('openSession.openBy', { user: cp.session?.user_name }) : t('openSession.closed')}</CardDescription>
                    </CardHeader>
                    {cp.status === 'CLOSED' ? (
                       <CashPointCardForm cashPoint={cp} onOpenSession={onOpenSession} showDenominations={showDenominations} />
                    ) : (
                        <CardContent>
                             <Button className="w-full" onClick={() => cp.session && setActiveSession(cp.session)}>
                                <BookOpenCheck className="mr-2 h-4 w-4" />
                                {t('openSession.viewLog')}
                             </Button>
                        </CardContent>
                    )}
                </Card>
            ))}
        </div>
    );
}

function ActiveSessionDashboard({ session, movements, onCloseSession, isWizardOpen = false }: { session: CajaSesion, movements: CajaMovimiento[], onCloseSession: () => void, isWizardOpen?: boolean }) {
    const t = useTranslations('CashierPage');
    const { user } = useAuth();
    
    const totalIncome = React.useMemo(() => movements.filter(m => m.tipo === 'INGRESO').reduce((sum, m) => sum + m.monto, 0), [movements]);
    
    const dailyPayments = React.useMemo(() => movements.filter(m => m.tipo === 'INGRESO'), [movements]);

    const tColumns = useTranslations('CashierPage.activeSession.columns');
    const movementColumns: ColumnDef<CajaMovimiento>[] = [
      { accessorKey: 'descripcion', header: tColumns('description') },
      { accessorKey: 'monto', header: tColumns('amount'), cell: ({ row }) => `$${row.original.monto.toFixed(2)}` },
      { accessorKey: 'metodoPago', header: tColumns('method') },
      { accessorKey: 'fecha', header: tColumns('date'), cell: ({ row }) => new Date(row.original.fecha).toLocaleTimeString() },
    ];


    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle>{t('activeSession.title')}</CardTitle>
                    <CardDescription>{t('activeSession.description', { user: session.user_name, location: session.cash_point_name })}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{t('activeSession.totalIncome')}</CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${totalIncome.toFixed(2)}</div>
                        </CardContent>
                    </Card>
                </div>
                <Tabs defaultValue="payments">
                    <TabsList>
                        <TabsTrigger value="payments">{t('activeSession.dailyPayments')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="payments">
                        <DataTable columns={movementColumns} data={dailyPayments} />
                    </TabsContent>
                </Tabs>
            </CardContent>
             <CardFooter className="justify-end">
                <Button onClick={onCloseSession}>
                    {isWizardOpen ? t('wizard.next') : t('wizard.startClosing')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>
    );
}

function BlindCloseForm({ form, onSubmit, onBack }: { form: any, onSubmit: (values: any) => void, onBack: () => void }) {
    const t = useTranslations('CashierPage');
    const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);

    React.useEffect(() => {
        const fetchPaymentMethods = async () => {
            try {
                const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/metodospago/all');
                const data = await response.json();
                const methodsData = Array.isArray(data) ? data : (data.payment_methods || data.data || []);
                setPaymentMethods(methodsData);
            } catch (error) {
                console.error("Failed to fetch payment methods:", error);
            }
        };
        fetchPaymentMethods();
    }, []);

    const getFieldName = (methodName: string): keyof CloseSessionFormValues => {
        const name = methodName.toLowerCase();
        if (name.includes('efectivo')) return 'declaradoEfectivo';
        if (name.includes('tarjeta')) return 'declaradoTarjeta';
        if (name.includes('transferencia')) return 'declaradoTransferencia';
        return 'declaradoOtro';
    };


    return (
        <Card className="w-full border-0 shadow-none">
            <CardHeader>
                <CardTitle>{t('closeDialog.title')}</CardTitle>
                <CardDescription>{t('closeDialog.description')}</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="declaradoEfectivo" render={({ field }) => (<FormItem><FormLabel>{t('closeDialog.cash')}</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="declaradoTarjeta" render={({ field }) => (<FormItem><FormLabel>{t('closeDialog.card')}</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="declaradoTransferencia" render={({ field }) => (<FormItem><FormLabel>{t('closeDialog.transfer')}</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="declaradoOtro" render={({ field }) => (<FormItem><FormLabel>{t('closeDialog.other')}</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="notas" render={({ field }) => (<FormItem><FormLabel>{t('closeDialog.notes')}</FormLabel><FormControl><Textarea placeholder={t('closeDialog.notesPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </CardContent>
                    <CardFooter className="justify-between">
                        <Button variant="outline" type="button" onClick={onBack}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> {t('wizard.back')}
                        </Button>
                        <Button type="submit">
                            {t('wizard.next')}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}

function CloseSessionReport({ report, onConfirm, onNewSession, onBack }: { report: CajaSesion, onConfirm: () => Promise<boolean>, onNewSession: () => void, onBack: () => void }) {
    const t = useTranslations('CashierPage.report');
    const tWizard = useTranslations('CashierPage.wizard');
    const [isConfirmed, setIsConfirmed] = React.useState(false);
    
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

    const handleConfirm = async () => {
        const success = await onConfirm();
        if (success) {
            setIsConfirmed(true);
        }
    }
    
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{report.fechaCierre ? t('description', { date: new Date(report.fechaCierre).toLocaleDateString() }) : ''}</CardDescription>
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
            <CardFooter className="justify-between">
                 <Button variant="outline" onClick={onBack} disabled={isConfirmed}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> {tWizard('back')}
                </Button>
                {isConfirmed ? (
                    <Button onClick={onNewSession}><Box className="mr-2 h-4 w-4" />{t('newSessionButton')}</Button>
                ) : (
                    <Button onClick={handleConfirm}>{t('confirmButton')}</Button>
                )}
            </CardFooter>
        </Card>
    );
}

function CloseSessionWizard({
    currentStep,
    setCurrentStep,
    onExitWizard,
    activeSessionDashboard,
    blindCloseForm,
    closeSessionReport
}: {
    currentStep: WizardStep;
    setCurrentStep: React.Dispatch<React.SetStateAction<WizardStep>>;
    onExitWizard: () => void;
    activeSessionDashboard: React.ReactNode;
    blindCloseForm: React.ReactNode;
    closeSessionReport: React.ReactNode;
}) {
    const t = useTranslations('CashierPage.wizard');
    
    const handleTabChange = (value: string) => {
        const newStep = value as WizardStep;
        
        // Prevent clicking future tabs
        if (newStep === 'REPORT' && currentStep !== 'REPORT') {
          return;
        }
        if (newStep === 'DECLARE' && currentStep === 'REVIEW') {
          return;
        }
        
        setCurrentStep(newStep);
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={currentStep} onValueChange={handleTabChange} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="REVIEW" className={cn(currentStep === 'REVIEW' && 'bg-primary text-primary-foreground')}>{t('steps.review')}</TabsTrigger>
                        <TabsTrigger value="DECLARE" className={cn(currentStep === 'DECLARE' && 'bg-primary text-primary-foreground')} disabled={currentStep === 'REVIEW'}>{t('steps.declare')}</TabsTrigger>
                        <TabsTrigger value="REPORT" className={cn(currentStep === 'REPORT' && 'bg-primary text-primary-foreground')} disabled={currentStep !== 'REPORT'}>{t('steps.report')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="REVIEW" className="mt-4">
                        {activeSessionDashboard}
                    </TabsContent>
                    <TabsContent value="DECLARE" className="mt-4">
                         {React.cloneElement(blindCloseForm as React.ReactElement, {
                            onBack: () => setCurrentStep('REVIEW'),
                        })}
                    </TabsContent>
                    <TabsContent value="REPORT" className="mt-4">
                         {React.cloneElement(closeSessionReport as React.ReactElement, { onBack: () => setCurrentStep('DECLARE'), onNewSession: onExitWizard })}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}


    

    

    

    

    

    





