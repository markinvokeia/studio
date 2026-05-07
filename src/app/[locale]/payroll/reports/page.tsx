'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportsPanel } from '@/components/payroll/ReportsPanel';
import { BarChart3 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function PayrollReportsPage() {
  const t = useTranslations('PayrollPage.reports');
  return (
    <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
      <CardHeader className="flex-none p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="header-icon-circle mt-0.5">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">{t('title')}</CardTitle>
            <CardDescription className="text-xs">{t('subtitle')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-0">
        <ReportsPanel />
      </CardContent>
    </Card>
  );
}
