'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResizableSheet, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PatientDetailSheet } from '@/components/appointments/PatientDetailSheet';
import { DoctorDetailSheet } from '@/components/appointments/DoctorDetailSheet';
import { QuoteDetailSheet } from '@/components/appointments/QuoteDetailSheet';
import { InvoiceDetailSheet } from '@/components/appointments/InvoiceDetailSheet';
import { AppointmentStatusMenu } from '@/components/appointments/AppointmentStatusMenu';
import {
  ALLOWED_STATUS_TRANSITIONS,
  CANCELLATION_REASONS_QUICK,
  STATUS_ACCENT_COLOR,
  canDelete,
  canReschedule,
} from '@/constants/appointment-status';
import { STATUS_ICONS } from '@/components/appointments/status-icons';
import { cn } from '@/lib/utils';
import { Appointment, AppointmentStatus, Invoice, Order, PatientSession } from '@/lib/types';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import {
  CalendarClock, FileText, Stethoscope,
  Edit, Trash2, Loader2, ClipboardList,
  Clock, Calendar as CalendarIcon, StickyNote,
  UserSquare, Layers, ChevronRight, RefreshCw, Ban,
  CalendarSync, MessageSquare,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

interface InfoCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
}

function InfoCard({ icon: Icon, label, value, onClick }: InfoCardProps) {
  const isInteractive = !!onClick;
  const Wrap: any = isInteractive ? 'button' : 'div';
  return (
    <Wrap
      type={isInteractive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-lg border border-border/60 bg-card p-3 text-left flex flex-col gap-1.5',
        isInteractive && 'hover:bg-muted/50 transition-colors cursor-pointer',
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="text-base font-semibold truncate">{value}</div>
    </Wrap>
  );
}

interface AppointmentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  linkedSession: PatientSession | null;
  isLoadingLinkedSession: boolean;
  quoteOrder: Order | null;
  quoteInvoices: Invoice[];
  isLoadingQuoteInfo: boolean;
  /** Doctor color for the doctor avatar */
  doctorColor?: string;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onOpenClinicSession: (appointment: Appointment) => void;
  onReschedule?: (appointment: Appointment) => void;
  onStatusChange: (
    appointment: Appointment,
    newStatus: AppointmentStatus,
    extra?: { cancellation_reason?: import('@/lib/types').CancellationReason; cancellation_note?: string },
  ) => void;
  onRequestCustomCancellation?: (appointment: Appointment) => void;
}

export function AppointmentPanel({
  open,
  onOpenChange,
  appointment,
  linkedSession,
  isLoadingLinkedSession,
  quoteOrder,
  quoteInvoices,
  isLoadingQuoteInfo,
  doctorColor,
  onEdit,
  onCancel,
  onOpenClinicSession,
  onReschedule,
  onStatusChange,
  onRequestCustomCancellation,
}: AppointmentPanelProps) {
  const t = useTranslations('AppointmentsPage');
  const tColumns = useTranslations('AppointmentsColumns');
  const tStatus = useTranslations('AppointmentStatus');
  const tStatusMenu = useTranslations('AppointmentStatusMenu');
  const tReschedule = useTranslations('AppointmentReschedule');
  const tReason = useTranslations('CancellationReason');
  const tPanel = useTranslations('AppointmentPanel');

  const [activeTab, setActiveTab] = React.useState('info');
  const [isPatientSheetOpen, setIsPatientSheetOpen] = React.useState(false);
  const [isDoctorSheetOpen, setIsDoctorSheetOpen] = React.useState(false);
  const [isQuoteSheetOpen, setIsQuoteSheetOpen] = React.useState(false);
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);

  // Reset to info tab when a different appointment is opened
  React.useEffect(() => {
    if (open) setActiveTab('info');
  }, [open, appointment?.id]);

  if (!appointment) return null;

  const serviceName = appointment.services && appointment.services.length > 0
    ? appointment.services.map(s => s.name).join(', ')
    : appointment.service_name || '';

  const startDt = appointment.start?.dateTime ? parseISO(appointment.start.dateTime.replace(/Z$/, '')) : null;
  const endDt = appointment.end?.dateTime ? parseISO(appointment.end.dateTime.replace(/Z$/, '')) : null;
  const durationMin = startDt && endDt ? differenceInMinutes(endDt, startDt) : null;
  const isCancelled = appointment.status === 'cancelled';
  const isRescheduled = isCancelled && appointment.cancellation_reason === 'reschedule';

  // Quick-action buttons shown in the footer, filtered by the allowed transitions.
  // Icons come from STATUS_ICONS to stay in sync with the calendar / status menu.
  const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[appointment.status] ?? [];
  const QUICK_ACTIONS: Array<{
    status: AppointmentStatus;
    variant: 'default' | 'outline' | 'destructive';
    iconOnly?: boolean;
  }> = [
    { status: 'scheduled',   variant: 'outline' },
    { status: 'confirmed',   variant: 'default' },
    { status: 'arrived',     variant: 'default' },
    { status: 'in_progress', variant: 'outline' },
    { status: 'completed',   variant: 'default' },
    { status: 'no_show',     variant: 'destructive', iconOnly: true },
  ];
  const visibleQuickActions = QUICK_ACTIONS.filter((q) => allowedTransitions.includes(q.status));

  return (
    <>
      <ResizableSheet
        open={open}
        onOpenChange={onOpenChange}
        defaultWidth={780}
        minWidth={480}
        maxWidth={1200}
        storageKey="appointment-panel-width"
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header — single row: avatar + name/subtitle (truncate) + status badge.
              `pr-20` reserves room for the sheet's maximize + close buttons. */}
          <div className="flex-none border-b border-border bg-card px-5 py-3 pr-20 space-y-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => appointment.patientId && setIsPatientSheetOpen(true)}
                className="shrink-0 focus:outline-none focus:ring-2 focus:ring-ring rounded-full"
                aria-label={tPanel('openPatient')}
                disabled={!appointment.patientId}
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                    {initials(appointment.patientName)}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="min-w-0 flex-1">
                <SheetTitle asChild>
                  <button
                    type="button"
                    onClick={() => appointment.patientId && setIsPatientSheetOpen(true)}
                    disabled={!appointment.patientId}
                    className={cn(
                      'text-sm font-semibold leading-tight text-left truncate w-full',
                      appointment.patientId && 'hover:underline underline-offset-2',
                    )}
                  >
                    {appointment.patientName}
                  </button>
                </SheetTitle>
                {serviceName && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{serviceName}</p>
                )}
                <SheetDescription className="sr-only">{t('panelTabs.info')}</SheetDescription>
              </div>
              <div className="shrink-0">
                <AppointmentStatusMenu
                  appointment={appointment}
                  onChange={(s, extra) => onStatusChange(appointment, s, extra)}
                  onRequestCustomCancellation={
                    onRequestCustomCancellation
                      ? () => onRequestCustomCancellation(appointment)
                      : undefined
                  }
                />
              </div>
            </div>

            {isRescheduled && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground italic">
                  <RefreshCw className="h-3 w-3" />
                  {tReschedule('rescheduledLabel')}
                </span>
              </div>
            )}
          </div>

          {/* Body — horizontal tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden min-h-0">
            <TabsList className="flex-none w-full justify-start rounded-none border-b border-border bg-transparent px-4 h-auto py-0 gap-1">
              <TabsTrigger
                value="info"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-3 py-2.5 text-sm font-medium"
              >
                {t('panelTabs.info')}
              </TabsTrigger>
              <TabsTrigger
                value="session"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-3 py-2.5 text-sm font-medium"
              >
                {t('linkedSession')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="flex-1 overflow-auto p-4 space-y-3 mt-0 data-[state=inactive]:hidden">
              <div className="grid grid-cols-2 gap-2.5">
                <InfoCard
                  icon={CalendarIcon}
                  label={tColumns('date')}
                  value={format(parseISO(appointment.date), 'dd/MM/yyyy')}
                />
                <InfoCard
                  icon={Clock}
                  label={tColumns('time')}
                  value={
                    <span className="flex items-baseline gap-1.5">
                      <span>{appointment.time}{endDt ? ` → ${format(endDt, 'HH:mm')}` : ''}</span>
                      {durationMin != null && durationMin > 0 && (
                        <span className="text-xs text-muted-foreground font-medium">
                          {tPanel('durationMinutes', { minutes: durationMin })}
                        </span>
                      )}
                    </span>
                  }
                />
                <InfoCard
                  icon={CalendarClock}
                  label={tColumns('calendar')}
                  value={appointment.calendar_name || '—'}
                />
                <InfoCard
                  icon={UserSquare}
                  label={tColumns('doctor')}
                  value={appointment.doctorName || '—'}
                  onClick={appointment.doctorId ? () => setIsDoctorSheetOpen(true) : undefined}
                />
              </div>

              {/* Services list — one line per service */}
              {appointment.services && appointment.services.length > 0 && (
                <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    <Layers className="h-3.5 w-3.5" />
                    <span>{tPanel('servicesLabel')}</span>
                  </div>
                  <ul className="space-y-1">
                    {appointment.services.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                        <span className="truncate">{s.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Linked quote — opens the QuoteDetailSheet on click */}
              {appointment.quote_id && (
                <button
                  type="button"
                  onClick={() => setIsQuoteSheetOpen(true)}
                  className="w-full rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition-colors p-3 text-left flex items-center gap-3"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {tColumns('quoteDocNo')}
                    </p>
                    <p className="text-sm font-semibold font-mono truncate">
                      {appointment.quote_doc_no || appointment.quote_id}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )}

              {/* Notes — yellow tinted card, only when populated */}
              {appointment.notes && (
                <div className="rounded-lg border-l-4 border-l-amber-400 border border-amber-200/70 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-800/40 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                    <StickyNote className="h-3.5 w-3.5 shrink-0" />
                    {t('contextMenu.notes')}
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/80 italic">
                    {appointment.notes}
                  </p>
                </div>
              )}

              {/* Cancellation details */}
              {isCancelled && appointment.cancellation_reason && (
                <div className="rounded-lg border-l-4 border-l-destructive border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive uppercase tracking-wide">
                    <Ban className="h-3.5 w-3.5 shrink-0" />
                    {tPanel('cancellationReasonLabel')}: {tReason(appointment.cancellation_reason)}
                  </div>
                  {appointment.cancellation_note && (
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                      <span className="text-xs text-muted-foreground">{tPanel('cancellationNoteLabel')}: </span>
                      {appointment.cancellation_note}
                    </p>
                  )}
                </div>
              )}

              {/* Treatment plan link */}
              {appointment.treatment_seq_step_id != null && (
                <button
                  type="button"
                  onClick={() => { /* Placeholder: link target TBD */ }}
                  className="w-full rounded-lg border border-dashed border-border bg-card hover:bg-muted/40 transition-colors p-3 flex items-center gap-3 text-left"
                >
                  <ClipboardList className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{t('treatmentSequence.title')}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t('treatmentSequence.stepRef', { id: appointment.treatment_seq_step_id })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )}
            </TabsContent>

            <TabsContent value="session" className="flex-1 overflow-auto p-4 space-y-3 mt-0 data-[state=inactive]:hidden">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t('linkedSession')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => onOpenClinicSession(appointment)}
                >
                  <Stethoscope className="h-3.5 w-3.5" />
                  {linkedSession ? t('editSession') : t('createSession')}
                </Button>
              </div>
              {isLoadingLinkedSession ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : linkedSession ? (
                <div className="rounded-xl border border-border p-3 space-y-1.5 text-sm bg-muted/20">
                  <div className="flex gap-2">
                    <span className="font-medium text-xs text-muted-foreground">{t('createDialog.date')}:</span>
                    <span>{linkedSession.fecha_sesion ? format(parseISO(linkedSession.fecha_sesion), 'dd/MM/yyyy') : '—'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-medium text-xs text-muted-foreground">{tColumns('doctor')}:</span>
                    <span>{linkedSession.doctor_name || '—'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-medium text-xs text-muted-foreground">{t('procedure')}:</span>
                    <span className="truncate">{linkedSession.procedimiento_realizado || '—'}</span>
                  </div>
                  {linkedSession.notas_clinicas && (
                    <div className="flex gap-2">
                      <span className="font-medium text-xs text-muted-foreground">{t('contextMenu.notes')}:</span>
                      <span className="text-muted-foreground line-clamp-3">{linkedSession.notas_clinicas}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">{t('noLinkedSession')}</p>
              )}
            </TabsContent>
          </Tabs>

          {/* Sticky footer — two rows of actions */}
          <div className="flex-none border-t border-border bg-card px-4 py-3 space-y-2">
            {visibleQuickActions.length > 0 && (
              <div className="grid grid-flow-col auto-cols-fr gap-2">
                {visibleQuickActions.map(({ status, variant, iconOnly }) => {
                  const Icon = STATUS_ICONS[status];
                  const label = tStatus(status);
                  return (
                    <Button
                      key={status}
                      size="sm"
                      variant={variant}
                      className={cn('gap-1.5 h-9', iconOnly && 'px-2 max-w-[44px] justify-self-end')}
                      onClick={() => onStatusChange(appointment, status)}
                      title={iconOnly ? label : undefined}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.5} />
                      {!iconOnly && <span className="truncate">{label}</span>}
                    </Button>
                  );
                })}
              </div>
            )}
            {(() => {
              const showCancel = allowedTransitions.includes('cancelled');
              const showDelete = canDelete(appointment.status);
              const buttonCount = 2 + (showCancel ? 1 : 0) + (showDelete ? 1 : 0);
              return (
                <div
                  className={cn(
                    'grid gap-2',
                    buttonCount === 4 && 'grid-cols-4',
                    buttonCount === 3 && 'grid-cols-3',
                    buttonCount === 2 && 'grid-cols-2',
                  )}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-9"
                    onClick={() => { onEdit(appointment); onOpenChange(false); }}
                  >
                    <Edit className="h-3.5 w-3.5" />
                    {tColumns('edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-9"
                    disabled={!onReschedule || !canReschedule(appointment.status)}
                    title={!canReschedule(appointment.status)
                      ? tReschedule('blockedTooltip', { status: tStatus(appointment.status) })
                      : undefined}
                    onClick={() => { onReschedule?.(appointment); onOpenChange(false); }}
                  >
                    <CalendarSync className="h-3.5 w-3.5" />
                    {tReschedule('action')}
                  </Button>
                  {showCancel && (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-9 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          {tColumns('cancel')}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                        {CANCELLATION_REASONS_QUICK.map((reason) => (
                          <DropdownMenuItem
                            key={reason}
                            onSelect={(e) => {
                              e.preventDefault();
                              onStatusChange(appointment, 'cancelled', { cancellation_reason: reason });
                            }}
                            className="gap-2 text-sm"
                          >
                            <span
                              aria-hidden
                              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: STATUS_ACCENT_COLOR.cancelled }}
                            />
                            <span>{tReason(reason)}</span>
                          </DropdownMenuItem>
                        ))}
                        {onRequestCustomCancellation && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                onRequestCustomCancellation(appointment);
                              }}
                              className="gap-2 text-sm"
                            >
                              <span
                                aria-hidden
                                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: STATUS_ACCENT_COLOR.cancelled }}
                              />
                              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                              <span>{tStatusMenu('otherReason')}</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {showDelete && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-9 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => { onCancel(appointment); onOpenChange(false); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {tPanel('delete')}
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </ResizableSheet>

      {/* Sub-sheets — managed internally */}
      {appointment.patientId && (
        <PatientDetailSheet
          open={isPatientSheetOpen}
          onOpenChange={setIsPatientSheetOpen}
          userId={appointment.patientId}
          userName={appointment.patientName}
          userEmail={appointment.patientEmail}
          userPhone={appointment.patientPhone}
        />
      )}
      {appointment.doctorId && (
        <DoctorDetailSheet
          open={isDoctorSheetOpen}
          onOpenChange={setIsDoctorSheetOpen}
          doctorId={appointment.doctorId}
          doctorName={appointment.doctorName ?? ''}
          doctorColor={doctorColor}
        />
      )}
      {appointment.quote_id && (
        <QuoteDetailSheet
          open={isQuoteSheetOpen}
          onOpenChange={setIsQuoteSheetOpen}
          quoteId={appointment.quote_id}
          quoteDocNo={appointment.quote_doc_no}
          patientName={appointment.patientName}
        />
      )}
      {selectedInvoice && (
        <InvoiceDetailSheet
          open={!!selectedInvoice}
          onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}
          invoice={selectedInvoice}
        />
      )}
    </>
  );
}
