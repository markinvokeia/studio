'use client';

import { AlertTriangle, CalendarCheck, Download, ExternalLink, HelpCircle, MessageSquareText, Save, Sparkles, Video } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { QRCodeCanvas } from 'qrcode.react';
import * as React from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { AccessFlierButton } from '@/components/patient-portal/access-flier';
import { WelcomeVideo } from '@/components/patient-portal/welcome-video';

import { PATIENT_PORTAL_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { getWebhookBaseUrl } from '@/lib/runtime-config';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { REQUEST_TIMEOUT_MS, isTimeoutError } from '@/services/api';
import type { PatientPortalConfig, Service } from '@/lib/types';
import {
  DEFAULT_PATIENT_PORTAL_CONFIG,
  fetchPatientPortalConfig,
  updatePatientPortalConfig,
} from '@/services/patient-portal-config';
import { getSalesServices } from '@/services/services';

/**
 * Centinela del selector de servicio por defecto: Radix Select no acepta
 * `value=""`, y "sin servicio por defecto" es una opción legítima.
 */
const NO_DEFAULT_SERVICE = '__none__';

/**
 * Configuración → Portal del Paciente.
 *
 * Separada de Datos de la Clínica a propósito: acá viven los ajustes de
 * producto del portal de auto-servicio (si está abierto, si se puede reservar,
 * si es sólo para reservar) y no los datos fiscales o de contacto.
 */
export default function PatientsPortalConfigPage() {
  const t = useTranslations('PatientPortalConfigPage');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission(PATIENT_PORTAL_CONFIG_PERMISSIONS.UPDATE);
  const { toast } = useToast();

  const [config, setConfig] = React.useState<PatientPortalConfig>(DEFAULT_PATIENT_PORTAL_CONFIG);
  const {
    data: initial,
    setData: setInitial,
    isLoading,
    isRefreshing,
    error: loadError,
    reload,
  } = useDataLoader((signal) => fetchPatientPortalConfig({ signal }), DEFAULT_PATIENT_PORTAL_CONFIG);

  React.useEffect(() => {
    setConfig(initial);
  }, [initial]);

  /**
   * Catálogo de venta para elegir el servicio por defecto. Se ofrece el
   * catálogo completo y no sólo los `bookable_online`: el servicio por defecto
   * lo aplica la clínica, no el paciente, así que no tiene por qué estar
   * publicado para auto-agenda.
   */
  const [services, setServices] = React.useState<Service[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { items } = await getSalesServices({ limit: 500 });
      if (!cancelled) setServices(items.filter((s) => s.is_active !== false));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * URL pública del portal, sobre el origen desde el que se está navegando.
   * Se calcula en un efecto porque `window` no existe durante el render del
   * servidor y el QR quedaría con el valor equivocado en la hidratación.
   */
  const [portalUrl, setPortalUrl] = React.useState('');
  const [staffUrl, setStaffUrl] = React.useState('');
  React.useEffect(() => {
    // Ambas salen del origen actual, así el flier impreso desde staging apunta
    // a staging y el impreso desde producción, a producción.
    setPortalUrl(`${window.location.origin}/${locale}${API_ROUTES.PATIENT_LOGIN_PAGE}`);
    setStaffUrl(`${window.location.origin}/${locale}`);
  }, [locale]);

  const clinicLogoUrl = `${getWebhookBaseUrl()}${API_ROUTES.CLINIC_LOGO}`;

  const qrDownloadRef = React.useRef<HTMLCanvasElement>(null);

  const handleDownloadQr = () => {
    const canvas = qrDownloadRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'qr-portal-paciente.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const isDirty = JSON.stringify(config) !== JSON.stringify(initial);

  const patch = (values: Partial<PatientPortalConfig>) => setConfig((c) => ({ ...c, ...values }));

  const save = useAsyncAction(
    async (values: PatientPortalConfig) => {
      await updatePatientPortalConfig(values, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
      return values;
    },
    {
      onSuccess: (values) => {
        setInitial(values);
        toast({ title: t('saved') });
      },
      // El guardado pudo aplicarse antes del timeout: se relee para mostrar el estado real.
      onError: (error) => { if (isTimeoutError(error)) reload(); },
      errorTitle: t('saveError'),
    }
  );
  const canEdit = canUpdate && !save.isPending && !isRefreshing;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // Si la carga falla no se muestran los valores por defecto como si fueran los guardados:
  // guardarlos cerraría el portal o borraría el mensaje de bienvenida real.
  if (loadError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageHeader icon={<CalendarCheck className="h-5 w-5" />} title={t('title')} description={t('description')} />
        <Alert variant="destructive" className="m-1">
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
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageHeader
          icon={<CalendarCheck className="h-5 w-5" />}
          title={t('title')}
          description={t('description')}
          actions={
            canUpdate ? (
              <Button onClick={() => save.run(config)} disabled={!isDirty || isRefreshing} loading={save.isPending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {t('save')}
              </Button>
            ) : null
          }
        />

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-1 pb-6">
          {/* ── Acceso ─────────────────────────────────────────────────── */}
          <Card>
            <CardContent className="p-5">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
                <div className="space-y-4">
              <SettingRow
                label={t('fields.enabled.label')}
                help={t('fields.enabled.help')}
                control={
                  <Switch
                    checked={config.patient_portal_enabled}
                    disabled={!canEdit}
                    onCheckedChange={(v) => patch({ patient_portal_enabled: v })}
                  />
                }
              />

              <SettingRow
                label={t('fields.onlineBooking.label')}
                help={t('fields.onlineBooking.help')}
                disabled={!config.patient_portal_enabled}
                control={
                  <Switch
                    checked={config.online_booking_enabled}
                    disabled={!canEdit || !config.patient_portal_enabled}
                    onCheckedChange={(v) =>
                      // Sin reserva online no tiene sentido el modo "sólo citas".
                      patch({ online_booking_enabled: v, appointments_only: v ? config.appointments_only : false })
                    }
                  />
                }
              />

              <SettingRow
                label={t('fields.appointmentsOnly.label')}
                help={t('fields.appointmentsOnly.help')}
                disabled={!config.patient_portal_enabled || !config.online_booking_enabled}
                control={
                  <Switch
                    checked={config.appointments_only}
                    disabled={!canEdit || !config.patient_portal_enabled || !config.online_booking_enabled}
                    onCheckedChange={(v) => patch({ appointments_only: v })}
                  />
                }
              />

              {config.appointments_only && (
                <p className="rounded-xl bg-primary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  {t('fields.appointmentsOnly.activeNotice')}
                </p>
              )}
                </div>

                {/* El QR sólo tiene sentido si el portal está abierto: si no,
                    quien lo escanee se encuentra con el aviso de no disponible. */}
                {config.patient_portal_enabled && portalUrl && (
                  <div className="flex flex-col items-center justify-center gap-2 lg:border-l lg:pl-6">
                    <div className="rounded-xl bg-white p-3">
                      {/* Fondo blanco fijo: en modo oscuro un QR sobre superficie
                          oscura no lo lee ningún teléfono. */}
                      <QRCodeCanvas value={portalUrl} size={128} level="M" marginSize={0} />
                    </div>
                    <p className="max-w-[10rem] break-all text-center text-[10px] leading-tight text-muted-foreground">
                      {portalUrl}
                    </p>
                    <div className="flex items-center gap-3">
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {t('qr.test')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <span aria-hidden className="text-muted-foreground/40">|</span>
                      <button
                        type="button"
                        onClick={handleDownloadQr}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {t('qr.download')}
                        <Download className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Flier de dos páginas: una para el personal y otra para
                        los pacientes, con los accesos de este mismo entorno. */}
                    {staffUrl && (
                      <AccessFlierButton
                        staffUrl={staffUrl}
                        patientUrl={portalUrl}
                        clinicLogoUrl={clinicLogoUrl}
                        clinicName={t('title')}
                      />
                    )}

                    {/* Copia de 1024 px fuera de pantalla: es la que se descarga,
                        para que sirva impresa en un flyer o un cartel. */}
                    <div aria-hidden className="pointer-events-none absolute -left-[9999px] top-0">
                      <QRCodeCanvas ref={qrDownloadRef} value={portalUrl} size={1024} level="M" marginSize={2} />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Servicios de la reserva ────────────────────────────────── */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <SettingRow
                label={t('fields.serviceSelection.label')}
                help={t('fields.serviceSelection.help')}
                disabled={!config.patient_portal_enabled || !config.online_booking_enabled}
                control={
                  <Switch
                    checked={config.service_selection_enabled}
                    disabled={!canEdit || !config.patient_portal_enabled || !config.online_booking_enabled}
                    onCheckedChange={(v) => patch({ service_selection_enabled: v })}
                  />
                }
              />

              <div className="space-y-2">
                <FieldLabel
                  htmlFor="default-service"
                  icon={Sparkles}
                  label={t('fields.defaultService.label')}
                  help={t('fields.defaultService.help')}
                />
                <Select
                  value={config.default_service_id || NO_DEFAULT_SERVICE}
                  disabled={!canEdit}
                  onValueChange={(v) =>
                    patch({ default_service_id: v === NO_DEFAULT_SERVICE ? '' : v })
                  }
                >
                  <SelectTrigger id="default-service" className="max-w-sm">
                    <SelectValue placeholder={t('fields.defaultService.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Radix no admite `value=""`, así que el "sin servicio" va
                        con un centinela que se traduce a cadena vacía al guardar. */}
                    <SelectItem value={NO_DEFAULT_SERVICE}>
                      {t('fields.defaultService.none')}
                    </SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('fields.defaultService.hint')}</p>
              </div>

              <SettingRow
                label={t('fields.showPricing.label')}
                help={t('fields.showPricing.help')}
                disabled={!config.patient_portal_enabled}
                control={
                  <Switch
                    checked={config.show_pricing}
                    disabled={!canEdit || !config.patient_portal_enabled}
                    onCheckedChange={(v) => patch({ show_pricing: v })}
                  />
                }
              />
            </CardContent>
          </Card>

          {/* ── Presentación ───────────────────────────────────────────── */}
          <Card>
            <CardContent className="space-y-5 p-5">
              <div className="space-y-2">
                <FieldLabel
                  htmlFor="welcome-video"
                  icon={Video}
                  label={t('fields.video.label')}
                  help={t('fields.video.help')}
                />
                <Input
                  id="welcome-video"
                  value={config.welcome_video_url}
                  disabled={!canEdit}
                  placeholder={t('fields.video.placeholder')}
                  onChange={(e) => patch({ welcome_video_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{t('fields.video.hint')}</p>

                {/* Vista previa: es la única forma de que quien pega el link
                    verifique que el video efectivamente se reproduce. */}
                {config.welcome_video_url.trim() && (
                  <div className="max-w-md pt-1">
                    <WelcomeVideo
                      url={config.welcome_video_url}
                      title={t('fields.video.label')}
                      emptyLabel={t('fields.video.unsupported')}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <FieldLabel
                  htmlFor="welcome-message"
                  icon={MessageSquareText}
                  label={t('fields.message.label')}
                  help={t('fields.message.help')}
                />
                <Textarea
                  id="welcome-message"
                  rows={3}
                  className="resize-none"
                  value={config.welcome_message}
                  disabled={!canEdit}
                  placeholder={t('fields.message.placeholder')}
                  onChange={(e) => patch({ welcome_message: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{t('fields.message.hint')}</p>
              </div>
            </CardContent>
          </Card>

          {!canUpdate && (
            <p className="px-1 text-xs text-muted-foreground">{t('readOnlyNotice')}</p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ── Piezas de presentación ───────────────────────────────────────────────────

/** Icono de ayuda con la explicación de para qué sirve el campo. */
function HelpTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={text}>
          <HelpCircle className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

function SettingRow({
  label,
  help,
  control,
  disabled,
}: {
  label: string;
  help: string;
  control: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <HelpTip text={help} />
      </div>
      {control}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  icon: Icon,
  label,
  help,
}: {
  htmlFor: string;
  icon: React.ElementType;
  label: string;
  help: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      <HelpTip text={help} />
    </div>
  );
}
