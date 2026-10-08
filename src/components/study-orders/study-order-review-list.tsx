'use client';

import * as React from 'react';
import { AlertTriangle, Check, CheckCircle2, MessageSquarePlus, Pencil, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useKeyedAsyncAction } from '@/hooks/use-async-action';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDateTime } from '@/lib/utils';
import type { StudyOrderReviewItem, StudyOrderReviewStatus } from '@/lib/types';
import { updateStudyOrderReviewItem } from '@/services/study-orders';

/**
 * Puntos a revisar de una orden: lo que el agente de WhatsApp no tuvo claro al leerla (lectura
 * dudosa, estudio fuera del catálogo, dato ilegible, falta el dorso...). Cada uno se mira contra el
 * original y se marca confirmado, corregido o descartado; queda quién y cuándo.
 *
 * En el borrador creado al derivar los puntos son bloqueantes: la orden no se envía con alguno
 * pendiente. En una orden que el agente agendó solo son una lista de verificación.
 */

export interface StudyOrderReviewListProps {
    orderId: string;
    items: StudyOrderReviewItem[];
    /** Sin permiso (o con la orden anulada) la lista es de solo lectura. */
    canReview: boolean;
    /** Después de marcar un punto: el padre recarga la orden (y con ella el bloqueo de envío). */
    onChanged?: () => void | Promise<void>;
    /** `plain`: sin título ni ayuda, para cuando quien la usa pone su propio encabezado. */
    variant?: 'full' | 'plain';
    className?: string;
}

/** Cuántos puntos bloqueantes quedan sin revisar. */
export function countPendingBlocking(items: StudyOrderReviewItem[] | null | undefined): number {
    return (items ?? []).filter((i) => i.blocking && i.status === 'pending').length;
}

const KNOWN_CODES = new Set([
    'handoff_reason', 'low_confidence', 'not_in_catalog', 'unreadable',
    'unplaced', 'possibly_incomplete', 'no_signature', 'old_order',
]);

function confidencePercent(value: StudyOrderReviewItem['confidence']): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function StudyOrderReviewList({ orderId, items, canReview, onChanged, variant = 'full', className }: StudyOrderReviewListProps) {
    const t = useTranslations('StudyOrdersPage.review');
    const { toast } = useToast();
    /** Notas en curso, por punto. Se abre el campo solo si la persona quiere dejar una. */
    const [notes, setNotes] = React.useState<Record<string, string>>({});
    const [noteOpen, setNoteOpen] = React.useState<Record<string, boolean>>({});

    const mark = useKeyedAsyncAction(
        (item: StudyOrderReviewItem, status: StudyOrderReviewStatus) =>
            updateStudyOrderReviewItem({ orderId, itemId: item.id, status, note: status === 'pending' ? '' : notes[item.id] }),
        {
            onSuccess: async (result) => {
                toast({
                    title: t('toast.updated'),
                    description: result.pending_blocking > 0
                        ? t('toast.pendingBlocking', { count: result.pending_blocking })
                        : undefined,
                });
                setNotes((prev) => ({ ...prev, [result.id]: '' }));
                setNoteOpen((prev) => ({ ...prev, [result.id]: false }));
                await onChanged?.();
            },
            errorTitle: t('toast.error'),
        },
    );

    if (items.length === 0) return null;

    const pending = items.filter((i) => i.status === 'pending');
    const pendingBlocking = countPendingBlocking(items);

    return (
        <section className={cn('space-y-3', className)} aria-label={t('title')}>
            {variant === 'full' && (<>
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{t('title')}</h3>
                {pending.length > 0 ? (
                    <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                        {t('pendingCount', { count: pending.length })}
                    </Badge>
                ) : (
                    <Badge variant="success" className="px-1.5 py-0 text-[10px]">{t('allReviewed')}</Badge>
                )}
            </div>
            <p className="text-xs text-muted-foreground">
                {pendingBlocking > 0 ? t('blockingHelp', { count: pendingBlocking }) : t('help')}
            </p>
            </>)}

            <ul className="space-y-2">
                {items.map((item) => {
                    const isPending = item.status === 'pending';
                    const busy = mark.isPending(item.id);
                    const confidence = confidencePercent(item.confidence);
                    const codeLabel = KNOWN_CODES.has(item.code) ? t(`code.${item.code}` as never) : item.code;
                    return (
                        <li
                            key={item.id}
                            className={cn(
                                'rounded-lg border p-3 text-sm',
                                isPending && item.blocking && 'border-amber-500/50 bg-amber-500/5',
                                !isPending && 'bg-muted/30',
                            )}
                        >
                            <div className="flex items-start gap-2">
                                {isPending ? (
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                                ) : (
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                                )}
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="font-medium">{codeLabel}</span>
                                        {confidence !== null && (
                                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] tabular-nums">
                                                {t('confidence', { value: confidence })}
                                            </Badge>
                                        )}
                                        {isPending && item.blocking && (
                                            <Badge variant="outline" className="border-amber-500/50 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-400">
                                                {t('blocking')}
                                            </Badge>
                                        )}
                                    </div>
                                    {/* `label` y `detail` los escribe el agente: van tal cual, en el idioma de la orden. */}
                                    <p className="break-words text-muted-foreground">
                                        {item.label}
                                        {item.value_read && (
                                            <>: <span className="font-mono text-foreground">{item.value_read}</span></>
                                        )}
                                    </p>
                                    {item.detail && <p className="break-words text-xs text-muted-foreground">{item.detail}</p>}

                                    {!isPending && (
                                        <p className="text-xs text-muted-foreground">
                                            {t(`status.${item.status}` as never)}
                                            {item.reviewed_by_name && ` · ${item.reviewed_by_name}`}
                                            {item.reviewed_at && ` · ${formatDateTime(item.reviewed_at)}`}
                                            {item.resolution_note && <> · <span className="italic">{item.resolution_note}</span></>}
                                        </p>
                                    )}

                                    {canReview && isPending && noteOpen[item.id] && (
                                        <Input
                                            value={notes[item.id] ?? ''}
                                            onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                            placeholder={t('notePlaceholder')}
                                            maxLength={500}
                                            disabled={busy}
                                            className="h-8 text-sm"
                                            aria-label={t('notePlaceholder')}
                                        />
                                    )}

                                    {canReview && (
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                            {isPending ? (
                                                <>
                                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                                                        loading={busy} disabled={busy}
                                                        onClick={() => void mark.run(item.id, item, 'confirmed')}>
                                                        <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                                        {t('actions.confirm')}
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                                                        disabled={busy}
                                                        onClick={() => void mark.run(item.id, item, 'corrected')}>
                                                        <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                                        {t('actions.corrected')}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                                                        disabled={busy}
                                                        onClick={() => void mark.run(item.id, item, 'dismissed')}>
                                                        <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                                        {t('actions.dismiss')}
                                                    </Button>
                                                    {!noteOpen[item.id] && (
                                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground"
                                                            disabled={busy}
                                                            onClick={() => setNoteOpen((prev) => ({ ...prev, [item.id]: true }))}>
                                                            <MessageSquarePlus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                                            {t('actions.addNote')}
                                                        </Button>
                                                    )}
                                                </>
                                            ) : (
                                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground"
                                                    loading={busy} disabled={busy}
                                                    onClick={() => void mark.run(item.id, item, 'pending')}>
                                                    <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                                    {t('actions.reopen')}
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

export default StudyOrderReviewList;
