'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip';
import type { VerticalTab } from '@/components/ui/vertical-tab-strip';
import { PayrollSettingsPage } from '@/components/payroll/PayrollSettings';
import { ConceptsTable } from '@/components/payroll/ConceptsTable';
import { CategoriesTable } from '@/components/payroll/CategoriesTable';
import { WorkCalendarPanel } from '@/components/payroll/WorkCalendarPanel';
import { BookOpen, CalendarDays, Layers, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function SettingsPage() {
  const t = useTranslations('PayrollPage.settings');
  const [activeTab, setActiveTab] = useState('tasas');

  const TABS: VerticalTab[] = [
    { id: 'tasas',      icon: Settings2,   label: t('tabs.tasas') },
    { id: 'conceptos',  icon: BookOpen,    label: t('tabs.conceptos') },
    { id: 'categorias', icon: Layers,      label: t('tabs.categorias') },
    { id: 'calendario', icon: CalendarDays, label: t('tabs.calendario') },
  ];

  return (
    <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
      <CardHeader className="flex-none p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="header-icon-circle mt-0.5">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">{t('title')}</CardTitle>
            <CardDescription className="text-xs">{t('subtitle')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <VerticalTabStrip
        tabs={TABS}
        activeTabId={activeTab}
        onTabClick={(tab) => setActiveTab(tab.id)}
      />
      <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-0">
        {activeTab === 'tasas' && (
          <div className="flex-1 overflow-y-auto">
            <PayrollSettingsPage />
          </div>
        )}
        {activeTab === 'conceptos'  && <ConceptsTable />}
        {activeTab === 'categorias' && <CategoriesTable />}
        {activeTab === 'calendario' && <WorkCalendarPanel />}
      </CardContent>
    </Card>
  );
}
