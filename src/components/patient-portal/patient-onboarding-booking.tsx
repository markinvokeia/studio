'use client';

import { CalendarCheck, PartyPopper } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';

import { PatientBookingPanel } from '@/components/patient-portal/patient-booking-panel';

import type { User } from '@/lib/types';

interface PatientOnboardingBookingProps {
  patient: User;
  /** Se llama cuando el paciente termina de reservar o decide hacerlo más tarde. */
  onDone: () => void;
}

/**
 * Primer paso del paciente sin citas futuras.
 *
 * Es la continuación natural del wizard de acceso: alguien que se acaba de
 * registrar —o que no tiene ninguna cita agendada— no gana nada aterrizando en
 * pestañas vacías, y obligarlo a buscar el botón de reservar sería un paso de
 * más. Recién cuando reserva (o elige hacerlo después) se le muestra el perfil.
 *
 * Ocupa el alto completo del portal para que el panel de reserva pueda repartir
 * scroll y footer fijo.
 */
export function PatientOnboardingBooking({ patient, onDone }: PatientOnboardingBookingProps) {
  const t = useTranslations('PatientPortal.onboarding');
  const [hasBooked, setHasBooked] = React.useState(false);

  if (hasBooked) {
    return (
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <PartyPopper className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">{t('bookedTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('bookedDescription')}</p>
        <Button size="lg" className="mt-8 h-12 w-full text-base" onClick={onDone}>
          {t('goToProfile')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 py-4">
      <div className="flex flex-none flex-col items-center pb-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CalendarCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
          {t('title', { name: patient.name.split(' ')[0] || patient.name })}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="min-h-0 flex-1">
        <PatientBookingPanel
          patient={patient}
          onBooked={() => setHasBooked(true)}
          secondaryAction={
            <Button variant="ghost" className="h-10 w-full text-sm" onClick={onDone}>
              {t('skip')}
            </Button>
          }
        />
      </div>
    </div>
  );
}
