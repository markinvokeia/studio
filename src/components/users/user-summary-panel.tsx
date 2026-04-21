'use client';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { UserFinancial } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getTreatmentSequences } from '@/services/treatment-plans';
import {
    CheckCircle2,
    ChevronRight,
    Circle,
    ClipboardList,
    Eye,
    EyeOff,
    Loader2,
    Printer,
    XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { TreatmentSequence } from '@/lib/types';

type SummaryTab = 'financial' | 'treatment';

interface UserSummaryPanelProps {
    financialData?: UserFinancial | null;
    userId: string;
    isOpen: boolean;
    onToggle: () => void;
    onPrint: () => void;
    onCreateAppointment?: () => void;
    onViewAllTreatments?: () => void;
}

function formatShortDate(dateStr?: string | null): string {
    if (!dateStr) return '—';
    try { return format(parseISO(dateStr), 'd LLL yyyy', { locale: es }); } catch { return dateStr; }
}

// ─── Financial content ────────────────────────────────────────────────────────

function FinancialContent({ financialData }: { financialData?: UserFinancial | null }) {
    const tPatient = useTranslations('UsersPage');

    const formatCurrency = (value: unknown, currency: 'USD' | 'UYU') => {
        const symbol = currency === 'USD' ? 'U$S' : '$U';
        const num = Number(value) || 0;
        return `${symbol} ${new Intl.NumberFormat('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)}`;
    };

    const stats = [
        { title: tPatient('stats.totalInvoiced'), uyu: financialData?.financial_data?.UYU?.total_invoiced ?? 0, usd: financialData?.financial_data?.USD?.total_invoiced ?? 0, accent: '#3B82F6' },
        { title: tPatient('stats.totalPaid'), uyu: financialData?.financial_data?.UYU?.total_paid ?? 0, usd: financialData?.financial_data?.USD?.total_paid ?? 0, accent: '#10B981' },
        { title: tPatient('stats.currentDebt'), uyu: financialData?.financial_data?.UYU?.current_debt ?? 0, usd: financialData?.financial_data?.USD?.current_debt ?? 0, accent: '#F43F5E' },
        { title: tPatient('stats.availableBalance'), uyu: financialData?.financial_data?.UYU?.available_balance ?? 0, usd: financialData?.financial_data?.USD?.available_balance ?? 0, accent: '#8B5CF6' },
    ];

    return (
        <div className="grid grid-cols-2 gap-2 pb-2 md:grid-cols-4">
            {stats.map((stat) => {
                const isBalance = stat.title === tPatient('stats.availableBalance');
                const valueColor = isBalance
                    ? stat.uyu >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                    : undefined;
                return (
                    <div key={stat.title} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                        <div className="h-[3px] w-full" style={{ background: stat.accent }} />
                        <div className="px-3 py-2.5 flex flex-col gap-1">
                            <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium truncate">{stat.title}</span>
                            <div className="flex flex-col leading-tight mt-0.5">
                                <span className={cn('text-2xl font-bold tracking-tight', valueColor ?? 'text-foreground')}>
                                    {formatCurrency(stat.uyu, 'UYU')}
                                </span>
                                <span className="text-xs text-muted-foreground">{formatCurrency(stat.usd, 'USD')}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Treatment content ────────────────────────────────────────────────────────

type StepStatus = TreatmentSequence['steps'][number]['status'];

const STATUS_PILL: Record<StepStatus, { bg: string; text: string; icon: React.ReactNode }> = {
    completed: {
        bg: 'bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800',
        text: 'text-emerald-700 dark:text-emerald-300',
        icon: <CheckCircle2 className="h-2.5 w-2.5" />,
    },
    scheduled: {
        bg: 'bg-blue-100 dark:bg-blue-950 border border-blue-200 dark:border-blue-800',
        text: 'text-blue-700 dark:text-blue-300',
        icon: <ChevronRight className="h-2.5 w-2.5" />,
    },
    missed: {
        bg: 'bg-red-100 dark:bg-red-950 border border-red-200 dark:border-red-800',
        text: 'text-red-700 dark:text-red-300',
        icon: <XCircle className="h-2.5 w-2.5" />,
    },
    cancelled: {
        bg: 'bg-muted border border-border',
        text: 'text-muted-foreground',
        icon: <XCircle className="h-2.5 w-2.5" />,
    },
    pending: {
        bg: 'bg-muted border border-border',
        text: 'text-muted-foreground',
        icon: <Circle className="h-2.5 w-2.5" />,
    },
};

function TreatmentMilestoneCard({
    step,
    isCurrent,
}: {
    step: TreatmentSequence['steps'][number];
    isCurrent: boolean;
}) {
    const t = useTranslations('TreatmentPlans');
    const isCompleted = step.status === 'completed';
    const isMissed = step.status === 'missed';
    const isCancelled = step.status === 'cancelled';
    const pill = STATUS_PILL[step.status];

    return (
        <div className={cn(
            'flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border min-w-[100px] max-w-[120px] shrink-0 select-none',
            isCompleted && 'bg-emerald-950/60 border-emerald-700/60',
            isCurrent && !isCompleted && 'bg-primary/10 border-primary',
            isMissed && 'bg-destructive/10 border-destructive/50',
            isCancelled && 'opacity-50',
            !isCompleted && !isCurrent && !isMissed && !isCancelled && 'bg-muted/40 border-border',
        )}>
            {/* Number bubble + status icon */}
            <div className="flex items-center gap-1.5">
                <span className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 border',
                    isCompleted && 'bg-emerald-700/40 border-emerald-500/40 text-emerald-300',
                    isCurrent && !isCompleted && 'bg-primary/20 border-primary/50 text-primary',
                    isMissed && 'bg-destructive/20 border-destructive/50 text-destructive',
                    !isCompleted && !isCurrent && !isMissed && 'bg-muted/60 border-border text-muted-foreground',
                )}>
                    {step.step_number}
                </span>
                {isCompleted && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
                {isCurrent && !isCompleted && <ChevronRight className="h-3 w-3 text-primary shrink-0" />}
                {isMissed && <XCircle className="h-3 w-3 text-destructive shrink-0" />}
            </div>
            {/* Name */}
            <p className={cn(
                'text-xs font-semibold leading-tight line-clamp-2',
                isCompleted ? 'text-emerald-100' : isCurrent ? 'text-foreground' : isMissed ? 'text-destructive' : 'text-muted-foreground',
            )}>
                {step.step_name}
            </p>
            {/* Date */}
            {step.scheduled_date && (
                <p className={cn(
                    'text-[10px]',
                    isCompleted ? 'text-emerald-400/80' : isCurrent ? 'text-primary/80' : 'text-muted-foreground/70',
                )}>
                    {format(parseISO(step.scheduled_date), 'd MMM', { locale: es })}
                </p>
            )}
            {/* Status pill */}
            <span className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold self-start',
                pill.bg, pill.text,
            )}>
                {pill.icon}
                {t(`stepStatus.${step.status}`)}
            </span>
        </div>
    );
}

function TreatmentContent({
    userId,
    onCreateAppointment,
    onViewAll,
}: {
    userId: string;
    onCreateAppointment?: () => void;
    onViewAll?: () => void;
}) {
    const t = useTranslations('TreatmentPlans');
    const [sequences, setSequences] = React.useState<TreatmentSequence[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        getTreatmentSequences(userId).then(data => {
            if (!cancelled) { setSequences(data); setIsLoading(false); }
        });
        return () => { cancelled = true; };
    }, [userId]);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground justify-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('loading')}
            </div>
        );
    }

    const active = sequences.filter(s => s.status === 'active' || s.status === 'paused');

    if (active.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
                <ClipboardList className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">{t('emptyState')}</p>
                {onCreateAppointment && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={onCreateAppointment}>
                        <ClipboardList className="h-3.5 w-3.5" />
                        {t('createAppointment')}
                    </Button>
                )}
            </div>
        );
    }

    const seq = active[0];
    const completedCount = seq.steps.filter(s => s.status === 'completed').length;
    const totalCount = seq.steps.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    const hasMissed = seq.steps.some(s => s.status === 'missed');

    const currentIdx = seq.steps.findIndex(s => s.status !== 'completed' && s.status !== 'cancelled');
    const currentStep = currentIdx >= 0 ? seq.steps[currentIdx] : null;
    const nextStep = seq.steps[currentIdx + 1] ?? null;

    return (
        <div className="rounded-xl bg-card border border-border p-3 mb-2">
            {/* Header: service name + badge + more link */}
            <div className="flex items-center gap-2 mb-2">
                {seq.service_color && (
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seq.service_color }} />
                )}
                <span className="text-sm font-bold flex-1 min-w-0 truncate">{seq.service_name}</span>
                {active.length > 1 && onViewAll && (
                    <button type="button" onClick={onViewAll} className="text-[10px] text-primary hover:underline shrink-0">
                        +{active.length - 1} {t('more')}
                    </button>
                )}
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                        className={cn('h-full rounded-full transition-all', hasMissed ? 'bg-destructive/70' : 'bg-primary')}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                    {completedCount}/{totalCount}
                </span>
            </div>

            {/* Horizontal milestone scroll */}
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mb-3">
                <div className="flex gap-2">
                    {seq.steps.map((step, idx) => (
                        <TreatmentMilestoneCard key={step.id} step={step} isCurrent={idx === currentIdx} />
                    ))}
                </div>
            </div>

            {/* Missed alert */}
            {hasMissed && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 mb-2">
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <p className="text-xs text-destructive flex-1">{t('interruptedAlert')}</p>
                </div>
            )}

            {/* Current step block */}
            {currentStep && (
                <div className={cn(
                    'rounded-md border px-2.5 py-2 text-xs mb-1.5',
                    hasMissed ? 'border-destructive/30 bg-destructive/5' : 'border-primary/20 bg-primary/5',
                )}>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">
                        {hasMissed ? t('missedStep') : t('currentStep')}
                    </p>
                    <p className={cn('font-semibold', hasMissed ? 'text-destructive' : 'text-foreground')}>
                        {currentStep.step_name}
                    </p>
                    {currentStep.scheduled_date && (
                        <p className="text-muted-foreground mt-0.5">{formatShortDate(currentStep.scheduled_date)}</p>
                    )}
                </div>
            )}

            {/* Next step */}
            {nextStep && !hasMissed && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Circle className="h-2.5 w-2.5 shrink-0" />
                    <span>{t('nextStep')}: <span className="font-medium text-foreground">{nextStep.step_name}</span>
                        {nextStep.scheduled_date && <> · {formatShortDate(nextStep.scheduled_date)}</>}
                    </span>
                </p>
            )}

            {/* Ver todos link */}
            {onViewAll && (
                <button
                    type="button"
                    onClick={onViewAll}
                    className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                >
                    {t('viewAll')} <ChevronRight className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function UserSummaryPanel({
    financialData,
    userId,
    isOpen,
    onToggle,
    onPrint,
    onCreateAppointment,
    onViewAllTreatments,
}: UserSummaryPanelProps) {
    const tPatient = useTranslations('UsersPage');
    const [activeTab, setActiveTab] = React.useState<SummaryTab>('financial');

    return (
        <Collapsible open={isOpen} className="mb-2">
            {/* Header row */}
            <div className="flex items-center justify-between pt-2 pb-1 gap-2">
                {/* Title */}
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground shrink-0">
                    {tPatient('stats.summaryTitle')}
                </span>

                {/* Tab switcher */}
                <div className="flex items-center gap-0.5 flex-1 min-w-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('financial')}
                        className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                            activeTab === 'financial'
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {tPatient('stats.tabFinancial')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('treatment')}
                        className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                            activeTab === 'treatment'
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {tPatient('stats.tabTreatment')}
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        type="button"
                        className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        onClick={onPrint}
                        title={tPatient('stats.print')}
                    >
                        <Printer className="h-3.5 w-3.5" />
                        <span className="hidden sm:block text-[9px] font-medium leading-tight">{tPatient('stats.print')}</span>
                    </button>
                    <button
                        type="button"
                        className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        onClick={onToggle}
                    >
                        {isOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        <span className="text-[9px] font-medium leading-tight">
                            {isOpen ? tPatient('stats.hideStats') : tPatient('stats.showStats')}
                        </span>
                    </button>
                </div>
            </div>

            <CollapsibleContent className="transition-all">
                {activeTab === 'financial' && (
                    <FinancialContent financialData={financialData} />
                )}
                {activeTab === 'treatment' && (
                    <TreatmentContent
                        userId={userId}
                        onCreateAppointment={onCreateAppointment}
                        onViewAll={onViewAllTreatments}
                    />
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}
