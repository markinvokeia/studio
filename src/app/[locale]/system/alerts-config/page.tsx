
'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { api, isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { AlertTriangle, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const DEFAULT_ALERT_CONFIG = {
  scheduler: {
    enabled: false,
    executionTime: '06:00',
    timezone: 'America/Montevideo',
  },
  retention: {
    alerts: 90,
    communicationLogs: 180,
    executionLogs: 30,
  },
};

type AlertConfig = typeof DEFAULT_ALERT_CONFIG;

export default function AlertsConfigPage() {
  const t = useTranslations('AlertsConfigPage');
  const tCommon = useTranslations('Common');
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  const canUpdate = hasPermission(SYSTEM_PERMISSIONS.ALERT_CONFIG_UPDATE);

  // Configuration state (editable copy of what the server returned)
  const [config, setConfig] = React.useState<AlertConfig>(DEFAULT_ALERT_CONFIG);
  const [isRunNowOpen, setIsRunNowOpen] = React.useState(false);

  // A failed load no longer falls back to the defaults: saving those would silently overwrite the
  // real configuration (e.g. turning the nightly scheduler off).
  const { data: loadedConfig, isLoading, isRefreshing, error: loadError, reload } = useDataLoader(
    async (signal) => {
      const response = await api.get(API_ROUTES.SYSTEM.ALERT_CONFIG_WEBHOOK, undefined, undefined, { signal });
      return (response ?? DEFAULT_ALERT_CONFIG) as AlertConfig;
    },
    DEFAULT_ALERT_CONFIG
  );

  React.useEffect(() => {
    setConfig(loadedConfig);
  }, [loadedConfig]);

  // Runs the rules and may email/message patients: confirmed first and locked against double clicks.
  const runSchedulerNow = useAsyncAction(
    () => api.post(API_ROUTES.SYSTEM.ALERT_SCHEDULER_RUN, {}, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.longRunning }),
    {
      onSuccess: () => {
        setIsRunNowOpen(false);
        toast({
          title: t('scheduler.runNowSuccessTitle'),
          description: t('scheduler.runNowSuccessDescription'),
        });
      },
      // After a timeout the run may still be going on: never offer an automatic retry.
      onError: (error) => { if (isTimeoutError(error)) setIsRunNowOpen(false); },
      errorTitle: t('scheduler.runNowErrorTitle'),
    }
  );

  const save = useAsyncAction(
    async (values: AlertConfig) => {
      const sanitizedConfig = {
        scheduler: values.scheduler,
        retention: values.retention,
      };
      await api.post(API_ROUTES.SYSTEM.ALERT_CONFIG_WEBHOOK, sanitizedConfig, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    },
    {
      onSuccess: () => {
        toast({
          title: t('toast.saveSuccessTitle'),
          description: t('toast.saveSuccessDescription'),
        });
      },
      // The change may have been applied before the timeout: show the real state.
      onError: (error) => { if (isTimeoutError(error)) reload(); },
      errorTitle: t('toast.saveErrorTitle'),
    }
  );

  const isEditable = canUpdate && !save.isPending;

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-1">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 p-1">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('loadError')}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{loadError}</span>
            <Button size="sm" variant="outline" onClick={() => reload()} loading={isRefreshing}>
              {tCommon('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-6 p-1">
      <Card className="shadow-sm border-0">
        <CardHeader className="p-4">
          <div className="flex items-start gap-3">
            <div className="header-icon-circle mt-0.5">
              <Settings className="h-5 w-5" />
            </div>
            <div className="flex flex-col text-left">
              <CardTitle className="text-lg">{t('title')}</CardTitle>
              <CardDescription className="text-xs">{t('description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Accordion type="single" collapsible defaultValue="item-1" className="w-full space-y-4">
        <AccordionItem value="item-1">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <CardTitle>{t('scheduler.title')}</CardTitle>
                <CardDescription>{t('scheduler.description')}</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="space-y-4 pt-0 bg-card">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable-scheduler">{t('scheduler.enable')}</Label>
                    <p className="text-sm text-muted-foreground">{t('scheduler.enableDescription')}</p>
                  </div>
                  <Switch
                    id="enable-scheduler"
                    disabled={!isEditable}
                    checked={config.scheduler.enabled}
                    onCheckedChange={(checked) => setConfig(prev => ({
                      ...prev,
                      scheduler: { ...prev.scheduler, enabled: checked }
                    }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="execution-time">{t('scheduler.executionTime')}</Label>
                    <Input
                      id="execution-time"
                      type="time"
                      disabled={!isEditable}
                      value={config.scheduler.executionTime}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        scheduler: { ...prev.scheduler, executionTime: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">{t('scheduler.timezone')}</Label>
                    <Select
                      disabled={!isEditable}
                      value={config.scheduler.timezone}
                      onValueChange={(value) => setConfig(prev => ({
                        ...prev,
                        scheduler: { ...prev.scheduler, timezone: value }
                      }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Montevideo">America/Montevideo (GMT-3)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {canUpdate && (
                  <Button variant="outline" onClick={() => setIsRunNowOpen(true)} disabled={runSchedulerNow.isPending} loading={runSchedulerNow.isPending}>
                    {t('scheduler.runNow')}
                  </Button>
                )}
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-4">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <CardTitle>{t('retention.title')}</CardTitle>
                <CardDescription>{t('retention.description')}</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="space-y-4 pt-0 bg-card">
                <div className="space-y-2">
                  <Label htmlFor="alert-retention">{t('retention.alerts')}</Label>
                  <Input
                    id="alert-retention"
                    type="number"
                    disabled={!isEditable}
                    value={config.retention.alerts}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      retention: { ...prev.retention, alerts: parseInt(e.target.value) || 0 }
                    }))}
                  />
                  <p className="text-sm text-muted-foreground">{t('retention.days')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comm-log-retention">{t('retention.communicationLogs')}</Label>
                  <Input
                    id="comm-log-retention"
                    type="number"
                    disabled={!isEditable}
                    value={config.retention.communicationLogs}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      retention: { ...prev.retention, communicationLogs: parseInt(e.target.value) || 0 }
                    }))}
                  />
                  <p className="text-sm text-muted-foreground">{t('retention.days')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exec-log-retention">{t('retention.executionLogs')}</Label>
                  <Input
                    id="exec-log-retention"
                    type="number"
                    disabled={!isEditable}
                    value={config.retention.executionLogs}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      retention: { ...prev.retention, executionLogs: parseInt(e.target.value) || 0 }
                    }))}
                  />
                  <p className="text-sm text-muted-foreground">{t('retention.days')}</p>
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>

      <div className="flex justify-end">
        {canUpdate && <Button onClick={() => save.run(config)} loading={save.isPending}>{t('saveChanges')}</Button>}
      </div>

      <ConfirmActionDialog
        open={isRunNowOpen}
        onOpenChange={setIsRunNowOpen}
        title={t('scheduler.runNowConfirm.title')}
        description={t('scheduler.runNowConfirm.description')}
        cancelLabel={t('scheduler.runNowConfirm.cancel')}
        confirmLabel={t('scheduler.runNow')}
        onConfirm={() => runSchedulerNow.run()}
        isPending={runSchedulerNow.isPending}
        destructive={false}
      />
    </div>
  );
}
