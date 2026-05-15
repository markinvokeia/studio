'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';

import { useAuth } from '@/context/AuthContext';
import { normalizeReminder } from '@/lib/reminders';
import { normalizeAppointmentStatus } from '@/constants/appointment-status';
import { DASHBOARD_PERMISSIONS, BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type {
  Appointment,
  AppointmentStatus,
  AppointmentStatusChangeNotification,
  CalendarReminder,
  NewAppointmentNotification,
  PatientDischarge,
  PatientSession,
  ReminderPanelNotification,
  SessionCompletedNotification,
  UnifiedNotification,
} from '@/lib/types';
import { formatDate } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_MS = 10_000;
const STORAGE_PREFIX = 'app-notifications';
const APPT_STATUSES_PREFIX = 'notifications:appt-statuses';
const SECRETARY_NOTIFIED_PREFIX = 'notifications:secretary-sessions';
const REMINDER_SEEN_KEY = 'notifications:reminder-seen';
const LOCALLY_UPDATED_PREFIX = 'doctor-workspace:locally-updated';
const LOCALLY_UPDATED_TTL_MS = 120_000;

// ── Storage helpers ───────────────────────────────────────────────────────────

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function loadNotifications(userId: string): UnifiedNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotifications(userId: string, notifications: UnifiedNotification[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(notifications));
  } catch {}
}

function readApptStatuses(doctorId: string, dateKey: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`${APPT_STATUSES_PREFIX}:${doctorId}:${dateKey}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeApptStatuses(doctorId: string, dateKey: string, statuses: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${APPT_STATUSES_PREFIX}:${doctorId}:${dateKey}`, JSON.stringify(statuses));
  } catch {}
}

function readLocallyUpdatedIds(doctorId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(`${LOCALLY_UPDATED_PREFIX}:${doctorId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.ids)) return new Set();
    if (typeof parsed.expiresAt === 'number' && Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(`${LOCALLY_UPDATED_PREFIX}:${doctorId}`);
      return new Set();
    }
    return new Set<string>(parsed.ids.map(String));
  } catch {
    return new Set();
  }
}

function readSecretaryNotified(dateKey: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(`${SECRETARY_NOTIFIED_PREFIX}:${dateKey}`);
    const arr = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeSecretaryNotified(dateKey: string, set: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${SECRETARY_NOTIFIED_PREFIX}:${dateKey}`, JSON.stringify([...set]));
  } catch {}
}

function readSeenReminderIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(REMINDER_SEEN_KEY);
    const arr = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function addSeenReminderId(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const existing = readSeenReminderIds();
    existing.add(id);
    window.localStorage.setItem(REMINDER_SEEN_KEY, JSON.stringify([...existing]));
  } catch {}
}

// ── Secretary completion tracking (for dedup) ─────────────────────────────────

function readSecretaryCompletionStatuses(dateKey: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`secretary:completion-tracking:${dateKey}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeSecretaryCompletionStatuses(dateKey: string, statuses: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`secretary:completion-tracking:${dateKey}`, JSON.stringify(statuses));
  } catch {}
}

// ── API helpers ───────────────────────────────────────────────────────────────

function formatForAPI(date: Date) {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}

function todayRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
  };
}

function normalizeAppointmentsResponse(data: unknown): Appointment[] {
  let raw: any[] = [];
  if (Array.isArray(data) && data.length > 0 && 'json' in (data[0] as object)) {
    raw = (data as any[]).map((item) => item.json);
  } else if (Array.isArray(data)) {
    raw = data as any[];
  }
  return raw
    .map((a: any): Appointment | null => {
      const startNode = a.start_time || a.start;
      const startDateTime = typeof startNode === 'string' ? startNode : startNode?.dateTime;
      if (!startDateTime) return null;
      const parsedStart = parseISO(startDateTime.replace(/Z$/, ''));
      if (Number.isNaN(parsedStart.getTime())) return null;
      const endNode = a.end_time || a.end;
      const doctorIdValue = a.doctor_id || a.doctorId || a.doctorid || '';
      return {
        id: String(a.appointment_id || a.appointmentId || a.id || ''),
        patientId: String(a.patient_id || a.patientId || a.patientid || ''),
        patientName: a.patient_name || a.patientName || '',
        patientEmail: a.patient_email || a.patientEmail || '',
        patientPhone: a.patient_phone || a.patientPhone || '',
        doctorId: String(doctorIdValue),
        doctorName: a.doctor_name || a.doctorName || '',
        doctorEmail: a.doctor_email || a.doctorEmail || '',
        summary: a.summary || '',
        service_name: a.summary || '',
        description: a.description || '',
        notes: a.notes || '',
        date: format(parsedStart, 'yyyy-MM-dd'),
        time: format(parsedStart, 'HH:mm'),
        status: normalizeAppointmentStatus(a.status),
        created_at: a.created_at || a.createdAt || '',
        google_calendar_id: a.google_calendar_id,
        googleEventId: a.google_event_id || a.googleEventId || a.id,
        calendar_source_id: a.calendar_source_id != null ? String(a.calendar_source_id) : '',
        calendar_name: a.calendar_name || a.organizer?.displayName || '',
        color: a.color,
        colorId: String(a.color_id || a.colorId || ''),
        start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
        end: typeof endNode === 'string' ? { dateTime: endNode } : endNode,
        services: Array.isArray(a.services)
          ? a.services.map((s: any) => ({
              id: String(s.id),
              name: s.name || '',
              price: Number(s.price || 0),
              category: '',
              duration_minutes: 30,
              is_active: true,
            }))
          : [],
        quote_id: a.quote_id || a.quoteId,
        quote_doc_no: a.quote_doc_no || a.quoteDocNo,
      } as Appointment;
    })
    .filter((a): a is Appointment => a !== null)
    .sort((a, b) => a.time.localeCompare(b.time));
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface NotificationsContextValue {
  notifications: UnifiedNotification[];
  pendingCount: number;
  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  refreshNotifications: () => void;
}

const NotificationsContext = React.createContext<NotificationsContextValue>({
  notifications: [],
  pendingCount: 0,
  isPanelOpen: false,
  openPanel: () => undefined,
  closePanel: () => undefined,
  dismissNotification: () => undefined,
  clearAll: () => undefined,
  refreshNotifications: () => undefined,
});

export function useNotifications() {
  return React.useContext(NotificationsContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, roleNames } = useAuth();
  const { hasPermission } = usePermissions();
  const userId = user?.id ? String(user.id) : null;

  // Doctor = has access to the doctor workspace
  const isDoctor = hasPermission(DASHBOARD_PERMISSIONS.DOCTOR_WORKSPACE_ACCESS);

  // Secretary role names (case-insensitive)
  const SECRETARY_ROLE_NAMES = ['secretary', 'secretaria', 'receptionist', 'recepcionista'];
  // Secretary = can view appointments OR has a secretary/receptionist role.
  // NOTE: A doctor who also runs the clinic as a secretary is valid — the !isDoctor gate
  // was intentionally removed. Self-completion suppression is handled inside the poll
  // via the locallyUpdated mechanism (same key written by doctor-workspace.tsx).
  const isSecretary =
    hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_VIEW) ||
    roleNames.some((r) => SECRETARY_ROLE_NAMES.includes(r.toLowerCase()));

  const [notifications, setNotifications] = React.useState<UnifiedNotification[]>([]);
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);
  const mountedRef = React.useRef(false);
  const secretaryProcessingRef = React.useRef<Set<string>>(new Set());
  // Prevents write-back loop when syncing notifications received from another tab
  const isFromStorageEventRef = React.useRef(false);

  // Load persisted notifications on mount / user change
  React.useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    setNotifications(loadNotifications(userId));
  }, [userId]);

  // Persist whenever notifications change (skip if the update came from another tab)
  React.useEffect(() => {
    if (!userId) return;
    if (isFromStorageEventRef.current) {
      isFromStorageEventRef.current = false;
      return;
    }
    saveNotifications(userId, notifications);
  }, [userId, notifications]);

  // Cross-tab sync: when another tab writes to our notifications key, reload it here.
  // The `storage` event only fires in tabs OTHER than the one that wrote — no self-loop.
  React.useEffect(() => {
    if (!userId) return;
    const key = storageKey(userId);
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (!Array.isArray(parsed)) return;
        isFromStorageEventRef.current = true;
        setNotifications(parsed as UnifiedNotification[]);
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userId]);

  const addNotifications = React.useCallback((incoming: UnifiedNotification[]) => {
    if (incoming.length === 0) return;
    setNotifications((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const novel = incoming.filter((n) => !existingIds.has(n.id));
      if (novel.length === 0) return prev;
      return [...novel, ...prev];
    });
  }, []);

  // ── Doctor: appointment status change detection ────────────────────────────

  const pollDoctorStatuses = React.useCallback(async () => {
    if (!userId || !isDoctor) return;
    const { start, end } = todayRange();
    try {
      const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
        doctor_id: userId,
        startingDateAndTime: formatForAPI(start),
        endingDateAndTime: formatForAPI(end),
      });
      const appointments = normalizeAppointmentsResponse(data);
      const dateKey = formatDate(new Date());
      const previousStatuses = readApptStatuses(userId, dateKey);
      const locallyUpdated = readLocallyUpdatedIds(userId);

      const newStatuses: Record<string, string> = {};
      const changed: AppointmentStatusChangeNotification[] = [];
      const newAppts: NewAppointmentNotification[] = [];
      // Only detect "new" appointments when we already had a previous snapshot.
      // On the very first poll (empty previousStatuses) we just record baselines.
      const hasPreviousSnapshot = Object.keys(previousStatuses).length > 0;

      for (const appt of appointments) {
        newStatuses[appt.id] = appt.status;
        const prev = previousStatuses[appt.id];

        if (prev === undefined) {
          // Brand-new appointment — notify only when we had a prior baseline
          if (hasPreviousSnapshot) {
            newAppts.push({
              id: `new-appt:${appt.id}:${dateKey}`,
              type: 'new_appointment',
              createdAt: new Date().toISOString(),
              appointment: appt,
            });
          }
        } else if (prev !== appt.status && !locallyUpdated.has(appt.id)) {
          // Known appointment whose status changed
          changed.push({
            id: `appt-status:${appt.id}:${prev}->${appt.status}:${dateKey}`,
            type: 'appointment_status_change',
            createdAt: new Date().toISOString(),
            appointment: appt,
            previousStatus: prev as AppointmentStatus,
          });
        }
      }

      writeApptStatuses(userId, dateKey, newStatuses);
      if (mountedRef.current) addNotifications([...newAppts, ...changed]);
    } catch {}
  }, [userId, isDoctor, addNotifications]);

  // ── Secretary: session completion detection ────────────────────────────────

  const pollSecretaryCompletions = React.useCallback(async () => {
    if (!userId || !isSecretary) return;
    const { start, end } = todayRange();
    try {
      const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
        startingDateAndTime: formatForAPI(start),
        endingDateAndTime: formatForAPI(end),
      });
      const appointments = normalizeAppointmentsResponse(data);
      const dateKey = formatDate(new Date());
      const previousStatuses = readSecretaryCompletionStatuses(dateKey);
      const notifiedSessions = readSecretaryNotified(dateKey);

      const newStatuses: Record<string, string> = {};
      const newlyCompleted: Appointment[] = [];
      // Suppress sessions the current user completed themselves from the workspace
      const locallyUpdated = readLocallyUpdatedIds(userId);

      for (const appt of appointments) {
        newStatuses[appt.id] = appt.status;
        const prev = previousStatuses[appt.id];
        if (
          appt.status === 'completed' &&
          prev !== undefined &&
          prev !== 'completed' &&
          !secretaryProcessingRef.current.has(appt.id) &&
          !locallyUpdated.has(appt.id)
        ) {
          newlyCompleted.push(appt);
        }
      }

      writeSecretaryCompletionStatuses(dateKey, newStatuses);

      for (const appt of newlyCompleted) {
        if (!appt.patientId) continue;
        secretaryProcessingRef.current.add(appt.id);
        Promise.all([
          api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: appt.patientId }),
          api.get(API_ROUTES.PATIENT_DISCHARGE, { id: appt.patientId }).catch(() => null),
        ])
          .then(([rawSessions, rawDischarge]: [unknown, unknown]) => {
            const arr: any[] = Array.isArray(rawSessions)
              ? rawSessions
              : ((rawSessions as any)?.patient_sessions ?? (rawSessions as any)?.data ?? []);
            const sessions: PatientSession[] = arr
              .map((s: any) => ({ ...s, sesion_id: Number(s.sesion_id) }))
              .sort((a, b) => Date.parse(b.fecha_sesion || '') - Date.parse(a.fecha_sesion || ''));
            const session =
              sessions.find((s) => String(s.appointment_id ?? '') === appt.id) ?? sessions[0];
            if (!session) return;
            const key = `session:${appt.id}:${session.sesion_id}`;
            if (notifiedSessions.has(key)) return;
            notifiedSessions.add(key);
            writeSecretaryNotified(dateKey, notifiedSessions);
            const d = rawDischarge as any;
            const discharge: PatientDischarge | null =
              d?.appointment_date
                ? {
                    id: String(d.id || ''),
                    user_id: String(d.user_id || ''),
                    appointment_date: String(d.appointment_date),
                    created_at: d.created_at,
                  }
                : null;
            const notif: SessionCompletedNotification = {
              id: key,
              type: 'session_completed',
              createdAt: new Date().toISOString(),
              appointment: appt,
              session,
              discharge,
            };
            if (mountedRef.current) addNotifications([notif]);
          })
          .catch(() => {})
          .finally(() => { secretaryProcessingRef.current.delete(appt.id); });
      }
    } catch {}
  }, [userId, isSecretary, addNotifications]);

  // ── Reminders: add past-due pending reminders ─────────────────────────────

  const pollReminders = React.useCallback(async () => {
    if (!userId) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    const now = new Date();
    try {
      const response = await api.get(API_ROUTES.REMINDERS, {
        from: formatForAPI(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)),
        to: formatForAPI(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59)),
      });
      const raw: unknown[] = Array.isArray(response)
        ? response
        : ((response as any)?.reminders ?? (response as any)?.data ?? []);
      const reminders: CalendarReminder[] = raw
        .map((r) => normalizeReminder(r as Record<string, unknown>))
        .filter((r): r is CalendarReminder => r !== null && r.status === 'pending');

      const seenIds = readSeenReminderIds();
      const nowMs = Date.now();
      const toAdd: ReminderPanelNotification[] = [];

      for (const reminder of reminders) {
        if (seenIds.has(reminder.id)) continue;
        const dueMs = parseISO(reminder.start_datetime.replace(/Z$/, '')).getTime();
        if (Number.isNaN(dueMs) || dueMs > nowMs) continue;
        addSeenReminderId(reminder.id);
        toAdd.push({
          id: `reminder:${reminder.id}`,
          type: 'reminder',
          createdAt: new Date().toISOString(),
          reminder,
        });
      }

      if (mountedRef.current) addNotifications(toAdd);
    } catch {}
  }, [userId, addNotifications]);

  // ── Polling orchestration ─────────────────────────────────────────────────

  const poll = React.useCallback(() => {
    void pollDoctorStatuses();
    void pollSecretaryCompletions();
    void pollReminders();
  }, [pollDoctorStatuses, pollSecretaryCompletions, pollReminders]);

  React.useEffect(() => {
    if (!userId) return;
    mountedRef.current = true;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [userId, poll]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const dismissNotification = React.useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = React.useCallback(() => {
    setNotifications([]);
  }, []);

  const openPanel = React.useCallback(() => setIsPanelOpen(true), []);
  const closePanel = React.useCallback(() => setIsPanelOpen(false), []);
  const refreshNotifications = React.useCallback(() => { poll(); }, [poll]);

  const pendingCount = notifications.length;

  const value = React.useMemo<NotificationsContextValue>(
    () => ({ notifications, pendingCount, isPanelOpen, openPanel, closePanel, dismissNotification, clearAll, refreshNotifications }),
    [notifications, pendingCount, isPanelOpen, openPanel, closePanel, dismissNotification, clearAll, refreshNotifications],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
