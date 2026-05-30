'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import type { AiAccessLevel, Subscription, SubscriptionType } from '@/lib/types';
import { api } from '@/services/api';
import { useLicenseStore } from '@/stores/license-store';
import { type ColumnDef } from '@tanstack/react-table';
import { CreditCard, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

// YYYY-MM-DD → DD/MM/YYYY (no timezone conversion)
function fmtDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

const SUBSCRIPTION_TYPE_LABELS: Record<SubscriptionType, string> = {
  monthly: 'Mensual',
  annual: 'Anual',
  custom: 'Personalizado',
};

const AI_ACCESS_LABELS: Record<AiAccessLevel, string> = {
  full: 'Completo',
  doctors_only: 'Solo doctores',
  none: 'Sin acceso',
};

function useSubscriptionColumns(
  t: ReturnType<typeof useTranslations>,
  activeLicenseId: string | undefined,
): ColumnDef<Subscription>[] {
  return React.useMemo(
    () => [
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) =>
          row.original.licenseId === activeLicenseId ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-0">
              Activa
            </Badge>
          ) : null,
      },
      {
        accessorKey: 'licenseId',
        header: t('SubscriptionsPage.columns.licenseId'),
        cell: ({ row }) => (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {row.original.licenseId.slice(0, 8)}…
          </code>
        ),
      },
      {
        accessorKey: 'subscriptionType',
        header: t('SubscriptionsPage.columns.type'),
        cell: ({ row }) => (
          <Badge variant="outline">{SUBSCRIPTION_TYPE_LABELS[row.original.subscriptionType]}</Badge>
        ),
      },
      {
        accessorKey: 'startDate',
        header: t('SubscriptionsPage.columns.startDate'),
        cell: ({ row }) => fmtDate(row.original.startDate),
      },
      {
        accessorKey: 'endDate',
        header: t('SubscriptionsPage.columns.endDate'),
        cell: ({ row }) => {
          const daysLeft = Math.ceil(
            (new Date(row.original.endDate).getTime() - Date.now()) / 86_400_000,
          );
          return (
            <span
              className={
                daysLeft <= 0
                  ? 'text-destructive font-medium'
                  : daysLeft <= 5
                  ? 'text-yellow-600 font-medium'
                  : ''
              }
            >
              {fmtDate(row.original.endDate)}
              {daysLeft <= 0 ? ' (exp.)' : daysLeft <= 30 ? ` (${daysLeft}d)` : ''}
            </span>
          );
        },
      },
      {
        accessorKey: 'maxDoctors',
        header: t('SubscriptionsPage.columns.maxDoctors'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.maxDoctors}</span>,
      },
      {
        accessorKey: 'maxReceptionists',
        header: t('SubscriptionsPage.columns.maxReceptionists'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.maxReceptionists}</span>,
      },
      {
        accessorKey: 'maxAdmins',
        header: t('SubscriptionsPage.columns.maxAdmins'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.maxAdmins}</span>,
      },
      {
        accessorKey: 'maxMonthlyNewPatients',
        header: t('SubscriptionsPage.columns.maxMonthlyPatients'),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.maxMonthlyNewPatients}</span>
        ),
      },
      {
        accessorKey: 'aiAccess',
        header: t('SubscriptionsPage.columns.aiAccess'),
        cell: ({ row }) => (
          <Badge variant="secondary">{AI_ACCESS_LABELS[row.original.aiAccess]}</Badge>
        ),
      },
      {
        accessorKey: 'issuedAt',
        header: t('SubscriptionsPage.columns.issuedAt'),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {fmtDate(row.original.issuedAt)}
          </span>
        ),
      },
    ],
    [t, activeLicenseId],
  );
}

// Map snake_case API response to camelCase Subscription type
function mapSubscription(raw: Record<string, unknown>): Subscription {
  return {
    id:                      String(raw.id ?? ''),
    licenseId:               String(raw.license_id ?? raw.licenseId ?? ''),
    subscriptionType:        (raw.subscription_type ?? raw.subscriptionType ?? 'custom') as SubscriptionType,
    startDate:               String(raw.start_date ?? raw.startDate ?? ''),
    endDate:                 String(raw.end_date ?? raw.endDate ?? ''),
    maxDoctors:              Number(raw.max_doctors ?? raw.maxDoctors ?? 0),
    maxReceptionists:        Number(raw.max_receptionists ?? raw.maxReceptionists ?? 0),
    maxAdmins:               Number(raw.max_admins ?? raw.maxAdmins ?? 0),
    maxSuperAdmins:          Number(raw.max_super_admins ?? raw.maxSuperAdmins ?? 0),
    maxMonthlyNewPatients:   Number(raw.max_monthly_new_patients ?? raw.maxMonthlyNewPatients ?? 0),
    aiAccess:                (raw.ai_access ?? raw.aiAccess ?? 'none') as AiAccessLevel,
    notes:                   raw.notes ? String(raw.notes) : undefined,
    issuedAt:                String(raw.issued_at ?? raw.issuedAt ?? ''),
    createdAt:               String(raw.created_at ?? raw.createdAt ?? ''),
  };
}

export default function SubscriptionsPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const activeLicenseId = useLicenseStore(s => s.license?.licenseId);
  const columns = useSubscriptionColumns(t, activeLicenseId);

  const [subscriptions, setSubscriptions] = React.useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get(API_ROUTES.SUBSCRIPTIONS.LIST);
      const rows: Record<string, unknown>[] = Array.isArray(data) ? data : (data?.subscriptions ?? []);
      setSubscriptions(rows.map(mapSubscription));
    } catch {
      toast({ title: 'Error al cargar suscripciones', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
    <div className="w-full h-full flex flex-col gap-4 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">{t('SubscriptionsPage.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('SubscriptionsPage.description')}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardContent className="pt-4 flex-1 min-h-0 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Cargando suscripciones…
            </div>
          ) : (
            <DataTable columns={columns} data={subscriptions} />
          )}
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
