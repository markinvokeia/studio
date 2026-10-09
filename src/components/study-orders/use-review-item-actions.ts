'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { useKeyedAsyncAction } from '@/hooks/use-async-action';
import { useToast } from '@/hooks/use-toast';
import type { StudyOrderReviewItem, StudyOrderReviewStatus, StudyOrderReviewUpdateResult } from '@/lib/types';
import { updateStudyOrderReviewItems } from '@/services/study-orders';

/**
 * Marcar un punto a revisar (confirmado, corregido, descartado o de vuelta a pendiente). Lo usan
 * la lista de puntos y la tarjeta sobre el original: si el asistente de órdenes lo comparte por
 * `ReviewActionsProvider`, las dos ven el mismo punto bloqueado mientras se guarda.
 */
export interface ReviewItemActions {
    /** Resuelve con el resultado, o `undefined` si falló (ya avisó) o el punto ya se estaba guardando. */
    mark: (item: StudyOrderReviewItem, status: StudyOrderReviewStatus, note?: string) => Promise<StudyOrderReviewUpdateResult | undefined>;
    isPending: (itemId: string) => boolean;
    hasPending: boolean;
}

/** Aviso después de marcar uno o varios puntos: cuántos cambiaron y cuántos bloqueantes quedan. */
export function useReviewUpdateToast() {
    const t = useTranslations('StudyOrdersPage.review');
    const { toast } = useToast();
    return React.useCallback((result: StudyOrderReviewUpdateResult, requested: number) => {
        const skipped = requested - result.updated;
        const description = [
            skipped > 0 ? t('toast.skipped', { count: skipped }) : null,
            result.pending_blocking > 0 ? t('toast.pendingBlocking', { count: result.pending_blocking }) : null,
        ].filter(Boolean).join(' ');
        toast({
            title: requested > 1 ? t('toast.bulkUpdated', { count: result.updated }) : t('toast.updated'),
            description: description || undefined,
        });
    }, [t, toast]);
}

/** `onChanged` recarga la orden; el punto sigue bloqueado hasta que termina. */
export function useReviewItemActions(orderId: string, onChanged?: () => void | Promise<void>): ReviewItemActions {
    const t = useTranslations('StudyOrdersPage.review');
    const notifyUpdated = useReviewUpdateToast();

    const action = useKeyedAsyncAction(
        (item: StudyOrderReviewItem, status: StudyOrderReviewStatus, note?: string) =>
            updateStudyOrderReviewItems({ orderId, itemIds: [item.id], status, note: status === 'pending' ? '' : note }),
        {
            onSuccess: async (result) => {
                notifyUpdated(result, 1);
                await onChanged?.();
            },
            errorTitle: t('toast.error'),
        },
    );

    const { run, isPending, hasPending } = action;
    const mark = React.useCallback(
        (item: StudyOrderReviewItem, status: StudyOrderReviewStatus, note?: string) => run(item.id, item, status, note),
        [run],
    );

    return React.useMemo(() => ({ mark, isPending, hasPending }), [mark, isPending, hasPending]);
}
