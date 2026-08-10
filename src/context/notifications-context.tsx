'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';

import { GlobalNotificationAlerts } from '@/components/notifications/GlobalNotificationAlerts';
import { useAuth } from '@/context/AuthContext';
import { useDoctorAlertStyle } from '@/hooks/use-doctor-alert-style';
import { useEventStream } from '@/hooks/use-event-stream';
import { useToast } from '@/hooks/use-toast';
import { normalizeAppointmentStatus } from '@/constants/appointment-status';
import { getChannelsForRoles } from '@/constants/notification-channels';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type {
  AppointmentReassignedNotification,
  AppointmentRescheduledNotification,
  AppointmentStatus,
  AppointmentStatusChangeNotification,
  DoctorAlertStyle,
  NewAppointmentNotification,
  ReminderPanelNotification,
  SessionCompletedNotification,
  UnifiedNotification,
} from '@/lib/types';
import { normalizeTratamiento } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEEN_IDS_KEY = 'notifications:seen-ids';
const ACTIONS_TAKEN_PREFIX = 'notifications:actions-taken';

// ── Storage helpers ───────────────────────────────────────────────────────────

function readSeenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const arr = JSON.parse(window.localStorage.getItem(SEEN_IDS_KEY) ?? '[]');
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function addSeenId(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const existing = readSeenIds();
    existing.add(id);
    window.localStorage.setItem(SEEN_IDS_KEY, JSON.stringify([...existing]));
  } catch {}
}

function readActionsTaken(notifId: string): ('quote' | 'invoice' | 'schedule')[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${ACTIONS_TAKEN_PREFIX}:${notifId}`);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeActionsTaken(notifId: string, actions: ('quote' | 'invoice' | 'schedule')[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${ACTIONS_TAKEN_PREFIX}:${notifId}`, JSON.stringify(actions));
  } catch {}
}

// ── Backend notification shape ────────────────────────────────────────────────

interface BackendNotification {
  id: number | string;
  type:
    | 'appointment_status_change'
    | 'session_completed'
    | 'new_appointment'
    | 'reminder'
    | 'appointment_rescheduled'
    | 'appointment_reassigned';
  reminder_id?: string | null;
  status: 'pending' | 'read' | 'dismissed';
  appointment_id?: string | null;
  session_id?: number | null;
  patient_id?: string | null;
  channels?: string[];
  metadata: Record<string, any>;
  created_at: string;
}

// ── Normalizer ────────────────────────────────────────────────────────────────

function extractTime(datetime?: string | null): string {
  if (!datetime) return '';
  try {
    return format(parseISO(datetime.replace(/Z$/, '')), 'HH:mm');
  } catch {
    return '';
  }
}

function extractDate(datetime?: string | null): string {
  if (!datetime) return '';
  try {
    return format(parseISO(datetime.replace(/Z$/, '')), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function normalizeBackendNotification(n: BackendNotification): UnifiedNotification | null {
  const m = n.metadata ?? {};
  const id = String(n.id);
  const seenIds = readSeenIds();
  const base = { id, createdAt: n.created_at, seen: seenIds.has(id) };

  // patient_id and appointment_id live at the top level
  const appointmentId = String(n.appointment_id ?? m.appointment_id ?? '');
  const patientId = String(n.patient_id ?? m.patient_id ?? m.paciente_id ?? '');

  // Appointment fields shared across types — metadata uses snake_case
  const patientName: string = m.patient_name ?? '';
  const doctorName: string = m.doctor_name ?? '';
  const doctorId: string = m.doctor_id ?? m.assignee_id ?? '';
  const calendarSourceId: string = m.calendar_source_id ?? '';
  const quoteId: string | undefined = m.quote_id ?? undefined;
  const invoiceId: string | null = m.invoice_id ?? null;

  // Services: backend sends either a string[] or objects; normalize to Service[]
  const services = Array.isArray(m.services)
    ? m.services.map((s: any, i: number) => ({
        id: String(i),
        name: typeof s === 'string' ? s : (s?.name ?? ''),
        price: 0,
        category: '',
        duration_minutes: 30,
        is_active: true,
      }))
    : [];

  const buildAppointment = (status: AppointmentStatus) => ({
    id: appointmentId,
    patientId,
    patientName,
    doctorId,
    doctorName,
    summary: m.summary ?? '',
    service_name: m.summary ?? '',
    date: extractDate(m.start_datetime ?? m.fecha_sesion),
    time: extractTime(m.start_datetime),
    status,
    calendar_source_id: calendarSourceId,
    quote_id: quoteId,
    invoice_id: invoiceId,
    services,
  });

  switch (n.type) {
    case 'appointment_status_change':
      return {
        ...base,
        type: 'appointment_status_change',
        previousStatus: normalizeAppointmentStatus(m.previous_status ?? ''),
        appointment: buildAppointment(normalizeAppointmentStatus(m.status ?? '')),
      } satisfies AppointmentStatusChangeNotification;

    case 'session_completed':
      return {
        ...base,
        type: 'session_completed',
        appointment: buildAppointment('completed'),
        session: {
          sesion_id: n.session_id ?? Number(m.id) ?? 0,
          fecha_sesion: m.fecha_sesion ?? '',
          procedimiento_realizado: m.procedimiento_realizado ?? '',
          plan_proxima_cita: m.plan_proxima_cita ?? undefined,
          fecha_proxima_cita: m.fecha_proxima_cita ?? undefined,
          doctor_id: doctorId || null,
          doctor_name: doctorName,
          tratamientos: Array.isArray(m.tratamientos)
            ? m.tratamientos.map(normalizeTratamiento)
            : [],
          archivos_adjuntos: [],
        },
        discharge: m.discharge_date
          ? { id: '', user_id: patientId, appointment_date: m.discharge_date, created_at: '' }
          : null,
        actions_taken: readActionsTaken(id),
      } satisfies SessionCompletedNotification;

    case 'new_appointment':
      return {
        ...base,
        type: 'new_appointment',
        appointment: buildAppointment(normalizeAppointmentStatus(m.status ?? 'scheduled')),
      } satisfies NewAppointmentNotification;

    case 'appointment_rescheduled':
      return {
        ...base,
        type: 'appointment_rescheduled',
        appointment: buildAppointment(normalizeAppointmentStatus(m.status ?? 'scheduled')),
        originalAppointmentId: String(m.original_appointment_id ?? ''),
      } satisfies AppointmentRescheduledNotification;

    case 'appointment_reassigned':
      return {
        ...base,
        type: 'appointment_reassigned',
        appointment: buildAppointment(normalizeAppointmentStatus(m.status ?? 'scheduled')),
      } satisfies AppointmentReassignedNotification;

    case 'reminder':
      return {
        ...base,
        type: 'reminder',
        reminder: {
          id: m.id ?? n.reminder_id ?? '',
          type: m.type === 'note' || m.tipo === 'nota' ? 'note' : 'reminder',
          calendar_id: (() => {
            const calendarId = m.calendar_id ?? m.calendarId ?? m.calendario_id ?? m.calendarioId ?? null;
            return calendarId == null || calendarId === '' ? null : String(calendarId);
          })(),
          title: m.title ?? '',
          description: m.description ?? null,
          start_datetime: m.start_datetime ?? '',
          end_datetime: m.end_datetime ?? null,
          color: m.color ?? null,
          priority: m.priority ?? 'MEDIUM',
          status: m.status ?? 'pending',
          visibility: m.visibility === 'personal' ? 'personal' : 'clinic',
          raise_alert: m.raise_alert ?? true,
          alert_instance_id: m.alert_instance_id ?? null,
          created_by: m.created_by ?? null,
          created_at: m.created_at ?? n.created_at,
          updated_at: m.updated_at ?? null,
          completed_at: m.completed_at ?? null,
          completed_by: m.completed_by ?? null,
        },
      } satisfies ReminderPanelNotification;

    default:
      return null;
  }
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface NotificationsContextValue {
  notifications: UnifiedNotification[];
  pendingCount: number;
  isPanelOpen: boolean;
  alertStyle: DoctorAlertStyle;
  setAlertStyle: (style: DoctorAlertStyle) => void;
  refreshAlertStyle: () => void;
  openPanel: () => void;
  closePanel: () => void;
  dismissNotification: (id: string, status?: 'read' | 'done') => void;
  clearAll: () => void;
  refreshNotifications: () => void;
  markSessionAction: (notificationId: string, action: 'quote' | 'invoice' | 'schedule') => void;
}

const NotificationsContext = React.createContext<NotificationsContextValue>({
  notifications: [],
  pendingCount: 0,
  isPanelOpen: false,
  alertStyle: 'modal',
  setAlertStyle: () => undefined,
  refreshAlertStyle: () => undefined,
  openPanel: () => undefined,
  closePanel: () => undefined,
  dismissNotification: () => undefined,
  clearAll: () => undefined,
  refreshNotifications: () => undefined,
  markSessionAction: () => undefined,
});

export function useNotifications() {
  return React.useContext(NotificationsContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, roleNames } = useAuth();
  const userId = user?.id ? String(user.id) : null;
  const channels = React.useMemo(() => getChannelsForRoles(roleNames), [roleNames]);
  const { toast } = useToast();
  const [alertStyle, setAlertStyle, refreshAlertStyle] = useDoctorAlertStyle(user?.id);
  const alertStyleRef = React.useRef(alertStyle);
  React.useEffect(() => { alertStyleRef.current = alertStyle; }, [alertStyle]);
  const tDW = useTranslations('DoctorWorkspace');
  const tStatus = useTranslations('AppointmentStatus');
  const tN = useTranslations('Notifications');
  const tReminders = useTranslations('Reminders');

  const [notifications, setNotifications] = React.useState<UnifiedNotification[]>([]);
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);
  const mountedRef = React.useRef(false);

  // ── markSessionAction ─────────────────────────────────────────────────────

  const markSessionAction = React.useCallback((notificationId: string, action: 'quote' | 'invoice' | 'schedule') => {
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id !== notificationId || n.type !== 'session_completed') return n;
        const current = n.actions_taken ?? [];
        if (current.includes(action)) return n;
        const updated = [...current, action] as ('quote' | 'invoice' | 'schedule')[];
        writeActionsTaken(notificationId, updated);
        return { ...n, actions_taken: updated };
      }),
    );
  }, []);

  // ── Backend notifications fetch ───────────────────────────────────────────

  const fetchNotifications = React.useCallback(async () => {
    if (!userId) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    try {
      const response = await api.get(API_ROUTES.NOTIFICATIONS, { status: 'pending' });
      const raw: unknown[] = Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.data)
          ? (response as any).data
          : [];
      const incoming = raw
        .map((item) => {
          try {
            return normalizeBackendNotification(item as BackendNotification);
          } catch (e) {
            console.error('[Notifications] normalizeBackendNotification error:', e, item);
            return null;
          }
        })
        .filter((n): n is UnifiedNotification => n !== null);

      if (!mountedRef.current) return;

      // Purge SEEN_IDS_KEY entries for IDs no longer pending in the backend,
      // so they can fire again if re-inserted (e.g. after a data fix).
      const incomingIds = new Set(incoming.map((n) => n.id));
      try {
        const stored = readSeenIds();
        const pruned = [...stored].filter((id) => incomingIds.has(id));
        if (pruned.length !== stored.size) {
          window.localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(pruned));
        }
      } catch {}

      setNotifications((prev) => {
        // Preserve in-memory actions_taken (may be ahead of localStorage)
        const prevById = new Map(prev.map((n) => [n.id, n]));
        return incoming.map((n) => {
          const existing = prevById.get(n.id);
          if (!existing || n.type !== 'session_completed') return n;
          const existingActions = (existing as SessionCompletedNotification).actions_taken;
          return existingActions ? { ...n, actions_taken: existingActions } : n;
        });
      });
    } catch (e) {
      console.error('[Notifications] fetch error:', e);
    }
  }, [userId]);

  // ── Initial fetch + cleanup ───────────────────────────────────────────────

  React.useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    mountedRef.current = true;
    void fetchNotifications();
    return () => { mountedRef.current = false; };
  }, [userId, fetchNotifications]);

  // ── SSE event stream ──────────────────────────────────────────────────────

  const handleSSEEvent = React.useCallback((_eventType: string, data: unknown) => {
    try {
      const normalized = normalizeBackendNotification(data as BackendNotification);
      if (!normalized) return;
      setNotifications((prev) => {
        if (prev.some((n) => n.id === normalized.id)) return prev;
        return [normalized, ...prev];
      });
    } catch {
      void fetchNotifications();
    }
  }, [fetchNotifications]);

  useEventStream(userId, handleSSEEvent, channels);

  // ── Global alert queue (modal / toast) ───────────────────────────────────

  const [alertQueue, setAlertQueue] = React.useState<UnifiedNotification[]>([]);
  const alertQueueRef = React.useRef<UnifiedNotification[]>([]);
  React.useEffect(() => { alertQueueRef.current = alertQueue; }, [alertQueue]);

  const alertedNotifIdsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => { alertedNotifIdsRef.current = new Set(); }, [userId]);

  React.useEffect(() => {
    const novel = notifications.filter((n) => !alertedNotifIdsRef.current.has(n.id) && !n.seen);
    if (novel.length === 0) return;
    novel.forEach((n) => alertedNotifIdsRef.current.add(n.id));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('clinic:calendar:refresh'));
    }

    const newAppts = novel.filter((n): n is NewAppointmentNotification => n.type === 'new_appointment');
    const statusChanges = novel.filter((n): n is AppointmentStatusChangeNotification => n.type === 'appointment_status_change');
    const sessionsDone = novel.filter((n): n is SessionCompletedNotification => n.type === 'session_completed');
    const reminders = novel.filter((n): n is ReminderPanelNotification => n.type === 'reminder');
    const reschedules = novel.filter((n): n is AppointmentRescheduledNotification => n.type === 'appointment_rescheduled');
    const reassigns = novel.filter((n): n is AppointmentReassignedNotification => n.type === 'appointment_reassigned');

    if (alertStyleRef.current === 'toast') {
      newAppts.forEach((n) => {
        toast({
          title: tDW('appointmentAlerts.singleTitle'),
          description: `${n.appointment.patientName || tN('unknownPatient')} · ${n.appointment.time || ''}`,
        });
      });
      statusChanges.forEach((n) => {
        toast({
          title: tDW('statusChangeAlerts.singleTitle'),
          description: tDW('statusChangeAlerts.toastDescription', {
            patient: n.appointment.patientName || tN('unknownPatient'),
            status: tStatus(normalizeAppointmentStatus(n.appointment.status)),
          }),
        });
      });
      reschedules.forEach((n) => {
        toast({
          title: tDW('rescheduleAlerts.singleTitle'),
          description: `${n.appointment.patientName || tN('unknownPatient')} · ${n.appointment.time || ''}`,
        });
      });
      reassigns.forEach((n) => {
        toast({
          title: tDW('reassignAlerts.singleTitle'),
          description: `${n.appointment.patientName || tN('unknownPatient')} · ${n.appointment.time || ''}`,
        });
      });
      sessionsDone.forEach((n) => {
        toast({
          title: tN('sessionCompletedAlertTitle'),
          description: n.appointment.patientName || tN('unknownPatient'),
        });
      });
      reminders.forEach((n) => {
        toast({
          title: tReminders('dueTitle'),
          description: n.reminder.description
            ? `${n.reminder.title} · ${n.reminder.description}`
            : n.reminder.title,
        });
      });
      const novelIds = new Set(novel.map((n) => n.id));
      novelIds.forEach((id) => addSeenId(id));
      setNotifications((ns) => ns.map((n) => novelIds.has(n.id) ? { ...n, seen: true } : n));
    } else {
      setAlertQueue((prev) => [...prev, ...novel]);
    }
  }, [notifications, tDW, tStatus, tN, tReminders, toast]);

  const dismissAllAlerts = React.useCallback(() => {
    const ids = new Set(alertQueueRef.current.map((n) => n.id));
    ids.forEach((id) => addSeenId(id));
    setNotifications((ns) => ns.map((n) => ids.has(n.id) ? { ...n, seen: true } : n));
    setAlertQueue([]);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const dismissNotification = React.useCallback((id: string, status: 'read' | 'done' = 'read') => {
    void api.post(API_ROUTES.NOTIFICATIONS_STATUS, { ids: [id], status }).catch(() => {});
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = React.useCallback(() => {
    setNotifications((prev) => {
      const backendIds = prev.filter((n) => n.type !== 'reminder').map((n) => n.id);
      if (backendIds.length > 0) {
        void api.post(API_ROUTES.NOTIFICATIONS_STATUS, { ids: backendIds, status: 'read' }).catch(() => {});
      }
      return [];
    });
  }, []);

  const openPanel = React.useCallback(() => setIsPanelOpen(true), []);
  const closePanel = React.useCallback(() => setIsPanelOpen(false), []);
  const refreshNotifications = React.useCallback(() => { void fetchNotifications(); }, [fetchNotifications]);

  const pendingCount = notifications.length;

  const value = React.useMemo<NotificationsContextValue>(
    () => ({ notifications, pendingCount, isPanelOpen, alertStyle, setAlertStyle, refreshAlertStyle, openPanel, closePanel, dismissNotification, clearAll, refreshNotifications, markSessionAction }),
    [notifications, pendingCount, isPanelOpen, alertStyle, setAlertStyle, refreshAlertStyle, openPanel, closePanel, dismissNotification, clearAll, refreshNotifications, markSessionAction],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <GlobalNotificationAlerts items={alertQueue} onDismissAll={dismissAllAlerts} />
    </NotificationsContext.Provider>
  );
}
