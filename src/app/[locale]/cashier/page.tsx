
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
import { AlertTriangle, Box, Briefcase, DollarSign, LogOut, TrendingDown, TrendingUp, ArrowLeft, ArrowRight, BookOpenCheck, Minus, Plus, RefreshCw, Info, Banknote, Coins, CreditCard } from 'lucide-react';
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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';

const denominationsUYU = [2000, 1000, 500, 200, 100, 50, 20];
const coinsUYU = [10, 5, 2, 1];
const denominationsUSD = [100, 50, 20, 10, 5, 1];
const coinsUSD: number[] = [];

const UYU_IMAGES: Record<number, string> = {
    2000: '/billetes/billete_2000.svg',
    1000: '/billetes/billete_1000.svg',
    500: '/billetes/billete_500.svg',
    200: '/billetes/billete_200.svg',
    100: '/billetes/billete_100.svg',
    50: '/billetes/billete_50.svg',
    20: '/billetes/billete_20.svg',
    10: '/billetes/moneda_10.svg',
    5: '/billetes/moneda_5.svg',
    2: '/billetes/moneda_2.svg',
    1: '/billetes/moneda_1.svg',
};

const USD_IMAGES: Record<number, string> = {
    100: '/billetes/usd/USD_billete_100.svg',
    50: '/billetes/usd/USD_billete_50.svg',
    20: '/billetes/usd/USD_billete_20.svg',
    10: '/billetes/usd/USD_billete_10.svg',
    5: '/billetes/usd/USD_billete_5.svg',
    1: '/billetes/usd/USD_billete_1.svg',
};


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
    const [uyuDenominations, setUyuDenominations] = React.useState<Record<string, number>>({});
    const [usdDenominations, setUsdDenominations] = React.useState<Record<string, number>>({});


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
            } else {
                setActiveSession(null);
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
        } else {
            setSessionMovements([]);
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
                    uyuDenominations={uyuDenominations}
                    setUyuDenominations={setUyuDenominations}
                    usdDenominations={usdDenominations}
                    setUsdDenominations={setUsdDenominations}
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
                    uyuDenominations={uyuDenominations}
                    setUyuDenominations={setUyuDenominations}
                    usdDenominations={usdDenominations}
                    setUsdDenominations={setUsdDenominations}
                    toast={toast}
                />
    }

    return <OpenSessionDashboard 
        cashPoints={cashPoints} 
        onStartOpening={(cashPoint) => {
            setOpeningSessionData({ puntoDeCajaId: cashPoint.id, cash_point_name: cashPoint.name, currency: 'UYU', date_rate: 40 });
            setShowOpeningWizard(true);
        }}
        onViewSession={(session) => {
            setActiveSession(session);
        }}
     />;
}


function OpenSessionDashboard({ cashPoints, onStartOpening, onViewSession }: { cashPoints: CashPointStatus[], onStartOpening: (cashPoint: CashPointStatus) => void, onViewSession: (session: CajaSesion) => void }) {
    const t = useTranslations('CashierPage');
    const { user } = useAuth();
    const router = useRouter();

    const [userHasActiveSession, setUserHasActiveSession] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const checkSession = async () => {
            if (user) {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/active?user_id=${user.id}`, {
                        method: 'GET',
                        mode: 'cors',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    setUserHasActiveSession(response.ok && data.code === 200);
                } catch (error) {
                    console.error("Error checking for active session:", error);
                    setUserHasActiveSession(false);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        };
        checkSession();
    }, [user]);

    const handleSessionClick = (cp: CashPointStatus) => {
        if (cp.status === 'OPEN') {
            if (cp.session?.usuarioId === user?.id) {
                onViewSession(cp.session);
            }
        } else if (!userHasActiveSession) {
            onStartOpening(cp);
        }
    };
    
    if (isLoading) {
        return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[150px] w-full" />)}
        </div>;
    }


    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {cashPoints.map(cp => {
                 const isThisUsersSession = cp.status === 'OPEN' && cp.session?.usuarioId === user?.id;
                 const isAnotherUsersSession = cp.status === 'OPEN' && !isThisUsersSession;
                 const canOpen = cp.status === 'CLOSED' && !userHasActiveSession;

                return (
                    <Card key={cp.id} className={cn("w-full", (isAnotherUsersSession || (cp.status === 'CLOSED' && userHasActiveSession)) && "bg-muted/50 opacity-60")}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                {cp.name}
                                <span className={`h-3 w-3 rounded-full ${cp.status === 'OPEN' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                            </CardTitle>
                            <CardDescription>
                                {cp.status === 'OPEN'
                                    ? t('openSession.openBy', { user: cp.session?.user_name })
                                    : t('openSession.closed')
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                           <Button 
                                className="w-full" 
                                onClick={() => handleSessionClick(cp)} 
                                disabled={isAnotherUsersSession || (cp.status === 'CLOSED' && userHasActiveSession)}
                           >
                                {isThisUsersSession ? (
                                    <>
                                        <BookOpenCheck className="mr-2 h-4 w-4" />
                                        {t('openSession.viewLog')}
                                    </>
                                ) : (
                                    <>
                                        <Box className="mr-2 h-4 w-4" />
                                        {t('openSession.openButton')}
                                    </>
                                )}
                           </Button>
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

            const parseDenominations = (denoDetails: any) => 
                Object.entries(denoDetails || {})
                    .filter(([key, qty]) => key !== 'total' && Number(qty) > 0)
                    .map(([den, qty]) => ({ den: Number(den), qty: Number(qty) }))
                    .filter(item => !isNaN(item.den));
                
            return {
                uyu: parseDenominations(details.uyu),
                usd: parseDenominations(details.usd)
            };

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
                        {openingDetails && (openingDetails.uyu.length > 0 || openingDetails.usd.length > 0) && (
                            <TabsTrigger value="opening_details">{t('activeSession.openingDetails')}</TabsTrigger>
                        )}
                    </TabsList>
                    <TabsContent value="payments">
                        <DataTable columns={movementColumns} data={dailyPayments} />
                    </TabsContent>
                    <TabsContent value="opening_details">
                        {openingDetails && (openingDetails.uyu.length > 0 || openingDetails.usd.length > 0) ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {openingDetails.uyu.length > 0 && (
                                <Table>
                                    <TableHeader><TableRow><TableHead colSpan={3}>UYU</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {openingDetails.uyu.map(({ den, qty }) => (
                                            <TableRow key={`uyu-${den}`}>
                                                <TableCell>$ {den}</TableCell>
                                                <TableCell className="text-right">{Number(qty)}</TableCell>
                                                <TableCell className="text-right">$ {(Number(den) * Number(qty)).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                )}
                                {openingDetails.usd.length > 0 && (
                                <Table>
                                     <TableHeader><TableRow><TableHead colSpan={3}>USD</TableHead></TableRow></TableHeader>
                                     <TableBody>
                                        {openingDetails.usd.map(({ den, qty }) => (
                                            <TableRow key={`usd-${den}`}>
                                                <TableCell>$ {den}</TableCell>
                                                <TableCell className="text-right">{Number(qty)}</TableCell>
                                                <TableCell className="text-right">$ {(Number(den) * Number(qty)).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                )}
                            </div>
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
    sessionMovements,
    uyuDenominations,
    setUyuDenominations,
    usdDenominations,
    setUsdDenominations
}: {
    currentStep: string;
    setCurrentStep: React.Dispatch<React.SetStateAction<string>>;
    onExitWizard: () => void;
    activeSession: CajaSesion;
    sessionMovements: CajaMovimiento[];
    uyuDenominations: Record<string, number>;
    setUyuDenominations: (denominations: Record<string, number>) => void;
    usdDenominations: Record<string, number>;
    setUsdDenominations: (denominations: Record<string, number>) => void;
}) {
    const t = useTranslations('CashierPage.wizard');
     const uyuTotal = useMemo(() => Object.entries(uyuDenominations).reduce((sum, [den, qty]) => sum + (Number(den) || 0) * (qty || 0), 0), [uyuDenominations]);
    const usdTotal = useMemo(() => Object.entries(usdDenominations).reduce((sum, [den, qty]) => sum + (Number(den) || 0) * (qty || 0), 0), [usdDenominations]);
    const totalInSessionCurrency = activeSession.currency === 'UYU' ? uyuTotal + (usdTotal * (activeSession.date_rate || 1)) : usdTotal + (uyuTotal / (activeSession.date_rate || 1));

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={currentStep} onValueChange={setCurrentStep} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="REVIEW" >{t('steps.review')}</TabsTrigger>
                        <TabsTrigger value="COUNT_CASH" disabled={currentStep === 'REVIEW'}>Count Cash</TabsTrigger>
                        <TabsTrigger value="DECLARE" disabled={!['DECLARE', 'REPORT'].includes(currentStep)}>{t('steps.declare')}</TabsTrigger>
                        <TabsTrigger value="REPORT" disabled={currentStep !== 'REPORT'}>{t('steps.report')}</TabsTrigger>
                    </TabsList>
                     <TabsContent value="REVIEW" className="mt-4">
                        <ActiveSessionDashboard 
                           session={activeSession}
                           movements={sessionMovements}
                           onCloseSession={() => setCurrentStep('COUNT_CASH')}
                           onViewAllCashPoints={onExitWizard}
                           isWizardOpen={true}
                        />
                    </TabsContent>
                     <TabsContent value="COUNT_CASH">
                        <CashCounter
                            activeSession={activeSession}
                            uyuDenominations={uyuDenominations}
                            setUyuDenominations={setUyuDenominations}
                            usdDenominations={usdDenominations}
                            setUsdDenominations={setUsdDenominations}
                            onCountComplete={() => setCurrentStep('DECLARE')}
                        />
                    </TabsContent>
                    <TabsContent value="DECLARE">
                        <DeclareCashup activeSession={activeSession} declaredCash={totalInSessionCurrency} onSessionClosed={onExitWizard} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

const CashCounter = ({ activeSession, uyuDenominations, setUyuDenominations, usdDenominations, setUsdDenominations, onCountComplete }: {
    activeSession: CajaSesion;
    uyuDenominations: Record<string, number>;
    setUyuDenominations: (denominations: Record<string, number>) => void;
    usdDenominations: Record<string, number>;
    setUsdDenominations: (denominations: Record<string, number>) => void;
    onCountComplete: () => void;
}) => {
    const uyuTotal = useMemo(() => Object.entries(uyuDenominations).reduce((sum, [den, qty]) => sum + (Number(den) || 0) * (qty || 0), 0), [uyuDenominations]);
    const usdTotal = useMemo(() => Object.entries(usdDenominations).reduce((sum, [den, qty]) => sum + (Number(den) || 0) * (qty || 0), 0), [usdDenominations]);
    const totalInSessionCurrency = activeSession.currency === 'UYU' ? uyuTotal + (usdTotal * (activeSession.date_rate || 1)) : usdTotal + (uyuTotal / (activeSession.date_rate || 1));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Cash Count</CardTitle>
                <CardDescription>Enter the physical cash count for each denomination.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Tabs defaultValue="uyu">
                    <TabsList>
                        <TabsTrigger value="uyu">UYU</TabsTrigger>
                        <TabsTrigger value="usd">USD</TabsTrigger>
                    </TabsList>
                    <TabsContent value="uyu">
                        <DenominationCounter
                            title="UYU Count"
                            denominations={denominationsUYU}
                            coins={coinsUYU}
                            currency="UYU"
                            quantities={uyuDenominations}
                            onQuantitiesChange={setUyuDenominations}
                            imageMap={UYU_IMAGES}
                        />
                    </TabsContent>
                    <TabsContent value="usd">
                        <DenominationCounter
                            title="USD Count"
                            denominations={denominationsUSD}
                            coins={coinsUSD}
                            currency="USD"
                            quantities={usdDenominations}
                            onQuantitiesChange={setUsdDenominations}
                            imageMap={USD_IMAGES}
                        />
                    </TabsContent>
                </Tabs>
            </CardContent>
            <CardFooter className='justify-between'>
                <div className='font-semibold'>Total Declared ({activeSession.currency}): ${totalInSessionCurrency.toFixed(2)}</div>
                <Button onClick={onCountComplete}>Continue to Declaration</Button>
            </CardFooter>
        </Card>
    );
};


const DeclareCashup = ({ activeSession, declaredCash, onSessionClosed }: { activeSession: CajaSesion, declaredCash: number, onSessionClosed: () => void }) => {
    const t = useTranslations('CashierPage.declareCashup');
    const { toast } = useToast();
    const [notes, setNotes] = React.useState('');
    const [systemTotals, setSystemTotals] = React.useState({ cash: 0, other: 0 });
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchDeclareData = async () => {
            if (!activeSession.id) return;
            setIsLoading(true);
            try {
                const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/declare?cash_session_id=${activeSession.id}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch declaration data.');
                }
                const data = await response.json();
                
                const sessionCurrencyData = (Array.isArray(data) ? data : []).find((d:any) => d.moneda === activeSession.currency);

                if (sessionCurrencyData) {
                    setSystemTotals({
                        cash: parseFloat(sessionCurrencyData.total_efectivo) || 0,
                        other: parseFloat(sessionCurrencyData.total_otros_medios) || 0,
                    });
                } else {
                    setSystemTotals({ cash: 0, other: 0 });
                }
                
            } catch (error) {
                console.error("Error fetching declare data:", error);
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: error instanceof Error ? error.message : 'Could not load session totals.',
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchDeclareData();
    }, [activeSession.id, activeSession.currency, toast]);


    const handleCloseSession = async () => {
        const payload = {
            cash_session_id: activeSession.id,
            openingAmount: activeSession.montoApertura,
            declaredCash: declaredCash,
            totalCashInflow: systemTotals.cash,
            totalOtherInflow: systemTotals.other,
            calculatedCash: calculatedCash,
            cashDiscrepancy: declaredCash - calculatedCash,
            notes: notes,
        };

        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to close session.');
            }

            toast({
                title: 'Session Closed',
                description: 'The cash session has been successfully closed.',
            });
            onSessionClosed();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.',
            });
        }
    };
    
     const calculatedCash = (activeSession.montoApertura || 0) + systemTotals.cash;
     const difference = declaredCash - calculatedCash;
    
    if (isLoading) {
        return <div className="p-6 text-center">Loading system totals...</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <Label htmlFor="cash" className="flex items-center gap-2 font-semibold">
                        <Banknote className="h-5 w-5 text-muted-foreground" />
                        {t('methods.cash')}
                    </Label>
                     <div className="grid grid-cols-3 items-center gap-2 text-sm">
                        <div className="text-center">
                            <div className="text-muted-foreground">{t('systemTotal')}</div>
                            <div className="font-semibold">${calculatedCash.toFixed(2)}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-muted-foreground">Declared</div>
                            <div className="font-semibold">${declaredCash.toFixed(2)}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-muted-foreground">{t('difference')}</div>
                            <div className={cn("font-semibold", difference < 0 ? "text-red-500" : "text-green-500")}>${difference.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <Label htmlFor="other" className="flex items-center gap-2 font-semibold">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        {t('methods.other')}
                    </Label>
                     <div className="flex justify-start items-center text-sm md:pl-4">
                        <div>
                            <div className="text-muted-foreground">{t('systemTotal')}</div>
                            <div className="font-semibold">${systemTotals.other.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="notes">{t('notes')}</Label>
                    <Textarea id="notes" placeholder={t('notesPlaceholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />
                 </div>
            </CardContent>
            <CardFooter>
                 <Button className="w-full md:w-auto ml-auto" onClick={handleCloseSession}>
                    {t('closeSessionButton')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>
    )
};


const DenominationCounter = ({ title, denominations, coins, currency, quantities, onQuantitiesChange, lastClosingDetails, imageMap }: { 
    title: string, 
    denominations: number[], 
    coins: number[],
    currency: string,
    quantities: Record<string, number>,
    onQuantitiesChange: (details: Record<string, number>) => void,
    lastClosingDetails?: Record<string, number> | null,
    imageMap: Record<number, string>
}) => {
    const total = React.useMemo(() => {
        return [...denominations, ...coins].reduce((sum, den) => sum + (Number(den) || 0) * (quantities[den] || 0), 0)
    }, [quantities, denominations, coins]);

    const handleQuantityChange = (denomination: number, quantity: string) => {
        const newQuantities = { ...quantities, [denomination]: parseInt(quantity, 10) || 0 };
        onQuantitiesChange(newQuantities);
    };

    const setAllTo = (val: number) => {
        const newQuantities = [...denominations, ...coins].reduce((acc, den) => {
            acc[den] = val;
            return acc;
        }, {} as Record<string, number>);
        onQuantitiesChange(newQuantities);
    }
    
    const loadLastClosing = () => {
        if(lastClosingDetails){
            onQuantitiesChange(lastClosingDetails);
        }
    }
    

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-medium text-lg">{title}</h3>
                <div className="text-xl font-bold">{new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(total)}</div>
            </div>
             <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAllTo(0)}>Prefill with 0</Button>
                {lastClosingDetails && <Button type="button" variant="secondary" size="sm" onClick={loadLastClosing}>Prefill with Last Closing Cashup</Button>}
            </div>
            <ScrollArea className="h-96">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 p-1">
                    {denominations.map(den => (
                        <div key={den} className="grid grid-cols-[80px,1fr,auto] items-center gap-2">
                             <div className="w-[80px] h-[40px] relative">
                                {imageMap[den] ? (
                                    <Image src={imageMap[den]} alt={`${den} ${currency}`} layout="fill" className="rounded-md object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">No Image</div>
                                )}
                            </div>
                             <Label htmlFor={`den-${den}`} className="text-right font-semibold text-lg">
                                {new Intl.NumberFormat('es-UY', { style: 'currency', currency: currency, minimumFractionDigits: 0 }).format(den)}
                            </Label>
                             <div className="flex items-center">
                                <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => handleQuantityChange(den, String((quantities[den] || 0) - 1))}><Minus className="h-4 w-4" /></Button>
                                <Input
                                    id={`den-${den}`}
                                    type="number"
                                    min="0"
                                    value={quantities[den] || ''}
                                    onChange={(e) => handleQuantityChange(den, e.target.value)}
                                    className="w-20 text-center mx-1 text-lg"
                                />
                                <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => handleQuantityChange(den, String((quantities[den] || 0) + 1))}><Plus className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
                 {coins.length > 0 && <div className="mt-6 border-t pt-4">
                    <h4 className="font-medium text-md mb-2 flex items-center gap-2"><Coins /> Monedas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 p-1">
                        {coins.map(den => (
                            <div key={den} className="grid grid-cols-[80px,1fr,auto] items-center gap-2">
                                <div className="w-[40px] h-[40px] relative">
                                    {imageMap[den] ? (
                                        <Image src={imageMap[den]} alt={`${den} ${currency}`} layout="fill" className="rounded-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-muted rounded-full flex items-center justify-center text-xs text-muted-foreground">No Img</div>
                                    )}
                                </div>
                                <Label htmlFor={`den-${den}`} className="text-right font-semibold text-lg">
                                    {new Intl.NumberFormat('es-UY', { style: 'currency', currency: currency, minimumFractionDigits: 0 }).format(den)}
                                </Label>
                                <div className="flex items-center">
                                    <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => handleQuantityChange(den, String((quantities[den] || 0) - 1))}><Minus className="h-4 w-4" /></Button>
                                    <Input
                                        id={`den-${den}`}
                                        type="number"
                                        min="0"
                                        value={quantities[den] || ''}
                                        onChange={(e) => handleQuantityChange(den, e.target.value)}
                                        className="w-20 text-center mx-1 text-lg"
                                    />
                                    <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => handleQuantityChange(den, String((quantities[den] || 0) + 1))}><Plus className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>}
            </ScrollArea>
        </div>
    );
};


function OpenSessionWizard({ currentStep, setCurrentStep, onExitWizard, sessionData, setSessionData, uyuDenominations, setUyuDenominations, usdDenominations, setUsdDenominations, toast }: {
    currentStep: OpenSessionStep;
    setCurrentStep: React.Dispatch<React.SetStateAction<OpenSessionStep>>;
    onExitWizard: () => void;
    sessionData: Partial<CajaSesion>;
    setSessionData: React.Dispatch<React.SetStateAction<Partial<CajaSesion>>>;
    uyuDenominations: Record<string, number>;
    setUyuDenominations: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    usdDenominations: Record<string, number>;
    setUsdDenominations: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    toast: any;
}) {
    const t = useTranslations('CashierPage');
    const { user } = useAuth();
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const [buyRate, setBuyRate] = React.useState(0);
    const [sellRate, setSellRate] = React.useState(0);
    const [avgRate, setAvgRate] = React.useState(0);
    const [exchangeRatesHtml, setExchangeRatesHtml] = React.useState('');
    const [exchangeRateStatus, setExchangeRateStatus] = React.useState<'loading' | 'loaded' | 'error'>('loading');

    const fetchRates = React.useCallback(async () => {
        const today = new Date().toISOString().split('T')[0];
        const cachedRates = localStorage.getItem('exchangeRates');

        if (cachedRates) {
            const { date, data } = JSON.parse(cachedRates);
            if (date === today) {
                setBuyRate(data.buyRate);
                setSellRate(data.sellRate);
                setAvgRate(data.avgRate);
                setSessionData(prev => ({...prev, date_rate: data.avgRate}));
                setExchangeRatesHtml(data.exchangeRatesHtml);
                setExchangeRateStatus('loaded');
                return;
            }
        }

        setExchangeRateStatus('loading');
        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cotizaciones');
            if (!response.ok) throw new Error('Failed to fetch exchange rates');
            const data = await response.json();
            
            const compra = parseFloat(data.compra);
            const venta = parseFloat(data.venta);
            
            setBuyRate(compra);
            setSellRate(venta);
            
            const avg = (compra + venta) / 2;
            setAvgRate(avg);
            setSessionData(prev => ({...prev, date_rate: avg}));
            setExchangeRatesHtml(data.html);
            setExchangeRateStatus('loaded');

            localStorage.setItem('exchangeRates', JSON.stringify({
                date: today,
                data: {
                    buyRate: compra,
                    sellRate: venta,
                    avgRate: avg,
                    exchangeRatesHtml: data.html,
                }
            }));

        } catch (error) {
            console.error("Error fetching rates", error);
            setExchangeRateStatus('error');
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch exchange rates.' });
        }
    }, [setSessionData, toast]);

    React.useEffect(() => {
        if (currentStep === 'CONFIG') {
            fetchRates();
        }
    }, [currentStep, fetchRates]);

    const uyuTotal = React.useMemo(() => Object.entries(uyuDenominations).reduce((sum, [den, qty]) => sum + (Number(den) || 0) * (qty || 0), 0), [uyuDenominations]);
    const usdTotal = React.useMemo(() => Object.entries(usdDenominations).reduce((sum, [den, qty]) => sum + (Number(den) || 0) * (qty || 0), 0), [usdDenominations]);
    const usdEquivalentInUYU = usdTotal * (sessionData.date_rate || 0);
    const totalOpeningAmount = uyuTotal + usdEquivalentInUYU;
    
    const memoizedSetUyuDenominations = useCallback((details: Record<string, number>) => setUyuDenominations(details), [setUyuDenominations]);
    const memoizedSetUsdDenominations = useCallback((details: Record<string, number>) => setUsdDenominations(details), [setUsdDenominations]);
    
    const mockLastClosing = {
        uyu: { "2000": 5, "1000": 10, "500": 4, "100": 20, "50": 15, "20": 10, "10": 30, "5": 25, "2": 50, "1": 100 },
        usd: { "100": 3, "50": 5, "20": 10, "10": 15, "5": 20, "1": 50 },
    };


    const handleNextStep = async () => {
        if (currentStep === 'CONFIG') {
            if (!sessionData.puntoDeCajaId || !sessionData.currency || !sessionData.date_rate) {
                toast({ variant: 'destructive', title: t('toast.error'), description: 'Please fill all fields.' });
                return;
            }
            setCurrentStep('COUNT_UYU');
        } else if (currentStep === 'COUNT_UYU') {
            setCurrentStep('COUNT_USD');
        } else if (currentStep === 'COUNT_USD') {
            setCurrentStep('CONFIRM');
        }
    };
    
    const handleConfirmAndOpen = async () => {
        setIsSubmitting(true);
        const openingDetails = {
            currency: sessionData.currency,
            date_rate: sessionData.date_rate,
            uyu: { ...uyuDenominations, total: uyuTotal },
            usd: { ...usdDenominations, total: usdTotal, exchange_rate: sessionData.date_rate, equivalent_uyu: usdEquivalentInUYU },
            grand_total_uyu: totalOpeningAmount,
            opened_by: user?.name,
            opened_at: new Date().toISOString()
        };

        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cash_point_id: sessionData.puntoDeCajaId,
                    currency: sessionData.currency,
                    date_rate: sessionData.date_rate,
                    user_id: user?.id,
                    status: 'OPEN',
                    opening_amount: totalOpeningAmount,
                    opening_details: JSON.stringify(openingDetails),
                })
            });
            if (!response.ok) throw new Error('Failed to finalize session opening.');
            
            toast({ title: t('toast.openSuccessTitle'), description: t('toast.openSuccessDescription') });
            onExitWizard();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Could not finalize session opening.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePreviousStep = async () => {
        if (currentStep === 'CONFIRM') setCurrentStep('COUNT_USD');
        else if (currentStep === 'COUNT_USD') setCurrentStep('COUNT_UYU');
        else if (currentStep === 'COUNT_UYU') setCurrentStep('CONFIG');
        else if (currentStep === 'CONFIG') onExitWizard();
    };

    const renderConfigContent = () => {
        const disabled = exchangeRateStatus === 'loading';
        if (exchangeRateStatus === 'loading') {
            return (
                <div className="flex flex-col items-center justify-center h-96">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Loading Today's Exchange Rates...</p>
                </div>
            );
        }
        if (exchangeRateStatus === 'error') {
             return (
                 <div className="flex flex-col items-center justify-center h-96">
                    <AlertTriangle className="h-8 w-8 text-destructive mb-4" />
                    <p className="text-destructive mb-4">Failed to load exchange rates.</p>
                    <div className="flex gap-4">
                        <Button onClick={() => fetchRates()}>Retry</Button>
                        <Button variant="outline" onClick={() => setExchangeRateStatus('loaded')}>Set Manually</Button>
                    </div>
                </div>
            );
        }
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-4">
                <div className="space-y-2 text-sm text-left">
                    <div><strong>{t('openSession.terminal')}:</strong> {sessionData.cash_point_name}</div>
                    <div><strong>{t('openSession.user')}:</strong> {user?.name}</div>
                    <div><strong>{t('openSession.openingDate')}:</strong> {new Date().toLocaleString()}</div>
                </div>
                 <Alert variant="info" className="bg-orange-100 border-orange-200 text-orange-800">
                    <Info className="h-4 w-4" />
                    <AlertDescription>{t('openSession.exchangeRateTooltip')}</AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="buy_rate">Compra</Label>
                        <Input id="buy_rate" value={buyRate.toFixed(2)} readOnly disabled={disabled} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sell_rate">Venta</Label>
                        <Input id="sell_rate" value={sellRate.toFixed(2)} readOnly disabled={disabled} />
                    </div>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="date_rate">{t('openSession.exchangeRate')}</Label>
                    <Input id="date_rate" type="number" step="0.00001" value={sessionData.date_rate || ''} onChange={(e) => setSessionData(prev => ({ ...prev, date_rate: parseFloat(e.target.value) || 0 }))} disabled={disabled}/>
                </div>
                 <div className="space-y-1">
                    <Label>{t('openSession.currency')}</Label>
                    <Select value={sessionData.currency} onValueChange={(value) => setSessionData(prev => ({...prev, currency: value as 'UYU' | 'USD' | 'EUR'}))} disabled={disabled}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="UYU">UYU</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              <div
                className="h-[400px] w-full overflow-y-auto rounded-lg"
                dangerouslySetInnerHTML={{ __html: exchangeRatesHtml }}
              />
            </div>
        );
    }
    
    const stepTitles: Record<OpenSessionStep, string> = {
        CONFIG: 'Configuration',
        COUNT_UYU: 'Cash Count (UYU)',
        COUNT_USD: 'Cash Count (USD)',
        CONFIRM: 'Confirmation'
    };

    const stepComponents = {
        'CONFIG': renderConfigContent(),
        'COUNT_UYU': (
            <DenominationCounter 
                title="Conteo de Efectivo (UYU)"
                denominations={denominationsUYU}
                coins={coinsUYU}
                currency="UYU"
                quantities={uyuDenominations}
                onQuantitiesChange={memoizedSetUyuDenominations}
                lastClosingDetails={mockLastClosing.uyu}
                imageMap={UYU_IMAGES}
            />
        ),
        'COUNT_USD': (
             <DenominationCounter 
                title="Conteo de Efectivo (USD)"
                denominations={denominationsUSD}
                coins={coinsUSD}
                currency="USD"
                quantities={usdDenominations}
                onQuantitiesChange={memoizedSetUsdDenominations}
                lastClosingDetails={mockLastClosing.usd}
                imageMap={USD_IMAGES}
            />
        ),
        'CONFIRM': (
             <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>{t('confirmation.sessionInfo')}</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-sm">
                        <p><strong>{t('openSession.terminal')}:</strong> {sessionData.cash_point_name}</p>
                        <p><strong>{t('openSession.user')}:</strong> {user?.name}</p>
                        <p><strong>{t('openSession.openingDate')}:</strong> {new Date().toLocaleString()}</p>
                        <p><strong>{t('openSession.currency')}:</strong> {sessionData.currency}</p>
                        <p><strong>{t('openSession.exchangeRate')}:</strong> {sessionData.date_rate?.toFixed(5)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>{t('confirmation.cashSummary')}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-lg"><strong>{t('confirmation.totalUYU')}:</strong> {uyuTotal.toFixed(2)} UYU</div>
                        <div className="text-lg"><strong>{t('confirmation.totalUSD')}:</strong> {usdTotal.toFixed(2)} USD ({usdEquivalentInUYU.toFixed(2)} UYU)</div>
                        <div className="text-2xl font-bold border-t pt-4 mt-4">{t('confirmation.totalOpening')}: {totalOpeningAmount.toFixed(2)} {sessionData.currency}</div>
                        
                        <Collapsible>
                            <CollapsibleTrigger asChild>
                                <Button variant="link" className="p-0">Ver desglose</Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-4 mt-2">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Denominación UYU</TableHead><TableHead>Cantidad</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {Object.entries(uyuDenominations).map(([den, qty]) => qty > 0 && <TableRow key={den}><TableCell>{den}</TableCell><TableCell>{qty}</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                                 <Table>
                                    <TableHeader><TableRow><TableHead>Denominación USD</TableHead><TableHead>Cantidad</TableHead></TableRow></TableHeader>
                                     <TableBody>
                                        {Object.entries(usdDenominations).map(([den, qty]) => qty > 0 && <TableRow key={den}><TableCell>{den}</TableCell><TableCell>{qty}</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </CollapsibleContent>
                        </Collapsible>
                    </CardContent>
                </Card>
            </div>
        )
    };
    
    return(
        <Card>
             <CardHeader>
                <CardTitle>{t('openSession.wizardTitle')}: <span className="font-bold">{stepTitles[currentStep]}</span></CardTitle>
                <CardDescription>
                    Paso {Object.keys(stepComponents).indexOf(currentStep) + 1} de {Object.keys(stepComponents).length}
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {stepComponents[currentStep]}
            </CardContent>
            <CardFooter className="justify-between">
                <Button variant="outline" onClick={handlePreviousStep} disabled={isSubmitting}>{t('wizard.back')}</Button>
                 <Button onClick={currentStep === 'CONFIRM' ? handleConfirmAndOpen : handleNextStep} disabled={isSubmitting || exchangeRateStatus === 'loading'}>
                     {isSubmitting ? 'Abriendo...' : (currentStep === 'CONFIRM' ? t('confirmation.confirmButton') : t('wizard.next'))}
                 </Button>
            </CardFooter>
        </Card>
    );
}
    

    

    

    















    

  


    

    

    

