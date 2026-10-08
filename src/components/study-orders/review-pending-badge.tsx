'use client';

import { ListChecks } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils';

/**
 * Cuántos puntos dejó el agente de WhatsApp sin revisar en la orden. Sin pendientes no muestra nada.
 */
export interface ReviewPendingBadgeProps {
    /** Postgres lo devuelve como texto. */
    count?: number | string | null;
    className?: string;
}

export function ReviewPendingBadge({ count, className }: ReviewPendingBadgeProps) {
    const t = useTranslations('StudyOrdersPage.review');
    const n = Number(count ?? 0);
    if (!Number.isFinite(n) || n <= 0) return null;

    return (
        <Badge
            variant="outline"
            title={t('pendingCount', { count: n })}
            className={cn('gap-1 border-amber-500/50 px-1.5 py-0 text-[10px] font-medium tabular-nums text-amber-700 dark:text-amber-400', className)}
        >
            <ListChecks className="h-3 w-3" aria-hidden="true" />
            {n}
            <span className="sr-only">{t('pendingCount', { count: n })}</span>
        </Badge>
    );
}

export default ReviewPendingBadge;
