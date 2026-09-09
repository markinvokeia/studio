'use client';

import * as React from 'react';
import { parseISO } from 'date-fns';
import { Loader2, Stethoscope } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { ClinicSessionDialog, type ClinicSessionFormData } from '@/components/clinic-session-dialog';

import { StudyOrderSessionCard } from './study-order-session-card';

import { TIMELINE_PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/context/AuthContext';
import { useClinicHistory } from '@/hooks/useClinicHistory';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/utils';
import type { Appointment, StudyOrder, StudyOrderAppointment } from '@/lib/types';
import { updateAppointmentStatusRequest } from '@/services/appointments';
import { recomputeStudyOrderForAppointment } from '@/services/study-orders';

/**
 * Sesiones clínicas de la orden: las ya registradas y el botón para registrar
 * la que falte.
 *
 * Se puede registrar desde acá y no sólo desde la agenda porque el trabajo no
 * siempre pasa por el calendario: el técnico que acaba de tomar el estudio suele
 * tener abierta la orden, no la cita.
 *
 * Quede claro a nombre de quién queda: `doctor_id` de la sesión es SIEMPRE el
 * usuario que la registra —el técnico, la recepcionista o el doctor—, nunca el
 * derivador de la orden. Es lo que el cliente pidió y lo que hace que el
 * historial diga la verdad sobre quién hizo el trabajo.
 */

export interface StudyOrderSessionTabProps {
    order: StudyOrder;
    /** Se dispara tras guardar, para que el panel recargue la orden. */
    onSaved?: () => void;
    /**
     * Contador que la cabecera incrementa para abrir el formulario sin que el
     * usuario tenga que buscar el botón. Cero = nadie lo pidió.
     */
    openRequest?: number;
}

/** Sólo tiene sentido registrar sobre una cita que ocurrió o está ocurriendo. */
function isRecordable(appointment: StudyOrderAppointment): boolean {
    return !['cancelled', 'deleted', 'no_show'].includes(appointment.status);
}

export function StudyOrderSessionTab({ order, onSaved, openRequest = 0 }: StudyOrderSessionTabProps) {
    const t = useTranslations('StudyOrdersPage');
    const { user } = useAuth();
    const { hasPermission } = usePermissions();
    const { createSession, fetchPatientSessions, patientSessions } = useClinicHistory();
    const { toast } = useToast();

    /**
     * Las sesiones del paciente, para poder mostrar sus adjuntos.
     *
     * El detalle de la orden trae la sesión resumida —quién, cuándo, qué hizo—
     * pero no los archivos: viven en otra tabla y no se sumaron a esa consulta.
     * Se piden acá al endpoint de historia clínica, que ya los devuelve, y se
     * cruzan por appointment_id. Así no hubo que tocar ningún flujo.
     */
    React.useEffect(() => {
        if (!order.patient_id) return;
        void fetchPatientSessions(order.patient_id);
    }, [order.patient_id, fetchPatientSessions]);

    const attachmentsByAppointment = React.useMemo(() => {
        const map = new Map<string, { sessionId: string; files: typeof patientSessions[number]['archivos_adjuntos'] }>();
        for (const session of patientSessions) {
            const files = session.archivos_adjuntos ?? [];
            if (!session.appointment_id || files.length === 0) continue;
            map.set(String(session.appointment_id), { sessionId: String(session.sesion_id), files });
        }
        return map;
    }, [patientSessions]);

    const appointments = order.appointments ?? [];
    const withSession = appointments.filter((appointment) => appointment.session);
    const pending = appointments.filter((appointment) => !appointment.session && isRecordable(appointment));

    const canCreate = hasPermission(TIMELINE_PERMISSIONS.CREATE) && !!order.patient_id;

    const [target, setTarget] = React.useState<string>('');
    const [isOpen, setIsOpen] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    // La cabecera pidió registrar. Con una sola cita pendiente el formulario se
    // abre solo; con varias, el diálogo todavía no existe (falta elegir cuál) y
    // el usuario cae en el selector — pero la intención queda anotada, así que
    // apenas elige, se abre sin tener que volver a pedirlo.
    React.useEffect(() => {
        if (openRequest > 0) setIsOpen(true);
    }, [openRequest]);

    // Con una sola cita pendiente no se pregunta cuál: se toma esa.
    const chosen = pending.find((appointment) => appointment.id === target) ?? (pending.length === 1 ? pending[0] : undefined);

    const handleSave = async (data: ClinicSessionFormData) => {
        if (!chosen || !order.patient_id) return;
        setIsSaving(true);
        try {
            await createSession(order.patient_id, {
                ...data,
                appointment_id: chosen.id,
                // A nombre de quien la registra, no del derivador.
                doctor_id: String(user?.id ?? ''),
            }, data.archivos_adjuntos);

            // La cita queda atendida. Es el mismo paso que da la agenda al
            // guardar una sesión, y acá no es cosmético: `v_study_orders_board`
            // cuenta una línea como completada mirando el estado de su cita, así
            // que sin esto la orden nunca cerraría.
            if (chosen.status !== 'completed') {
                await updateAppointmentStatusRequest({
                    appointment: {
                        id: chosen.id,
                        googleEventId: chosen.google_event_id ?? undefined,
                        calendar_source_id: chosen.calendar_source_id ?? undefined,
                    } as unknown as Appointment,
                    newStatus: 'completed',
                });
            }

            // Va DESPUÉS y con await: el recálculo lee el estado de las citas, y
            // si corriera antes vería la cita todavía agendada y dejaría la orden
            // abierta. Deja además el renglón en la bitácora y, si ésta era la
            // última línea pendiente, avisa al derivador de que ya está.
            await recomputeStudyOrderForAppointment(chosen.id);

            toast({ title: t('sessionTab.saved') });
            setIsOpen(false);
            onSaved?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.genericError'),
                description: error instanceof Error ? error.message : undefined,
            });
            throw error;
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            {withSession.map((appointment) => (
                <StudyOrderSessionCard
                    key={appointment.id}
                    appointment={appointment}
                    attachments={attachmentsByAppointment.get(String(appointment.id))}
                />
            ))}

            {withSession.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('sessionTab.none')}</p>
            )}

            {canCreate && pending.length > 0 && (
                <div className="space-y-2 rounded-lg border border-dashed p-3">
                    <p className="text-sm font-medium">{t('sessionTab.recordTitle')}</p>

                    {/* Con varias citas sin sesión hay que decir sobre cuál. */}
                    {pending.length > 1 && (
                        <Select value={target} onValueChange={setTarget}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('sessionTab.chooseAppointment')} />
                            </SelectTrigger>
                            <SelectContent>
                                {pending.map((appointment) => (
                                    <SelectItem key={appointment.id} value={appointment.id}>
                                        {formatDateTime(appointment.start_datetime)}
                                        {appointment.sede_name ? ` · ${appointment.sede_name}` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <Button onClick={() => setIsOpen(true)} disabled={!chosen || isSaving} className="w-full sm:w-auto">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stethoscope className="mr-2 h-4 w-4" />}
                        {t('sessionTab.record')}
                    </Button>

                    <p className="text-xs text-muted-foreground">
                        {t('sessionTab.recordHint', { name: user?.name ?? '' })}
                    </p>
                </div>
            )}

            {chosen && order.patient_id && (
                <ClinicSessionDialog
                    open={isOpen}
                    onOpenChange={setIsOpen}
                    onSave={handleSave}
                    userId={order.patient_id}
                    patientName={order.patient_name}
                    appointmentId={chosen.id}
                    serviceName={(chosen.services ?? []).map((service) => service.name).join(', ')}
                    defaultDate={parseISO(chosen.start_datetime.replace(/Z$/, ''))}
                    showAttachments
                    // El doctor de la sesión queda fijado en quien la registra:
                    // sin `lockDoctor` el formulario dejaría cambiarlo y la
                    // sesión terminaría a nombre de otro.
                    lockDoctor
                    prefillData={{ doctor_id: String(user?.id ?? ''), doctor_name: user?.name ?? '' }}
                />
            )}
        </div>
    );
}

export default StudyOrderSessionTab;
