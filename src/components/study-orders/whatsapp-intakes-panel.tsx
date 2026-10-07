'use client';

import * as React from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Inbox, MessageCircle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Can } from '@/components/auth/Can';

import { WhatsappIntakeFiles } from './whatsapp-intake-files';

import { STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import { useAsyncAction } from '@/hooks/use-async-action';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { cn, formatDateTime } from '@/lib/utils';
import { isAbortError } from '@/services/api';
import { getWhatsappIntakes, resolveWhatsappIntake, type WhatsappIntakeStatus } from '@/services/study-orders';
import type { WhatsappHandoffReason, WhatsappOrderIntake } from '@/lib/types';

/**
 * Órdenes que el agente de WhatsApp derivó a una persona.
 *
 * No tienen orden en Invoke todavía, por eso no salen en la bandeja: recepción
 * las resuelve desde acá. Cada tarjeta trae lo necesario para decidir sin salir
 * de la pantalla: por qué se derivó, lo que el asistente alcanzó a leer y los
 * originales para compararlo con el papel.
 *
 * "Resolver" solo cierra la derivación: no borra nada. Los originales y la
 * lectura quedan guardados para auditoría.
 */

const PAGE_SIZE = 10;

const REASONS: readonly WhatsappHandoffReason[] = [
    'service_not_found', 'unreadable', 'low_confidence', 'patient_mismatch',
    'booking_failed', 'user_request', 'system_error', 'order_changed',
];

export interface WhatsappIntakesPanelProps {
    /** Cantidad de derivaciones pendientes: la pantalla la muestra en la pestaña. */
    onPendingCountChange?: (count: number) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="truncate text-sm">{children}</dd>
        </div>
    );
}

interface IntakeCardProps {
    intake: WhatsappOrderIntake;
    onResolve: (intake: WhatsappOrderIntake) => void;
}

function IntakeCard({ intake, onResolve }: IntakeCardProps) {
    const t = useTranslations('StudyOrdersPage.whatsapp');
    const isResolved = !!intake.resolved_at;
    const reason = REASONS.includes(intake.handoff_reason) ? intake.handoff_reason : 'system_error';

    return (
        <Card className={cn(isResolved && 'opacity-75')}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
                <div className="min-w-0 space-y-1">
                    <CardTitle className="truncate text-base">{intake.patient_name?.trim() || intake.phone}</CardTitle>
                    <CardDescription>{t('receivedAt', { date: formatDateTime(intake.created_at) })}</CardDescription>
                </div>
                <Badge variant={isResolved ? 'secondary' : 'warning'}>{t(`reason.${reason}`)}</Badge>
            </CardHeader>

            <CardContent className="space-y-4">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label={t('phone')}>{intake.phone}</Field>
                    <Field label={t('document')}>{intake.patient_document || '—'}</Field>
                    {intake.sender_name && <Field label={t('sender')}>{intake.sender_name}</Field>}
                    {intake.doctor_as_written && (
                        <Field label={t('doctorAsWritten')}>
                            <span title={t('doctorNotLinked')}>{intake.doctor_as_written}</span>
                        </Field>
                    )}
                </dl>

                <div className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('studiesRead')}</p>
                    {intake.studies.length === 0 && intake.unmatched_lines.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('noStudies')}</p>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {intake.studies.map((name, i) => (
                                <Badge key={`${name}-${i}`} variant="secondary" className="font-normal">{name}</Badge>
                            ))}
                        </div>
                    )}
                    {intake.unmatched_lines.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-destructive">{t('unmatched')}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {intake.unmatched_lines.map((line, i) => (
                                    <Badge key={`${line}-${i}`} variant="outline" className="border-destructive/60 font-normal text-destructive">
                                        {line}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {intake.handoff_detail && (
                    <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('detail')}</p>
                        <p className="text-sm">{intake.handoff_detail}</p>
                    </div>
                )}

                <WhatsappIntakeFiles intakeId={intake.id} files={intake.files} />

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    {isResolved ? (
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                            <p className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                                {intake.resolved_by_name
                                    ? t('resolvedBy', { name: intake.resolved_by_name, date: formatDateTime(intake.resolved_at as string) })
                                    : t('resolvedOn', { date: formatDateTime(intake.resolved_at as string) })}
                            </p>
                            {intake.resolution_note && <p>{t('resolutionNote', { note: intake.resolution_note })}</p>}
                        </div>
                    ) : (
                        <span />
                    )}
                    {!isResolved && (
                        <Can permission={STUDY_ORDERS_PERMISSIONS.ACKNOWLEDGE}>
                            <Button size="sm" onClick={() => onResolve(intake)}>
                                <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                                {t('resolve')}
                            </Button>
                        </Can>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export function WhatsappIntakesPanel({ onPendingCountChange }: WhatsappIntakesPanelProps) {
    const t = useTranslations('StudyOrdersPage.whatsapp');

    const [status, setStatus] = React.useState<WhatsappIntakeStatus>('pending');
    const [page, setPage] = React.useState(1);
    const [items, setItems] = React.useState<WhatsappOrderIntake[]>([]);
    const [total, setTotal] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [reloadKey, setReloadKey] = React.useState(0);

    const [resolving, setResolving] = React.useState<WhatsappOrderIntake | null>(null);
    const [note, setNote] = React.useState('');

    // Cambiar de filtro vuelve a la primera página: la actual puede no existir.
    const changeStatus = React.useCallback((next: WhatsappIntakeStatus) => {
        setStatus(next);
        setPage(1);
    }, []);

    // Ignora respuestas viejas (filtro o página cambiados mientras cargaba) y
    // conserva lo ya mostrado en una recarga: no vacía la lista.
    const hasLoadedRef = React.useRef(false);
    React.useEffect(() => {
        const controller = new AbortController();
        if (hasLoadedRef.current) setIsRefreshing(true);
        else setIsLoading(true);
        setLoadError(null);

        getWhatsappIntakes({ status, page, limit: PAGE_SIZE, signal: controller.signal })
            .then(({ items: rows, total: count }) => {
                setItems(rows);
                setTotal(count);
                hasLoadedRef.current = true;
                if (status === 'pending') onPendingCountChange?.(count);
            })
            .catch((error) => {
                if (isAbortError(error)) return;
                setLoadError(getErrorMessage(error) || t('loadError'));
            })
            .finally(() => {
                if (controller.signal.aborted) return;
                setIsLoading(false);
                setIsRefreshing(false);
            });

        return () => controller.abort();
        // `onPendingCountChange` y `t` son estables para este efecto: no deben relanzar la carga.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, page, reloadKey]);

    const resolve = useAsyncAction(
        async () => {
            if (!resolving) return;
            await resolveWhatsappIntake(resolving.id, note);
        },
        {
            onSuccess: () => {
                toast({ title: t('toast.resolvedTitle') });
                setResolving(null);
                setNote('');
                setReloadKey((k) => k + 1);
            },
            errorTitle: t('toast.errorTitle'),
        },
    );

    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const STATUS_OPTIONS: readonly WhatsappIntakeStatus[] = ['pending', 'resolved', 'all'];
    const statusLabel: Record<WhatsappIntakeStatus, string> = {
        pending: t('statusPending'),
        resolved: t('statusResolved'),
        all: t('statusAll'),
    };

    return (
        <Card className="flex h-full flex-col border-0 shadow-none lg:border lg:shadow-sm">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="header-icon-circle">
                        <MessageCircle className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <CardTitle>{t('handoffsTitle')}</CardTitle>
                        <CardDescription>{t('handoffsDescription')}</CardDescription>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-md border p-0.5" role="group" aria-label={t('handoffsTitle')}>
                        {STATUS_OPTIONS.map((option) => (
                            <Button
                                key={option}
                                type="button"
                                size="sm"
                                variant={status === option ? 'secondary' : 'ghost'}
                                className="h-7 px-2.5 text-xs"
                                aria-pressed={status === option}
                                onClick={() => changeStatus(option)}
                            >
                                {statusLabel[option]}
                            </Button>
                        ))}
                    </div>
                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        aria-label={t('refresh')}
                        title={t('refresh')}
                        loading={isRefreshing}
                        onClick={() => setReloadKey((k) => k + 1)}
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-card p-4 sm:p-6">
                {isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                ) : loadError ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <p className="text-sm text-destructive">{loadError}</p>
                        <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                            {t('retry')}
                        </Button>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                        <Inbox className="h-8 w-8" aria-hidden="true" />
                        <p className="text-sm">{status === 'resolved' ? t('emptyResolved') : t('empty')}</p>
                    </div>
                ) : (
                    <>
                        {items.map((intake) => (
                            <IntakeCard key={intake.id} intake={intake} onResolve={setResolving} />
                        ))}
                        {pageCount > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-1">
                                <Button
                                    variant="outline" size="icon" className="h-8 w-8"
                                    disabled={page <= 1 || isRefreshing}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    aria-label="‹"
                                >
                                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                                </Button>
                                <span className="text-xs text-muted-foreground">{page} / {pageCount}</span>
                                <Button
                                    variant="outline" size="icon" className="h-8 w-8"
                                    disabled={page >= pageCount || isRefreshing}
                                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                                    aria-label="›"
                                >
                                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>

            <ConfirmActionDialog
                open={!!resolving}
                onOpenChange={(open) => { if (!open) { setResolving(null); setNote(''); } }}
                title={t('resolveDialog.title')}
                description={t('resolveDialog.description', { patient: resolving?.patient_name?.trim() || resolving?.phone || '' })}
                confirmLabel={t('resolveDialog.confirm')}
                cancelLabel={t('resolveDialog.cancel')}
                onConfirm={() => void resolve.run()}
                isPending={resolve.isPending}
                destructive={false}
            >
                <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('resolveDialog.notePlaceholder')}
                    aria-label={t('resolveDialog.noteLabel')}
                    maxLength={500}
                    rows={3}
                    disabled={resolve.isPending}
                />
            </ConfirmActionDialog>
        </Card>
    );
}

export default WhatsappIntakesPanel;
