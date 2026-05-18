'use client';

import * as React from 'react';
import { addDays, endOfDay, format, isValid, parseISO, startOfDay } from 'date-fns';
import { useTranslations } from 'next-intl';

import { ReminderDueAlert } from '@/components/appointments/ReminderDueAlert';
import { useAuth } from '@/context/AuthContext';
import { useDoctorAlertStyle } from '@/hooks/use-doctor-alert-style';
import { useToast } from '@/hooks/use-toast';
import { normalizeReminder } from '@/lib/reminders';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { CalendarReminder } from '@/lib/types';

const REFRESH_MS = 5 * 60 * 1000; // re-fetch reminders every 5 minutes

interface ReminderNotificationsContextValue {
  refreshReminders: () => void;
}

const ReminderNotificationsContext = React.createContext<ReminderNotificationsContextValue>({
  refreshReminders: () => undefined,
});

export function useReminderNotifications(): ReminderNotificationsContextValue {
  return React.useContext(ReminderNotificationsContext);
}

async function fetchPendingReminders(userId?: string | null): Promise<CalendarReminder[]> {
  if (typeof window === 'undefined') return [];
  const token = localStorage.getItem('token');
  if (!token) return [];
  if (!userId) return [];

  const now = new Date();
  const from = startOfDay(now);
  const to = endOfDay(addDays(now, 1));

  try {
    const response = await api.get(API_ROUTES.REMINDERS, {
      from: format(from, 'yyyy-MM-dd HH:mm:ss'),
      to: format(to, 'yyyy-MM-dd HH:mm:ss'),
      created_by: userId,
    });
    const raw: unknown[] = Array.isArray(response)
      ? response
      : ((response as Record<string, unknown>)?.reminders as unknown[] | undefined)
          ?? ((response as Record<string, unknown>)?.data as unknown[] | undefined)
          ?? [];

    return raw
      .map((r) => normalizeReminder(r as Record<string, unknown>))
      .filter((r): r is CalendarReminder => r !== null && r.status === 'pending');
  } catch {
    return [];
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface ReminderNotificationsProviderProps {
  children: React.ReactNode;
}

export function ReminderNotificationsProvider({ children }: ReminderNotificationsProviderProps) {
  const t = useTranslations('Reminders');
  const { toast } = useToast();
  const { user } = useAuth();
  const [alertStyle] = useDoctorAlertStyle(user?.id);

  const alertStyleRef = React.useRef(alertStyle);
  React.useEffect(() => { alertStyleRef.current = alertStyle; }, [alertStyle]);

  const [dueQueue, setDueQueue] = React.useState<CalendarReminder[]>([]);
  const timerIdsRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const fireReminder = React.useCallback(
    (reminder: CalendarReminder) => {
      const storageKey = `reminder-notified:${reminder.id}`;
      if (typeof window !== 'undefined' && sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, 'true');

      if (alertStyleRef.current === 'toast') {
        toast({
          title: t('dueTitle'),
          description: reminder.description
            ? `${reminder.title} · ${reminder.description}`
            : reminder.title,
        });
      } else {
        setDueQueue((prev) =>
          prev.some((r) => r.id === reminder.id) ? prev : [...prev, reminder],
        );
      }
    },
    [t, toast],
  );

  const scheduleTimers = React.useCallback(
    (reminders: CalendarReminder[]) => {
      // Clear any pending timers from the previous schedule
      timerIdsRef.current.forEach(clearTimeout);
      timerIdsRef.current = [];

      const now = Date.now();

      reminders.forEach((reminder) => {
        const storageKey = `reminder-notified:${reminder.id}`;
        if (typeof window !== 'undefined' && sessionStorage.getItem(storageKey)) return;

        const startMs = parseISO(reminder.start_datetime.replace(/Z$/, '')).getTime();
        if (!isValid(new Date(startMs))) return;

        const delay = startMs - now;

        if (delay <= 0) {
          // Already past due — fire immediately
          fireReminder(reminder);
        } else {
          // Schedule to fire at the exact millisecond
          const id = setTimeout(() => fireReminder(reminder), delay);
          timerIdsRef.current.push(id);
        }
      });
    },
    [fireReminder],
  );

  const mountedRef = React.useRef(false);

  const load = React.useCallback(async () => {
    const reminders = await fetchPendingReminders(user?.id);
    if (mountedRef.current) scheduleTimers(reminders);
  }, [scheduleTimers, user?.id]);

  // Load reminders and reschedule on mount and every REFRESH_MS
  React.useEffect(() => {
    mountedRef.current = true;

    if (!user?.id) {
      return () => {
        mountedRef.current = false;
      };
    }

    void load();
    const intervalId = setInterval(() => { void load(); }, REFRESH_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
      timerIdsRef.current.forEach(clearTimeout);
      timerIdsRef.current = [];
    };
  }, [load, user?.id]);

  const refreshReminders = React.useCallback(() => { void load(); }, [load]);

  const dismissDue = React.useCallback(() => {
    setDueQueue((prev) => prev.slice(1));
  }, []);

  return (
    <ReminderNotificationsContext.Provider value={{ refreshReminders }}>
      {children}
      <ReminderDueAlert reminder={dueQueue[0] ?? null} onDismiss={dismissDue} />
    </ReminderNotificationsContext.Provider>
  );
}
