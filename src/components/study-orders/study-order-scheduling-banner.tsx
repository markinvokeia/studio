'use client';

import * as React from 'react';
import { ClipboardList, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { useStudyOrderScheduling } from '@/stores/study-order-scheduling-store';

/**
 * Aviso persistente de que hay una operación de agendado en curso para una
 * orden de estudio.
 *
 * Se muestra mientras el store tenga contexto, así que sigue visible aunque el
 * operario cierre el diálogo, cambie de sede o se mueva por el calendario. El
 * botón "Cancelar operación" es la única forma de sacarlo: además de ocultar el
 * cartel, corta la vinculación automática de la cita con la orden.
 */
export function StudyOrderSchedulingBanner() {
    const t = useTranslations('StudyOrdersPage.scheduling');
    const { context, clear } = useStudyOrderScheduling();

    if (!context) return null;

    return (
        <div
            role="status"
            className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
        >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 text-sm">
                {t.rich('active', {
                    order: () => <span className="font-mono font-semibold">{context.orderNumber}</span>,
                    patient: () => <span className="font-medium">{context.patientName}</span>,
                })}
            </p>
            <Button variant="ghost" size="sm" onClick={clear} className="shrink-0">
                <X className="mr-1.5 h-3.5 w-3.5" />
                {t('cancelOperation')}
            </Button>
        </div>
    );
}

export default StudyOrderSchedulingBanner;
