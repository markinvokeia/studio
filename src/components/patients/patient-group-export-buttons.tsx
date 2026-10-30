'use client';

import * as React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/hooks/use-async-action';
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
  // Ref-locked: a double click can't generate the file twice.
  const exportGroup = useAsyncAction(() => exportPatientGroupToExcel(group, headers), {
    onSuccess: ({ patientCount }) => {
      toast({ title: t('successSingle', { count: patientCount }) });
    },
    errorTitle: t('error'),
  });
  const isExporting = exportGroup.isPending;

  return (
    <Button
      size={size}
      variant={variant}
      className="gap-1.5"
      onClick={() => exportGroup.run()}
      disabled={isExporting}
      aria-busy={isExporting || undefined}
      aria-label={t('button')}
    >
      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      <span className="hidden sm:inline">{t('button')}</span>
    </Button>
  );
}

export function PatientGroupsExportAllButton({ size = 'sm', variant = 'outline' }: Omit<SingleProps, 'group'>) {
  const t = useTranslations('PatientGroupsPage.export');
  const { toast } = useToast();
  const headers = useSheetHeaders();
  const [progress, setProgress] = React.useState<{ done: number; totalGroups: number } | null>(null);

  // Ref-locked: a double click can't start a second full export while the first one runs.
  const exportAll = useAsyncAction(
    async () => {
      setProgress(null);
      try {
        return await exportAllPatientGroupsToExcel(headers, t('allFileName'), setProgress);
      } finally {
        setProgress(null);
      }
    },
    {
      onSuccess: ({ groupCount, patientCount }) => {
        if (groupCount === 0) {
          toast({ title: t('empty') });
          return;
        }
        toast({ title: t('successAll', { groups: groupCount, count: patientCount }) });
      },
      errorTitle: t('error'),
    }
  );
  const isExporting = exportAll.isPending;

  const label =
    isExporting && progress && progress.totalGroups > 0
      ? t('progress', { done: progress.done, total: progress.totalGroups })
      : t('allButton');

  return (
    <Button
      size={size}
      variant={variant}
      className="gap-1.5"
      onClick={() => exportAll.run()}
      disabled={isExporting}
      aria-busy={isExporting || undefined}
      aria-label={label}
    >
      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
