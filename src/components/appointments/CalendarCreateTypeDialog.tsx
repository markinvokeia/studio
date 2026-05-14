'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { BellRing, CalendarPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CalendarCreateTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  onCreateAppointment: () => void;
  onCreateReminder: () => void;
}

export function CalendarCreateTypeDialog({
  open,
  onOpenChange,
  date,
  onCreateAppointment,
  onCreateReminder,
}: CalendarCreateTypeDialogProps) {
  const t = useTranslations('Reminders.createType');
  const when = date ? format(date, 'dd/MM/yyyy HH:mm') : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)]" maxWidth="2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{when ? t('descriptionWithDate', { date: when }) : t('description')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-3 overflow-x-hidden px-6 py-5 md:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto min-w-0 justify-start gap-3 rounded-xl p-4 text-left"
            onClick={onCreateAppointment}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <CalendarPlus className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{t('appointment')}</span>
              <span className="block whitespace-normal text-xs font-normal leading-snug text-muted-foreground">
                {t('appointmentDescription')}
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-w-0 justify-start gap-3 rounded-xl p-4 text-left"
            onClick={onCreateReminder}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700">
              <BellRing className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{t('reminder')}</span>
              <span className="block whitespace-normal text-xs font-normal leading-snug text-muted-foreground">
                {t('reminderDescription')}
              </span>
            </span>
          </Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
