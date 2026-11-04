'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Ban, CalendarPlus, CheckCircle2, ChevronDown, MessageCircle, Receipt } from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { fetchPatientById } from '@/components/patients/patient-form-utils';
import { BUSINESS_CONFIG_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import { useAsyncAction } from '@/hooks/use-async-action';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { fetchReassignCalendars, fetchReassignDoctors } from '@/lib/appointment-reassign';
import { cn, formatDisplayDate, formatUtcDateTime } from '@/lib/utils';
import { addAestheticNote, closeAestheticSession, voidAestheticSession } from '@/services/aesthetic-record';
import { useBillingWizard } from '@/stores/billing-wizard-store';

import type { AestheticSessionEvent, Calendar as CalendarType, User } from '@/lib/types';
import { isSessionLockedError } from './aesthetic-errors';
import { formatQuantity, layerColor, layerQuantity } from './layers';
import { PHOTO_VIEWS, sessionPhotoOf } from './photo-utils';
import { useSessionFlow } from './session-flow-context';
import { addDaysToDate, missingText, nextMissing, photoExemption } from './session-status';
import { useAestheticFileUrl } from './use-aesthetic-file-url';
import { useZoneLabel } from './use-zone-label';

export function StepClose() {
  const t = useTranslations('AestheticRecord');
  const { toast } = useToast();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const { open: openBillingWizard } = useBillingWizard();
  const flow = useSessionFlow();
  const { draft, updateDraft, stored, done, status, readOnly, canRegister, configFor, goToStep, ensureSaved, applyServer, reportError, patientId, patientName, facts } = flow;
  const zoneLabel = useZoneLabel();
  const ready = status === 'ready_to_close';
  const closed = stored?.status === 'closed';
  const voided = stored?.status === 'void';
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [voidOpen, setVoidOpen] = React.useState(false);
  const [voidReason, setVoidReason] = React.useState('');
  const [amendment, setAmendment] = React.useState('');
  const [patient, setPatient] = React.useState<User | null>(null);
  const [appointment, setAppointment] = React.useState<{ layerId: string; date: string; summary: string } | null>(null);
  const [agenda, setAgenda] = React.useState<{ calendars: CalendarType[]; doctors: User[] } | null>(null);
  const [scheduled, setScheduled] = React.useState<Set<string>>(() => new Set());
  const [showActivity, setShowActivity] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    fetchPatientById(patientId).then((p) => { if (active) setPatient(p); }).catch(() => undefined);
    return () => { active = false; };
  }, [patientId]);

  const rows = draft.layers.map((layer, index) => {
    const byZone = new Map<string, number>();
    for (const mark of layer.marks) {
      const key = mark.zone ? zoneLabel(mark.zone) : t('zones.none');
      byZone.set(key, (byZone.get(key) ?? 0) + (mark.quantity ?? 0));
    }
    return { layer, color: layerColor(layer, index), byZone: [...byZone.entries()], total: layerQuantity(layer), config: configFor(layer) };
  });
  const charge = rows.reduce((sum, r) => sum + (r.config?.price ?? 0), 0);
  const aftercare = rows.filter((r) => r.config?.aftercare);
  const followUps = rows.filter((r) => r.config?.followUpDays);
  const canBill = hasAnyPermission([SALES_PERMISSIONS.INVOICES_CREATE, SALES_PERMISSIONS.PAYMENTS_CREATE]);
  const canSchedule = hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_CREATE);
  const phone = (patient?.phone_number ?? '').replace(/\D/g, '');

  const close = useAsyncAction(
    async () => closeAestheticSession(await ensureSaved(), draft.notes),
    {
      onSuccess: (session) => { applyServer(session); setConfirmClose(false); toast({ title: t('flow.close.closedToast') }); },
      errorTitle: t('flow.close.closeError'),
      describeError: reportError,
      // Someone else closed or voided it: the sheet goes read-only, and this dialog would cover its notice
      onError: (error) => { if (isSessionLockedError(error)) setConfirmClose(false); },
    },
  );
  const voidSession = useAsyncAction(
    async () => voidAestheticSession(await ensureSaved(), voidReason.trim()),
    {
      onSuccess: (session) => { applyServer(session); setVoidOpen(false); toast({ title: t('flow.close.voidedToast') }); },
      errorTitle: t('flow.close.voidError'),
      describeError: reportError,
      onError: (error) => { if (isSessionLockedError(error)) setVoidOpen(false); },
    },
  );
  const amend = useAsyncAction(
    async () => (stored ? addAestheticNote(stored.id, amendment.trim(), 'amendment') : null),
    {
      onSuccess: (session) => { if (session) applyServer(session); setAmendment(''); toast({ title: t('flow.close.amendmentAdded') }); },
      errorTitle: t('flow.notes.error'),
      describeError: reportError,
    },
  );

  async function openAppointment(layerId: string, days: number, summary: string) {
    if (!agenda) {
      const [calendars, doctors] = await Promise.all([fetchReassignCalendars(), fetchReassignDoctors()]);
      setAgenda({ calendars, doctors });
    }
    setAppointment({ layerId, date: addDaysToDate(draft.date, days), summary });
  }

  function sendAftercare() {
    const lines = aftercare.map((r) => `*${r.layer.serviceName}*\n${r.config!.aftercare}`);
    const text = [t('flow.close.aftercareGreeting', { name: patientName ?? '' }), ...lines].join('\n\n');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  const exemption = facts.photos.length ? null : photoExemption(facts);
  const checklist: [string, boolean, 1 | 2 | 3][] = [
    [t('flow.close.checks.consents'), done[1], 1],
    [exemption === 'declined' ? t('flow.close.checks.photosDeclined') : exemption === 'bodyOnly' ? t('flow.close.checks.photosBodyOnly') : t('flow.close.checks.photos'), done[2], 2],
    [t('flow.close.checks.marks'), done[3], 3],
  ];
  const amendments = (stored?.sessionNotes ?? []).filter((n) => n.kind === 'amendment');
  const notes = (stored?.sessionNotes ?? []).filter((n) => n.kind === 'note');

  if (closed || voided) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border bg-card p-7 text-center">
          <span className={cn('grid h-14 w-14 place-items-center rounded-full', voided ? 'bg-red-500/12 text-red-600' : 'bg-emerald-500/12 text-emerald-600')}>
            {voided ? <Ban className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
          </span>
          <h2 className="text-xl font-semibold">{voided ? t('flow.close.voidedTitle') : t('flow.close.closedTitle', { number: flow.sessionNumber })}</h2>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            {voided
              ? t('flow.close.voidedLead', { reason: stored?.voidReason ?? '' })
              : t('flow.close.closedLead', { date: stored?.closedAt ? formatUtcDateTime(stored.closedAt) : '', name: stored?.closedByName ?? '' })}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" onClick={() => goToStep(3)}>{t('flow.close.viewMap')}</Button>
            <Button type="button" variant="outline" onClick={() => goToStep(2)}>{t('flow.close.viewPhotos')}</Button>
          </div>
        </div>
        <Summary rows={rows} />
        {closed && (
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
            <h3 className="text-[15px] font-semibold">{t('flow.close.amendments')}</h3>
            <p className="text-xs text-muted-foreground">{t('flow.close.amendmentsHint')}</p>
            {amendments.map((n) => (
              <div key={n.id} className="border-l-2 border-amber-500 py-0.5 pl-2.5 text-[13px]">
                <time className="mr-1.5 text-[11px] text-muted-foreground">{formatUtcDateTime(n.createdAt)}</time>
                {n.body}
                {n.createdByName && <span className="block text-[11px] text-muted-foreground">{n.createdByName}</span>}
              </div>
            ))}
            {canRegister && (
              <>
                <Textarea value={amendment} onChange={(e) => setAmendment(e.target.value)} rows={3} placeholder={t('flow.close.amendmentPlaceholder')} disabled={amend.isPending} />
                <div className="flex justify-end">
                  <Button type="button" onClick={() => amend.run()} disabled={!amendment.trim()} loading={amend.isPending}>{t('flow.close.addAmendment')}</Button>
                </div>
              </>
            )}
          </section>
        )}
        <Activity events={stored?.events ?? []} open={showActivity} onToggle={() => setShowActivity((v) => !v)} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('flow.stepOf', { step: 4 })}</p>
        <h2 className="text-xl font-semibold leading-tight">{t('flow.close.title')}</h2>
        <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">{t('flow.close.lead')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
        {checklist.map(([label, ok, step]) => (
          <button key={label} type="button" className="flex items-center gap-2 text-sm" onClick={() => goToStep(step)}>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', ok ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400')}>
              {ok ? t('flow.close.ok') : t('flow.close.missing')}
            </span>
            {label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Summary rows={rows} />
          <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
            <Label htmlFor="aes-session-summary" className="text-[15px] font-semibold">{t('flow.close.summary')}</Label>
            <p className="text-xs text-muted-foreground">{t('flow.close.summaryHint')}</p>
            <Textarea id="aes-session-summary" value={draft.notes} onChange={(e) => updateDraft({ notes: e.target.value })} rows={4} disabled={readOnly} placeholder={t('session.notesPlaceholder')} />
            {notes.length > 0 && (
              <div className="mt-1 flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('flow.close.sessionNotes')}</p>
                {notes.map((n) => (
                  <p key={n.id} className="border-l-2 border-violet-600 pl-2.5 text-[13px]">
                    <time className="mr-1.5 text-[11px] text-muted-foreground">{formatUtcDateTime(n.createdAt).slice(-5)}</time>{n.body}
                  </p>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2.5 rounded-2xl border bg-card p-4">
            <h3 className="text-[15px] font-semibold">{t('flow.close.lots')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-2 py-1.5 font-medium">{t('point.lot')}</th>
                  <th className="px-2 py-1.5 font-medium">{t('flow.treatment.expiry')}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t('flow.close.consumed')}</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.layer.id} className="border-b last:border-0">
                      <td className="px-2 py-2">{r.layer.lot || <span className="text-muted-foreground">{t('flow.close.noLot')}</span>}<br /><span className="text-xs text-muted-foreground">{r.layer.serviceName}</span></td>
                      <td className={cn('px-2 py-2', r.layer.lotExpiry && r.layer.lotExpiry < draft.date && 'font-semibold text-destructive')}>{r.layer.lotExpiry ? formatDisplayDate(r.layer.lotExpiry) : '—'}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatQuantity(r.total)} {r.layer.unitSymbol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{t('flow.close.stockHint')}</p>
          </section>

          <section className="flex flex-col gap-2.5 rounded-2xl border bg-card p-4">
            <h3 className="text-[15px] font-semibold">{t('flow.close.charge')}</h3>
            {rows.map((r) => (
              <div key={r.layer.id} className="flex items-center gap-2 text-[13px]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{r.layer.serviceName}</span>
                <span className="tabular-nums">{r.config?.price != null ? formatQuantity(r.config.price) : '—'}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 border-t pt-2 text-[13px] font-semibold">
              <span className="flex-1">{t('flow.close.suggestedTotal')}</span>
              <span className="tabular-nums">{formatQuantity(charge)}</span>
            </div>
            {canBill && (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                disabled={!rows.length}
                onClick={() => openBillingWizard({
                  patientId,
                  patientName,
                  isSales: true,
                  preloadedItems: rows.filter((r) => r.layer.serviceId).map((r) => ({
                    tempId: r.layer.id,
                    service_id: r.layer.serviceId!,
                    service_name: r.layer.serviceName,
                    unit_price: r.config?.price ?? 0,
                    quantity: 1,
                    total: r.config?.price ?? 0,
                  })),
                })}
              >
                <Receipt className="mr-1.5 h-4 w-4" />{t('flow.close.bill')}
              </Button>
            )}
          </section>

          <section className="flex flex-col gap-2.5 rounded-2xl border bg-card p-4">
            <h3 className="text-[15px] font-semibold">{t('flow.close.aftercareAndNext')}</h3>
            {aftercare.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">{t('flow.close.aftercareHint', { count: aftercare.length })}</span>
                <Button type="button" size="sm" variant="outline" disabled={!phone} title={phone ? undefined : t('flow.close.noPhone')} onClick={sendAftercare}>
                  <MessageCircle className="mr-1.5 h-4 w-4" />{t('flow.close.sendWhatsApp')}
                </Button>
              </div>
            ) : <p className="text-xs text-muted-foreground">{t('flow.close.noAftercare')}</p>}
            {followUps.length === 0 && <p className="text-xs text-muted-foreground">{t('flow.close.noFollowUp')}</p>}
            {followUps.map((r) => {
              const days = r.config!.followUpDays!;
              const label = r.config!.followUpLabel || t('flow.close.followUpDefault', { service: r.layer.serviceName });
              const isScheduled = scheduled.has(r.layer.id);
              return (
                <div key={r.layer.id} className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[13px] font-semibold">{label}</b>
                    <span className="text-xs text-muted-foreground">{t('flow.close.followUpWhen', { date: formatDisplayDate(addDaysToDate(draft.date, days)), days })}</span>
                  </div>
                  {canSchedule && (
                    <Button type="button" size="sm" variant={isScheduled ? 'outline' : 'default'} disabled={isScheduled} onClick={() => openAppointment(r.layer.id, days, label)}>
                      <CalendarPlus className="mr-1 h-3.5 w-3.5" />{isScheduled ? t('flow.close.scheduled') : t('flow.close.schedule')}
                    </Button>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      </div>

      <Activity events={stored?.events ?? []} open={showActivity} onToggle={() => setShowActivity((v) => !v)} />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto text-xs text-muted-foreground">{ready ? t('flow.close.readyHint') : missingText(t, nextMissing(facts, (l) => l.serviceName))}</span>
        {!readOnly && stored && (
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setVoidOpen(true)}>
            <Ban className="mr-1.5 h-4 w-4" />{t('flow.close.void')}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => goToStep(3)}>{t('flow.close.backToTreatment')}</Button>
        {!readOnly && <Button type="button" onClick={() => setConfirmClose(true)} disabled={!ready}>{t('flow.close.close')}</Button>}
      </div>

      <AlertDialog open={confirmClose} onOpenChange={(open) => { if (!close.isPending) setConfirmClose(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('flow.close.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('flow.close.confirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={close.isPending}>{t('cancel')}</AlertDialogCancel>
            <Button type="button" onClick={() => close.run()} loading={close.isPending}>{t('flow.close.close')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={voidOpen} onOpenChange={(open) => { if (!voidSession.isPending) setVoidOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('flow.close.voidTitle')}</DialogTitle>
            <DialogDescription>{t('flow.close.voidDescription')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="px-6 py-3">
            <Label htmlFor="aes-void-reason" className="text-xs">{t('flow.close.voidReason')}</Label>
            <Textarea id="aes-void-reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3} className="mt-1.5" disabled={voidSession.isPending} />
          </DialogBody>
          <DialogFooter>
            <DialogCancelButton disabled={voidSession.isPending}>{t('cancel')}</DialogCancelButton>
            <Button type="button" variant="destructive" disabled={!voidReason.trim()} loading={voidSession.isPending} onClick={() => voidSession.run()}>{t('flow.close.void')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {appointment && agenda && patient && (
        <AppointmentFormDialog
          open
          onOpenChange={(open) => { if (!open) setAppointment(null); }}
          initialData={{ user: patient, date: appointment.date, summary: appointment.summary }}
          readOnlyFields={{ user: true }}
          calendars={agenda.calendars}
          doctors={agenda.doctors}
          onSaveSuccess={() => {
            setScheduled((s) => new Set(s).add(appointment.layerId));
            setAppointment(null);
            toast({ title: t('flow.close.scheduledToast') });
          }}
        />
      )}
    </div>
  );
}

/** What was applied, by service and zone, with today's photos */
function Summary({ rows }: { rows: { layer: { id: string; serviceName: string; productName: string; lot?: string; unitSymbol: string; marks: unknown[] }; color: string; byZone: [string, number][]; total: number }[] }) {
  const t = useTranslations('AestheticRecord');
  const { stored } = useSessionFlow();
  const photos = PHOTO_VIEWS.map((v) => (stored ? sessionPhotoOf(stored, v) : null)).filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <h3 className="text-[15px] font-semibold">{t('flow.close.applied')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">{t('flow.close.service')}</th>
            <th className="px-2 py-1.5 font-medium">{t('timeline.zones')}</th>
            <th className="px-2 py-1.5 text-right font-medium">{t('flow.close.total')}</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.layer.id} className="border-b align-top last:border-0">
                <td className="px-2 py-2">
                  <span className="flex items-start gap-2">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                    <span>{r.layer.serviceName}<br /><span className="text-xs text-muted-foreground">{[r.layer.productName, r.layer.lot && t('flow.close.lot', { lot: r.layer.lot })].filter(Boolean).join(' · ')}</span></span>
                  </span>
                </td>
                <td className="px-2 py-2">{r.byZone.length ? r.byZone.map(([zone, q]) => <span key={zone} className="block">{zone}: {formatQuantity(q)} {r.layer.unitSymbol}</span>) : <span className="text-muted-foreground">{t('flow.close.noMarks')}</span>}</td>
                <td className="px-2 py-2 text-right tabular-nums"><b>{formatQuantity(r.total)} {r.layer.unitSymbol}</b><br /><span className="text-xs text-muted-foreground">{t('layers.marks', { count: r.layer.marks.length })}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {photos.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('flow.close.todayPhotos')}</p>
          <div className="flex flex-wrap gap-2">{photos.map((p) => <Thumb key={p.id} id={p.id} alt={t(`views.${p.view}`)} />)}</div>
        </div>
      )}
    </section>
  );
}

function Thumb({ id, alt }: { id: string; alt: string }) {
  const url = useAestheticFileUrl(id);
  // eslint-disable-next-line @next/next/no-img-element -- stored photo (object URL)
  return url ? <img src={url} alt={alt} className="h-24 w-[76px] rounded-lg bg-muted object-cover" /> : <span className="h-24 w-[76px] rounded-lg bg-muted" />;
}

/** Signatures, photos, notes, closing: who and when */
function Activity({ events, open, onToggle }: { events: AestheticSessionEvent[]; open: boolean; onToggle: () => void }) {
  const t = useTranslations('AestheticRecord');
  if (!events.length) return null;
  return (
    <section className="rounded-2xl border bg-card">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-left text-[15px] font-semibold">
        {t('flow.close.activity')}
        <span className="text-xs font-normal text-muted-foreground">{t('flow.close.activityCount', { count: events.length })}</span>
        <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ol className="flex flex-col gap-1.5 border-t px-4 py-3">
          {[...events].reverse().map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-2 text-xs">
              <time className="w-32 shrink-0 text-muted-foreground">{formatUtcDateTime(e.at)}</time>
              <span className="min-w-0 flex-1">
                {t(`flow.events.${e.type}`, {
                  service: String(e.payload.serviceName ?? ''),
                  view: e.payload.view ? t(`views.${String(e.payload.view)}`) : '',
                })}
              </span>
              {e.actorName && <span className="text-muted-foreground">{e.actorName}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

