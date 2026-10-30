'use client';

import { useCurrencySettings } from '@/hooks/useCurrencySettings';
import { cn } from '@/lib/utils';

interface CurrencySwitcherProps {
  value: string;
  onChange: (v: string) => void;
  /**
   * Monedas a ofrecer. Por defecto, las configuradas en la clínica. Se puede
   * pasar explícitamente cuando el reporte sabe qué monedas trae el dato.
   */
  options?: string[];
}

/**
 * Conmutador de moneda de los gráficos de reportes.
 *
 * Con una sola moneda configurada no hay nada que conmutar, así que no
 * renderiza nada: cada reporte puede montarlo sin condicionarlo.
 */
export function CurrencySwitcher({ value, onChange, options }: CurrencySwitcherProps) {
  const { options: clinicOptions } = useCurrencySettings();
  const codes = options ?? clinicOptions;

  if (codes.length < 2) return null;

  return (
    <div className="flex items-center gap-0.5 rounded border bg-muted/50 p-0.5">
      {codes.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium transition-colors',
            value === c
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
