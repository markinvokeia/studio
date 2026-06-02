'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { LICENSING_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import type { AiAccessLevel, CreateLicenseInput, LicensePayload, SubscriptionType } from '@/lib/types';
import { api } from '@/services/api';
import { useLicenseStore } from '@/stores/license-store';
import { decryptLicense } from '@/lib/license-crypto';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircle,
  ClipboardCopy,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

// Access password — must match NEXT_PUBLIC_MASTER_SEC in .env.local
const MASTER_SEC = process.env.NEXT_PUBLIC_MASTER_SEC ?? '';
// AES-256-GCM key used to encrypt/decrypt license blobs
const LICENSE_KEY = process.env.NEXT_PUBLIC_LICENSE_KEY ?? '';

const licenseFormSchema = z.object({
  subscriptionType: z.enum(['monthly', 'annual', 'custom'] as const),
  startDate: z.string().min(1, 'Requerido'),
  endDate: z.string().min(1, 'Requerido'),
  maxDoctors: z.coerce.number().int().min(0),
  maxReceptionists: z.coerce.number().int().min(0),
  maxAdmins: z.coerce.number().int().min(0),
  maxSuperAdmins: z.coerce.number().int().min(0),
  maxMonthlyNewPatients: z.coerce.number().int().min(0),
  aiAccess: z.enum(['full', 'doctors_only', 'none'] as const),
  notes: z.string().optional(),
});

type LicenseFormValues = z.infer<typeof licenseFormSchema>;

const AI_ACCESS_LABELS: Record<AiAccessLevel, string> = {
  full: 'Completo',
  doctors_only: 'Solo doctores',
  none: 'Sin acceso',
};

const SUBSCRIPTION_TYPE_LABELS: Record<SubscriptionType, string> = {
  monthly: 'Mensual',
  annual: 'Anual',
  custom: 'Personalizado',
};

function LicenseAttributeRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function CurrentLicenseCard({ license, daysLeft }: { license: LicensePayload; daysLeft: number }) {
  const t = useTranslations('License');
  const isExpired = daysLeft <= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          {t('management.currentLicense')}
        </CardTitle>
        <CardDescription>
          ID: <code className="text-xs bg-muted px-1 py-0.5 rounded">{license.licenseId}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <LicenseAttributeRow
          label={t('management.subscriptionType')}
          value={<Badge variant="outline">{SUBSCRIPTION_TYPE_LABELS[license.subscriptionType]}</Badge>}
        />
        <Separator />
        <LicenseAttributeRow label={t('management.startDate')} value={license.startDate} />
        <LicenseAttributeRow
          label={t('management.endDate')}
          value={
            <span className={isExpired ? 'text-destructive font-semibold' : daysLeft <= 5 ? 'text-yellow-600 font-semibold' : ''}>
              {license.endDate} ({isExpired ? 'Expirada' : `${daysLeft}d restantes`})
            </span>
          }
        />
        <Separator />
        <LicenseAttributeRow label={t('management.maxDoctors')} value={license.maxDoctors} />
        <LicenseAttributeRow label={t('management.maxReceptionists')} value={license.maxReceptionists} />
        <LicenseAttributeRow label={t('management.maxAdmins')} value={license.maxAdmins} />
        <LicenseAttributeRow label={t('management.maxSuperAdmins')} value={license.maxSuperAdmins} />
        <Separator />
        <LicenseAttributeRow
          label={t('management.maxMonthlyNewPatients')}
          value={license.maxMonthlyNewPatients}
        />
        <LicenseAttributeRow
          label={t('management.aiAccess')}
          value={<Badge variant="secondary">{AI_ACCESS_LABELS[license.aiAccess]}</Badge>}
        />
        {license.notes && (
          <>
            <Separator />
            <LicenseAttributeRow label={t('management.notes')} value={license.notes} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function LicensesPage() {
  const t = useTranslations('License');
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const { license, licenseKey, daysLeft, loadLicense, generateLicense } = useLicenseStore();

  // Step 1: password gate
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [secInput, setSecInput] = React.useState('');
  const [secError, setSecError] = React.useState('');

  // Step 2: license loading
  const [isFetchingLicense, setIsFetchingLicense] = React.useState(false);

  // Step 3: form state
  const [generatedKey, setGeneratedKey] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const canGenerate = hasPermission(LICENSING_PERMISSIONS.GENERATE);

  // Once unlocked, fetch the license from backend and load it into the store
  React.useEffect(() => {
    if (!isUnlocked || !LICENSE_KEY) return;
    async function fetchLicense() {
      setIsFetchingLicense(true);
      try {
        const data = await api.get(API_ROUTES.LICENSE.GET);
        const blob: string | null = data?.license_key ?? null;
        if (blob) await loadLicense(blob, LICENSE_KEY);
      } catch {
        // No license stored yet — not an error
      } finally {
        setIsFetchingLicense(false);
      }
    }
    fetchLicense();
  }, [isUnlocked, loadLicense]);

  const form = useForm<LicenseFormValues>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: {
      subscriptionType: 'monthly',
      startDate: '',
      endDate: '',
      maxDoctors: 1,
      maxReceptionists: 1,
      maxAdmins: 1,
      maxSuperAdmins: 1,
      maxMonthlyNewPatients: 100,
      aiAccess: 'full',
      notes: '',
    },
  });

  // Pre-fill form for renewal: same config, startDate = previous endDate
  React.useEffect(() => {
    if (!license || !isUnlocked) return;
    form.reset({
      subscriptionType: license.subscriptionType,
      startDate: license.endDate,
      endDate: '',
      maxDoctors: license.maxDoctors,
      maxReceptionists: license.maxReceptionists,
      maxAdmins: license.maxAdmins,
      maxSuperAdmins: license.maxSuperAdmins,
      maxMonthlyNewPatients: license.maxMonthlyNewPatients,
      aiAccess: license.aiAccess,
      notes: license.notes ?? '',
    });
  }, [license, isUnlocked, form]);

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!secInput.trim()) return;
    if (!MASTER_SEC) {
      setSecError('NEXT_PUBLIC_MASTER_SEC no está configurado en el servidor.');
      return;
    }
    if (secInput.trim() !== MASTER_SEC) {
      setSecError('Clave incorrecta. Intente nuevamente.');
      return;
    }
    setIsUnlocked(true);
  }

  async function onSubmit(data: LicenseFormValues) {
    setIsGenerating(true);
    try {
      const input: CreateLicenseInput = data;
      const newKey = await generateLicense(input, LICENSE_KEY);

      let newPayload: LicensePayload | null = null;
      try {
        newPayload = await decryptLicense(newKey, LICENSE_KEY);
      } catch { /* ignore */ }

      await api.post(API_ROUTES.LICENSE.SAVE, { license_key: newKey });

      if (newPayload) {
        await api.post(API_ROUTES.SUBSCRIPTIONS.CREATE, {
          license_id: newPayload.licenseId,
          subscription_type: newPayload.subscriptionType,
          start_date: newPayload.startDate,
          end_date: newPayload.endDate,
          max_doctors: newPayload.maxDoctors,
          max_receptionists: newPayload.maxReceptionists,
          max_admins: newPayload.maxAdmins,
          max_super_admins: newPayload.maxSuperAdmins,
          max_monthly_new_patients: newPayload.maxMonthlyNewPatients,
          ai_access: newPayload.aiAccess,
          notes: newPayload.notes,
          issued_at: newPayload.issuedAt,
        });
      }

      await loadLicense(newKey, LICENSE_KEY);
      setGeneratedKey(newKey);
      toast({ title: '¡Licencia generada exitosamente!' });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error al generar la licencia',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyToClipboard() {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-start gap-3">
          <div className="header-icon-circle mt-0.5">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">{t('management.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('management.description')}</p>
          </div>
        </div>

      {!isUnlocked ? (
        <div>
          <Card className="w-full max-w-md shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                Clave maestra
              </CardTitle>
              <CardDescription>
                Ingresa la clave maestra para acceder a la gestión de licencias.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUnlock} className="flex flex-col gap-3">
                <Input
                  type="password"
                  placeholder="Clave maestra..."
                  value={secInput}
                  onChange={e => { setSecInput(e.target.value); setSecError(''); }}
                  autoFocus
                />
                {secError && <p className="text-xs text-destructive">{secError}</p>}
                <Button type="submit" disabled={!secInput.trim()} className="w-full">
                  Verificar
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {isFetchingLicense ? (
            <Card>
              <CardContent className="pt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando licencia...
              </CardContent>
            </Card>
          ) : license ? (
            <CurrentLicenseCard license={license} daysLeft={daysLeft} />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">{t('management.noLicense')}</p>
              </CardContent>
            </Card>
          )}

          {canGenerate && !isFetchingLicense && (
            <Card>
              <CardHeader>
                <CardTitle>{t('management.generateNew')}</CardTitle>
                <CardDescription>
                  Los cambios se guardan en el backend y activan inmediatamente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="subscriptionType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('management.subscriptionType')}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="monthly">Mensual</SelectItem>
                                <SelectItem value="annual">Anual</SelectItem>
                                <SelectItem value="custom">Personalizado</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="aiAccess"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('management.aiAccess')}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="full">Completo</SelectItem>
                                <SelectItem value="doctors_only">Solo doctores</SelectItem>
                                <SelectItem value="none">Sin acceso</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('management.startDate')}</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('management.endDate')}</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />
                    <p className="text-sm font-medium text-muted-foreground">Límites de usuarios</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {(
                        [
                          ['maxDoctors', t('management.maxDoctors')],
                          ['maxReceptionists', t('management.maxReceptionists')],
                          ['maxAdmins', t('management.maxAdmins')],
                          ['maxSuperAdmins', t('management.maxSuperAdmins')],
                        ] as const
                      ).map(([name, label]) => (
                        <FormField
                          key={name}
                          control={form.control}
                          name={name}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{label}</FormLabel>
                              <FormControl><Input type="number" min={0} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="maxMonthlyNewPatients"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('management.maxMonthlyNewPatients')}</FormLabel>
                            <FormControl><Input type="number" min={0} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('management.notes')}</FormLabel>
                            <FormControl><Input placeholder="Notas opcionales..." {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button type="submit" disabled={isGenerating}>
                      {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isGenerating ? t('management.generating') : t('management.generate')}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {generatedKey && (
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  {t('management.generatedKey')}
                </CardTitle>
                <CardDescription>
                  Guarda esta clave en un lugar seguro. Es necesaria para gestionar licencias.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea readOnly value={generatedKey} className="font-mono text-xs min-h-24 resize-none" />
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  {copied ? t('management.keyCopied') : t('management.copyKey')}
                </Button>
              </CardContent>
            </Card>
          )}

          {licenseKey && !generatedKey && (
            <Card>
              <CardHeader>
                <CardTitle>{t('management.generatedKey')} (actual)</CardTitle>
                <CardDescription>Clave activa actualmente en el sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea readOnly value={licenseKey} className="font-mono text-xs min-h-24 resize-none" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(licenseKey);
                    toast({ title: t('management.keyCopied') });
                  }}
                >
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  {t('management.copyKey')}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
      </div>
    </div>
  );
}
