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
  const [isRightExpanded, setIsRightExpanded] = useState(false);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  return (
    <TwoPanelLayout
      isRightPanelOpen={!!selectedPeriodId}
      onBack={() => setSelectedPeriodId(null)}
      forceRightOnly={isRightExpanded}
      leftPanelDefaultSize={40}
      rightPanelDefaultSize={60}
      leftPanel={
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
          <CardHeader className="flex-none pt-2 px-4 pb-3 sm:pt-4">
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
              refreshSignal={listRefreshKey}
            />
          </CardContent>
        </Card>
      }
      rightPanel={
        selectedPeriodId ? (
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-0">
              <PeriodDetail
                key={selectedPeriodId}
                periodId={selectedPeriodId}
                onClose={() => setSelectedPeriodId(null)}
                onPeriodUpdate={() => setListRefreshKey((k) => k + 1)}
                isExpanded={isRightExpanded}
                onToggleExpand={() => setIsRightExpanded(v => !v)}
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
