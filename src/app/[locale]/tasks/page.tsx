'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { DoctorWorkspace } from '@/components/dashboard/doctor-workspace';

import { DASHBOARD_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Panel de Tareas del técnico u operador.
 *
 * Es Mi Consultorio con otra fuente: en lugar de las citas donde el usuario es
 * el derivador, trae las que tiene asignadas como técnico más las de los
 * calendarios a los que le dieron acceso. La vista es deliberadamente la misma
 * — el técnico hace el mismo trabajo sobre la cita que el doctor, incluido
 * registrar la sesión clínica.
 */
function TasksContent({ locale }: { locale: string }) {
    const appointmentId = useSearchParams().get('appointmentId');
    return <DoctorWorkspace locale={locale} variant="technician" initialAppointmentId={appointmentId} />;
}

export default function TasksPage() {
    // El locale sale del hook y no de `params`: en Next 15 `params` es una
    // promesa y esta pantalla es un componente de cliente.
    const locale = useLocale();
    const t = useTranslations('TasksPage');
    const { hasPermission } = usePermissions();

    if (!hasPermission(DASHBOARD_PERMISSIONS.TASKS_VIEW_MENU)) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold">{t('accessDenied')}</h2>
                    <p className="mt-2 text-muted-foreground">{t('noPermission')}</p>
                </div>
            </div>
        );
    }

    return (
        <React.Suspense fallback={<DoctorWorkspace locale={locale} variant="technician" />}>
            <TasksContent locale={locale} />
        </React.Suspense>
    );
}
