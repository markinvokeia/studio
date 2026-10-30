'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

/**
 * Sellos de calidad del dato. El panel muestra números que no todos tienen la misma
 * solidez: los montos por sucursal son estimados y los gastos directamente no existen.
 * Marcarlo a la vista evita que se lean como si fueran exactos.
 */

interface DataQualityBadgeProps {
  label: string;
  tooltip: string;
  variant?: 'warning' | 'secondary';
  className?: string;
}

function DataQualityBadge({ label, tooltip, variant = 'warning', className }: DataQualityBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={variant}
            className={cn('cursor-help px-2 py-0 text-[9.5px] font-bold uppercase tracking-wide', className)}
          >
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs font-normal leading-relaxed">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Los montos por sede salen de la heurística de cita más cercana, no de `invoices.sede_id`. */
export function EstimatedBadge({ className }: { className?: string }) {
  const t = useTranslations('DashboardGerencial');
  return <DataQualityBadge label={t('estimated')} tooltip={t('estimatedTooltip')} className={className} />;
}

/** No hay ningún dato de origen: el indicador va vacío, nunca en `$ 0`. */
export function NoDataBadge({ className }: { className?: string }) {
  const t = useTranslations('DashboardGerencial');
  return <DataQualityBadge label={t('noData')} tooltip={t('noDataTooltip')} className={className} />;
}

/** La cobranza no tiene vía a la sucursal: siempre se muestra el consolidado. */
export function ConsolidatedOnlyBadge({ className }: { className?: string }) {
  const t = useTranslations('DashboardGerencial');
  return (
    <DataQualityBadge
      label={t('consolidatedOnly')}
      tooltip={t('collectionsNoBranchTooltip')}
      variant="secondary"
      className={className}
    />
  );
}
