'use client';

import * as React from 'react';

import { ResizableSheet, SheetDescription, SheetTitle } from '@/components/ui/resizable-sheet';
import { AppointmentHistorySection } from '@/components/appointments/AppointmentHistorySection';
import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AppointmentHistorySheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    appointmentId: string;
    /** Nombre del paciente / summary de la cita, para dar contexto en el header. */
    appointmentLabel?: string;
}

/** Sheet liviano y dedicado: solo el historial de auditoría de una cita puntual —
 *  no reutiliza el panel completo de edición (`AppointmentPanel`), para poder
 *  abrirse desde cualquier lugar (vista custom, panel completo) sin cargar todo
 *  lo demás que ese panel trae consigo. */
export function AppointmentHistorySheet({
    open,
    onOpenChange,
    appointmentId,
    appointmentLabel,
}: AppointmentHistorySheetProps) {
    const t = useTranslations('AppointmentPanel.history');

    return (
        <ResizableSheet
            open={open}
            onOpenChange={onOpenChange}
            defaultWidth={480}
            minWidth={360}
            maxWidth={720}
            storageKey="appointment-history-sheet-width"
        >
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-none border-b border-border bg-card px-6 py-4 pr-14">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <History className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <SheetTitle className="text-base font-semibold truncate leading-tight">{t('title')}</SheetTitle>
                            <SheetDescription className={appointmentLabel ? 'text-xs text-muted-foreground truncate' : 'sr-only'}>
                                {appointmentLabel || t('title')}
                            </SheetDescription>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    <AppointmentHistorySection appointmentId={appointmentId} active={open} />
                </div>
            </div>
        </ResizableSheet>
    );
}

export default AppointmentHistorySheet;
