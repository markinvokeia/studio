'use client';

import { ImportWizard } from '@/components/import/ImportWizard';
import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ImportDataPage() {
  const t = useTranslations('ImportPage');

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {/* Wizard card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <ImportWizard />
      </div>
    </div>
  );
}
