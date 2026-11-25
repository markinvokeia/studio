'use client';

import { Lock, ShieldX } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { usePermissions } from '@/hooks/usePermissions';

import { LICENSING_PERMISSIONS } from '@/constants/permissions';

/**
 * Blocks the content for everyone once the license expired. Only those who can
 * see the license notice are told why; the rest get a neutral message.
 */
export function LicenseExpiredScreen() {
  const t = useTranslations('License');
  const { hasPermission } = usePermissions();

  if (!hasPermission(LICENSING_PERMISSIONS.VIEW_EXPIRATION_NOTICE)) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
        <div className="text-center max-w-md space-y-4 p-8">
          <Lock className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-3xl font-bold">{t('unavailable.title')}</h1>
          <p className="text-muted-foreground">{t('unavailable.description')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="text-center max-w-md space-y-4 p-8">
        <ShieldX className="h-16 w-16 text-destructive mx-auto" />
        <h1 className="text-3xl font-bold">{t('expired.title')}</h1>
        <p className="text-muted-foreground">{t('expired.description')}</p>
        <p className="text-sm text-muted-foreground">
          {t('expired.contact')}{' '}
          <a
            href="mailto:info@invokeia.com"
            className="text-primary underline underline-offset-4"
          >
            info@invokeia.com
          </a>
        </p>
      </div>
    </div>
  );
}
