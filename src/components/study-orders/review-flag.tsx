'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { hasSource, useReviewLocate } from './review-locate';

import { cn } from '@/lib/utils';
import type { StudyOrderReviewItem } from '@/lib/types';

/**
 * Marca junto a un dato de la orden que el agente de WhatsApp no tuvo claro (estudio, opción,
 * pieza, campo del paciente). Al pasar el mouse dice qué leyó y con qué confianza. Si el asistente
 * dijo dónde lo leyó y los originales están a la vista, un clic lleva a ese lugar del original.
 * Sin puntos pendientes no muestra nada.
 */
export interface ReviewFlagProps {
    items?: StudyOrderReviewItem[] | null;
    className?: string;
}

export function ReviewFlag({ items, className }: ReviewFlagProps) {
    const t = useTranslations('StudyOrdersPage.review');
    const locate = useReviewLocate();
    if (!items || items.length === 0) return null;

    const lines = items.map((item) => {
        const n = Number(item.confidence);
        const confidence = item.confidence !== null && item.confidence !== undefined && item.confidence !== '' && Number.isFinite(n)
            ? ` (${t('confidence', { value: Math.round(n * 100) })})`
            : '';
        return `${item.label}${item.value_read ? `: ${item.value_read}` : ''}${confidence}`;
    });
    const located = locate ? items.find(hasSource) : undefined;
    const label = `${t('flag')}: ${lines.join('; ')}`;
    const iconClass = cn('inline-flex shrink-0 align-middle text-amber-600 dark:text-amber-400', className);

    return (
        <TooltipProvider delayDuration={150}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {located && locate ? (
                        <button
                            type="button"
                            className={cn(iconClass, 'cursor-pointer rounded-sm hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
                            aria-label={`${label}. ${t('locate')}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); locate(located); }}
                        >
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        </button>
                    ) : (
                        <span className={cn(iconClass, 'cursor-help')} tabIndex={0} aria-label={label}>
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        </span>
                    )}
                </TooltipTrigger>
                <TooltipContent className="max-w-xs space-y-1 text-xs">
                    <p className="font-medium">{t('flag')}</p>
                    {lines.map((line, i) => <p key={i}>{line}</p>)}
                    {located && <p className="text-muted-foreground">{t('locateHint')}</p>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export default ReviewFlag;
