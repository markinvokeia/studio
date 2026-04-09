'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Monitor, Phone, MapPin, Mail } from 'lucide-react';
import { useTVDisplay } from '@/context/tv-display-context';

export function TVPreview() {
  const t = useTranslations('TVDisplayPage.preview');
  const { settings, rooms, status, clinicInfo } = useTVDisplay();

  // Theme colours — mirrors screen/page.tsx
  const themeBg: Record<string, string> = { dark: '#0a0f1e', light: '#f1f5f9', branded: '#060d1f' };
  const themeText: Record<string, string> = { dark: '#ffffff', light: '#0f172a', branded: '#ffffff' };
  const bg = themeBg[settings.theme] ?? themeBg.dark;
  const fg = themeText[settings.theme] ?? themeText.dark;
  const isDark = settings.theme !== 'light';

  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const headerBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const textOpacity = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';

  return (
    <div
      className="w-full aspect-video rounded-xl overflow-hidden border relative select-none"
      style={{
        background: bg,
        color: fg,
        borderColor,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {settings.selectedCalendarIds.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
          <Monitor className="h-6 w-6" />
          <p className="text-[9px] text-center px-4">{t('selectCalendars')}</p>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col">
          {/* Header */}
          <div
            className="shrink-0 flex items-center justify-between px-2 py-1"
            style={{ background: headerBg, borderBottom: `1px solid ${headerBorder}` }}
          >
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {clinicInfo?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clinicInfo.logoUrl}
                  alt=""
                  className="object-contain shrink-0"
                  style={{ maxHeight: '1rem', maxWidth: '2.5rem' }}
                />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] font-black tracking-wider truncate">
                  {clinicInfo?.name || 'INVOKE IA'}
                </span>
                {clinicInfo && (settings.showClinicPhone || settings.showClinicAddress || settings.showClinicEmail) && (
                  <div className="flex flex-wrap gap-x-1.5 mt-px">
                    {settings.showClinicPhone && clinicInfo.phone && (
                      <span className="text-[5px] flex items-center gap-px" style={{ opacity: 0.5 }}>
                        <Phone className="h-1.5 w-1.5 shrink-0" />{clinicInfo.phone}
                      </span>
                    )}
                    {settings.showClinicAddress && clinicInfo.address && (
                      <span className="text-[5px] flex items-center gap-px" style={{ opacity: 0.5 }}>
                        <MapPin className="h-1.5 w-1.5 shrink-0" />{clinicInfo.address}
                      </span>
                    )}
                    {settings.showClinicEmail && clinicInfo.email && (
                      <span className="text-[5px] flex items-center gap-px" style={{ opacity: 0.5 }}>
                        <Mail className="h-1.5 w-1.5 shrink-0" />{clinicInfo.email}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {(settings.showClock || settings.showDate) && (
              <div className="flex flex-col items-end shrink-0 ml-1">
                {settings.showClock && (
                  <span className="text-[8px] tabular-nums font-bold" style={{ opacity: 0.8 }}>14:32</span>
                )}
                {settings.showDate && (
                  <span className="text-[6px]" style={{ opacity: 0.5 }}>lun 8 abr</span>
                )}
              </div>
            )}
          </div>

          {/* Rooms grid */}
          <div
            className="flex-1 grid gap-1 p-1.5 min-h-0"
            style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(rooms.length, 1), 4)}, 1fr)` }}
          >
            {rooms.length === 0 ? (
              <div className="flex items-center justify-center" style={{ opacity: 0.15 }}>
                <p className="text-[7px] uppercase tracking-widest font-bold">Sin consultorios</p>
              </div>
            ) : rooms.map((room) => {
              const current = room.appointments[room.currentIndex];
              const nextAppt = settings.showNextPatient ? room.appointments[room.currentIndex + 1] : null;
              const accentColor = room.calendarColor ?? '#3B82F6';
              return (
                <div
                  key={room.calendarId}
                  className="rounded overflow-hidden flex flex-col"
                  style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                >
                  {/* Room header */}
                  <div
                    className="px-1.5 py-0.5 flex items-center gap-1 shrink-0"
                    style={{ borderBottom: `1px solid ${accentColor}30`, background: `${accentColor}15` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentColor }} />
                    <span className="text-[7px] font-bold uppercase tracking-wide truncate">{room.calendarName}</span>
                  </div>

                  {/* Patient content */}
                  <div className="flex-1 p-1 flex flex-col gap-0.5">
                    {current ? (
                      <>
                        {/* EN ATENCIÓN badge */}
                        <div
                          className="text-[5px] font-bold uppercase px-1 py-px rounded-full inline-flex items-center gap-0.5 self-start"
                          style={{ background: accentColor, color: '#fff' }}
                        >
                          <span className="w-0.5 h-0.5 rounded-full bg-white" />
                          EN ATENCIÓN
                        </div>
                        {settings.showPatientName && (
                          <p className="text-[8px] font-bold truncate leading-tight">{current.patientName}</p>
                        )}
                        {settings.showDoctorName && current.doctorName && (
                          <p className="text-[6px] truncate" style={{ opacity: 0.5 }}>Dr. {current.doctorName}</p>
                        )}
                        {settings.showAppointmentTime && (
                          <p className="text-[6px] tabular-nums" style={{ color: accentColor }}>{current.time}</p>
                        )}

                        {/* Next patient row */}
                        {nextAppt && (
                          <div
                            className="mt-0.5 px-1 py-0.5 rounded"
                            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', opacity: 0.75 }}
                          >
                            <span className="text-[5px] uppercase opacity-50 mr-1">Sig.</span>
                            {settings.showPatientName && (
                              <span className="text-[6px] font-semibold truncate">{nextAppt.patientName}</span>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-[7px] uppercase tracking-widest" style={{ opacity: 0.25 }}>Sin turnos</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status overlay */}
          {status === 'paused' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-[8px] font-black uppercase tracking-widest" style={{ opacity: 0.5 }}>PAUSADO</span>
            </div>
          )}
          {status === 'off' && (
            <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
              <span className="text-[8px] font-black uppercase tracking-widest" style={{ opacity: 0.4 }}>APAGADO</span>
            </div>
          )}
          {status === 'promo' && (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              <span className="text-[8px] font-black uppercase tracking-widest" style={{ opacity: 0.2 }}>PROMO</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
