import type { CountryCode } from 'libphonenumber-js/min';

import { cn } from '@/lib/utils';

interface CountryFlagProps {
  country: CountryCode;
  /** Vacío cuando el nombre del país ya está al lado (la bandera es decorativa). */
  alt?: string;
  className?: string;
}

/**
 * Bandera servida desde `public/flags` (SVG de `country-flag-icons`, una por cada país de
 * libphonenumber). Se usa imagen y no emoji porque Chrome en Windows no dibuja banderas emoji:
 * muestra las letras del código. Son archivos sueltos y lazy para no sumar ~500 KB al bundle.
 */
export function CountryFlag({ country, alt = '', className }: CountryFlagProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático, no necesita optimización
    <img
      src={`/flags/${country}.svg`}
      alt={alt}
      width={18}
      height={12}
      loading="lazy"
      decoding="async"
      className={cn('h-3 w-[18px] shrink-0 rounded-[2px] object-cover ring-1 ring-border', className)}
    />
  );
}
