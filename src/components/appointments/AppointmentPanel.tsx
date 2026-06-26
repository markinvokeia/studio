'use client';

import * as React from 'react';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import {
  ArrowRight,
  Calendar as CalendarIcon,
  CalendarSync,
  Clock,
  CreditCard,
  Edit,
  FileText,
  HeartPulse,
  Info,
  Layers,
  Loader2,
  MapPin,
  StickyNote,
  Stethoscope,
  Trash2,
  UserRound,
  UserSquare,
  Zap,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ResizableSheet, SheetDescription, SheetTitle } from '@/components/ui/resizable-sheet';
import { useToast } from '@/hooks/use-toast';
import { STATUS_ACCENT_COLOR, canReschedule } from '@/constants/appointment-status';
import { formatDisplayDate, cn, formatServicePrice } from '@/lib/utils';
import type { Appointment, AppointmentStatus, Calendar as CalendarType, Invoice, Order, PatientSession, User } from '@/lib/types';

import { DoctorDetailSheet } from '@/components/appointments/DoctorDetailSheet';
import { InlineEntityPicker } from '@/components/appointments/InlineEntityPicker';
import { QuoteDetailSheet } from '@/components/appointments/QuoteDetailSheet';
import { AppointmentStatusRail, type StatusChangeExtra } from '@/components/appointments/AppointmentStatusRail';
import { getStatusIcon } from '@/components/appointments/status-icons';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import { usePatientView } from '@/stores/patient-view-store';
import { useAccountStatement } from '@/stores/account-statement-store';
import { fetchAppointmentBillingState } from '@/services/billing-preflight';
import {
  fetchReassignCalendars,
  fetchReassignDoctors,
  reassignAppointmentField,
} from '@/lib/appointment-reassign';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

function parseLocalDateTime(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;

  const localValue = value.replace(/Z$/, '');
  const parsed = parseISO(localValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function timeFromDateTime(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : format(value, 'HH:mm');
  if (typeof value !== 'string') return null;

  const timePart = value.replace(/Z$/, '').split('T')[1];
  return timePart ? timePart.slice(0, 5) : null;
}

function openInNewTab(path: string) {
  const url = new URL(path, window.location.origin);
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

function useCanOpenDetailDeepLinks() {
  const [canOpenDetailDeepLinks, setCanOpenDetailDeepLinks] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setCanOpenDetailDeepLinks(media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return canOpenDetailDeepLinks;
}

interface DetailRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'warning';
  className?: string;
}

function DetailRow({ icon: Icon, label, value, detail, onClick, tone = 'default', className }: DetailRowProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border/70 py-3 text-left',
        onClick && 'transition-colors hover:bg-muted/20',
        className,
      )}
    >
      <span
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
          tone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-muted/60 text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="block text-sm font-semibold leading-snug text-foreground">{value}</span>
        {detail && <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>}
      </span>
    </Component>
  );
}

interface EditableDetailRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  onValueClick?: () => void;
  editLabel: string;
  isEditing: boolean;
  onEditingChange: (open: boolean) => void;
  /** Floating picker rendered in the popover anchored below the value. */
  picker: React.ReactNode;
  className?: string;
}

/**
 * A DetailRow whose value can be quick-edited via a floating dropdown picker
 * anchored directly below the value. Opening is toggled by a trailing pencil
 * button; selecting an option closes the popover.
 */
function EditableDetailRow({
  icon: Icon,
  label,
  value,
  detail,
  onValueClick,
  editLabel,
  isEditing,
  onEditingChange,
  picker,
  className,
}: EditableDetailRowProps) {
  return (
    <Popover open={isEditing} onOpenChange={onEditingChange}>
      <div className={cn('flex w-full items-center gap-3 border-b border-border/70 py-3 text-left', className)}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted/60 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <PopoverAnchor asChild>
          <button
            type="button"
            onClick={onValueClick}
            disabled={!onValueClick}
            className={cn('min-w-0 flex-1 text-left', onValueClick && 'transition-colors hover:opacity-80')}
          >
            <span className="block text-xs font-medium text-muted-foreground">{label}</span>
            <span className="block text-sm font-semibold leading-snug text-foreground">{value}</span>
            {detail && <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>}
          </button>
        </PopoverAnchor>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8 shrink-0 text-muted-foreground', isEditing && 'bg-muted text-foreground')}
          onClick={() => onEditingChange(!isEditing)}
          title={editLabel}
          aria-label={editLabel}
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
      </div>
      <PopoverContent align="start" sideOffset={6} className="w-72 p-0">
        {picker}
      </PopoverContent>
    </Popover>
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
  doctorColor?: string;
  onEdit?: (appointment: Appointment) => void;
  /** Soft-deletes the appointment (status → 'deleted') and removes it from the calendar. */
  onDelete?: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment) => void;
  onOpenClinicSession?: (appointment: Appointment) => void;
  onReschedule?: (appointment: Appointment) => void;
  onBillingSuccess?: () => void;
  hideBillingAction?: boolean;
  onStatusChange: (
    appointment: Appointment,
    newStatus: AppointmentStatus,
    extra?: StatusChangeExtra,
  ) => void;
  onRequestCustomCancellation?: (appointment: Appointment) => void;
  /** Doctors offered in the quick-edit picker. Fetched lazily when omitted. */
  doctors?: User[];
  /** Rooms (calendars) offered in the quick-edit picker. Fetched lazily when omitted. */
  calendars?: CalendarType[];
  /** Called after a successful inline doctor/room reassignment so parents can sync state. */
  onAppointmentUpdated?: (appointment: Appointment) => void;
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
  onDelete,
  onOpenClinicSession,
  onReschedule,
  onStatusChange,
  onRequestCustomCancellation,
  onBillingSuccess,
  hideBillingAction = false,
  doctors: doctorsProp,
  calendars: calendarsProp,
  onAppointmentUpdated,
}: AppointmentPanelProps) {
  const locale = useLocale();
  const { toast } = useToast();
  const t = useTranslations('AppointmentsPage');
  const tColumns = useTranslations('AppointmentsColumns');
  const tStatus = useTranslations('AppointmentStatus');
  const tReason = useTranslations('CancellationReason');
  const tReschedule = useTranslations('AppointmentReschedule');
  const tPanel = useTranslations('AppointmentPanel');
  const tAccount = useTranslations('AccountStatement');
  const tServices = useTranslations('ServicesPage');
  const tServicesColumns = useTranslations('ServicesColumns');
  const tGeneral = useTranslations('General');

  const [isDoctorSheetOpen, setIsDoctorSheetOpen] = React.useState(false);
  const [isQuoteSheetOpen, setIsQuoteSheetOpen] = React.useState(false);
  const [selectedService, setSelectedService] = React.useState<NonNullable<Appointment['services']>[number] | null>(null);
  const [isBillingLoading, setIsBillingLoading] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const canOpenDetailDeepLinks = useCanOpenDetailDeepLinks();
  const { open: openBillingWizard } = useBillingWizard();
  const { open: openPatientView } = usePatientView();
  const { open: openAccountStatement } = useAccountStatement();

  // ── Quick-edit doctor / room (calendar) ─────────────────────────────────────
  // Local override so the panel reflects the reassignment immediately even if the
  // parent doesn't sync its own copy.
  const [localAppointment, setLocalAppointment] = React.useState<Appointment | null>(null);
  const [editingField, setEditingField] = React.useState<'doctor' | 'calendar' | null>(null);
  const [isReassignSaving, setIsReassignSaving] = React.useState(false);
  const [fetchedDoctors, setFetchedDoctors] = React.useState<User[] | null>(null);
  const [fetchedCalendars, setFetchedCalendars] = React.useState<CalendarType[] | null>(null);
  const [isLoadingTargets, setIsLoadingTargets] = React.useState(false);

  const doctors = React.useMemo(() => doctorsProp ?? fetchedDoctors ?? [], [doctorsProp, fetchedDoctors]);
  const calendars = React.useMemo(() => calendarsProp ?? fetchedCalendars ?? [], [calendarsProp, fetchedCalendars]);

  // Reset transient edit state whenever the appointment changes.
  React.useEffect(() => {
    setLocalAppointment(null);
    setEditingField(null);
  }, [appointment?.id]);

  const handleEditingChange = React.useCallback(async (field: 'doctor' | 'calendar', open: boolean) => {
    setEditingField(open ? field : null);
    if (!open) return;
    // Lazily load picker options the first time they're needed.
    if (field === 'doctor' && !doctorsProp && fetchedDoctors === null) {
      setIsLoadingTargets(true);
      setFetchedDoctors(await fetchReassignDoctors());
      setIsLoadingTargets(false);
    } else if (field === 'calendar' && !calendarsProp && fetchedCalendars === null) {
      setIsLoadingTargets(true);
      setFetchedCalendars(await fetchReassignCalendars());
      setIsLoadingTargets(false);
    }
  }, [doctorsProp, calendarsProp, fetchedDoctors, fetchedCalendars]);

  const handlePickReassign = React.useCallback(async (field: 'doctor' | 'calendar', id: string) => {
    const current = localAppointment ?? appointment;
    if (!current) return;
    const change = field === 'doctor'
      ? { doctor: doctors.find((d) => String(d.id) === id) }
      : { calendar: calendars.find((c) => String(c.id) === id) };
    if (field === 'doctor' && !change.doctor) return;
    if (field === 'calendar' && !change.calendar) return;
    setIsReassignSaving(true);
    try {
      const updated = await reassignAppointmentField(current, change);
      setLocalAppointment(updated);
      setEditingField(null);
      onAppointmentUpdated?.(updated);
      toast({
        title: field === 'doctor' ? t('toasts.doctorReassigned') : t('toasts.calendarReassigned'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toasts.error'),
        description: error instanceof Error ? error.message : t('toasts.unexpectedError'),
      });
    } finally {
      setIsReassignSaving(false);
    }
  }, [appointment, localAppointment, doctors, calendars, onAppointmentUpdated, toast, t]);

  // ── Invoice payments ───────────────────────────────────────────────────────
  const [paymentsMap, setPaymentsMap] = React.useState<Record<string, any[]>>({});
  const [directInvoice, setDirectInvoice] = React.useState<Invoice | null>(null);
  const [isLoadingPayments, setIsLoadingPayments] = React.useState(false);

  // Load payments for each invoice in quoteInvoices
  React.useEffect(() => {
    if (quoteInvoices.length === 0) {
      setPaymentsMap({});
      return;
    }
    let cancelled = false;
    setIsLoadingPayments(true);
    Promise.all(
      quoteInvoices.map((inv) =>
        api
          .get(API_ROUTES.SALES.INVOICE_PAYMENTS, { invoice_id: inv.id })
          .then((data: any) => {
            const raw: any[] = Array.isArray(data) ? data : (data?.payments ?? data?.data ?? []);
            return { id: inv.id, payments: raw };
          })
          .catch(() => ({ id: inv.id, payments: [] })),
      ),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, any[]> = {};
      results.forEach((r) => { map[r.id] = r.payments; });
      setPaymentsMap(map);
    }).finally(() => { if (!cancelled) setIsLoadingPayments(false); });
    return () => { cancelled = true; };
  }, [quoteInvoices]);

  // When there is only invoice_id (no quote), load the invoice directly
  React.useEffect(() => {
    if (!appointment?.invoice_id || quoteInvoices.length > 0 || !appointment?.patientId) {
      setDirectInvoice(null);
      return;
    }
    let cancelled = false;
    setIsLoadingPayments(true);
    api
      .get(API_ROUTES.USER_INVOICES, { user_id: appointment.patientId })
      .then((data: any) => {
        if (cancelled) return;
        const raw: any[] = Array.isArray(data) ? data : (data?.invoices ?? data?.data ?? []);
        const found = raw.find((inv: any) => String(inv.id) === String(appointment.invoice_id));
        if (!found) return;
        const inv: Invoice = {
          id: String(found.id),
          invoice_ref: found.invoice_ref || '',
          doc_no: found.doc_no || found.invoice_doc_no || '',
          invoice_doc_no: found.invoice_doc_no || found.doc_no || '',
          order_id: String(found.order_id || ''),
          quote_id: String(found.quote_id || ''),
          user_id: String(found.user_id || ''),
          user_name: found.user_name || '',
          total: Number(found.total || 0),
          currency: found.currency || 'USD',
          status: found.status || 'draft',
          payment_status: found.payment_state || found.payment_status || 'unpaid',
          paid_amount: Number(found.paid_amount || 0),
          type: found.type || 'invoice',
          createdAt: found.created_at || found.createdAt || '',
          updatedAt: found.updated_at || found.updatedAt || '',
        };
        setDirectInvoice(inv);
        // Load its payments
        return api
          .get(API_ROUTES.SALES.INVOICE_PAYMENTS, { invoice_id: inv.id })
          .then((pd: any) => {
            if (cancelled) return;
            const payments: any[] = Array.isArray(pd) ? pd : (pd?.payments ?? pd?.data ?? []);
            setPaymentsMap({ [inv.id]: payments });
          })
          .catch(() => {});
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoadingPayments(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment?.invoice_id, appointment?.patientId, quoteInvoices.length]);

  const handleOpenBillingWizard = React.useCallback(async () => {
    if (!appointment?.patientId) return;
    setIsBillingLoading(true);
    try {
      // Fetch fresh billing state to avoid opening a freeform wizard when the
      // appointment was already invoiced in a previous Cobro Rápido that the
      // current UI hasn't reflected yet.
      const fresh = await fetchAppointmentBillingState(
        appointment.patientId,
        appointment.id,
        appointment.date,
      );

      const freshInvoiceId = fresh.invoice_id ?? appointment.invoice_id ?? null;
      const freshQuoteId = fresh.quote_id ?? appointment.quote_id ?? null;

      const firstUnpaidInvoice = quoteInvoices.find(
        (inv) => inv.payment_status !== 'paid' && inv.type !== 'credit_note',
      );
      if (firstUnpaidInvoice) {
        openBillingWizard({
          invoiceId: firstUnpaidInvoice.id,
          invoice: firstUnpaidInvoice,
          patientId: appointment.patientId,
          patientName: appointment.patientName,
          isSales: true,
          appointmentId: appointment.id,
        }, onBillingSuccess);
      } else if (freshInvoiceId) {
        openBillingWizard({
          invoiceId: String(freshInvoiceId),
          ...(fresh.invoice ? { invoice: fresh.invoice } : {}),
          patientId: appointment.patientId,
          patientName: appointment.patientName,
          isSales: true,
          appointmentId: appointment.id,
        }, onBillingSuccess);
      } else if (freshQuoteId) {
        openBillingWizard({
          quoteId: String(freshQuoteId),
          patientId: appointment.patientId,
          patientName: appointment.patientName,
          isSales: true,
          appointmentId: appointment.id,
        }, onBillingSuccess);
      } else {
        const sessionTreatments = (linkedSession?.tratamientos ?? []).filter(
          (t) => t.service_id && !t.is_for_next_session,
        );
        const preloadedItems = sessionTreatments.length > 0
          ? sessionTreatments.map((t) => ({
              tempId: String(t.service_id),
              service_id: String(t.service_id),
              service_name: t.service_name ?? t.descripcion ?? '',
              unit_price: t.unit_price ?? 0,
              quantity: t.quantity ?? 1,
              total: (t.unit_price ?? 0) * (t.quantity ?? 1),
            }))
          : (appointment.services || []).map((svc) => ({
              tempId: svc.id,
              service_id: svc.id,
              service_name: svc.name,
              unit_price: svc.price || 0,
              quantity: 1,
              total: svc.price || 0,
            }));
        openBillingWizard({
          patientId: appointment.patientId,
          patientName: appointment.patientName,
          isSales: true,
          appointmentId: appointment.id,
          appointmentDate: appointment.date,
          preloadedItems: preloadedItems.length > 0 ? preloadedItems : undefined,
        }, onBillingSuccess);
      }
    } finally {
      setIsBillingLoading(false);
    }
  }, [appointment, quoteInvoices, openBillingWizard, onBillingSuccess]);

  const openPatientDetail = React.useCallback(() => {
    if (!appointment?.patientId) return;
    openPatientView({
      userId: appointment.patientId,
      userName: appointment.patientName,
      userEmail: appointment.patientEmail,
      userPhone: appointment.patientPhone,
    });
  }, [appointment, openPatientView]);

  const openAccountStatementForPatient = React.useCallback(() => {
    if (!appointment?.patientId) return;
    openAccountStatement(appointment.patientId, appointment.patientName);
  }, [appointment, openAccountStatement]);

  const openDoctorDetail = React.useCallback(() => {
    const doctorId = (localAppointment ?? appointment)?.doctorId;
    if (!doctorId) return;
    if (canOpenDetailDeepLinks) {
      const params = new URLSearchParams({ f: doctorId, t: 'Detalles' });
      openInNewTab(`/${locale}/config/doctors?${params.toString()}`);
      return;
    }
    setIsDoctorSheetOpen(true);
  }, [appointment, localAppointment, canOpenDetailDeepLinks, locale]);

  const openServiceDetail = React.useCallback((service: NonNullable<Appointment['services']>[number]) => {
    const filter = service.name || service.id;
    if (!filter) return;

    const params = new URLSearchParams({ f: filter, t: 'Detalles' });
    const path = `/${locale}/sales/services?${params.toString()}`;

    if (canOpenDetailDeepLinks) {
      openInNewTab(path);
      return;
    }

    setSelectedService(service);
  }, [canOpenDetailDeepLinks, locale]);

  if (!appointment) return null;

  // Reflect inline doctor/room reassignments without waiting for the parent to sync.
  const displayAppointment = localAppointment ?? appointment;

  const serviceName = appointment.services && appointment.services.length > 0
    ? appointment.services.map((service) => service.name).join(', ')
    : appointment.service_name || appointment.summary || '';
  const startDt = parseLocalDateTime(appointment.start?.dateTime);
  const endDt = parseLocalDateTime(appointment.end?.dateTime);
  const endTime = timeFromDateTime(appointment.end?.dateTime);
  const durationMin = startDt && endDt ? differenceInMinutes(endDt, startDt) : null;
  const durationHHmm = durationMin != null && durationMin > 0
    ? `${String(Math.floor(durationMin / 60)).padStart(2, '0')}:${String(durationMin % 60).padStart(2, '0')}`
    : null;
  const StatusIcon = getStatusIcon(appointment.status, appointment.cancellation_reason);
  const statusColor = STATUS_ACCENT_COLOR[appointment.status];
  const appointmentCode = `#${appointment.id.slice(0, 8).toUpperCase()}`;
  const patientMeta = [appointment.patientPhone].filter(Boolean).join(' · ');
  const hasServices = appointment.services && appointment.services.length > 0;
  const invoiceCount = quoteInvoices.length;
  const isCancelled = appointment.status === 'cancelled';
  const cancellationReasonLabel = isCancelled
    ? appointment.cancellation_reason
      ? tReason(appointment.cancellation_reason)
      : tPanel('cancellationReasonUnknown')
    : null;

  return (
    <>
      <ResizableSheet
        open={open}
        onOpenChange={onOpenChange}
        defaultWidth={920}
        minWidth={520}
        maxWidth={1280}
        storageKey="appointment-panel-width"
      >
        <div className="flex h-full flex-col overflow-hidden bg-card font-body">
          <div className="flex-none border-b border-border bg-card px-5 py-4 pr-24">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={openPatientDetail}
                className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={tPanel('openPatient')}
                disabled={!appointment.patientId}
              >
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/25 text-base font-semibold text-primary">
                    {initials(appointment.patientName)}
                  </AvatarFallback>
                </Avatar>
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle asChild>
                    <button
                      type="button"
                      onClick={openPatientDetail}
                      disabled={!appointment.patientId}
                      className={cn(
                        'truncate text-left text-lg font-semibold text-foreground',
                        appointment.patientId && 'hover:underline underline-offset-4',
                      )}
                    >
                      {appointment.patientName}
                    </button>
                  </SheetTitle>
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm font-semibold text-muted-foreground">
                    {appointmentCode}
                  </span>
                </div>
                {patientMeta && (
                  <p className="mt-1 truncate text-sm font-medium text-muted-foreground">{patientMeta}</p>
                )}
                {serviceName && (
                  <SheetDescription className="mt-1 truncate text-sm text-muted-foreground">
                    {serviceName}
                  </SheetDescription>
                )}
                {appointment.patientId && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={openPatientDetail}>
                      <UserRound className="h-3.5 w-3.5" />
                      {tPanel('openPatient')}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={openAccountStatementForPatient}>
                      <FileText className="h-3.5 w-3.5" />
                      {tAccount('viewStatement')}
                    </Button>
                  </div>
                )}
              </div>

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                <StatusIcon className="h-3.5 w-3.5" style={{ color: statusColor }} />
                {cancellationReasonLabel ?? tStatus(appointment.status)}
              </span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="min-w-0 flex-1 overflow-auto px-5 py-4">
              <div className="mb-4 sm:hidden">
                <AppointmentStatusRail
                  variant="dropdown"
                  appointment={appointment}
                  onChange={(status, extra) => onStatusChange(appointment, status, extra)}
                  onRequestCustomCancellation={
                    onRequestCustomCancellation
                      ? () => onRequestCustomCancellation(appointment)
                      : undefined
                  }
                />
              </div>
              {isCancelled && (
                <section className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-background text-destructive shadow-sm">
                      <StatusIcon className="h-5 w-5" strokeWidth={2.4} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {tPanel('cancellationReasonLabel')}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {cancellationReasonLabel}
                      </p>
                      {appointment.cancellation_note && (
                        <div className="mt-3 border-t border-destructive/15 pt-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {tPanel('cancellationNoteLabel')}
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/85">
                            {appointment.cancellation_note}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-semibold">{t('panelTabs.info')}</h3>
                </div>

                <div className="grid gap-x-8 md:grid-cols-2">
                  <DetailRow
                    icon={CalendarIcon}
                    label={tColumns('date')}
                    value={formatDisplayDate(appointment.date)}
                  />
                  <DetailRow
                    icon={Clock}
                    label={tColumns('time')}
                    value={`${appointment.time}${endTime ? ` → ${endTime}` : ''}`}
                    detail={durationHHmm ? `${tPanel('duration')}: ${durationHHmm}` : undefined}
                  />
                  <EditableDetailRow
                    icon={MapPin}
                    label={tColumns('calendar')}
                    value={displayAppointment.calendar_name || tPanel('noCalendar')}
                    editLabel={displayAppointment.calendar_source_id ? tPanel('changeCalendar') : tPanel('assignCalendar')}
                    isEditing={editingField === 'calendar'}
                    onEditingChange={(open) => handleEditingChange('calendar', open)}
                    picker={
                      <InlineEntityPicker
                        className="border-0"
                        items={calendars.map((c) => ({ id: String(c.id), name: c.name, color: c.color }))}
                        selectedId={displayAppointment.calendar_source_id}
                        onSelect={(id) => handlePickReassign('calendar', id)}
                        isLoading={isLoadingTargets}
                        isSaving={isReassignSaving}
                        searchPlaceholder={tPanel('searchCalendar')}
                        emptyText={tPanel('noCalendarFound')}
                      />
                    }
                  />
                  <EditableDetailRow
                    icon={UserSquare}
                    label={tColumns('doctor')}
                    value={displayAppointment.doctorId ? (displayAppointment.doctorName || tPanel('noDoctor')) : tPanel('noDoctor')}
                    detail={doctorColor ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: doctorColor }} />
                        {tPanel('openDoctor')}
                      </span>
                    ) : undefined}
                    onValueClick={displayAppointment.doctorId ? openDoctorDetail : undefined}
                    editLabel={displayAppointment.doctorId ? tPanel('changeDoctor') : tPanel('assignDoctor')}
                    isEditing={editingField === 'doctor'}
                    onEditingChange={(open) => handleEditingChange('doctor', open)}
                    picker={
                      <InlineEntityPicker
                        className="border-0"
                        items={doctors.map((d) => ({ id: String(d.id), name: d.name, color: d.color }))}
                        selectedId={displayAppointment.doctorId}
                        onSelect={(id) => handlePickReassign('doctor', id)}
                        isLoading={isLoadingTargets}
                        isSaving={isReassignSaving}
                        searchPlaceholder={tPanel('searchDoctor')}
                        emptyText={tPanel('noDoctorFound')}
                      />
                    }
                  />
                </div>

                {hasServices && (
                  <DetailRow
                    icon={Layers}
                    label={tPanel('servicesCount', { count: appointment.services?.length ?? 0 })}
                    value={
                      <span className="flex flex-col">
                        {appointment.services?.map((service) => (
                          <button
                            key={service.id}
                            type="button"
                            className="flex w-full items-center gap-2 border-b border-dashed border-border/70 py-2 text-left transition-colors hover:bg-muted/20 last:border-b-0"
                            onClick={() => openServiceDetail(service)}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: service.color || STATUS_ACCENT_COLOR.confirmed }}
                            />
                            <span className="min-w-0 flex-1 truncate underline-offset-4 hover:underline">{service.name}</span>
                            {service.duration_minutes ? (
                              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                {tPanel('durationMinutes', { minutes: service.duration_minutes })}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </span>
                    }
                    className="md:col-span-2"
                  />
                )}

                {appointment.notes && (
                  <DetailRow
                    icon={StickyNote}
                    label={t('contextMenu.notes')}
                    value={<span className="whitespace-pre-wrap font-medium">{appointment.notes}</span>}
                    tone="warning"
                    className="md:col-span-2"
                  />
                )}
              </section>

              {(linkedSession || isLoadingLinkedSession || appointment.treatment_seq_step_id != null || !!onOpenClinicSession) && (
                <section className="mt-6 border-t border-border pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-base font-semibold">{t('linkedSession')}</h3>
                  </div>

                  {isLoadingLinkedSession ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('linkedSession')}
                    </div>
                  ) : linkedSession ? (
                    <div className="grid gap-4 rounded-xl border border-border bg-primary/5 p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                      <div className="space-y-1">
                        <p className="font-mono text-sm font-semibold text-muted-foreground">
                          #S-{String(linkedSession.sesion_id).padStart(4, '0')}
                        </p>
                        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          {formatDisplayDate(linkedSession.fecha_sesion)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {linkedSession.procedimiento_realizado || t('procedure')}
                        </p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {[linkedSession.doctor_name || linkedSession.nombre_doctor, linkedSession.notas_clinicas]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      {onOpenClinicSession && (
                        <Button
                          variant="outline"
                          className="justify-self-start gap-2 border-primary/25 text-primary hover:bg-primary/10 md:justify-self-end"
                          onClick={() => onOpenClinicSession(appointment)}
                        >
                          <Stethoscope className="h-4 w-4" />
                          {t('editSession')}
                        </Button>
                      )}
                    </div>
                  ) : onOpenClinicSession ? (
                    <button
                      type="button"
                      onClick={() => onOpenClinicSession(appointment)}
                      className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-4 text-left transition-colors hover:bg-muted/35"
                    >
                      <Stethoscope className="h-5 w-5 text-muted-foreground" />
                      <span className="flex-1">
                        <span className="block font-semibold">{t('noLinkedSession')}</span>
                        <span className="text-xs text-muted-foreground">{t('createSession')}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ) : (
                    <div className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-4 text-left">
                      <Stethoscope className="h-5 w-5 text-muted-foreground" />
                      <span className="flex-1">
                        <span className="block font-semibold">{t('noLinkedSession')}</span>
                        <span className="text-xs text-muted-foreground">{t('createSession')}</span>
                      </span>
                    </div>
                  )}
                </section>
              )}

              {(appointment.quote_id || appointment.invoice_id || quoteOrder || invoiceCount > 0 || isLoadingQuoteInfo) && (
                <section className="mt-6 border-t border-border pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-base font-semibold">{tColumns('quoteDocNo')}</h3>
                  </div>

                  {/* Quote row */}
                  {appointment.quote_id && (
                    <button
                      type="button"
                      onClick={() => setIsQuoteSheetOpen(true)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-muted/35"
                    >
                      <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-mono text-xs font-semibold">
                          {appointment.quote_doc_no || appointment.quote_id}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {isLoadingQuoteInfo ? '…' : invoiceCount > 0 ? `${t('linkedInvoice')} · ${invoiceCount}` : t('notInvoiced')}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  )}

                  {/* Invoice cards — from quote or direct */}
                  {(() => {
                    const invoicesToShow: Invoice[] = quoteInvoices.length > 0
                      ? quoteInvoices
                      : directInvoice
                        ? [directInvoice]
                        : [];
                    if (isLoadingQuoteInfo || (isLoadingPayments && invoicesToShow.length === 0)) {
                      return <div className="h-8 rounded-lg bg-muted/50 animate-pulse" />;
                    }
                    return invoicesToShow.map((inv) => {
                      const payments: any[] = paymentsMap[inv.id] ?? [];
                      const isPaid = inv.payment_status === 'paid';
                      const pendingAmt = Math.max(0, (inv.total || 0) - (inv.paid_amount || 0));
                      return (
                        <div key={inv.id} className="rounded-xl border border-border overflow-hidden">
                          {/* Invoice header */}
                          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                            <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-semibold truncate">
                                  {inv.doc_no || inv.invoice_doc_no || `#${inv.id}`}
                                </span>
                                <span className={cn(
                                  'text-xs font-medium px-1.5 py-0.5 rounded-full',
                                  isPaid
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
                                )}>
                                  {isPaid ? 'Pagado' : pendingAmt > 0 ? `Pendiente ${inv.currency} ${pendingAmt.toLocaleString()}` : 'Sin pagar'}
                                </span>
                              </div>
                              <span className="block text-xs text-muted-foreground mt-0.5">
                                Total: {inv.currency} {(inv.total || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          {/* Payments list */}
                          {payments.length > 0 && (
                            <div className="divide-y divide-border/50 border-t border-border/50">
                              {payments.map((p: any, i: number) => {
                                const amt = Math.abs(Number(p.amount_applied ?? p.amount ?? 0));
                                const cur = p.invoice_currency || p.source_currency || p.currency || inv.currency;
                                const method = p.payment_method_name || p.method || p.payment_method || '';
                                const date = p.payment_date || p.created_at || '';
                                const docNo = p.doc_no || p.payment_doc_no || '';
                                return (
                                  <div key={i} className="flex items-center gap-2 px-4 py-2 text-xs">
                                    <CreditCard className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="flex-1 truncate text-muted-foreground">
                                      {method && <span className="font-medium text-foreground">{method}</span>}
                                      {docNo && <span className="font-mono ml-1 opacity-70">· {docNo}</span>}
                                      {date && <span className="ml-1 opacity-60">· {format(new Date(date), 'dd/MM/yy')}</span>}
                                    </span>
                                    <span className="font-semibold text-foreground shrink-0">
                                      {cur} {amt.toLocaleString()}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {payments.length === 0 && !isLoadingPayments && (
                            <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border/50">
                              Sin pagos registrados
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}

                  {/* No financial info at all */}
                  {!appointment.quote_id && !appointment.invoice_id && !directInvoice && !isLoadingQuoteInfo && (
                    <p className="text-xs text-muted-foreground">{t('notInvoiced')}</p>
                  )}
                </section>
              )}
            </div>

            <AppointmentStatusRail
              variant="side"
              appointment={appointment}
              onChange={(status, extra) => onStatusChange(appointment, status, extra)}
              onRequestCustomCancellation={
                onRequestCustomCancellation
                  ? () => onRequestCustomCancellation(appointment)
                  : undefined
              }
            />
          </div>

          <div className="flex-none border-t border-border bg-muted/30 px-5 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
              {appointment.patientId && !hideBillingAction && (
                <Button
                  variant="default"
                  className="w-full gap-2 sm:w-auto"
                  onClick={handleOpenBillingWizard}
                  disabled={isBillingLoading}
                >
                  {isBillingLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Zap className="h-4 w-4" />}
                  Cobro Rápido
                </Button>
              )}
              <div className="flex items-center gap-2 sm:ml-auto sm:gap-3">
                {onReschedule && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 gap-2 sm:flex-none"
                    disabled={!canReschedule(appointment.status)}
                    title={!canReschedule(appointment.status)
                      ? tReschedule('blockedTooltip', { status: tStatus(appointment.status) })
                      : undefined}
                    onClick={() => { onReschedule(appointment); onOpenChange(false); }}
                  >
                    <CalendarSync className="h-4 w-4" />
                    {tReschedule('action')}
                  </Button>
                )}
                {onEdit && (
                  <Button
                    size="lg"
                    className="flex-1 gap-2 sm:flex-none"
                    onClick={() => { onEdit(appointment); onOpenChange(false); }}
                  >
                    <Edit className="h-4 w-4" />
                    {tColumns('edit')}
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="lg"
                    variant="destructive"
                    className="flex-1 gap-2 sm:flex-none"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {tPanel('delete')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </ResizableSheet>

      {/* Delete confirmation — soft-deletes the appointment (removed from the system) */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tPanel('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{tPanel('deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tPanel('deleteCancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setIsDeleteConfirmOpen(false);
                if (appointment) onDelete?.(appointment);
                onOpenChange(false);
              }}
            >
              {tPanel('deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {displayAppointment.doctorId && (
        <DoctorDetailSheet
          open={isDoctorSheetOpen}
          onOpenChange={setIsDoctorSheetOpen}
          doctorId={displayAppointment.doctorId}
          doctorName={displayAppointment.doctorName ?? ''}
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
      <Dialog open={!!selectedService} onOpenChange={(nextOpen) => !nextOpen && setSelectedService(null)}>
        <DialogContent maxWidth="md" className="w-[calc(100vw-1.5rem)] rounded-xl">
          {selectedService && (
            <>
              <DialogHeader>
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-9 w-9 shrink-0 rounded-full border border-white/60 shadow-sm"
                    style={{ backgroundColor: selectedService.color || STATUS_ACCENT_COLOR.confirmed }}
                  />
                  <div className="min-w-0">
                    <DialogTitle className="truncate">{selectedService.name}</DialogTitle>
                    <DialogDescription className="truncate">
                      {selectedService.category || selectedService.category_name || tServices('title')}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <DialogBody className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {tServicesColumns('price')}
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {formatServicePrice(selectedService.price || 0, selectedService.currency, tGeneral('free'))}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {tServicesColumns('duration')}
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {tPanel('durationMinutes', { minutes: selectedService.duration_minutes || 0 })}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2">
                    <span className="text-xs text-muted-foreground">{tServicesColumns('category')}</span>
                    <span className="truncate text-xs font-medium">
                      {selectedService.category || selectedService.category_name || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2">
                    <span className="text-xs text-muted-foreground">{tServicesColumns('isActive')}</span>
                    <Badge variant={selectedService.is_active ? 'success' : 'outline'}>
                      {selectedService.is_active ? tServicesColumns('active') : tServicesColumns('inactive')}
                    </Badge>
                  </div>
                </div>

                {selectedService.description && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {tServices('createDialog.descriptionLabel')}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{selectedService.description}</p>
                  </div>
                )}

                {selectedService.indications && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {tServices('createDialog.indicationsLabel')}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{selectedService.indications}</p>
                  </div>
                )}
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
