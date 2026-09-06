'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils';
import type { StudyOrderBoardStatus } from '@/lib/types';

/**
 * Badge del estado derivado de la orden, más el pin de "atrasada".
 *
 * "Atrasada" es ortogonal al estado, no un estado más: una orden puede estar
 * parcialmente agendada Y atrasada al mismo tiempo. Por eso va como un segundo
 * indicador y no reemplaza al badge.
 */

const VARIANT_BY_STATUS: Record<StudyOrderBoardStatus, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'info' | 'warning'> = {
    draft:               'outline',
    new:                 'info',
    unscheduled:         'warning',
    partially_scheduled: 'warning',
    scheduled:           'default',
    in_progress:         'warning',
    completed:           'success',
    cancelled:           'destructive',
};

export interface StudyOrderStatusBadgeProps {
    status: StudyOrderBoardStatus;
    isOverdue?: boolean;
    /** Contadores para mostrar "3/5" junto al estado cuando el avance es parcial. */
    itemsScheduled?: number;
    itemsTotal?: number;
    className?: string;
}

export function StudyOrderStatusBadge({
    status,
    isOverdue = false,
    itemsScheduled,
    itemsTotal,
    className,
}: StudyOrderStatusBadgeProps) {
    const t = useTranslations('StudyOrdersPage.status');

    const showProgress =
        status === 'partially_scheduled' &&
        typeof itemsScheduled === 'number' &&
        typeof itemsTotal === 'number';

    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <Badge variant={VARIANT_BY_STATUS[status]} className="whitespace-nowrap">
                {t(status)}
                {showProgress && <span className="ml-1 tabular-nums opacity-80">{itemsScheduled}/{itemsTotal}</span>}
            </Badge>
            {isOverdue && (
                <span
                    className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
                    title={t('overdue')}
                >
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    {t('overdue')}
                </span>
            )}
        </div>
    );
}

export default StudyOrderStatusBadge;
