'use client';

import * as React from 'react';
import { API_ROUTES } from '@/constants/routes';
import api from '@/services/api';
import { Appointment, PatientSession } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export interface SecretarySessionNotification {
  id: string;
  appointment: Appointment;
  session: PatientSession;
}

const COMPLETION_STORAGE_PREFIX = 'secretary:completion-tracking';
const NOTIFIED_STORAGE_PREFIX = 'secretary:notified-sessions';

function getCompletionKey(dateKey: string) {
  return `${COMPLETION_STORAGE_PREFIX}:${dateKey}`;
}

function getNotifiedKey(dateKey: string) {
  return `${NOTIFIED_STORAGE_PREFIX}:${dateKey}`;
}

function readStoredStatuses(dateKey: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(getCompletionKey(dateKey));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function writeStoredStatuses(dateKey: string, statuses: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getCompletionKey(dateKey), JSON.stringify(statuses));
  } catch {}
}

function readNotifiedSessions(dateKey: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(getNotifiedKey(dateKey));
    const arr = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch { return new Set(); }
}

function writeNotifiedSessions(dateKey: string, set: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getNotifiedKey(dateKey), JSON.stringify([...set]));
  } catch {}
}

export function useSecretarySessionNotifications(appointments: Appointment[], enabled = true) {
  const [notifications, setNotifications] = React.useState<SecretarySessionNotification[]>([]);
  const processingRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!enabled || appointments.length === 0) return;

    const dateKey = formatDate(new Date());
    const previousStatuses = readStoredStatuses(dateKey);
    const notifiedSessions = readNotifiedSessions(dateKey);

    const newStatuses: Record<string, string> = {};
    const newlyCompleted: Appointment[] = [];

    for (const appointment of appointments) {
      newStatuses[appointment.id] = appointment.status;
      const previousStatus = previousStatuses[appointment.id];

      if (
        appointment.status === 'completed' &&
        previousStatus !== undefined &&
        previousStatus !== 'completed' &&
        !processingRef.current.has(appointment.id)
      ) {
        newlyCompleted.push(appointment);
      }
    }

    writeStoredStatuses(dateKey, newStatuses);

    if (newlyCompleted.length === 0) return;

    for (const appointment of newlyCompleted) {
      if (!appointment.patientId) continue;
      processingRef.current.add(appointment.id);

      api
        .get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: appointment.patientId })
        .then((data: unknown) => {
          const raw: any[] = Array.isArray(data)
            ? data
            : ((data as any)?.patient_sessions ?? (data as any)?.data ?? []);
          const sessions = raw
            .map((s: any) => ({ ...s, sesion_id: Number(s.sesion_id) } as PatientSession))
            .sort((a, b) => Date.parse(b.fecha_sesion || '') - Date.parse(a.fecha_sesion || ''));

          const session =
            sessions.find((s) => String(s.appointment_id ?? '') === appointment.id) ??
            sessions[0];

          if (!session) return;

          const notificationKey = `${appointment.id}:${session.sesion_id}`;
          if (notifiedSessions.has(notificationKey)) return;

          notifiedSessions.add(notificationKey);
          writeNotifiedSessions(dateKey, notifiedSessions);

          setNotifications((prev) => [
            ...prev,
            { id: notificationKey, appointment, session },
          ]);
        })
        .catch((err: unknown) => console.error('Failed to fetch session for notification:', err))
        .finally(() => {
          processingRef.current.delete(appointment.id);
        });
    }
  }, [appointments, enabled]);

  const dismissNotification = React.useCallback((notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const clearAll = React.useCallback(() => {
    setNotifications([]);
  }, []);

  return { notifications, dismissNotification, clearAll };
}
