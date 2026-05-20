'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { BarChart2, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useCallback, useState } from 'react';
import { PrintReportFooter } from './print-report-footer';
import { PrintReportHeader } from './print-report-header';
import { ReportExportActions } from './report-export-actions';

interface ReportShellProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  filters: ReactNode;
  onGenerate: () => void;
  isLoading?: boolean;
  hasData?: boolean;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onPrint?: () => void;
  children?: ReactNode;
  className?: string;
}

export function ReportShell({
  title,
  description,
  icon: Icon,
  filters,
  onGenerate,
  isLoading = false,
  hasData = false,
  onExportPDF,
  onExportExcel,
  onPrint,
  children,
  className,
}: ReportShellProps) {
  const t = useTranslations('ReportShell');
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  const handleGenerate = useCallback(() => {
    setGeneratedAt(new Date());
    onGenerate();
  }, [onGenerate]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <PrintReportHeader />

      {/*
        Header
        Mobile:  [title + description — takes all remaining width] [actions stacked, tiny, right]
        Desktop: [title + description]                              [actions with labels, right]
      */}
      <div className="flex items-start gap-2 md:gap-4">
        {Icon && (
          <div className="header-icon-circle flex-none">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-semibold leading-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="shrink-0 print:hidden">
          <ReportExportActions
            onExportPDF={onExportPDF}
            onExportExcel={onExportExcel}
            onPrint={onPrint}
            disabled={!hasData}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Filter bar */}
      <Card className="print:hidden">
        <CardContent className="p-3">
          {/*
            Mobile:  filter items → grid-cols-2 (2 per row, equal width)
                     generate button → full-width row below
            Desktop: filter items → flex-wrap inline; button at end of same row
          */}
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-end gap-3">
            {/*
              On mobile: override the page's inner <div class="flex flex-wrap …">
              to become a grid-cols-2 so each filter takes half the width.
            */}
            <div className="flex-1 min-w-0 max-md:[&>div]:grid max-md:[&>div]:grid-cols-2 max-md:[&>div]:gap-2">
              {filters}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="shrink-0 gap-2 w-full md:w-auto"
              size="sm"
            >
              <Search className="h-4 w-4" />
              {isLoading ? t('generating') : t('generate')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content or empty state */}
      {!hasData && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground print:hidden">
          <BarChart2 className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">{t('emptyTitle')}</p>
          <p className="text-xs mt-1">{t('emptySubtitle')}</p>
        </div>
      ) : (
        <>
          {hasData && <Separator className="print:hidden" />}
          {children}
        </>
      )}

      {hasData && <PrintReportFooter generatedAt={generatedAt} />}
    </div>
  );
}
