'use client';

import * as React from 'react';
import { Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RoomColumn } from '@/components/tv-display/room-column';
import { PromoPlayer } from '@/components/tv-display/promo-player';
import { ClockDisplay } from '@/components/tv-display/clock-display';
import { BROADCAST_CHANNEL } from '@/context/tv-display-context';
import type { TVDisplaySettings, TVRoomState } from '@/lib/types';
import type { TVBroadcastMessage, TVDisplayStatus, TVAnnouncement } from '@/context/tv-display-context';

const STORAGE_KEY = 'invoke-ia-tv-settings';
const ANNOUNCEMENT_DURATION_MS = 5000;

const DEFAULT_SETTINGS: TVDisplaySettings = {
  isEnabled: false,
  showPatientName: true,
  showDoctorName: true,
  showAppointmentTime: true,
  showNextPatient: true,
  autoAdvance: false,
  videoUrls: [],
  musicEnabled: false,
  musicUrl: '',
  displayTitle: '',
  theme: 'dark',
  refreshIntervalMinutes: 5,
  promoIntervalMinutes: 15,
  selectedCalendarIds: [],
  showClock: true,
  showDate: true,
};

export default function TVScreenPage() {
  const [settings, setSettings] = React.useState<TVDisplaySettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = React.useState<TVDisplayStatus>('on');
  const [rooms, setRooms] = React.useState<TVRoomState[]>([]);
  const channelRef = React.useRef<BroadcastChannel | null>(null);

  // Announcement overlay state
  const [announcement, setAnnouncement] = React.useState<TVAnnouncement | null>(null);
  const announcementTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-promo timer
  const promoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load settings from localStorage ────────────────────────────────────────
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TVDisplaySettings;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch { /* ignore */ }
  }, []);

  // ── BroadcastChannel ────────────────────────────────────────────────────────
  const showAnnouncement = React.useCallback((data: TVAnnouncement) => {
    if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
    setAnnouncement(data);
    announcementTimerRef.current = setTimeout(() => setAnnouncement(null), ANNOUNCEMENT_DURATION_MS);
  }, []);

  const resetPromoTimer = React.useCallback((intervalMinutes: number) => {
    if (promoTimerRef.current) clearTimeout(promoTimerRef.current);
    if (intervalMinutes > 0) {
      promoTimerRef.current = setTimeout(() => {
        setStatus((s) => (s === 'on' ? 'promo' : s));
      }, intervalMinutes * 60 * 1000);
    }
  }, []);

  React.useEffect(() => {
    const ch = new BroadcastChannel(BROADCAST_CHANNEL);
    channelRef.current = ch;

    ch.onmessage = (event: MessageEvent<TVBroadcastMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'STATE_SYNC':
          setRooms(msg.rooms);
          setStatus(msg.status);
          setSettings(msg.settings);
          break;
        case 'STATUS_CHANGE':
          setStatus(msg.status);
          break;
        case 'SETTINGS_CHANGE':
          setSettings(msg.settings);
          break;
        case 'REFRESH_DATA':
          setRooms(msg.rooms);
          break;
        case 'NEXT_PATIENT':
          // Interrupt promo, show the rooms + announcement
          setStatus((s) => (s === 'promo' ? 'on' : s));
          setRooms((prev) =>
            prev.map((room) => {
              if (room.calendarId !== msg.calendarId) return room;
              const nextIdx =
                room.currentIndex + 1 < room.appointments.length
                  ? room.currentIndex + 1
                  : room.currentIndex;
              return { ...room, currentIndex: nextIdx };
            })
          );
          if (msg.announcement?.patientName) {
            showAnnouncement(msg.announcement);
          }
          break;
        case 'SHOW_PROMO':
          setStatus('promo');
          break;
      }
    };

    ch.postMessage({ type: 'REQUEST_STATE' } satisfies TVBroadcastMessage);
    return () => ch.close();
  }, [showAnnouncement]);

  // ── Auto-promo interval — resets when settings change or status becomes 'on' ─
  React.useEffect(() => {
    if (status === 'on' && settings.promoIntervalMinutes > 0) {
      resetPromoTimer(settings.promoIntervalMinutes);
    } else {
      if (promoTimerRef.current) clearTimeout(promoTimerRef.current);
    }
    return () => {
      if (promoTimerRef.current) clearTimeout(promoTimerRef.current);
    };
  }, [status, settings.promoIntervalMinutes, resetPromoTimer]);

  // ── Fullscreen ──────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      try { await document.documentElement.requestFullscreen(); } catch { /* denied */ }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  };

  // ── Theme ───────────────────────────────────────────────────────────────────
  const themeBg: Record<string, string> = {
    dark: '#0a0f1e',
    light: '#f1f5f9',
    branded: '#060d1f',
  };
  const themeText: Record<string, string> = {
    dark: '#ffffff',
    light: '#0f172a',
    branded: '#ffffff',
  };
  const bg = themeBg[settings.theme] ?? themeBg.dark;
  const fg = themeText[settings.theme] ?? themeText.dark;

  const showRooms = status === 'on' || status === 'paused';

  return (
    <>
      {/* Google Font — Outfit */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&display=swap');`}</style>

      <div
        className="fixed inset-0 z-[9999] flex flex-col overflow-hidden"
        style={{ background: bg, color: fg, fontFamily: "'Outfit', 'Inter', system-ui, sans-serif" }}
      >
        {/* ── PROMO MODE ─────────────────────────────────────────── */}
        {status === 'promo' && (
          <PromoPlayer
            videoUrls={settings.videoUrls}
            musicUrl={settings.musicUrl}
            musicEnabled={settings.musicEnabled}
            onEnded={() => setStatus('on')}
          />
        )}

        {/* ── OFF OVERLAY ────────────────────────────────────────── */}
        {status === 'off' && (
          <div className="absolute inset-0 bg-black z-20 flex items-center justify-center">
            <span className="text-3xl font-black tracking-[0.3em] uppercase opacity-15">
              INVOKE IA
            </span>
          </div>
        )}

        {/* ── PAUSED OVERLAY ─────────────────────────────────────── */}
        {status === 'paused' && (
          <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center pointer-events-none">
            <span className="text-4xl font-black tracking-widest uppercase opacity-30">
              ⏸ PAUSADO
            </span>
          </div>
        )}

        {/* ── ANNOUNCEMENT OVERLAY ───────────────────────────────── */}
        {announcement && (
          <div
            className={cn(
              'absolute inset-0 z-30 flex items-center justify-center',
              'animate-in fade-in duration-300',
            )}
            style={{ background: 'rgba(0,0,0,0.88)' }}
          >
            <div className="flex flex-col items-center text-center px-12 max-w-4xl w-full">
              {/* Room badge */}
              <div
                className="inline-flex items-center gap-3 px-6 py-2 rounded-full mb-8"
                style={{
                  background: announcement.calendarColor ? `${announcement.calendarColor}30` : 'rgba(59,130,246,0.2)',
                  border: `2px solid ${announcement.calendarColor ?? '#3B82F6'}60`,
                }}
              >
                <span
                  className="w-3 h-3 rounded-full animate-pulse"
                  style={{ background: announcement.calendarColor ?? '#3B82F6' }}
                />
                <span
                  className="font-bold uppercase tracking-[0.2em]"
                  style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)', color: announcement.calendarColor ?? '#3B82F6' }}
                >
                  {announcement.calendarName}
                </span>
              </div>

              {/* Patient name — massive */}
              {settings.showPatientName && announcement.patientName && (
                <p
                  className="font-black leading-none tracking-tight mb-6"
                  style={{ fontSize: 'clamp(3rem, 8vw, 7rem)', lineHeight: 1.0 }}
                >
                  {announcement.patientName}
                </p>
              )}

              {/* Doctor + time */}
              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
                {settings.showDoctorName && announcement.doctorName && (
                  <span
                    className="font-semibold opacity-70"
                    style={{ fontSize: 'clamp(1.2rem, 2.5vw, 2rem)' }}
                  >
                    Dr. {announcement.doctorName}
                  </span>
                )}
                {settings.showAppointmentTime && announcement.time && (
                  <span
                    className="font-bold tabular-nums"
                    style={{
                      fontSize: 'clamp(1.2rem, 2.5vw, 2rem)',
                      color: announcement.calendarColor ?? '#3B82F6',
                    }}
                  >
                    {announcement.time}
                  </span>
                )}
              </div>

              {/* Dismiss hint */}
              <p
                className="mt-12 opacity-20 uppercase tracking-widest"
                style={{ fontSize: '0.75rem' }}
              >
                Pasando en un momento...
              </p>
            </div>
          </div>
        )}

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <header
          className="shrink-0 flex items-center justify-between px-8 py-4"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <span
            className="font-black tracking-tight"
            style={{ fontSize: 'clamp(1.1rem, 2vw, 1.6rem)' }}
          >
            {settings.displayTitle || 'INVOKE IA'}
          </span>

          <div className="flex items-center gap-6">
            {(settings.showClock || settings.showDate) && <ClockDisplay />}
            <button
              onClick={toggleFullscreen}
              className="opacity-20 hover:opacity-60 transition-opacity p-1 rounded"
              aria-label="Toggle fullscreen"
            >
              <Maximize2 className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* ── ROOMS GRID ─────────────────────────────────────────── */}
        <main
          className="flex-1 grid gap-4 p-6 overflow-hidden min-h-0"
          style={{
            gridTemplateColumns:
              rooms.length > 0 ? `repeat(${Math.min(rooms.length, 4)}, 1fr)` : '1fr',
            opacity: showRooms ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        >
          {rooms.length === 0 ? (
            <div
              className="flex items-center justify-center opacity-15"
              style={{ fontSize: 'clamp(0.9rem, 1.5vw, 1.2rem)' }}
            >
              <p className="uppercase tracking-widest font-bold">
                No hay consultorios configurados
              </p>
            </div>
          ) : (
            rooms.map((room) => (
              <RoomColumn
                key={room.calendarId}
                room={room}
                settings={settings}
                totalRooms={rooms.length}
              />
            ))
          )}
        </main>
      </div>
    </>
  );
}
