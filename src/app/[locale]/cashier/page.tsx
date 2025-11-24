
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Box, Briefcase, DollarSign, LogOut, TrendingDown, TrendingUp, ArrowLeft, ArrowRight, BookOpenCheck, Minus, Plus } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const denominationsUYU = [2000, 1000, 500, 200, 100, 50, 20, 10];
const denominationsUSD = [100, 50, 20, 10, 5, 1];


type OpenSessionStep = 'CONFIG' | 'COUNT_UYU' | 'COUNT_USD' | 'CONFIRM';

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
    
    const [showClosingWizard, setShowClosingWizard] = React.useState(false);
    const [closeWizardStep, setCloseWizardStep] = React.useState('REVIEW');
    
    const [showOpeningWizard, setShowOpeningWizard] = React.useState(false);
    const [openWizardStep, setOpenWizardStep] = React.useState<OpenSessionStep>('CONFIG');
    const [openingSessionData, setOpeningSessionData] = React.useState<Partial<CajaSesion>>({});


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
                    opening_details: cp.opening_details,
                    currency: cp.currency,
                    date_rate: cp.date_rate
                } : undefined,
            }));
            setCashPoints(mappedCashPoints);

            const activeUserSession = mappedCashPoints.find(cp => cp.status === 'OPEN' && cp.session?.usuarioId === user?.id);
            if(activeUserSession && activeUserSession.session){
                setActiveSession(activeUserSession.session);
            }
        } catch (error) {
            setServerError(error instanceof Error ? error.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [user]);

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
                usuarioId: mov.registered_by_user,
                metodoPago: (mov.payment_method_name || 'otro').toUpperCase() as any,
            })));
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch session movements.' });
            setSessionMovements([]);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchCashPointStatus();
    }, [fetchCashPointStatus]);

    React.useEffect(() => {
        if (activeSession) {
            fetchSessionMovements(activeSession.id);
        }
    }, [activeSession, fetchSessionMovements]);

    React.useEffect(() => {
    return () => {
      setActiveSession(null);
      setShowClosingWizard(false);
      setShowOpeningWizard(false);
      setCloseWizardStep('REVIEW');
      setOpenWizardStep('CONFIG');
    };
    }, []);
    
    if (isLoading) {
        return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[200px] w-full" />)}
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
                    currentStep={closeWizardStep}
                    setCurrentStep={setCloseWizardStep}
                    onExitWizard={() => {
                      setShowClosingWizard(false);
                      setCloseWizardStep('REVIEW');
                      setClosedSessionReport(null);
                      setActiveSession(null);
                      fetchCashPointStatus();
                    }}
                    activeSession={activeSession}
                    sessionMovements={sessionMovements}
                />
        }

        return (
            <ActiveSessionDashboard 
                session={activeSession}
                movements={sessionMovements}
                onCloseSession={() => setShowClosingWizard(true)}
                onViewAllCashPoints={() => setActiveSession(null)}
            />
        );
    }
    
    if (showOpeningWizard) {
        return <OpenSessionWizard
                    currentStep={openWizardStep}
                    setCurrentStep={setOpenWizardStep}
                    onExitWizard={() => {
                        setShowOpeningWizard(false);
                        setOpenWizardStep('CONFIG');
                        fetchCashPointStatus();
                    }}
                    sessionData={openingSessionData}
                    setSessionData={setOpeningSessionData}
                />
    }

    return <OpenSessionDashboard 
        cashPoints={cashPoints} 
        onSetActiveSession={setActiveSession}
        onStartOpening={(cashPoint) => {
            setOpeningSessionData({ puntoDeCajaId: cashPoint.id, cash_point_name: cashPoint.name });
            setShowOpeningWizard(true);
        }}
     />;
}


function OpenSessionDashboard({ cashPoints, onStartOpening, onSetActiveSession }: { cashPoints: CashPointStatus[], onStartOpening: (cashPoint: CashPointStatus) => void, onSetActiveSession: (session: CajaSesion) => void }) {
    const t = useTranslations('CashierPage');
    const { user } = useAuth();

    const userHasActiveSession = React.useMemo(() => 
        cashPoints.some(cp => cp.status === 'OPEN' && cp.session?.usuarioId === user?.id),
    [cashPoints, user]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {cashPoints.map(cp => {
                const isThisUsersSession = cp.status === 'OPEN' && cp.session?.usuarioId === user?.id;
                const isDisabled = userHasActiveSession && !isThisUsersSession;

                return (
                    <Card key={cp.id} className={cn("w-full", isDisabled && "bg-muted/50 opacity-60")}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                {cp.name}
                                <span className={`h-3 w-3 rounded-full ${cp.status === 'OPEN' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                            </CardTitle>
                            <CardDescription>
                                {cp.status === 'OPEN'
                                    ? isThisUsersSession 
                                        ? `You have an active session here.`
                                        : t('openSession.openBy', { user: cp.session?.user_name })
                                    : t('openSession.closed')
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                           {cp.status === 'CLOSED' ? (
                                <Button className="w-full" onClick={() => onStartOpening(cp)} disabled={isDisabled}>
                                    <Box className="mr-2 h-4 w-4" />
                                    {t('openSession.openButton')}
                                </Button>
                           ) : (
                                <Button className="w-full" onClick={() => cp.session && onSetActiveSession(cp.session)} disabled={!isThisUsersSession}>
                                    <BookOpenCheck className="mr-2 h-4 w-4" />
                                    {isThisUsersSession ? t('openSession.viewLog') : 'View Session (Read-Only)'}
                                 </Button>
                           )}
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    );
}

function ActiveSessionDashboard({ session, movements, onCloseSession, isWizardOpen = false, onViewAllCashPoints }: { session: CajaSesion, movements: CajaMovimiento[], onCloseSession: () => void, isWizardOpen?: boolean, onViewAllCashPoints: () => void; }) {
    const t = useTranslations('CashierPage');
    
    const totalIncome = React.useMemo(() => movements.filter(m => m.tipo === 'INGRESO').reduce((sum, m) => sum + m.monto, 0), [movements]);
    
    const dailyPayments = React.useMemo(() => movements.filter(m => m.tipo === 'INGRESO'), [movements]);

    const tColumns = useTranslations('CashierPage.activeSession.columns');
    const movementColumns: ColumnDef<CajaMovimiento>[] = [
      { accessorKey: 'descripcion', header: tColumns('description') },
      { accessorKey: 'monto', header: tColumns('amount'), cell: ({ row }) => `$${row.original.monto.toFixed(2)}` },
      { accessorKey: 'metodoPago', header: tColumns('method') },
      { accessorKey: 'fecha', header: tColumns('date'), cell: ({ row }) => new Date(row.original.fecha).toLocaleTimeString() },
    ];
    
    const openingDetails = React.useMemo(() => {
        if (!session.opening_details) return null;
        try {
            const details = typeof session.opening_details === 'string' 
                ? JSON.parse(session.opening_details) 
                : session.opening_details;
            return Object.entries(details).filter(([, qty]) => Number(qty) > 0);
        } catch (e) {
            console.error("Failed to parse opening_details", e);
            return null;
        }
    }, [session.opening_details]);


    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle>{t('activeSession.title')}</CardTitle>
                    <CardDescription>{t('activeSession.description', { user: session.user_name, location: session.cash_point_name })}</CardDescription>
                </div>
                 <div className="flex items-center gap-2">
                    <div className="text-right">
                        <div className="text-sm font-medium">{t('openSession.currency')}</div>
                        <div className="text-sm text-muted-foreground">{session.currency}</div>
                    </div>
                     <div className="text-right">
                        <div className="text-sm font-medium">{t('openSession.exchangeRate')}</div>
                        <div className="text-sm text-muted-foreground">{session.date_rate?.toFixed(5)}</div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{t('openSession.openingAmount')}</CardTitle>
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
                        {openingDetails && openingDetails.length > 0 && (
                            <TabsTrigger value="opening_details">{t('activeSession.openingDetails')}</TabsTrigger>
                        )}
                    </TabsList>
                    <TabsContent value="payments">
                        <DataTable columns={movementColumns} data={dailyPayments} />
                    </TabsContent>
                    <TabsContent value="opening_details">
                        {openingDetails && openingDetails.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('activeSession.denomination')}</TableHead>
                                        <TableHead className="text-right">{t('activeSession.quantity')}</TableHead>
                                        <TableHead className="text-right">{t('activeSession.subtotal')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {openingDetails.map(([den, qty]) => (
                                        <TableRow key={den}>
                                            <TableCell>$ {den}</TableCell>
                                            <TableCell className="text-right">{Number(qty)}</TableCell>
                                            <TableCell className="text-right">$ {(Number(den) * Number(qty)).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : <p className="text-muted-foreground p-4 text-center">No denomination details available for this session.</p>}
                    </TabsContent>
                </Tabs>
            </CardContent>
             <CardFooter className="justify-between">
                <Button variant="outline" onClick={onViewAllCashPoints}>{t('viewAllCashPoints')}</Button>
                <Button onClick={onCloseSession}>
                    {isWizardOpen ? t('wizard.next') : t('wizard.startClosing')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>
    );
}

function CloseSessionWizard({
    currentStep,
    setCurrentStep,
    onExitWizard,
    activeSession,
    sessionMovements
}: {
    currentStep: string;
    setCurrentStep: React.Dispatch<React.SetStateAction<string>>;
    onExitWizard: () => void;
    activeSession: CajaSesion;
    sessionMovements: CajaMovimiento[];
}) {
    const t = useTranslations('CashierPage.wizard');
    const tabs = ['REVIEW', 'DECLARE', 'REPORT'];
    
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={currentStep} onValueChange={setCurrentStep} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="REVIEW" >{t('steps.review')}</TabsTrigger>
                        <TabsTrigger value="DECLARE" disabled={currentStep === 'REVIEW'}>{t('steps.declare')}</TabsTrigger>
                        <TabsTrigger value="REPORT" disabled={currentStep !== 'REPORT'}>{t('steps.report')}</TabsTrigger>
                    </TabsList>
                     <TabsContent value="REVIEW" className="mt-4">
                        <ActiveSessionDashboard 
                           session={activeSession}
                           movements={sessionMovements}
                           onCloseSession={() => setCurrentStep('DECLARE')}
                           onViewAllCashPoints={onExitWizard}
                           isWizardOpen={true}
                        />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

const DenominationCounter = ({ title, denominations, currency, onTotalChange }: { title: string, denominations: number[], currency: string, onTotalChange: (total: number) => void }) => {
    const [quantities, setQuantities] = React.useState<Record<string, number>>(() =>
        Object.fromEntries(denominations.map(d => [d.toString(), 0]))
    );
     const [coinsAmount, setCoinsAmount] = React.useState(0);

    const handleQuantityChange = (denomination: number, quantity: string, operation?: 'inc' | 'dec') => {
        const currentQty = quantities[denomination] || 0;
        let newQty = 0;
        if(operation === 'inc') {
            newQty = currentQty + 1;
        } else if (operation === 'dec') {
            newQty = Math.max(0, currentQty - 1);
        } else {
            newQty = parseInt(quantity, 10) || 0;
        }
        setQuantities(prev => ({ ...prev, [denomination]: newQty }));
    };

    React.useEffect(() => {
        const total = denominations.reduce((acc, den) => acc + (quantities[den] * den), 0) + coinsAmount;
        onTotalChange(total);
    }, [quantities, coinsAmount, denominations, onTotalChange]);

    return (
        <div className="space-y-4">
            <h3 className="font-medium">{title}</h3>
            <ScrollArea className="h-96">
                <div className="space-y-3 p-1">
                    {denominations.map(den => (
                        <div key={den} className="grid grid-cols-[1fr,auto,1fr] items-center gap-2">
                             <Label htmlFor={`den-${den}`} className="text-right">
                                {new Intl.NumberFormat('es-UY', { style: 'currency', currency: currency, minimumFractionDigits: 0 }).format(den)}
                            </Label>
                             <div className="flex items-center">
                                <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(den, '', 'dec')}><Minus className="h-4 w-4" /></Button>
                                <Input
                                    id={`den-${den}`}
                                    type="number"
                                    min="0"
                                    value={quantities[den] || ''}
                                    onChange={(e) => handleQuantityChange(den, e.target.value)}
                                    className="w-20 text-center mx-1"
                                />
                                <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(den, '', 'inc')}><Plus className="h-4 w-4" /></Button>
                            </div>
                            <span className="text-sm text-muted-foreground font-mono w-28 text-right">
                                {new Intl.NumberFormat('es-UY', { style: 'currency', currency: currency }).format(quantities[den] * den)}
                            </span>
                        </div>
                    ))}
                    <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 pt-4 border-t">
                        <Label htmlFor="coins" className="text-right">Monedas</Label>
                        <Input
                            id="coins"
                            type="number"
                            placeholder="Monto"
                            min="0"
                            value={coinsAmount || ''}
                            onChange={(e) => setCoinsAmount(Number(e.target.value))}
                            className="w-40"
                        />
                         <span className="text-sm text-muted-foreground font-mono w-28 text-right">
                            {new Intl.NumberFormat('es-UY', { style: 'currency', currency: currency }).format(coinsAmount)}
                        </span>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
};


function OpenSessionWizard({ currentStep, setCurrentStep, onExitWizard, sessionData, setSessionData }: {
    currentStep: OpenSessionStep;
    setCurrentStep: React.Dispatch<React.SetStateAction<OpenSessionStep>>;
    onExitWizard: () => void;
    sessionData: Partial<CajaSesion>;
    setSessionData: React.Dispatch<React.SetStateAction<Partial<CajaSesion>>>;
}) {
    const t = useTranslations('CashierPage');
    const { user } = useAuth();
    
    return(
        <Card>
             <CardHeader>
                <CardTitle>{t('openSession.wizardTitle')}</CardTitle>
                <CardDescription>Paso X de 4</CardDescription>
            </CardHeader>
            <CardContent>
                 {currentStep === 'CONFIG' && (
                     <p>Paso 1: Config</p>
                 )}
                 {currentStep === 'COUNT_UYU' && (
                    <DenominationCounter 
                        title="Conteo de Efectivo (UYU)"
                        denominations={denominationsUYU}
                        currency="UYU"
                        onTotalChange={(total) => console.log('UYU Total', total)}
                    />
                 )}
                 {currentStep === 'COUNT_USD' && (
                    <DenominationCounter 
                        title="Conteo de Efectivo (USD)"
                        denominations={denominationsUSD}
                        currency="USD"
                        onTotalChange={(total) => console.log('USD Total', total)}
                    />
                 )}
            </CardContent>
            <CardFooter className="justify-between">
                <Button variant="outline" onClick={() => {
                    if (currentStep === 'CONFIG') onExitWizard();
                    else if (currentStep === 'COUNT_UYU') setCurrentStep('CONFIG');
                    else if (currentStep === 'COUNT_USD') setCurrentStep('COUNT_UYU');
                    else if (currentStep === 'CONFIRM') setCurrentStep('COUNT_USD');
                }}>Atrás</Button>
                 <Button onClick={() => {
                    if (currentStep === 'CONFIG') setCurrentStep('COUNT_UYU');
                    else if (currentStep === 'COUNT_UYU') setCurrentStep('COUNT_USD');
                    else if (currentStep === 'COUNT_USD') setCurrentStep('CONFIRM');
                    // else if (currentStep === 'CONFIRM') handleConfirm();
                }}>Siguiente</Button>
            </CardFooter>
        </Card>
    );
}

    

    
