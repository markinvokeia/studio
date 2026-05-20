'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { DoctorWorkspace } from '@/components/dashboard/doctor-workspace';
import { usePermissions } from '@/hooks/usePermissions';
import { hasDoctorWorkspaceAccess } from '@/lib/permissions';

// Reads ?appointmentId=... from URL — must be wrapped in Suspense
function WorkspaceWithDeepLink({ locale }: { locale: string }) {
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get('appointmentId');
  return <DoctorWorkspace locale={locale} initialAppointmentId={appointmentId} />;
}

export default function WorkspacePage() {
  const locale = useLocale();
  const t = useTranslations('DoctorWorkspacePage');
  const { permissions, isLoading } = usePermissions();

  if (isLoading) {
    return <div className="flex-1 p-4" />;
  }

  if (!hasDoctorWorkspaceAccess(permissions)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-muted-foreground text-sm">{t('noAccess')}</p>
      </div>
    );
  }

  return (
    <React.Suspense fallback={<DoctorWorkspace locale={locale} />}>
      <WorkspaceWithDeepLink locale={locale} />
    </React.Suspense>
  );
}
