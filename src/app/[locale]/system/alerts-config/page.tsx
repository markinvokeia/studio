
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export default function AlertsConfigPage() {
  const t = useTranslations('AlertsConfigPage');
  const { toast } = useToast();

  // Configuration state
  const [config, setConfig] = React.useState({
    scheduler: {
      enabled: false,
      executionTime: '06:00',
      timezone: 'America/Montevideo',
    },
    email: {
      provider: 'smtp',
      server: '',
      port: '',
      username: '',
      password: '',
      senderEmail: '',
      senderName: '',
    },
    sms: {
      enabled: false,
      provider: 'twilio',
      apiKey: '',
      apiSecret: '',
      senderNumber: '',
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

  const handleSaveChanges = async () => {
    try {
      const sanitizedConfig = {
        scheduler: config.scheduler,
        email: config.email,
        sms: config.sms,
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
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
              <CardContent className="space-y-4 pt-0">
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
                <Button variant="outline">{t('scheduler.runNow')}</Button>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-2">
           <Card>
            <AccordionTrigger className="p-6">
                <CardHeader className="p-0 text-left">
                    <CardTitle>{t('email.title')}</CardTitle>
                    <CardDescription>{t('email.description')}</CardDescription>
                </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="space-y-4 pt-0">
                 <div className="space-y-2">
                   <Label htmlFor="email-provider">{t('email.provider')}</Label>
                   <Select
                     value={config.email.provider}
                     onValueChange={(value) => setConfig(prev => ({
                       ...prev,
                       email: { ...prev.email, provider: value }
                     }))}
                   >
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="smtp">SMTP</SelectItem>
                       <SelectItem value="sendgrid">SendGrid</SelectItem>
                       <SelectItem value="ses">Amazon SES</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label htmlFor="smtp-server">{t('email.server')}</Label>
                     <Input
                       id="smtp-server"
                       placeholder="smtp.example.com"
                       value={config.email.server}
                       onChange={(e) => setConfig(prev => ({
                         ...prev,
                         email: { ...prev.email, server: e.target.value }
                       }))}
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="smtp-port">{t('email.port')}</Label>
                     <Input
                       id="smtp-port"
                       type="number"
                       placeholder="587"
                       value={config.email.port}
                       onChange={(e) => setConfig(prev => ({
                         ...prev,
                         email: { ...prev.email, port: e.target.value }
                       }))}
                     />
                   </div>
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="smtp-user">{t('email.username')}</Label>
                   <Input
                     id="smtp-user"
                     placeholder="user@example.com"
                     value={config.email.username}
                     onChange={(e) => setConfig(prev => ({
                       ...prev,
                       email: { ...prev.email, username: e.target.value }
                     }))}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="smtp-pass">{t('email.password')}</Label>
                   <Input
                     id="smtp-pass"
                     type="password"
                     value={config.email.password}
                     onChange={(e) => setConfig(prev => ({
                       ...prev,
                       email: { ...prev.email, password: e.target.value }
                     }))}
                   />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label htmlFor="sender-email">{t('email.defaultSenderEmail')}</Label>
                     <Input
                       id="sender-email"
                       placeholder="no-reply@clinic.com"
                       value={config.email.senderEmail}
                       onChange={(e) => setConfig(prev => ({
                         ...prev,
                         email: { ...prev.email, senderEmail: e.target.value }
                       }))}
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="sender-name">{t('email.defaultSenderName')}</Label>
                     <Input
                       id="sender-name"
                       placeholder="Clinic Name"
                       value={config.email.senderName}
                       onChange={(e) => setConfig(prev => ({
                         ...prev,
                         email: { ...prev.email, senderName: e.target.value }
                       }))}
                     />
                   </div>
                 </div>
                <Button variant="outline">{t('email.sendTest')}</Button>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-3">
          <Card>
            <AccordionTrigger className="p-6">
                <CardHeader className="p-0 text-left">
                  <CardTitle>{t('sms.title')}</CardTitle>
                  <CardDescription>{t('sms.description')}</CardDescription>
                </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="space-y-4 pt-0">
                 <div className="flex items-center justify-between rounded-lg border p-4">
                   <div className="space-y-0.5">
                     <Label htmlFor="enable-sms">{t('sms.enable')}</Label>
                   </div>
                   <Switch
                     id="enable-sms"
                     checked={config.sms.enabled}
                     onCheckedChange={(checked) => setConfig(prev => ({
                       ...prev,
                       sms: { ...prev.sms, enabled: checked }
                     }))}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="sms-provider">{t('sms.provider')}</Label>
                   <Select
                     value={config.sms.provider}
                     onValueChange={(value) => setConfig(prev => ({
                       ...prev,
                       sms: { ...prev.sms, provider: value }
                     }))}
                   >
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="twilio">Twilio</SelectItem>
                       <SelectItem value="nexmo">Nexmo</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="sms-sid">{t('sms.apiKey')}</Label>
                   <Input
                     id="sms-sid"
                     placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxx"
                     value={config.sms.apiKey}
                     onChange={(e) => setConfig(prev => ({
                       ...prev,
                       sms: { ...prev.sms, apiKey: e.target.value }
                     }))}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="sms-token">{t('sms.apiSecret')}</Label>
                   <Input
                     id="sms-token"
                     type="password"
                     value={config.sms.apiSecret}
                     onChange={(e) => setConfig(prev => ({
                       ...prev,
                       sms: { ...prev.sms, apiSecret: e.target.value }
                     }))}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="sender-number">{t('sms.senderNumber')}</Label>
                   <Input
                     id="sender-number"
                     placeholder="+15017122661"
                     value={config.sms.senderNumber}
                     onChange={(e) => setConfig(prev => ({
                       ...prev,
                       sms: { ...prev.sms, senderNumber: e.target.value }
                     }))}
                   />
                 </div>
                <Button variant="outline">{t('sms.sendTest')}</Button>
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
              <CardContent className="space-y-4 pt-0">
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
        <Button onClick={handleSaveChanges}>{t('saveChanges')}</Button>
      </div>
    </div>
  );
}
