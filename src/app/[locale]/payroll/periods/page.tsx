'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { PeriodList } from '@/components/payroll/PeriodList';
import { PeriodDetail } from '@/components/payroll/PeriodDetail';
import { useTranslations } from 'next-intl';
import { CalendarDays } from 'lucide-react';

export default function PayrollPeriodsPage() {
  const t = useTranslations('PayrollPage.periods');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  return (
    <TwoPanelLayout
      isRightPanelOpen={!!selectedPeriodId}
      onBack={() => setSelectedPeriodId(null)}
      leftPanelDefaultSize={40}
      rightPanelDefaultSize={60}
      leftPanel={
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
          <CardHeader className="flex-none p-4 pb-3">
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('title')}</CardTitle>
                <CardDescription className="text-xs">{t('subtitle')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-0">
            <PeriodList
              selectedId={selectedPeriodId ?? undefined}
              onSelect={setSelectedPeriodId}
            />
          </CardContent>
        </Card>
      }
      rightPanel={
        selectedPeriodId ? (
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-0">
              <PeriodDetail
                periodId={selectedPeriodId}
                onClose={() => setSelectedPeriodId(null)}
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardContent className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-8">
              <CalendarDays className="h-10 w-10 opacity-30" />
              <p className="text-sm">{t('selectPeriod')}</p>
            </CardContent>
          </Card>
        )
      }
    />
  );
}
