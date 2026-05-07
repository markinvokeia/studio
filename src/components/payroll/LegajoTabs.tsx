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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip';
import type { VerticalTab } from '@/components/ui/vertical-tab-strip';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { ContractList } from '@/components/payroll/ContractList';
import { ContractFormDialog } from '@/components/payroll/ContractFormDialog';
import { EgresoWizard } from '@/components/payroll/EgresoWizard';
import { formatCurrency, formatDate } from '@/components/payroll/payroll-utils';
import type {
  DoctorContract,
  PayrollEmployee,
  PayrollEmployment,
  PayrollFamilyCharge,
  PayrollIrpfDeduction,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Briefcase, Building, ClipboardList, FileText, LogOut, Pencil, Phone, Plus, Receipt, Trash2, Upload, User, Users, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

interface Props {
  employeeId: string;
  employee?: PayrollEmployee;
  onEmployeeUpdate?: (updated: PayrollEmployee) => void;
  onClose?: () => void;
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{String(value)}</p>
    </div>
  );
}

// ── Employment form defaults ───────────────────────────────────────────────
const EMPTY_EMPLOYMENT = {
  id: '',
  tipo_contrato: 'dependencia' as const,
  category_id: '',
  fecha_inicio: '',
  fecha_fin: '',
  jornada_horas_semanales: 40,
  modalidad_jornada: 'mensual' as const,
  sueldo_base: 0,
  productividad_porcentaje: 0,
  productividad_base: 'sobre_cobrado' as const,
  tipo_aporte_bps: 'industria_comercio' as const,
};

const EMPTY_FAMILY = {
  id: '',
  tipo: 'hijo' as const,
  nombres: '',
  apellidos: '',
  fecha_nacimiento: '',
  cedula: '',
  vigente_desde: '',
};

const EMPTY_IRPF = {
  id: '',
  tipo: 'otro' as const,
  descripcion: '',
  monto_mensual: 0,
  vigente_desde: '',
};

const CONTRACT_TYPES = [
  'dependencia',
  'arrendamiento',
  'honorarios',
  'empresa_unipersonal',
  'pasante',
  'termino',
  'suplencia',
] as const;

const MODALIDAD_TYPES = ['mensual', 'jornal', 'horario'] as const;
const APORTE_TYPES = ['industria_comercio', 'civil'] as const;
const BASE_TYPES = ['sobre_cobrado', 'sobre_realizado'] as const;
const FAMILY_TYPES = ['conyuge', 'hijo', 'hijo_discapacidad'] as const;
const IRPF_TYPES = [
  'bhu_anv',
  'caja_profesional',
  'alimentos',
  'alquiler',
  'otro',
] as const;

export function LegajoTabs({ employeeId, employee, onEmployeeUpdate, onClose }: Props) {
  const t = useTranslations('PayrollPage.legajo');
  const { toast } = useToast();

  // ── Employment tab state ─────────────────────────────────────────────────
  const [employments, setEmployments] = useState<PayrollEmployment[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empDialogOpen, setEmpDialogOpen] = useState(false);
  const [empForm, setEmpForm] = useState(EMPTY_EMPLOYMENT);
  const [empSaving, setEmpSaving] = useState(false);
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [terminateForm, setTerminateForm] = useState({
    id: '',
    fecha_fin: '',
    fecha_baja: '',
    motivo_baja: '',
  });
  const [terminating, setTerminating] = useState(false);

  // ── Family tab state ──────────────────────────────────────────────────────
  const [familyCharges, setFamilyCharges] = useState<PayrollFamilyCharge[]>([]);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [familyDialogOpen, setFamilyDialogOpen] = useState(false);
  const [familyForm, setFamilyForm] = useState(EMPTY_FAMILY);
  const [familySaving, setFamilySaving] = useState(false);
  const [familyDeleting, setFamilyDeleting] = useState<string | null>(null);

  // ── IRPF tab state ────────────────────────────────────────────────────────
  const [irpfDeductions, setIrpfDeductions] = useState<PayrollIrpfDeduction[]>([]);
  const [irpfLoading, setIrpfLoading] = useState(true);
  const [irpfDialogOpen, setIrpfDialogOpen] = useState(false);
  const [irpfForm, setIrpfForm] = useState(EMPTY_IRPF);
  const [irpfSaving, setIrpfSaving] = useState(false);
  const [irpfDeleting, setIrpfDeleting] = useState<string | null>(null);

  // ── Active tab ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('personal');

  // ── Contracts tab state ───────────────────────────────────────────────────
  const [contracts, setContracts] = useState<DoctorContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const contractsLoadedRef = useRef(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<DoctorContract | null>(null);

  // ── Egreso / Dar de baja ─────────────────────────────────────────────────
  const [egresoDialogOpen, setEgresoDialogOpen] = useState(false);

  // ── Documents tab state ───────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // ── Personal edit state ───────────────────────────────────────────────────
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState<Partial<PayrollEmployee>>({});
  const [personalSaving, setPersonalSaving] = useState(false);

  // ── Fetch data on employeeId change ──────────────────────────────────────
  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;

    setEmpLoading(true);
    setFamilyLoading(true);
    setIrpfLoading(true);

    api
      .get(`${API_ROUTES.PAYROLL.EMPLOYMENT_BY_EMPLOYEE}?employee_id=${employeeId}`)
      .then((res) => {
        if (cancelled) return;
        setEmployments((Array.isArray(res) ? res : (res?.data ?? [])) as PayrollEmployment[]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEmpLoading(false);
      });

    api
      .get(`${API_ROUTES.PAYROLL.FAMILY_CHARGES_BY_EMPLOYEE}?employee_id=${employeeId}`)
      .then((res) => {
        if (cancelled) return;
        setFamilyCharges(
          (Array.isArray(res) ? res : (res?.data ?? [])) as PayrollFamilyCharge[]
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFamilyLoading(false);
      });

    api
      .get(`${API_ROUTES.PAYROLL.IRPF_DEDUCTIONS_BY_EMPLOYEE}?employee_id=${employeeId}`)
      .then((res) => {
        if (cancelled) return;
        setIrpfDeductions(
          (Array.isArray(res) ? res : (res?.data ?? [])) as PayrollIrpfDeduction[]
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIrpfLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  // Reset contracts when employee changes
  useEffect(() => {
    contractsLoadedRef.current = false;
    setContracts([]);
  }, [employeeId]);

  // Load contracts when contratos tab becomes active
  useEffect(() => {
    if (activeTab !== 'contratos' || contractsLoadedRef.current || !employee?.user_id) return;
    contractsLoadedRef.current = true;
    setContractsLoading(true);
    api
      .get(`${API_ROUTES.PAYROLL.CONTRACTS_BY_DOCTOR}?doctor_id=${employee.user_id}`)
      .then((res) => {
        setContracts((Array.isArray(res) ? res : (res?.data ?? [])) as DoctorContract[]);
      })
      .catch(() => {})
      .finally(() => setContractsLoading(false));
  }, [activeTab, employee?.user_id]);

  function openNewContract() {
    setEditingContract({
      id: '',
      doctor_id: employee?.user_id ?? '',
      doctor_name: employee ? `${employee.nombres} ${employee.apellidos}` : '',
      contract_type: 'arrendamiento',
      calculation_type: 'porcentaje',
      percentage_rate: 60,
      percentage_basis: 'sobre_cobrado',
      currency: 'UYU',
      has_children: false,
      valid_from: new Date().toISOString().slice(0, 10),
      is_active: true,
    });
    setContractDialogOpen(true);
  }

  function handleContractSave(contract: DoctorContract) {
    setContracts((prev) => {
      if (contract.id && prev.find((c) => c.id === contract.id)) {
        return prev.map((c) => (c.id === contract.id ? contract : c));
      }
      return [...prev, { ...contract, id: contract.id || `c${Date.now()}` }];
    });
    setContractDialogOpen(false);
    setEditingContract(null);
    toast({ title: t('saved') });
  }

  // ── Personal edit ────────────────────────────────────────────────────────
  function startEditPersonal() {
    if (!employee) return;
    setPersonalForm({
      cedula: employee.cedula,
      nombres: employee.nombres,
      apellidos: employee.apellidos,
      fecha_nacimiento: employee.fecha_nacimiento,
      sexo: employee.sexo,
      estado_civil: employee.estado_civil,
      domicilio: employee.domicilio,
      telefono: employee.telefono,
      email: employee.email,
      banco: employee.banco,
      cuenta_banco: employee.cuenta_banco,
      numero_bps: employee.numero_bps,
      fecha_ingreso: employee.fecha_ingreso,
    });
    setEditingPersonal(true);
  }

  async function handleSavePersonal() {
    if (!employee) return;
    setPersonalSaving(true);
    try {
      await api.post(API_ROUTES.PAYROLL.EMPLOYEES_UPSERT, {
        id: employee.id,
        clinic_id: employee.clinic_id,
        activo: employee.activo,
        ...personalForm,
      });
      const updated = { ...employee, ...personalForm } as PayrollEmployee;
      onEmployeeUpdate?.(updated);
      setEditingPersonal(false);
      toast({ title: t('saved') });
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setPersonalSaving(false);
    }
  }

  // ── Employment CRUD ──────────────────────────────────────────────────────
  async function handleSaveEmployment() {
    setEmpSaving(true);
    try {
      const res = await api.post(API_ROUTES.PAYROLL.EMPLOYMENT_UPSERT, {
        ...empForm,
        employee_id: employeeId,
        clinic_id: employee?.clinic_id,
        is_active: !empForm.fecha_fin,
      });
      const created = (res?.data ?? res) as PayrollEmployment;
      if (empForm.id) {
        setEmployments((prev) =>
          prev.map((e) => (e.id === empForm.id ? { ...e, ...empForm } : e))
        );
      } else {
        const newEmp: PayrollEmployment = {
          ...empForm,
          id: created.id ?? String(Date.now()),
          employee_id: employeeId,
          clinic_id: employee?.clinic_id ?? '',
          is_active: !empForm.fecha_fin,
        };
        setEmployments((prev) => [newEmp, ...prev]);
      }
      setEmpDialogOpen(false);
      toast({ title: t('saved') });
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setEmpSaving(false);
    }
  }

  function openTerminate(empl: PayrollEmployment) {
    setTerminateForm({
      id: empl.id,
      fecha_fin: '',
      fecha_baja: '',
      motivo_baja: '',
    });
    setTerminateDialogOpen(true);
  }

  async function handleTerminate() {
    if (!terminateForm.fecha_fin) return;
    setTerminating(true);
    try {
      await api.post(API_ROUTES.PAYROLL.EMPLOYMENT_TERMINATE, terminateForm);
      setEmployments((prev) =>
        prev.map((e) =>
          e.id === terminateForm.id
            ? { ...e, fecha_fin: terminateForm.fecha_fin, is_active: false }
            : e
        )
      );
      setTerminateDialogOpen(false);
      toast({ title: t('saved') });
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setTerminating(false);
    }
  }

  // ── Family CRUD ──────────────────────────────────────────────────────────
  async function handleSaveFamily() {
    if (!familyForm.nombres || !familyForm.apellidos || !familyForm.vigente_desde) return;
    setFamilySaving(true);
    try {
      const res = await api.post(API_ROUTES.PAYROLL.FAMILY_CHARGES_UPSERT, {
        ...familyForm,
        employee_id: employeeId,
      });
      const created = (res?.data ?? res) as PayrollFamilyCharge;
      if (familyForm.id) {
        setFamilyCharges((prev) =>
          prev.map((f) => (f.id === familyForm.id ? { ...f, ...familyForm } : f))
        );
      } else {
        const newFC: PayrollFamilyCharge = {
          ...familyForm,
          id: created.id ?? String(Date.now()),
          employee_id: employeeId,
          vigente_desde: familyForm.vigente_desde,
        };
        setFamilyCharges((prev) => [...prev, newFC]);
      }
      setFamilyDialogOpen(false);
      toast({ title: t('saved') });
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setFamilySaving(false);
    }
  }

  async function handleDeleteFamily(id: string) {
    setFamilyDeleting(id);
    try {
      await api.post(API_ROUTES.PAYROLL.FAMILY_CHARGES_DELETE, { id });
      setFamilyCharges((prev) => prev.filter((f) => f.id !== id));
      toast({ title: t('saved') });
    } catch {
      toast({ title: t('errorDeleting'), variant: 'destructive' });
    } finally {
      setFamilyDeleting(null);
    }
  }

  // ── IRPF CRUD ────────────────────────────────────────────────────────────
  async function handleSaveIrpf() {
    if (!irpfForm.descripcion || !irpfForm.vigente_desde) return;
    setIrpfSaving(true);
    try {
      const res = await api.post(API_ROUTES.PAYROLL.IRPF_DEDUCTIONS_UPSERT, {
        ...irpfForm,
        employee_id: employeeId,
      });
      const created = (res?.data ?? res) as PayrollIrpfDeduction;
      if (irpfForm.id) {
        setIrpfDeductions((prev) =>
          prev.map((d) => (d.id === irpfForm.id ? { ...d, ...irpfForm } : d))
        );
      } else {
        const newIrpf: PayrollIrpfDeduction = {
          ...irpfForm,
          id: created.id ?? String(Date.now()),
          employee_id: employeeId,
        };
        setIrpfDeductions((prev) => [...prev, newIrpf]);
      }
      setIrpfDialogOpen(false);
      toast({ title: t('saved') });
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setIrpfSaving(false);
    }
  }

  async function handleDeleteIrpf(id: string) {
    setIrpfDeleting(id);
    try {
      await api.post(API_ROUTES.PAYROLL.IRPF_DEDUCTIONS_DELETE, { id });
      setIrpfDeductions((prev) => prev.filter((d) => d.id !== id));
      toast({ title: t('saved') });
    } catch {
      toast({ title: t('errorDeleting'), variant: 'destructive' });
    } finally {
      setIrpfDeleting(null);
    }
  }

  if (!employee) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded" />
        ))}
      </div>
    );
  }

  const activeEmployment = employments.find((e) => e.is_active);

  const TABS: VerticalTab[] = [
    { id: 'personal', icon: User, label: t('tabs.personal') },
    { id: 'vinculaciones', icon: Briefcase, label: t('tabs.vinculaciones') },
    { id: 'contratos', icon: ClipboardList, label: t('tabs.contratos') },
    { id: 'familia', icon: Users, label: t('tabs.familia') },
    { id: 'deducciones', icon: Receipt, label: t('tabs.deducciones') },
    { id: 'documentos', icon: FileText, label: t('tabs.documentos') },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3 border-b shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold leading-tight">
            {employee.apellidos}, {employee.nombres}
          </h2>
          <div className="flex items-center flex-wrap gap-2 mt-0.5">
            <p className="text-sm text-muted-foreground font-mono">{employee.cedula}</p>
            <Badge
              className={
                employee.activo
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs'
                  : 'bg-muted text-muted-foreground text-xs'
              }
            >
              {employee.activo ? t('active') : t('inactive')}
            </Badge>
            {activeEmployment?.category_name && (
              <Badge variant="outline" className="text-xs">
                {activeEmployment.category_name}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-destructive border-destructive/40 hover:bg-destructive/10 hidden sm:flex"
            onClick={() => setEgresoDialogOpen(true)}
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            {t('quickAdd.egreso')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Plus className="h-4 w-4" />
                <span className="sr-only">{t('quickAdd.label')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setEmpForm({ ...EMPTY_EMPLOYMENT });
                  setActiveTab('vinculaciones');
                  setEmpDialogOpen(true);
                }}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                {t('quickAdd.vinculacion')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFamilyForm({ ...EMPTY_FAMILY });
                  setActiveTab('familia');
                  setFamilyDialogOpen(true);
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                {t('quickAdd.familia')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setIrpfForm({ ...EMPTY_IRPF });
                  setActiveTab('deducciones');
                  setIrpfDialogOpen(true);
                }}
              >
                <Receipt className="h-4 w-4 mr-2" />
                {t('quickAdd.deduccion')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setActiveTab('documentos');
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                {t('quickAdd.documento')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setEgresoDialogOpen(true)}
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t('quickAdd.egreso')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tab strip */}
      <VerticalTabStrip
        tabs={TABS}
        activeTabId={activeTab}
        onTabClick={(tab) => setActiveTab(tab.id)}
      />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* ── Personal data ─────────────────────────────────────────────── */}
        {activeTab === 'personal' && (
          <div>
          {editingPersonal ? (
            <Card>
              <CardContent className="p-4 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('personal.cedula')}</Label>
                    <Input
                      value={personalForm.cedula ?? ''}
                      onChange={(e) =>
                        setPersonalForm((p) => ({ ...p, cedula: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('personal.fechaIngreso')}</Label>
                    <Input
                      type="date"
                      value={personalForm.fecha_ingreso ?? ''}
                      onChange={(e) =>
                        setPersonalForm((p) => ({ ...p, fecha_ingreso: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('personal.nombres')}</Label>
                    <Input
                      value={personalForm.nombres ?? ''}
                      onChange={(e) =>
                        setPersonalForm((p) => ({ ...p, nombres: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Apellidos</Label>
                    <Input
                      value={personalForm.apellidos ?? ''}
                      onChange={(e) =>
                        setPersonalForm((p) => ({ ...p, apellidos: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('personal.fechaNacimiento')}</Label>
                    <Input
                      type="date"
                      value={personalForm.fecha_nacimiento ?? ''}
                      onChange={(e) =>
                        setPersonalForm((p) => ({ ...p, fecha_nacimiento: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('personal.estadoCivil')}</Label>
                    <Select
                      value={personalForm.estado_civil ?? ''}
                      onValueChange={(v) =>
                        setPersonalForm((p) => ({
                          ...p,
                          estado_civil: v as PayrollEmployee['estado_civil'],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          [
                            'soltero',
                            'casado',
                            'divorciado',
                            'viudo',
                            'union_libre',
                          ] as const
                        ).map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('personal.telefono')}</Label>
                    <Input
                      value={personalForm.telefono ?? ''}
                      onChange={(e) =>
                        setPersonalForm((p) => ({ ...p, telefono: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('personal.email')}</Label>
                    <Input
                      type="email"
                      value={personalForm.email ?? ''}
                      onChange={(e) =>
                        setPersonalForm((p) => ({ ...p, email: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">{t('personal.domicilio')}</Label>
                    <Input
                      value={personalForm.domicilio ?? ''}
                      onChange={(e) =>
                        setPersonalForm((p) => ({ ...p, domicilio: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('personal.banco')}</Label>
                    <Input
                      value={personalForm.banco ?? ''}
                      onChange={(e) =>
                        setPersonalForm((p) => ({ ...p, banco: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('personal.cuentaBanco')}</Label>
                    <Input
                      value={personalForm.cuenta_banco ?? ''}
                      onChange={(e) =>
                        setPersonalForm((p) => ({ ...p, cuenta_banco: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">N° BPS</Label>
                    <Input
                      value={personalForm.numero_bps ?? ''}
                      onChange={(e) =>
                        setPersonalForm((p) => ({ ...p, numero_bps: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button size="sm" onClick={handleSavePersonal} disabled={personalSaving}>
                    {personalSaving ? t('saving') : t('save')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingPersonal(false)}
                    disabled={personalSaving}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {t('personal.title')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5"
                      onClick={startEditPersonal}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t('edit')}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InfoRow
                    label={t('personal.nombres')}
                    value={`${employee.nombres} ${employee.apellidos}`}
                  />
                  <InfoRow label={t('personal.cedula')} value={employee.cedula} />
                  <InfoRow
                    label={t('personal.fechaNacimiento')}
                    value={formatDate(employee.fecha_nacimiento)}
                  />
                  <InfoRow label={t('personal.estadoCivil')} value={employee.estado_civil} />
                  <InfoRow label="N° BPS" value={employee.numero_bps} />
                  <InfoRow
                    label={t('personal.fechaIngreso')}
                    value={formatDate(employee.fecha_ingreso)}
                  />
                </CardContent>
              </Card>
              <Card className="mt-3">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {t('personal.contactTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InfoRow label={t('personal.telefono')} value={employee.telefono} />
                  <InfoRow label={t('personal.email')} value={employee.email} />
                  <InfoRow label={t('personal.domicilio')} value={employee.domicilio} />
                </CardContent>
              </Card>
              <Card className="mt-3">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {t('personal.bankTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 grid grid-cols-2 gap-4">
                  <InfoRow label={t('personal.banco')} value={employee.banco} />
                  <InfoRow label={t('personal.cuentaBanco')} value={employee.cuenta_banco} />
                </CardContent>
              </Card>
            </>
          )}
          </div>
        )}

        {/* ── Vinculaciones ─────────────────────────────────────────────── */}
        {activeTab === 'vinculaciones' && (
          <div className="flex flex-col gap-3">
            {empLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : employments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {t('vinculaciones.none')}
              </p>
            ) : (
              employments.map((empl) => (
                <Card key={empl.id}>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <InfoRow
                        label={t('vinculaciones.tipo')}
                        value={empl.tipo_contrato}
                      />
                      <InfoRow
                        label={t('vinculaciones.categoria')}
                        value={empl.category_name}
                      />
                      <InfoRow
                        label={t('vinculaciones.sueldoBase')}
                        value={formatCurrency(empl.sueldo_base)}
                      />
                      <InfoRow
                        label={t('vinculaciones.jornada')}
                        value={`${empl.jornada_horas_semanales}h/sem`}
                      />
                      <InfoRow label={t('vinculaciones.inicio')} value={formatDate(empl.fecha_inicio)} />
                      <InfoRow
                        label={t('vinculaciones.fin')}
                        value={empl.fecha_fin ? formatDate(empl.fecha_fin) : t('vinculaciones.current')}
                      />
                      {empl.productividad_porcentaje > 0 && (
                        <InfoRow
                          label={t('vinculaciones.productividad')}
                          value={`${empl.productividad_porcentaje}%`}
                        />
                      )}
                      {empl.salario_minimo_categoria != null && (
                        <InfoRow
                          label={t('vinculaciones.minimoCategoria')}
                          value={formatCurrency(empl.salario_minimo_categoria)}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Badge
                        className={
                          empl.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs'
                            : 'bg-muted text-muted-foreground text-xs'
                        }
                      >
                        {empl.is_active ? t('vinculaciones.active') : t('vinculaciones.inactive')}
                      </Badge>
                      {empl.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto h-7 text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={() => setEgresoDialogOpen(true)}
                        >
                          <LogOut className="h-3 w-3 mr-1" />
                          {t('vinculaciones.terminate')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                setEmpForm({ ...EMPTY_EMPLOYMENT });
                setEmpDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('vinculaciones.addNew')}
            </Button>
          </div>
        )}

        {/* ── Contratos ─────────────────────────────────────────────────── */}
        {activeTab === 'contratos' && (
          <div className="flex flex-col h-full -mx-4 -mb-4 min-h-0">
            {!employee?.user_id ? (
              <p className="text-sm text-muted-foreground text-center py-10 px-4">
                {t('contratos.noUserId')}
              </p>
            ) : (
              <ContractList
                contracts={contracts}
                loading={contractsLoading}
                onSelect={(id) => {
                  const c = contracts.find((ct) => ct.id === id);
                  if (c) { setEditingContract(c); setContractDialogOpen(true); }
                }}
                onNew={openNewContract}
              />
            )}
          </div>
        )}

        {/* ── Cargas de familia ─────────────────────────────────────────── */}
        {activeTab === 'familia' && (
          <div className="flex flex-col gap-3">
            {familyLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : familyCharges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {t('familia.none')}
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                        {t('familia.nombre')}
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                        {t('familia.tipo')}
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                        {t('familia.desde')}
                      </th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {familyCharges.map((fc) => (
                      <tr key={fc.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5">
                          {fc.nombres} {fc.apellidos}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {t(`familia.tipos.${fc.tipo}`)}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatDate(fc.vigente_desde)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            disabled={familyDeleting === fc.id}
                            onClick={() => handleDeleteFamily(fc.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                setFamilyForm({ ...EMPTY_FAMILY });
                setFamilyDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('familia.addNew')}
            </Button>
          </div>
        )}

        {/* ── Deducciones IRPF ─────────────────────────────────────────── */}
        {activeTab === 'deducciones' && (
          <div className="flex flex-col gap-3">
            {irpfLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : irpfDeductions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {t('deducciones.none')}
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                        {t('deducciones.descripcion')}
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                        {t('deducciones.tipo')}
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        {t('deducciones.monto')}
                      </th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {irpfDeductions.map((ded) => (
                      <tr key={ded.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5">{ded.descripcion}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {t(`deducciones.tipos.${ded.tipo}`)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {formatCurrency(ded.monto_mensual)}/mes
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            disabled={irpfDeleting === ded.id}
                            onClick={() => handleDeleteIrpf(ded.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                setIrpfForm({ ...EMPTY_IRPF });
                setIrpfDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('deducciones.addNew')}
            </Button>
          </div>
        )}

        {/* ── Documents ────────────────────────────────────────────────── */}
        {activeTab === 'documentos' && (
          <div className="flex flex-col gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) {
                  setUploadedFiles((prev) => [...prev, ...files]);
                }
                e.target.value = '';
              }}
            />
            {uploadedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <FileText className="h-10 w-10 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">{t('documentos.empty')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {t('documentos.upload')}
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                          {t('documentos.fileName')}
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                          {t('documentos.fileSize')}
                        </th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {uploadedFiles.map((file, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="px-4 py-2.5 truncate max-w-[180px]">{file.name}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                            {(file.size / 1024).toFixed(0)} KB
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() =>
                                setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {t('documentos.upload')}
                </Button>
              </>
            )}
          </div>
        )}

      </div>{/* end flex-1 overflow-y-auto p-4 */}

      {/* ── Employment dialog ───────────────────────────────────────────────── */}
      <Dialog open={empDialogOpen} onOpenChange={(v) => !v && setEmpDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('vinculaciones.addNew')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 px-6 py-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label className="text-xs">{t('vinculaciones.form.tipoContrato')}</Label>
              <Select
                value={empForm.tipo_contrato}
                onValueChange={(v) =>
                  setEmpForm((p) => ({
                    ...p,
                    tipo_contrato: v as typeof empForm.tipo_contrato,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>
                      {t(`vinculaciones.form.tipoContratoOpciones.${ct}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('vinculaciones.form.fechaInicio')}</Label>
              <Input
                type="date"
                value={empForm.fecha_inicio}
                onChange={(e) => setEmpForm((p) => ({ ...p, fecha_inicio: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('vinculaciones.form.sueldoBase')}</Label>
              <Input
                type="number"
                value={empForm.sueldo_base}
                onChange={(e) =>
                  setEmpForm((p) => ({ ...p, sueldo_base: Number(e.target.value) }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('vinculaciones.form.jornada')}</Label>
              <Input
                type="number"
                value={empForm.jornada_horas_semanales}
                onChange={(e) =>
                  setEmpForm((p) => ({
                    ...p,
                    jornada_horas_semanales: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('vinculaciones.form.modalidadJornada')}</Label>
              <Select
                value={empForm.modalidad_jornada}
                onValueChange={(v) =>
                  setEmpForm((p) => ({
                    ...p,
                    modalidad_jornada: v as typeof empForm.modalidad_jornada,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODALIDAD_TYPES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`vinculaciones.form.modalidadOpciones.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('vinculaciones.form.tipoAporteBps')}</Label>
              <Select
                value={empForm.tipo_aporte_bps}
                onValueChange={(v) =>
                  setEmpForm((p) => ({
                    ...p,
                    tipo_aporte_bps: v as typeof empForm.tipo_aporte_bps,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APORTE_TYPES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {t(`vinculaciones.form.tipoAporteOpciones.${a}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('vinculaciones.form.productividadPorcentaje')}</Label>
              <Input
                type="number"
                value={empForm.productividad_porcentaje}
                onChange={(e) =>
                  setEmpForm((p) => ({
                    ...p,
                    productividad_porcentaje: Number(e.target.value),
                  }))
                }
              />
            </div>
            {empForm.productividad_porcentaje > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">{t('vinculaciones.form.productividadBase')}</Label>
                <Select
                  value={empForm.productividad_base}
                  onValueChange={(v) =>
                    setEmpForm((p) => ({
                      ...p,
                      productividad_base: v as typeof empForm.productividad_base,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BASE_TYPES.map((b) => (
                      <SelectItem key={b} value={b}>
                        {t(`vinculaciones.form.baseOpciones.${b}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmpDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSaveEmployment}
              disabled={empSaving || !empForm.fecha_inicio}
            >
              {empSaving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Terminate dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={terminateDialogOpen}
        onOpenChange={(v) => !v && setTerminateDialogOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('vinculaciones.terminateTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-6 py-4">
            <p className="text-sm text-muted-foreground">{t('vinculaciones.terminateNote')}</p>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('vinculaciones.form.fechaBaja')}</Label>
              <Input
                type="date"
                value={terminateForm.fecha_fin}
                onChange={(e) =>
                  setTerminateForm((p) => ({
                    ...p,
                    fecha_fin: e.target.value,
                    fecha_baja: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('vinculaciones.form.motivoBaja')}</Label>
              <Input
                value={terminateForm.motivo_baja}
                onChange={(e) =>
                  setTerminateForm((p) => ({ ...p, motivo_baja: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminateDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleTerminate}
              disabled={terminating || !terminateForm.fecha_fin}
            >
              {terminating ? t('vinculaciones.terminating') : t('vinculaciones.terminate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Family charge dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={familyDialogOpen}
        onOpenChange={(v) => !v && setFamilyDialogOpen(false)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('familia.addNew')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 px-6 py-4">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">{t('familia.form.tipo')}</Label>
              <Select
                value={familyForm.tipo}
                onValueChange={(v) =>
                  setFamilyForm((p) => ({ ...p, tipo: v as typeof familyForm.tipo }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAMILY_TYPES.map((ft) => (
                    <SelectItem key={ft} value={ft}>
                      {t(`familia.tipos.${ft}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('familia.form.nombres')}</Label>
              <Input
                value={familyForm.nombres}
                onChange={(e) => setFamilyForm((p) => ({ ...p, nombres: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('familia.form.apellidos')}</Label>
              <Input
                value={familyForm.apellidos}
                onChange={(e) => setFamilyForm((p) => ({ ...p, apellidos: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('familia.form.fechaNacimiento')}</Label>
              <Input
                type="date"
                value={familyForm.fecha_nacimiento}
                onChange={(e) =>
                  setFamilyForm((p) => ({ ...p, fecha_nacimiento: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('familia.form.cedula')}</Label>
              <Input
                value={familyForm.cedula}
                onChange={(e) => setFamilyForm((p) => ({ ...p, cedula: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">{t('familia.form.vigenteDesdE')}</Label>
              <Input
                type="date"
                value={familyForm.vigente_desde}
                onChange={(e) =>
                  setFamilyForm((p) => ({ ...p, vigente_desde: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFamilyDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSaveFamily}
              disabled={
                familySaving ||
                !familyForm.nombres ||
                !familyForm.apellidos ||
                !familyForm.vigente_desde
              }
            >
              {familySaving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── IRPF deduction dialog ────────────────────────────────────────────── */}
      <Dialog
        open={irpfDialogOpen}
        onOpenChange={(v) => !v && setIrpfDialogOpen(false)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('deducciones.addNew')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-6 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('deducciones.form.tipo')}</Label>
              <Select
                value={irpfForm.tipo}
                onValueChange={(v) =>
                  setIrpfForm((p) => ({ ...p, tipo: v as typeof irpfForm.tipo }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IRPF_TYPES.map((it) => (
                    <SelectItem key={it} value={it}>
                      {t(`deducciones.tipos.${it}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('deducciones.form.descripcion')}</Label>
              <Input
                value={irpfForm.descripcion}
                onChange={(e) =>
                  setIrpfForm((p) => ({ ...p, descripcion: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('deducciones.form.montoMensual')}</Label>
              <Input
                type="number"
                value={irpfForm.monto_mensual}
                onChange={(e) =>
                  setIrpfForm((p) => ({ ...p, monto_mensual: Number(e.target.value) }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('deducciones.form.vigenteDesdE')}</Label>
              <Input
                type="date"
                value={irpfForm.vigente_desde}
                onChange={(e) =>
                  setIrpfForm((p) => ({ ...p, vigente_desde: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIrpfDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSaveIrpf}
              disabled={irpfSaving || !irpfForm.descripcion || !irpfForm.vigente_desde}
            >
              {irpfSaving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Contract dialog ──────────────────────────────────────────────────── */}
      <ContractFormDialog
        open={contractDialogOpen}
        contract={editingContract}
        onClose={() => { setContractDialogOpen(false); setEditingContract(null); }}
        onSave={handleContractSave}
      />

      {/* ── Egreso / Dar de baja dialog ──────────────────────────────────────── */}
      <Dialog open={egresoDialogOpen} onOpenChange={(v) => !v && setEgresoDialogOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('egresoDialog.title')}</DialogTitle>
          </DialogHeader>
          <EgresoWizard
            initialEmployee={employee}
            initialEmployments={employments}
            onClose={() => setEgresoDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
