'use client';

import { ChevronDown, Clock, Mail, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import * as React from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';

import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';

import { API_ROUTES } from '@/constants/routes';
import type { PublicClinicInfo, PublicClinicSchedule, PublicSede } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getWebhookBaseUrl } from '@/lib/runtime-config';
import { fetchPublicClinicInfo, fetchPublicSedeSchedules, fetchPublicSedes } from '@/services/public-clinic';

const INVOKEIA_LOGO = 'https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp';

/** Índices tal como los guarda `clinic_schedules`: 0 = domingo … 6 = sábado. */
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

/**
 * Pie del portal del paciente, compartido por la landing y `/my-profile`.
 *
 * Lista **todas** las sedes con su contacto: si la clínica tiene varias, el
 * paciente tiene que poder elegir a cuál ir o a cuál escribir sin salir del
 * portal. Arranca plegado —dejando sólo la línea de copyright— y se expande
 * desde el control de la esquina inferior derecha.
 */
export function ClinicFooter() {
  const t = useTranslations('PatientLogin');
  const tSedes = useTranslations('PatientPortal.footer');

  const [clinic, setClinic] = React.useState<PublicClinicInfo | null>(null);
  const [publicSedes, setPublicSedes] = React.useState<PublicSede[]>([]);
  // Arranca plegado: en el portal el alto lo necesita el contenido, y los datos
  // de contacto quedan a un clic desde la última línea.
  const [isExpanded, setIsExpanded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [info, fetchedSedes] = await Promise.all([fetchPublicClinicInfo(), fetchPublicSedes()]);
      if (cancelled) return;
      setClinic(info);
      setPublicSedes(fetchedSedes);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = clinic?.name || t('genericClinicName');

  /**
   * El logo se pide directo a `/clinic/logo` como imagen: el endpoint devuelve
   * el binario, así que el `<img>` lo resuelve solo sin pasar por `api.ts`.
   * Si no hay logo cargado la petición falla y `onError` esconde el hueco.
   */
  const [logoFailed, setLogoFailed] = React.useState(false);
  const logoUrl = `${getWebhookBaseUrl()}${API_ROUTES.CLINIC_LOGO}`;

  /** Sin sedes cargadas, el pie cae a los datos sueltos de la clínica. */
  const sedes: PublicSede[] = React.useMemo(() => {
    if (publicSedes.length) return publicSedes;
    if (!clinic) return [];
    return [
      {
        id: 'clinic',
        name: clinic.name,
        address: clinic.address,
        phone: clinic.phone,
        email: clinic.email,
        schedules: [],
      },
    ];
  }, [clinic, publicSedes]);

  return (
    <footer className="flex-none border-t bg-card/60">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {isExpanded && sedes.length > 0 && (
          <div className="flex gap-5 py-4">
            {/* El logo aprovecha la columna que las filas de sede dejan libre. */}
            {!logoFailed && (
              // `next/image` no aporta acá: la URL sale del webhook en runtime y
              // obligaría a configurar un loader remoto.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={displayName}
                onError={() => setLogoFailed(true)}
                className="hidden h-16 w-16 shrink-0 self-start object-contain sm:block"
              />
            )}

            <ul className="max-h-56 min-w-0 flex-1 divide-y overflow-y-auto">
              {sedes.map((sede) => (
                <li
                  key={sede.id}
                  className="flex flex-col gap-x-6 gap-y-1.5 py-2.5 text-xs lg:flex-row lg:items-start"
                >
                  <p className="min-w-0 shrink-0 font-semibold lg:w-44">{sede.name}</p>

                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                    {sede.address && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(sede.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 items-center gap-1.5 hover:text-foreground"
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{sede.address}</span>
                      </a>
                    )}

                    {sede.phone && (
                      /* WhatsApp y no `tel:`: en escritorio `tel:` abre Skype u
                         otro handler que casi nadie tiene configurado. */
                      <a
                        href={`https://wa.me/${sede.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 hover:text-foreground"
                        title={tSedes('whatsapp')}
                      >
                        <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
                        {sede.phone}
                      </a>
                    )}

                    {sede.email && (
                      /* `mailto:` con asunto prefijado: abre el cliente de correo
                         que el paciente ya usa, en vez de obligarlo a redactar
                         dentro del portal. */
                      <a
                        href={`mailto:${sede.email}?subject=${encodeURIComponent(
                          tSedes('mailSubject', { sede: sede.name }),
                        )}`}
                        className="flex min-w-0 items-center gap-1.5 hover:text-foreground"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{sede.email}</span>
                      </a>
                    )}

                    <SedeSchedules
                      sedeId={sede.id}
                      label={tSedes('viewSchedules')}
                      emptyLabel={tSedes('noSchedules')}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Última línea: es lo único que queda al plegar. */}
        <div
          className={cn(
            'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2.5 text-xs text-muted-foreground md:justify-between',
            isExpanded && sedes.length > 0 && 'border-t',
          )}
        >
          <span>
            © {new Date().getFullYear()} {displayName}
          </span>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <a
              href="https://www.invokeia.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Image src={INVOKEIA_LOGO} width={14} height={14} alt="" className="h-3.5 w-3.5" />
              {t('footer.poweredBy')}
            </a>

            {/* Último elemento de la fila: queda en la esquina inferior derecha,
                teñido para que se distinga del resto del pie, que es todo texto
                apagado. */}
            {sedes.length > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                aria-expanded={isExpanded}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary transition-colors hover:bg-primary/20"
              >
                {isExpanded ? tSedes('collapse') : tSedes('expand')}
                <ChevronDown className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')} />
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

/**
 * Horarios de una sede, detrás de un enlace "Ver horarios".
 *
 * Se piden **al abrir el popover**, no al montar el pie: con varias sedes serían
 * otras tantas llamadas que la mayoría de los visitantes nunca mira. Una vez
 * cargados quedan en memoria.
 *
 * Dentro van agrupados por día y ordenados de lunes a domingo, con el día en
 * columna fija y las horas en `tabular-nums` para que las filas alineen.
 */
function SedeSchedules({
  sedeId,
  label,
  emptyLabel,
}: {
  sedeId: string;
  label: string;
  emptyLabel: string;
}) {
  const t = useTranslations('PatientLogin.weekdays');
  const [schedules, setSchedules] = React.useState<PublicClinicSchedule[] | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open || schedules !== null) return;
    void fetchPublicSedeSchedules(sedeId).then(setSchedules);
  };

  const byDay = React.useMemo(() => {
    const map = new Map<number, string[]>();
    for (const s of schedules ?? []) {
      map.set(s.day_of_week, [...(map.get(s.day_of_week) ?? []), `${s.start_time}–${s.end_time}`]);
    }
    // Lunes primero; el domingo (0) va al final, que es como se lee un horario.
    return [...map.entries()].sort(([a], [b]) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  }, [schedules]);

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger className="flex items-center gap-1.5 hover:text-foreground">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-3">
        {schedules === null ? (
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-3.5 w-full" />
            ))}
          </div>
        ) : byDay.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {byDay.map(([day, ranges]) => (
              <li key={day} className="flex gap-2">
                <span className="w-20 shrink-0 capitalize text-muted-foreground">
                  {t(DAY_KEYS[day] ?? 'monday')}
                </span>
                <span className="tabular-nums">{ranges.join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
