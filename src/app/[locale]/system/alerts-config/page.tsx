
'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { api } from '@/services/api';
import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export default function AlertsConfigPage() {
  const t = useTranslations('AlertsConfigPage');
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  const canView = hasPermission(SYSTEM_PERMISSIONS.ALERT_CONFIG_VIEW);
  const canUpdate = hasPermission(SYSTEM_PERMISSIONS.ALERT_CONFIG_UPDATE);

  // Configuration state
  const [config, setConfig] = React.useState({
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
  });

  // Load configuration on mount
  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_CONFIG_WEBHOOK);
        if (response) {
          setConfig(response);
        }
      } catch (error) {
        console.error('Error loading configuration:', error);
        // Use default values if loading fails
      }
    };
    loadConfig();
  }, []);

  const handleRunSchedulerNow = async () => {
    try {
      await api.post('/system/alert-scheduler', {});
      toast({
        title: t('scheduler.runNowSuccessTitle'),
        description: t('scheduler.runNowSuccessDescription'),
      });
    } catch (error) {
      console.error('Error running scheduler:', error);
      toast({
        title: t('scheduler.runNowErrorTitle'),
        description: t('scheduler.runNowErrorDescription'),
        variant: 'destructive',
      });
    }
  };

  const handleSaveChanges = async () => {
    try {
      const sanitizedConfig = {
        scheduler: config.scheduler,
        retention: config.retention,
      };
      await api.post(API_ROUTES.SYSTEM.ALERT_CONFIG_WEBHOOK, sanitizedConfig);
      toast({
        title: t('toast.saveSuccessTitle'),
        description: t('toast.saveSuccessDescription'),
      });
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: t('toast.saveErrorTitle'),
        description: t('toast.saveErrorDescription'),
        variant: 'destructive',
      });
    }
  };

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
                <Button variant="outline" onClick={handleRunSchedulerNow}>{t('scheduler.runNow')}</Button>
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
        {canUpdate && <Button onClick={handleSaveChanges}>{t('saveChanges')}</Button>}
      </div>
    </div>
  );
}
