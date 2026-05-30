'use client';

import { AlertTriangle, ShieldX } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface LicenseExpirationBannerProps {
  daysLeft: number;
}

export function LicenseExpirationBanner({ daysLeft }: LicenseExpirationBannerProps) {
  const t = useTranslations('License');

  return (
    <div className="print:hidden w-full bg-yellow-50 border-b border-yellow-200 px-4 py-1.5 flex items-center gap-2 text-xs text-yellow-800 flex-none dark:bg-yellow-950/30 dark:border-yellow-800/50 dark:text-yellow-300">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>{t('expiringSoon.message', { days: daysLeft })}</span>
      <a
        href="mailto:contacto@invokeia.com"
        className="ml-1 underline underline-offset-2 font-medium hover:opacity-80"
      >
        contacto@invokeia.com
      </a>
    </div>
  );
}

export function LicenseExpiredBanner() {
  const t = useTranslations('License');

  return (
    <div className="w-full bg-destructive/10 border-b-2 border-destructive px-4 py-2 flex items-center gap-2 text-xs text-destructive flex-none font-medium">
      <ShieldX className="h-4 w-4 shrink-0" />
      <span>{t('expired.banner')}</span>
      <a
        href="mailto:contacto@invokeia.com"
        className="ml-1 underline underline-offset-2 hover:opacity-80"
      >
        contacto@invokeia.com
      </a>
    </div>
  );
}
