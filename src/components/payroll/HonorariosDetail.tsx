'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { HonorarioFormDialog } from '@/components/payroll/HonorarioFormDialog';
import { formatCurrency, formatDate } from '@/components/payroll/payroll-utils';
import type { HonorariosEstado, PayrollHonorario } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle, Download, FileCheck, FileText, Maximize2, Minimize2, Pencil, Trash2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const STATUS_COLORS: Record<HonorariosEstado, string> = {
  pendiente:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  validada:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  autorizada: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  pagada:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rechazada:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_STEPS: HonorariosEstado[] = ['pendiente', 'validada', 'autorizada', 'pagada'];

interface Props {
  honorario: PayrollHonorario;
  onClose?: () => void;
  onStatusChange?: (updated: PayrollHonorario) => void;
  onDeleted?: () => void;
  onEdited?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export function HonorariosDetail({ honorario: initial, onClose, onStatusChange, onDeleted, onEdited, isExpanded, onToggleExpand }: Props) {
  const t = useTranslations('PayrollPage.honorarios');
  const tf = useTranslations('PayrollPage.honorarios.form');
  const { toast } = useToast();
  const [hon, setHon] = useState<PayrollHonorario>(initial);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states
  const [validateOpen, setValidateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Form fields
  const [facturaNumero, setFacturaNumero] = useState(hon.factura_numero ?? '');
  const [facturaFecha, setFacturaFecha] = useState(hon.factura_fecha ?? '');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  async function executeAction(endpoint: string, extra?: Record<string, unknown>) {
    try {
      setActionLoading(true);
      const updated = await api.post(endpoint, { id: hon.id, ...extra });
      const next: PayrollHonorario =
        (updated as { honorario?: PayrollHonorario })?.honorario ??
        (updated as PayrollHonorario) ??
        hon;
      setHon(next);
      onStatusChange?.(next);
    } catch {
      toast({ title: 'Error', description: 'No se pudo completar la acción.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleValidate() {
    await executeAction(API_ROUTES.PAYROLL.HONORARIOS_VALIDATE, {
      factura_numero: facturaNumero || undefined,
      factura_fecha: facturaFecha || undefined,
    });
    setValidateOpen(false);
  }

  async function handleAuthorize() {
    await executeAction(API_ROUTES.PAYROLL.HONORARIOS_AUTHORIZE);
  }

  async function handleMarkPaid() {
    await executeAction(API_ROUTES.PAYROLL.HONORARIOS_MARK_PAID, { fecha_pago: fechaPago });
    setPayOpen(false);
  }

  async function handleReject() {
    await executeAction(API_ROUTES.PAYROLL.HONORARIOS_REJECT, { motivo_rechazo: motivoRechazo });
    setRejectOpen(false);
    setMotivoRechazo('');
  }

  async function handleDelete() {
    try {
      setActionLoading(true);
      await api.post(API_ROUTES.PAYROLL.HONORARIOS_DELETE, { id: hon.id });
      toast({ title: tf('deleted') });
      setDeleteOpen(false);
      onDeleted?.();
    } catch {
      toast({ title: 'Error', description: tf('errorSave'), variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  }

  const canValidate = hon.estado === 'pendiente';
  const canAuthorize = hon.estado === 'validada';
  const canMarkPaid = hon.estado === 'autorizada';
  const canReject = hon.estado !== 'pagada' && hon.estado !== 'rechazada';
  // Manual edits/deletes only while not yet authorized/paid.
  const canEdit = hon.estado === 'pendiente' || hon.estado === 'rechazada';

  const stepIdx = STATUS_STEPS.indexOf(hon.estado);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-4 sm:p-6">

        {/* Header */}
        <div className="payroll-panel-header flex flex-col gap-2">
          {/* Row 1: title (left, never cut) + controls (right) */}
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold whitespace-nowrap">{hon.doctor_name}</h1>
            <div className="flex items-center gap-1 ml-auto flex-none">
              {onToggleExpand && (
                <button
                  type="button"
                  title={isExpanded ? 'Restaurar' : 'Expandir'}
                  className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={onToggleExpand}
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              )}
              {onClose && (
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {/* Row 2: badges + subtitle info */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge className={cn('text-xs', STATUS_COLORS[hon.estado])}>
              {t(`estados.${hon.estado}`)}
            </Badge>
            <span className="text-sm text-muted-foreground">{t(`modalidades.${hon.modalidad}`)}</span>
            {hon.doctor_rut && (
              <span className="text-xs text-muted-foreground font-mono">RUT: {hon.doctor_rut}</span>
            )}
          </div>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-1">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1">
              <div className={cn(
                'h-2 flex-1 rounded-full transition-colors',
                i <= stepIdx
                  ? 'bg-primary'
                  : 'bg-muted',
              )} />
              {i < STATUS_STEPS.length - 1 && <div className="w-1" />}
            </div>
          ))}
        </div>
        <div className="flex justify-between -mt-2">
          {STATUS_STEPS.map((step) => (
            <span key={step} className={cn(
              'text-[10px]',
              step === hon.estado ? 'text-primary font-medium' : 'text-muted-foreground',
            )}>
              {t(`estados.${step}`)}
            </span>
          ))}
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="px-3 py-3">
              <p className="text-xs text-muted-foreground">{t('produccion')}</p>
              <p className="text-base font-bold tabular-nums">{formatCurrency(hon.produccion_base)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-3 py-3">
              <p className="text-xs text-muted-foreground">{t('bruto')}</p>
              <p className="text-base font-bold tabular-nums">{formatCurrency(hon.bruto)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-3 py-3">
              <p className="text-xs text-muted-foreground">{t('liquido')}</p>
              <p className="text-base font-bold tabular-nums text-green-600 dark:text-green-400">
                {formatCurrency(hon.liquido)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">{t('detail.title')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 grid grid-cols-2 gap-4">
            <Row label={t('detail.porcentaje')} value={`${hon.porcentaje}%`} />
            {hon.iva > 0 && <Row label="IVA" value={formatCurrency(hon.iva)} />}
            {hon.retenciones > 0 && <Row label={t('detail.retenciones')} value={formatCurrency(hon.retenciones)} />}
            {hon.descuentos > 0 && <Row label={t('detail.descuentos')} value={formatCurrency(hon.descuentos)} />}
          </CardContent>
        </Card>

        {/* Invoice */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">{t('detail.invoiceTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {hon.factura_numero ? (
              <div className="grid grid-cols-2 gap-4">
                <Row label={t('detail.facturaNumero')} value={hon.factura_numero} />
                <Row label={t('detail.facturaFecha')} value={formatDate(hon.factura_fecha)} />
                {hon.factura_url && (
                  <a href={hon.factura_url} target="_blank" rel="noreferrer" className="col-span-2">
                    <Button variant="outline" size="sm">
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      {t('detail.viewFactura')}
                    </Button>
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('detail.noFactura')}</p>
            )}
          </CardContent>
        </Card>

        {/* Payment info */}
        {hon.fecha_pago && (
          <Card>
            <CardContent className="px-4 py-3 flex items-center gap-3">
              <FileCheck className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">{t('detail.fechaPago')}</p>
                <p className="text-sm font-medium">{formatDate(hon.fecha_pago)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {canValidate && (
            <Button size="sm" variant="outline" disabled={actionLoading}
              onClick={() => { setFacturaNumero(hon.factura_numero ?? ''); setFacturaFecha(hon.factura_fecha ?? ''); setValidateOpen(true); }}>
              <FileCheck className="h-4 w-4 mr-1.5" />
              {t('actions.validate')}
            </Button>
          )}
          {canAuthorize && (
            <Button size="sm" disabled={actionLoading} onClick={handleAuthorize}>
              <CheckCircle className="h-4 w-4 mr-1.5" />
              {t('actions.authorize')}
            </Button>
          )}
          {canMarkPaid && (
            <Button size="sm" disabled={actionLoading}
              onClick={() => { setFechaPago(new Date().toISOString().split('T')[0]); setPayOpen(true); }}>
              <Download className="h-4 w-4 mr-1.5" />
              {t('actions.markPaid')}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" disabled={actionLoading} onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              {tf('editAmounts')}
            </Button>
          )}
          {canReject && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
              disabled={actionLoading} onClick={() => { setMotivoRechazo(''); setRejectOpen(true); }}>
              <XCircle className="h-4 w-4 mr-1.5" />
              {t('actions.reject')}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto"
              disabled={actionLoading} onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              {tf('delete')}
            </Button>
          )}
        </div>
      </div>

      {/* Edit amounts dialog */}
      <HonorarioFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        periods={[]}
        honorario={hon}
        onSaved={(saved) => { if (saved) { setHon(saved); onStatusChange?.(saved); } onEdited?.(); }}
      />

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={(v) => !v && setDeleteOpen(false)}>
        <DialogContent className="max-w-sm flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle className="text-destructive">{tf('delete')}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <p className="text-sm text-muted-foreground">{tf('deleteConfirm')}</p>
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{tf('cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? '...' : tf('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validate dialog (requires factura data) */}
      <Dialog open={validateOpen} onOpenChange={(v) => !v && setValidateOpen(false)}>
        <DialogContent className="max-w-sm flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>{t('actions.validate')}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('detail.facturaNumero')}</Label>
              <Input value={facturaNumero} onChange={(e) => setFacturaNumero(e.target.value)}
                placeholder="ej: A-001234" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('detail.facturaFecha')}</Label>
              <Input type="date" value={facturaFecha} onChange={(e) => setFacturaFecha(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
            <Button variant="outline" onClick={() => setValidateOpen(false)}>{t('detail.cancel')}</Button>
            <Button onClick={handleValidate} disabled={actionLoading}>
              {actionLoading ? '...' : t('actions.validate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark paid dialog */}
      <Dialog open={payOpen} onOpenChange={(v) => !v && setPayOpen(false)}>
        <DialogContent className="max-w-sm flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>{t('actions.markPaid')}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {t('actions.markPaidDesc')} <strong>{formatCurrency(hon.liquido)}</strong>
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('detail.fechaPago')}</Label>
              <Input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
            <Button variant="outline" onClick={() => setPayOpen(false)}>{t('detail.cancel')}</Button>
            <Button onClick={handleMarkPaid} disabled={actionLoading || !fechaPago}>
              {actionLoading ? '...' : t('actions.markPaid')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={(v) => !v && setRejectOpen(false)}>
        <DialogContent className="max-w-sm flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle className="text-destructive">{t('actions.reject')}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t('actions.rejectDesc')}</p>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('actions.motivoRechazo')}</Label>
              <Textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder={t('actions.motivoRechazoPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{t('detail.cancel')}</Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {actionLoading ? '...' : t('actions.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
