'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip';
import type { VerticalTab } from '@/components/ui/vertical-tab-strip';
import { MOCK_PERIODS } from '@/components/payroll/mock-data';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import { Building, Download, FileText, Receipt, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface ReportItem {
  id: string;
  label: string;
  description: string;
  format: string;
  available: boolean;
}

export function ReportsPanel() {
  const t = useTranslations('PayrollPage.reports');
  const closedPeriods = MOCK_PERIODS.filter(
    (p) => p.status === 'closed' || p.status === 'paid' || p.status === 'approved',
  );
  const [selectedPeriod, setSelectedPeriod] = useState(closedPeriods[0]?.id ?? '');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [activeTab, setActiveTab] = useState('bps');

  const TABS: VerticalTab[] = [
    { id: 'bps',   icon: Shield,   label: 'BPS' },
    { id: 'dgi',   icon: Receipt,  label: 'DGI / IRPF' },
    { id: 'bank',  icon: Building, label: t('bankTab') },
    { id: 'other', icon: FileText, label: t('otherTab') },
  ];

  const bpsReports: ReportItem[] = [
    { id: 'bps_nomina', label: t('bps.nomina'), description: t('bps.nominaDesc'), format: 'TXT', available: true },
    { id: 'gafi',       label: t('bps.gafi'),   description: t('bps.gafiDesc'),   format: 'TXT', available: true },
  ];

  const dgiReports: ReportItem[] = [
    { id: 'dgi_irpf', label: t('dgi.irpf'), description: t('dgi.irpfDesc'), format: 'XML + PDF', available: false },
  ];

  const bankReports: ReportItem[] = [
    { id: 'bank_brou', label: 'BROU', description: t('bank.desc'), format: 'TXT', available: true },
    { id: 'bank_itau', label: 'Itaú', description: t('bank.desc'), format: 'TXT', available: false },
  ];

  const otherReports: ReportItem[] = [
    { id: 'receipts',    label: t('other.receipts'),    description: t('other.receiptsDesc'),    format: 'PDF',        available: true  },
    { id: 'accounting',  label: t('other.accounting'),  description: t('other.accountingDesc'),  format: 'CSV / JSON', available: true  },
    { id: 'cost_center', label: t('other.costCenter'),  description: t('other.costCenterDesc'),  format: 'PDF + XLSX', available: true  },
    { id: 'mtss',        label: t('other.mtss'),        description: t('other.mtssDesc'),        format: 'PDF',        available: false },
  ];

  const period = MOCK_PERIODS.find((p) => p.id === selectedPeriod);

  const activeReports =
    activeTab === 'bps'   ? bpsReports   :
    activeTab === 'dgi'   ? dgiReports   :
    activeTab === 'bank'  ? bankReports  :
    otherReports;

  const activeTitle =
    activeTab === 'bps'   ? t('bps.title')   :
    activeTab === 'dgi'   ? t('dgi.title')   :
    activeTab === 'bank'  ? t('bank.title')  :
    t('other.title');

  function ReportRow({ item }: { item: ReportItem }) {
    return (
      <div className="flex items-center justify-between py-3 border-b last:border-0">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">{item.format}</span>
          <Button size="sm" variant="outline" disabled={!item.available}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {item.available ? t('download') : t('unavailable')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <VerticalTabStrip
        tabs={TABS}
        activeTabId={activeTab}
        onTabClick={(tab) => setActiveTab(tab.id)}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Period / year selector */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground shrink-0">{t('period')}:</p>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t('selectPeriod')} />
              </SelectTrigger>
              <SelectContent>
                {closedPeriods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {getMonthName(p.period_month)} {p.period_year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeTab === 'dgi' && (
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground shrink-0">Año:</p>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {period && (
            <div className="flex gap-3 text-xs text-muted-foreground items-center sm:ml-auto">
              <span>{t('gross')}: <strong>{formatCurrency(period.total_gross ?? 0)}</strong></span>
              <span>{t('net')}: <strong>{formatCurrency(period.total_net ?? 0)}</strong></span>
            </div>
          )}
        </div>

        {/* Report list */}
        <div className="p-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">{activeTitle}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {activeReports.map((r) => (
                <ReportRow key={r.id} item={r} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
