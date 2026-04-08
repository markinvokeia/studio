'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Appointment, TVDisplaySettings } from '@/lib/types';

interface AppointmentCardProps {
  appointment: Appointment;
  variant: 'current' | 'next';
  settings: TVDisplaySettings;
  accentColor?: string;
  animationKey?: string | number;
  /** Relative size for "next" slots — 1 = first next, 2 = second next, etc. */
  nextPosition?: number;
}

export function AppointmentCard({
  appointment,
  variant,
  settings,
  accentColor = '#3B82F6',
  animationKey,
  nextPosition = 1,
}: AppointmentCardProps) {
  const t = useTranslations('TVDisplayPage.screen');
  const isCurrent = variant === 'current';
  const time = appointment.time ?? appointment.start?.dateTime?.slice(11, 16);

  return (
    <div
      key={animationKey}
      className={cn(
        'rounded-2xl transition-all duration-700',
        isCurrent
          ? 'animate-in fade-in slide-in-from-bottom-6 duration-700'
          : 'animate-in fade-in slide-in-from-bottom-3 duration-500',
      )}
    >
      {isCurrent ? (
        /* ── CURRENT PATIENT — large card ───────────────────── */
        <div
          className="rounded-2xl p-6 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${accentColor}28 0%, ${accentColor}10 100%)`,
            border: `1px solid ${accentColor}50`,
          }}
        >
          {/* Glowing top border */}
          <div
            className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
            style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}60)` }}
          />

          {/* EN ATENCIÓN badge */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-full"
              style={{ background: accentColor, color: '#fff' }}
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              {t('nowAttending')}
            </span>
          </div>

          {/* Patient name — hero size */}
          {settings.showPatientName && (
            <p
              className="font-extrabold leading-tight tracking-tight mb-3"
              style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3.2rem)', lineHeight: 1.1 }}
            >
              {appointment.patientName}
            </p>
          )}

          {/* Doctor + time row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2">
            {settings.showDoctorName && appointment.doctorName && (
              <span
                className="font-semibold"
                style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', opacity: 0.75 }}
              >
                {t('dr')} {appointment.doctorName}
              </span>
            )}
            {settings.showAppointmentTime && time && (
              <span
                className="tabular-nums font-bold"
                style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', color: accentColor }}
              >
                {time}
              </span>
            )}
          </div>
        </div>
      ) : (
        /* ── NEXT PATIENTS — progressively smaller ──────────── */
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            opacity: nextPosition === 1 ? 0.9 : 0.6,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="text-[10px] font-bold tracking-widest uppercase shrink-0 opacity-50"
            >
              {t('next')}
            </span>
            {settings.showPatientName && (
              <span
                className="font-semibold truncate"
                style={{ fontSize: nextPosition === 1 ? 'clamp(1rem, 1.8vw, 1.4rem)' : 'clamp(0.85rem, 1.4vw, 1.1rem)' }}
              >
                {appointment.patientName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {settings.showDoctorName && appointment.doctorName && (
              <span
                className="opacity-50 truncate hidden sm:block"
                style={{ fontSize: 'clamp(0.75rem, 1.2vw, 0.9rem)' }}
              >
                {t('dr')} {appointment.doctorName}
              </span>
            )}
            {settings.showAppointmentTime && time && (
              <span
                className="tabular-nums font-bold"
                style={{ fontSize: 'clamp(0.85rem, 1.4vw, 1.1rem)', color: accentColor }}
              >
                {time}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
