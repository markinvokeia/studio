'use client';

import * as React from 'react';

import { PatientDetailSheet } from '@/components/appointments/PatientDetailSheet';
import { usePatientView } from '@/stores/patient-view-store';

/**
 * Global host that renders the patient detail sheet driven by usePatientView,
 * so any part of the app can open a patient with a single store call.
 */
export function PatientQuickViewHost() {
  const { isOpen, userId, userName, userEmail, userPhone, initialTab, close } = usePatientView();

  if (!userId) return null;

  return (
    <PatientDetailSheet
      open={isOpen}
      onOpenChange={(o) => { if (!o) close(); }}
      userId={userId}
      userName={userName}
      userEmail={userEmail}
      userPhone={userPhone}
      initialTab={initialTab}
    />
  );
}
