'use client';

import { ShieldX } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function LicenseExpiredScreen() {
  const t = useTranslations('License');

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
