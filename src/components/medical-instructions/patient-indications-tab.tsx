'use client';

import * as React from 'react';

import { PatientSubTabNav } from '@/components/patients/patient-subtab-nav';
import { PatientInstructionsSection } from '@/components/medical-instructions/patient-instructions-section';
import { PatientPrescriptionsSection } from '@/components/medical-instructions/patient-prescriptions-section';

import { TIMELINE_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';

import { useTranslations } from 'next-intl';

type IndicationsView = 'instructions' | 'prescriptions';

interface PatientIndicationsTabProps {
    userId: string;
    userName?: string;
    /** Contador: al incrementarse abre el alta de indicación. */
    createTrigger?: number;
    /** Contador: al incrementarse abre el alta de receta. */
    createPrescriptionTrigger?: number;
    readOnly?: boolean;
    /** Fija el doctor de las recetas al usuario de la sesión. */
    lockDoctor?: boolean;
}

/**
 * Sección "Indicaciones Médicas" del historial clínico. Agrupa dos cosas
 * distintas que comparten sitio pero no formato: las **indicaciones** (texto
 * libre a partir de plantilla) y las **recetas** (medicamentos estructurados
 * con período y firma).
 *
 * Es el único punto de montaje: la página de pacientes, el widget lateral, el
 * workspace del doctor (vía `PatientDetailSheet`) y el portal del paciente
 * usan este mismo componente, de modo que se ve igual en todas partes.
 */
export function PatientIndicationsTab({
    userId,
    userName,
    createTrigger = 0,
    createPrescriptionTrigger = 0,
    readOnly = false,
    lockDoctor = false,
}: PatientIndicationsTabProps) {
    const t = useTranslations('PatientIndicationsTab');
    const { hasPermission } = usePermissions();

    const canViewInstructions = hasPermission(TIMELINE_PERMISSIONS.MEDICAL_INSTRUCTIONS_VIEW);
    const canViewPrescriptions = hasPermission(TIMELINE_PERMISSIONS.PRESCRIPTIONS_VIEW);

    const tabs = React.useMemo(() => [
        ...(canViewInstructions ? [{ id: 'instructions', label: t('tabs.instructions') }] : []),
        ...(canViewPrescriptions ? [{ id: 'prescriptions', label: t('tabs.prescriptions') }] : []),
    ], [canViewInstructions, canViewPrescriptions, t]);

    const [view, setView] = React.useState<IndicationsView>(
        canViewInstructions ? 'instructions' : 'prescriptions',
    );

    // Un trigger de alta llega desde el menú de acciones del paciente: además de
    // abrir el diálogo hay que traer al frente la vista que lo contiene.
    React.useEffect(() => {
        if (createTrigger > 0) setView('instructions');
    }, [createTrigger]);

    React.useEffect(() => {
        if (createPrescriptionTrigger > 0) setView('prescriptions');
    }, [createPrescriptionTrigger]);

    if (tabs.length === 0) return null;

    return (
        <div className="space-y-3">
            {tabs.length > 1 && (
                <PatientSubTabNav
                    tabs={tabs}
                    activeTab={view}
                    onChange={(id) => setView(id as IndicationsView)}
                />
            )}

            {view === 'instructions' && canViewInstructions && (
                <PatientInstructionsSection
                    userId={userId}
                    userName={userName}
                    createTrigger={createTrigger}
                    readOnly={readOnly}
                />
            )}

            {view === 'prescriptions' && canViewPrescriptions && (
                <PatientPrescriptionsSection
                    userId={userId}
                    userName={userName}
                    createTrigger={createPrescriptionTrigger}
                    readOnly={readOnly}
                    lockDoctor={lockDoctor}
                />
            )}
        </div>
    );
}
