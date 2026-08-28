'use client';

import { ArrowLeft, CalendarDays, CalendarPlus, CreditCard, Stethoscope, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';

import { MyAppointmentsTab } from '@/components/patient-portal/my-appointments-tab';
import { PatientAssistant } from '@/components/patient-portal/patient-assistant';
import { PatientBookingPanel } from '@/components/patient-portal/patient-booking-panel';
import { PatientAccountStatement } from '@/components/patient-portal/patient-account-statement';
import { PatientOnboardingBooking } from '@/components/patient-portal/patient-onboarding-booking';
import { PortalNav, type PortalNavItem } from '@/components/patient-portal/portal-nav';
import { PatientInfoTab } from '@/components/patients/patient-info-tab';
import { PatientSubTabNav, type PatientSubTabItem } from '@/components/patients/patient-subtab-nav';
import { PatientInstructionsSection } from '@/components/medical-instructions/patient-instructions-section';
import { AnamnesisViewer, ClinicHistoryViewer, DocumentsViewer } from '@/components/users/clinic-history-viewer';
import { UserTreatmentPlans } from '@/components/users/user-treatment-plans';

import { usePatientPortal } from '@/hooks/usePatientPortal';
import type { Appointment, User } from '@/lib/types';
import { fetchUpcomingPatientAppointments } from '@/services/appointments';

type MacroTab = 'info' | 'appointments' | 'clinical' | 'financial';
type ClinicalSubTab = 'anamnesis' | 'history' | 'treatment-plans' | 'instructions' | 'documents';

export default function MyProfilePage() {
  const t = useTranslations('PatientPortal');
  const { patientId, patientName, patientEmail } = usePatientPortal();

  /**
   * Un paciente con citas entra a verlas: es a lo que viene. La sección de
   * datos personales queda a un clic, pero no es el aterrizaje por defecto.
   */
  const [activeTab, setActiveTab] = React.useState<MacroTab>('appointments');
  const [clinicalSubTab, setClinicalSubTab] = React.useState<ClinicalSubTab>('history');
  /**
   * Estado del wizard de citas embebido en el tab de Citas.
   * `null` ⇒ cerrado. `{ appointment: null }` ⇒ cita nueva.
   * `{ appointment }` ⇒ reagendar esa cita: se crea la nueva y se cancela la vieja.
   */
  const [bookingMode, setBookingMode] = React.useState<{ appointment: Appointment | null } | null>(null);
  const [appointmentsRefresh, setAppointmentsRefresh] = React.useState(0);

  /**
   * Un paciente sin citas futuras entra directo a solicitar una, en vez de
   * aterrizar en pestañas vacías. Se decide acá, consultando sus citas, y no
   * con un flag en la URL: así vale tanto para el recién registrado como para
   * el que vuelve después de mucho tiempo.
   *
   * `null` = todavía no sabemos; no se renderiza nada para evitar el parpadeo
   * entre el perfil y el onboarding.
   */
  const [isOnboarding, setIsOnboarding] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    (async () => {
      try {
        const upcoming = await fetchUpcomingPatientAppointments(patientId, patientName);
        if (!cancelled) setIsOnboarding(upcoming.length === 0);
      } catch {
        // Ante un fallo se muestra el perfil: es el camino menos intrusivo.
        if (!cancelled) setIsOnboarding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, patientName]);

  /** `PatientInfoTab` y `AppointmentFormDialog` esperan un `User`; el portal sólo
   *  conoce los datos del token, que alcanzan para prellenar el formulario. */
  const patientAsUser = React.useMemo<User>(
    () => ({
      id: patientId,
      name: patientName,
      email: patientEmail,
      phone_number: '',
      is_active: true,
      avatar: '',
    }),
    [patientId, patientName, patientEmail],
  );

  const navItems: PortalNavItem[] = [
    { id: 'info', icon: UserRound, label: t('tabs.info'), subtitle: t('tabs.infoSubtitle') },
    { id: 'appointments', icon: CalendarDays, label: t('tabs.appointments'), subtitle: t('tabs.appointmentsSubtitle') },
    { id: 'clinical', icon: Stethoscope, label: t('tabs.clinical'), subtitle: t('tabs.clinicalSubtitle') },
    { id: 'financial', icon: CreditCard, label: t('tabs.financial'), subtitle: t('tabs.financialSubtitle') },
  ];

  const clinicalSubTabs: PatientSubTabItem[] = [
    { id: 'history', label: t('subTabs.history') },
    { id: 'anamnesis', label: t('subTabs.anamnesis') },
    { id: 'treatment-plans', label: t('subTabs.treatmentPlansShort'), desktopLabel: t('subTabs.treatmentPlans') },
    { id: 'instructions', label: t('subTabs.instructionsShort'), desktopLabel: t('subTabs.instructions') },
    { id: 'documents', label: t('subTabs.documents') },
  ];

  const goToTab = (id: string) => {
    setBookingMode(null);
    setActiveTab(id as MacroTab);
  };

  if (!patientId || isOnboarding === null) return null;

  // El perfil recién aparece cuando termina el flujo de reserva.
  if (isOnboarding) {
    return (
      <PatientOnboardingBooking
        patient={patientAsUser}
        onDone={() => {
          setIsOnboarding(false);
          setActiveTab('appointments');
          setAppointmentsRefresh((n) => n + 1);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <PortalNav
        items={navItems}
        activeId={activeTab}
        onSelect={goToTab}
        action={
          /* Reservar está siempre a la vista, desde cualquier sección. */
          <Button
            className="h-11 w-full gap-1.5 max-md:h-9 max-md:w-auto max-md:px-3 max-md:text-xs"
            onClick={() => {
              setActiveTab('appointments');
              setBookingMode({ appointment: null });
            }}
          >
            <CalendarPlus className="h-4 w-4" />
            {t('appointments.book')}
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === 'info' && (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mx-auto max-w-2xl">
              {/* Sus propios datos sí los puede actualizar (menos el email).
                  showNotes={false}: las notas son internas de la clínica. */}
              <PatientInfoTab userId={patientId} showNotes={false} allowEdit />
            </div>
          </div>
        )}

        {activeTab === 'appointments' &&
          (bookingMode ? (
            /* Reserva embebida — sin popup: el wizard usa el alto completo del
               panel y su footer queda fijo abajo, por encima del scroll. */
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
                <div className="mb-3 flex flex-none items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2"
                    onClick={() => setBookingMode(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t('booking.back')}
                  </Button>
                  <h2 className="truncate text-sm font-semibold">
                    {bookingMode.appointment ? t('booking.rescheduleTitle') : t('booking.title')}
                  </h2>
                </div>
                <div className="min-h-0 flex-1">
                  <PatientBookingPanel
                    patient={patientAsUser}
                    rescheduleFrom={bookingMode.appointment}
                    onBooked={() => {
                      setBookingMode(null);
                      setAppointmentsRefresh((n) => n + 1);
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mx-auto max-w-2xl">
                <MyAppointmentsTab
                  patientId={patientId}
                  patientName={patientName}
                  refreshTrigger={appointmentsRefresh}
                  onBook={() => setBookingMode({ appointment: null })}
                  onReschedule={(appointment) => setBookingMode({ appointment })}
                />
              </div>
            </div>
          ))}

        {activeTab === 'clinical' && (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mx-auto max-w-4xl">
              <PatientSubTabNav
                tabs={clinicalSubTabs}
                activeTab={clinicalSubTab}
                onChange={(id) => setClinicalSubTab(id as ClinicalSubTab)}
              />
              {clinicalSubTab === 'history' && (
                <ClinicHistoryViewer userId={patientId} userName={patientName} readOnly />
              )}
              {/* La anamnesis es información del paciente: la puede completar él. */}
              {clinicalSubTab === 'anamnesis' && <AnamnesisViewer userId={patientId} />}
              {clinicalSubTab === 'treatment-plans' && (
                <UserTreatmentPlans userId={patientId} userName={patientName} />
              )}
              {clinicalSubTab === 'instructions' && (
                <PatientInstructionsSection userId={patientId} userName={patientName} />
              )}
              {clinicalSubTab === 'documents' && <DocumentsViewer userId={patientId} readOnly />}
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mx-auto max-w-4xl">
              {/* Se renderiza el MISMO HTML que se imprime, en vez de la UI del
                  libro mayor: el paciente sólo necesita leer su cuenta, no los
                  filtros, acciones por fila ni la edición inline del staff. */}
              <PatientAccountStatement userId={patientId} patientName={patientName} />
            </div>
          </div>
        )}
      </div>

      <PatientAssistant
        patientId={patientId}
        onOpenBooking={() => {
          setActiveTab('appointments');
          setBookingMode({ appointment: null });
        }}
        onOpenTab={goToTab}
      />
    </div>
  );
}
