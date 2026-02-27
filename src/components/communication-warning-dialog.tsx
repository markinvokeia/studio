'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface CommunicationWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabledItems: string[];
  itemLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function CommunicationWarningDialog({
  open,
  onOpenChange,
  disabledItems,
  itemLabel,
  onConfirm,
  onCancel,
}: CommunicationWarningDialogProps) {
  const t = useTranslations('CommunicationWarningDialog');

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <AlertDialogTitle>{t('title')}</AlertDialogTitle>
            </div>
          </div>
          <AlertDialogDescription className="ml-13 mt-2">
            {t('description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="my-2 max-h-32 overflow-y-auto rounded-md border bg-muted p-3">
          <ul className="list-disc pl-4 text-sm text-muted-foreground">
            {disabledItems.map((item, index) => (
              <li key={index}>{itemLabel ? `${itemLabel}: ${item}` : item}</li>
            ))}
          </ul>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className="bg-amber-600 hover:bg-amber-700">
            {t('continueAnyway')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
