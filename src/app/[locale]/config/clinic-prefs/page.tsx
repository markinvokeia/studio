'use client';

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CalendarOff,
  CalendarSync,
  Copy,
  FileText,
  HelpCircle,
  Mail,
  Percent,
  Sparkles,
  Save,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { CLINIC_PREFS_PERMISSIONS } from '@/constants/permissions';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { REQUEST_TIMEOUT_MS, isTimeoutError } from '@/services/api';
import type { AppointmentStatus, ClinicAutomationSettings, ClinicPreferences, DiscountScope, GoogleCalendarSyncMode } from '@/lib/types';
import { APPOINTMENT_STATUSES } from '@/constants/appointment-status';
import {
  DEFAULT_CLINIC_PREFERENCES,
  fetchClinicPreferences,
  updateClinicPreferences,
} from '@/services/clinic-preferences';
import {
  DEFAULT_CLINIC_AUTOMATION_SETTINGS,
  fetchClinicAutomationSettings,
  GOOGLE_CALENDAR_SYNC_MODES,
  updateClinicAutomationSettings,
} from '@/services/system-config';
import { useClinicPreferencesStore } from '@/stores/clinic-preferences-store';
import { useHelpAssistant } from '@/stores/help-assistant-store';

const SYNC_MODE_ICONS: Record<GoogleCalendarSyncMode, LucideIcon> = {
  none: CalendarOff,
  from_google: ArrowDownToLine,
  to_google: ArrowUpFromLine,
  both: ArrowLeftRight,
};

/**
 * Estados que pueden exigir documento de identidad. Sin `cancelled`: bloquear
 * una cancelación no tiene sentido y frenaría al paciente en el portal.
 */
const WARNABLE_STATUSES: AppointmentStatus[] = APPOINTMENT_STATUSES.filter((s) => s !== 'cancelled');
const DEFAULT_WARN_STATUSES: AppointmentStatus[] = ['completed'];

/** Falló el segundo paso del guardado: las preferencias ya quedaron guardadas. */
class PartialSaveError extends Error {}

/**
 * Configuración → Preferencias de Clínica.
 *
 * Contenedor de los ajustes de producto de la clínica, separados de los Datos
 * de la Clínica (que son fiscales y de contacto). Está estructurada en tarjetas,
 * una por sección.
 *
 * Las secciones de automatización (envío automático de emails de alertas y
 * sincronización con Google Calendar) se guardan en `system_configurations`,
 * no en `clinic_preferences`: son las claves que leen los flujos de n8n. Se
 * cargan aparte y un error al leerlas no bloquea el resto de la página.
 */
export default function ClinicPrefsConfigPage() {
  const t = useTranslations('ClinicPrefsPage');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('AppointmentStatus');
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission(CLINIC_PREFS_PERMISSIONS.UPDATE);
  const { toast } = useToast();

  const setStorePreferences = useClinicPreferencesStore((s) => s.setPreferences);

  const [config, setConfig] = React.useState<ClinicPreferences>(DEFAULT_CLINIC_PREFERENCES);
  // Activar teléfonos repetidos exige leer antes el riesgo (WhatsApp y portal eligen una ficha).
  const [confirmDuplicatePhoneOpen, setConfirmDuplicatePhoneOpen] = React.useState(false);
  // Se relee del backend en vez de tomar el store: esta pantalla es la que
  // edita el dato, así que parte siempre del valor persistido.
  const {
    data: initial,
    setData: setInitial,
    isLoading,
    isRefreshing,
    error: loadError,
    reload,
  } = useDataLoader((signal) => fetchClinicPreferences({ signal }), DEFAULT_CLINIC_PREFERENCES);

  React.useEffect(() => {
    setConfig(initial);
  }, [initial]);

  const [automation, setAutomation] = React.useState<ClinicAutomationSettings>(DEFAULT_CLINIC_AUTOMATION_SETTINGS);
  // Activar el envío automático manda emails a pacientes desde la próxima corrida: se confirma.
  const [confirmEmailAutoSendOpen, setConfirmEmailAutoSendOpen] = React.useState(false);
  const {
    data: initialAutomation,
    isLoading: isAutomationLoading,
    isRefreshing: isAutomationRefreshing,
    error: automationError,
    reload: reloadAutomation,
  } = useDataLoader((signal) => fetchClinicAutomationSettings({ signal }), DEFAULT_CLINIC_AUTOMATION_SETTINGS);

  React.useEffect(() => {
    setAutomation(initialAutomation);
  }, [initialAutomation]);

  const isDirty =
    JSON.stringify(config) !== JSON.stringify(initial) || JSON.stringify(automation) !== JSON.stringify(initialAutomation);

  const patchAutomation = (values: Partial<ClinicAutomationSettings>) => setAutomation((c) => ({ ...c, ...values }));

  const patch = (values: Partial<ClinicPreferences>) => setConfig((c) => ({ ...c, ...values }));

  // El porcentaje por defecto no puede superar el tope: si lo hiciera, cada
  // línea nacería ya inválida.
  const defaultOverMax = config.default_discount_pct > config.max_discount_pct;
  const applySavedPreferences = (values: ClinicPreferences) => {
    setInitial(values);
    // El resto de la app lee del store, no de esta página: sin esto el cambio
    // no se vería en las pantallas de venta hasta el próximo login.
    setStorePreferences(values);
  };

  // Dos destinos (clinic_preferences y system_configurations) bajo un solo bloqueo.
  // Solo se escribe lo que cambió; si falla el segundo paso se dice qué sí se guardó.
  const save = useAsyncAction(
    async (values: { prefs: ClinicPreferences; automation: ClinicAutomationSettings }) => {
      const prefsChanged = JSON.stringify(values.prefs) !== JSON.stringify(initial);
      if (prefsChanged) {
        await updateClinicPreferences(values.prefs, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
      }
      try {
        await updateClinicAutomationSettings(values.automation, initialAutomation);
      } catch (error) {
        if (!prefsChanged || isTimeoutError(error)) throw error;
        applySavedPreferences(values.prefs);
        throw new PartialSaveError(t('automation.partialSaveError'));
      }
      return values;
    },
    {
      onSuccess: async (values) => {
        applySavedPreferences(values.prefs);
        // El asistente toma el cambio de la mascota sin esperar a recargar.
        useHelpAssistant.getState().setClinicMascotVisible(values.automation.help_mascot_visible);
        await reloadAutomation();
        toast({ title: t('saved') });
      },
      onError: (error) => {
        // El guardado pudo aplicarse antes del timeout: se relee para mostrar el estado real.
        if (isTimeoutError(error)) reload();
        if (isTimeoutError(error) || error instanceof PartialSaveError) reloadAutomation();
      },
      errorTitle: t('saveError'),
    }
  );
  const isBusy = save.isPending || isRefreshing || isAutomationRefreshing;
  const canSave = canUpdate && isDirty && !isBusy && !defaultOverMax;
  const canEdit = canUpdate && !isBusy;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // Si la carga falla no se muestran los valores por defecto como si fueran los guardados:
  // guardarlos pisaría la configuración real de la clínica.
  if (loadError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageHeader icon={<SlidersHorizontal className="h-5 w-5" />} title={t('title')} description={t('description')} />
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
          icon={<SlidersHorizontal className="h-5 w-5" />}
          title={t('title')}
          description={t('description')}
          actions={
            canUpdate ? (
              <Button data-help-id="config.clinic-prefs.btn.save" onClick={() => save.run({ prefs: config, automation })} disabled={!canSave} loading={save.isPending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {t('save')}
              </Button>
            ) : null
          }
        />

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-1 pb-6">
          {/* ── Descuentos ─────────────────────────────────────────────── */}
          <Card data-help-id="config.clinic-prefs.section.discounts">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{t('discounts.sectionTitle')}</h2>
              </div>

              <SettingRow
                label={t('discounts.enabled.label')}
                help={t('discounts.enabled.help')}
                control={
                  <Switch
                    checked={config.discounts_enabled}
                    disabled={!canEdit}
                    onCheckedChange={(v) => patch({ discounts_enabled: v })}
                  />
                }
              />

              {/* Todo lo de abajo sólo tiene sentido con los descuentos activos. */}
              {config.discounts_enabled && (
                <div className="space-y-5 border-t pt-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">{t('discounts.scope.label')}</Label>
                      <HelpTip text={t('discounts.scope.help')} />
                    </div>
                    <RadioGroup
                      value={config.discount_scope}
                      disabled={!canEdit}
                      onValueChange={(v) => patch({ discount_scope: v as DiscountScope })}
                      className="gap-3"
                    >
                      <ScopeOption
                        value="line"
                        title={t('discounts.scope.line.title')}
                        description={t('discounts.scope.line.description')}
                      />
                      <ScopeOption
                        value="total"
                        title={t('discounts.scope.total.title')}
                        description={t('discounts.scope.total.description')}
                      />
                    </RadioGroup>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel
                        htmlFor="default-discount-pct"
                        label={t('discounts.defaultPct.label')}
                        help={t('discounts.defaultPct.help')}
                      />
                      <Input
                        id="default-discount-pct"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={config.default_discount_pct}
                        disabled={!canEdit}
                        onChange={(e) => patch({ default_discount_pct: clampPct(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">{t('discounts.defaultPct.hint')}</p>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel
                        htmlFor="max-discount-pct"
                        label={t('discounts.maxPct.label')}
                        help={t('discounts.maxPct.help')}
                      />
                      <Input
                        id="max-discount-pct"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={config.max_discount_pct}
                        disabled={!canEdit}
                        onChange={(e) => patch({ max_discount_pct: clampPct(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">{t('discounts.maxPct.hint')}</p>
                    </div>
                  </div>

                  {defaultOverMax && (
                    <p className="rounded-xl bg-destructive/10 px-4 py-3 text-xs leading-relaxed text-destructive">
                      {t('discounts.defaultOverMax')}
                    </p>
                  )}

                  <p className="rounded-xl bg-primary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                    {t('discounts.permissionNotice')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Documento de identidad ─────────────────────────────────── */}
          <Card data-help-id="config.clinic-prefs.section.identity-document">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{t('identityDocument.sectionTitle')}</h2>
              </div>

              <SettingRow
                label={t('identityDocument.required.label')}
                help={t('identityDocument.required.help')}
                control={
                  <Switch
                    data-help-id="config.clinic-prefs.field.identity_document_required"
                    checked={config.identity_document_required}
                    disabled={!canEdit}
                    onCheckedChange={(v) => patch({ identity_document_required: v })}
                  />
                }
              />

              <div className="space-y-3 border-t pt-5">
                <SettingRow
                  label={t('identityDocument.warnOnStatus.label')}
                  help={t('identityDocument.warnOnStatus.help')}
                  control={
                    <Switch
                      data-help-id="config.clinic-prefs.field.identity_document_warn"
                      checked={config.identity_document_warn_statuses.length > 0}
                      disabled={!canEdit}
                      // Al encender se arranca por el caso habitual: exigirlo al completar.
                      onCheckedChange={(v) => patch({ identity_document_warn_statuses: v ? DEFAULT_WARN_STATUSES : [] })}
                    />
                  }
                />

                {config.identity_document_warn_statuses.length > 0 && (
                  <div data-help-id="config.clinic-prefs.field.identity_document_warn_statuses" className="space-y-2 rounded-xl bg-muted/40 p-4">
                    <p className="text-xs font-medium text-muted-foreground">{t('identityDocument.warnOnStatus.statusesLabel')}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {WARNABLE_STATUSES.map((status) => {
                        const id = `warn-status-${status}`;
                        const checked = config.identity_document_warn_statuses.includes(status);
                        return (
                          <div key={status} className="flex items-center gap-2">
                            <Checkbox
                              id={id}
                              checked={checked}
                              disabled={!canEdit}
                              onCheckedChange={(v) =>
                                patch({
                                  // Se mantiene el orden canónico para que el "dirty" no dependa del orden de clic.
                                  identity_document_warn_statuses: WARNABLE_STATUSES.filter((s) =>
                                    s === status ? v === true : config.identity_document_warn_statuses.includes(s),
                                  ),
                                })
                              }
                            />
                            <Label htmlFor={id} className="text-sm font-normal">
                              {tStatus(status)}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Contacto de pacientes ──────────────────────────────────── */}
          <Card data-help-id="config.clinic-prefs.section.duplicate-contact">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{t('duplicateContact.sectionTitle')}</h2>
              </div>

              <SettingRow
                label={t('duplicateContact.allow.label')}
                help={t('duplicateContact.allow.help')}
                control={
                  <Switch
                    checked={config.allow_duplicate_phone}
                    disabled={!canEdit}
                    onCheckedChange={(v) => (v ? setConfirmDuplicatePhoneOpen(true) : patch({ allow_duplicate_phone: false }))}
                  />
                }
              />

              {config.allow_duplicate_phone && (
                <p className="rounded-xl bg-primary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  {t('duplicateContact.allow.notice')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Automatización (system_configurations) ──────────────────── */}
          {automationError && (
            <Alert data-help-id="config.clinic-prefs.section.automation" variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('automation.loadError')}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>{automationError}</span>
                <Button size="sm" variant="outline" onClick={() => reloadAutomation()} loading={isAutomationRefreshing}>
                  {tCommon('retry')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* ── Emails automáticos de alertas ──────────────────────────── */}
          <Card data-help-id="config.clinic-prefs.section.alert-email">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{t('alertEmail.sectionTitle')}</h2>
              </div>

              {isAutomationLoading ? (
                <Skeleton className="h-8 w-full rounded-lg" />
              ) : (
                <SettingRow
                  label={t('alertEmail.enabled.label')}
                  help={t('alertEmail.enabled.help')}
                  disabled={!!automationError}
                  control={
                    <Switch
                      checked={automation.alert_email_auto_send_enabled}
                      disabled={!canEdit || !!automationError}
                      onCheckedChange={(v) =>
                        v ? setConfirmEmailAutoSendOpen(true) : patchAutomation({ alert_email_auto_send_enabled: false })
                      }
                    />
                  }
                />
              )}

              <p
                className={cn(
                  'rounded-xl px-4 py-3 text-xs leading-relaxed text-muted-foreground',
                  automation.alert_email_auto_send_enabled ? 'bg-primary/5' : 'bg-muted/60'
                )}
              >
                {automation.alert_email_auto_send_enabled ? t('alertEmail.notice.on') : t('alertEmail.notice.off')}
              </p>
            </CardContent>
          </Card>

          {/* ── Asistente guiado ───────────────────────────────────────── */}
          <Card data-help-id="config.clinic-prefs.section.assistant">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{t('assistant.sectionTitle')}</h2>
              </div>

              {isAutomationLoading ? (
                <Skeleton className="h-8 w-full rounded-lg" />
              ) : (
                <SettingRow
                  label={t('assistant.mascotVisible.label')}
                  help={t('assistant.mascotVisible.help')}
                  disabled={!!automationError}
                  control={
                    <Switch
                      data-help-id="config.clinic-prefs.field.help_mascot_visible"
                      checked={automation.help_mascot_visible}
                      disabled={!canEdit || !!automationError}
                      onCheckedChange={(v) => patchAutomation({ help_mascot_visible: v })}
                    />
                  }
                />
              )}

              <p
                className={cn(
                  'rounded-xl px-4 py-3 text-xs leading-relaxed text-muted-foreground',
                  automation.help_mascot_visible ? 'bg-primary/5' : 'bg-muted/60'
                )}
              >
                {automation.help_mascot_visible ? t('assistant.mascotVisible.notice.on') : t('assistant.mascotVisible.notice.off')}
              </p>
            </CardContent>
          </Card>

          {/* ── Google Calendar ────────────────────────────────────────── */}
          <Card data-help-id="config.clinic-prefs.section.google-calendar">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center gap-2">
                <CalendarSync className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{t('googleCalendar.sectionTitle')}</h2>
                <HelpTip text={t('googleCalendar.help')} />
              </div>

              {isAutomationLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {GOOGLE_CALENDAR_SYNC_MODES.map((mode) => (
                    <Skeleton key={mode} className="h-28 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                <RadioGroup
                  value={automation.google_calendar_sync_mode}
                  disabled={!canEdit || !!automationError}
                  onValueChange={(v) => patchAutomation({ google_calendar_sync_mode: v as GoogleCalendarSyncMode })}
                  className="grid gap-3 sm:grid-cols-2"
                  aria-label={t('googleCalendar.sectionTitle')}
                >
                  {GOOGLE_CALENDAR_SYNC_MODES.map((mode) => (
                    <SyncModeOption
                      key={mode}
                      value={mode}
                      icon={SYNC_MODE_ICONS[mode]}
                      title={t(`googleCalendar.modes.${mode}.title`)}
                      description={t(`googleCalendar.modes.${mode}.description`)}
                      selected={automation.google_calendar_sync_mode === mode}
                      disabled={!canEdit || !!automationError}
                    />
                  ))}
                </RadioGroup>
              )}

              <p className="rounded-xl bg-primary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                {t('googleCalendar.notice')}
              </p>
            </CardContent>
          </Card>

          <AlertDialog open={confirmEmailAutoSendOpen} onOpenChange={setConfirmEmailAutoSendOpen}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 shrink-0 text-primary" />
                  {t('alertEmail.confirm.title')}
                </AlertDialogTitle>
                <AlertDialogDescription>{t('alertEmail.confirm.description')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('alertEmail.confirm.cancel')}</AlertDialogCancel>
                <Button
                  type="button"
                  onClick={() => {
                    patchAutomation({ alert_email_auto_send_enabled: true });
                    setConfirmEmailAutoSendOpen(false);
                  }}
                >
                  {t('alertEmail.confirm.confirm')}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={confirmDuplicatePhoneOpen} onOpenChange={setConfirmDuplicatePhoneOpen}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                  {t('duplicateContact.warning.title')}
                </AlertDialogTitle>
                <AlertDialogDescription>{t('duplicateContact.warning.description')}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 px-6 py-3 text-sm">
                <ul className="list-disc space-y-2 pl-5">
                  <li>{t('duplicateContact.warning.whatsapp')}</li>
                  <li>{t('duplicateContact.warning.portal')}</li>
                </ul>
                <p className="text-xs leading-relaxed text-muted-foreground">{t('duplicateContact.warning.footer')}</p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('duplicateContact.warning.cancel')}</AlertDialogCancel>
                <Button
                  type="button"
                  onClick={() => {
                    patch({ allow_duplicate_phone: true });
                    setConfirmDuplicatePhoneOpen(false);
                  }}
                >
                  {t('duplicateContact.warning.confirm')}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {!canUpdate && <p className="px-1 text-xs text-muted-foreground">{t('readOnlyNotice')}</p>}
        </div>
      </div>
    </TooltipProvider>
  );
}

/** Acota lo tecleado al rango que acepta la BD, para no guardar un valor que el CHECK rechace. */
function clampPct(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
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

function FieldLabel({ htmlFor, label, help }: { htmlFor: string; label: string; help: string }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      <HelpTip text={help} />
    </div>
  );
}

/** Opción del ámbito, con su explicación: la elección no es obvia por el nombre. */
function ScopeOption({ value, title, description }: { value: DiscountScope; title: string; description: string }) {
  const id = `discount-scope-${value}`;
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/** Tarjeta de un modo de sincronización: icono de la dirección, título y qué hace. */
function SyncModeOption({
  value,
  icon: Icon,
  title,
  description,
  selected,
  disabled,
}: {
  value: GoogleCalendarSyncMode;
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  disabled: boolean;
}) {
  const id = `gcal-sync-mode-${value}`;
  return (
    <Label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer flex-col gap-2 rounded-xl border p-4 font-normal transition-colors',
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full',
            selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <RadioGroupItem value={value} id={id} />
      </div>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
    </Label>
  );
}
