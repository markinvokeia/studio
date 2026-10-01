'use client';

import Image from 'next/image';
import * as React from 'react';

import { INVOKEIA_LOGO } from '@/components/patient-portal/invokeia-logo';

import { cn } from '@/lib/utils';
import { fetchPublicClinicInfo } from '@/services/public-clinic';

interface ClinicBrandLogoProps {
  /**
   * Logo ya resuelto por quien llama. Omitirlo hace que el componente lo pida
   * por su cuenta a `/api/public/clinic` — la promesa está memoizada, así que
   * varios logos en pantalla no multiplican los requests.
   */
  logoUrl?: string | null;
  /** Nombre de la clínica, para el `alt`. */
  name?: string;
  /** Lado del cuadrado, en px. */
  size?: number;
  className?: string;
}

/**
 * Logo de la clínica en el portal del paciente.
 *
 * El branding del portal es el de la **clínica**, no el de Invoke IA: el
 * paciente entra a la web de su odontólogo, no a la de un proveedor de
 * software. La imagen sale del webhook `/clinic/logo`, el mismo que usan los
 * membretes de los reportes, que resuelve la auth de Drive y es público.
 *
 * El isotipo de Invoke queda sólo como red: si la clínica no cargó logo el
 * endpoint responde 204 y la `<img>` dispara `onError`, y entonces sí se
 * muestra la marca genérica en vez de un hueco roto.
 */
export function ClinicBrandLogo({ logoUrl, name, size = 32, className }: ClinicBrandLogoProps) {
  const [resolved, setResolved] = React.useState<string | null>(logoUrl ?? null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (logoUrl !== undefined) {
      setResolved(logoUrl);
      setFailed(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const clinic = await fetchPublicClinicInfo();
      if (!cancelled) setResolved(clinic?.logo_url ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  const style = { width: size, height: size };

  if (!resolved || failed) {
    return (
      <Image
        src={INVOKEIA_LOGO}
        width={size}
        height={size}
        alt="Invoke IA"
        className={cn('shrink-0 object-contain', className)}
        style={style}
      />
    );
  }

  return (
    // La URL se resuelve en runtime (webhook de n8n o data URI), así que no
    // puede pasar por el optimizador de `next/image`.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={name || ''}
      className={cn('shrink-0 object-contain', className)}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
