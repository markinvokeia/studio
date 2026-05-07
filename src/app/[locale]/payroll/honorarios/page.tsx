'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { HonorariosList } from '@/components/payroll/HonorariosList';
import { HonorariosDetail } from '@/components/payroll/HonorariosDetail';
import { useTranslations } from 'next-intl';
import { Receipt } from 'lucide-react';

export default function PayrollHonorariosPage() {
  const t = useTranslations('PayrollPage.honorarios');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <TwoPanelLayout
      isRightPanelOpen={!!selectedId}
      onBack={() => setSelectedId(null)}
      leftPanel={
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
          <CardHeader className="flex-none p-4 pb-3">
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('title')}</CardTitle>
                <CardDescription className="text-xs">{t('subtitle')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-0">
            <HonorariosList
              selectedId={selectedId ?? undefined}
              onSelect={setSelectedId}
            />
          </CardContent>
        </Card>
      }
      rightPanel={
        selectedId ? (
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-0">
              <HonorariosDetail
                id={selectedId}
                onClose={() => setSelectedId(null)}
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardContent className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-8">
              <Receipt className="h-10 w-10 opacity-30" />
              <p className="text-sm">{t('selectHonorario')}</p>
            </CardContent>
          </Card>
        )
      }
    />
  );
}
