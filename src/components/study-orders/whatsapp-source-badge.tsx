'use client';

import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils';
import type { StudyOrderSource } from '@/lib/types';

/**
 * Marca las órdenes que entraron por WhatsApp (las creó el asistente a partir de
 * una foto o PDF). Una orden del portal no muestra nada: es lo habitual.
 */
export interface WhatsappSourceBadgeProps {
    source?: StudyOrderSource | null;
    className?: string;
}

export function WhatsappSourceBadge({ source, className }: WhatsappSourceBadgeProps) {
    const t = useTranslations('StudyOrdersPage.whatsapp');
    if (source !== 'whatsapp') return null;

    return (
        <Badge
            variant="outline"
            className={cn('gap-1 border-emerald-500/50 px-1.5 py-0 text-[10px] font-medium text-emerald-700 dark:text-emerald-400', className)}
        >
            <MessageCircle className="h-3 w-3" aria-hidden="true" />
            {t('badge')}
        </Badge>
    );
}

export default WhatsappSourceBadge;
