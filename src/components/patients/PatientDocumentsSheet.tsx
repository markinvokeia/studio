'use client';

import * as React from 'react';
import { ArrowLeft, Images } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Button } from '@/components/ui/button';

import { DocumentsViewer } from '@/components/users/clinic-history-viewer';

import { usePatientDocumentsSheet } from '@/stores/patient-documents-sheet-store';

/**
 * Global host for the "Imágenes y archivos" panel opened from the custom
 * calendar mode context menu: the patient's documents gallery (same section
 * as the "Documentos" subtab in the patient view).
 */
export function PatientDocumentsSheet() {
  const { isOpen, userId, userName, close } = usePatientDocumentsSheet();
  const t = useTranslations('PatientDocumentsSheet');

  return (
    <ResizableSheet
      open={isOpen}
      onOpenChange={(o) => { if (!o) close(); }}
      defaultWidth={900}
      minWidth={520}
      maxWidth={1300}
      storageKey="patient-documents-sheet-width"
    >
      <div className="flex h-full flex-col overflow-hidden bg-card">
        <div className="flex flex-none items-center gap-3 border-b border-border px-5 py-4 pr-20">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Images className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-semibold text-foreground">{t('title')}</SheetTitle>
            <SheetDescription className="truncate text-sm text-muted-foreground">{userName || ''}</SheetDescription>
          </div>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
          <Button variant="ghost" size="sm" onClick={close}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t('back')}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {userId && <DocumentsViewer userId={userId} documentsOnly />}
        </div>
      </div>
    </ResizableSheet>
  );
}
