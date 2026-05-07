'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MOCK_NOVEDADES } from '@/components/payroll/mock-data';
import { formatCurrency } from '@/components/payroll/payroll-utils';
import type { NovedadType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Pencil, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

const NOVEDAD_COLORS: Record<NovedadType, string> = {
  hora_extra_habil:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  hora_extra_feriado:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ausencia_justificada:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  ausencia_injustificada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  certificado_medico:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  licencia:               'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  vacaciones:             'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  adelanto:               'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  bono:                   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  descuento:              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  otro:                   'bg-muted text-muted-foreground',
};

interface NovedadDetailProps {
  id: string;
  onClose?: () => void;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export function NovedadDetail({ id, onClose }: NovedadDetailProps) {
  const t = useTranslations('PayrollPage.novedades');

  const nov = MOCK_NOVEDADES.find((n) => n.id === id);

  if (!nov) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <p className="text-muted-foreground">{t('none')}</p>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            {t('detail.title')}
          </Button>
        )}
      </div>
    );
  }

  const isMonetary = nov.tipo === 'adelanto' || nov.tipo === 'bono' || nov.tipo === 'descuento';
  const quantityLabel = isMonetary
    ? formatCurrency(nov.cantidad)
    : `${nov.cantidad}${nov.tipo.startsWith('hora') ? 'h' : 'd'}`;

  const isApproved = !!nov.aprobado_por;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-6 gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{t('detail.title')}</h2>
          <div className="flex items-center gap-2">
            <Badge className={cn('text-xs', NOVEDAD_COLORS[nov.tipo])}>
              {t(`types.${nov.tipo}`)}
            </Badge>
            {isApproved ? (
              <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {t('detail.approve')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Pendiente
              </Badge>
            )}
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 -mt-1 -mr-2">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Main info */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 gap-4">
          <DetailRow label={t('detail.employee')} value={nov.employee_name ?? '—'} />
          <DetailRow label={t('quantity')} value={quantityLabel} />
          {nov.fecha_desde && (
            <DetailRow
              label={t('dates')}
              value={
                nov.fecha_hasta
                  ? `${nov.fecha_desde} → ${nov.fecha_hasta}`
                  : nov.fecha_desde
              }
            />
          )}
          {nov.descripcion && (
            <div className="col-span-2 flex flex-col gap-0.5">
              <p className="text-xs text-muted-foreground">{t('description')}</p>
              <p className="text-sm">{nov.descripcion}</p>
            </div>
          )}
          {nov.created_by && (
            <DetailRow
              label="Creado por"
              value={`${nov.created_by}${nov.created_at ? ` · ${nov.created_at.split('T')[0]}` : ''}`}
            />
          )}
          {nov.aprobado_por && (
            <DetailRow label={t('detail.approve')} value={nov.aprobado_por} />
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline">
          <Pencil className="h-4 w-4 mr-1.5" />
          {t('detail.edit')}
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-1.5" />
          {t('detail.delete')}
        </Button>
      </div>
    </div>
  );
}
