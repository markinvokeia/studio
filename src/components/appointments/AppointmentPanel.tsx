'use client';

import * as React from 'react';
import { addMinutes, differenceInMinutes, format, parseISO, set } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowRight,
  Calendar as CalendarIcon,
  CalendarSync,
  ChevronDown,
  Clock,
  CreditCard,
  Edit,
  FileText,
  HeartPulse,
  Info,
  Layers,
  Loader2,
  MapPin,
  Palette,
  Plus,
  RefreshCw,
  StickyNote,
  Stethoscope,
  Trash2,
  UserRound,
  UserSquare,
  X,
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
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ResizableSheet, SheetDescription, SheetTitle } from '@/components/ui/resizable-sheet';
import { Calendar as DatePickerCalendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GOOGLE_CALENDAR_COLORS } from '@/components/calendar/calendar-constants';
import { getReadableTextColor } from '@/components/calendar/calendar-utils';
import { useToast } from '@/hooks/use-toast';
import { STATUS_ACCENT_COLOR, canReschedule } from '@/constants/appointment-status';
import { formatDisplayDate, cn, formatServicePrice, toLocalISOString } from '@/lib/utils';
import type { Appointment, AppointmentStatus, Calendar as CalendarType, Invoice, Order, PatientSession, Service, User } from '@/lib/types';

import { DoctorDetailSheet } from '@/components/appointments/DoctorDetailSheet';
import { InlineEntityPicker } from '@/components/appointments/InlineEntityPicker';
import { InlineServicePicker } from '@/components/calendar/inline-service-picker';
import { QuoteDetailSheet } from '@/components/appointments/QuoteDetailSheet';
import { AppointmentStatusRail, type StatusChangeExtra } from '@/components/appointments/AppointmentStatusRail';
import { getStatusIcon } from '@/components/appointments/status-icons';
import { usePatientView } from '@/stores/patient-view-store';
import { usePatientLedgerSheet } from '@/stores/patient-ledger-sheet-store';
import {
  fetchReassignCalendars,
  fetchReassignDoctors,
  reassignAppointmentField,
  type AppointmentReassignChange,
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

/** Inline time editor: pick a start time + duration; the end is recomputed and
 *  read-only. Each change calls onApply so the appointment is upserted. */
function TimeEditor({
  startDate,
  durationMin,
  isSaving,
  labels,
  onApply,
}: {
  startDate: Date;
  durationMin: number;
  isSaving?: boolean;
  labels: { start: string; duration: string; end: string };
  onApply: (start: Date, end: Date) => void;
}) {
  const [time, setTime] = React.useState(format(startDate, 'HH:mm'));
  const [dur, setDur] = React.useState(durationMin);
  React.useEffect(() => { setTime(format(startDate, 'HH:mm')); setDur(durationMin); }, [startDate, durationMin]);

  const startFromTime = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return startDate;
    return set(startDate, { hours: h, minutes: m, seconds: 0, milliseconds: 0 });
  };
  const currentStart = startFromTime(time);
  const currentEnd = addMinutes(currentStart, dur > 0 ? dur : 0);

  return (
    <div className="space-y-2 p-3 text-xs">
      <label className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{labels.start}</span>
        <Input
          type="time"
          value={time}
          disabled={isSaving}
          onChange={(e) => {
            setTime(e.target.value);
            const s = startFromTime(e.target.value);
            onApply(s, addMinutes(s, dur > 0 ? dur : 0));
          }}
          className="h-8 w-28"
        />
      </label>
      <label className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{labels.duration}</span>
        <Input
          type="number"
          min={5}
          step={5}
          value={dur || ''}
          disabled={isSaving}
          onChange={(e) => setDur(Math.max(0, parseInt(e.target.value, 10) || 0))}
          onBlur={() => { if (dur > 0) onApply(currentStart, addMinutes(currentStart, dur)); }}
          className="h-8 w-20"
        />
      </label>
      <div className="flex items-center justify-between gap-2 border-t border-dashed pt-2">
        <span className="text-muted-foreground">{labels.end}</span>
        <span className="font-semibold">{format(currentEnd, 'HH:mm')}</span>
      </div>
    </div>
  );
}

/** Inline notes editor: a textarea + Save that upserts the appointment. */
function NotesEditor({
  value,
  isSaving,
  saveLabel,
  placeholder,
  onSave,
}: {
  value: string;
  isSaving?: boolean;
  saveLabel: string;
  placeholder: string;
  onSave: (notes: string) => void;
}) {
  const [text, setText] = React.useState(value);
  React.useEffect(() => setText(value), [value]);
  return (
    <div className="space-y-2 p-3">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} rows={4} className="text-xs" />
      <div className="flex justify-end">
        <Button size="sm" className="h-7 text-xs" disabled={isSaving || text === value} onClick={() => onSave(text)}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

/** A collapsible invoice card with its payments. Collapsed by default when a quote
 *  has several invoices; only real (non-zero) payments are listed, otherwise a
 *  "no payments" line is shown instead of an empty row. */
function InvoiceCard({
  inv,
  payments,
  defaultExpanded,
  noPaymentsLabel,
  paidLabel,
  unpaidLabel,
  pendingLabel,
  totalLabel,
}: {
  inv: Invoice;
  payments: any[];
  defaultExpanded: boolean;
  noPaymentsLabel: string;
  paidLabel: string;
  unpaidLabel: string;
  pendingLabel: string;
  totalLabel: string;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  React.useEffect(() => setExpanded(defaultExpanded), [defaultExpanded]);
  // Ignore zero-amount allocations so an unpaid invoice doesn't render an empty "0" row.
  const realPayments = payments.filter((p) => Math.abs(Number(p.amount_applied ?? p.amount ?? 0)) > 0.005);
  const isPaid = inv.payment_status === 'paid';
  const pendingAmt = Math.max(0, (inv.total || 0) - (inv.paid_amount || 0));

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-3 bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <CreditCard className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-mono text-xs font-semibold">{inv.doc_no || inv.invoice_doc_no || `#${inv.id}`}</span>
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-xs font-medium',
              isPaid
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
            )}>
              {isPaid ? paidLabel : pendingAmt > 0 ? `${pendingLabel} ${inv.currency} ${pendingAmt.toLocaleString()}` : unpaidLabel}
            </span>
          </div>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {totalLabel}: {inv.currency} {(inv.total || 0).toLocaleString()}
          </span>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        realPayments.length > 0 ? (
          <div className="divide-y divide-border/50 border-t border-border/50">
            {realPayments.map((p: any, i: number) => {
              const amt = Math.abs(Number(p.amount_applied ?? p.amount ?? 0));
              const cur = p.invoice_currency || p.source_currency || p.currency || inv.currency;
              const method = p.payment_method_name || p.method || p.payment_method || '';
              const date = p.payment_date || p.created_at || '';
              const docNo = p.doc_no || p.payment_doc_no || '';
              return (
                <div key={i} className="flex items-center gap-2 px-4 py-2 text-xs">
                  <CreditCard className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-muted-foreground">
                    {method && <span className="font-medium text-foreground">{method}</span>}
                    {docNo && <span className="ml-1 font-mono opacity-70">· {docNo}</span>}
                    {date && <span className="ml-1 opacity-60">· {format(new Date(date), 'dd/MM/yy')}</span>}
                  </span>
                  <span className="shrink-0 font-semibold text-foreground">{cur} {amt.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border-t border-border/50 px-4 py-2 text-xs text-muted-foreground">{noPaymentsLabel}</div>
        )
      )}
    </div>
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
  /** Changes the appointment's color tag (Google color id), mirroring the calendar
   *  right-click color picker. */
  onColorChange?: (appointment: Appointment, colorId: string) => void;
  /** Opens the create-quote flow for this appointment (and links it on success). */
  onCreateQuote?: (appointment: Appointment) => void;
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
  onDelete,
  onOpenClinicSession,
  onReschedule,
  onStatusChange,
  onRequestCustomCancellation,
  onBillingSuccess,
  doctors: doctorsProp,
  calendars: calendarsProp,
  onAppointmentUpdated,
  onColorChange,
  onCreateQuote,
}: AppointmentPanelProps) {
  const locale = useLocale();
  const dateLocale = locale === 'es' ? es : enUS;
  const { toast } = useToast();
  const t = useTranslations('AppointmentsPage');
  const tColumns = useTranslations('AppointmentsColumns');
  const tStatus = useTranslations('AppointmentStatus');
  const tReason = useTranslations('CancellationReason');
  const tReschedule = useTranslations('AppointmentReschedule');
  const tPanel = useTranslations('AppointmentPanel');
  const tInline = useTranslations('AppointmentsPage.inlineCreate');
  const tAccount = useTranslations('AccountStatement');
  const tServices = useTranslations('ServicesPage');
  const tServicesColumns = useTranslations('ServicesColumns');
  const tGeneral = useTranslations('General');

  const [isDoctorSheetOpen, setIsDoctorSheetOpen] = React.useState(false);
  const [isQuoteSheetOpen, setIsQuoteSheetOpen] = React.useState(false);
  const [selectedService, setSelectedService] = React.useState<NonNullable<Appointment['services']>[number] | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = React.useState(false);
  // Optimistic color so the header updates immediately on a color change.
  const [localColor, setLocalColor] = React.useState<string | undefined>(undefined);
  React.useEffect(() => { setLocalColor(undefined); }, [appointment?.id]);
  const canOpenDetailDeepLinks = useCanOpenDetailDeepLinks();
  const { open: openPatientView } = usePatientView();
  const { open: openAccountStatement } = usePatientLedgerSheet();

  // Outstanding-debt indicator + cancelled-appointment count for the patient.
  const [patientDebt, setPatientDebt] = React.useState<{ currency: string; amount: number }[]>([]);
  const [cancelledCount, setCancelledCount] = React.useState(0);
  // Bumped after a successful Cobro Rápido so the panel re-fetches debt, cancelled
  // count and invoice payments (the patient may have paid / the quote may have changed).
  const [billingRefreshKey, setBillingRefreshKey] = React.useState(0);
  React.useEffect(() => {
    const patientId = appointment?.patientId;
    if (!open || !patientId) { setPatientDebt([]); setCancelledCount(0); return; }
    let active = true;
    api.get(API_ROUTES.USER_FINANCIAL, { user_id: patientId })
      .then((raw: any) => {
        if (!active) return;
        const fin = Array.isArray(raw) ? raw[0] : raw;
        const byCurrency = fin?.financial_data ?? {};
        setPatientDebt(
          Object.entries(byCurrency)
            .map(([currency, d]: [string, any]) => ({ currency, amount: Number(d?.current_debt ?? 0) }))
            .filter((d) => d.amount > 0),
        );
      })
      .catch(() => { if (active) setPatientDebt([]); });
    api.get(API_ROUTES.USER_CANCELLED_APPOINTMENTS_COUNT, { user_id: patientId })
      .then((raw: any) => {
        if (!active) return;
        const row = Array.isArray(raw) ? raw[0] : raw;
        setCancelledCount(Number(row?.cancelled_count ?? row?.count ?? 0) || 0);
      })
      .catch(() => { if (active) setCancelledCount(0); });
    return () => { active = false; };
  }, [open, appointment?.patientId, billingRefreshKey]);

  // ── Quick-edit doctor / room (calendar) ─────────────────────────────────────
  // Local override so the panel reflects the reassignment immediately even if the
  // parent doesn't sync its own copy.
  const [localAppointment, setLocalAppointment] = React.useState<Appointment | null>(null);
  const [editingField, setEditingField] = React.useState<'doctor' | 'calendar' | 'date' | 'time' | 'notes' | 'quote' | 'services' | null>(null);
  // Patient quotes for the inline "associate quote" picker (loaded lazily).
  const [patientQuotes, setPatientQuotes] = React.useState<{
    id: string; doc_no?: string; total: number; currency: string;
    paymentStatus?: string; billingStatus?: string; amountInvoiced: number; amountPaid: number;
  }[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = React.useState(false);
  const loadPatientQuotes = React.useCallback(async () => {
    const patientId = appointment?.patientId;
    if (!patientId) return;
    setIsLoadingQuotes(true);
    try {
      const data = await api.get(API_ROUTES.USER_QUOTES, { user_id: patientId });
      const raw = Array.isArray(data) ? data : (data.user_quotes || data.data || data.result || []);
      // Same fields the patient "Financiero" tab reads, so totals and the
      // invoiced/paid state are correct here too.
      setPatientQuotes(raw.filter((q: any) => q && q.id != null).map((q: any) => ({
        id: String(q.id),
        doc_no: q.doc_no || q.quote_doc_no || '',
        total: Number(q.total_presupuesto ?? q.total ?? 0),
        currency: q.currency || 'USD',
        paymentStatus: String(q.payment_status ?? '').toLowerCase(),
        billingStatus: String(q.billing_status ?? '').toLowerCase(),
        amountInvoiced: Number(q.monto_facturado ?? q.amount_invoiced ?? 0),
        amountPaid: Number(q.monto_pagado ?? q.amount_paid ?? 0),
      })));
    } catch {
      setPatientQuotes([]);
    } finally {
      setIsLoadingQuotes(false);
    }
  }, [appointment?.patientId]);
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

  // Generic inline change (date/time/notes/quote): upserts the appointment with
  // all data unchanged except the modified field — same as the doctor/room edit.
  const applyChange = React.useCallback(async (change: AppointmentReassignChange, toastTitle?: string) => {
    const current = localAppointment ?? appointment;
    if (!current) return;
    setIsReassignSaving(true);
    try {
      const updated = await reassignAppointmentField(current, change);
      setLocalAppointment(updated);
      onAppointmentUpdated?.(updated);
      // Quote/service changes affect the financial section — refresh panel data.
      if (change.quote !== undefined || change.services !== undefined) {
        setBillingRefreshKey((k) => k + 1);
      }
      if (toastTitle) toast({ title: toastTitle });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toasts.error'),
        description: error instanceof Error ? error.message : t('toasts.unexpectedError'),
      });
    } finally {
      setIsReassignSaving(false);
    }
  }, [appointment, localAppointment, onAppointmentUpdated, toast, t]);

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
  }, [quoteInvoices, billingRefreshKey]);

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
  }, [appointment?.invoice_id, appointment?.patientId, quoteInvoices.length, billingRefreshKey]);

  const handleBillingSuccess = React.useCallback(() => {
    onBillingSuccess?.();
    setBillingRefreshKey((k) => k + 1);
  }, [onBillingSuccess]);

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

  // Editable services: add/remove/swap, each persisted via the same upsert.
  const apptServices = displayAppointment.services ?? [];
  const handleToggleService = (svc: Service) => {
    const exists = apptServices.some((s) => String(s.id) === String(svc.id));
    const next = exists
      ? apptServices.filter((s) => String(s.id) !== String(svc.id))
      : [...apptServices, svc];
    applyChange({ services: next }, t('toasts.appointmentUpdated'));
  };
  const handleRemoveService = (svc: Service) => {
    applyChange({ services: apptServices.filter((s) => String(s.id) !== String(svc.id)) }, t('toasts.appointmentUpdated'));
  };

  const serviceName = appointment.services && appointment.services.length > 0
    ? appointment.services.map((service) => service.name).join(', ')
    : appointment.service_name || appointment.summary || '';
  const startDt = parseLocalDateTime(displayAppointment.start?.dateTime);
  const endDt = parseLocalDateTime(displayAppointment.end?.dateTime);
  const endTime = timeFromDateTime(displayAppointment.end?.dateTime);
  const durationMin = startDt && endDt ? differenceInMinutes(endDt, startDt) : null;
  const durationHHmm = durationMin != null && durationMin > 0
    ? `${String(Math.floor(durationMin / 60)).padStart(2, '0')}:${String(durationMin % 60).padStart(2, '0')}`
    : null;
  const StatusIcon = getStatusIcon(appointment.status, appointment.cancellation_reason);
  const statusColor = STATUS_ACCENT_COLOR[appointment.status];
  const appointmentCode = `#${appointment.id.slice(0, 8).toUpperCase()}`;
  const patientMeta = [appointment.patientPhone].filter(Boolean).join(' · ');
  const invoiceCount = quoteInvoices.length;
  const isCancelled = appointment.status === 'cancelled';
  const cancellationReasonLabel = isCancelled
    ? appointment.cancellation_reason
      ? tReason(appointment.cancellation_reason)
      : tPanel('cancellationReasonUnknown')
    : null;

  // Header tint: use the appointment's assigned color (optimistic local override
  // wins) so the panel header matches how the appointment looks on the calendar.
  const headerColor = localColor ?? appointment.color ?? undefined;
  const headerText = headerColor ? getReadableTextColor(headerColor) : undefined;
  const handleColorSelect = (colorId: string) => {
    const hex = GOOGLE_CALENDAR_COLORS.find((c) => c.id === colorId)?.hex;
    if (hex) setLocalColor(hex);
    setIsColorPickerOpen(false);
    onColorChange?.(appointment, colorId);
  };

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
          <div
            className={cn('flex-none border-b px-5 py-4 pr-24', headerColor ? 'border-black/10' : 'border-border bg-card')}
            style={headerColor ? { backgroundColor: headerColor, color: headerText } : undefined}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', headerColor ? 'bg-white/25' : 'bg-primary/10 text-primary')}
              >
                <Info className="h-4 w-4" style={headerColor ? { color: headerText } : undefined} />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className={cn('line-clamp-3 text-sm font-medium', !headerColor && 'text-foreground')} style={headerColor ? { color: headerText } : undefined}>
                  {tPanel('appointmentTitleFor')}{' '}
                  <button
                    type="button"
                    onClick={openPatientDetail}
                    disabled={!appointment.patientId}
                    className={cn('text-left font-bold', appointment.patientId && 'hover:underline underline-offset-4')}
                  >
                    {appointment.patientName}
                  </button>
                </SheetTitle>
                <SheetDescription className="sr-only">{serviceName || appointment.patientName}</SheetDescription>
              </div>
              {/* Manual refresh — re-fetches debt, payments and quote/invoice state */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8 shrink-0 rounded-lg', headerColor ? 'hover:bg-white/20' : 'hover:bg-muted')}
                aria-label={t('refresh')}
                title={t('refresh')}
                onClick={handleBillingSuccess}
              >
                <RefreshCw className={cn('h-4 w-4', isLoadingPayments && 'animate-spin')} style={headerColor ? { color: headerText } : undefined} />
              </Button>
              {/* Change-color dropdown — same palette as the calendar right-click menu */}
              {onColorChange && (
                <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn('h-8 w-8 shrink-0 rounded-lg', headerColor ? 'hover:bg-white/20' : 'hover:bg-muted')}
                      aria-label={tPanel('changeColor')}
                      title={tPanel('changeColor')}
                    >
                      <Palette className="h-4 w-4" style={headerColor ? { color: headerText } : undefined} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-2">
                    <div className="grid grid-cols-4 gap-2">
                      {GOOGLE_CALENDAR_COLORS.map((color) => (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => handleColorSelect(color.id)}
                          className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                          style={{ backgroundColor: color.hex }}
                          aria-label={color.id}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <span className={cn('hidden shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-semibold sm:inline', headerColor ? 'bg-black/10' : 'bg-muted text-muted-foreground')} style={headerColor ? { color: headerText } : undefined}>
                {appointmentCode}
              </span>
              <span
                className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', headerColor ? 'bg-white/25' : 'border border-primary/20 bg-primary/10 text-primary')}
                style={headerColor ? { color: headerText } : undefined}
              >
                <StatusIcon className="h-3 w-3" style={{ color: headerColor ? headerText : statusColor }} />
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
                {/* Patient row — moved out of the header so the appointment (not the patient) leads */}
                <div className="flex items-center gap-3 border-b border-border/70 py-3">
                  <button
                    type="button"
                    onClick={openPatientDetail}
                    disabled={!appointment.patientId}
                    className="shrink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={tPanel('openPatient')}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                        {initials(appointment.patientName)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={openPatientDetail}
                      disabled={!appointment.patientId}
                      className={cn(
                        'block max-w-full truncate text-left text-sm font-bold text-foreground',
                        appointment.patientId && 'hover:underline underline-offset-4',
                      )}
                    >
                      {appointment.patientName}
                    </button>
                    {patientMeta && <p className="truncate text-xs text-muted-foreground">{patientMeta}</p>}
                    <p className={cn('truncate text-xs font-medium', patientDebt.length > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                      {patientDebt.length > 0 ? tAccount('debtAlertTitle') : tAccount('noDebt')}
                    </p>
                    {cancelledCount > 0 && (
                      <p className="truncate text-xs font-medium text-amber-600 dark:text-amber-400">
                        {tPanel('cancelledAppointments', { count: cancelledCount })}
                      </p>
                    )}
                  </div>
                  {appointment.patientId && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={openAccountStatementForPatient}>
                        <FileText className="h-3.5 w-3.5" />
                        {tAccount('viewStatement')}
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={openPatientDetail}>
                        <UserRound className="h-3.5 w-3.5" />
                        {tPanel('openPatient')}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Outstanding-debt alert */}
                {patientDebt.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        {patientDebt.map((d) => `${d.currency} ${d.amount.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`).join(' · ')}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                      onClick={openAccountStatementForPatient}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {tAccount('viewStatement')}
                    </Button>
                  </div>
                )}

                <div className="mt-3 grid gap-x-8 md:grid-cols-2">
                  <EditableDetailRow
                    icon={CalendarIcon}
                    label={tColumns('date')}
                    value={formatDisplayDate(displayAppointment.date)}
                    editLabel={tColumns('date')}
                    isEditing={editingField === 'date'}
                    onEditingChange={(o) => setEditingField(o ? 'date' : null)}
                    picker={
                      <DatePickerCalendar
                        mode="single"
                        selected={startDt ?? undefined}
                        defaultMonth={startDt ?? undefined}
                        locale={dateLocale}
                        onSelect={(d) => {
                          if (!d) return;
                          const base = startDt ?? new Date();
                          const dur = durationMin && durationMin > 0 ? durationMin : 30;
                          const newStart = set(base, { year: d.getFullYear(), month: d.getMonth(), date: d.getDate() });
                          const newEnd = addMinutes(newStart, dur);
                          applyChange({ start: toLocalISOString(newStart), end: toLocalISOString(newEnd) }, t('toasts.appointmentUpdated'));
                          setEditingField(null);
                        }}
                        initialFocus
                      />
                    }
                  />
                  <EditableDetailRow
                    icon={Clock}
                    label={tColumns('time')}
                    value={`${displayAppointment.time}${endTime ? ` → ${endTime}` : ''}`}
                    detail={durationHHmm ? `${tPanel('duration')}: ${durationHHmm}` : undefined}
                    editLabel={tColumns('time')}
                    isEditing={editingField === 'time'}
                    onEditingChange={(o) => setEditingField(o ? 'time' : null)}
                    picker={
                      <TimeEditor
                        startDate={startDt ?? new Date()}
                        durationMin={durationMin && durationMin > 0 ? durationMin : 30}
                        isSaving={isReassignSaving}
                        labels={{ start: tColumns('time'), duration: tPanel('duration'), end: tPanel('endTime') }}
                        onApply={(s, e) => applyChange({ start: toLocalISOString(s), end: toLocalISOString(e) }, t('toasts.appointmentUpdated'))}
                      />
                    }
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

                {/* Services — editable inline: add / remove / swap */}
                <div className="flex w-full items-start gap-3 border-b border-border/70 py-3 text-left md:col-span-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted/60 text-muted-foreground">
                    <Layers className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {tPanel('servicesCount', { count: apptServices.length })}
                      </span>
                      <Popover open={editingField === 'services'} onOpenChange={(o) => setEditingField(o ? 'services' : null)}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground">
                            <Plus className="h-3.5 w-3.5" />
                            {tPanel('addService')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72 p-0">
                          <InlineServicePicker
                            selected={apptServices}
                            onToggle={handleToggleService}
                            searchPlaceholder={tInline('searchService')}
                            emptyText={tInline('noServices')}
                            createLabel={(name) => tInline('createService', { name })}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {apptServices.length === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">{tPanel('noServices')}</p>
                    ) : (
                      <div className="mt-1 flex flex-col">
                        {apptServices.map((service) => (
                          <div
                            key={service.id}
                            className="flex w-full items-center gap-2 border-b border-dashed border-border/70 py-2 last:border-b-0"
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: service.color || STATUS_ACCENT_COLOR.confirmed }}
                            />
                            <button
                              type="button"
                              onClick={() => openServiceDetail(service)}
                              className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                            >
                              {service.name}
                            </button>
                            {service.duration_minutes ? (
                              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                {tPanel('durationMinutes', { minutes: service.duration_minutes })}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleRemoveService(service)}
                              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                              aria-label={tPanel('removeService')}
                              title={tPanel('removeService')}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <EditableDetailRow
                  icon={StickyNote}
                  label={t('contextMenu.notes')}
                  value={
                    displayAppointment.notes
                      ? <span className="whitespace-pre-wrap font-medium">{displayAppointment.notes}</span>
                      : <span className="text-muted-foreground">{tPanel('addNotes')}</span>
                  }
                  editLabel={t('contextMenu.notes')}
                  isEditing={editingField === 'notes'}
                  onEditingChange={(o) => setEditingField(o ? 'notes' : null)}
                  className="md:col-span-2"
                  picker={
                    <NotesEditor
                      value={displayAppointment.notes ?? ''}
                      isSaving={isReassignSaving}
                      saveLabel={tPanel('save')}
                      placeholder={tPanel('addNotes')}
                      onSave={(notes) => { applyChange({ notes }, t('toasts.appointmentUpdated')); setEditingField(null); }}
                    />
                  }
                />
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

              {/* Quote section — always visible so a quote can be associated/created */}
              {(
                <section className="mt-6 border-t border-border pt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-base font-semibold">{tColumns('quoteDocNo')}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Popover open={editingField === 'quote'} onOpenChange={(o) => { setEditingField(o ? 'quote' : null); if (o) void loadPatientQuotes(); }}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-xs">
                            <Layers className="h-3.5 w-3.5" />
                            {displayAppointment.quote_id ? t('contextMenu.changeQuote') : t('contextMenu.linkQuote')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[26rem] max-w-[calc(100vw-2rem)] p-0">
                          <InlineEntityPicker
                            className="border-0"
                            items={[
                              { id: '__none__', name: t('contextMenu.unlinkQuote') },
                              ...patientQuotes.map((q) => {
                                const statusLabel = q.paymentStatus === 'paid'
                                  ? tPanel('paid')
                                  : (q.amountInvoiced > 0 || (q.billingStatus && q.billingStatus !== 'not invoiced'))
                                    ? tPanel('invoiced')
                                    : t('notInvoiced');
                                return { id: q.id, name: `${q.doc_no || q.id} · ${q.currency} ${q.total.toLocaleString()} — ${statusLabel}` };
                              }),
                            ]}
                            selectedId={displayAppointment.quote_id}
                            onSelect={(id) => {
                              const q = id === '__none__' ? null : patientQuotes.find((x) => x.id === id);
                              applyChange({ quote: q ? { id: q.id, doc_no: q.doc_no } : null }, t('toasts.appointmentUpdated'));
                              setEditingField(null);
                            }}
                            isLoading={isLoadingQuotes}
                            isSaving={isReassignSaving}
                            searchPlaceholder={t('contextMenu.searchQuote')}
                            emptyText={t('contextMenu.noQuotes')}
                          />
                        </PopoverContent>
                      </Popover>
                      {onCreateQuote && (
                        <Button type="button" size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => onCreateQuote(displayAppointment)}>
                          <FileText className="h-3.5 w-3.5" />
                          {t('contextMenu.newQuote')}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Quote row */}
                  {displayAppointment.quote_id && (
                    <button
                      type="button"
                      onClick={() => setIsQuoteSheetOpen(true)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-muted/35"
                    >
                      <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-mono text-xs font-semibold">
                          {displayAppointment.quote_doc_no || displayAppointment.quote_id}
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
                    return invoicesToShow.map((inv) => (
                      <InvoiceCard
                        key={inv.id}
                        inv={inv}
                        payments={paymentsMap[inv.id] ?? []}
                        defaultExpanded={invoicesToShow.length === 1}
                        noPaymentsLabel={tPanel('noPaymentsRecorded')}
                        paidLabel={tPanel('paid')}
                        unpaidLabel={tPanel('unpaid')}
                        pendingLabel={tAccount('pending')}
                        totalLabel={tPanel('total')}
                      />
                    ));
                  })()}

                  {/* No financial info at all */}
                  {!displayAppointment.quote_id && !appointment.invoice_id && !directInvoice && !isLoadingQuoteInfo && (
                    <p className="text-xs text-muted-foreground">{tPanel('noQuoteLinked')}</p>
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
      {displayAppointment.quote_id && (
        <QuoteDetailSheet
          open={isQuoteSheetOpen}
          onOpenChange={setIsQuoteSheetOpen}
          quoteId={displayAppointment.quote_id}
          quoteDocNo={displayAppointment.quote_doc_no}
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
