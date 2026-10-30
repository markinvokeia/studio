'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Can } from '@/components/auth/Can';
import { CurrencySwitcher } from '@/components/reports/currency-switcher';
import { DateRangePresets } from '@/components/reports/date-range-presets';

import { useAuth } from '@/context/AuthContext';
import { useDashboardFilters } from '@/context/DashboardFiltersContext';
import { formatDisplayDateWithWeekday } from '@/lib/utils';

import { DASHBOARD_PERMISSIONS } from '@/constants/permissions';
import { Building2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

const CONSOLIDATED = '__all__';

interface DashboardFilterBarProps {
  /** Fecha del servidor (`fecha_servidor` del resumen ejecutivo), no la del navegador. */
  serverDate?: string;
}

export function DashboardFilterBar({ serverDate }: DashboardFilterBarProps) {
  const t = useTranslations('DashboardGerencial');
  const locale = useLocale();
  const { sedes } = useAuth();
  const { sedeId, setSedeId, dateRange, setDateRange, currency, setCurrency } = useDashboardFilters();

  const activeSedeName = sedes.find((s) => s.id === sedeId)?.name ?? t('consolidated');
  const subtitle = [activeSedeName, serverDate ? formatDisplayDateWithWeekday(serverDate, locale) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="mr-auto min-w-0">
        <h1 className="text-xl font-black leading-tight tracking-tight">{t('title')}</h1>
        <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{subtitle}</p>
      </div>

      <Can permission={DASHBOARD_PERMISSIONS.VIEW_BY_BRANCH}>
        <Select
          value={sedeId ?? CONSOLIDATED}
          onValueChange={(v) => setSedeId(v === CONSOLIDATED ? null : v)}
        >
          <SelectTrigger className="h-8 w-auto gap-1.5 text-xs font-medium" aria-label={t('branch')}>
            <Building2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CONSOLIDATED}>{t('consolidated')}</SelectItem>
            {sedes.map((sede) => (
              <SelectItem key={sede.id} value={sede.id}>
                {sede.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Can>

      <DateRangePresets value={dateRange} onChange={setDateRange} />

      <CurrencySwitcher value={currency} onChange={setCurrency} />
    </div>
  );
}
