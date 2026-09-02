'use client';

import * as React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  exportAllPatientGroupsToExcel,
  exportPatientGroupToExcel,
  type ExportPatientGroup,
} from '@/services/patient-group-export';

function useSheetHeaders() {
  const t = useTranslations('PatientGroupsPage.export');
  return React.useMemo(() => ({ name: t('col_name'), phone: t('col_phone') }), [t]);
}

interface SingleProps {
  group: ExportPatientGroup;
  size?: React.ComponentProps<typeof Button>['size'];
  variant?: React.ComponentProps<typeof Button>['variant'];
}

export function PatientGroupExportButton({ group, size = 'sm', variant = 'outline' }: SingleProps) {
  const t = useTranslations('PatientGroupsPage.export');
  const { toast } = useToast();
  const headers = useSheetHeaders();
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { patientCount } = await exportPatientGroupToExcel(group, headers);
      toast({ title: t('successSingle', { count: patientCount }) });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button size={size} variant={variant} className="gap-1.5" onClick={handleExport} disabled={isExporting}>
      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      <span className="hidden sm:inline">{t('button')}</span>
    </Button>
  );
}

export function PatientGroupsExportAllButton({ size = 'sm', variant = 'outline' }: Omit<SingleProps, 'group'>) {
  const t = useTranslations('PatientGroupsPage.export');
  const { toast } = useToast();
  const headers = useSheetHeaders();
  const [isExporting, setIsExporting] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; totalGroups: number } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(null);
    try {
      const { groupCount, patientCount } = await exportAllPatientGroupsToExcel(
        headers,
        t('allFileName'),
        setProgress,
      );
      if (groupCount === 0) {
        toast({ title: t('empty') });
        return;
      }
      toast({ title: t('successAll', { groups: groupCount, count: patientCount }) });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  const label =
    isExporting && progress && progress.totalGroups > 0
      ? t('progress', { done: progress.done, total: progress.totalGroups })
      : t('allButton');

  return (
    <Button size={size} variant={variant} className="gap-1.5" onClick={handleExport} disabled={isExporting}>
      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
