'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type {
  CalculationType,
  ContractType,
  DoctorContract,
  PayrollEmployee,
  PayrollEmployment,
  PercentageBasis,
} from '@/lib/types';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Download, FileText, HelpCircle, Loader2, Paperclip, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  contract: DoctorContract | null;
  employee?: PayrollEmployee;
  activeEmployment?: PayrollEmployment;
  onClose: () => void;
  onSave: (contract: DoctorContract) => Promise<void>;
}

const CONTRACT_TYPES: ContractType[] = ['dependencia', 'arrendamiento', 'honorarios', 'empresa_unipersonal', 'pasante', 'termino', 'suplencia'];
// Dependent-employee contract types (subject to BPS/FONASA/IRPF deductions).
const EMPLOYEE_CONTRACT_TYPES: ContractType[] = ['dependencia', 'pasante', 'termino', 'suplencia'];
const CALCULATION_TYPES: CalculationType[] = ['fijo', 'por_hora', 'porcentaje', 'fijo_porcentaje', 'por_prestacion'];
const PERCENTAGE_BASIS: PercentageBasis[] = ['sobre_cobrado', 'sobre_realizado'];

const EMPTY_CONTRACT: Omit<DoctorContract, 'id'> = {
  user_id: '',
  doctor_name: '',
  contract_type: 'arrendamiento',
  calculation_type: 'porcentaje',
  percentage_rate: 60,
  percentage_basis: 'sobre_cobrado',
  currency: 'UYU',
  has_children: false,
  valid_from: new Date().toISOString().slice(0, 10),
  is_active: true,
};

export function addOneYear(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.slice(0, 10);
  const d = new Date(clean + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function ContractFormDialog({
  open,
  contract,
  employee,
  activeEmployment,
  onClose,
  onSave,
}: Props) {
  const t = useTranslations('PayrollPage.contracts');
  const { toast } = useToast();
  const [form, setForm] = useState<Omit<DoctorContract, 'id'>>(EMPTY_CONTRACT);

  // Single document state
  const [docId, setDocId] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docDeleting, setDocDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = employee?.user_id ?? null;

  useEffect(() => {
    if (!open) return;
    if (contract) {
      setForm({ ...contract });
      setDocId(contract.contract_document_id ?? null);
      setDocName(contract.contract_document_name ?? null);
    } else {
      setForm({
        ...EMPTY_CONTRACT,
        user_id: employee?.user_id ?? '',
        doctor_name: employee ? `${employee.apellidos}, ${employee.nombres}` : '',
        // New contracts inherit the contract type from the employee's active employment.
        contract_type: activeEmployment?.tipo_contrato ?? EMPTY_CONTRACT.contract_type,
      });
      setDocId(null);
      setDocName(null);
    }
  }, [contract, open, employee, activeEmployment]);

  function set<K extends keyof DoctorContract>(key: K, value: DoctorContract[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isEditing = !!contract?.id;
  const needsBase = ['fijo', 'fijo_porcentaje'].includes(form.calculation_type);
  const needsHourly = form.calculation_type === 'por_hora';
  const needsPercentage = ['porcentaje', 'fijo_porcentaje'].includes(form.calculation_type);
  const needsPerSession = form.calculation_type === 'por_prestacion';

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', userId);
      const res = await api.post(API_ROUTES.CLINIC_HISTORY.USERS_IMPORT, formData);
      // Response: { message, id, name }
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

  async function handleDocDelete() {
    if (!docId || !userId) return;
    setDocDeleting(true);
    try {
      await api.delete(
        API_ROUTES.CLINIC_HISTORY.USERS_DOCUMENT,
        undefined,
        undefined,
        { id: docId, user_id: userId }
      );
      setDocId(null);
      setDocName(null);
    } catch {
      toast({ title: t('docDeleteError'), variant: 'destructive' });
    } finally {
      setDocDeleting(false);
    }
  }

  async function handleDocDownload() {
    if (!docId || !userId) return;
    try {
      const blob = await api.getBlob(
        API_ROUTES.CLINIC_HISTORY.USERS_DOCUMENT,
        { user_id: userId, id: docId }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docName ?? 'contrato';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t('docDownloadError'), variant: 'destructive' });
    }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const isActive = !form.valid_until || form.valid_until >= today;
      await onSave({
        ...form,
        id: contract?.id ?? '',
        is_active: isActive,
        contract_document_id: docId ?? undefined,
        contract_document_name: docName ?? undefined,
      } as DoctorContract);
    } finally {
      setSaving(false);
    }
  }

  const empName = employee
    ? `${employee.apellidos}, ${employee.nombres}`
    : (form.doctor_name ?? '');

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t('formTitleEdit') : t('formTitleNew')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-5 px-4 py-3">
            {/* Employee info card */}
            {empName && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3 flex flex-col gap-2">
                <p className="font-medium text-sm">{empName}</p>
                <div className="flex flex-wrap gap-1.5">
                  {employee?.cedula && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      CI {employee.cedula}
                    </Badge>
                  )}
                  {activeEmployment ? (
                    <>
                      <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {t(`contractTypes.${activeEmployment.tipo_contrato}` as Parameters<typeof t>[0])}
                      </Badge>
                      {activeEmployment.category_name && (
                        <Badge variant="secondary" className="text-[10px]">
                          {activeEmployment.category_name}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {t('noActiveEmployment')}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* 2-column grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">

              {/* LEFT: Tipo Contrato */}
              <div className="flex flex-col gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('contractTypeLabel')}
                </p>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    {t('contractTypeLabel')}
                    {activeEmployment && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="inline-flex text-muted-foreground/60 hover:text-foreground" aria-label="?">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-64 text-xs leading-relaxed">
                          {t('contractTypeFromEmployment')}
                        </PopoverContent>
                      </Popover>
                    )}
                  </Label>
                  <Select
                    value={form.contract_type}
                    onValueChange={(v) => set('contract_type', v as ContractType)}
                    disabled={!!activeEmployment}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPES.map((ct) => (
                        <SelectItem key={ct} value={ct}>
                          {t(`contractTypes.${ct}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('validFromLabel')}</Label>
                  <Input
                    type="date"
                    value={(form.valid_from ?? '').slice(0, 10)}
                    onChange={(e) => set('valid_from', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{t('validUntilLabel')}</Label>
                  <Input
                    type="date"
                    value={(form.valid_until ?? '').slice(0, 10)}
                    onChange={(e) => set('valid_until', e.target.value || undefined)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{t('notes')}</Label>
                  <textarea
                    value={form.notes ?? ''}
                    onChange={(e) => set('notes', e.target.value)}
                    rows={3}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {/* RIGHT: Tipo de Cálculo — highlighted panel */}
              <div className="rounded-xl border bg-muted/40 dark:bg-muted/20 p-4 flex flex-col gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('calculationTypeLabel')}
                </p>

                <div className="space-y-1.5">
                  <Label>{t('calculationTypeLabel')}</Label>
                  <Select
                    value={form.calculation_type}
                    onValueChange={(v) => set('calculation_type', v as CalculationType)}
                  >
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CALCULATION_TYPES.map((ct) => (
                        <SelectItem key={ct} value={ct}>
                          {t(`calculationTypes.${ct}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {needsBase && (
                  <div className="space-y-1.5">
                    <Label>{t('baseSalary')} ({form.currency})</Label>
                    <Input
                      className="bg-background"
                      type="number"
                      value={form.base_salary ?? ''}
                      onChange={(e) => set('base_salary', Number(e.target.value))}
                      min={0}
                    />
                  </div>
                )}

                {needsHourly && (
                  <div className="space-y-1.5">
                    <Label>{t('hourlyRate')} ({form.currency})</Label>
                    <Input
                      className="bg-background"
                      type="number"
                      value={form.hourly_rate ?? ''}
                      onChange={(e) => set('hourly_rate', Number(e.target.value))}
                      min={0}
                    />
                  </div>
                )}

                {needsPercentage && (
                  <>
                    <div className="space-y-1.5">
                      <Label>{t('percentageRate')}</Label>
                      <Input
                        className="bg-background"
                        type="number"
                        value={form.percentage_rate ?? ''}
                        onChange={(e) => set('percentage_rate', Number(e.target.value))}
                        min={0}
                        max={100}
                        step={0.5}
                      />
                    </div>
                    {form.calculation_type === 'fijo_porcentaje' && (
                      <div className="space-y-1.5">
                        <Label>{t('percentageThreshold')} ({form.currency})</Label>
                        <Input
                          className="bg-background"
                          type="number"
                          value={form.percentage_threshold ?? ''}
                          onChange={(e) => set('percentage_threshold', Number(e.target.value))}
                          min={0}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label>{t('percentageBasis')}</Label>
                      <Select
                        value={form.percentage_basis ?? 'sobre_cobrado'}
                        onValueChange={(v) => set('percentage_basis', v as PercentageBasis)}
                      >
                        <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PERCENTAGE_BASIS.map((pb) => (
                            <SelectItem key={pb} value={pb}>
                              {t(`percentageBasisOptions.${pb}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {needsPerSession && (
                  <div className="space-y-1.5">
                    <Label>{t('perSessionRate')} ({form.currency})</Label>
                    <Input
                      className="bg-background"
                      type="number"
                      value={form.per_session_rate ?? ''}
                      onChange={(e) => set('per_session_rate', Number(e.target.value))}
                      min={0}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>{t('currency')}</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => set('currency', v as 'UYU' | 'USD')}
                  >
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UYU">UYU — Peso Uruguayo</SelectItem>
                      <SelectItem value="USD">USD — Dólar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {EMPLOYEE_CONTRACT_TYPES.includes(form.contract_type) && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.has_children}
                      onChange={(e) => set('has_children', e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    <span className="text-sm">{t('hasChildren')}</span>
                  </label>
                )}
              </div>
            </div>

            {/* Single document — full width */}
            <div className="flex flex-col gap-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('document')}
                </p>
                {!docId && (
                  <button
                    type="button"
                    disabled={docUploading || !userId}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {docUploading
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Paperclip className="h-3 w-3" />}
                    {docUploading ? t('docUploading') : t('addDocument')}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {docId ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-xs truncate">{docName ?? docId}</span>
                  <button
                    type="button"
                    onClick={handleDocDownload}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title={t('download')}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDocDelete}
                    disabled={docDeleting}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                    title={t('docDelete')}
                  >
                    {docDeleting
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  {!userId ? t('docNoUserId') : t('noDocument')}
                </p>
              )}
            </div>
          </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={saving || docUploading}>
              {saving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
