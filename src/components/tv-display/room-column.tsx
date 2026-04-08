'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CalendarX2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppointmentCard } from './appointment-card';
import type { TVRoomState, TVDisplaySettings } from '@/lib/types';

interface RoomColumnProps {
  room: TVRoomState;
  settings: TVDisplaySettings;
  totalRooms: number;
}

export function RoomColumn({ room, settings, totalRooms }: RoomColumnProps) {
  const t = useTranslations('TVDisplayPage.screen');
  const current = room.appointments[room.currentIndex];

  // Show up to 2 next patients
  const nextSlots = settings.showNextPatient
    ? room.appointments.slice(room.currentIndex + 1, room.currentIndex + 3)
    : [];

  const accentColor = room.calendarColor ?? '#3B82F6';

  return (
    <div
      className={cn(
        'flex flex-col h-full rounded-3xl overflow-hidden',
        'border border-white/8',
      )}
      style={{ background: 'rgba(255,255,255,0.025)' }}
    >
      {/* Room header */}
      <div
        className="shrink-0 flex items-center gap-3 px-6 py-4"
        style={{
          background: `linear-gradient(90deg, ${accentColor}20, transparent)`,
          borderBottom: `1px solid ${accentColor}25`,
        }}
      >
        <span
          className="shrink-0 rounded-full"
          style={{
            width: totalRooms <= 2 ? 14 : 10,
            height: totalRooms <= 2 ? 14 : 10,
            background: accentColor,
            boxShadow: `0 0 10px ${accentColor}80`,
          }}
        />
        <h2
          className="font-bold uppercase tracking-widest truncate"
          style={{ fontSize: totalRooms <= 2 ? 'clamp(1rem, 1.8vw, 1.5rem)' : 'clamp(0.85rem, 1.4vw, 1.1rem)' }}
        >
          {room.calendarName}
        </h2>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 p-5 flex-1 overflow-hidden">
        {current ? (
          <>
            <AppointmentCard
              appointment={current}
              variant="current"
              settings={settings}
              accentColor={accentColor}
              animationKey={`${room.calendarId}-${room.currentIndex}`}
            />

            {nextSlots.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                {nextSlots.map((appt, i) => (
                  <AppointmentCard
                    key={`${room.calendarId}-next-${room.currentIndex + 1 + i}`}
                    appointment={appt}
                    variant="next"
                    settings={settings}
                    accentColor={accentColor}
                    animationKey={`${room.calendarId}-next-${room.currentIndex + 1 + i}`}
                    nextPosition={i + 1}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 opacity-20">
            <CalendarX2 style={{ width: '3rem', height: '3rem' }} />
            <span className="text-sm font-bold uppercase tracking-widest">{t('noAppointments')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
