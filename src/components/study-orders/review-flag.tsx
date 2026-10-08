'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';
import type { StudyOrderReviewItem } from '@/lib/types';

/**
 * Marca junto a un dato de la orden que el agente de WhatsApp no tuvo claro (estudio, opción,
 * pieza, campo del paciente). Al pasar el mouse dice qué leyó y con qué confianza. Sin puntos
 * pendientes no muestra nada.
 */
export interface ReviewFlagProps {
    items?: StudyOrderReviewItem[] | null;
    className?: string;
}

export function ReviewFlag({ items, className }: ReviewFlagProps) {
    const t = useTranslations('StudyOrdersPage.review');
    if (!items || items.length === 0) return null;

    const lines = items.map((item) => {
        const n = Number(item.confidence);
        const confidence = item.confidence !== null && item.confidence !== undefined && item.confidence !== '' && Number.isFinite(n)
            ? ` (${t('confidence', { value: Math.round(n * 100) })})`
            : '';
        return `${item.label}${item.value_read ? `: ${item.value_read}` : ''}${confidence}`;
    });

    return (
        <TooltipProvider delayDuration={150}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        className={cn('inline-flex shrink-0 cursor-help align-middle text-amber-600 dark:text-amber-400', className)}
                        tabIndex={0}
                        aria-label={`${t('flag')}: ${lines.join('; ')}`}
                    >
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs space-y-1 text-xs">
                    <p className="font-medium">{t('flag')}</p>
                    {lines.map((line, i) => <p key={i}>{line}</p>)}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export default ReviewFlag;
