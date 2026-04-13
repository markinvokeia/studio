'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { Appointment, Calendar, TVDisplaySettings, TVRoomState } from '@/lib/types';

function mapRawAppointment(raw: any): Appointment {
  const startNode = raw.start_time ?? raw.start;
  const startDateTimeStr = typeof startNode === 'string' ? startNode : startNode?.dateTime;
  const dt = startDateTimeStr ? parseISO(startDateTimeStr) : null;

  // Extract time directly from the ISO string to preserve the intended local time
  // (avoids UTC→local conversion artifacts).
  // ISO format: "2024-01-01T14:30:00" or "2024-01-01T14:30:00-03:00" → "14:30"
  const isoTime = startDateTimeStr ? startDateTimeStr.slice(11, 16) : null;

  return {
    id: String(raw.appointment_id ?? raw.appointmentId ?? raw.id ?? ''),
    patientId: String(raw.patient_id ?? raw.patientId ?? ''),
    patientName: raw.patient_name ?? raw.patientName ?? raw.patientname ?? '',
    patientEmail: raw.patient_email ?? raw.patientEmail,
    patientPhone: raw.patient_phone ?? raw.patientPhone,
    doctorId: String(raw.doctor_id ?? raw.doctorId ?? ''),
    doctorName: raw.doctor_name ?? raw.doctorName ?? raw.doctorname ?? '',
    doctorEmail: raw.doctor_email ?? raw.doctorEmail,
    summary: raw.summary ?? '',
    description: raw.description ?? '',
    notes: raw.notes ?? '',
    date: dt ? format(dt, 'yyyy-MM-dd') : (raw.date ?? ''),
    time: isoTime ?? raw.time ?? '',
    status: raw.status ?? 'confirmed',
    created_at: raw.created_at,
    google_calendar_id: raw.google_calendar_id ?? raw.googleCalendarId ?? raw.calendar_id ?? '',
    googleEventId: raw.google_event_id ?? raw.googleEventId ?? raw.id,
    calendar_id: raw.calendar_id ?? raw.google_calendar_id ?? '',
    calendar_name: raw.calendar_name ?? '',
    color: raw.color,
    colorId: raw.colorId ?? raw.color_id,
    start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
    end: (() => { const e = raw.end_time ?? raw.end; return typeof e === 'string' ? { dateTime: e } : e; })(),
    services: [],
  };
}

const STORAGE_KEY = 'invoke-ia-tv-settings';
const BROADCAST_CHANNEL = 'tv-display-control';

export type TVDisplayStatus = 'off' | 'on' | 'paused' | 'promo';

export interface TVAnnouncement {
  patientName: string;
  calendarName: string;
  calendarColor?: string;
  doctorName?: string;
  time?: string;
}

export interface TVClinicInfo {
  name: string;
  logoUrl: string;
  phone?: string;
  address?: string;
  email?: string;
}

export type TVBroadcastMessage =
  | { type: 'STATUS_CHANGE'; status: TVDisplayStatus }
  | { type: 'NEXT_PATIENT'; calendarId: string; announcement: TVAnnouncement }
  | { type: 'SETTINGS_CHANGE'; settings: TVDisplaySettings }
  | { type: 'REFRESH_DATA'; rooms: TVRoomState[] }
  | { type: 'SHOW_PROMO' }
  | { type: 'REQUEST_STATE' }
  | { type: 'STATE_SYNC'; rooms: TVRoomState[]; status: TVDisplayStatus; settings: TVDisplaySettings; clinicInfo: TVClinicInfo | null };

const DEFAULT_SETTINGS: TVDisplaySettings = {
  isEnabled: false,
  showPatientName: true,
  showDoctorName: true,
  showAppointmentTime: true,
  showNextPatient: true,
  autoAdvance: false,
  videoUrls: [],
  videoColumnPosition: 'none',
  promoVideoUrls: [],
  musicEnabled: false,
  musicUrl: '',
  displayTitle: '',
  theme: 'dark',
  refreshIntervalMinutes: 5,
  promoIntervalMinutes: 15,
  selectedCalendarIds: [],
  showClock: true,
  showDate: true,
  showClinicPhone: true,
  showClinicAddress: true,
  showClinicEmail: true,
  groupByCalendar: true,
};

interface TVDisplayContextType {
  settings: TVDisplaySettings;
  status: TVDisplayStatus;
  rooms: TVRoomState[];
  calendars: Calendar[];
  clinicInfo: TVClinicInfo | null;
  isLoading: boolean;
  tvWindowRef: React.MutableRefObject<Window | null>;
  updateSettings: (partial: Partial<TVDisplaySettings>) => void;
  setStatus: (status: TVDisplayStatus) => void;
  nextPatient: (calendarId: string) => void;
  openTVScreen: (locale: string) => void;
  fetchAppointments: () => Promise<void>;
}

const TVDisplayContext = React.createContext<TVDisplayContextType | undefined>(undefined);

export function TVDisplayProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<TVDisplaySettings>(DEFAULT_SETTINGS);
  const [status, setStatusState] = React.useState<TVDisplayStatus>('off');
  const [rooms, setRooms] = React.useState<TVRoomState[]>([]);
  const [calendars, setCalendars] = React.useState<Calendar[]>([]);
  const [clinicInfo, setClinicInfo] = React.useState<TVClinicInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const channelRef = React.useRef<BroadcastChannel | null>(null);
  const tvWindowRef = React.useRef<Window | null>(null);
  const refreshTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Load settings from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TVDisplaySettings;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // BroadcastChannel setup — respond to REQUEST_STATE from the TV screen
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const ch = new BroadcastChannel(BROADCAST_CHANNEL);
    channelRef.current = ch;
    ch.onmessage = (event: MessageEvent<TVBroadcastMessage>) => {
      if (event.data.type === 'REQUEST_STATE') {
        setRooms((currentRooms) => {
          setStatusState((currentStatus) => {
            setSettings((currentSettings) => {
              setClinicInfo((currentClinic) => {
                ch.postMessage({
                  type: 'STATE_SYNC',
                  rooms: currentRooms,
                  status: currentStatus,
                  settings: currentSettings,
                  clinicInfo: currentClinic,
                } satisfies TVBroadcastMessage);
                return currentClinic;
              });
              return currentSettings;
            });
            return currentStatus;
          });
          return currentRooms;
        });
      }
    };
    return () => ch.close();
  }, []);

  const broadcast = React.useCallback((msg: TVBroadcastMessage) => {
    channelRef.current?.postMessage(msg);
  }, []);

  // Stable reference for selectedCalendarIds — avoids recreating fetchAppointments
  // on every unrelated settings change (theme, title, etc.) that produces a new array ref.
  const selectedCalendarIdsRef = React.useRef<string[]>(settings.selectedCalendarIds);
  React.useEffect(() => {
    selectedCalendarIdsRef.current = settings.selectedCalendarIds;
  }, [settings.selectedCalendarIds]);

  const fetchAppointments = React.useCallback(async () => {
    const calendarIds = selectedCalendarIdsRef.current;
    if (calendarIds.length === 0) return;
    setIsLoading(true);
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(now.getHours(), now.getMinutes(), 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 0);

      // Fetch calendars first to resolve google_calendar_id values
      const calendarData = await api.get(API_ROUTES.CALENDARS);
      const allCalendars: Calendar[] = Array.isArray(calendarData) ? calendarData : [];
      setCalendars(allCalendars);

      // selectedCalendarIds stores google_calendar_id values — pass them directly
      const apptData = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
        startingDateAndTime: format(startOfDay, 'yyyy-MM-dd HH:mm:ss'),
        endingDateAndTime: format(endOfDay, 'yyyy-MM-dd HH:mm:ss'),
        calendar_ids: calendarIds.join(','),
      });

      const appointments: Appointment[] = Array.isArray(apptData)
        ? apptData.map(mapRawAppointment)
        : [];

      const newRooms: TVRoomState[] = calendarIds.map((googleCalId) => {
        const cal = allCalendars.find((c) => c.google_calendar_id === googleCalId);
        const calAppts = appointments
          .filter((a) => a.google_calendar_id === googleCalId)
          .filter((a) => a.status !== 'cancelled')
          .sort((a, b) => {
            const ta = a.time ?? a.start?.dateTime ?? '';
            const tb = b.time ?? b.start?.dateTime ?? '';
            return ta.localeCompare(tb);
          });

        // Read currentIndex from state at call time via setter callback to avoid stale closure
        return {
          calendarId: googleCalId,
          calendarName: cal?.name ?? googleCalId,
          calendarColor: cal?.color,
          currentIndex: 0, // will be merged below
          appointments: calAppts,
        };
      });

      // Merge preserved currentIndex values from current rooms state
      setRooms((prevRooms) => {
        const merged = newRooms.map((room) => {
          const existing = prevRooms.find((r) => r.calendarId === room.calendarId);
          return { ...room, currentIndex: existing?.currentIndex ?? 0 };
        });
        broadcast({ type: 'REFRESH_DATA', rooms: merged });
        return merged;
      });
    } catch (err) {
      console.error('[TVDisplay] Failed to fetch appointments', err);
    } finally {
      setIsLoading(false);
    }
  }, [broadcast]);

  // Load calendars + clinic info — deferred until TV feature is actually used.
  // Firing on every mount would cause two unnecessary API calls on every page
  // for users who never open the TV display.
  const didLoadStaticDataRef = React.useRef(false);
  const loadStaticData = React.useCallback(() => {
    if (didLoadStaticDataRef.current) return;
    didLoadStaticDataRef.current = true;

    api.get(API_ROUTES.CALENDARS)
      .then((data) => setCalendars(Array.isArray(data) ? data : []))
      .catch(() => { /* ignore */ });

    api.get(API_ROUTES.CLINIC)
      .then((raw: any) => {
        const data = Array.isArray(raw) ? raw[0] : raw;
        if (data) {
          setClinicInfo({
            name: data.name ?? data.clinic_name ?? data.nombre ?? '',
            logoUrl: `${process.env.NEXT_PUBLIC_API_URL ?? 'https://n8n-project-n8n.7ig1i3.easypanel.host'}/webhook/clinic/logo`,
            phone: data.phone ?? data.telefono ?? data.phone_number ?? data.tel ?? '',
            address: data.address ?? data.direccion ?? data.domicilio ?? '',
            email: data.email ?? data.correo ?? '',
          });
        }
      })
      .catch(() => { /* ignore */ });
  }, []);

  // Trigger static data load only when TV feature is actually activated
  // (selectedCalendarIds configured, or TV status turned on)
  React.useEffect(() => {
    if (settings.selectedCalendarIds.length > 0 || status === 'on' || status === 'paused') {
      loadStaticData();
    }
  }, [settings.selectedCalendarIds, status, loadStaticData]);

  // Auto-refresh interval when screen is active
  React.useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (status === 'on' || status === 'paused') {
      fetchAppointments();
      refreshTimerRef.current = setInterval(
        fetchAppointments,
        settings.refreshIntervalMinutes * 60 * 1000
      );
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [status, settings.refreshIntervalMinutes, fetchAppointments]);

  const updateSettings = React.useCallback((partial: Partial<TVDisplaySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* noop */ }
      broadcast({ type: 'SETTINGS_CHANGE', settings: next });
      return next;
    });
  }, [broadcast]);

  const setStatus = React.useCallback((s: TVDisplayStatus) => {
    setStatusState(s);
    broadcast({ type: 'STATUS_CHANGE', status: s });
  }, [broadcast]);

  const nextPatient = React.useCallback((calendarId: string) => {
    setRooms((prev) => {
      const updated = prev.map((room) => {
        if (room.calendarId !== calendarId) return room;
        const nextIdx = room.currentIndex + 1 < room.appointments.length
          ? room.currentIndex + 1
          : room.currentIndex;
        return { ...room, currentIndex: nextIdx };
      });
      const room = updated.find((r) => r.calendarId === calendarId);
      const appt = room?.appointments[room.currentIndex];
      broadcast({
        type: 'NEXT_PATIENT',
        calendarId,
        announcement: {
          patientName: appt?.patientName ?? '',
          calendarName: room?.calendarName ?? '',
          calendarColor: room?.calendarColor,
          doctorName: appt?.doctorName,
          time: appt?.time ?? appt?.start?.dateTime?.slice(11, 16),
        },
      });
      return updated;
    });
  }, [broadcast]);

  const openTVScreen = React.useCallback((locale: string) => {
    if (tvWindowRef.current && !tvWindowRef.current.closed) {
      tvWindowRef.current.focus();
      // Re-sync state to the already-open window
      broadcast({ type: 'REFRESH_DATA', rooms });
      return;
    }
    const url = `/${locale}/tv-display/screen`;
    const win = window.open(url, 'tv-display-screen', 'noopener,noreferrer');
    tvWindowRef.current = win;
    setStatus('on');
    // The screen will send REQUEST_STATE once its BroadcastChannel is ready;
    // the context will respond with STATE_SYNC automatically.
  }, [setStatus, broadcast, rooms]);

  return (
    <TVDisplayContext.Provider
      value={{
        settings,
        status,
        rooms,
        calendars,
        clinicInfo,
        isLoading,
        tvWindowRef,
        updateSettings,
        setStatus,
        nextPatient,
        openTVScreen,
        fetchAppointments,
      }}
    >
      {children}
    </TVDisplayContext.Provider>
  );
}

export function useTVDisplay() {
  const ctx = React.useContext(TVDisplayContext);
  if (!ctx) throw new Error('useTVDisplay must be used within TVDisplayProvider');
  return ctx;
}

export { BROADCAST_CHANNEL };
export type { TVDisplayContextType };
