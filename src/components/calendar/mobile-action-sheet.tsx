'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { cn } from '@/lib/utils';

interface MobileActionSheetProps {
  open: boolean;
  onClose: () => void;
  /** Título accesible del sheet (el diálogo lo exige aunque el contenido tenga su propio encabezado). */
  title: string;
  /** Texto del encabezado de una subpágina. Sin él se muestra solo la manija y la X. */
  pageTitle?: string;
  /** Si está, el encabezado muestra una flecha para volver a la página principal. */
  onBack?: () => void;
  backLabel: string;
  closeLabel: string;
  children: React.ReactNode;
  'data-testid'?: string;
}

/**
 * Hoja inferior para las acciones de una cita o recordatorio en móvil.
 *
 * Reemplaza al menú contextual, que en táctil se abría con un long-press y competía
 * con el arrastre de la card. A diferencia de `SheetContent`, tocar fuera la cierra:
 * es un menú de acciones, no un formulario con datos que se puedan perder.
 */
export function MobileActionSheet({
  open,
  onClose,
  title,
  pageTitle,
  onBack,
  backLabel,
  closeLabel,
  children,
  'data-testid': testId,
}: MobileActionSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          data-testid={testId}
          aria-describedby={undefined}
          // El foco inicial en el primer botón dejaría su anillo de foco visible al abrir.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-background shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:duration-200 data-[state=open]:duration-300"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <div className="flex shrink-0 items-center gap-1 px-2 pt-1">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label={backLabel}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <span className="h-9 w-9" aria-hidden />
            )}
            <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold">{pageTitle}</span>
            <DialogPrimitive.Close
              aria-label={closeLabel}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface ActionRowProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** Alternativa a `icon` cuando lo de la izquierda no es un ícono (ej. un punto de color). */
  leading?: React.ReactNode;
  label: React.ReactNode;
  /** Valor actual, en una segunda línea (ej. el doctor asignado). */
  hint?: React.ReactNode;
  /** Muestra la flecha de "abre otra página". */
  chevron?: boolean;
  destructive?: boolean;
  /** Contenido a la derecha (ej. un check del valor seleccionado). */
  trailing?: React.ReactNode;
}

/** Fila táctil de 48 px de alto para las listas de acciones del sheet. */
export const ActionRow = React.forwardRef<HTMLButtonElement, ActionRowProps>(
  ({ icon: Icon, leading, label, hint, chevron, destructive, trailing, className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors active:bg-muted disabled:pointer-events-none disabled:opacity-50',
        destructive ? 'text-destructive' : 'text-foreground',
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className={cn('h-5 w-5 shrink-0', !destructive && 'text-muted-foreground')} /> : leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{label}</span>
        {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      {trailing}
      {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </button>
  ),
);
ActionRow.displayName = 'ActionRow';

export function ActionSeparator() {
  return <div role="separator" className="mx-3 my-1 h-px bg-border" />;
}

// ── Primitivas para `AppointmentStatusContextItems` ─────────────────────────
// El selector de estados se arma con primitivas que provee quien lo aloja (menú
// contextual, dropdown). Estas lo dibujan como lista táctil; el submenú
// "Cancelar…" se vuelve un desplegable en línea, porque un submenú flotante a un
// costado no entra en el ancho de un teléfono.

export const SheetStatusItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors active:bg-muted disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
SheetStatusItem.displayName = 'SheetStatusItem';

export function SheetStatusSub({ children }: { children: React.ReactNode }) {
  return <details className="group">{children}</details>;
}

export function SheetStatusSubTrigger({
  disabled,
  className,
  children,
}: {
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <summary
      aria-disabled={disabled || undefined}
      className={cn(
        'flex min-h-12 list-none items-center gap-3 rounded-lg px-3 py-2 text-sm active:bg-muted [&::-webkit-details-marker]:hidden',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
    </summary>
  );
}

export function SheetStatusSubContent({ children }: { children: React.ReactNode }) {
  return <div className="pl-4">{children}</div>;
}
