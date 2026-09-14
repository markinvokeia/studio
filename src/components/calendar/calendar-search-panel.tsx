'use client';

import React from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { CalendarDays, ChevronDown, Loader2, Search, Stethoscope, User, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { STATUS_ACCENT_COLOR } from '@/constants/appointment-status';
import { cn } from '@/lib/utils';

/** Calendario/agenda para el filtro del buscador. */
export interface CalendarSearchCalendarOption {
  id: string;
  name: string;
  color?: string;
}

/** Proyección mínima de una cita para la lista de resultados. La página resuelve
 *  el `Appointment` completo por `id` al seleccionar. */
export interface CalendarSearchResult {
  id: string;
  /** Título de la cita (summary / servicio). */
  title: string;
  /** Nombre del paciente, si lo hay. */
  subtitle?: string;
  /** Doctor asignado, si lo hay. */
  meta?: string;
  start: Date;
  /** Estado normalizado, para el punto de color. */
  status?: string;
}

interface CalendarSearchPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  results: CalendarSearchResult[];
  isLoading: boolean;
  /** Ya se lanzó al menos una búsqueda con el término actual (controla el "sin resultados"). */
  hasSearched: boolean;
  /** Mínimo de caracteres para disparar la búsqueda. */
  minChars: number;
  /** Id del resultado elegido (resaltado). */
  selectedId?: string;
  dateLocale: Locale;
  /** Calendarios disponibles para acotar la búsqueda. */
  calendars: CalendarSearchCalendarOption[];
  /** Ids de calendario seleccionados. Vacío = buscar en todos. */
  selectedCalendarIds: string[];
  onSelectedCalendarIdsChange: (ids: string[]) => void;
  onSelect: (result: CalendarSearchResult) => void;
  onClose: () => void;
}

/** Chip flotante que reemplaza al panel en mobile mientras se está viendo un
 *  resultado (el panel taparía la grilla). Toca la etiqueta para reabrir el panel;
 *  la ✕ termina la búsqueda (limpia resultados y la cita resaltada). */
export function CalendarSearchResultsChip({
  query,
  count,
  onExpand,
  onClose,
}: {
  query: string;
  count: number;
  onExpand: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('Calendar.search');
  return (
    <div className="absolute bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card p-1 shadow-xl">
      <button
        type="button"
        onClick={onExpand}
        aria-label={t('panelTitle')}
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-muted"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="max-w-[45vw] truncate font-medium">{query.trim()}</span>
        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">{count}</span>
      </button>
      <button
        type="button"
        onClick={onClose}
        title={t('close')}
        aria-label={t('close')}
        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Fila del filtro de calendarios. Es un <div role="button"> y no un <button>
 *  porque lleva dentro un Checkbox de Radix (que ya es un <button>). */
function CalendarFilterRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={checked}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
    >
      <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
      {children}
    </div>
  );
}

/** Panel flotante de búsqueda de citas por texto (título de la cita o datos del
 *  paciente). Mismo lenguaje visual que `CalendarGapsPanel`. */
export function CalendarSearchPanel({
  query,
  onQueryChange,
  results,
  isLoading,
  hasSearched,
  minChars,
  selectedId,
  dateLocale,
  calendars,
  selectedCalendarIds,
  onSelectedCalendarIdsChange,
  onSelect,
  onClose,
}: CalendarSearchPanelProps) {
  const t = useTranslations('Calendar.search');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [calMenuOpen, setCalMenuOpen] = React.useState(false);

  const calendarFilterLabel = React.useMemo(() => {
    if (selectedCalendarIds.length === 0) return t('allCalendars');
    if (selectedCalendarIds.length === 1) {
      return calendars.find((c) => c.id === selectedCalendarIds[0])?.name ?? t('nCalendars', { count: 1 });
    }
    return t('nCalendars', { count: selectedCalendarIds.length });
  }, [selectedCalendarIds, calendars, t]);

  const toggleCalendar = (id: string) => {
    onSelectedCalendarIdsChange(
      selectedCalendarIds.includes(id)
        ? selectedCalendarIds.filter((x) => x !== id)
        : [...selectedCalendarIds, id],
    );
  };

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = query.trim();
  const needsMoreChars = trimmed.length > 0 && trimmed.length < minChars;

  // Orden descendente: día más reciente arriba y, dentro de cada día, la cita más
  // tardía primero. Interesan más las citas recientes.
  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarSearchResult[]>();
    for (const r of results) {
      const key = format(r.start, 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => b.start.getTime() - a.start.getTime());
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [results]);

  return (
    <div className="absolute right-3 top-3 bottom-3 z-50 flex w-80 max-w-[85vw] flex-col rounded-xl border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">{t('panelTitle')}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} title={t('close')}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-b border-border p-2 shrink-0">
        <div className="relative">
          {/* El spinner y el ícono de lupa comparten el hueco izquierdo. El spin
              va en un <span> aparte: `animate-spin` reescribe `transform`, así que
              si la traslación de centrado estuviera en el mismo nodo el ícono
              "saltaría" al arrancar/parar la animación. */}
          <span className="pointer-events-none absolute left-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-muted-foreground">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </span>
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('placeholder')}
            className="h-9 pl-8 pr-8"
            aria-label={t('placeholder')}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={t('clear')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {calendars.length > 0 && (
          <Popover open={calMenuOpen} onOpenChange={setCalMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title={t('calendarFilter')}
                className={cn(
                  'mt-2 flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/50',
                  selectedCalendarIds.length > 0
                    ? 'border-primary/50 text-foreground'
                    : 'border-border text-muted-foreground',
                )}
              >
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{calendarFilterLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[15rem] p-1">
              <div className="max-h-60 overflow-y-auto">
                {/* Filas como <div role="button">, no <button>: contienen un
                    Checkbox de Radix (que ya es un <button>) y no se pueden anidar. */}
                <CalendarFilterRow
                  checked={selectedCalendarIds.length === 0}
                  onToggle={() => onSelectedCalendarIdsChange([])}
                >
                  <span className="font-medium">{t('allCalendars')}</span>
                </CalendarFilterRow>
                <div className="my-1 h-px bg-border" />
                {calendars.map((cal) => (
                  <CalendarFilterRow
                    key={cal.id}
                    checked={selectedCalendarIds.includes(cal.id)}
                    onToggle={() => toggleCalendar(cal.id)}
                  >
                    <span className="flex-1 truncate text-left">{cal.name}</span>
                    {cal.color && (
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: cal.color }}
                      />
                    )}
                  </CalendarFilterRow>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-2">
        {trimmed.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('hint')}</p>
        ) : needsMoreChars ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('minChars', { count: minChars })}</p>
        ) : isLoading && results.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : results.length === 0 ? (
          hasSearched ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : null
        ) : (
          byDay.map(([dayKey, dayResults]) => (
            <div key={dayKey}>
              <p className="px-1 pb-1 text-xs font-medium capitalize text-muted-foreground">
                {format(dayResults[0].start, 'EEEE d MMM yyyy', { locale: dateLocale })}
              </p>
              <div className="space-y-1">
                {dayResults.map((r) => {
                  const dot = r.status ? STATUS_ACCENT_COLOR[r.status as keyof typeof STATUS_ACCENT_COLOR] : undefined;
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => onSelect(r)}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                        selectedId === r.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted/50',
                      )}
                    >
                      <span className="mt-1 flex flex-col items-center gap-1 shrink-0">
                        <span className="text-xs font-medium tabular-nums text-muted-foreground">
                          {format(r.start, 'HH:mm')}
                        </span>
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: dot || 'hsl(var(--muted-foreground) / 0.4)' }}
                        />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">{r.title}</span>
                        {r.subtitle && (
                          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <User className="h-3 w-3 shrink-0" />
                            {r.subtitle}
                          </span>
                        )}
                        {r.meta && (
                          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Stethoscope className="h-3 w-3 shrink-0" />
                            {r.meta}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
