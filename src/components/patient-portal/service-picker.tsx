'use client';

import { AlertCircle, Check, Clock, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import { formatMoney } from '@/lib/currency';
import type { BookableService } from '@/lib/types';
import { cn } from '@/lib/utils';
import { serviceImageUrl, totalServiceMinutes, totalServicePrice } from '@/services/patient-services';

/** Cuántas tarjetas se montan de entrada y cuántas suma cada tanda. */
const PAGE_SIZE = 8;

interface ServicePickerProps {
  services: BookableService[];
  selectedIds: string[];
  onToggle: (service: BookableService) => void;
  isLoading?: boolean;
  /** `true` ⇒ la carga falló; se ofrece reintentar en vez de decir "no hay". */
  hasError?: boolean;
  onRetry?: () => void;
  /**
   * `false` ⇒ no se muestran precios ni duraciones. La clínica decide si el
   * paciente ve los números; la duración se sigue usando para reservar.
   */
  showPricing?: boolean;
}

/**
 * Elección de servicios para la reserva, con imágenes.
 *
 * Dos decisiones de diseño que vale explicar:
 *
 * 1. **Los elegidos quedan fijos arriba**, fuera del área que scrollea. Con un
 *    catálogo largo, lo que el paciente ya marcó se le perdería de vista justo
 *    cuando más lo necesita —al decidir si agrega otro—.
 * 2. **Las tarjetas se montan por tandas** a medida que se scrollea, con un
 *    centinela y un `IntersectionObserver`. El catálogo agendable no está
 *    acotado por diseño, y montar cientos de `<img>` de una vez es lo que haría
 *    inusable la pantalla en un teléfono.
 */
export function ServicePicker({
  services,
  selectedIds,
  onToggle,
  isLoading = false,
  hasError = false,
  onRetry,
  showPricing = false,
}: ServicePickerProps) {
  const t = useTranslations('PatientPortal.booking');
  const tCommon = useTranslations('Common');
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const selected = React.useMemo(
    () => services.filter((s) => selectedIds.includes(s.id)),
    [services, selectedIds],
  );

  // Si la lista cambia (p. ej. tras un reintento) se vuelve a la primera tanda.
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [services]);

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || visibleCount >= services.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((prev) => Math.min(services.length, prev + PAGE_SIZE));
        }
      },
      // Se adelanta un poco para que la tanda siguiente ya esté montada cuando
      // el centinela entra en pantalla.
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleCount, services.length]);

  const visible = services.slice(0, visibleCount);

  const totalMinutes = totalServiceMinutes(selected, 0);
  const totalPrice = totalServicePrice(selected);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('pickServices')}</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[5/4] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed px-4 py-6 text-center">
        <AlertCircle className="mx-auto h-5 w-5 text-destructive" />
        <p className="text-sm text-muted-foreground">{t('servicesLoadError')}</p>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {tCommon('retry')}
          </Button>
        )}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        {t('noBookableServices')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium">{t('pickServices')}</Label>
        <p className="text-xs text-muted-foreground">{t('servicesHint')}</p>
      </div>

      {/* ── Elegidos: fijos arriba, no scrollean ──────────────────────── */}
      {selected.length > 0 && (
        <div className="space-y-2 rounded-xl bg-primary/5 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {t('selectedServices', { count: selected.length })}
            </p>
            {showPricing && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {t('selectionSummary', {
                  minutes: totalMinutes,
                  total: totalPrice ? formatMoney(totalPrice.amount, totalPrice.currency) : '—',
                })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map((service) => (
              <Badge
                key={service.id}
                variant="secondary"
                className="max-w-full gap-1 py-1 pl-2.5 pr-1 text-xs font-medium"
              >
                <span className="truncate">{service.name}</span>
                <button
                  type="button"
                  onClick={() => onToggle(service)}
                  aria-label={t('removeService', { name: service.name })}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ── Catálogo agendable, por tandas ────────────────────────────── */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            isSelected={selectedIds.includes(service.id)}
            onToggle={() => onToggle(service)}
            showPricing={showPricing}
          />
        ))}
      </div>

      {visibleCount < services.length && (
        <div ref={sentinelRef} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
          {Array.from({ length: Math.min(PAGE_SIZE, services.length - visibleCount) }).map((_, i) => (
            <Skeleton key={i} className="aspect-[5/4] rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({
  service,
  isSelected,
  onToggle,
  showPricing,
}: {
  service: BookableService;
  isSelected: boolean;
  onToggle: () => void;
  showPricing: boolean;
}) {
  const t = useTranslations('PatientPortal.booking');
  const imageUrl = serviceImageUrl(service);
  const [imageFailed, setImageFailed] = React.useState(false);
  // Hasta que la imagen carga no se conoce su proporción. Mientras tanto se
  // reserva el espacio con la proporción recomendada, así la lista no salta a
  // medida que van entrando las imágenes al scrollear.
  const [imageLoaded, setImageLoaded] = React.useState(false);

  // `null` ⇒ el backend dijo que no hay imagen. Si la hay (o no se sabe) se
  // pide: un 204 o un error también terminan en el placeholder.
  const hasImage = imageUrl !== null && !imageFailed;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isSelected}
      onClick={onToggle}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-colors',
        isSelected ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50',
      )}
    >
      {/* La imagen ocupa todo el ancho de la tarjeta y el alto sale de su propia
          proporción: no se recorta ni se deforma. Es la clínica la que decide
          cómo se ve su servicio, no un encuadre automático. */}
      <span
        className={cn(
          'flex w-full items-center justify-center overflow-hidden bg-muted',
          // Sin imagen (o mientras carga) se reserva el alto recomendado.
          !hasImage || !imageLoaded ? 'aspect-[16/9]' : null,
        )}
      >
        {hasImage ? (
          // URL de webhook resuelta en runtime: no pasa por `next/image`.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl ?? undefined}
            alt=""
            loading="lazy"
            className={cn('w-full', imageLoaded ? 'h-auto' : 'h-full object-cover')}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Sparkles className="h-6 w-6 text-muted-foreground/60" />
        )}
      </span>

      <span className="flex min-w-0 flex-col gap-1 px-3 py-2.5 pr-10">
        <span className="text-sm font-semibold leading-snug">{service.name}</span>
        {showPricing && (
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" />
              {t('minutesShort', { minutes: service.duration_minutes })}
            </span>
            {service.price != null && (
              <span className="font-medium text-foreground tabular-nums">
                {formatMoney(service.price, service.currency)}
              </span>
            )}
          </span>
        )}
      </span>

      {/* Sobre la esquina de la imagen, con fondo propio: encima de una foto
          cualquiera un check sin relleno no se vería. */}
      <span
        className={cn(
          'absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm transition-colors',
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input bg-background/90',
        )}
      >
        {isSelected && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
