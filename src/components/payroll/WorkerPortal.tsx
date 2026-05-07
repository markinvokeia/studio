'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MOCK_EMPLOYEES, MOCK_PERIODS } from '@/components/payroll/mock-data';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import { Download, FileText, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function WorkerPortal() {
  const t = useTranslations('PayrollPage.portal');
  const employee = MOCK_EMPLOYEES[0];
  const closedPeriods = MOCK_PERIODS.filter((p) => p.status === 'closed' || p.status === 'paid');

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl">
      {/* Worker header */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">{employee.apellidos}, {employee.nombres}</p>
            <p className="text-sm text-muted-foreground">{employee.cedula}</p>
            <p className="text-xs text-muted-foreground">{t('joinedDate')}: {employee.fecha_ingreso}</p>
          </div>
        </CardContent>
      </Card>

      {/* Receipts */}
      <div>
        <h2 className="text-sm font-semibold mb-3">{t('receipts.title')}</h2>
        {closedPeriods.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('receipts.none')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {closedPeriods.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {getMonthName(p.period_month)} {p.period_year}
                      </p>
                      {p.total_net && (
                        <p className="text-xs text-muted-foreground">
                          {t('receipts.net')}: {formatCurrency(p.total_net / (p.entries_count ?? 1))}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    {t('receipts.download')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Certificates */}
      <div>
        <h2 className="text-sm font-semibold mb-3">{t('certificates.title')}</h2>
        <div className="flex flex-col gap-2">
          {[
            { id: 'ingresos', label: t('certificates.ingresos') },
            { id: 'trabajo', label: t('certificates.trabajo') },
            { id: 'fonasa', label: t('certificates.fonasa') },
          ].map((cert) => (
            <Card key={cert.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">{cert.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="text-xs bg-muted text-muted-foreground">{t('certificates.onRequest')}</Badge>
                  <Button variant="outline" size="sm">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    {t('certificates.request')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Bank data */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium">{t('bankData.title')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('bankData.bank')}</span>
            <span>{employee.banco ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('bankData.account')}</span>
            <span className="font-mono">{employee.cuenta_banco ?? '—'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
