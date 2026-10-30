'use client';

import * as React from 'react';

import { useClinicInfo } from '@/hooks/useClinicInfo';
import {
    renderPrescriptionHtml,
    type PrescriptionVarSource,
} from '@/lib/prescription-render';
import { cn } from '@/lib/utils';

import { useTranslations } from 'next-intl';

/**
 * Hoja de la receta con todas las variables resueltas.
 *
 * Es la ÚNICA representación del documento: la usa tanto la vista previa del
 * diálogo como la impresión, así lo que el doctor ve mientras completa el
 * formulario es literalmente lo que sale por la impresora.
 *
 * El membrete y el pie son parte de la plantilla (`{{clinic_logo}}`,
 * `{{clinic_name}}`, …), no de este componente: así se pueden rediseñar sin
 * tocar código.
 */
export function PrescriptionDocument({
    contentHtml,
    source,
    className,
}: {
    contentHtml: string;
    /** El `clinic` se resuelve acá si no viene en el source. */
    source: Omit<PrescriptionVarSource, 'clinic'> & { clinic?: PrescriptionVarSource['clinic'] };
    className?: string;
}) {
    const t = useTranslations('PrescriptionPrint');
    const clinicFromHook = useClinicInfo();
    const clinic = source.clinic ?? clinicFromHook;

    const html = React.useMemo(() => renderPrescriptionHtml(contentHtml, { ...source, clinic }, {
        medication: t('table.medication'),
        presentation: t('table.presentation'),
        dosage: t('table.dosage'),
        frequency: t('table.frequency'),
        duration: t('table.duration'),
        instructions: t('table.instructions'),
        days: t('table.days'),
        signature: t('signatureLabel'),
        phonePrefix: t('clinic.phonePrefix'),
        taxIdPrefix: t('clinic.taxIdPrefix'),
        footerNote: t('clinic.footerNote'),
    }), [clinic, contentHtml, source, t]);

    return (
        <div
            // Una hoja impresa es blanca en cualquier tema: los colores se fijan
            // explícitamente para que la vista previa no herede el modo oscuro.
            className={cn('prescription-document bg-white text-gray-900', className)}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

/** Estado vacío de la vista previa, cuando todavía no se eligió plantilla. */
export function PrescriptionDocumentEmpty({ message }: { message: string }) {
    return (
        <div className="flex h-full min-h-[16rem] items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6">
            <p className="max-w-xs text-center text-sm text-muted-foreground">{message}</p>
        </div>
    );
}
