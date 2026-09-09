'use client';

import { useTranslations } from 'next-intl';

/**
 * "Ana Pérez derivado por Dra. García".
 *
 * La misma frase aparece en tres lugares —la cabecera del detalle, la tarjeta de
 * la lista y la del panel principal— y tiene que leerse igual en los tres. Vive
 * acá para que no se arme por separado en cada uno.
 *
 * Hay dos formas porque los consumidores no piden lo mismo: `DataCard.title`
 * acepta un string y la cabecera puede pintar al derivador en gris. Las dos
 * salen de la misma clave de traducción, así que no pueden divergir.
 *
 * Sin derivador —una orden que cargó la propia clínica— se muestra sólo el
 * paciente: "derivado por" seguido de nada es peor que no decirlo.
 */

export interface StudyOrderReferralLineProps {
    patientName?: string | null;
    doctorName?: string | null;
}

export function StudyOrderReferralLine({ patientName, doctorName }: StudyOrderReferralLineProps) {
    const t = useTranslations('StudyOrdersPage');
    const patient = patientName?.trim() || '—';

    if (!doctorName?.trim()) return <>{patient}</>;

    return (
        <>
            {patient}
            <span className="font-normal text-muted-foreground">
                {' '}
                {t('referredByShort', { doctor: doctorName })}
            </span>
        </>
    );
}

/** La misma frase como texto plano, para donde no se admite JSX. */
export function referralLabel(
    patientName: string | null | undefined,
    doctorName: string | null | undefined,
    t: (key: string, values?: Record<string, string>) => string,
): string {
    const patient = patientName?.trim() || '—';
    if (!doctorName?.trim()) return patient;
    return `${patient} ${t('referredByShort', { doctor: doctorName })}`;
}

export default StudyOrderReferralLine;
