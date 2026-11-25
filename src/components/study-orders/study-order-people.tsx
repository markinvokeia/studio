'use client';

import * as React from 'react';
import { Stethoscope, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

import type { StudyOrder } from '@/lib/types';

/**
 * Paciente y odontólogo de la orden, en dos bloques separados.
 *
 * De cada uno se dice si está vinculado a una ficha o si es solo lo que se escribió en la orden:
 * no es lo mismo el odontólogo con cuenta que el nombre que traía el papel.
 */

type LinkState = 'linked' | 'onOrder' | 'missing';

const BADGE_BY_STATE: Record<LinkState, 'success' | 'warning' | 'outline'> = {
    linked: 'success',
    onOrder: 'warning',
    missing: 'outline',
};

export function StudyOrderPeople({ order, footer }: { order: StudyOrder; footer?: React.ReactNode }) {
    const t = useTranslations('StudyOrdersPage');
    const { patient, doctor } = order;

    const doctorName = doctor?.name ?? order.doctor_name ?? order.referring_doctor_name;
    const doctorState: LinkState = order.doctor_id ? 'linked' : order.referring_doctor_name ? 'onOrder' : 'missing';

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <PersonCard
                    icon={User}
                    title={t('people.patient')}
                    name={patient?.name ?? order.patient_name}
                    state={order.patient_id ? 'linked' : 'onOrder'}
                    rows={[
                        [t('form.patientDocument'), patient?.identity_document ?? order.patient_document],
                        [t('form.patientPhone'), patient?.phone_number ?? order.patient_phone],
                        [t('form.patientEmail'), patient?.email ?? order.patient_email],
                        [t('patientTab.mutualSociety'), patient?.mutual_society_name],
                    ]}
                />
                <PersonCard
                    icon={Stethoscope}
                    title={t('people.doctor')}
                    name={doctorName}
                    state={doctorState}
                    rows={[
                        [t('form.patientDocument'), doctor?.identity_document],
                        [t('people.rut'), doctor?.rut],
                        [t('form.patientPhone'), doctor?.phone_number ?? doctor?.alternative_phone],
                        [t('form.patientEmail'), doctor?.email],
                        [t('people.office'), doctor?.address],
                    ]}
                />
            </div>
            {footer}
        </div>
    );
}

function PersonCard({ icon: Icon, title, name, state, rows }: {
    icon: React.ElementType;
    title: string;
    name?: string | null;
    state: LinkState;
    rows: Array<[string, string | null | undefined]>;
}) {
    const t = useTranslations('StudyOrdersPage.people');
    const filled = rows.filter(([, value]) => !!value?.trim());
    return (
        <section className="min-w-0 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
                <Badge variant={BADGE_BY_STATE[state]} className="ml-auto">{t(`state.${state}`)}</Badge>
            </div>
            <p className="mt-2 break-words font-medium">{name?.trim() || '—'}</p>
            {filled.length > 0 && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    {filled.map(([label, value]) => (
                        <React.Fragment key={label}>
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className="min-w-0 break-words">{value}</dd>
                        </React.Fragment>
                    ))}
                </dl>
            )}
        </section>
    );
}

export default StudyOrderPeople;
