'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MOCK_HONORARIOS } from '@/components/payroll/mock-data';
import { formatCurrency } from '@/components/payroll/payroll-utils';
import type { HonorariosEstado } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle, X, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const STATUS_COLORS: Record<HonorariosEstado, string> = {
  pendiente:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  validada:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  autorizada: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  pagada:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rechazada:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

interface Props {
  id: string;
  onClose?: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export function HonorariosDetail({ id, onClose }: Props) {
  const t = useTranslations('PayrollPage.honorarios');
  const [hon, setHon] = useState(MOCK_HONORARIOS.find((h) => h.id === id));

  if (!hon) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <p className="text-muted-foreground">{t('notFound')}</p>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            {t('back')}
          </Button>
        )}
      </div>
    );
  }

  const canValidate = hon.estado === 'pendiente';
  const canAuthorize = hon.estado === 'validada';
  const canMarkPaid = hon.estado === 'autorizada';

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 overflow-y-auto h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{hon.doctor_name}</h1>
            <Badge className={cn('text-xs', STATUS_COLORS[hon.estado])}>{t(`estados.${hon.estado}`)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t(`modalidades.${hon.modalidad}`)}</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 -mt-1 -mr-2">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="px-4 py-3">
          <p className="text-xs text-muted-foreground">{t('produccion')}</p>
          <p className="text-lg font-bold">{formatCurrency(hon.produccion_base)}</p>
        </CardContent></Card>
        <Card><CardContent className="px-4 py-3">
          <p className="text-xs text-muted-foreground">{t('bruto')}</p>
          <p className="text-lg font-bold">{formatCurrency(hon.bruto)}</p>
        </CardContent></Card>
        <Card><CardContent className="px-4 py-3">
          <p className="text-xs text-muted-foreground">{t('liquido')}</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(hon.liquido)}</p>
        </CardContent></Card>
      </div>

      {/* Details */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium">{t('detail.title')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 grid grid-cols-2 gap-4">
          <Row label="RUT" value={hon.doctor_rut ?? '—'} />
          <Row label={t('detail.porcentaje')} value={`${hon.porcentaje}%`} />
          {hon.iva > 0 && <Row label="IVA" value={formatCurrency(hon.iva)} />}
          {hon.retenciones > 0 && <Row label={t('detail.retenciones')} value={formatCurrency(hon.retenciones)} />}
          {hon.descuentos > 0 && <Row label={t('detail.descuentos')} value={formatCurrency(hon.descuentos)} />}
        </CardContent>
      </Card>

      {/* Invoice */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium">{t('detail.invoiceTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 grid grid-cols-2 gap-4">
          {hon.factura_numero
            ? <>
                <Row label={t('detail.facturaNumero')} value={hon.factura_numero} />
                <Row label={t('detail.facturaFecha')} value={hon.factura_fecha ?? '—'} />
              </>
            : <p className="text-sm text-muted-foreground col-span-2">{t('detail.noFactura')}</p>
          }
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {canValidate && (
          <Button size="sm" variant="outline" onClick={() => setHon({ ...hon, estado: 'validada' })}>
            <CheckCircle className="h-4 w-4 mr-1.5" />
            {t('actions.validate')}
          </Button>
        )}
        {canAuthorize && (
          <Button size="sm" onClick={() => setHon({ ...hon, estado: 'autorizada' })}>
            <CheckCircle className="h-4 w-4 mr-1.5" />
            {t('actions.authorize')}
          </Button>
        )}
        {canMarkPaid && (
          <Button size="sm" onClick={() => setHon({ ...hon, estado: 'pagada', fecha_pago: new Date().toISOString().split('T')[0] })}>
            {t('actions.markPaid')}
          </Button>
        )}
        {hon.estado !== 'pagada' && hon.estado !== 'rechazada' && (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
            onClick={() => setHon({ ...hon, estado: 'rechazada' })}>
            <XCircle className="h-4 w-4 mr-1.5" />
            {t('actions.reject')}
          </Button>
        )}
      </div>
    </div>
  );
}
