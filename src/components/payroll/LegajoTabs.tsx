'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ContractFormDialog, addOneYear } from '@/components/payroll/ContractFormDialog';
import { FamilyChargeList } from '@/components/payroll/FamilyChargeList';
import { EmploymentList } from '@/components/payroll/EmploymentList';
import { IrpfDeductionList } from '@/components/payroll/IrpfDeductionList';
import { ClinicalSessionsList } from '@/components/payroll/ClinicalSessionsList';
import { EmployeeAdjustmentsTab } from '@/components/payroll/EmployeeAdjustmentsTab';
import { EmailComposerDialog } from '@/components/email-composer-dialog';
import { WhatsAppComposerDialog } from '@/components/whatsapp-composer-dialog';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { AusenciasList } from '@/components/payroll/AusenciasList';
import { AusenciaFormDialog } from '@/components/payroll/AusenciaFormDialog';
import { EgresoWizard } from '@/components/payroll/EgresoWizard';
import { formatDate, toDateInput } from '@/components/payroll/payroll-utils';
import type {
  DoctorContract,
  PayrollAusencia,
  PayrollClinicalSession,
  PayrollEmployee,
  PayrollEmployment,
  PayrollFamilyCharge,
  PayrollIrpfDeduction,
  VacationBalance,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { Briefcase, Building, CalendarOff, ClipboardList, Clock, Coins, LogOut, Mail, Maximize2, Minimize2, Pencil, Phone, Plus, Receipt, RefreshCw, RotateCcw, Trash2, User, Users, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { DateRange } from 'react-day-picker';

interface Props {
  employeeId: string;
  employee?: PayrollEmployee;
  onEmployeeUpdate?: (updated: PayrollEmployee) => void;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
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
  tipo: 'hijo' as PayrollFamilyCharge['tipo'],
  nombres: '',
  apellidos: '',
  fecha_nacimiento: '',
  cedula: '',
  vigente_desde: '',
};

const EMPTY_IRPF = {
  id: '',
  tipo: 'otro' as PayrollIrpfDeduction['tipo'],
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

export function LegajoTabs({ employeeId, employee, onEmployeeUpdate, onClose, isExpanded, onToggleExpand }: Props) {
  const t = useTranslations('PayrollPage.legajo');
  const { toast } = useToast();

  // ── Employment tab state ─────────────────────────────────────────────────
  const [employments, setEmployments] = useState<PayrollEmployment[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empDialogOpen, setEmpDialogOpen] = useState(false);
  const [empForm, setEmpForm] = useState(EMPTY_EMPLOYMENT);
  const [empIsHistorical, setEmpIsHistorical] = useState(false);
  const [empSaving, setEmpSaving] = useState(false);
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [terminateForm, setTerminateForm] = useState({
    id: '',
    fecha_fin: '',
    fecha_baja: '',
    motivo_baja: '',
  });
  const [terminating, setTerminating] = useState(false);
  const [reactivating, setReactivating] = useState(false);

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

  // ── Jornadas (clinical sessions) tab state ────────────────────────────────
  const [clinicalSessions, setClinicalSessions] = useState<PayrollClinicalSession[]>([]);
  const [clinicalLoading, setClinicalLoading] = useState(false);
  const [clinicalRange, setClinicalRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // ── Licencias y Ausencias tab state ───────────────────────────────────────
  const [ausencias, setAusencias] = useState<PayrollAusencia[]>([]);
  const [ausenciasLoading, setAusenciasLoading] = useState(true);
  const [vacationBalance, setVacationBalance] = useState<VacationBalance | null>(null);
  const [ausenciaDialogOpen, setAusenciaDialogOpen] = useState(false);
  const [editingAusencia, setEditingAusencia] = useState<PayrollAusencia | null>(null);

  // ── Communication dialogs ─────────────────────────────────────────────────
  const [emailOpen, setEmailOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);

  // ── Active tab ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('personal');

  // ── Contracts tab state ───────────────────────────────────────────────────
  const [contracts, setContracts] = useState<DoctorContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);

  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<DoctorContract | null>(null);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [renewingContract, setRenewingContract] = useState<DoctorContract | null>(null);
  const [renewValidUntil, setRenewValidUntil] = useState('');
  const [renewSaving, setRenewSaving] = useState(false);

  // ── Egreso / Dar de baja ─────────────────────────────────────────────────
  const [egresoDialogOpen, setEgresoDialogOpen] = useState(false);


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
      .get(`${API_ROUTES.PAYROLL.RETENCIONES_BY_EMPLOYEE}?employee_id=${employeeId}`)
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

  // Eager contract loading — fires as soon as we know the employee's user_id
  useEffect(() => {
    const userId = employee?.user_id;
    if (!userId) {
      setContracts([]);
      setContractsLoading(false);
      return;
    }
    let cancelled = false;
    setContractsLoading(true);
    api
      .get(`${API_ROUTES.PAYROLL.CONTRACTS_BY_DOCTOR}?user_id=${userId}`)
      .then((res) => {
        if (!cancelled) setContracts((Array.isArray(res) ? res : (res?.data ?? [])) as DoctorContract[]);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setContractsLoading(false); });
    return () => { cancelled = true; };
  }, [employee?.user_id]);

  // Clinical sessions (Jornadas) — fetch by doctor user_id within the date range
  useEffect(() => {
    const userId = employee?.user_id;
    if (!userId || !clinicalRange?.from || !clinicalRange?.to) {
      setClinicalSessions([]);
      return;
    }
    let cancelled = false;
    setClinicalLoading(true);
    api
      .get(API_ROUTES.PAYROLL.CLINICAL_SESSIONS_BY_USER, {
        user_id: userId,
        date_from: format(clinicalRange.from, 'yyyy-MM-dd'),
        date_to: format(clinicalRange.to, 'yyyy-MM-dd'),
      })
      .then((res) => {
        if (!cancelled) setClinicalSessions((Array.isArray(res) ? res : (res?.data ?? [])) as PayrollClinicalSession[]);
      })
      .catch(() => { if (!cancelled) setClinicalSessions([]); })
      .finally(() => { if (!cancelled) setClinicalLoading(false); });
    return () => { cancelled = true; };
  }, [employee?.user_id, clinicalRange?.from, clinicalRange?.to]);

  // Licencias/Ausencias + vacation balance
  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    setAusenciasLoading(true);
    api
      .get(API_ROUTES.PAYROLL.AUSENCIAS_BY_EMPLOYEE, { employee_id: employeeId })
      .then((res) => { if (!cancelled) setAusencias((Array.isArray(res) ? res : (res?.data ?? [])) as PayrollAusencia[]); })
      .catch(() => { if (!cancelled) setAusencias([]); })
      .finally(() => { if (!cancelled) setAusenciasLoading(false); });
    api
      .get(API_ROUTES.PAYROLL.VACATION_BALANCE, { employee_id: employeeId })
      .then((res) => { if (!cancelled) setVacationBalance(((res?.data ?? res) ?? null) as VacationBalance | null); })
      .catch(() => { if (!cancelled) setVacationBalance(null); });
    return () => { cancelled = true; };
  }, [employeeId]);

  const TODAY_STR = new Date().toISOString().slice(0, 10);

  function hasActiveContract(): boolean {
    return contracts.some(
      (c) => c.is_active && (!c.valid_until || c.valid_until.slice(0, 10) >= TODAY_STR)
    );
  }

  function openNewContract() {
    if (hasActiveContract()) {
      toast({
        title: t('contratos.activeBlockTitle'),
        description: t('contratos.activeBlockMsg'),
        variant: 'destructive',
      });
      return;
    }
    setEditingContract(null);
    setContractDialogOpen(true);
  }

  async function handleContractSave(contract: DoctorContract) {
    try {
      const res = await api.post(API_ROUTES.PAYROLL.CONTRACTS_UPSERT, {
        ...contract,
        user_id: contract.user_id || employee?.user_id,
        clinic_id: contract.clinic_id || employee?.clinic_id,
      });
      const saved: DoctorContract = {
        ...contract,
        id: (res as { data?: { id?: string } })?.data?.id ?? contract.id ?? `c${Date.now()}`,
      };
      setContracts((prev) => {
        if (saved.id && prev.find((c) => c.id === saved.id)) {
          return prev.map((c) => (c.id === saved.id ? saved : c));
        }
        return [...prev, saved];
      });
      setContractDialogOpen(false);
      setEditingContract(null);
      toast({ title: t('saved') });
      refreshAllData();
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    }
  }

  async function handleContractRenew(renewed: DoctorContract) {
    try {
      await api.post(API_ROUTES.PAYROLL.CONTRACTS_UPSERT, {
        ...renewed,
        user_id: employee?.user_id,
        clinic_id: employee?.clinic_id,
      });
      setContracts((prev) =>
        prev.map((c) => (c.id === renewed.id ? renewed : c))
      );
      toast({ title: t('saved') });
      refreshAllData();
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    }
  }

  function openRenewDialog() {
    const active = contracts.find(
      (c) => c.is_active && (!c.valid_until || c.valid_until.slice(0, 10) >= TODAY_STR)
    );
    if (!active) return;
    setRenewingContract(active);
    setRenewValidUntil(addOneYear(active.valid_until ?? new Date().toISOString().slice(0, 10)));
    setRenewDialogOpen(true);
  }

  async function handleRenewConfirm() {
    if (!renewingContract || !renewValidUntil) return;
    setRenewSaving(true);
    try {
      const renewedFrom = (renewingContract.valid_until ?? renewingContract.valid_from).slice(0, 10);
      const renewed: DoctorContract = {
        ...renewingContract,
        valid_from: renewedFrom,
        valid_until: renewValidUntil,
        is_active: true,
      };
      await handleContractRenew(renewed);
      setRenewDialogOpen(false);
      setRenewingContract(null);
    } finally {
      setRenewSaving(false);
    }
  }

  // ── Personal edit ────────────────────────────────────────────────────────
  function startEditPersonal() {
    if (!employee) return;
    setPersonalForm({
      cedula: employee.cedula,
      nombres: employee.nombres,
      apellidos: employee.apellidos,
      fecha_nacimiento: toDateInput(employee.fecha_nacimiento),
      sexo: employee.sexo,
      estado_civil: employee.estado_civil,
      domicilio: employee.domicilio,
      telefono: employee.telefono,
      email: employee.email,
      banco: employee.banco,
      cuenta_banco: employee.cuenta_banco,
      numero_bps: employee.numero_bps,
      fecha_ingreso: toDateInput(employee.fecha_ingreso),
    });
    setEditingPersonal(true);
  }

  async function handleReactivate() {
    if (!employee) return;
    setReactivating(true);
    try {
      await api.post(API_ROUTES.PAYROLL.EMPLOYEES_UPSERT, {
        id: employee.id,
        clinic_id: employee.clinic_id,
        activo: true,
      });
      onEmployeeUpdate?.({ ...employee, activo: true });
      toast({ title: t('saved') });
      refreshAllData();
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setReactivating(false);
    }
  }

  async function handleSavePersonal() {
    if (!employee) return;
    setPersonalSaving(true);
    try {
      await api.post(API_ROUTES.PAYROLL.EMPLOYEES_UPSERT, {
        id: employee.id,
        user_id: employee.user_id,
        clinic_id: employee.clinic_id,
        activo: employee.activo,
        ...personalForm,
      });
      const updated = { ...employee, ...personalForm } as PayrollEmployee;
      onEmployeeUpdate?.(updated);
      setEditingPersonal(false);
      toast({ title: t('saved') });
      refreshAllData();
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setPersonalSaving(false);
    }
  }

  // ── Employment CRUD ──────────────────────────────────────────────────────
  function openNewEmployment() {
    const activeEmp = employments.find((e) => e.is_active);
    if (activeEmp) {
      toast({
        title: t('vinculaciones.activeBlockTitle'),
        description: t('vinculaciones.activeBlockMsg'),
        variant: 'destructive',
      });
      return;
    }
    setEmpForm({ ...EMPTY_EMPLOYMENT });
    setEmpIsHistorical(false);
    setEmpDialogOpen(true);
  }

  function openEditEmployment(empl: PayrollEmployment) {
    setEmpForm({
      id: empl.id,
      tipo_contrato: empl.tipo_contrato as typeof EMPTY_EMPLOYMENT.tipo_contrato,
      category_id: empl.category_id ?? '',
      fecha_inicio: (empl.fecha_inicio ?? '').slice(0, 10),
      fecha_fin: (empl.fecha_fin ?? '').slice(0, 10),
      jornada_horas_semanales: empl.jornada_horas_semanales,
      modalidad_jornada: empl.modalidad_jornada as typeof EMPTY_EMPLOYMENT.modalidad_jornada,
      sueldo_base: empl.sueldo_base,
      productividad_porcentaje: empl.productividad_porcentaje ?? 0,
      productividad_base: (empl.productividad_base ?? 'sobre_cobrado') as typeof EMPTY_EMPLOYMENT.productividad_base,
      tipo_aporte_bps: empl.tipo_aporte_bps as typeof EMPTY_EMPLOYMENT.tipo_aporte_bps,
    });
    setEmpIsHistorical(!empl.is_active || !!empl.fecha_fin);
    setEmpDialogOpen(true);
  }

  async function handleSaveEmployment() {
    setEmpSaving(true);
    const isActive = empIsHistorical ? false : !empForm.fecha_fin;
    try {
      const res = await api.post(API_ROUTES.PAYROLL.EMPLOYMENT_UPSERT, {
        ...empForm,
        employee_id: employeeId,
        clinic_id: employee?.clinic_id,
        is_active: isActive,
      });
      const created = (res?.data ?? res) as PayrollEmployment;
      if (empForm.id) {
        setEmployments((prev) =>
          prev.map((e) => (e.id === empForm.id ? { ...e, ...empForm, is_active: isActive } : e))
        );
      } else {
        const newEmp: PayrollEmployment = {
          ...empForm,
          id: created.id ?? String(Date.now()),
          employee_id: employeeId,
          clinic_id: employee?.clinic_id ?? '',
          is_active: isActive,
        };
        setEmployments((prev) => [newEmp, ...prev]);
      }
      setEmpDialogOpen(false);
      toast({ title: t('saved') });
      if (employee) onEmployeeUpdate?.({ ...employee });
      refreshAllData();
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
      refreshAllData();
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setTerminating(false);
    }
  }

  // ── Family CRUD ──────────────────────────────────────────────────────────
  function openNewFamily() {
    setFamilyForm({ ...EMPTY_FAMILY });
    setFamilyDialogOpen(true);
  }

  function openEditFamily(fc: PayrollFamilyCharge) {
    setFamilyForm({
      id: fc.id,
      tipo: fc.tipo,
      nombres: fc.nombres ?? '',
      apellidos: fc.apellidos ?? '',
      fecha_nacimiento: toDateInput(fc.fecha_nacimiento),
      cedula: fc.cedula ?? '',
      vigente_desde: toDateInput(fc.vigente_desde),
    });
    setFamilyDialogOpen(true);
  }

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
      refreshAllData();
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
      refreshAllData();
    } catch {
      toast({ title: t('errorDeleting'), variant: 'destructive' });
    } finally {
      setFamilyDeleting(null);
    }
  }

  // ── Licencias/Ausencias CRUD ──────────────────────────────────────────────
  function refreshAusencias() {
    if (!employeeId) return;
    api.get(API_ROUTES.PAYROLL.AUSENCIAS_BY_EMPLOYEE, { employee_id: employeeId })
      .then((res) => setAusencias((Array.isArray(res) ? res : (res?.data ?? [])) as PayrollAusencia[]))
      .catch(() => {});
    api.get(API_ROUTES.PAYROLL.VACATION_BALANCE, { employee_id: employeeId })
      .then((res) => setVacationBalance(((res?.data ?? res) ?? null) as VacationBalance | null))
      .catch(() => {});
  }

  function openNewAusencia() {
    setEditingAusencia(null);
    setAusenciaDialogOpen(true);
  }

  function openEditAusencia(a: PayrollAusencia) {
    setEditingAusencia(a);
    setAusenciaDialogOpen(true);
  }

  // ── IRPF CRUD ────────────────────────────────────────────────────────────
  function openNewIrpf() {
    setIrpfForm({ ...EMPTY_IRPF });
    setIrpfDialogOpen(true);
  }

  function openEditIrpf(ded: PayrollIrpfDeduction) {
    setIrpfForm({
      id: ded.id,
      tipo: ded.tipo,
      descripcion: ded.descripcion ?? '',
      monto_mensual: ded.monto_mensual ?? 0,
      vigente_desde: toDateInput(ded.vigente_desde),
    });
    setIrpfDialogOpen(true);
  }

  async function handleSaveIrpf() {
    if (!irpfForm.descripcion || !irpfForm.vigente_desde) return;
    setIrpfSaving(true);
    try {
      const res = await api.post(API_ROUTES.PAYROLL.RETENCIONES_UPSERT, {
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
      refreshAllData();
    } catch {
      toast({ title: t('errorSaving'), variant: 'destructive' });
    } finally {
      setIrpfSaving(false);
    }
  }

  async function handleDeleteIrpf(id: string) {
    setIrpfDeleting(id);
    try {
      await api.post(API_ROUTES.PAYROLL.RETENCIONES_DELETE, { id });
      setIrpfDeductions((prev) => prev.filter((d) => d.id !== id));
      toast({ title: t('saved') });
      refreshAllData();
    } catch {
      toast({ title: t('errorDeleting'), variant: 'destructive' });
    } finally {
      setIrpfDeleting(null);
    }
  }

  // Fires all GET requests in parallel to bring every tab up to date after a mutation
  function refreshAllData() {
    if (!employeeId) return;
    api
      .get(`${API_ROUTES.PAYROLL.EMPLOYMENT_BY_EMPLOYEE}?employee_id=${employeeId}`)
      .then((res) => setEmployments((Array.isArray(res) ? res : (res?.data ?? [])) as PayrollEmployment[]))
      .catch(() => {});
    api
      .get(`${API_ROUTES.PAYROLL.FAMILY_CHARGES_BY_EMPLOYEE}?employee_id=${employeeId}`)
      .then((res) => setFamilyCharges((Array.isArray(res) ? res : (res?.data ?? [])) as PayrollFamilyCharge[]))
      .catch(() => {});
    api
      .get(`${API_ROUTES.PAYROLL.RETENCIONES_BY_EMPLOYEE}?employee_id=${employeeId}`)
      .then((res) => setIrpfDeductions((Array.isArray(res) ? res : (res?.data ?? [])) as PayrollIrpfDeduction[]))
      .catch(() => {});
    if (employee?.user_id) {
      api
        .get(`${API_ROUTES.PAYROLL.CONTRACTS_BY_DOCTOR}?user_id=${employee.user_id}`)
        .then((res) => setContracts((Array.isArray(res) ? res : (res?.data ?? [])) as DoctorContract[]))
        .catch(() => {});
    }
    if (employee) onEmployeeUpdate?.(employee);
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

  const INDEPENDENT_TIPOS = new Set(['honorarios', 'arrendamiento', 'empresa_unipersonal']);
  // Contracts are required to generate payroll, so the tab is always visible.

  // If a user-only tab becomes hidden (no linked user) while active, fall back
  useEffect(() => {
    if (!employee?.user_id && (activeTab === 'jornadas' || activeTab === 'ajustes')) {
      setActiveTab('personal');
    }
  }, [employee?.user_id, activeTab]);

  const TABS: VerticalTab[] = [
    { id: 'personal', icon: User, label: t('tabs.personal') },
    { id: 'vinculaciones', icon: Briefcase, label: t('tabs.vinculaciones'), description: t('tabs.vinculacionesDesc') },
    { id: 'contratos', icon: ClipboardList, label: t('tabs.contratos'), description: t('tabs.contratosDesc') },
    { id: 'familia', icon: Users, label: t('tabs.familia') },
    { id: 'deducciones', icon: Receipt, label: t('tabs.deducciones') },
    { id: 'licencias', icon: CalendarOff, label: t('tabs.licencias'), description: t('tabs.licenciasDesc') },
    ...(employee?.user_id ? [{ id: 'ajustes', icon: Coins, label: t('tabs.ajustes'), description: t('tabs.ajustesDesc') } as VerticalTab] : []),
    ...(employee?.user_id ? [{ id: 'jornadas', icon: Clock, label: t('tabs.jornadas'), description: t('tabs.jornadasDesc') } as VerticalTab] : []),
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="payroll-panel-header flex flex-col gap-2 px-4 py-3 border-b shrink-0">
        {/* Row 1: title (left, never cut) + controls (right) */}
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold leading-tight whitespace-nowrap">
            {employee.apellidos}, {employee.nombres}
          </h2>
          <div className="flex items-center gap-1.5 ml-auto flex-none">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 flex-none">
                <Plus className="h-3.5 w-3.5" />
                <span className="payroll-panel-header__label">{t('quickAdd.label')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEmailOpen(true)} disabled={!employee.email}>
                <Mail className="h-4 w-4 mr-2" />
                {t('quickAdd.email')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setWaOpen(true)} disabled={!employee.telefono}>
                <WhatsAppIcon className="h-4 w-4 mr-2" />
                {t('quickAdd.whatsapp')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {contracts.some(
                (c) => c.is_active && (!c.valid_until || c.valid_until.slice(0, 10) >= TODAY_STR)
              ) && (
                <DropdownMenuItem onClick={openRenewDialog}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('quickAdd.renovarContrato')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  setActiveTab('vinculaciones');
                  openNewEmployment();
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
                  setActiveTab('licencias');
                  openNewAusencia();
                }}
              >
                <CalendarOff className="h-4 w-4 mr-2" />
                {t('quickAdd.licencia')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {employee.activo ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setEgresoDialogOpen(true)}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('quickAdd.egreso')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="text-green-700 focus:text-green-700"
                  onClick={handleReactivate}
                  disabled={reactivating}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('reactivate')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {onToggleExpand && (
            <button
              type="button"
              title={isExpanded ? 'Restaurar' : 'Expandir'}
              className="flex items-center justify-center h-8 w-8 flex-none rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              onClick={onToggleExpand}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-none" onClick={onClose}>
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </Button>
          )}
          </div>
        </div>
        {/* Row 2: contact links + badges (left) + reactivate (right; wraps below when narrow) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 flex-1 min-w-0">
            {employee.email && (
              <a
                href={`mailto:${employee.email}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary hover:underline min-w-0"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{employee.email}</span>
              </a>
            )}
            {employee.telefono && (
              <a
                href={`https://wa.me/${employee.telefono.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{employee.telefono}</span>
              </a>
            )}
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
          {!employee.activo && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-green-700 border-green-400 hover:bg-green-50 dark:hover:bg-green-950"
              onClick={handleReactivate}
              disabled={reactivating}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              {reactivating ? t('reactivating') : t('reactivate')}
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
            <>
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
                    <Label className="text-xs">{t('personal.sexo')}</Label>
                    <Select
                      value={personalForm.sexo ?? ''}
                      onValueChange={(v) =>
                        setPersonalForm((p) => ({
                          ...p,
                          sexo: v as PayrollEmployee['sexo'],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['M', 'F', 'O'] as const).map((v) => (
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
              </CardContent>
            </Card>
            <div className="sticky bottom-0 z-10 flex items-center gap-2 -mx-4 -mb-4 mt-3 px-4 py-3 border-t bg-background">
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
            </>
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
                  <InfoRow label={t('personal.cedula')} value={employee.cedula || '—'} />
                  <InfoRow
                    label={t('personal.fechaNacimiento')}
                    value={formatDate(employee.fecha_nacimiento)}
                  />
                  <InfoRow label={t('personal.sexo')} value={employee.sexo || '—'} />
                  <InfoRow label={t('personal.estadoCivil')} value={employee.estado_civil || '—'} />
                  <InfoRow label="N° BPS" value={employee.numero_bps || '—'} />
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
                  <InfoRow label={t('personal.telefono')} value={employee.telefono || '—'} />
                  <InfoRow label={t('personal.email')} value={employee.email || '—'} />
                  <InfoRow label={t('personal.domicilio')} value={employee.domicilio || '—'} />
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
                  <InfoRow label={t('personal.banco')} value={employee.banco || '—'} />
                  <InfoRow label={t('personal.cuentaBanco')} value={employee.cuenta_banco || '—'} />
                </CardContent>
              </Card>
            </>
          )}
          </div>
        )}

        {/* ── Vinculaciones ─────────────────────────────────────────────── */}
        {activeTab === 'vinculaciones' && (
          <div className="flex flex-col h-full -mx-4 -mb-4 min-h-0">
            <EmploymentList
              employments={employments}
              loading={empLoading}
              onSelect={(id) => {
                const empl = employments.find((e) => e.id === id);
                if (empl) openEditEmployment(empl);
              }}
              onNew={openNewEmployment}
            />
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
          <div className="flex flex-col h-full -mx-4 -mb-4 min-h-0">
            <FamilyChargeList
              charges={familyCharges}
              loading={familyLoading}
              onSelect={(id) => {
                const fc = familyCharges.find((f) => f.id === id);
                if (fc) openEditFamily(fc);
              }}
              onNew={openNewFamily}
            />
          </div>
        )}

        {/* ── Deducciones IRPF ─────────────────────────────────────────── */}
        {activeTab === 'deducciones' && (
          <div className="flex flex-col h-full -mx-4 -mb-4 min-h-0">
            <IrpfDeductionList
              deductions={irpfDeductions}
              loading={irpfLoading}
              onSelect={(id) => {
                const ded = irpfDeductions.find((d) => d.id === id);
                if (ded) openEditIrpf(ded);
              }}
              onNew={openNewIrpf}
            />
          </div>
        )}

        {/* ── Licencias y Ausencias ────────────────────────────────────── */}
        {activeTab === 'licencias' && (
          <div className="flex flex-col h-full -mx-4 -mb-4 min-h-0">
            <AusenciasList
              ausencias={ausencias}
              loading={ausenciasLoading}
              balance={vacationBalance}
              onSelect={(id) => {
                const a = ausencias.find((x) => x.id === id);
                if (a) openEditAusencia(a);
              }}
              onNew={openNewAusencia}
            />
          </div>
        )}

        {/* ── Ajustes (bonos / adelantos / horas extra / descuentos) ───── */}
        {activeTab === 'ajustes' && employee && (
          <EmployeeAdjustmentsTab employee={employee} />
        )}

        {/* ── Jornadas (sesiones clínicas) ─────────────────────────────── */}
        {activeTab === 'jornadas' && (
          <div className="flex flex-col h-full -mx-4 -mb-4 min-h-0">
            <ClinicalSessionsList
              sessions={clinicalSessions}
              loading={clinicalLoading}
              dateRange={clinicalRange}
              onDateRangeChange={setClinicalRange}
            />
          </div>
        )}
      </div>{/* end flex-1 overflow-y-auto p-4 */}

      {/* ── Employment dialog ───────────────────────────────────────────────── */}
      <Dialog open={empDialogOpen} onOpenChange={(v) => { if (!v) { setEmpDialogOpen(false); setEmpIsHistorical(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{empForm.id ? t('vinculaciones.editTitle') : t('vinculaciones.addNew')}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 px-6 py-4">
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
            {!INDEPENDENT_TIPOS.has(empForm.tipo_contrato) && (
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
            )}
            {!INDEPENDENT_TIPOS.has(empForm.tipo_contrato) && (
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
            )}
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
            {!INDEPENDENT_TIPOS.has(empForm.tipo_contrato) && (
            <>
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
            </>
            )}
            <div className="col-span-2 flex items-center gap-2 pt-1 border-t">
              <Checkbox
                id="emp-historical"
                checked={empIsHistorical}
                onCheckedChange={(v) => {
                  setEmpIsHistorical(v === true);
                  if (!v) setEmpForm((p) => ({ ...p, fecha_fin: '' }));
                }}
              />
              <Label htmlFor="emp-historical" className="text-xs font-normal cursor-pointer">
                {t('vinculaciones.form.esHistorica')}
              </Label>
            </div>
            {empIsHistorical && (
              <div className="space-y-1.5">
                <Label className="text-xs">{t('vinculaciones.form.fechaFin')}</Label>
                <Input
                  type="date"
                  value={empForm.fecha_fin}
                  onChange={(e) => setEmpForm((p) => ({ ...p, fecha_fin: e.target.value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmpDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSaveEmployment}
              disabled={empSaving || !empForm.fecha_inicio || (empIsHistorical && !empForm.fecha_fin)}
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
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-4">
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
            <DialogTitle>{familyForm.id ? t('familia.editTitle') : t('familia.addNew')}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 px-6 py-4">
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
          <DialogFooter className="sm:justify-between">
            {familyForm.id ? (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={familyDeleting === familyForm.id}
                onClick={() => {
                  handleDeleteFamily(familyForm.id);
                  setFamilyDialogOpen(false);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t('delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
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
            </div>
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
            <DialogTitle>{irpfForm.id ? t('deducciones.editTitle') : t('deducciones.addNew')}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-4">
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
          <DialogFooter className="sm:justify-between">
            {irpfForm.id ? (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={irpfDeleting === irpfForm.id}
                onClick={() => {
                  handleDeleteIrpf(irpfForm.id);
                  setIrpfDialogOpen(false);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t('delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIrpfDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSaveIrpf}
                disabled={irpfSaving || !irpfForm.descripcion || !irpfForm.vigente_desde}
              >
                {irpfSaving ? t('saving') : t('save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Communication dialogs ────────────────────────────────────────────── */}
      <EmailComposerDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        to={employee.email ?? ''}
        userId={employee.user_id ?? ''}
        recipientName={`${employee.apellidos}, ${employee.nombres}`}
      />
      <WhatsAppComposerDialog
        open={waOpen}
        onOpenChange={setWaOpen}
        phone={employee.telefono ?? ''}
        recipientName={`${employee.apellidos}, ${employee.nombres}`}
      />

      {/* ── Ausencia dialog ──────────────────────────────────────────────────── */}
      <AusenciaFormDialog
        open={ausenciaDialogOpen}
        ausencia={editingAusencia}
        employeeId={employeeId}
        clinicId={employee?.clinic_id}
        userId={employee?.user_id}
        onClose={() => { setAusenciaDialogOpen(false); setEditingAusencia(null); }}
        onSaved={() => { refreshAusencias(); }}
        onDeleted={() => { refreshAusencias(); }}
      />

      {/* ── Contract dialog ──────────────────────────────────────────────────── */}
      <ContractFormDialog
        open={contractDialogOpen}
        contract={editingContract}
        employee={employee}
        activeEmployment={activeEmployment}
        onClose={() => { setContractDialogOpen(false); setEditingContract(null); }}
        onSave={handleContractSave}
      />

      {/* ── Renovar contrato dialog ─────────────────────────────────────────── */}
      <Dialog open={renewDialogOpen} onOpenChange={(v) => { if (!v) { setRenewDialogOpen(false); setRenewingContract(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('contracts.renewTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-4">
            {renewingContract?.valid_until && (
              <div className="rounded-md border bg-muted/30 px-3 py-2.5 flex flex-col gap-0.5">
                <p className="text-xs text-muted-foreground">{t('contracts.renewValidFrom')}</p>
                <p className="text-sm font-medium">
                  {new Date(renewingContract.valid_until.slice(0, 10) + 'T00:00:00').toLocaleDateString(
                    'es-UY',
                    { day: '2-digit', month: '2-digit', year: 'numeric' }
                  )}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t('contracts.renewValidUntil')}</Label>
              <Input
                type="date"
                value={renewValidUntil}
                onChange={(e) => setRenewValidUntil(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenewDialogOpen(false); setRenewingContract(null); }}>
              {t('cancel')}
            </Button>
            <Button onClick={handleRenewConfirm} disabled={renewSaving || !renewValidUntil}>
              {renewSaving ? t('saving') : t('contracts.renewConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Egreso / Dar de baja dialog ──────────────────────────────────────── */}
      <Dialog open={egresoDialogOpen} onOpenChange={(v) => !v && setEgresoDialogOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('egresoDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <EgresoWizard
              initialEmployee={employee}
              initialEmployments={employments}
              onClose={() => setEgresoDialogOpen(false)}
              onDone={() => {
                if (employee) {
                  onEmployeeUpdate?.({ ...employee, activo: false });
                  refreshAllData();
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
