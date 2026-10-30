'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface PortalNavItem {
  id: string;
  icon: React.ElementType;
  label: string;
  /** Línea de apoyo, en fuente más chica, que explica qué hay en la sección. */
  subtitle: string;
}

interface PortalNavProps {
  items: PortalNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /**
   * Acción persistente al pie del panel (reservar cita). Vive acá y no dentro
   * de una pestaña para que esté a un clic desde cualquier sección.
   */
  action?: React.ReactNode;
}

/**
 * Navegación del portal del paciente.
 *
 * En escritorio es una columna a la izquierda: icono + nombre + subtítulo, con
 * el contenido de la sección a la derecha. En móvil no hay ancho para una
 * columna fija, así que colapsa a una tira horizontal de icono + nombre (el
 * subtítulo se omite ahí porque no aporta y rompería el alto).
 */
export function PortalNav({ items, activeId, onSelect, action }: PortalNavProps) {
  return (
    <>
      {/* Escritorio — columna vertical */}
      <nav className="hidden w-60 shrink-0 flex-col gap-1 border-r bg-primary/[0.07] p-2 dark:bg-card/40 md:flex lg:w-64">
        {items.map((item) => {
          const isActive = item.id === activeId;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                isActive
                  ? 'bg-primary/20 text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', isActive && 'text-primary')} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug">{item.label}</span>
                {/* Sin `truncate`: el subtítulo se envuelve en varias líneas. */}
                <span className="mt-0.5 block text-xs font-normal leading-snug text-muted-foreground">
                  {item.subtitle}
                </span>
              </span>
            </button>
          );
        })}

        {action && <div className="mt-auto pt-2">{action}</div>}
      </nav>

      {/* Móvil — tira horizontal, con la acción anclada a la derecha */}
      <div className="flex shrink-0 items-center gap-1 border-b bg-primary/[0.07] pr-2 dark:bg-card/40 md:hidden">
      <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const isActive = item.id === activeId;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary/20 text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
              {item.label}
            </button>
          );
        })}
      </nav>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </>
  );
}
