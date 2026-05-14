'use client';

import * as React from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { BellRing, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { CalendarReminder } from '@/lib/types';

interface ReminderDueAlertProps {
  reminder: CalendarReminder | null;
  onDismiss: () => void;
}

function formatLocalTime(value?: string | null): string {
  if (!value) return '';
  const parsed = parseISO(value.replace(/Z$/, ''));
  return isValid(parsed) ? format(parsed, 'HH:mm') : '';
}

export function ReminderDueAlert({ reminder, onDismiss }: ReminderDueAlertProps) {
  const t = useTranslations('Reminders');
  const time = formatLocalTime(reminder?.start_datetime);

  return (
    <>
      <style>{`
        @keyframes bell-ring {
          0%, 70%, 100% { transform: rotate(0deg); }
          10%            { transform: rotate(-22deg); }
          25%            { transform: rotate(22deg); }
          40%            { transform: rotate(-16deg); }
          55%            { transform: rotate(16deg); }
        }
      `}</style>

      <Dialog open={!!reminder} onOpenChange={(open) => { if (!open) onDismiss(); }}>
        <DialogContent maxWidth="sm" className="text-center">
          {reminder && (
            <div className="flex flex-col items-center gap-5 px-2 py-4">
              <div
                className="grid h-20 w-20 place-items-center rounded-full text-white shadow-lg"
                style={{
                  backgroundColor: reminder.color || '#8b5cf6',
                  animation: 'bell-ring 1.4s ease-in-out infinite',
                }}
              >
                <BellRing className="h-9 w-9" />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('dueTitle')}
                </p>
                <h2 className="text-xl font-bold leading-tight text-foreground">
                  {reminder.title}
                </h2>
                {reminder.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {reminder.description}
                  </p>
                )}
              </div>

              {time && (
                <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {time}
                </div>
              )}

              <Button className="mt-1 w-full" onClick={onDismiss}>
                {t('dismiss')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
