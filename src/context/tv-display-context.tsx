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
    google_calendar_id: raw.google_calendar_id ?? raw.googleCalendarId ?? undefined,
    googleEventId: raw.google_event_id ?? raw.googleEventId ?? raw.id,
    calendar_id: raw.calendar_id ?? '',
    calendar_source_id: raw.calendar_source_id != null ? String(raw.calendar_source_id) : '',
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
  const roomsRef = React.useRef<TVRoomState[]>(rooms);
  const statusRef = React.useRef<TVDisplayStatus>(status);
  const settingsRef = React.useRef<TVDisplaySettings>(settings);
  const clinicInfoRef = React.useRef<TVClinicInfo | null>(clinicInfo);

  React.useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  React.useEffect(() => { statusRef.current = status; }, [status]);
  React.useEffect(() => { settingsRef.current = settings; }, [settings]);
  React.useEffect(() => { clinicInfoRef.current = clinicInfo; }, [clinicInfo]);

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
        ch.postMessage({
          type: 'STATE_SYNC',
          rooms: roomsRef.current,
          status: statusRef.current,
          settings: settingsRef.current,
          clinicInfo: clinicInfoRef.current,
        } satisfies TVBroadcastMessage);
      }
    };
    return () => ch.close();
  }, []);

  const broadcast = React.useCallback((msg: TVBroadcastMessage) => {
    channelRef.current?.postMessage(msg);
  }, []);

  // Stable reference for selectedCalendarIds (calendar_source_id values) — avoids recreating
  // fetchAppointments on every unrelated settings change that produces a new array ref.
  const selectedCalendarIdsRef = React.useRef<string[]>(settings.selectedCalendarIds);
  React.useEffect(() => {
    selectedCalendarIdsRef.current = settings.selectedCalendarIds;
  }, [settings.selectedCalendarIds]);

  const fetchAppointments = React.useCallback(async () => {
    const calendarSourceIds = selectedCalendarIdsRef.current;
    if (calendarSourceIds.length === 0) return;
    setIsLoading(true);
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(now.getHours(), now.getMinutes(), 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 0);

      const calendarData = await api.get(API_ROUTES.CALENDARS);
      const allCalendars: Calendar[] = Array.isArray(calendarData) ? calendarData : [];
      setCalendars(allCalendars);

      // Only keep IDs that match an active Calendar — discard stale or inactive entries
      const activeCalendarIds = new Set(
        allCalendars.filter((c) => c.is_active !== false).map((c) => String(c.id))
      );
      const resolvedCalendarIds = calendarSourceIds
        .map(String)
        .filter((id) => activeCalendarIds.has(id));

      if (resolvedCalendarIds.length === 0) return;

      const apptData = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
        startingDateAndTime: format(startOfDay, 'yyyy-MM-dd HH:mm:ss'),
        endingDateAndTime: format(endOfDay, 'yyyy-MM-dd HH:mm:ss'),
        calendar_source_ids: resolvedCalendarIds.join(','),
      });

      const appointments: Appointment[] = Array.isArray(apptData)
        ? apptData.map(mapRawAppointment)
        : [];

      const newRooms: TVRoomState[] = resolvedCalendarIds.map((calendarSourceId) => {
        const cal = allCalendars.find((c) => String(c.id) === calendarSourceId);
        const calAppts = appointments
          .filter((a) => String(a.calendar_source_id) === calendarSourceId)
          .filter((a) => a.status !== 'cancelled')
          .sort((a, b) => {
            const ta = a.time ?? a.start?.dateTime ?? '';
            const tb = b.time ?? b.start?.dateTime ?? '';
            return ta.localeCompare(tb);
          });

        return {
          calendarId: calendarSourceId,
          calendarName: cal?.name ?? calendarSourceId,
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
        // Only broadcast if appointment data actually changed
        const prevKey = JSON.stringify(prevRooms.map(r => r.appointments.map(a => a.id)));
        const nextKey = JSON.stringify(merged.map(r => r.appointments.map(a => a.id)));
        if (prevKey !== nextKey) {
          broadcast({ type: 'REFRESH_DATA', rooms: merged });
        }
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

  // Re-fetch appointments whenever the selected calendars change
  const prevCalendarIdsRef = React.useRef<string>(JSON.stringify(settings.selectedCalendarIds));
  React.useEffect(() => {
    const next = JSON.stringify(settings.selectedCalendarIds);
    if (next === prevCalendarIdsRef.current) return;
    prevCalendarIdsRef.current = next;
    if (settings.selectedCalendarIds.length === 0) return;
    const id = setTimeout(fetchAppointments, 300);
    return () => clearTimeout(id);
  }, [settings.selectedCalendarIds, fetchAppointments]);

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
    // Update the ref synchronously so REQUEST_STATE responses see the correct status
    // before React's async re-render cycle completes.
    statusRef.current = s;
    setStatusState(s);
    broadcast({ type: 'STATUS_CHANGE', status: s });
  }, [broadcast]);

  const nextPatient = React.useCallback((calendarId: string) => {
    setRooms((prev) => {
      const updated = prev.map((room) => {
        if (room.calendarId !== calendarId) return room;
        // Allow advancing one past the last appointment (shows empty state)
        const nextIdx = room.currentIndex < room.appointments.length
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
    const win = window.open(url, 'tv-display-screen');
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
