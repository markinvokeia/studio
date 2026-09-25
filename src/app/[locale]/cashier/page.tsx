
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { getPaymentMethodLabel, isCashEquivalentMethod, isKnownPaymentMethodCode, normalizePaymentMethodCode } from '@/lib/payment-methods';
import { CajaMovimiento, CajaSesion, CashPoint } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { format, isToday, parseISO } from 'date-fns';
import { AlertTriangle, ArrowRight, Banknote, BookOpenCheck, Box, CheckCircle2, ChevronLeft, ChevronRight, Coins, CreditCard, DollarSign, FileText, Info, Minus, Plus, Printer, RefreshCw, Settings, TrendingDown, TrendingUp, Upload } from 'lucide-react';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { DataCard } from '@/components/ui/data-card';
import { Badge } from '@/components/ui/badge';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { getCurrency, normalizeCurrencyCode } from '@/constants/currencies';
import { formatMoney } from '@/lib/currency';
import { useCurrencySettings } from '@/hooks/useCurrencySettings';
import { CurrencySelect } from '@/components/ui/currency-select';

/**
 * Monedas con las que se abrió una sesión de caja.
 *
 * Se leen de la propia sesión y no de la configuración actual de la clínica:
 * una caja abierta antes de cambiar la moneda debe seguir cerrándose con las
 * monedas con las que se abrió.
 *
 * Con `movements` se añaden además las monedas de los movimientos: una caja
 * puede recibir cobros en una moneda con la que no se abrió, y esos importes
 * tienen que verse y arquearse (el cierre del backend crea su fila con
 * apertura 0).
 */
function useSessionCurrencies(session: CajaSesion | null | undefined, movements?: CajaMovimiento[]): string[] {
    const { options: clinicCurrencies, code: clinicCurrency } = useCurrencySettings();
    const amounts = (session as any)?.amounts;
    const sessionCurrency = session?.currency;
    return useMemo(() => {
        const fromAmounts = ((amounts || []) as any[])
            .map((a) => normalizeCurrencyCode(a?.currency))
            .filter(Boolean) as string[];
        const primary = normalizeCurrencyCode(sessionCurrency) ?? clinicCurrency;
        const codes = new Set<string>([primary, ...fromAmounts]);
        if (fromAmounts.length === 0) clinicCurrencies.forEach(c => codes.add(c));
        movements?.forEach(mov => {
            const code = normalizeCurrencyCode(mov.currency);
            if (code) codes.add(code);
        });
        return [...codes];
    }, [amounts, sessionCurrency, clinicCurrency, clinicCurrencies, movements]);
}

/**
 * Las denominaciones, las monedas y las imágenes de billetes salen ahora del
 * catálogo (`@/constants/currencies`), para que el arqueo funcione con
 * cualquier moneda que configure la clínica y no solo con UYU y USD.
 */

/**
 * Pasos del asistente de apertura. Los de conteo son uno por moneda y se
 * generan como `COUNT_<CÓDIGO>`, así que no se pueden enumerar aquí.
 */
type OpenSessionStep = 'CONFIG' | 'CONFIRM' | `COUNT_${string}`;

/** Id del paso de conteo de una moneda. */
const countStepId = (code: string): OpenSessionStep => `COUNT_${code}`;

interface CashPointStatus extends CashPoint {
    status: 'OPEN' | 'CLOSED';
    session?: CajaSesion & { user_name: string };
}

export default function CashierPage() {
    return (
        <React.Suspense fallback={null}>
            <CashierPageInner />
        </React.Suspense>
    );
}

function CashierPageInner() {
    const t = useTranslations('CashierPage');
    const { user, checkActiveSession } = useAuth();
    const { toast } = useToast();
    const { code: clinicCurrency, isDual } = useCurrencySettings();
    const router = useRouter();
    const searchParams = useSearchParams();
    const locale = useLocale();

    const [activeSession, setActiveSession] = React.useState<CajaSesion | null>(null);
    const [cashPoints, setCashPoints] = React.useState<CashPointStatus[]>([]);
    const [sessionMovements, setSessionMovements] = React.useState<CajaMovimiento[]>([]);
    const [closedSessionReport, setClosedSessionReport] = React.useState<any | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [serverError, setServerError] = React.useState<string | null>(null);

    const [showClosingWizard, setShowClosingWizard] = React.useState(false);
    const [closeWizardStep, setCloseWizardStep] = React.useState('REVIEW');

    const [showOpeningWizard, setShowOpeningWizard] = React.useState(false);
    const [openWizardStep, setOpenWizardStep] = React.useState<OpenSessionStep>('CONFIG');
    const [openingSessionData, setOpeningSessionData] = React.useState<Partial<CajaSesion>>({});
    /**
     * Conteo físico por moneda: `{ UYU: { '100': 3, ... }, USD: { ... } }`.
     * Antes eran dos estados separados con las monedas en el nombre, lo que
     * impedía arquear en cualquier otra moneda.
     */
    const [denominations, setDenominations] = React.useState<Record<string, Record<string, number>>>({});
    const setDenominationsFor = React.useCallback(
        (code: string, details: Record<string, number>) =>
            setDenominations(prev => ({ ...prev, [code]: details })),
        [],
    );

    // Tracks whether the user explicitly navigated to the cash points dashboard
    const viewingAllCashPointsRef = React.useRef(false);

    const fetchCashPointStatus = React.useCallback(async () => {
        setIsLoading(true);
        setServerError(null);
        try {
            const data = await api.get(API_ROUTES.CASHIER.CASH_POINTS_STATUS);
            const cashPointsData = (Array.isArray(data) ? data : (data.data || [])) as any[];

            const mappedCashPoints: CashPointStatus[] = cashPointsData.map(cp => {
                const openingDetails = cp.opening_details || {};
                const openingAmounts = cp.opening_amounts || cp.amounts || [];

                // Totales de apertura por moneda, sea cual sea: el backend
                // devuelve una fila por moneda con la que se abrió la caja.
                const openingByCurrency: Record<string, number> = {};
                openingAmounts.forEach((oa: any) => {
                    const code = normalizeCurrencyCode(oa?.currency);
                    if (code) openingByCurrency[code] = Number(oa.opening_amount) || 0;
                });
                const totalOpening = Object.values(openingByCurrency).reduce((sum, v) => sum + v, 0);

                return {
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
                        fechaApertura: openingDetails.opened_at || new Date().toISOString(),
                        montoApertura: totalOpening,
                        opening_details: {
                            ...openingDetails,
                            ...Object.fromEntries(Object.entries(openingByCurrency).map(([code, total]) => [
                                code.toLowerCase(),
                                { ...(openingDetails[code.toLowerCase()] ?? {}), total },
                            ])),
                        },
                        currency: openingDetails.currency,
                        date_rate: openingDetails.date_rate,
                        amounts: cp.opening_amounts || cp.amounts,
                    } : undefined,
                };
            });
            setCashPoints(mappedCashPoints);

        } catch (error) {
            setServerError(error instanceof Error ? error.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchSessionMovements = React.useCallback(async (sessionId: string) => {
        try {
            const data = await api.get(API_ROUTES.CASHIER.SESSIONS_MOVEMENTS, { cash_session_id: sessionId });

            let movementsData = [];
            if (Array.isArray(data)) {
                movementsData = data.filter(item => item && Object.keys(item).length > 0);
            } else if (data && data.data) {
                movementsData = data.data;
            }

            setSessionMovements(movementsData.map((mov: any): CajaMovimiento => {
                const amount = parseFloat(mov.amount);
                const tipo = amount >= 0 ? 'INGRESO' : 'EGRESO';
                return {
                    id: String(mov.movement_id),
                    cajaSesionId: sessionId,
                    tipo,
                    monto: Math.abs(amount),
                    currency: mov.currency,
                    descripcion: mov.description,
                    fecha: mov.created_at,
                    usuarioId: mov.registered_by_user,
                    metodoPago: normalizePaymentMethodCode(mov.payment_method_code),
                    metodoPagoNombre: mov.payment_method_name,
                    esEquivalenteEfectivo: isCashEquivalentMethod(mov.payment_method_code, mov.is_cash_equivalent),
                    documentNumber: mov.document_number,
                    registeredUserName: mov.client,
                };
            }));
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch session movements.' });
            setSessionMovements([]);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchCashPointStatus();
    }, [fetchCashPointStatus]);

    // Auto-navigate to the user's active session only when coming from the header widget
    React.useEffect(() => {
        if (searchParams.get('view') !== 'active') return;
        if (viewingAllCashPointsRef.current || activeSession || !user) return;
        const myPoint = cashPoints.find(cp => String(cp.session?.usuarioId) === String(user.id));
        if (myPoint?.session) {
            setActiveSession(myPoint.session);
            router.replace(`/${locale}/cashier`);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cashPoints]);

    React.useEffect(() => {
        if (activeSession) {
            fetchSessionMovements(activeSession.id);
        } else {
            setSessionMovements([]);
        }
    }, [activeSession, fetchSessionMovements]);

    if (isLoading) {
        return (
            <div className="flex-1 overflow-y-auto pr-2 pb-4 min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[200px] w-full" />)}
                </div>
            </div>
        );
    }

    if (serverError) {
        return (
            <div className="flex-1 overflow-y-auto pr-2 pb-4 min-h-0">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('toast.error')}</AlertTitle>
                    <AlertDescription>{serverError}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (activeSession) {
        if (showClosingWizard) {
            return (
                <div className="flex-1 flex flex-col min-h-0">
                    <CloseSessionWizard
                        currentStep={closeWizardStep}
                        setCurrentStep={setCloseWizardStep}
                        onExitWizard={() => {
                            viewingAllCashPointsRef.current = true;
                            setShowClosingWizard(false);
                            setCloseWizardStep('REVIEW');
                            setClosedSessionReport(null);
                            setActiveSession(null);
                            setDenominations({});
                            checkActiveSession();
                            fetchCashPointStatus();
                        }}
                        activeSession={activeSession}
                        sessionMovements={sessionMovements}
                        denominations={denominations}
                        setDenominationsFor={setDenominationsFor}
                        closedSessionReport={closedSessionReport}
                        setClosedSessionReport={setClosedSessionReport}
                        checkActiveSession={checkActiveSession}
                    />
                </div>
            );
        }
        return (
            <div className="flex-1 overflow-y-auto pr-2 pb-4 min-h-0">
                <ActiveSessionDashboard
                    session={activeSession}
                    movements={sessionMovements}
                    onCloseSession={() => setShowClosingWizard(true)}
                    onViewAllCashPoints={() => {
                        viewingAllCashPointsRef.current = true;
                        setActiveSession(null);
                        fetchCashPointStatus();
                    }}
                />
            </div>
        );
    }

    if (showOpeningWizard) {
        return (
            <div className="flex-1 flex flex-col min-h-0">
                <OpenSessionWizard
                    currentStep={openWizardStep}
                    setCurrentStep={setOpenWizardStep}
                    onExitWizard={(newSession) => {
                        setShowOpeningWizard(false);
                        setOpenWizardStep('CONFIG');
                        setDenominations({});
                        if (newSession) {
                            setActiveSession(newSession);
                            checkActiveSession();
                        }
                        fetchCashPointStatus();
                    }}
                    sessionData={openingSessionData}
                    setSessionData={setOpeningSessionData}
                    denominations={denominations}
                    setDenominationsFor={setDenominationsFor}
                    toast={toast}
                />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto pr-2 pb-4 min-h-0">
            <OpenSessionDashboard
                cashPoints={cashPoints}
                onStartOpening={(cashPoint) => {
                    // El tipo de cambio real lo carga el paso de configuración
                    // del asistente; aquí solo se siembra la moneda de la clínica.
                    setOpeningSessionData({ puntoDeCajaId: cashPoint.id, cash_point_name: cashPoint.name, currency: clinicCurrency, date_rate: isDual ? 0 : 1 });
                    setShowOpeningWizard(true);
                }}
                onViewSession={(session) => {
                    setActiveSession(session);
                }}
            />
        </div>
    );
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
                    const data = await api.get(API_ROUTES.CASHIER.SESSIONS_ACTIVE, { user_id: user.id });
                    // The endpoint now always returns 200, and the actual session status is inside
                    setUserHasActiveSession(data.code === 200);
                } catch (error) {
                    console.error("Error checking for active session:", error);
                    setUserHasActiveSession(false);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        checkSession();
    }, [user]);

    const handleSessionClick = (cp: CashPointStatus) => {
        if (cp.status === 'OPEN') {
            if (cp.session) {
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
    const { toast } = useToast();
    const { printCajaApertura } = usePrintDocument();
    const { code: clinicCurrency } = useCurrencySettings();
    const sessionCurrency = normalizeCurrencyCode(session.currency) ?? clinicCurrency;
    // Monedas con las que se abrió la caja (comparten el `date_rate` de la
    // sesión) y, aparte, todas las que tienen importes que mostrar.
    const openedCurrencies = useSessionCurrencies(session);
    const sessionCurrencies = useSessionCurrencies(session, movements);

    const [isPrinting, setIsPrinting] = React.useState(false);
    const isViewportNarrow = useViewportNarrow();

    const openingDetails = useMemo(() => {
        const amounts = (session as any).amounts || [];
        const denominations = typeof session.opening_details === 'object' && session.opening_details !== null
            ? (session.opening_details as Record<string, Record<string, number>>)
            : {};

        // Los montos de apertura llegan como una fila por moneda; se indexan
        // por código para no depender de cuáles ni cuántas sean.
        const totals: Record<string, number> = Object.fromEntries(sessionCurrencies.map(c => [c, 0]));
        amounts.forEach((a: any) => {
            const code = normalizeCurrencyCode(a?.currency);
            if (code) totals[code] = Number(a.opening_amount) || 0;
        });

        return { totals, denominations };
    }, [(session as any).amounts, session.opening_details, sessionCurrencies]);

    /**
     * Suma los movimientos que cumplen `predicate`, agrupados por moneda. Antes
     * había cuatro copias de este bucle con `{ UYU, USD }` escrito a mano.
     */
    const sumByCurrency = useCallback((
        predicate: (mov: CajaMovimiento) => boolean,
        seed: Record<string, number> = {},
        sign: (mov: CajaMovimiento) => number = () => 1,
    ) => {
        const totals: Record<string, number> = Object.fromEntries(sessionCurrencies.map(c => [c, seed[c] ?? 0]));
        movements.filter(predicate).forEach(mov => {
            const code = normalizeCurrencyCode(mov.currency);
            if (!code) return;
            totals[code] = (totals[code] ?? 0) + sign(mov) * mov.monto;
        });
        return totals;
    }, [movements, sessionCurrencies]);

    const cashOnHand = useMemo(
        () => sumByCurrency(
            mov => mov.esEquivalenteEfectivo,
            openingDetails.totals,
            mov => (mov.tipo === 'INGRESO' ? 1 : -1),
        ),
        [sumByCurrency, openingDetails.totals],
    );

    const totalIncome = useMemo(() => sumByCurrency(m => m.tipo === 'INGRESO'), [sumByCurrency]);

    const totalOutcome = useMemo(() => sumByCurrency(m => m.tipo === 'EGRESO'), [sumByCurrency]);

    const totalPos = useMemo(
        () => sumByCurrency(m => m.tipo === 'INGRESO' && ['CREDIT_CARD', 'DEBIT_CARD'].includes(m.metodoPago)),
        [sumByCurrency],
    );

    /**
     * Totales por moneda al shape `{ v, c }` que consumen las tarjetas. La
     * apertura solo lista las monedas con las que se abrió la caja.
     */
    const toCardAmounts = useCallback(
        (totals: Record<string, number>, codes: string[] = sessionCurrencies) => codes.map(c => ({ v: totals[c] ?? 0, c })),
        [sessionCurrencies],
    );

    const allMovements = React.useMemo(() => movements, [movements]);

    const handlePrintOpening = async () => {
        setIsPrinting(true);
        try {
            await printCajaApertura(session.id);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to download PDF.' });
        } finally {
            setIsPrinting(false);
        }
    };

    const tColumns = useTranslations('CashierPage.activeSession.columns');
    const tPaymentMethods = useTranslations('PaymentsPage.columns.paymentMethods');
    const movementColumns: ColumnDef<CajaMovimiento>[] = [
        { accessorKey: 'documentNumber', header: tColumns('documentNumber') },
        { accessorKey: 'descripcion', header: tColumns('description') },
        {
            accessorKey: 'monto',
            header: tColumns('amount'),
            cell: ({ row }) => {
                const isExpense = row.original.tipo === 'EGRESO';
                return (
                    <span className={cn(isExpense ? 'text-red-500' : 'text-green-500')}>
                        {isExpense ? '-' : ''}{formatMoney(row.original.monto, row.original.currency)}
                    </span>
                );
            }
        },
        {
            accessorKey: 'registeredUserName',
            header: tColumns('registeredUser'),
        },
        {
            accessorKey: 'metodoPago',
            header: tColumns('method'),
            cell: ({ row }) => getPaymentMethodLabel(row.original.metodoPago, row.original.metodoPagoNombre, tPaymentMethods)
        },
        { accessorKey: 'fecha', header: tColumns('date'), cell: ({ row }) => {
            const dateStr = row.original.fecha;
            const parsed = typeof dateStr === 'string' ? parseISO(dateStr.replace('Z', '')) : new Date(dateStr);
            return isToday(parsed)
                ? `${tColumns('today')} - ${format(parsed, 'HH:mm')}`
                : format(parsed, 'dd/MM/yyyy HH:mm');
        }},
    ];

    const renderAmount = (amount: number, currency: string, key?: string) => {
        const formattedAmount = formatMoney(amount, currency);
        // `date_rate` son unidades de la moneda principal por cada unidad de la
        // secundaria. Convertir a la moneda de la sesión es multiplicar o
        // dividir según cuál de las dos sea esa moneda.
        // Solo hay tasa para las monedas con las que se abrió la caja; una moneda
        // que entró solo por movimientos se muestra sin conversión.
        const rate = session.date_rate || 1;
        const convertedAmount =
            sessionCurrency !== currency && openedCurrencies.includes(currency)
                ? `(≈ ${formatMoney(sessionCurrency === clinicCurrency ? amount * rate : amount / rate, sessionCurrency)})`
                : null;

        return (
            <div key={key} className="text-2xl font-bold">
                <div>{formattedAmount}</div>
                {convertedAmount && (
                    <div className="text-sm font-normal text-muted-foreground">
                        {convertedAmount}
                    </div>
                )}
            </div>
        );
    };


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
                        <div className="text-sm text-muted-foreground">{Number(session.date_rate).toFixed(5)}</div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                        { title: t('openSession.openingAmount'), accentColor: '#6366f1', extra: <p className="text-[10px] text-muted-foreground mt-1">{formatDateTime(session.fechaApertura)}</p>, amounts: toCardAmounts(openingDetails.totals, openedCurrencies) },
                        { title: t('activeSession.cashOnHand'), accentColor: '#3B82F6', amounts: toCardAmounts(cashOnHand) },
                        { title: t('activeSession.totalIncome'), accentColor: '#10B981', amounts: toCardAmounts(totalIncome) },
                        { title: t('activeSession.totalOutcome'), accentColor: '#F43F5E', amounts: toCardAmounts(totalOutcome) },
                        { title: t('activeSession.totalPos'), accentColor: '#8B5CF6', amounts: toCardAmounts(totalPos) },
                    ].map(card => (
                        <div key={card.title} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                            <div className="h-[3px] w-full" style={{ background: card.accentColor }} />
                            <div className="px-3 py-2.5 flex flex-col gap-1">
                                <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium truncate">{card.title}</span>
                                {card.amounts.map(({ v, c }) => renderAmount(v, c, c))}
                                {card.extra}
                            </div>
                        </div>
                    ))}
                </div>
                <Tabs defaultValue="transactions">
                    <TabsList>
                        <TabsTrigger value="transactions">{t('activeSession.transactions')}</TabsTrigger>
                        <TabsTrigger value="opening_details">{t('activeSession.openingDetails')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="transactions">
                        <DataTable
                            columns={movementColumns}
                            data={allMovements}
                            isNarrow={isViewportNarrow}
                            renderCard={(mov: CajaMovimiento, _isSelected: boolean) => {
                                const isExpense = mov.tipo === 'EGRESO';
                                const dateStr = mov.fecha;
                                const parsed = typeof dateStr === 'string' ? parseISO(dateStr.replace('Z', '')) : new Date(dateStr);
                                const dateDisplay = isToday(parsed)
                                    ? `${tColumns('today')} - ${format(parsed, 'HH:mm')}`
                                    : format(parsed, 'dd/MM/yyyy HH:mm');
                                return (
                                    <DataCard isSelected={_isSelected}
                                        accentColor={isExpense ? '#F43F5E' : '#10B981'}
                                        fields={[
                                            { label: tColumns('documentNumber'), value: mov.documentNumber || '-' },
                                            { label: tColumns('description'), value: mov.descripcion || '-' },
                                            { label: tColumns('amount'), value: <span className={cn(isExpense ? 'text-red-500' : 'text-green-500', 'font-semibold')}>{isExpense ? '-' : '+'}{formatMoney(mov.monto, mov.currency)}</span>, primary: true },
                                            { label: tColumns('registeredUser'), value: mov.registeredUserName || '-' },
                                            { label: tColumns('method'), value: getPaymentMethodLabel(mov.metodoPago, mov.metodoPagoNombre, tPaymentMethods) },
                                            { label: tColumns('date'), value: dateDisplay },
                                        ]}
                                    />
                                );
                            }}
                        />
                    </TabsContent>
                    <TabsContent value="opening_details">
                        {openingDetails.denominations ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                {/* Una tabla por moneda de la sesión. El backend guarda las
                                    denominaciones indexadas por el código en minúsculas. */}
                                {sessionCurrencies.map(code => {
                                    const rows = openingDetails.denominations[code.toLowerCase()];
                                    if (!rows) return null;
                                    return (
                                        <Table className="w-full" key={code}>
                                            <TableHeader><TableRow><TableHead colSpan={3}>{code}</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {Object.entries(rows).map(([den, qty]) => (
                                                    den !== 'total' && <TableRow key={`${code}-${den}`}>
                                                        <TableCell>{formatMoney(Number(den), code, { decimals: 0 })}</TableCell>
                                                        <TableCell className="text-right">{Number(qty)}</TableCell>
                                                        <TableCell className="text-right">{formatMoney(Number(den) * Number(qty), code)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    );
                                })}
                            </div>
                        ) : <p className="text-muted-foreground p-4 text-center">No denomination details available for this session.</p>}
                    </TabsContent>
                </Tabs>
            </CardContent>
            <CardFooter className="flex gap-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={onViewAllCashPoints}>
                                <Box className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>{t('viewAllCashPoints')}</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={handlePrintOpening} disabled={isPrinting}>
                                {isPrinting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>{t('activeSession.printOpening')}</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="icon" onClick={onCloseSession}>
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>{isWizardOpen ? t('wizard.next') : t('wizard.startClosing')}</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
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
    denominations,
    setDenominationsFor,
    closedSessionReport,
    setClosedSessionReport,
    checkActiveSession
}: {
    currentStep: string;
    setCurrentStep: React.Dispatch<React.SetStateAction<string>>;
    onExitWizard: () => void;
    activeSession: CajaSesion;
    sessionMovements: CajaMovimiento[];
    denominations: Record<string, Record<string, number>>;
    setDenominationsFor: (code: string, details: Record<string, number>) => void;
    closedSessionReport: any | null;
    setClosedSessionReport: (report: any | null) => void;
    checkActiveSession: () => Promise<void>;
}) {
    const t = useTranslations('CashierPage');
    // Las monedas del cierre son las de la sesión que se está cerrando, no las
    // que la clínica tenga configuradas ahora, más las de sus movimientos.
    const currencies = useSessionCurrencies(activeSession, sessionMovements);
    const totalsByCurrency = useMemo(
        () => Object.fromEntries(currencies.map(code => [code, denominationTotal(denominations[code])])),
        [currencies, denominations],
    );
    const [bankDeposit, setBankDeposit] = React.useState<Record<string, Record<string, number>>>({});
    const setBankDepositFor = useCallback(
        (code: string, details: Record<string, number>) => setBankDeposit(prev => ({ ...prev, [code]: details })),
        [],
    );
    const [bankDepositFiles, setBankDepositFiles] = React.useState<File[]>([]);

    const closeSteps: Array<{ id: string; label: string; icon: React.ElementType }> = [
        { id: 'REVIEW', label: t('wizard.steps.review'), icon: BookOpenCheck },
        ...currencies.map(code => ({
            id: countStepId(code),
            label: t('wizard.steps.count', { currency: code }),
            icon: Banknote,
        })),
        { id: 'BANK_DEPOSIT', label: t('wizard.steps.bankDeposit'), icon: Upload },
        { id: 'DECLARE', label: t('wizard.steps.declare'), icon: CheckCircle2 },
        { id: 'REPORT', label: t('wizard.steps.report'), icon: FileText },
    ];
    const closeStepOrder = closeSteps.map(s => s.id);

    const handleNextStep = () => {
        const idx = closeStepOrder.indexOf(currentStep);
        // REPORT es terminal: sólo se llega tras confirmar en DECLARE.
        if (idx >= 0 && idx < closeStepOrder.length - 2) setCurrentStep(closeStepOrder[idx + 1]);
    };

    const handlePreviousStep = () => {
        const idx = closeStepOrder.indexOf(currentStep);
        if (idx > 0) setCurrentStep(closeStepOrder[idx - 1]);
    };

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Stepper header */}
            <div className="flex-none px-4 pt-4 pb-3 border-b bg-card">
                {/* Mobile: progress bar + current step label */}
                <div className="sm:hidden flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-300"
                                style={{ width: `${((closeStepOrder.indexOf(currentStep) + 1) / closeStepOrder.length) * 100}%` }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                            {closeStepOrder.indexOf(currentStep) + 1}/{closeStepOrder.length}
                        </span>
                    </div>
                    <p className="text-sm font-medium">{closeSteps.find(s => s.id === currentStep)?.label}</p>
                </div>
                {/* Desktop: step circles */}
                <div className="hidden sm:flex items-center justify-center">
                    {closeSteps.map((step, idx) => {
                        const isActive = currentStep === step.id;
                        const isPast = closeStepOrder.indexOf(currentStep) > idx;
                        const StepIcon = step.icon;
                        return (
                            <React.Fragment key={step.id}>
                                <div className="flex flex-col items-center gap-1">
                                    <div className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                                        isActive ? "border-primary bg-primary text-primary-foreground"
                                            : isPast ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-muted text-muted-foreground"
                                    )}>
                                        <StepIcon className="h-3.5 w-3.5" />
                                    </div>
                                    <span className={cn(
                                        "text-[10px] whitespace-nowrap",
                                        isActive ? "text-primary font-medium" : isPast ? "text-primary" : "text-muted-foreground"
                                    )}>{step.label}</span>
                                </div>
                                {idx < closeSteps.length - 1 && (
                                    <div className={cn("h-px w-6 mx-1 mb-5 shrink-0", isPast ? "bg-primary" : "bg-border")} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
                {currentStep === 'REVIEW' && (
                    <ActiveSessionDashboard
                        session={activeSession}
                        movements={sessionMovements}
                        onCloseSession={handleNextStep}
                        onViewAllCashPoints={onExitWizard}
                        isWizardOpen={true}
                    />
                )}
                {currencies.map(code => currentStep === countStepId(code) && (
                    <CurrencyDenominationCounter
                        key={code}
                        code={code}
                        title={t('wizard.count.title', { currency: code })}
                        quantities={denominations[code] ?? {}}
                        onQuantitiesChange={setDenominationsFor}
                    />
                ))}
                {currentStep === 'BANK_DEPOSIT' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="font-medium text-base">{t('bankDeposit.title')}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">{t('bankDeposit.description')}</p>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Sólo se puede depositar lo que se contó, de ahí
                                `availableDenominations`. */}
                            {currencies.map(code => (
                                <CurrencyDenominationCounter
                                    key={code}
                                    code={code}
                                    title={t('bankDeposit.count', { currency: code })}
                                    quantities={bankDeposit[code] ?? {}}
                                    onQuantitiesChange={setBankDepositFor}
                                    availableDenominations={denominations[code]}
                                />
                            ))}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="files">{t('bankDeposit.attachFiles')}</Label>
                            <Label htmlFor="files" className="cursor-pointer block mt-2">
                                <div className="flex items-center justify-center w-full h-24 border-2 border-dashed rounded-md bg-muted/10 hover:bg-muted/30 transition-colors">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
                                        <Upload className="h-6 w-6" />
                                        <span>{t('bankDeposit.chooseFiles')}</span>
                                    </div>
                                </div>
                                <Input id="files" type="file" multiple className="hidden" onChange={(e) => setBankDepositFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
                            </Label>
                            {bankDepositFiles.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {bankDepositFiles.map((file, index) => (
                                        <div key={index} className="relative w-16 h-16">
                                            {file.type.startsWith('image/') ? (
                                                <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover rounded" />
                                            ) : (
                                                <div className="w-full h-full bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                                                    {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                                                </div>
                                            )}
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="absolute -top-2 -right-2 w-5 h-5 rounded-full p-0"
                                                onClick={() => setBankDepositFiles(bankDepositFiles.filter((_, i) => i !== index))}
                                            >
                                                ×
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {currentStep === 'DECLARE' && (
                    <DeclareCashup
                        activeSession={activeSession}
                        currencies={currencies}
                        declaredTotals={totalsByCurrency}
                        denominations={denominations}
                        bankDeposit={bankDeposit}
                        bankDepositFiles={bankDepositFiles}
                        checkActiveSession={checkActiveSession}
                        onSessionClosed={(reportData) => {
                            setClosedSessionReport(reportData);
                            setCurrentStep('REPORT');
                        }}
                        onBack={handlePreviousStep}
                    />
                )}
                {currentStep === 'REPORT' && (
                    <SessionReport reportData={closedSessionReport} onFinish={onExitWizard} />
                )}
            </div>
            {/* Footer nav — always visible, skip REVIEW/DECLARE/REPORT (they manage their own actions) */}
            {currentStep !== 'REVIEW' && currentStep !== 'DECLARE' && currentStep !== 'REPORT' && (
                <div className="flex-none px-4 py-3 border-t bg-card">
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={handlePreviousStep} className="flex-1 sm:flex-none gap-1.5">
                            <ChevronLeft className="h-4 w-4" />
                            {t('wizard.back')}
                        </Button>
                        <Button onClick={handleNextStep} className="flex-1 sm:flex-none gap-1.5">
                            {t('wizard.next')}
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Total de un conteo físico: Σ denominación × cantidad.
 *
 * Las monedas sin denominaciones en el catálogo se cuentan con un único campo
 * de importe, que se guarda bajo la clave `total`; ahí no hay nada que sumar y
 * ese valor ES el total.
 */
function denominationTotal(quantities: Record<string, number> | undefined): number {
    if (!quantities) return 0;
    const sum = Object.entries(quantities).reduce(
        (acc, [den, qty]) => (den === 'total' ? acc : acc + (Number(den) || 0) * (Number(qty) || 0)),
        0,
    );
    return sum !== 0 ? sum : Number(quantities.total) || 0;
}

/**
 * Conteo de una moneda, resolviendo sus denominaciones desde el catálogo.
 *
 * Una moneda sin denominaciones cargadas no puede arquearse billete a billete,
 * así que cae a un único campo de monto total: es preferible a no dejar abrir
 * la caja. El importe se guarda bajo la clave `total`, que es la que el resto
 * del flujo ya lee.
 */
function CurrencyDenominationCounter({ code, quantities, onQuantitiesChange, lastClosingDetails, title, availableDenominations }: {
    code: string;
    quantities: Record<string, number>;
    onQuantitiesChange: (code: string, details: Record<string, number>) => void;
    lastClosingDetails?: Record<string, number> | null;
    title: string;
    availableDenominations?: Record<string, number>;
}) {
    const t = useTranslations('CashierPage');
    const def = getCurrency(code);
    const handleChange = useCallback(
        (details: Record<string, number>) => onQuantitiesChange(code, details),
        [code, onQuantitiesChange],
    );

    if (!def.denominations?.length) {
        return (
            <div className="space-y-2 max-w-sm">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{t('wizard.count.noDenominations', { currency: code })}</p>
                <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={quantities.total ?? ''}
                    onChange={(e) => handleChange({ total: Math.max(0, parseFloat(e.target.value) || 0) })}
                    aria-label={title}
                />
            </div>
        );
    }

    return (
        <DenominationCounter
            title={title}
            denominations={def.denominations}
            coins={def.coins ?? []}
            currency={code}
            quantities={quantities}
            onQuantitiesChange={handleChange}
            imageMap={def.imageMap ?? {}}
            lastClosingDetails={lastClosingDetails}
            availableDenominations={availableDenominations}
        />
    );
}

/**
 * Ficha de una denominación sin imagen de billete.
 *
 * Solo UYU y USD tienen SVGs en `public/billetes`; el resto de monedas se
 * cuentan con esto. No es un hueco decorativo: al contar efectivo se escanea la
 * columna de un vistazo, así que cada denominación recibe un color distinto
 * —interpolando entre los dos colores de marca— para que se distingan igual que
 * se distinguen los billetes reales. El valor va escrito dentro, que es el dato
 * que de verdad hace falta.
 */
function DenominationChip({ value, currency, index, total, shape }: {
    value: number;
    currency: string;
    /** Posición en la lista, para repartir el color. */
    index: number;
    total: number;
    shape: 'note' | 'coin';
}) {
    // Rampa entre el primario (263°) y el secundario (341°) de la marca.
    const ratio = total > 1 ? index / (total - 1) : 0;
    const hue = 263 + (341 - 263) * ratio;
    const from = `hsl(${hue} 62% 42%)`;
    const to = `hsl(${hue + 14} 72% 30%)`;

    // Trama diagonal fina: da textura de papel moneda sin competir con el número.
    const texture =
        'repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 5px)';

    const isCoin = shape === 'coin';
    const label = formatMoney(value, currency, { showSymbol: false, decimals: 0 });

    // Hay monedas con billetes de seis cifras (COP, PYG): el texto se encoge
    // para que "100.000" quepa sin recortarse ni desbordar la ficha.
    const fontSize = isCoin
        ? (label.length > 4 ? 9 : 11)
        : (label.length > 6 ? 10 : label.length > 4 ? 12 : 14);

    return (
        <div
            role="img"
            aria-label={`${value} ${currency}`}
            className={cn(
                'w-full h-full flex items-center justify-center overflow-hidden select-none px-1',
                'ring-1 ring-inset ring-white/25 shadow-sm',
                isCoin ? 'rounded-full' : 'rounded-md',
            )}
            style={{ backgroundImage: `${texture}, linear-gradient(135deg, ${from}, ${to})` }}
        >
            <span
                className="font-bold tabular-nums leading-none text-white drop-shadow-sm"
                style={{ fontSize: `${fontSize}px` }}
            >
                {label}
            </span>
        </div>
    );
}

const DenominationCounter = ({ title, denominations, coins, currency, quantities, onQuantitiesChange, lastClosingDetails, imageMap, availableDenominations }: {
    title: string,
    denominations: number[],
    coins: number[],
    currency: string,
    quantities: Record<string, number>,
    onQuantitiesChange: (details: Record<string, number>) => void,
    lastClosingDetails?: Record<string, number> | null,
    imageMap: Record<number, string>,
    availableDenominations?: Record<string, number>
}) => {
    const t = useTranslations('CashierPage');
    const total = React.useMemo(() => {
        return [...denominations, ...coins].reduce((sum, den) => sum + (Number(den) || 0) * (quantities[den] || 0), 0)
    }, [quantities, denominations, coins]);

    const handleQuantityChange = (denomination: number, quantity: string) => {
        let qty = Math.max(0, parseInt(quantity, 10) || 0);
        if (availableDenominations) {
            const maxQty = availableDenominations[denomination] || 0;
            qty = Math.min(qty, maxQty);
        }
        const newQuantities = { ...quantities, [denomination]: qty };
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
        if (lastClosingDetails) {
            onQuantitiesChange(lastClosingDetails);
        } else {
            // Handle case where no data is available
            alert('No last closing data available to prefill.');
        }
    }


    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-medium text-lg">{title}</h3>
                <div className="text-xl font-bold">{new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(total)}</div>
            </div>
            <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAllTo(0)}>{t('wizard.prefillZero')}</Button>
                <Button type="button" variant="secondary" size="sm" onClick={loadLastClosing} disabled={!lastClosingDetails}>{t('wizard.prefillLast')}</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {denominations.map((den, denIndex) => {
                    const isDisabled = availableDenominations ? (availableDenominations[den] || 0) <= 0 : false;
                    return (
                        <div key={den} className="flex items-center gap-3 w-full">
                            <div className="w-[72px] h-[40px] relative shrink-0">
                                {imageMap[den] ? (
                                    <Image src={imageMap[den]} alt={`${den} ${currency}`} layout="fill" className="rounded-md object-contain" />
                                ) : (
                                    <DenominationChip value={den} currency={currency} index={denIndex} total={denominations.length} shape="note" />
                                )}
                            </div>
                            <div className="flex items-center flex-1">
                                <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={isDisabled} onClick={() => handleQuantityChange(den, String((quantities[den] || 0) - 1))}><Minus className="h-4 w-4" /></Button>
                                <Input
                                    id={`den-${den}`}
                                    type="number"
                                    min="0"
                                    max={availableDenominations ? availableDenominations[den] || 0 : undefined}
                                    value={quantities[den] || ''}
                                    onChange={(e) => handleQuantityChange(den, e.target.value)}
                                    className="flex-1 text-center mx-1 h-8 text-base"
                                    disabled={isDisabled}
                                />
                                <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={isDisabled} onClick={() => handleQuantityChange(den, String((quantities[den] || 0) + 1))}><Plus className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {coins.length > 0 && (
                <div className="border-t pt-4">
                    <h4 className="font-medium text-md mb-3 flex items-center gap-2"><Coins /> Monedas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {coins.map((den, coinIndex) => {
                            const isDisabled = availableDenominations ? (availableDenominations[den] || 0) <= 0 : false;
                            return (
                                <div key={den} className="flex items-center gap-3 w-full">
                                    <div className="w-[40px] h-[40px] relative shrink-0">
                                        {imageMap[den] ? (
                                            <Image src={imageMap[den]} alt={`${den} ${currency}`} layout="fill" className="rounded-full object-contain" />
                                        ) : (
                                            <DenominationChip value={den} currency={currency} index={coinIndex} total={coins.length} shape="coin" />
                                        )}
                                    </div>
                                    <div className="flex items-center flex-1">
                                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={isDisabled} onClick={() => handleQuantityChange(den, String((quantities[den] || 0) - 1))}><Minus className="h-4 w-4" /></Button>
                                        <Input
                                            id={`den-${den}`}
                                            type="number"
                                            min="0"
                                            max={availableDenominations ? availableDenominations[den] || 0 : undefined}
                                            value={quantities[den] || ''}
                                            onChange={(e) => handleQuantityChange(den, e.target.value)}
                                            className="flex-1 text-center mx-1 h-8 text-base"
                                            disabled={isDisabled}
                                        />
                                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={isDisabled} onClick={() => handleQuantityChange(den, String((quantities[den] || 0) + 1))}><Plus className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};




const DeclareCashup = ({ activeSession, currencies, declaredTotals, denominations, bankDeposit, bankDepositFiles, onSessionClosed, onBack, checkActiveSession }: {
    activeSession: CajaSesion;
    currencies: string[];
    declaredTotals: Record<string, number>;
    denominations: Record<string, Record<string, number>>;
    bankDeposit: Record<string, Record<string, number>>;
    bankDepositFiles: File[];
    onSessionClosed: (reportData: any) => void;
    onBack: () => void;
    checkActiveSession: () => Promise<void>;
}) => {
    const t = useTranslations('CashierPage.declareCashup');
    const { toast } = useToast();
    const [notes, setNotes] = React.useState('');
    const [systemTotals, setSystemTotals] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchDeclareData = async () => {
            if (!activeSession.id) return;
            setIsLoading(true);
            try {
                const data = await api.get(API_ROUTES.CASHIER.SESSIONS_DECLARE, { cash_session_id: activeSession.id });
                setSystemTotals(Array.isArray(data) ? data : []);
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
    }, [activeSession.id, toast]);

    const handleCloseSession = async () => {
        const formData = new FormData();
        formData.append('cash_session_id', activeSession.id);
        // Un campo por moneda, `declared_cash_<código en minúsculas>`. Para
        // UYU y USD son exactamente los mismos nombres que antes, así que el
        // backend actual sigue funcionando sin cambios.
        currencies.forEach(code => {
            formData.append(`declared_cash_${code.toLowerCase()}`, String(declaredTotals[code] ?? 0));
        });
        // Mapa completo por moneda, para que el backend pueda dejar de depender
        // de los campos por moneda de arriba.
        formData.append('declared_cash', JSON.stringify(declaredTotals));
        formData.append('notes', notes);
        formData.append('closing_denominations', JSON.stringify(
            Object.fromEntries(currencies.map(code => [
                code.toLowerCase(),
                { ...(denominations[code] ?? {}), total: declaredTotals[code] ?? 0 },
            ])),
        ));
        formData.append('bank_deposit_denominations', JSON.stringify(
            Object.fromEntries(currencies.map(code => [code.toLowerCase(), bankDeposit[code] ?? {}])),
        ));
        bankDepositFiles.forEach((file, index) => {
            formData.append('files', file);
        });

        try {
            const responseData = await api.post(API_ROUTES.CASHIER.SESSIONS_CLOSE, formData);

            if ((Array.isArray(responseData) && responseData[0]?.error) || responseData.error) {
                const errorInfo = Array.isArray(responseData) ? responseData[0] : responseData;
                throw new Error(errorInfo.message || t('toast.closeErrorDescription'));
            }

            toast({
                title: t('toast.closeSuccessTitle'),
                description: t('toast.closeSuccessDescription'),
            });
            await checkActiveSession();
            onSessionClosed(responseData);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.closeErrorTitle'),
                description: error instanceof Error ? error.message : t('toast.unexpectedError'),
            });
        }
    };

    const renderTotalsByCurrency = (currency: string) => {
        const currencyData = systemTotals.find(d => d.moneda === currency);
        const declaredCash = declaredTotals[currency] ?? 0;

        const systemCash = parseFloat(currencyData?.total_efectivo) || 0;
        const cashDifference = declaredCash - systemCash;

        return (
            <div key={currency} className="space-y-4">
                <h3 className="font-semibold text-lg">{currency}</h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <Label className="flex items-center gap-2 font-semibold"><Banknote className="h-5 w-5 text-muted-foreground" />{t('methods.cash')}</Label>
                    <div className="text-center"><div className="text-muted-foreground">{t('systemTotal')}</div><div className="font-semibold">{formatMoney(systemCash, currency)}</div></div>
                    <div className="text-center"><div className="text-muted-foreground">{t('declared')}</div><div className="font-semibold">{formatMoney(declaredCash, currency)}</div></div>
                    <div className="text-center"><div className="text-muted-foreground">{t('difference')}</div><div className={cn("font-semibold", cashDifference < 0 ? "text-red-500" : "text-green-500")}>{formatMoney(cashDifference, currency)}</div></div>
                </div>

                {currencyData?.desglose_detallado?.map((detail: any) => {
                    const methodCode = normalizePaymentMethodCode(detail.codigo);
                    // Cash-equivalent methods (and the opening float) are already summed into
                    // the cash row above; only the other methods get their own line.
                    if (methodCode === 'OPEN' || isCashEquivalentMethod(methodCode, detail.es_efectivo)) return null;

                    return (
                        <div key={detail.codigo} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                            <Label className="flex items-center gap-2 font-semibold">
                                <CreditCard className="h-5 w-5 text-muted-foreground" />
                                {isKnownPaymentMethodCode(methodCode) ? t(`methods.${methodCode.toLowerCase()}`) : (detail.metodo || detail.codigo)}
                            </Label>
                            <div className="text-center"><div className="text-muted-foreground">{t('systemTotal')}</div><div className="font-semibold">{formatMoney(detail.monto, currency)}</div></div>
                        </div>
                    );
                })}
            </div>
        );
    };
    if (isLoading) {
        return <div className="p-6 text-center">Loading system totals...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="font-semibold text-base">{t('title')}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
            </div>
            {currencies.map((code, idx) => (
                <React.Fragment key={code}>
                    {idx > 0 && <hr />}
                    {renderTotalsByCurrency(code)}
                </React.Fragment>
            ))}
            <div className="space-y-2">
                <Label htmlFor="notes">{t('notes')}</Label>
                <Textarea id="notes" placeholder={t('notesPlaceholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t">
                <Button variant="outline" onClick={onBack} className="flex-1 sm:flex-none gap-1.5">
                    <ChevronLeft className="h-4 w-4" />
                    {t('wizard.back')}
                </Button>
                <Button onClick={handleCloseSession} className="flex-1 sm:flex-none gap-1.5">
                    {t('closeSessionButton')}
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};


const SessionReport = ({ reportData, onFinish }: { reportData: any, onFinish: () => void }) => {
    const t = useTranslations('CashierPage.report');
    const { toast } = useToast();
    const { printCajaCierre } = usePrintDocument();
    const [isPrinting, setIsPrinting] = React.useState(false);
    const reportDetails = Array.isArray(reportData) && reportData.length > 0 ? reportData[0] : reportData;
    const { session, movements } = reportDetails?.details || { session: {}, movements: [] };
    /** Monedas presentes en el cierre, en el orden en que llegan. */
    const reportCurrencies = React.useMemo(() => {
        const codes = (movements || [])
            .map((m: any) => normalizeCurrencyCode(m?.currency))
            .filter(Boolean) as string[];
        return [...new Set(codes)];
    }, [movements]);

    const handlePrintClose = async () => {
        setIsPrinting(true);
        try {
            await printCajaCierre(session.id);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo imprimir el cierre.' });
        } finally {
            setIsPrinting(false);
        }
    };

    if (!reportDetails || !session || !movements) {
        return (
            <div className="space-y-4">
                <h3 className="font-semibold">Session Report</h3>
                <p>No report data available.</p>
                <Button onClick={onFinish} className="mt-4">Return to Cashier</Button>
            </div>
        );
    }

    const formatCurrency = (value: number | string | null | undefined, currency: string) =>
        formatMoney(value, currency);

    const renderReportSection = (currency: string) => {
        const currencyMovement = movements.find((m: any) => m.currency === currency);
        if (!currencyMovement) return null;

        // Las monedas que entraron solo por movimientos no tienen conteo de apertura;
        // el cierre devuelve su `opening_amount` (0).
        const openingAmount = session.opening_details?.[currency.toLowerCase()]?.total ?? currencyMovement.opening_amount ?? 0;
        const declaredCash = currencyMovement.declared_cash || 0;
        const systemCash = currencyMovement.calculated_cash || 0;
        const systemCard = currencyMovement.calculated_card || 0;
        const systemTransfer = currencyMovement.calculated_transfer || 0;
        const systemOther = currencyMovement.calculated_other || 0;

        // Ensure these are treated as numbers
        const declaredCashNum = parseFloat(declaredCash);
        const systemCashNum = parseFloat(systemCash);
        const cashVariance = declaredCashNum - systemCashNum;

        return (
            <div className="space-y-4">
                <h3 className="font-bold text-lg">{t('title', { currency })}</h3>
                <p><strong>{t('openingAmount')}</strong> {formatCurrency(openingAmount, currency)}</p>
                <p><strong>{t('declaredCash')}</strong> {formatCurrency(declaredCash, currency)}</p>
                <p><strong>{t('systemCashTotal')}</strong> {formatCurrency(systemCash, currency)}</p>
                <p><strong>{t('cashDiscrepancy')}</strong> <span className={cn(cashVariance < 0 ? "text-red-500" : "text-green-500")}>{formatCurrency(cashVariance, currency)}</span></p>
                <p><strong>{t('systemCardTotal')}</strong> {formatCurrency(systemCard, currency)}</p>
                <p><strong>{t('systemTransferTotal')}</strong> {formatCurrency(systemTransfer, currency)}</p>
                <p><strong>{t('systemOtherTotal')}</strong> {formatCurrency(systemOther, currency)}</p>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="font-semibold text-base">{t('sessionClosedTitle', { id: session.id })}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {t('sessionClosedDescription', { user: session.user_name || 'N/A', location: session.cash_point_name || 'N/A' })}
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Una sección por moneda con movimientos en el cierre. */}
                {reportCurrencies.map(code => (
                    <React.Fragment key={code}>{renderReportSection(code)}</React.Fragment>
                ))}
            </div>
            <div>
                <p><strong>{t('closingTime')}</strong> {formatDateTime(session.closed_at)}</p>
                {session.closing_notes && <p><strong>{t('notes')}</strong> {session.closing_notes}</p>}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t">
                <Button variant="outline" onClick={handlePrintClose} disabled={isPrinting} className="flex-1 sm:flex-none gap-1.5">
                    {isPrinting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    {t('printClosing')}
                </Button>
                <Button onClick={onFinish} className="flex-1 sm:flex-none">{t('finishReturn')}</Button>
            </div>
        </div>
    );
};




function OpenSessionWizard({ currentStep, setCurrentStep, onExitWizard, sessionData, setSessionData, denominations, setDenominationsFor, toast }: {
    currentStep: OpenSessionStep;
    setCurrentStep: React.Dispatch<React.SetStateAction<OpenSessionStep>>;
    onExitWizard: (session?: CajaSesion) => void;
    sessionData: Partial<CajaSesion>;
    setSessionData: React.Dispatch<React.SetStateAction<Partial<CajaSesion>>>;
    denominations: Record<string, Record<string, number>>;
    setDenominationsFor: (code: string, details: Record<string, number>) => void;
    toast: any;
}) {
    const t = useTranslations('CashierPage');
    const { options: currencies, hasAutoRate, isDual } = useCurrencySettings();
    const { user, checkActiveSession } = useAuth();
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const [buyRate, setBuyRate] = React.useState(0);
    const [sellRate, setSellRate] = React.useState(0);
    const [avgRate, setAvgRate] = React.useState(0);
    const [exchangeRatesHtml, setExchangeRatesHtml] = React.useState('');
    // Arranca en 'loaded' cuando no hay cotización automática que pedir: si no,
    // el paso se quedaría girando para siempre esperando una petición que nunca
    // se lanza.
    const [exchangeRateStatus, setExchangeRateStatus] = React.useState<'loading' | 'loaded' | 'error'>(
        hasAutoRate ? 'loading' : 'loaded',
    );
    // Indexado por el código de moneda en minúsculas, como lo guarda el backend.
    const [lastClosingDetails, setLastClosingDetails] = React.useState<Record<string, Record<string, number>> | null>(null);

    const fetchRates = React.useCallback(async () => {
        setExchangeRateStatus('loading');
        try {
            const data = await api.get(API_ROUTES.CASHIER.COTIZACIONES);

            const compra = parseFloat(data.compra);
            const venta = parseFloat(data.venta);

            setBuyRate(compra);
            setSellRate(venta);

            const avg = (compra + venta) / 2;
            setAvgRate(avg);
            setSessionData(prev => ({ ...prev, date_rate: Math.round(avg * 100) / 100 }));
            setExchangeRatesHtml(data.html);
            setExchangeRateStatus('loaded');

        } catch (error) {
            console.error("Error fetching rates", error);
            setExchangeRateStatus('error');
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch exchange rates.' });
        }
    }, [setSessionData, toast]);

    const fetchLastClosing = async () => {
        try {
            const data = await api.get(API_ROUTES.CASHIER.SESSIONS_PREFILL, { cash_point_id: sessionData.puntoDeCajaId ?? '' });
            const closingData = Array.isArray(data) ? data[0] : data;
            if (closingData && closingData.difference_details) {
                setLastClosingDetails(closingData.difference_details);
            }
        } catch (error) {
            console.error("Failed to fetch last closing details:", error);
        }
    };

    const openSteps = useMemo<Array<{ id: OpenSessionStep; label: string; icon: React.ElementType }>>(() => [
        // Configuración = moneda + tipo de cambio. Solo aplica con dos monedas.
        ...(isDual ? [{ id: 'CONFIG' as OpenSessionStep, label: t('wizard.steps.config'), icon: Settings }] : []),
        ...currencies.map(code => ({
            id: countStepId(code),
            label: t('wizard.steps.count', { currency: code }),
            icon: Banknote,
        })),
        { id: 'CONFIRM' as OpenSessionStep, label: t('wizard.steps.confirm'), icon: CheckCircle2 },
    ], [isDual, currencies, t]);
    const openStepOrder = useMemo<OpenSessionStep[]>(() => openSteps.map(step => step.id), [openSteps]);

    React.useEffect(() => {
        if (currentStep === 'CONFIG') {
            if (hasAutoRate) fetchRates();
            // Sin feed de cotización no hay nada que esperar: el tipo de cambio
            // se carga a mano en este mismo paso.
            else setExchangeRateStatus('loaded');
        }
        if (currentStep.startsWith('COUNT_')) {
            fetchLastClosing();
        }
    }, [currentStep, fetchRates, hasAutoRate]);

    /**
     * El paso de configuración solo existe para elegir moneda y tipo de cambio.
     * Con una sola moneda no hay nada que configurar, así que se salta y el
     * asistente empieza directamente por el conteo.
     */
    React.useEffect(() => {
        if (!openStepOrder.includes(currentStep)) setCurrentStep(openStepOrder[0]);
    }, [currentStep, openStepOrder, setCurrentStep]);

    /** Total contado en cada moneda del arqueo. */
    const totalsByCurrency = useMemo(
        () => Object.fromEntries(currencies.map(code => [code, denominationTotal(denominations[code])])),
        [currencies, denominations],
    );

    const handleNextStep = async () => {
        if (currentStep === 'CONFIG') {
            if (!sessionData.puntoDeCajaId || !sessionData.currency || !sessionData.date_rate) {
                toast({ variant: 'destructive', title: t('toast.error'), description: 'Please fill all fields.' });
                return;
            }
            setCurrentStep(openStepOrder[1]);
            return;
        }
        const idx = openStepOrder.indexOf(currentStep);
        if (idx >= 0 && idx < openStepOrder.length - 1) setCurrentStep(openStepOrder[idx + 1]);
    };

    const handleConfirmAndOpen = async () => {
        setIsSubmitting(true);
        setSubmissionError(null);

        // Las denominaciones van indexadas por el código en minúsculas —el
        // mismo formato que ya guardaba el backend para `uyu`/`usd`—, así que
        // cualquier moneda encaja sin cambiar el contrato.
        const openingDetails = {
            currency: sessionData.currency,
            date_rate: sessionData.date_rate,
            ...Object.fromEntries(currencies.map(code => [
                code.toLowerCase(),
                { ...(denominations[code] ?? {}), total: totalsByCurrency[code] ?? 0 },
            ])),
            opened_by: user?.name,
            opened_at: new Date().toISOString()
        };

        const totalOpeningAmount: Record<string, number> = Object.fromEntries(
            currencies.map(code => [code, totalsByCurrency[code] ?? 0]),
        );

        try {
            const responseData = await api.post(API_ROUTES.CASHIER.SESSIONS_OPEN, {
                cash_point_id: sessionData.puntoDeCajaId,
                currency: sessionData.currency,
                date_rate: sessionData.date_rate,
                user_id: user?.id,
                status: 'OPEN',
                opening_amount: totalOpeningAmount,
                opening_details: JSON.stringify(openingDetails),
            });
            const responsePayload = Array.isArray(responseData) ? responseData[0] : responseData;

            if (responsePayload.code >= 400 || !responsePayload.session) {
                throw new Error(responsePayload.message || 'Failed to finalize session opening.');
            }

            const sessionInfo = responsePayload.session;

            const fullSessionData: CajaSesion = {
                id: String(sessionInfo.id),
                estado: 'ABIERTA',
                fechaApertura: sessionInfo.opened_at,
                montoApertura: Object.values(totalOpeningAmount).reduce((sum, val) => sum + (val as number), 0),
                opening_details: sessionInfo.opening_details,
                cash_point_name: sessionData.cash_point_name,
                user_name: user?.name,
                currency: sessionInfo.opening_details.currency,
                date_rate: sessionInfo.opening_details.date_rate,
                usuarioId: user?.id,
                amounts: Object.entries(totalOpeningAmount).map(([currency, opening_amount]) => ({
                    currency,
                    opening_amount: opening_amount as number,
                    cash_on_hand: opening_amount as number,
                })),
            };

            toast({ title: t('toast.openSuccessTitle'), description: t('toast.openSuccessDescription') });
            await checkActiveSession();
            onExitWizard(fullSessionData);

        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : 'Could not finalize session opening.');
            toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Could not finalize session opening.' });
        } finally {
            setIsSubmitting(false);
        }
    };



    const handlePreviousStep = async () => {
        const idx = openStepOrder.indexOf(currentStep);
        if (idx > 0) setCurrentStep(openStepOrder[idx - 1]);
        else onExitWizard();
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
                        <div><strong>{t('openSession.openingDate')}:</strong> {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                    </div>
                    {/* Sin segunda moneda no hay nada que convertir: ni
                        cotización del día ni tipo de cambio de la sesión. */}
                    {isDual && (
                        <>
                            <Alert variant="info" className="bg-orange-100 border-orange-200 text-orange-800">
                                <Info className="h-4 w-4" />
                                <AlertDescription>{t('openSession.exchangeRateTooltip')}</AlertDescription>
                            </Alert>
                            {hasAutoRate && (
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
                            )}
                            <div className="space-y-1">
                                <Label htmlFor="date_rate">{t('openSession.exchangeRate')}</Label>
                                <Input id="date_rate" type="number" step="0.01" value={sessionData.date_rate || ''} onChange={(e) => setSessionData(prev => ({ ...prev, date_rate: Math.round((parseFloat(e.target.value) || 0) * 100) / 100 }))} disabled={disabled} />
                            </div>
                        </>
                    )}
                    <div className="space-y-1">
                        <Label>{t('openSession.currency')}</Label>
                        <CurrencySelect
                            value={sessionData.currency}
                            onChange={(value) => setSessionData(prev => ({ ...prev, currency: value }))}
                            disabled={disabled}
                        />
                    </div>
                </div>
                {hasAutoRate && (
                    <div
                        className="h-[400px] w-full overflow-y-auto rounded-lg"
                        dangerouslySetInnerHTML={{ __html: exchangeRatesHtml }}
                    />
                )}
            </div>
        );
    }

    const stepTitles: Record<string, string> = {
        CONFIG: t('wizard.steps.config'),
        CONFIRM: t('wizard.steps.confirm'),
        ...Object.fromEntries(currencies.map(code => [countStepId(code), t('wizard.steps.count', { currency: code })])),
    };

    const stepComponents: Record<string, React.ReactNode> = {
        'CONFIG': renderConfigContent(),
        // Un paso de conteo por moneda configurada.
        ...Object.fromEntries(currencies.map(code => [
            countStepId(code),
            <CurrencyDenominationCounter
                key={code}
                code={code}
                quantities={denominations[code] ?? {}}
                onQuantitiesChange={setDenominationsFor}
                lastClosingDetails={lastClosingDetails?.[code.toLowerCase()]}
                title={t('wizard.count.title', { currency: code })}
            />,
        ])),
        'CONFIRM': (
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>{t('confirmation.sessionInfo')}</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-sm">
                        <p><strong>{t('openSession.terminal')}:</strong> {sessionData.cash_point_name}</p>
                        <p><strong>{t('openSession.user')}:</strong> {user?.name}</p>
                        <p><strong>{t('openSession.openingDate')}:</strong> {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                        <p><strong>{t('openSession.currency')}:</strong> {sessionData.currency}</p>
                        <p><strong>{t('openSession.exchangeRate')}:</strong> {sessionData.date_rate?.toFixed(2)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>{t('confirmation.cashSummary')}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {currencies.map(code => (
                            <div className="text-lg" key={code}>
                                <strong>{t('confirmation.total', { currency: code })}:</strong>{' '}
                                {formatMoney(totalsByCurrency[code] ?? 0, code)}
                            </div>
                        ))}

                        <Collapsible>
                            <CollapsibleTrigger asChild>
                                <Button variant="link" className="p-0 h-auto text-xs">Ver desglose</Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-4 mt-2">
                                {currencies.map(code => (
                                    <Table key={code}>
                                        <TableHeader><TableRow><TableHead>{t('confirmation.denomination', { currency: code })}</TableHead><TableHead>{t('confirmation.quantity')}</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {Object.entries(denominations[code] ?? {}).map(([den, qty]) => qty > 0 && <TableRow key={den}><TableCell>{den}</TableCell><TableCell>{qty}</TableCell></TableRow>)}
                                        </TableBody>
                                    </Table>
                                ))}
                            </CollapsibleContent>
                        </Collapsible>
                    </CardContent>
                </Card>
            </div>
        )
    };


    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Stepper header */}
            <div className="flex-none px-4 pt-4 pb-3 border-b bg-card">
                {/* Mobile: progress bar + current step label */}
                <div className="sm:hidden flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-300"
                                style={{ width: `${((openStepOrder.indexOf(currentStep) + 1) / openStepOrder.length) * 100}%` }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                            {openStepOrder.indexOf(currentStep) + 1}/{openStepOrder.length}
                        </span>
                    </div>
                    <p className="text-sm font-medium">{openSteps.find(s => s.id === currentStep)?.label}</p>
                </div>
                {/* Desktop: step circles */}
                <div className="hidden sm:flex items-center justify-center">
                    {openSteps.map((step, idx) => {
                        const isActive = currentStep === step.id;
                        const isPast = openStepOrder.indexOf(currentStep) > idx;
                        const StepIcon = step.icon;
                        return (
                            <React.Fragment key={step.id}>
                                <div className="flex flex-col items-center gap-1">
                                    <div className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                                        isActive ? "border-primary bg-primary text-primary-foreground"
                                            : isPast ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-muted text-muted-foreground"
                                    )}>
                                        <StepIcon className="h-3.5 w-3.5" />
                                    </div>
                                    <span className={cn(
                                        "text-[10px] whitespace-nowrap",
                                        isActive ? "text-primary font-medium" : isPast ? "text-primary" : "text-muted-foreground"
                                    )}>{step.label}</span>
                                </div>
                                {idx < openSteps.length - 1 && (
                                    <div className={cn("h-px w-6 mx-1 mb-5 shrink-0", isPast ? "bg-primary" : "bg-border")} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
                {submissionError && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{submissionError}</AlertDescription>
                    </Alert>
                )}
                {stepComponents[currentStep]}
            </div>
            {/* Footer nav — always visible */}
            <div className="flex-none px-4 py-3 border-t bg-card">
                <div className="flex gap-3">
                    <Button variant="outline" onClick={handlePreviousStep} disabled={isSubmitting} className="flex-1 sm:flex-none gap-1.5">
                        <ChevronLeft className="h-4 w-4" />
                        {t('wizard.back')}
                    </Button>
                    <Button
                        onClick={currentStep === 'CONFIRM' ? handleConfirmAndOpen : handleNextStep}
                        disabled={isSubmitting || exchangeRateStatus === 'loading'}
                        className="flex-1 sm:flex-none gap-1.5"
                    >
                        {isSubmitting ? 'Abriendo...' : (currentStep === 'CONFIRM' ? t('confirmation.confirmButton') : t('wizard.next'))}
                        {currentStep === 'CONFIRM' ? <CheckCircle2 className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
