'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTVDisplay } from '@/context/tv-display-context';

export function TVPreview() {
  const t = useTranslations('TVDisplayPage.preview');
  const { settings, rooms, status } = useTVDisplay();

  // rooms use google_calendar_id as calendarId
  const activeRooms = rooms;

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden border bg-slate-950 relative select-none">
      {/* Aspect ratio wrapper mimicking a 16:9 TV */}
      {settings.selectedCalendarIds.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
          <Monitor className="h-8 w-8" />
          <p className="text-xs text-center px-4">{t('selectCalendars')}</p>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col text-white">
          {/* Header bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-white/10">
            <span className="text-[10px] font-bold tracking-wider truncate opacity-90">
              {settings.displayTitle || 'INVOKE IA'}
            </span>
            {settings.showClock && (
              <span className="text-[10px] tabular-nums opacity-70">14:32</span>
            )}
          </div>

          {/* Rooms grid */}
          <div
            className="flex-1 grid gap-1 p-1.5"
            style={{ gridTemplateColumns: `repeat(${Math.min(activeRooms.length, 4)}, 1fr)` }}
          >
            {activeRooms.map((room) => {
              const current = room.appointments[room.currentIndex];
              const accentColor = room.calendarColor ?? '#3B82F6';
              return (
                <div key={room.calendarId} className="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
                  <div
                    className="px-2 py-1 border-b border-white/10 flex items-center gap-1.5"
                    style={{ borderBottomColor: `${accentColor}30` }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
                    <span className="text-[9px] font-bold uppercase tracking-wide truncate">{room.calendarName}</span>
                  </div>
                  <div className="p-2">
                    {current ? (
                      <>
                        <div
                          className="text-[8px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 mb-1"
                          style={{ background: accentColor }}
                        >
                          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                          EN ATENCIÓN
                        </div>
                        {settings.showPatientName && (
                          <p className="text-[11px] font-bold truncate">{current.patientName}</p>
                        )}
                        {settings.showDoctorName && current.doctorName && (
                          <p className="text-[9px] opacity-60 truncate">Dr. {current.doctorName}</p>
                        )}
                        {settings.showAppointmentTime && (
                          <p className="text-[9px] opacity-50 tabular-nums">{current.time}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-[9px] opacity-30 uppercase tracking-widest">Sin turnos</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status overlay */}
          {(status === 'paused' || status === 'off') && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-xs font-bold uppercase tracking-widest opacity-60">
                {status === 'paused' ? 'PAUSADO' : 'APAGADO'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
