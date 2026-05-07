'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AusenciasList } from '@/components/payroll/AusenciasList';
import { AusenciaFormDialog } from '@/components/payroll/AusenciaFormDialog';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { PayrollAusencia, PayrollEmployee } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { CalendarOff } from 'lucide-react';

export default function PayrollLicenciasPage() {
  const t = useTranslations('PayrollPage.licenciasPage');

  const [ausencias, setAusencias] = useState<PayrollAusencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [editing, setEditing] = useState<PayrollAusencia | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadAusencias = useCallback(() => {
    setLoading(true);
    api.get(API_ROUTES.PAYROLL.AUSENCIAS_ALL)
      .then((res) => setAusencias((Array.isArray(res) ? res : (res?.data ?? [])) as PayrollAusencia[]))
      .catch(() => setAusencias([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAusencias();
    api.get(API_ROUTES.PAYROLL.EMPLOYEES)
      .then((res) => {
        const all = (Array.isArray(res) ? res : (res?.data ?? [])) as PayrollEmployee[];
        // dedupe by id + only active
        setEmployees(Array.from(new Map(all.filter((e) => e && e.id && e.activo).map((e) => [e.id, e])).values()));
      })
      .catch(() => setEmployees([]));
  }, [loadAusencias]);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    const a = ausencias.find((x) => x.id === id);
    if (a) { setEditing(a); setDialogOpen(true); }
  }

  return (
    <div className="h-full flex flex-col p-3 sm:p-4">
      <Card className="flex-1 flex flex-col border-0 lg:border shadow-none lg:shadow-sm min-h-0">
        <CardHeader className="flex-none pt-2 px-4 pb-3 sm:pt-4">
          <div className="flex items-start gap-3">
            <div className="header-icon-circle mt-0.5">
              <CalendarOff className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('title')}</CardTitle>
              <CardDescription className="text-xs">{t('subtitleAusencias')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-0">
          <AusenciasList
            ausencias={ausencias}
            loading={loading}
            showEmployee
            onSelect={openEdit}
            onNew={openNew}
          />
        </CardContent>
      </Card>

      <AusenciaFormDialog
        open={dialogOpen}
        ausencia={editing}
        employeeId={editing?.employee_id ?? ''}
        employees={employees}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSaved={loadAusencias}
        onDeleted={loadAusencias}
      />
    </div>
  );
}
