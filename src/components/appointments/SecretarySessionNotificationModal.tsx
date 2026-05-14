'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SecretarySessionNotification } from '@/hooks/use-secretary-session-notifications';
import { CalendarPlus, FileText, ListChecks, Stethoscope } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SecretarySessionNotificationModalProps {
  notification: SecretarySessionNotification | null;
  queueCount: number;
  onDismiss: () => void;
  onCreateQuote: (notification: SecretarySessionNotification) => void;
  onScheduleNext: (notification: SecretarySessionNotification) => void;
  onGenerateInvoice: (notification: SecretarySessionNotification) => void;
}

export function SecretarySessionNotificationModal({
  notification,
  queueCount,
  onDismiss,
  onCreateQuote,
  onScheduleNext,
  onGenerateInvoice,
}: SecretarySessionNotificationModalProps) {
  const t = useTranslations('SecretarySessionNotification');

  const session = notification?.session;
  const appointment = notification?.appointment;

  const hasNextPlan = Boolean(session?.plan_proxima_cita?.trim());
  const hasTreatments =
    Array.isArray(session?.tratamientos) && (session?.tratamientos?.length ?? 0) > 0;
  const hasNoQuote = !appointment?.quote_id;

  return (
    <Dialog open={notification !== null} onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent maxWidth="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 shrink-0 text-primary" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {appointment
              ? t('description', {
                  doctorName: appointment.doctorName || t('unknownDoctor'),
                  patientName: appointment.patientName || t('unknownPatient'),
                })
              : null}
          </DialogDescription>
        </DialogHeader>

        {session && (
          <div className="space-y-3 px-6 py-4">
            {/* Procedure */}
            {session.procedimiento_realizado && (
              <div className="rounded-lg border-l-[3px] border-primary/40 bg-primary/5 px-3 py-2.5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary/70">
                  {t('procedure')}
                </p>
                <p className="text-sm text-foreground">{session.procedimiento_realizado}</p>
              </div>
            )}

            {/* Next plan */}
            {hasNextPlan && (
              <div className="rounded-lg border-l-[3px] border-blue-400/60 bg-blue-50/60 px-3 py-2.5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-blue-600/80">
                  {t('nextPlan')}
                </p>
                <p className="text-sm text-foreground">{session.plan_proxima_cita}</p>
                {session.fecha_proxima_cita && (
                  <Badge variant="outline" className="mt-1.5 text-[10px]">
                    {session.fecha_proxima_cita}
                  </Badge>
                )}
              </div>
            )}

            {/* Treatments summary */}
            {hasTreatments && (
              <div className="rounded-lg border-l-[3px] border-green-500/50 bg-green-50/60 px-3 py-2.5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-green-600/80">
                  {t('treatments')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('treatmentCount', { count: session.tratamientos.length })}
                </p>
              </div>
            )}

            {/* Quick actions */}
            <div className="pt-1">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('quickActions')}</p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => { if (notification) onCreateQuote(notification); }}
                >
                  <ListChecks className="h-4 w-4 text-primary" />
                  {t('actionCreateQuote')}
                </Button>

                {hasNextPlan && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => { if (notification) onScheduleNext(notification); }}
                  >
                    <CalendarPlus className="h-4 w-4 text-blue-500" />
                    {t('actionScheduleNext')}
                  </Button>
                )}

                {hasNoQuote && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => { if (notification) onGenerateInvoice(notification); }}
                  >
                    <FileText className="h-4 w-4 text-amber-500" />
                    {t('actionGenerateInvoice')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter align="left">
          {queueCount > 1 && (
            <span className="mr-auto text-xs text-muted-foreground">
              {t('moreNotifications', { count: queueCount - 1 })}
            </span>
          )}
          <Button variant="outline" onClick={onDismiss}>
            {queueCount > 1 ? t('dismissAndNext') : t('dismiss')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
