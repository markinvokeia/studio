'use client';

import { useClinicInfo } from '@/hooks/useClinicInfo';

/**
 * Professional clinic header shown only on print.
 * The img is also rendered as a 1×1 invisible pixel on screen so the browser
 * caches it before the print dialog opens.
 */
export function PrintReportHeader() {
  const clinic = useClinicInfo();
  if (!clinic) return null;

  const contactLine = [clinic.phone, clinic.email].filter(Boolean).join(' | ');

  return (
    <>
      {/* Preload: forces browser to fetch and cache the logo even though the
          print header itself is display:none on screen. */}
      {clinic.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={clinic.logoUrl}
          alt=""
          aria-hidden
          className="fixed top-0 left-0 w-px h-px opacity-0 pointer-events-none"
        />
      )}

      {/* Shown only on print */}
      <div className="hidden print:flex items-center gap-5 pb-4 mb-5 border-b-2 border-gray-300">
        {clinic.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clinic.logoUrl}
            alt={clinic.name}
            className="h-16 w-auto max-w-[140px] object-contain shrink-0"
          />
        )}
        <div className="flex flex-col gap-0.5">
          <p className="text-xl font-bold leading-tight">{clinic.name}</p>
          {clinic.address && (
            <p className="text-xs text-gray-500">{clinic.address}</p>
          )}
          {contactLine && (
            <p className="text-xs text-gray-500">{contactLine}</p>
          )}
        </div>
      </div>
    </>
  );
}
