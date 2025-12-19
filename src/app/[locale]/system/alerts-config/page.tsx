
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export default function AlertsConfigPage() {
  const t = useTranslations('AlertsConfigPage');
  const { toast } = useToast();

  const handleSaveChanges = () => {
    toast({
      title: t('toast.saveSuccessTitle'),
      description: t('toast.saveSuccessDescription'),
    });
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
                  <Switch id="enable-scheduler" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="execution-time">{t('scheduler.executionTime')}</Label>
                    <Input id="execution-time" type="time" defaultValue="06:00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">{t('scheduler.timezone')}</Label>
                    <Select defaultValue="America/Montevideo">
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
                  <Select defaultValue="smtp">
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
                    <Input id="smtp-server" placeholder="smtp.example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-port">{t('email.port')}</Label>
                    <Input id="smtp-port" type="number" placeholder="587" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-user">{t('email.username')}</Label>
                  <Input id="smtp-user" placeholder="user@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-pass">{t('email.password')}</Label>
                  <Input id="smtp-pass" type="password" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sender-email">{t('email.defaultSenderEmail')}</Label>
                    <Input id="sender-email" placeholder="no-reply@clinic.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sender-name">{t('email.defaultSenderName')}</Label>
                    <Input id="sender-name" placeholder="Clinic Name" />
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
                  <Switch id="enable-sms" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sms-provider">{t('sms.provider')}</Label>
                  <Select defaultValue="twilio">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="nexmo">Nexmo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sms-sid">{t('sms.apiKey')}</Label>
                  <Input id="sms-sid" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sms-token">{t('sms.apiSecret')}</Label>
                  <Input id="sms-token" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sender-number">{t('sms.senderNumber')}</Label>
                  <Input id="sender-number" placeholder="+15017122661" />
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
                  <Input id="alert-retention" type="number" defaultValue="90" />
                  <p className="text-sm text-muted-foreground">{t('retention.days')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comm-log-retention">{t('retention.communicationLogs')}</Label>
                  <Input id="comm-log-retention" type="number" defaultValue="180" />
                  <p className="text-sm text-muted-foreground">{t('retention.days')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exec-log-retention">{t('retention.executionLogs')}</Label>
                  <Input id="exec-log-retention" type="number" defaultValue="30" />
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
