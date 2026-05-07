'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { toDateInput } from '@/components/payroll/payroll-utils';
import type { AusenciaEstado, AusenciaTipo, PayrollAusencia, PayrollEmployee } from '@/lib/types';
import { Download, FileText, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

const TIPOS: AusenciaTipo[] = [
  'vacaciones', 'licencia_medica', 'licencia_especial', 'licencia_estudio',
  'ausencia_justificada', 'ausencia_injustificada', 'suspension', 'otro',
];
const ESTADOS: AusenciaEstado[] = ['pendiente', 'aprobada', 'rechazada'];

interface Props {
  open: boolean;
  ausencia: PayrollAusencia | null;
  employeeId: string;
  clinicId?: string;
  userId?: string;
  // When provided, shows an employee selector at the top (global/wizard usage).
  // When omitted, the dialog targets the fixed employeeId (employee-profile usage).
  employees?: PayrollEmployee[];
  onClose: () => void;
  onSaved: (saved: PayrollAusencia) => void;
  onDeleted: (id: string) => void;
}

function diffDays(desde: string, hasta: string): number {
  if (!desde || !hasta) return 0;
  const d1 = new Date(desde), d2 = new Date(hasta);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
}

export function AusenciaFormDialog({ open, ausencia, employeeId, clinicId, userId, employees, onClose, onSaved, onDeleted }: Props) {
  const t = useTranslations('PayrollPage.legajo.licencias');
  const tRoot = useTranslations('PayrollPage.legajo');
  const { toast } = useToast();

  const showSelector = Array.isArray(employees);
  const [selEmployeeId, setSelEmployeeId] = useState('');
  const selectedEmp = employees?.find((e) => e.id === selEmployeeId);

  const [tipo, setTipo] = useState<AusenciaTipo>('vacaciones');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [dias, setDias] = useState('0');
  const [justificada, setJustificada] = useState(false);
  const [pagada, setPagada] = useState(false);
  const [estado, setEstado] = useState<AusenciaEstado>('aprobada');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Single attached document: the document id is stored in payroll_ausencias.documento_url
  const [docId, setDocId] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docDeleting, setDocDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effEmployeeId = showSelector ? selEmployeeId : employeeId;
  const effUserId = showSelector ? (selectedEmp?.user_id ?? null) : (userId ?? ausencia?.user_id ?? null);
  const effClinicId = showSelector ? selectedEmp?.clinic_id : clinicId;
  const docUserId = effUserId;

  useEffect(() => {
    if (!open) return;
    setSelEmployeeId(ausencia?.employee_id ?? '');
    if (ausencia) {
      setTipo(ausencia.tipo);
      setFechaDesde(toDateInput(ausencia.fecha_desde));
      setFechaHasta(toDateInput(ausencia.fecha_hasta));
      setDias(String(ausencia.dias ?? 0));
      setJustificada(!!ausencia.justificada);
      setPagada(!!ausencia.pagada);
      setEstado(ausencia.estado);
      setDescripcion(ausencia.descripcion ?? '');
      setDocId(ausencia.documento_url || null);
      setDocName(null);
    } else {
      setTipo('vacaciones');
      setFechaDesde('');
      setFechaHasta('');
      setDias('0');
      setJustificada(false);
      setPagada(false);
      setEstado('aprobada');
      setDescripcion('');
      setDocId(null);
      setDocName(null);
    }
  }, [open, ausencia]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !docUserId) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', docUserId);
      const res = await api.post(API_ROUTES.CLINIC_HISTORY.USERS_IMPORT, formData);
      const raw = res && typeof res === 'object' && (res as { id?: string }).id
        ? res as { id: string; name?: string }
        : Array.isArray(res) && res[0]?.id
          ? res[0] as { id: string; name?: string }
          : null;
      if (raw?.id) {
        setDocId(raw.id);
        setDocName(raw.name ?? file.name);
      }
    } catch {
      toast({ title: t('docUploadError'), variant: 'destructive' });
    } finally {
      setDocUploading(false);
    }
  }

  async function handleDocDownload() {
    if (!docId || !docUserId) return;
    try {
      const blob = await api.getBlob(API_ROUTES.CLINIC_HISTORY.USERS_DOCUMENT, { user_id: docUserId, id: docId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docName ?? 'documento';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t('docDownloadError'), variant: 'destructive' });
    }
  }

  async function handleDocDelete() {
    if (!docId || !docUserId) return;
    setDocDeleting(true);
    try {
      await api.delete(API_ROUTES.CLINIC_HISTORY.USERS_DOCUMENT, undefined, undefined, { id: docId, user_id: docUserId });
      setDocId(null);
      setDocName(null);
    } catch {
      toast({ title: t('docDeleteError'), variant: 'destructive' });
    } finally {
      setDocDeleting(false);
    }
  }

  // Auto-calc días when dates change
  useEffect(() => {
    if (fechaDesde && fechaHasta) setDias(String(diffDays(fechaDesde, fechaHasta)));
  }, [fechaDesde, fechaHasta]);

  const canSave = !!effEmployeeId && !!tipo && !!fechaDesde && !!fechaHasta && !saving && !docUploading;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        id: ausencia?.id,
        employee_id: effEmployeeId,
        clinic_id: effClinicId,
        tipo,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        dias: Number(dias) || 0,
        justificada,
        pagada,
        estado,
        descripcion,
        documento_url: docId ?? '',
      };
      const res = await api.post(API_ROUTES.PAYROLL.AUSENCIAS_UPSERT, payload);
      const saved = ((res?.data ?? res) ?? {}) as PayrollAusencia;
      onSaved({ ...(payload as unknown as PayrollAusencia), id: saved.id ?? ausencia?.id ?? String(Date.now()) });
      toast({ title: tRoot('saved') });
      onClose();
    } catch {
      toast({ title: tRoot('errorSaving'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!ausencia?.id) return;
    setDeleting(true);
    try {
      await api.post(API_ROUTES.PAYROLL.AUSENCIAS_DELETE, { id: ausencia.id });
      onDeleted(ausencia.id);
      toast({ title: tRoot('saved') });
      onClose();
    } catch {
      toast({ title: tRoot('errorDeleting'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ausencia ? t('editTitle') : t('addNew')}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 px-6 py-4">
          {showSelector && (
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">{t('form.empleado')}</Label>
              <Select value={selEmployeeId} onValueChange={setSelEmployeeId} disabled={!!ausencia}>
                <SelectTrigger><SelectValue placeholder={t('form.empleadoPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {(employees ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.apellidos}, {e.nombres}{e.cedula ? ` — ${e.cedula}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">{t('form.tipo')}</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as AusenciaTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((tp) => (
                  <SelectItem key={tp} value={tp}>{t(`tipos.${tp}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('form.fechaDesde')}</Label>
            <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('form.fechaHasta')}</Label>
            <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t('form.dias')}</Label>
            <Input type="number" min={0} step={0.5} value={dias} onChange={(e) => setDias(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('form.estado')}</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as AusenciaEstado)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((es) => (
                  <SelectItem key={es} value={es}>{t(`estados.${es}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={justificada} onCheckedChange={(v) => setJustificada(!!v)} />
            {t('form.justificada')}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={pagada} onCheckedChange={(v) => setPagada(!!v)} />
            {t('form.pagada')}
          </label>

          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">{t('form.descripcion')}</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          {/* Documento adjunto (1 archivo) */}
          <div className="col-span-2 flex flex-col gap-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('form.documento')}
              </p>
              {!docId && (
                <button
                  type="button"
                  disabled={docUploading || !docUserId}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {docUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                  {docUploading ? t('docUploading') : t('addDocument')}
                </button>
              )}
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
            </div>

            {docId ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-xs truncate">{docName ?? t('attachedDocument')}</span>
                <button
                  type="button"
                  onClick={handleDocDownload}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={tRoot('download')}
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleDocDelete}
                  disabled={docDeleting}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  title={tRoot('delete')}
                >
                  {docDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {!docUserId ? t('docNoUserId') : t('noDocument')}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {ausencia ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {tRoot('delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>{tRoot('cancel')}</Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {saving ? tRoot('saving') : tRoot('save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
