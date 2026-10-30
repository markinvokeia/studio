'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { ALL_CURRENCIES } from '@/hooks/useReportCurrency';
import { useCurrencySettings } from '@/hooks/useCurrencySettings';

interface ReportCurrencyFilterProps {
  value: string;
  onChange: (value: string) => void;
  /** Etiqueta de la opción "todas". */
  allLabel?: string;
  /** `false` en los reportes que siempre muestran una sola moneda a la vez. */
  includeAll?: boolean;
  className?: string;
}

/**
 * Filtro de moneda de la barra de reportes.
 *
 * Sustituye a los ~15 desplegables que listaban `Todas / UYU / USD` a mano.
 * Con una sola moneda configurada no renderiza nada: no hay nada que filtrar,
 * y el reporte ya está mostrando esa moneda.
 */
export function ReportCurrencyFilter({
  value,
  onChange,
  allLabel = 'Todas',
  includeAll = true,
  className = 'h-8 w-28 text-xs',
}: ReportCurrencyFilterProps) {
  const { options, isDual } = useCurrencySettings();

  if (!isDual) return null;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value={ALL_CURRENCIES}>{allLabel}</SelectItem>}
        {options.map((code) => (
          <SelectItem key={code} value={code}>
            {code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
