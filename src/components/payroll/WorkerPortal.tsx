'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate, getMonthName } from '@/components/payroll/payroll-utils';
import { ClinicalSessionsList } from '@/components/payroll/ClinicalSessionsList';
import { WorkLogPanel } from '@/components/payroll/WorkLogPanel';
import { AusenciasList } from '@/components/payroll/AusenciasList';
import { VacationBalanceCard } from '@/components/payroll/VacationBalanceCard';
import type { PayrollAusencia, PayrollClinicalSession, PayrollEmployee, PayrollEntry, PortalRequest, PortalRequestMotivo, VacationBalance } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  AlertCircle,
  CalendarOff,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileText,
  MessageSquare,
  Plus,
  Receipt,
  TrendingUp,
  User,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface PortalEntry extends PayrollEntry {
  period_year?: number;
  period_month?: number;
  period_status?: string;
}



const REQUEST_ESTADO_COLORS: Record<string, string> = {
  pendiente:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  respondida:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cerrada:     'bg-muted text-muted-foreground',
};

const MOTIVOS: { value: PortalRequestMotivo; label: string }[] = [
  { value: 'recibos_sueldo', label: 'Mis recibos de sueldo' },
  { value: 'historial',       label: 'Historial de períodos' },
  { value: 'novedades',       label: 'Licencias / ausencias' },
  { value: 'certificados',    label: 'Certificados' },
  { value: 'datos',           label: 'Mis datos personales' },
  { value: 'otro',            label: 'Otro' },
];

function StatCard({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-lg font-bold tabular-nums', className)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function WorkerPortal() {
  const t = useTranslations('PayrollPage.portal');
  const tLic = useTranslations('PayrollPage.legajo');
  const { user } = useAuth();
  const { toast } = useToast();

  const [employee, setEmployee] = useState<PayrollEmployee | null>(null);
  const [entries, setEntries] = useState<PortalEntry[]>([]);
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // New request dialog
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestTipo, setRequestTipo] = useState<'solicitud' | 'reclamo'>('solicitud');
  const [requestMotivo, setRequestMotivo] = useState<PortalRequestMotivo>('recibos_sueldo');
  const [requestDesc, setRequestDesc] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  // View request detail dialog
  const [viewRequest, setViewRequest] = useState<PortalRequest | null>(null);

  // Downloading
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Jornadas (clinical sessions)
  const [clinicalSessions, setClinicalSessions] = useState<PayrollClinicalSession[]>([]);
  const [clinicalLoading, setClinicalLoading] = useState(false);
  const [clinicalRange, setClinicalRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Licencias / Ausencias
  const [ausencias, setAusencias] = useState<PayrollAusencia[]>([]);
  const [ausenciasLoading, setAusenciasLoading] = useState(false);
  const [vacationBalance, setVacationBalance] = useState<VacationBalance | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [empData, entryData, requestsData] = await Promise.all([
          api.get(API_ROUTES.PAYROLL.EMPLOYEES, { user_id: user.id }).catch(() => null),
          api.get(API_ROUTES.PAYROLL.ENTRIES_BY_EMPLOYEE, { employee_id: user.id }).catch(() => []),
          api.get(API_ROUTES.PAYROLL.PORTAL_REQUESTS, { user_id: user.id }).catch(() => []),
        ]);
        setEmployee((empData as { employee?: PayrollEmployee })?.employee ?? (empData as PayrollEmployee) ?? null);
        const rawEntries = Array.isArray(entryData)
          ? entryData
          : ((entryData as { entries?: PortalEntry[] })?.entries ?? []);
        setEntries(rawEntries);
        const rawRequests = Array.isArray(requestsData)
          ? requestsData
          : ((requestsData as { data?: PortalRequest[] })?.data ?? []);
        setRequests(rawRequests);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  // Clinical sessions (Jornadas) for the logged-in doctor
  useEffect(() => {
    if (!user?.id || !clinicalRange?.from || !clinicalRange?.to) return;
    let cancelled = false;
    setClinicalLoading(true);
    api.get(API_ROUTES.PAYROLL.CLINICAL_SESSIONS_BY_USER, {
      user_id: user.id,
      date_from: format(clinicalRange.from, 'yyyy-MM-dd'),
      date_to: format(clinicalRange.to, 'yyyy-MM-dd'),
    })
      .then((res) => { if (!cancelled) setClinicalSessions((Array.isArray(res) ? res : (res?.data ?? [])) as PayrollClinicalSession[]); })
      .catch(() => { if (!cancelled) setClinicalSessions([]); })
      .finally(() => { if (!cancelled) setClinicalLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, clinicalRange?.from, clinicalRange?.to]);

  // Licencias/Ausencias + vacation balance for the logged-in employee
  useEffect(() => {
    const empId = employee?.id;
    if (!empId) return;
    let cancelled = false;
    setAusenciasLoading(true);
    api.get(API_ROUTES.PAYROLL.AUSENCIAS_BY_EMPLOYEE, { employee_id: empId })
      .then((res) => { if (!cancelled) setAusencias((Array.isArray(res) ? res : (res?.data ?? [])) as PayrollAusencia[]); })
      .catch(() => { if (!cancelled) setAusencias([]); })
      .finally(() => { if (!cancelled) setAusenciasLoading(false); });
    api.get(API_ROUTES.PAYROLL.VACATION_BALANCE, { employee_id: empId })
      .then((res) => { if (!cancelled) setVacationBalance(((res?.data ?? res) ?? null) as VacationBalance | null); })
      .catch(() => { if (!cancelled) setVacationBalance(null); });
    return () => { cancelled = true; };
  }, [employee?.id]);

  async function handleDownloadReceipt(entry: PortalEntry) {
    try {
      setDownloadingId(entry.id);
      const blob: Blob = await api.getBlob(API_ROUTES.PAYROLL.REPORTS_RECEIPTS, { entry_id: entry.id });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recibo-${entry.period_year}-${entry.period_month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ } finally {
      setDownloadingId(null);
    }
  }

  async function handleSendRequest() {
    if (!requestDesc.trim() || !requestMotivo) return;
    setSendingRequest(true);
    try {
      const created = await api.post(API_ROUTES.PAYROLL.PORTAL_REQUESTS_CREATE, {
        user_id: user?.id,
        employee_id: employee?.id ?? null,
        tipo: requestTipo,
        motivo: requestMotivo,
        descripcion: requestDesc,
      });
      const newReq: PortalRequest =
        (created as { data?: PortalRequest })?.data ?? (created as PortalRequest);
      if (newReq?.id) setRequests((prev) => [newReq, ...prev]);
      toast({ title: requestTipo === 'reclamo' ? 'Reclamo enviado.' : 'Solicitud enviada.' });
      setRequestOpen(false);
      setRequestDesc('');
      setRequestMotivo('recibos_sueldo');
    } catch {
      toast({ title: 'Error al enviar', variant: 'destructive' });
    } finally {
      setSendingRequest(false);
    }
  }

  async function handleCloseRequest(req: PortalRequest) {
    try {
      await api.post(API_ROUTES.PAYROLL.PORTAL_REQUESTS_CLOSE, { id: req.id, user_id: user?.id });
      setRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, estado: 'cerrada' } : r));
      setViewRequest(null);
    } catch {
      toast({ title: 'Error al cerrar la solicitud', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex flex-col gap-4 pt-2 px-4 pb-4 sm:pt-4 sm:px-6 sm:pb-6 overflow-y-auto flex-1 border-0 lg:border shadow-none lg:shadow-sm rounded-none lg:rounded-xl bg-card">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const closedEntries = entries.filter((e) => e.period_status === 'closed' || e.period_status === 'paid');
  const totalNetAnual = closedEntries.reduce((s, e) => s + (e.net_salary ?? 0), 0);
  const totalSessions = closedEntries.reduce((s, e) => s + (e.sessions_count ?? 0), 0);
  const totalHours = closedEntries.reduce((s, e) => s + (e.hours_worked ?? 0), 0);
  const vacacionesDias = vacationBalance?.saldo ?? ausencias.filter((a) => a.tipo === 'vacaciones').reduce((s, a) => s + (a.dias ?? 0), 0);
  const pendingRequests = requests.filter((r) => r.estado === 'pendiente').length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex flex-col overflow-hidden flex-1 border-0 lg:border shadow-none lg:shadow-sm rounded-none lg:rounded-xl bg-card">
      {/* Page header — same pattern as other payroll pages */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-2 sm:py-4 border-b shrink-0">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {user?.name ?? t('subtitle')}
            {(employee?.cedula ?? user?.email) && (
              <span className="text-muted-foreground/60"> · {employee?.cedula ?? user?.email}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 items-center">
          {pendingRequests > 0 && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {pendingRequests} pendiente{pendingRequests !== 1 ? 's' : ''}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => { setRequestTipo('solicitud'); setRequestOpen(true); }}>
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Nueva solicitud
          </Button>
          <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
            onClick={() => { setRequestTipo('reclamo'); setRequestOpen(true); }}>
            <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
            Reclamo
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 pt-2 px-4 pb-4 sm:pt-4 sm:px-6 sm:pb-6">

          {/* KPI summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Neto acumulado" value={formatCurrency(totalNetAnual)} className="text-green-600 dark:text-green-400" />
            <StatCard label="Sesiones" value={String(totalSessions)} sub="históricas" />
            <StatCard label="Horas trabajadas" value={`${totalHours.toFixed(0)}h`} />
            <StatCard label="Vacaciones" value={`${vacacionesDias}d`} sub="saldo" />
          </div>

          {/* Tabs — Mis Datos first */}
          <Tabs defaultValue="datos">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="datos" className="text-xs gap-1.5">
                <User className="h-3.5 w-3.5" />
                Mis datos
              </TabsTrigger>
              <TabsTrigger value="recibos" className="text-xs gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                {t('receipts.title')}
              </TabsTrigger>
              <TabsTrigger value="historial" className="text-xs gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Historial
              </TabsTrigger>
              <TabsTrigger value="licencias" className="text-xs gap-1.5">
                <CalendarOff className="h-3.5 w-3.5" />
                {tLic('tabs.licencias')}
              </TabsTrigger>
              <TabsTrigger value="jornadas" className="text-xs gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {tLic('tabs.jornadas')}
              </TabsTrigger>
              <TabsTrigger value="worklog" className="text-xs gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                {t('jornadas.myWorklog')}
              </TabsTrigger>
              <TabsTrigger value="certificados" className="text-xs gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {t('certificates.title')}
              </TabsTrigger>
              <TabsTrigger value="solicitudes" className="text-xs gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Solicitudes
                {pendingRequests > 0 && (
                  <span className="ml-1 h-4 min-w-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center px-1">
                    {pendingRequests}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Mis datos tab — FIRST */}
            <TabsContent value="datos" className="mt-4">
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-medium">Datos personales</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 grid grid-cols-2 gap-4 text-sm">
                  {employee ? (
                    <>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs text-muted-foreground">Cédula</p>
                        <p className="font-medium font-mono">{employee.cedula ?? '—'}</p>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs text-muted-foreground">Fecha de ingreso</p>
                        <p className="font-medium">{formatDate(employee.fecha_ingreso)}</p>
                      </div>
                      {employee.telefono && (
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs text-muted-foreground">Teléfono</p>
                          <p className="font-medium">{employee.telefono}</p>
                        </div>
                      )}
                      {employee.email && (
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="font-medium">{employee.email}</p>
                        </div>
                      )}
                      {(employee.banco || employee.cuenta_banco) && (
                        <>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-xs text-muted-foreground">{t('bankData.bank')}</p>
                            <p className="font-medium">{employee.banco ?? '—'}</p>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-xs text-muted-foreground">{t('bankData.account')}</p>
                            <p className="font-medium font-mono">{employee.cuenta_banco ?? '—'}</p>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground col-span-2">No hay datos de empleado vinculados a este usuario.</p>
                  )}
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Para actualizar tus datos, comunícate con administración o envía una solicitud.
              </p>
            </TabsContent>

            {/* Recibos tab */}
            <TabsContent value="recibos" className="mt-4">
              {closedEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t('receipts.none')}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {closedEntries.map((entry) => (
                    <Card key={entry.id}>
                      <CardContent className="p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium capitalize">
                              {entry.period_month && entry.period_year
                                ? `${getMonthName(entry.period_month)} ${entry.period_year}`
                                : '—'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t('receipts.net')}: <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(entry.net_salary)}</span>
                              {' · '}Bruto: {formatCurrency(entry.gross_salary)}
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm"
                          disabled={downloadingId === entry.id}
                          onClick={() => handleDownloadReceipt(entry)}>
                          <Download className="h-3.5 w-3.5 mr-1.5" />
                          {downloadingId === entry.id ? '...' : t('receipts.download')}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Historial tab */}
            <TabsContent value="historial" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Sin historial disponible.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Período</th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Sesiones</th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Horas</th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Bruto</th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Deducciones</th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Neto</th>
                            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((entry) => (
                            <tr key={entry.id} className="border-b last:border-0">
                              <td className="px-4 py-2.5 font-medium">
                                {entry.period_month && entry.period_year
                                  ? `${getMonthName(entry.period_month)} ${entry.period_year}`
                                  : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{entry.sessions_count}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{entry.hours_worked}h</td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatCurrency(entry.gross_salary)}</td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-red-600 dark:text-red-400">
                                -{formatCurrency(entry.total_deductions ?? 0)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-green-600 dark:text-green-400">
                                {formatCurrency(entry.net_salary)}
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge variant="outline" className="text-xs capitalize">
                                  {entry.period_status ?? entry.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Licencias y Ausencias tab */}
            <TabsContent value="licencias" className="mt-4">
              <div className="flex flex-col gap-3">
                <VacationBalanceCard balance={vacationBalance} loading={ausenciasLoading && !vacationBalance} />
                <div className="rounded-lg border overflow-hidden">
                  <AusenciasList ausencias={ausencias} loading={ausenciasLoading} />
                </div>
              </div>
            </TabsContent>

            {/* Jornadas tab (sesiones clínicas) */}
            <TabsContent value="jornadas" className="mt-4">
              <div className="rounded-lg border overflow-hidden h-[60vh]">
                <ClinicalSessionsList
                  sessions={clinicalSessions}
                  loading={clinicalLoading}
                  dateRange={clinicalRange}
                  onDateRangeChange={setClinicalRange}
                />
              </div>
            </TabsContent>

            {/* Mis jornadas tab (worklog self-service) */}
            <TabsContent value="worklog" className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">{t('jornadas.myWorklogDesc')}</p>
              <div className="rounded-lg border overflow-hidden h-[60vh]">
                <WorkLogPanel userId={user?.id ?? ''} />
              </div>
            </TabsContent>

            {/* Certificados tab */}
            <TabsContent value="certificados" className="mt-4">
              <div className="flex flex-col gap-2">
                {[
                  { id: 'ingresos', label: t('certificates.ingresos'), desc: 'Certificado de ingresos anuales para DGI/IRPF' },
                  { id: 'trabajo',  label: t('certificates.trabajo'),  desc: 'Certificado de relación laboral vigente' },
                  { id: 'fonasa',   label: t('certificates.fonasa'),   desc: 'Certificado de aportes FONASA para mutualistas' },
                ].map((cert) => (
                  <Card key={cert.id}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{cert.label}</p>
                          <p className="text-xs text-muted-foreground">{cert.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="text-xs bg-muted text-muted-foreground">{t('certificates.onRequest')}</Badge>
                        <Button variant="outline" size="sm"
                          onClick={() => {
                            setRequestTipo('solicitud');
                            setRequestMotivo('certificados');
                            setRequestDesc(`Solicito certificado de ${cert.label.toLowerCase()}.`);
                            setRequestOpen(true);
                          }}>
                          {t('certificates.request')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Solicitudes tab */}
            <TabsContent value="solicitudes" className="mt-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Historial de solicitudes y reclamos enviados a administración.</p>
                  <Button size="sm" onClick={() => { setRequestTipo('solicitud'); setRequestOpen(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Nueva
                  </Button>
                </div>

                {requests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No has enviado solicitudes aún.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {requests.map((req) => (
                      <Card
                        key={req.id}
                        className="cursor-pointer hover:bg-muted/20 transition-colors"
                        onClick={() => setViewRequest(req)}
                      >
                        <CardContent className="p-3 flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            {req.estado === 'cerrada' ? (
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            ) : req.estado === 'respondida' ? (
                              <CheckCircle2 className="h-4 w-4 text-blue-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">
                                {MOTIVOS.find((m) => m.value === req.motivo)?.label ?? req.motivo}
                              </p>
                              <Badge className={cn('text-[9px]', REQUEST_ESTADO_COLORS[req.estado])}>
                                {req.estado}
                              </Badge>
                              <Badge variant="outline" className="text-[9px] capitalize">
                                {req.tipo}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{req.descripcion}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(req.created_at)}
                              {req.respuesta && ' · Con respuesta'}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      </div>

      {/* New request dialog */}
      <Dialog open={requestOpen} onOpenChange={(v) => !v && setRequestOpen(false)}>
        <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>{requestTipo === 'reclamo' ? 'Enviar reclamo' : 'Nueva solicitud'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={requestTipo} onValueChange={(v) => setRequestTipo(v as 'solicitud' | 'reclamo')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solicitud">Solicitud</SelectItem>
                  <SelectItem value="reclamo">Reclamo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo</Label>
              <Select value={requestMotivo} onValueChange={(v) => setRequestMotivo(v as PortalRequestMotivo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {requestTipo === 'reclamo' ? 'Describe el reclamo o inconveniente:' : 'Describe tu solicitud:'}
              </Label>
              <Textarea
                value={requestDesc}
                onChange={(e) => setRequestDesc(e.target.value)}
                placeholder={requestTipo === 'reclamo'
                  ? 'Ej: Error en el cálculo de horas extra del mes de...'
                  : 'Ej: Necesito este certificado para...'}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendRequest} disabled={sendingRequest || !requestDesc.trim()}>
              {sendingRequest ? '...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View request detail dialog */}
      <Dialog open={!!viewRequest} onOpenChange={(v) => !v && setViewRequest(null)}>
        <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {MOTIVOS.find((m) => m.value === viewRequest?.motivo)?.label ?? viewRequest?.motivo}
              {viewRequest && (
                <Badge className={cn('text-[9px]', REQUEST_ESTADO_COLORS[viewRequest.estado])}>
                  {viewRequest.estado}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewRequest && (
            <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Mi consulta ({viewRequest.tipo})</p>
                <p className="text-sm bg-muted/30 rounded-lg p-3">{viewRequest.descripcion}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Enviado el {formatDate(viewRequest.created_at)}
              </p>
              {viewRequest.respuesta ? (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Respuesta de administración
                      {viewRequest.respondido_por_name ? ` (${viewRequest.respondido_por_name})` : ''}
                      {viewRequest.respondido_at ? ` · ${new Date(viewRequest.respondido_at).toLocaleDateString('es-UY')}` : ''}
                    </p>
                    <p className="text-sm bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-900">
                      {viewRequest.respuesta}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Tu solicitud está siendo revisada por administración.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
            <Button variant="outline" onClick={() => setViewRequest(null)}>Cerrar</Button>
            {viewRequest && viewRequest.estado !== 'cerrada' && (
              <Button variant="ghost" className="text-muted-foreground"
                onClick={() => handleCloseRequest(viewRequest)}>
                Archivar solicitud
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
