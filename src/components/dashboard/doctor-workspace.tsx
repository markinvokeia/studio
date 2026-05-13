'use client';

import * as React from 'react';

import { ClinicSessionDialog, ClinicSessionFormData } from '@/components/clinic-session-dialog';
import { DoctorAgentChat } from '@/components/dashboard/doctor-agent-chat';
import { DentalRecordViewer } from '@/components/users/dental-record/dental-record-viewer';
import { CONDITION_MAP } from '@/components/users/dental-record/condition-toolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeAppointmentStatus, STATUS_ACCENT_COLOR, STATUS_BADGE_VARIANT } from '@/constants/appointment-status';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useDoctorAlertStyle } from '@/hooks/use-doctor-alert-style';
import { useToast } from '@/hooks/use-toast';
import { useClinicHistory } from '@/hooks/useClinicHistory';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { usePermissions } from '@/hooks/usePermissions';
import { Appointment, AppointmentStatus, DoctorAgentAction, PatientSession, QuoteItem, TreatmentDetail } from '@/lib/types';
import { canManageDoctorWorkspaceSessions } from '@/lib/permissions';
import { cn, formatDate } from '@/lib/utils';
import { api } from '@/services/api';
import { updateAppointmentStatusRequest } from '@/services/appointments';
import { getQuoteItems } from '@/services/quotes';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileText,
  Heart,
  RefreshCw,
  Sparkles,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

type PatientAlertTag = {
  label: string;
  type: 'allergy' | 'condition';
};

interface DoctorWorkspaceProps {
  locale: string;
}

type DoctorAgentActionResult = {
  success: boolean;
  message?: string;
};

interface DoctorPatientTimelineProps {
  linkedAppointmentId?: string;
  sessions: PatientSession[];
  isLoading: boolean;
}

const AUTO_REFRESH_MS = 60_000;
const KNOWN_APPOINTMENTS_STORAGE_PREFIX = 'doctor-workspace:known-appointments';
const APPOINTMENT_STATUSES_STORAGE_PREFIX = 'doctor-workspace:appointment-statuses';
const LOCALLY_UPDATED_STORAGE_PREFIX = 'doctor-workspace:locally-updated';
const LOCALLY_UPDATED_TTL_MS = 120_000;
const TIMELINE_MIN_BLOCK_HEIGHT = 74;
const TIMELINE_BASE_GAP = 14;
const TIMELINE_MAX_GAP = 34;
const TIMELINE_HIDDEN_MARKER_LANE_HEIGHT = 28;

function getAppointmentStatusVariant(status: AppointmentStatus) {
  return (STATUS_BADGE_VARIANT[status] ?? 'default') as
    | 'default'
    | 'success'
    | 'destructive'
    | 'info'
    | 'warning'
    | 'secondary'
    | 'outline';
}

function getTimeRangeLabel(appointment: Appointment): string {
  const startTime = appointment.time || '00:00';
  const endTime = appointment.end?.dateTime
    ? format(parseISO(appointment.end.dateTime.replace(/Z$/, '')), 'HH:mm')
    : undefined;

  return endTime ? `${startTime} - ${endTime}` : startTime;
}

function parseTimeToMinutes(value?: string): number {
  if (!value) return 0;

  const [hours = '0', minutes = '0'] = value.split(':');
  return (Number.parseInt(hours, 10) || 0) * 60 + (Number.parseInt(minutes, 10) || 0);
}

function getAppointmentDurationMinutes(appointment: Appointment): number {
  const startMinutes = parseTimeToMinutes(appointment.time);

  if (appointment.end?.dateTime) {
    const parsedEnd = parseISO(appointment.end.dateTime.replace(/Z$/, ''));
    if (!Number.isNaN(parsedEnd.getTime())) {
      const endMinutes = parsedEnd.getHours() * 60 + parsedEnd.getMinutes();
      if (endMinutes > startMinutes) return endMinutes - startMinutes;
    }
  }

  const totalServiceDuration = appointment.services?.reduce((sum, service) => {
    const duration = Number(service.duration_minutes || 0);
    return sum + (Number.isFinite(duration) ? duration : 0);
  }, 0) ?? 0;

  return Math.max(totalServiceDuration, 30);
}

function getAppointmentAccentColor(appointment: Appointment, status: AppointmentStatus): string {
  return appointment.color || STATUS_ACCENT_COLOR[status] || '#64748b';
}

function estimateAgendaCardMinHeight(appointment: Appointment): number {
  const serviceLabel = appointment.services?.length
    ? appointment.services.map((service) => service.name).join(', ')
    : appointment.service_name || appointment.summary || '';

  let minHeight = 88;

  if (appointment.calendar_name) minHeight += 16;
  if (appointment.notes) minHeight += 34;

  return minHeight;
}

type AgendaTimelineLayout = {
  appointment: Appointment;
  accentColor: string;
  endMinutes: number;
  gapAfter: number;
  height: number;
  key: string;
  startMinutes: number;
  top: number;
};

interface DoctorAgendaTimelineProps {
  appointments: Appointment[];
  isLoading: boolean;
  onSelect: (appointmentId: string) => void;
  selectedAppointmentId?: string | null;
}

function DoctorAgendaTimeline({
  appointments,
  isLoading,
  onSelect,
  selectedAppointmentId,
}: DoctorAgendaTimelineProps) {
  const t = useTranslations('DoctorWorkspace');
  const tStatus = useTranslations('AppointmentStatus');
  const [showPastAppointments, setShowPastAppointments] = React.useState(false);

  const timeline = React.useMemo(() => {
    const sortedAppointments = [...appointments].sort((left, right) => left.time.localeCompare(right.time));
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const appointmentRanges = sortedAppointments.map((appointment) => {
      const startMinutes = parseTimeToMinutes(appointment.time);
      const endMinutes = startMinutes + getAppointmentDurationMinutes(appointment);
      return {
        appointment,
        startMinutes,
        endMinutes,
      };
    });

    let cursorTop = 0;
    const layouts: AgendaTimelineLayout[] = appointmentRanges.map(({ appointment, startMinutes, endMinutes }, index) => {
      const durationMinutes = Math.max(endMinutes - startMinutes, 15);
      const contentMinHeight = estimateAgendaCardMinHeight(appointment);
      const height = Math.max(TIMELINE_MIN_BLOCK_HEIGHT, contentMinHeight, 58 + durationMinutes * 0.45);
      const previousEndMinutes = index > 0 ? appointmentRanges[index - 1].endMinutes : null;
      const naturalGapMinutes = previousEndMinutes == null ? 0 : Math.max(startMinutes - previousEndMinutes, 0);
      const gapBefore = previousEndMinutes == null
        ? 0
        : Math.min(TIMELINE_MAX_GAP, TIMELINE_BASE_GAP + naturalGapMinutes * 0.06);
      cursorTop += gapBefore;
      const top = cursorTop;
      cursorTop += height;

      const nextStartMinutes = appointmentRanges[index + 1]?.startMinutes;
      const gapAfterMinutes = nextStartMinutes == null ? 0 : Math.max(nextStartMinutes - endMinutes, 0);
      const gapAfter = nextStartMinutes == null
        ? 0
        : Math.min(TIMELINE_MAX_GAP, TIMELINE_BASE_GAP + gapAfterMinutes * 0.06);

      return {
        appointment,
        startMinutes,
        endMinutes,
        top,
        height,
        gapAfter,
        key: `${appointment.id}-${startMinutes}-${index}`,
        accentColor: getAppointmentAccentColor(appointment, normalizeAppointmentStatus(appointment.status)),
      };
    });

    const timelineHeight = Math.max(0, layouts.at(-1)?.top ?? 0) + Math.max(layouts.at(-1)?.height ?? 0, 0);

    const currentLayoutIndex = layouts.findIndex((layout) => currentMinutes >= layout.startMinutes && currentMinutes <= layout.endMinutes);
    let currentTimeTop = 0;
    let showCurrentTime = false;

    if (layouts.length > 0) {
      const firstLayout = layouts[0];
      const lastLayout = layouts[layouts.length - 1];

      if (currentMinutes >= firstLayout.startMinutes && currentMinutes <= lastLayout.endMinutes) {
        showCurrentTime = true;
      } else if (currentMinutes < firstLayout.startMinutes) {
        showCurrentTime = true;
        currentTimeTop = Math.max(firstLayout.top - 10, 0);
      } else if (currentMinutes > lastLayout.endMinutes) {
        showCurrentTime = true;
        currentTimeTop = lastLayout.top + lastLayout.height;
      }
    }

    if (showCurrentTime) {
      if (currentLayoutIndex >= 0) {
        const layout = layouts[currentLayoutIndex];
        const totalMinutes = Math.max(layout.endMinutes - layout.startMinutes, 1);
        const progress = (currentMinutes - layout.startMinutes) / totalMinutes;
        currentTimeTop = layout.top + layout.height * progress;
      } else {
        for (let index = 0; index < layouts.length - 1; index += 1) {
          const currentLayout = layouts[index];
          const nextLayout = layouts[index + 1];

          if (currentMinutes > currentLayout.endMinutes && currentMinutes < nextLayout.startMinutes) {
            const gapMinutes = Math.max(nextLayout.startMinutes - currentLayout.endMinutes, 1);
            const progress = (currentMinutes - currentLayout.endMinutes) / gapMinutes;
            currentTimeTop = currentLayout.top + currentLayout.height + currentLayout.gapAfter * progress;
            break;
          }
        }
      }
    }

    return {
      currentMinutes,
      currentTimeLabel: format(now, 'HH:mm'),
      currentTimeTop,
      timelineHeight,
      layouts,
      showCurrentTime,
    };
  }, [appointments]);

  const focusAppointmentId = React.useMemo(() => {
    if (timeline.layouts.length === 0) return null;

    const inProgress = timeline.layouts.find((layout) =>
      timeline.currentMinutes >= layout.startMinutes && timeline.currentMinutes <= layout.endMinutes,
    );
    if (inProgress) return inProgress.appointment.id;

    const upcoming = timeline.layouts.find((layout) => layout.startMinutes >= timeline.currentMinutes);
    if (upcoming) return upcoming.appointment.id;

    return timeline.layouts[timeline.layouts.length - 1]?.appointment.id ?? null;
  }, [timeline.currentMinutes, timeline.layouts]);

  const visibleTimeline = React.useMemo(() => {
    const focusIndex = focusAppointmentId
      ? timeline.layouts.findIndex((layout) => layout.appointment.id === focusAppointmentId)
      : -1;
    const pastCount = Math.max(focusIndex, 0);
    const firstVisibleLayout = focusIndex >= 0 ? timeline.layouts[focusIndex] : null;
    const hiddenRangeStart = timeline.layouts[0]?.startMinutes ?? 0;
    const hiddenRangeEnd = firstVisibleLayout?.startMinutes ?? hiddenRangeStart;
    const hiddenRangeSpan = Math.max(hiddenRangeEnd - hiddenRangeStart, 1);
    const hiddenCurrentTimeRatio = !showPastAppointments
      && pastCount > 0
      && timeline.currentMinutes >= hiddenRangeStart
      && timeline.currentMinutes < hiddenRangeEnd
      ? (timeline.currentMinutes - hiddenRangeStart) / hiddenRangeSpan
      : null;

    if (timeline.layouts.length === 0) {
      return {
        currentTimeTop: timeline.currentTimeTop,
        hiddenCount: pastCount,
        hiddenCurrentTimeRatio,
        isCurrentTimeHiddenBeforeVisible: false,
        laneOffset: 0,
        layouts: timeline.layouts,
        showCurrentTime: timeline.showCurrentTime,
        timelineHeight: timeline.timelineHeight,
      };
    }

    if (showPastAppointments) {
      return {
        currentTimeTop: timeline.currentTimeTop,
        hiddenCount: pastCount,
        hiddenCurrentTimeRatio,
        isCurrentTimeHiddenBeforeVisible: false,
        laneOffset: 0,
        layouts: timeline.layouts,
        showCurrentTime: timeline.showCurrentTime,
        timelineHeight: timeline.timelineHeight,
      };
    }

    if (focusIndex <= 0) {
      return {
        currentTimeTop: timeline.currentTimeTop,
        hiddenCount: pastCount,
        hiddenCurrentTimeRatio,
        isCurrentTimeHiddenBeforeVisible: false,
        laneOffset: 0,
        layouts: timeline.layouts,
        showCurrentTime: timeline.showCurrentTime,
        timelineHeight: timeline.timelineHeight,
      };
    }

    const focusTop = timeline.layouts[focusIndex].top;
    const visibleLayouts = timeline.layouts.slice(focusIndex).map((layout) => ({
      ...layout,
      top: layout.top - focusTop,
    }));
    const lastLayout = visibleLayouts[visibleLayouts.length - 1];
    const laneOffset = hiddenCurrentTimeRatio != null ? TIMELINE_HIDDEN_MARKER_LANE_HEIGHT : 0;
    const timelineHeight = (lastLayout?.top ?? 0) + (lastLayout?.height ?? 0) + laneOffset;
    const isCurrentTimeHiddenBeforeVisible = hiddenCurrentTimeRatio != null;

    return {
      currentTimeTop: isCurrentTimeHiddenBeforeVisible
        ? 0
        : Math.max(timeline.currentTimeTop - focusTop, 0),
      hiddenCount: pastCount,
      hiddenCurrentTimeRatio,
      isCurrentTimeHiddenBeforeVisible,
      laneOffset,
      layouts: visibleLayouts,
      showCurrentTime: timeline.showCurrentTime && !isCurrentTimeHiddenBeforeVisible,
      timelineHeight,
    };
  }, [
    focusAppointmentId,
    showPastAppointments,
    timeline.currentMinutes,
    timeline.currentTimeTop,
    timeline.layouts,
    timeline.showCurrentTime,
    timeline.timelineHeight,
  ]);

  React.useEffect(() => {
    setShowPastAppointments(false);
  }, [appointments]);

  const pastSeparatorTop = (() => {
    if (!showPastAppointments || visibleTimeline.hiddenCount === 0) return null;
    const focusIdx = visibleTimeline.layouts.findIndex(
      (l) => l.appointment.id === focusAppointmentId,
    );
    if (focusIdx <= 0) return null;
    const lastPast = visibleTimeline.layouts[focusIdx - 1];
    const firstCurrent = visibleTimeline.layouts[focusIdx];
    return (
      lastPast.top +
      lastPast.height +
      (firstCurrent.top - lastPast.top - lastPast.height) / 2 +
      visibleTimeline.laneOffset
    );
  })();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-[1.75rem]" />
        <Skeleton className="h-24 w-full rounded-[1.75rem]" />
        <Skeleton className="h-24 w-full rounded-[1.75rem]" />
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-border bg-muted/20 p-8 text-center">
        <p className="text-sm font-medium text-foreground">{t('agenda.emptyTitle')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('agenda.emptyDescription')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="max-h-[60vh] overflow-y-auto overscroll-contain py-2 xl:max-h-none xl:flex-1">
        {visibleTimeline.hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowPastAppointments((current) => !current)}
            className="mb-4 flex w-full items-center gap-3 transition-opacity hover:opacity-80"
          >
            <div className="h-px flex-1 bg-border" />
            <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-3 py-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                {showPastAppointments
                  ? t('agenda.hideHistory')
                  : t('agenda.hiddenPastAppointments', { count: visibleTimeline.hiddenCount })}
              </span>
              <ChevronDown
                className={cn(
                  'h-3 w-3 text-muted-foreground transition-transform duration-200',
                  showPastAppointments && 'rotate-180',
                )}
              />
            </div>
            <div className="h-px flex-1 bg-border" />
          </button>
        ) : null}

        <div className="relative" style={{ height: visibleTimeline.timelineHeight }}>
          {pastSeparatorTop !== null && (
            <div
              className="absolute inset-x-0 z-30 flex items-center gap-2"
              style={{ top: pastSeparatorTop }}
            >
              <div className="ml-9 flex-1 border-t border-dashed border-border/60" />
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t('agenda.historyHidden')}
              </span>
              <div className="w-2 border-t border-dashed border-border/60" />
            </div>
          )}

          <div className="absolute bottom-0 left-4 top-0 w-px bg-gradient-to-b from-border/20 via-border/70 to-border/20" />

          {visibleTimeline.hiddenCurrentTimeRatio != null ? (
            <div className="absolute inset-x-0 z-20" style={{ top: TIMELINE_HIDDEN_MARKER_LANE_HEIGHT / 2 }}>
              <div className="relative h-0">
                <div className="absolute left-4 right-0 top-0 h-px bg-rose-300/90" />
                <div className="absolute left-4 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.12)]" />
                <span className="absolute top-0 -translate-y-full rounded bg-background/90 px-1 text-[9px] font-bold tabular-nums text-rose-500 leading-none" style={{ left: 'calc(1rem + 0.75rem)' }}>
                  {timeline.currentTimeLabel}
                </span>
              </div>
            </div>
          ) : null}

          {visibleTimeline.showCurrentTime && (
            <div className="absolute inset-x-0 z-20" style={{ top: visibleTimeline.currentTimeTop + visibleTimeline.laneOffset }}>
              <div className="relative h-0">
                <div className="absolute left-4 right-0 top-0 border-t border-dashed border-rose-400/60" />
                <div className="absolute left-4 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.12)]" />
                <span className="absolute top-0 -translate-y-full rounded bg-background/90 px-1 text-[9px] font-bold tabular-nums text-rose-500 leading-none" style={{ left: 'calc(1rem + 0.75rem)' }}>
                  {timeline.currentTimeLabel}
                </span>
              </div>
            </div>
          )}

          {visibleTimeline.layouts.map((layout) => {
            const normalizedStatus = normalizeAppointmentStatus(layout.appointment.status);
            const isSelected = selectedAppointmentId === layout.appointment.id;
            const isInProgress = timeline.currentMinutes >= layout.startMinutes && timeline.currentMinutes <= layout.endMinutes;
            const isPast = !isInProgress && layout.endMinutes < timeline.currentMinutes;
            const serviceLabel = layout.appointment.services?.length
              ? layout.appointment.services.map((service) => service.name).join(', ')
              : layout.appointment.service_name || layout.appointment.summary || t('agenda.unknownPatient');
            const showNotes = Boolean(layout.appointment.notes);

            return (
              <div
                key={layout.key}
                className="absolute inset-x-0 z-10"
                style={{ top: layout.top + visibleTimeline.laneOffset, height: layout.height }}
              >
                {/* Dot on the vertical line */}
                <div
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-300"
                  style={{
                    left: '1rem',
                    top: '1.25rem',
                    width: isInProgress ? '0.875rem' : '0.625rem',
                    height: isInProgress ? '0.875rem' : '0.625rem',
                    backgroundColor: isPast ? 'hsl(var(--muted-foreground))' : layout.accentColor,
                    opacity: isPast ? 0.35 : 1,
                    boxShadow: isInProgress && !isPast
                      ? `0 0 0 2px hsl(var(--background)), 0 0 0 5px ${layout.accentColor}40`
                      : isPast
                        ? `0 0 0 2px hsl(var(--background))`
                        : `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${layout.accentColor}30`,
                  }}
                />

                {/* Card */}
                <button
                  type="button"
                  onClick={() => onSelect(layout.appointment.id)}
                  className={cn(
                    'absolute left-9 right-0 h-full rounded-xl text-left transition-all duration-300',
                    'border bg-card',
                    isSelected ? 'shadow-lg' : 'shadow-sm hover:shadow-md border-border/40 hover:border-border/60',
                    isPast && 'opacity-50',
                  )}
                  style={isSelected && !isPast ? { borderColor: layout.accentColor } : undefined}
                >
                  <div className="relative h-full overflow-hidden rounded-xl">
                    <span
                      className="absolute left-0 top-0 h-full transition-all duration-300"
                      style={{
                        width: isSelected ? '4px' : '2px',
                        backgroundColor: layout.accentColor,
                        opacity: isPast ? 0.3 : (isSelected ? 1 : 0.4),
                      }}
                    />

                    <div className="flex h-full flex-col px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold leading-tight text-foreground">
                            {layout.appointment.patientName || t('agenda.unknownPatient')}
                          </p>
                          <p className="mt-0.5 truncate text-xs leading-5 text-muted-foreground">
                            {serviceLabel}
                          </p>
                        </div>
                        <Badge variant={getAppointmentStatusVariant(normalizedStatus)} className="shrink-0 capitalize text-[10px] h-5 px-1.5">
                          {tStatus(normalizedStatus)}
                        </Badge>
                      </div>

                      {showNotes ? (
                        <p className="mt-1.5 line-clamp-1 text-xs leading-relaxed text-muted-foreground">
                          {layout.appointment.notes}
                        </p>
                      ) : null}

                      <div className="mt-auto flex items-center justify-between pt-2">
                        <span className="text-xs font-medium tabular-nums text-muted-foreground">
                          {getTimeRangeLabel(layout.appointment)}
                        </span>
                        <span className="text-[10px] tabular-nums text-muted-foreground/55">
                          {getAppointmentDurationMinutes(layout.appointment)} min
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getKnownAppointmentsStorageKey(doctorId: string, dateKey: string): string {
  return `${KNOWN_APPOINTMENTS_STORAGE_PREFIX}:${doctorId}:${dateKey}`;
}

function readKnownAppointmentIds(storageKey: string): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue.map((value) => String(value)) : [];
  } catch (error) {
    console.error('Failed to read known doctor appointments:', error);
    return [];
  }
}

function writeKnownAppointmentIds(storageKey: string, appointmentIds: string[]) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(appointmentIds));
  } catch (error) {
    console.error('Failed to store known doctor appointments:', error);
  }
}

type StatusChangedAlertItem = {
  appointment: Appointment;
  previousStatus: AppointmentStatus;
};

function getAppointmentStatusesStorageKey(doctorId: string, dateKey: string): string {
  return `${APPOINTMENT_STATUSES_STORAGE_PREFIX}:${doctorId}:${dateKey}`;
}

function readAppointmentStatuses(storageKey: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAppointmentStatuses(storageKey: string, statuses: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(statuses));
  } catch (error) {
    console.error('Failed to store appointment statuses:', error);
  }
}

function getLocallyUpdatedStorageKey(doctorId: string): string {
  return `${LOCALLY_UPDATED_STORAGE_PREFIX}:${doctorId}`;
}

function readLocallyUpdatedIds(doctorId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(getLocallyUpdatedStorageKey(doctorId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.ids)) return new Set();
    if (typeof parsed.expiresAt === 'number' && Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(getLocallyUpdatedStorageKey(doctorId));
      return new Set();
    }
    return new Set<string>(parsed.ids.map(String));
  } catch {
    return new Set();
  }
}

function markAppointmentLocallyUpdated(doctorId: string, appointmentId: string) {
  if (typeof window === 'undefined') return;
  try {
    const existing = readLocallyUpdatedIds(doctorId);
    existing.add(appointmentId);
    window.localStorage.setItem(
      getLocallyUpdatedStorageKey(doctorId),
      JSON.stringify({ ids: Array.from(existing), expiresAt: Date.now() + LOCALLY_UPDATED_TTL_MS }),
    );
  } catch (error) {
    console.error('Failed to mark appointment as locally updated:', error);
  }
}

async function getAppointmentsForDoctorToday(doctorId: string): Promise<Appointment[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const formatDateForAPI = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss');

  const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
    doctor_id: doctorId,
    startingDateAndTime: formatDateForAPI(startOfDay),
    endingDateAndTime: formatDateForAPI(endOfDay),
  });

  let rawAppointments: any[] = [];
  if (Array.isArray(data) && data.length > 0 && 'json' in data[0]) {
    rawAppointments = data.map((item: any) => item.json);
  } else if (Array.isArray(data)) {
    rawAppointments = data;
  }

  return rawAppointments
    .map((apiAppointment: any): Appointment | null => {
      const startNode = apiAppointment.start_time || apiAppointment.start;
      const startDateTime = typeof startNode === 'string' ? startNode : startNode?.dateTime;
      if (!startDateTime) return null;

      const parsedStart = parseISO(startDateTime.replace(/Z$/, ''));
      if (Number.isNaN(parsedStart.getTime())) return null;

      const endNode = apiAppointment.end_time || apiAppointment.end;
      const doctorIdValue = apiAppointment.doctor_id || apiAppointment.doctorId || apiAppointment.doctorid || doctorId;

      return {
        id: String(apiAppointment.appointment_id || apiAppointment.appointmentId || apiAppointment.id || ''),
        patientId: String(apiAppointment.patient_id || apiAppointment.patientId || apiAppointment.patientid || ''),
        patientName: apiAppointment.patient_name || apiAppointment.patientName || apiAppointment.patientname || '',
        patientEmail: apiAppointment.patient_email || apiAppointment.patientEmail || apiAppointment.patientemail || '',
        patientPhone: apiAppointment.patient_phone || apiAppointment.patientPhone || apiAppointment.patientphone || '',
        doctorId: String(doctorIdValue),
        doctorName: apiAppointment.doctor_name || apiAppointment.doctorName || apiAppointment.doctorname || '',
        doctorEmail: apiAppointment.doctor_email || apiAppointment.doctorEmail || apiAppointment.doctoremail || '',
        summary: apiAppointment.summary || '',
        service_name: apiAppointment.summary || '',
        description: apiAppointment.description || '',
        notes: apiAppointment.notes || '',
        date: format(parsedStart, 'yyyy-MM-dd'),
        time: format(parsedStart, 'HH:mm'),
        status: normalizeAppointmentStatus(apiAppointment.status),
        created_at: apiAppointment.created_at || apiAppointment.createdAt || '',
        google_calendar_id: apiAppointment.google_calendar_id || undefined,
        googleEventId: apiAppointment.google_event_id || apiAppointment.googleEventId || apiAppointment.id,
        calendar_source_id: apiAppointment.calendar_source_id != null ? String(apiAppointment.calendar_source_id) : '',
        calendar_name: apiAppointment.calendar_name || apiAppointment.organizer?.displayName || '',
        color: apiAppointment.color,
        colorId: String(apiAppointment.color_id || apiAppointment.colorId || ''),
        start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
        end: typeof endNode === 'string' ? { dateTime: endNode } : endNode,
        services: Array.isArray(apiAppointment.services)
          ? apiAppointment.services.map((service: any) => ({
              id: String(service.id),
              name: service.name || '',
              price: Number(service.price || 0),
              category: '',
              duration_minutes: 30,
              is_active: true,
            }))
          : [],
        quote_id: apiAppointment.quote_id || apiAppointment.quoteId || undefined,
        quote_doc_no: apiAppointment.quote_doc_no || apiAppointment.quoteDocNo || undefined,
      } as Appointment;
    })
    .filter((appointment): appointment is Appointment => appointment !== null)
    .sort((left, right) => left.time.localeCompare(right.time));
}

function DoctorPatientTimeline({ linkedAppointmentId, sessions, isLoading }: DoctorPatientTimelineProps) {
  const t = useTranslations('DoctorWorkspace');
  const tTimeline = useTranslations('ClinicHistoryPage.timeline');
  const [openItems, setOpenItems] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (sessions.length === 0) {
      setOpenItems([]);
      return;
    }

    const latestSessionId = String(sessions[0].sesion_id);
    setOpenItems((current) => {
      if (current.includes(latestSessionId)) return current;
      return [latestSessionId];
    });
  }, [sessions]);

  const toggleItem = React.useCallback((sessionId: string) => {
    setOpenItems((current) => (
      current.includes(sessionId)
        ? current.filter((item) => item !== sessionId)
        : [...current, sessionId]
    ));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full rounded-[1.5rem]" />
        <Skeleton className="h-24 w-full rounded-[1.5rem]" />
        <Skeleton className="h-24 w-full rounded-[1.5rem]" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-border bg-muted/20 p-8 text-center">
        <p className="text-sm font-medium text-foreground">{tTimeline('noSessions')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('focus.timelineEmptyDescription')}</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-3">
      <div className="absolute bottom-0 left-[3.5rem] top-0 w-px bg-gradient-to-b from-transparent via-border/60 to-transparent" />
      {sessions.map((session, index) => {
        const sessionId = String(session.sesion_id);
        const isOpen = openItems.includes(sessionId);
        const hasTreatments = Array.isArray(session.tratamientos) && session.tratamientos.length > 0;
        const hasAttachments = Array.isArray(session.archivos_adjuntos) && session.archivos_adjuntos.length > 0;
        const isLinkedToCurrentAppointment = Boolean(linkedAppointmentId && String(session.appointment_id ?? '') === linkedAppointmentId);
        const SessionIcon = session.tipo_sesion === 'odontograma' ? Heart : Stethoscope;

        let dateLabel = '—';
        let yearLabel = '';
        try {
          const parsed = session.fecha_sesion ? new Date(session.fecha_sesion) : null;
          if (parsed && !Number.isNaN(parsed.getTime())) {
            dateLabel = format(parsed, 'd MMM');
            yearLabel = format(parsed, 'yyyy');
          }
        } catch {}

        return (
          <Collapsible key={session.sesion_id} open={isOpen} onOpenChange={() => toggleItem(sessionId)}>
            <div className="relative flex items-start gap-3 pl-[4.75rem]">
              {/* Date + dot in the left gutter */}
              <div className="absolute left-0 top-0 flex items-center gap-1.5">
                <div className="w-10 text-right">
                  <p className="text-[11px] font-semibold leading-tight text-foreground/75 tabular-nums">{dateLabel}</p>
                  <p className="text-[9px] font-medium text-muted-foreground/60 tabular-nums">{yearLabel}</p>
                </div>
                <div className={cn(
                  'z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-background shadow-md',
                  isLinkedToCurrentAppointment ? 'bg-primary' : 'bg-muted-foreground/15',
                )}>
                  <SessionIcon className={cn('h-3 w-3', isLinkedToCurrentAppointment ? 'text-primary-foreground' : 'text-muted-foreground')} />
                </div>
              </div>
              <Card className={cn(
                'min-w-0 flex-1 transition-all duration-200',
                isLinkedToCurrentAppointment
                  ? 'border border-primary/20 bg-primary/5 shadow-sm'
                  : 'border border-border/50 bg-card shadow-sm',
              )}>
                <CardHeader className="px-4 pt-3.5 pb-1">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="break-words text-sm font-semibold leading-tight text-foreground">
                      {session.procedimiento_realizado || tTimeline('noTitle')}
                    </CardTitle>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {isLinkedToCurrentAppointment && (
                        <Badge variant="default" className="rounded-full text-[10px] shadow-sm">
                          {t('focus.currentAppointmentBadge')}
                        </Badge>
                      )}
                      {index === 0 && !isLinkedToCurrentAppointment && (
                        <Badge variant="secondary" className="rounded-full border border-sky-200/80 bg-sky-50 text-[10px] font-medium text-sky-700 hover:bg-sky-50">
                          {t('focus.latestSessionBadge')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-full justify-start px-4 py-1 text-xs text-muted-foreground/70 hover:bg-transparent hover:text-foreground">
                    {isOpen ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
                    {isOpen ? tTimeline('hideDetails') : tTimeline('showDetails')}
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="space-y-2.5 px-4 pb-4 pt-2">
                  {session.tipo_sesion === 'odontograma' && session.estado_odontograma && Object.keys(session.estado_odontograma).length > 0 && (() => {
                    const grouped: Record<string, string[]> = {};
                    Object.entries(session.estado_odontograma as Record<string, Record<string, string>>).forEach(([tooth, surfaces]) => {
                      const seen = new Set<string>();
                      Object.values(surfaces).forEach((condition) => {
                        if (!seen.has(condition)) {
                          seen.add(condition);
                          if (!grouped[condition]) grouped[condition] = [];
                          grouped[condition].push(tooth);
                        }
                      });
                    });
                    const entries = Object.entries(grouped);
                    if (entries.length === 0) return null;
                    return (
                      <div className="rounded-lg border-l-[3px] border-violet-400/60 bg-violet-50/60 px-3 py-2.5">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-violet-600/90">
                          {tTimeline('odontogramUpdate')}
                        </p>
                        <div className="space-y-1.5">
                          {entries.map(([condition, teeth]) => {
                            const def = CONDITION_MAP[condition as keyof typeof CONDITION_MAP];
                            const label = def ? tTimeline(`conditions.${condition}` as Parameters<typeof tTimeline>[0]) : condition;
                            return (
                              <div key={condition} className="flex items-center gap-2">
                                {def && (
                                  <span
                                    className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
                                    style={{ backgroundColor: def.color }}
                                  >
                                    {def.icon}
                                  </span>
                                )}
                                <span className="text-xs font-medium text-foreground/80">{label}:</span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {teeth.sort((a, b) => Number(a) - Number(b)).join(', ')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {session.diagnostico && (
                    <div className="rounded-lg border-l-[3px] border-red-400/60 bg-red-50/60 px-3 py-2.5">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-red-500">
                        {tTimeline('diagnosis')}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground">{session.diagnostico}</p>
                    </div>
                  )}
                  {session.notas_clinicas && (
                    <div className="rounded-lg border-l-[3px] border-cyan-400/60 bg-cyan-50/60 px-3 py-2.5">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-600/90">
                        {tTimeline('notes')}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground">{session.notas_clinicas}</p>
                    </div>
                  )}
                  {session.plan_proxima_cita && session.plan_proxima_cita.trim() !== '{}' && (
                    <div className="rounded-lg border-l-[3px] border-blue-400/60 bg-blue-50/60 px-3 py-2.5">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-blue-600/90">
                        {tTimeline('nextPlan')}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground">{session.plan_proxima_cita}</p>
                    </div>
                  )}
                  {hasTreatments && (
                    <div className="rounded-lg border-l-[3px] border-green-500/60 bg-green-50/60 px-3 py-2.5">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-green-600/90">
                        {tTimeline('treatments')}
                      </p>
                      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                        {session.tratamientos.map((treatment, treatmentIndex) => (
                          <div
                            key={`${session.sesion_id}-treatment-${treatmentIndex}`}
                            className="flex min-w-0 items-baseline gap-2"
                          >
                            {treatment.numero_diente ? (
                              <span className="shrink-0 rounded-md border border-primary/15 bg-primary/8 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary/80">
                                {tTimeline('tooth')} {treatment.numero_diente}
                              </span>
                            ) : null}
                            <p className="break-words text-sm leading-relaxed text-muted-foreground">
                              {treatment.descripcion}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasAttachments && (
                    <div className="rounded-lg border-l-[3px] border-amber-500/60 bg-amber-50/60 px-3 py-2.5">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-600/90">
                        {tTimeline('attachments')}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {session.archivos_adjuntos.map((attachment, attachmentIndex) => (
                          <div
                            key={`${session.sesion_id}-attachment-${attachmentIndex}`}
                            className="flex items-center gap-1 rounded border border-muted bg-background px-2 py-1 text-xs"
                          >
                            <FileText className="h-3 w-3 text-amber-500" />
                            {attachment.file_name || attachment.ruta || 'Adjunto'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}

export function DoctorWorkspace({ locale }: DoctorWorkspaceProps) {
  const t = useTranslations('DoctorWorkspace');
  const tStatus = useTranslations('AppointmentStatus');
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const { createSession, updateSession } = useClinicHistory();
  const { toast } = useToast();
  const [alertStyle] = useDoctorAlertStyle(user?.id);
  const alertStyleRef = React.useRef(alertStyle);
  React.useEffect(() => { alertStyleRef.current = alertStyle; }, [alertStyle]);
  const canManageSessions = React.useMemo(() => canManageDoctorWorkspaceSessions(permissions), [permissions]);
  const isMobile = useViewportNarrow(1024);

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string | null>(null);
  const [linkedSession, setLinkedSession] = React.useState<PatientSession | null>(null);
  const [patientSessions, setPatientSessions] = React.useState<PatientSession[]>([]);
  const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);
  const [patientAlertTags, setPatientAlertTags] = React.useState<PatientAlertTag[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = React.useState(true);
  const [isLoadingTimeline, setIsLoadingTimeline] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [clinicSessionOpen, setClinicSessionOpen] = React.useState(false);
  const [mobileDetailsOpen, setMobileDetailsOpen] = React.useState(false);
  const [agentSessionPrefill, setAgentSessionPrefill] = React.useState<{
    doctor_id?: string;
    doctor_name?: string;
    procedimiento_realizado?: string;
    plan_proxima_cita?: string;
    fecha_proxima_cita?: string;
  } | null>(null);
  const [agentSessionTreatments, setAgentSessionTreatments] = React.useState<TreatmentDetail[]>([]);
  const [activePanel, setActivePanel] = React.useState<'sessions' | 'odontogram'>('sessions');
  const [odontogramAutoStart, setOdontogramAutoStart] = React.useState(false);
  const [odontogramPrefill, setOdontogramPrefill] = React.useState<{ description: string; notes: string; marcaciones?: import('@/lib/types').OdontogramMarcacion[] } | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<Date | null>(null);
  const [newAppointmentsAlertOpen, setNewAppointmentsAlertOpen] = React.useState(false);
  const [newAppointmentsAlertItems, setNewAppointmentsAlertItems] = React.useState<Appointment[]>([]);
  const [statusChangedAlertOpen, setStatusChangedAlertOpen] = React.useState(false);
  const [statusChangedAlertItems, setStatusChangedAlertItems] = React.useState<StatusChangedAlertItem[]>([]);
  const contextRequestRef = React.useRef(0);

  const selectedAppointment = React.useMemo(
    () => appointments.find((appointment) => appointment.id === selectedAppointmentId) ?? appointments[0] ?? null,
    [appointments, selectedAppointmentId],
  );

  React.useEffect(() => {
    if (!isMobile) {
      setMobileDetailsOpen(false);
    }
  }, [isMobile]);

  React.useEffect(() => {
    setActivePanel('sessions');
    setOdontogramAutoStart(false);
    setOdontogramPrefill(null);
  }, [selectedAppointmentId]);

  const loadAppointments = React.useCallback(async (background = false) => {
    if (!user?.id) {
      setAppointments([]);
      setIsLoadingAppointments(false);
      return;
    }

    if (background) setIsRefreshing(true);
    else setIsLoadingAppointments(true);

    try {
      const data = await getAppointmentsForDoctorToday(String(user.id));
      const dateKey = formatDate(new Date());
      const storageKey = getKnownAppointmentsStorageKey(String(user.id), dateKey);
      const previousAppointmentIds = readKnownAppointmentIds(storageKey);
      const previousAppointmentIdsSet = new Set(previousAppointmentIds);
      const newAppointments = previousAppointmentIds.length > 0
        ? data.filter((appointment) => !previousAppointmentIdsSet.has(appointment.id))
        : [];

      const statusesStorageKey = getAppointmentStatusesStorageKey(String(user.id), dateKey);
      const previousStatuses = readAppointmentStatuses(statusesStorageKey);
      const locallyUpdatedIds = readLocallyUpdatedIds(String(user.id));
      const changedAppointments: StatusChangedAlertItem[] = Object.keys(previousStatuses).length > 0
        ? data
            .filter((appointment) => {
              const prev = previousStatuses[appointment.id];
              return (
                prev !== undefined &&
                prev !== appointment.status &&
                !locallyUpdatedIds.has(appointment.id) &&
                previousAppointmentIdsSet.has(appointment.id)
              );
            })
            .map((appointment) => ({
              appointment,
              previousStatus: previousStatuses[appointment.id] as AppointmentStatus,
            }))
        : [];

      writeKnownAppointmentIds(storageKey, data.map((appointment) => appointment.id));
      writeAppointmentStatuses(statusesStorageKey, Object.fromEntries(data.map((a) => [a.id, a.status])));

      React.startTransition(() => {
        setAppointments(data);
        setSelectedAppointmentId((current) => {
          if (current && data.some((appointment) => appointment.id === current)) return current;
          return data[0]?.id ?? null;
        });
        setLastUpdatedAt(new Date());
      });

      if (newAppointments.length > 0) {
        if (alertStyleRef.current === 'toast') {
          const first = newAppointments[0];
          toast({
            title: newAppointments.length === 1
              ? t('appointmentAlerts.singleTitle')
              : t('appointmentAlerts.multipleTitle', { count: newAppointments.length }),
            description: newAppointments.length === 1
              ? `${first.patientName} · ${getTimeRangeLabel(first)}`
              : t('appointmentAlerts.multipleDescription', { count: newAppointments.length }),
          });
        } else {
          setNewAppointmentsAlertItems(newAppointments);
          setNewAppointmentsAlertOpen(true);
        }
      }

      if (changedAppointments.length > 0) {
        if (alertStyleRef.current === 'toast') {
          const { appointment: first, previousStatus: firstPrev } = changedAppointments[0];
          toast({
            title: changedAppointments.length === 1
              ? t('statusChangeAlerts.singleTitle')
              : t('statusChangeAlerts.multipleTitle', { count: changedAppointments.length }),
            description: changedAppointments.length === 1
              ? `${first.patientName} · ${tStatus(normalizeAppointmentStatus(firstPrev))} → ${tStatus(normalizeAppointmentStatus(first.status))}`
              : t('statusChangeAlerts.modalMultipleDescription', { count: changedAppointments.length }),
          });
        } else {
          setStatusChangedAlertItems(changedAppointments);
          setStatusChangedAlertOpen(true);
        }
      }
    } catch (error) {
      console.error('Failed to load doctor workspace appointments:', error);
    } finally {
      setIsRefreshing(false);
      setIsLoadingAppointments(false);
    }
  }, [user?.id]);

  const loadLinkedSession = React.useCallback(async (appointment: Appointment | null, requestId?: number) => {
    if (!appointment?.patientId) {
      setLinkedSession(null);
      setPatientSessions([]);
      setIsLoadingTimeline(false);
      return;
    }

    setIsLoadingTimeline(true);
    try {
      const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: appointment.patientId });
      const rawSessions: any[] = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);
      const sessions = rawSessions
        .map((session) => ({ ...session, sesion_id: Number(session.sesion_id) } as PatientSession))
        .sort((left, right) => {
          const leftDate = Date.parse(left.fecha_sesion || '');
          const rightDate = Date.parse(right.fecha_sesion || '');
          return Number.isNaN(rightDate) || Number.isNaN(leftDate) ? 0 : rightDate - leftDate;
        });
      const match = sessions.find((session) => String(session?.appointment_id ?? '') === appointment.id);
      if (requestId != null && requestId !== contextRequestRef.current) return;
      setPatientSessions(sessions);
      setLinkedSession(match ? ({ ...match, sesion_id: Number(match.sesion_id) } as PatientSession) : null);
    } catch (error) {
      console.error('Failed to load linked session:', error);
      if (requestId != null && requestId !== contextRequestRef.current) return;
      setLinkedSession(null);
      setPatientSessions([]);
    } finally {
      if (requestId == null || requestId === contextRequestRef.current) {
        setIsLoadingTimeline(false);
      }
    }
  }, []);

  const loadQuoteItems = React.useCallback(async (appointment: Appointment | null, requestId?: number) => {
    if (!appointment?.quote_id) {
      setQuoteItems([]);
      return;
    }

    try {
      const items = await getQuoteItems(appointment.quote_id);
      if (requestId != null && requestId !== contextRequestRef.current) return;
      setQuoteItems(items);
    } catch (error) {
      console.error('Failed to load quote items for doctor workspace:', error);
      if (requestId != null && requestId !== contextRequestRef.current) return;
      setQuoteItems([]);
    }
  }, []);

  const loadPatientAlertTags = React.useCallback(async (appointment: Appointment | null, requestId?: number) => {
    if (!appointment?.patientId) {
      setPatientAlertTags([]);
      return;
    }

    try {
      const [allergiesData, personalHistoryData] = await Promise.all([
        api.get(API_ROUTES.CLINIC_HISTORY.ALLERGIES, { user_id: appointment.patientId }),
        api.get(API_ROUTES.CLINIC_HISTORY.PERSONAL_HISTORY, { user_id: appointment.patientId }),
      ]);

      if (requestId != null && requestId !== contextRequestRef.current) return;

      const allergiesRaw = Array.isArray(allergiesData)
        ? allergiesData
        : (allergiesData.antecedentes_alergias || allergiesData.data || []);
      const personalHistoryRaw = Array.isArray(personalHistoryData)
        ? personalHistoryData
        : (personalHistoryData.antecedentes_personales || personalHistoryData.data || []);

      const nextTags: PatientAlertTag[] = [
        ...allergiesRaw.map((item: any) => ({
          label: String(item.alergeno || 'N/A'),
          type: 'allergy' as const,
        })),
        ...personalHistoryRaw.map((item: any) => ({
          label: String(item.padecimiento_nombre || item.nombre || 'N/A'),
          type: 'condition' as const,
        })),
      ];

      setPatientAlertTags(nextTags);
    } catch (error) {
      console.error('Failed to load patient alert tags for doctor workspace:', error);
      if (requestId != null && requestId !== contextRequestRef.current) return;
      setPatientAlertTags([]);
    }
  }, []);

  React.useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  React.useEffect(() => {
    if (!selectedAppointment) {
      setLinkedSession(null);
      setPatientSessions([]);
      setQuoteItems([]);
      setPatientAlertTags([]);
      return;
    }

    contextRequestRef.current += 1;
    const requestId = contextRequestRef.current;

    loadLinkedSession(selectedAppointment, requestId);
    loadQuoteItems(selectedAppointment, requestId);
    loadPatientAlertTags(selectedAppointment, requestId);
  }, [loadLinkedSession, loadPatientAlertTags, loadQuoteItems, selectedAppointment]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      loadAppointments(true);
    }, AUTO_REFRESH_MS);

    const handleFocus = () => {
      loadAppointments(true);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadAppointments]);

  const handleSaveClinicSession = React.useCallback(async (data: ClinicSessionFormData) => {
    if (!selectedAppointment?.patientId) return;

    if (linkedSession?.sesion_id) {
      await updateSession(
        linkedSession.sesion_id,
        selectedAppointment.patientId,
        data,
        data.archivos_adjuntos,
        data.deletedAttachmentIds,
        linkedSession.archivos_adjuntos,
      );
      } else {
        await createSession(selectedAppointment.patientId, data, data.archivos_adjuntos);
        if (selectedAppointment.status !== 'completed') {
          markAppointmentLocallyUpdated(String(user?.id ?? ''), selectedAppointment.id);
          await updateAppointmentStatusRequest({
            appointment: selectedAppointment,
            newStatus: 'completed',
          });
        }
      }

      await loadLinkedSession(selectedAppointment);
    await loadAppointments(true);
  }, [
    createSession,
    linkedSession?.archivos_adjuntos,
    linkedSession?.sesion_id,
    loadAppointments,
    loadLinkedSession,
    selectedAppointment,
    updateSession,
  ]);

  const prefillTreatments = React.useMemo(
    () =>
      quoteItems.map((item) => {
        const toothNumber = item.tooth_number != null ? Number(item.tooth_number) : null;

        return {
          numero_diente: toothNumber != null && !Number.isNaN(toothNumber) && toothNumber > 0 ? toothNumber : null,
          descripcion: item.service_name,
        };
      }),
    [quoteItems],
  );

  const nextActionLabel = linkedSession ? t('focus.editSession') : t('focus.completeSession');
  const visibleAlertTags = patientAlertTags.slice(0, 4);
  const hiddenAlertCount = Math.max(patientAlertTags.length - visibleAlertTags.length, 0);
  const firstNewAppointmentAlertItem = newAppointmentsAlertItems[0] ?? null;

  const clearAgentSessionDraft = React.useCallback(() => {
    setAgentSessionPrefill(null);
    setAgentSessionTreatments([]);
  }, []);

  const selectAppointment = React.useCallback((appointmentId: string, openMobileDetails = false) => {
    setSelectedAppointmentId(appointmentId);
    if (isMobile && openMobileDetails) {
      setMobileDetailsOpen(true);
    }
  }, [isMobile]);

  const executeDoctorAgentAction = React.useCallback(async (action: DoctorAgentAction): Promise<DoctorAgentActionResult> => {
    if (!selectedAppointment) {
      return { success: false, message: t('focus.ai.actionAppointmentContextMissing') };
    }

    if (action.type === 'open_odontogram') {
      const payload = action.payload || {};
      if (isMobile) setMobileDetailsOpen(true);
      setActivePanel('odontogram');
      setOdontogramAutoStart(true);
      setOdontogramPrefill({
        description: payload.procedimiento_realizado || '',
        notes: payload.notas_clinicas || '',
        marcaciones: payload.marcaciones ?? [],
      });
      return { success: true };
    }

    if (action.type === 'open_clinic_session') {
      const payload = action.payload || {};
      if (isMobile) setMobileDetailsOpen(true);
      setAgentSessionPrefill({
        doctor_id: payload.doctor_id,
        doctor_name: payload.doctor_name,
        procedimiento_realizado: payload.procedimiento_realizado,
        plan_proxima_cita: payload.plan_proxima_cita,
        fecha_proxima_cita: payload.fecha_proxima_cita,
      });
      setAgentSessionTreatments(payload.tratamientos || []);
      setClinicSessionOpen(true);
      return { success: true };
    }

    return { success: false, message: t('focus.ai.actionUnsupported') };
  }, [isMobile, selectedAppointment, t]);

  const handleOpenNewAppointment = React.useCallback(() => {
    if (!firstNewAppointmentAlertItem) return;

    selectAppointment(firstNewAppointmentAlertItem.id, true);
    setNewAppointmentsAlertOpen(false);
  }, [firstNewAppointmentAlertItem, selectAppointment]);

  const handleOdontogramSessionSaved = React.useCallback(async () => {
    if (!selectedAppointment) return;
    if (selectedAppointment.status !== 'completed') {
      markAppointmentLocallyUpdated(String(user?.id ?? ''), selectedAppointment.id);
      await updateAppointmentStatusRequest({
        appointment: selectedAppointment,
        newStatus: 'completed',
      });
    }
    await loadAppointments(true);
  }, [loadAppointments, selectedAppointment, user?.id]);

  const handleClinicSessionOpenChange = React.useCallback((open: boolean) => {
    setClinicSessionOpen(open);
    if (!open) {
      clearAgentSessionDraft();
    }
  }, [clearAgentSessionDraft]);

  const handleDoctorAgentAction = React.useCallback((action: DoctorAgentAction) => (
    executeDoctorAgentAction(action)
  ), [executeDoctorAgentAction]);

  const renderDetailPanel = selectedAppointment ? (
    <Card className="xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden">
      <CardContent className="space-y-4 p-4 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-hidden">
        {isMobile && (
          <Button variant="ghost" className="h-9 w-fit px-2" onClick={() => setMobileDetailsOpen(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('focus.backToAgenda')}
          </Button>
        )}

        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/8">
                {patientAlertTags.length > 0 ? (
                  <AlertTriangle className="h-7 w-7 text-destructive" />
                ) : (
                  <UserRound className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold leading-tight text-foreground">
                  {selectedAppointment.patientName || t('agenda.unknownPatient')}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {visibleAlertTags.length > 0 ? (
                    <>
                      {visibleAlertTags.map((item, index) => (
                        item.type === 'allergy' ? (
                          <Badge
                            key={`${item.label}-${index}`}
                            variant="destructive"
                            className="gap-1 text-xs font-normal"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {item.label}
                          </Badge>
                        ) : (
                          <Badge
                            key={`${item.label}-${index}`}
                            variant="secondary"
                            className="gap-1 bg-amber-100 text-xs font-normal text-amber-800 hover:bg-amber-100"
                          >
                            <Heart className="h-3 w-3" />
                            {item.label}
                          </Badge>
                        )
                      ))}
                      {hiddenAlertCount > 0 && (
                        <span className="text-xs text-primary">
                          {t('focus.moreAlertTags', { count: hiddenAlertCount })}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t('focus.noClinicalSignals')}</span>
                  )}
                </div>
              </div>
            </div>

        </div>

        <div className="min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:overflow-hidden">
            {/* Switch + action */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex overflow-hidden rounded-md border text-xs">
                <button
                  type="button"
                  onClick={() => { setActivePanel('sessions'); setOdontogramAutoStart(false); setOdontogramPrefill(null); }}
                  className={cn(
                    'whitespace-nowrap px-3 py-1.5 font-medium transition-colors',
                    activePanel === 'sessions'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t('focus.tabSessions')}
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('odontogram')}
                  className={cn(
                    'whitespace-nowrap px-3 py-1.5 font-medium transition-colors',
                    activePanel === 'odontogram'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t('focus.tabOdontogram')}
                </button>
              </div>

              {activePanel === 'sessions' && (
                <Button size="sm" onClick={() => setClinicSessionOpen(true)} disabled={!canManageSessions}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {nextActionLabel}
                </Button>
              )}
            </div>

            {/* Content */}
            {activePanel === 'sessions' ? (
              <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                <DoctorPatientTimeline
                  linkedAppointmentId={selectedAppointment.id}
                  sessions={patientSessions}
                  isLoading={isLoadingTimeline}
                />
              </div>
            ) : (
              <div className="min-h-[500px] flex-1 overflow-y-auto xl:min-h-0 xl:overflow-hidden">
                <DentalRecordViewer
                  patientId={selectedAppointment.patientId}
                  patientName={selectedAppointment.patientName}
                  doctorId={selectedAppointment.doctorId}
                  doctorName={selectedAppointment.doctorName}
                  autoStartSession={odontogramAutoStart}
                  autoStartDescription={odontogramPrefill?.description}
                  autoStartNotes={odontogramPrefill?.notes}
                  autoStartMarcaciones={odontogramPrefill?.marcaciones}
                  onSessionSaved={handleOdontogramSessionSaved}
                />
              </div>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  ) : (
    <Card>
      <CardContent className="p-6">
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          {t('focus.empty')}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden p-4 pr-2">
      <div className="flex h-full w-full min-h-0 flex-col gap-4">
        {isMobile && mobileDetailsOpen ? (
          renderDetailPanel
        ) : (
          <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(320px,30%)_minmax(0,70%)]">
            <Card className="xl:sticky xl:top-4 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden">
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold">{t('agenda.title')}</CardTitle>
                  <CardDescription className="text-xs">{t('agenda.description')}</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => loadAppointments(true)} disabled={isRefreshing}>
                  <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                </Button>
              </CardHeader>

              <CardContent className="min-h-0 space-y-3 overflow-auto p-4 xl:flex-1">
                <DoctorAgendaTimeline
                  appointments={appointments}
                  isLoading={isLoadingAppointments}
                  onSelect={(appointmentId) => selectAppointment(appointmentId, true)}
                  selectedAppointmentId={selectedAppointment?.id}
                />
              </CardContent>
            </Card>

            {!isMobile && renderDetailPanel}
          </div>
        )}
      </div>

      <DoctorAgentChat
        appointmentId={selectedAppointment?.id}
        patientId={selectedAppointment?.patientId}
        doctorId={selectedAppointment?.doctorId}
        locale={locale}
        patientName={selectedAppointment?.patientName}
        userId={user?.id ? String(user.id) : undefined}
        onAction={handleDoctorAgentAction}
        presentation="floating"
      />

      <Dialog open={newAppointmentsAlertOpen} onOpenChange={setNewAppointmentsAlertOpen}>
        <DialogContent maxWidth="md" className="overflow-hidden border-primary/20 p-0">
          <DialogHeader className="bg-foreground text-background">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white">
                  {newAppointmentsAlertItems.length === 1
                    ? t('appointmentAlerts.singleTitle')
                    : t('appointmentAlerts.multipleTitle', { count: newAppointmentsAlertItems.length })}
                </DialogTitle>
                <DialogDescription className="mt-1 text-white/75">
                  {newAppointmentsAlertItems.length === 1
                    ? t('appointmentAlerts.modalSingleDescription')
                    : t('appointmentAlerts.modalMultipleDescription', { count: newAppointmentsAlertItems.length })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 bg-background px-6 py-5">
            {newAppointmentsAlertItems.map((appointment) => {
              const normalizedStatus = normalizeAppointmentStatus(appointment.status);
              const serviceLabel = appointment.services?.length
                ? appointment.services.map((service) => service.name).join(', ')
                : appointment.service_name || appointment.summary || t('appointmentAlerts.unknownService');

              return (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => {
                    selectAppointment(appointment.id, true);
                    setNewAppointmentsAlertOpen(false);
                  }}
                  className="flex w-full items-start justify-between gap-4 rounded-xl bg-muted/30 px-4 py-4 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground">
                      {appointment.patientName || t('agenda.unknownPatient')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {serviceLabel}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-sky-700">{getTimeRangeLabel(appointment)}</p>
                    <Badge variant={getAppointmentStatusVariant(normalizedStatus)} className="mt-2 capitalize">
                      {tStatus(normalizedStatus)}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter className="bg-background">
            <Button variant="outline" onClick={() => setNewAppointmentsAlertOpen(false)}>
              {t('appointmentAlerts.dismiss')}
            </Button>
            <Button onClick={handleOpenNewAppointment} disabled={!firstNewAppointmentAlertItem}>
              {t('appointmentAlerts.openFirst')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusChangedAlertOpen} onOpenChange={setStatusChangedAlertOpen}>
        <DialogContent maxWidth="md" className="overflow-hidden border-primary/20 p-0">
          <DialogHeader className="bg-foreground text-background">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white">
                  {statusChangedAlertItems.length === 1
                    ? t('statusChangeAlerts.singleTitle')
                    : t('statusChangeAlerts.multipleTitle', { count: statusChangedAlertItems.length })}
                </DialogTitle>
                <DialogDescription className="mt-1 text-white/75">
                  {statusChangedAlertItems.length === 1
                    ? t('statusChangeAlerts.modalSingleDescription')
                    : t('statusChangeAlerts.modalMultipleDescription', { count: statusChangedAlertItems.length })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 bg-background px-6 py-5">
            {statusChangedAlertItems.map(({ appointment, previousStatus }) => {
              const serviceLabel = appointment.services?.length
                ? appointment.services.map((s) => s.name).join(', ')
                : appointment.service_name || appointment.summary || t('appointmentAlerts.unknownService');

              return (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => {
                    selectAppointment(appointment.id, true);
                    setStatusChangedAlertOpen(false);
                  }}
                  className="flex w-full items-start justify-between gap-4 rounded-xl bg-muted/30 px-4 py-4 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground">
                      {appointment.patientName || t('agenda.unknownPatient')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{serviceLabel}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge variant={getAppointmentStatusVariant(normalizeAppointmentStatus(previousStatus))} className="capitalize">
                        {tStatus(normalizeAppointmentStatus(previousStatus))}
                      </Badge>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <Badge variant={getAppointmentStatusVariant(normalizeAppointmentStatus(appointment.status))} className="capitalize">
                        {tStatus(normalizeAppointmentStatus(appointment.status))}
                      </Badge>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-sky-700">{getTimeRangeLabel(appointment)}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter className="bg-background">
            <Button variant="outline" onClick={() => setStatusChangedAlertOpen(false)}>
              {t('statusChangeAlerts.dismiss')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedAppointment && canManageSessions && (
        <ClinicSessionDialog
          open={clinicSessionOpen}
          onOpenChange={handleClinicSessionOpenChange}
          onSave={handleSaveClinicSession}
          userId={selectedAppointment.patientId}
          appointmentId={selectedAppointment.id}
          quoteId={selectedAppointment.quote_id}
          serviceName={selectedAppointment.services?.length
            ? selectedAppointment.services.map((service) => service.name).join(', ')
            : selectedAppointment.service_name}
          defaultDate={selectedAppointment.start?.dateTime
            ? parseISO(selectedAppointment.start.dateTime.replace(/Z$/, ''))
            : parseISO(`${formatDate(selectedAppointment.date)}T${selectedAppointment.time || '00:00'}:00`)}
          showTreatments={true}
          showAttachments={true}
          prefillData={{
            doctor_id: selectedAppointment.doctorId,
            doctor_name: selectedAppointment.doctorName,
            procedimiento_realizado: agentSessionPrefill?.procedimiento_realizado,
            plan_proxima_cita: agentSessionPrefill?.plan_proxima_cita,
            fecha_proxima_cita: agentSessionPrefill?.fecha_proxima_cita,
          }}
          prefillTreatments={agentSessionTreatments.length > 0 ? agentSessionTreatments : prefillTreatments}
          existingSession={linkedSession ?? undefined}
          hideNextAppointmentDate
          lockDoctor
        />
      )}
    </div>
  );
}
