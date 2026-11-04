'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Ban, CalendarPlus, CheckCircle2, History, Info, MessageCircle } from 'lucide-react';

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
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { useAsyncAction } from '@/hooks/use-async-action';
import { usePanelWidth } from '@/hooks/use-panel-width';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { fetchReassignCalendars, fetchReassignDoctors } from '@/lib/appointment-reassign';
import { cn, formatDisplayDate, formatUtcDateTime } from '@/lib/utils';
import { addAestheticNote, closeAestheticSession, voidAestheticSession } from '@/services/aesthetic-record';

import type { AestheticSessionEvent, Calendar as CalendarType, User } from '@/lib/types';
import { isSessionLockedError } from './aesthetic-errors';
import { Hint } from './hint';
import { formatQuantity, layerColor, layerLots, layerQuantity, type LayerLot } from './layers';
import { PHOTO_VIEWS, sessionPhotoOf } from './photo-utils';
import { SessionBillingCard, type BillingItem } from './session-billing-card';
import { useSessionFlow } from './session-flow-context';
import { addDaysToDate, missingText, nextMissing, photoExemption } from './session-status';
import { useAestheticFileUrl } from './use-aesthetic-file-url';
import { useZoneLabel } from './use-zone-label';

/** Panel width from which the step fits in two columns without moving the page */
const TWO_COLUMNS_WIDTH = 760;
/** Panel width under which it is a phone */
const COMPACT_WIDTH = 640;

export function StepClose() {
  const t = useTranslations('AestheticRecord');
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
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
  const rootRef = React.useRef<HTMLDivElement>(null);
  const width = usePanelWidth(rootRef);
  const columns = width === 0 || width >= TWO_COLUMNS_WIDTH ? 2 : 1;
  const compact = width > 0 && width < COMPACT_WIDTH;

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
    return { layer, color: layerColor(layer, index), byZone: [...byZone.entries()], total: layerQuantity(layer), lots: layerLots(layer), config: configFor(layer) };
  });
  const billingItems: BillingItem[] = rows.map((r) => ({ id: r.layer.id, serviceId: r.layer.serviceId, name: r.layer.serviceName, color: r.color, price: r.config?.price ?? null }));
  const aftercare = rows.filter((r) => r.config?.aftercare);
  const followUps = rows.filter((r) => r.config?.followUpDays);
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
    [t('flow.close.checks.photos'), done[2], 2],
    [t('flow.close.checks.marks'), done[3], 3],
  ];
  const stillMissing = checklist.filter(([, ok]) => !ok);
  const photoNote = exemption === 'declined' ? t('flow.close.checks.photosDeclined') : exemption === 'bodyOnly' ? t('flow.close.checks.photosBodyOnly') : undefined;
  const amendments = (stored?.sessionNotes ?? []).filter((n) => n.kind === 'amendment');
  const notes = (stored?.sessionNotes ?? []).filter((n) => n.kind === 'note');

  // With room, the page stays still and only a column that doesn't fit scrolls
  const column = cn('flex min-w-0 flex-col gap-3.5', columns > 1 && 'min-h-0 basis-0 overflow-y-auto');
  const body = cn('flex min-h-0 flex-1 gap-3.5 p-3.5', columns === 1 ? 'flex-col overflow-y-auto' : 'flex-row');

  if (closed || voided) {
    return (
      <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-card px-3.5 py-2.5">
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', voided ? 'bg-red-500/12 text-red-600' : 'bg-emerald-500/12 text-emerald-600')}>
            {voided ? <Ban className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-[1_1_16rem]">
            <h2 className="text-base font-semibold leading-tight">{voided ? t('flow.close.voidedTitle') : t('flow.close.closedTitle', { number: flow.sessionNumber })}</h2>
            <p className="text-xs text-muted-foreground">
              {voided
                ? t('flow.close.voidedLead', { reason: stored?.voidReason ?? '' })
                : t('flow.close.closedLead', { date: stored?.closedAt ? formatUtcDateTime(stored.closedAt) : '', name: stored?.closedByName ?? '' })}
            </p>
          </div>
          <div className={cn('flex gap-2', compact ? 'basis-full' : 'flex-wrap')}>
            <ActivityButton events={stored?.events ?? []} iconOnly={compact} />
            <Button type="button" size="sm" variant="outline" className={cn(compact && 'h-10 min-w-0 flex-1')} onClick={() => goToStep(3)}>{t('flow.close.viewMap')}</Button>
            <Button type="button" size="sm" variant="outline" className={cn(compact && 'h-10 min-w-0 flex-1')} onClick={() => goToStep(2)}>{t('flow.close.viewPhotos')}</Button>
          </div>
        </div>
        <div className={body}>
          <div className={cn(column, columns > 1 && 'flex-[3]')}>
            <Summary rows={rows} note={photoNote} inlineHint={compact} />
          </div>
          {(closed || stored?.invoice) && (
            <div className={cn(column, columns > 1 && 'flex-[2]')}>
              <SessionBillingCard items={billingItems} />
              {closed && <section className="flex flex-col gap-2.5 rounded-2xl border bg-card p-3.5">
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
              </section>}
            </div>
          )}
        </div>
      </div>
    );
  }

  const appliedCard = <Summary rows={rows} note={photoNote} inlineHint={compact} />;
  const summaryCard = (
    <section className="flex flex-[1_0_auto] flex-col gap-2 rounded-2xl border bg-card p-3.5">
      <Label htmlFor="aes-session-summary" className="text-[15px] font-semibold">{t('flow.close.summary')}</Label>
      <p className="text-xs text-muted-foreground">{t('flow.close.summaryHint')}</p>
      {/* With two columns the field takes the room left in the card (Textarea wraps it in its own div) */}
      <div className={cn(columns > 1 && 'relative min-h-24 flex-1 [&>div]:absolute [&>div]:inset-0 [&_textarea]:h-full')}>
        <Textarea id="aes-session-summary" value={draft.notes} onChange={(e) => updateDraft({ notes: e.target.value })} rows={3} disabled={readOnly} placeholder={t('session.notesPlaceholder')} className={cn('resize-none', columns === 1 && 'max-h-64 min-h-24 [field-sizing:content]')} />
      </div>
      {notes.length > 0 && (
        <div className="flex max-h-40 shrink-0 flex-col gap-1.5 overflow-y-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('flow.close.sessionNotes')}</p>
          {notes.map((n) => (
            <p key={n.id} className="border-l-2 border-violet-600 pl-2.5 text-[13px]">
              <time className="mr-1.5 text-[11px] text-muted-foreground">{formatUtcDateTime(n.createdAt).slice(-5)}</time>{n.body}
            </p>
          ))}
        </div>
      )}
    </section>
  );
  const billingCard = <SessionBillingCard items={billingItems} />;
  const nextCard = (
    <section className="flex flex-col gap-2 rounded-2xl border bg-card p-3.5">
      <h3 className="text-[15px] font-semibold">{t('flow.close.aftercareAndNext')}</h3>
      {aftercare.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-[1_1_10rem] text-xs text-muted-foreground">{t('flow.close.aftercareHint', { count: aftercare.length })}</span>
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
          <div key={r.layer.id} className="flex items-center gap-2.5 rounded-xl border px-3 py-2">
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
  );

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      <h2 className="sr-only">{t('flow.close.title')}</h2>

      {/* Only what is missing: what is done already shows in the header's steps */}
      {stillMissing.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b bg-amber-500/10 px-3.5 py-2">
          {stillMissing.map(([label, , step]) => (
            <button key={label} type="button" className="flex items-center gap-2 text-[13px] hover:underline" onClick={() => goToStep(step)}>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">{t('flow.close.missing')}</span>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={body}>
        {columns === 2 && (
          <>
            <div className={cn(column, 'flex-1')}>{appliedCard}{nextCard}</div>
            <div className={cn(column, 'flex-1')}>{summaryCard}{billingCard}</div>
          </>
        )}
        {columns === 1 && <>{appliedCard}{summaryCard}{billingCard}{nextCard}</>}
      </div>

      <div className={cn('flex shrink-0 flex-wrap items-center justify-end border-t bg-card px-3.5 py-2.5', compact ? 'gap-2 px-2.5 py-2' : 'gap-x-3 gap-y-2')}>
        <span className={cn('min-w-0 text-xs text-muted-foreground', compact && 'basis-full text-[11px] leading-snug')}>{ready ? t('flow.close.readyHint') : missingText(t, nextMissing(facts, (l) => l.serviceName))}</span>
        <ActivityButton events={stored?.events ?? []} iconOnly={compact} />
        {!compact && <span className="flex-1" />}
        {!readOnly && stored && (compact ? (
          <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0 text-destructive hover:text-destructive" aria-label={t('flow.close.void')} onClick={() => setVoidOpen(true)}>
            <Ban className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setVoidOpen(true)}>
            <Ban className="mr-1.5 h-4 w-4" />{t('flow.close.void')}
          </Button>
        ))}
        <Button type="button" variant="outline" className={cn(compact && 'h-10 min-w-0 flex-1 px-2')} onClick={() => goToStep(3)}>{compact ? t('flow.back') : t('flow.close.backToTreatment')}</Button>
        {!readOnly && <Button type="button" className={cn(compact && 'h-10 min-w-0 flex-1 px-2')} onClick={() => setConfirmClose(true)} disabled={!ready}>{t('flow.close.close')}</Button>}
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

/** What was applied: each service with its zones and total, the lots it used and today's photos */
function Summary({ rows, note, inlineHint }: { inlineHint?: boolean; rows: { layer: { id: string; serviceName: string; unitSymbol: string; marks: unknown[] }; color: string; byZone: [string, number][]; total: number; lots: LayerLot[] }[]; note?: string }) {
  const t = useTranslations('AestheticRecord');
  const { stored, draft } = useSessionFlow();
  const photos = PHOTO_VIEWS.map((v) => (stored ? sessionPhotoOf(stored, v) : null)).filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <section className="flex flex-[1_0_auto] flex-col gap-2.5 rounded-2xl border bg-card p-3.5">
      <div className="flex items-center gap-1.5">
        <h3 className="text-[15px] font-semibold">{t('flow.close.applied')}</h3>
        {!inlineHint && (
          <Hint label={t('flow.close.lots')} description={t('flow.close.stockHint')}>
            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t('flow.close.stockHint')}><Info className="h-3.5 w-3.5" /></button>
          </Hint>
        )}
      </div>
      {/* No hover on a phone: the note is plain text there */}
      {inlineHint && <p className="text-xs text-muted-foreground">{t('flow.close.stockHint')}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-1.5 py-1 font-medium">{t('point.lot')}</th>
            <th className="px-1.5 py-1 font-medium">{t('flow.treatment.expiry')}</th>
            <th className="px-1.5 py-1 text-right font-medium">{t('flow.close.consumed')}</th>
          </tr></thead>
          {rows.map((r) => (
            <tbody key={r.layer.id} className="border-b last:border-0">
              <tr className="align-top">
                <td colSpan={2} className="px-1.5 pb-0.5 pt-2">
                  <span className="flex items-start gap-2">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                    <span className="min-w-0">
                      <b className="font-semibold">{r.layer.serviceName}</b>
                      <span className="block text-xs text-muted-foreground">
                        {r.byZone.length ? r.byZone.map(([zone, q]) => `${zone}: ${formatQuantity(q)} ${r.layer.unitSymbol}`).join(' · ') : t('flow.close.noMarks')}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-1.5 pb-0.5 pt-2 text-right tabular-nums">
                  <b>{formatQuantity(r.total)} {r.layer.unitSymbol}</b>
                  <span className="block text-xs text-muted-foreground">{t('layers.marks', { count: r.layer.marks.length })}</span>
                </td>
              </tr>
              {r.lots.filter((lot) => r.layer.marks.length > 0 || lot.lot || lot.productName).map((lot) => (
                <tr key={lot.key} className="text-xs last:[&>td]:pb-2">
                  <td className="py-0.5 pl-6 pr-1.5">
                    {lot.lot || <span className="text-muted-foreground">{t('flow.close.noLot')}</span>}
                    {lot.productName && <span className="text-muted-foreground"> · {lot.productName}</span>}
                  </td>
                  <td className={cn('whitespace-nowrap px-1.5 py-0.5', lot.lotExpiry && lot.lotExpiry < draft.date && 'font-semibold text-destructive')}>{lot.lotExpiry ? formatDisplayDate(lot.lotExpiry) : '—'}</td>
                  <td className="whitespace-nowrap px-1.5 py-0.5 text-right tabular-nums">{formatQuantity(lot.quantity)} {r.layer.unitSymbol}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
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
  return url ? <img src={url} alt={alt} className="h-20 w-16 rounded-lg bg-muted object-cover" /> : <span className="h-20 w-16 rounded-lg bg-muted" />;
}

/** Signatures, photos, notes, closing: who and when, one click away */
function ActivityButton({ events, iconOnly }: { events: AestheticSessionEvent[]; iconOnly?: boolean }) {
  const t = useTranslations('AestheticRecord');
  const [open, setOpen] = React.useState(false);
  if (!events.length) return null;
  return (
    <>
      {iconOnly ? (
        <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" aria-label={`${t('flow.close.activity')} (${events.length})`} onClick={() => setOpen(true)}>
          <History className="h-4 w-4" />
        </Button>
      ) : (
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setOpen(true)}>
          <History className="mr-1 h-3.5 w-3.5" />{t('flow.close.activity')} ({events.length})
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('flow.close.activity')}</DialogTitle>
            <DialogDescription>{t('flow.close.activityCount', { count: events.length })}</DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[60vh] overflow-y-auto px-6 py-3">
            <ol className="flex flex-col gap-1.5">
              {[...events].reverse().map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-2 text-xs">
                  <time className="w-32 shrink-0 text-muted-foreground">{formatUtcDateTime(e.at)}</time>
                  <span className="min-w-0 flex-1">
                    {t(`flow.events.${e.type}`, {
                      service: String(e.payload.serviceName ?? ''),
                      view: e.payload.view ? t(`views.${String(e.payload.view)}`) : '',
                      doc: String(e.payload.docNo ?? ''),
                    })}
                  </span>
                  {e.actorName && <span className="text-muted-foreground">{e.actorName}</span>}
                </li>
              ))}
            </ol>
          </DialogBody>
          <DialogFooter>
            <DialogCancelButton>{t('flow.closeDialog')}</DialogCancelButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
