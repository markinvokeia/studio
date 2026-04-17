'use client';

import { ImportWizard } from '@/components/import/ImportWizard';
import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ImportDataPage() {
  const t = useTranslations('ImportPage');

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-0 lg:border bg-card shadow-none lg:shadow-sm lg:rounded-xl">
        <div className="flex-none flex items-center gap-3 p-4 border-b">
          <div className="header-icon-circle">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">{t('title')}</h1>
            <p className="text-xs text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <ImportWizard />
      </div>
    </div>
  );
}
