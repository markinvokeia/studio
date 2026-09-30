'use client';

import { AlertTriangle, Copy, FileText, HelpCircle, Percent, Save, SlidersHorizontal } from 'lucide-react';
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
import { REQUEST_TIMEOUT_MS, isTimeoutError } from '@/services/api';
import type { ClinicPreferences, DiscountScope } from '@/lib/types';
import {
  DEFAULT_CLINIC_PREFERENCES,
  fetchClinicPreferences,
  updateClinicPreferences,
} from '@/services/clinic-preferences';
import { useClinicPreferencesStore } from '@/stores/clinic-preferences-store';

/**
 * Configuración → Preferencias de Clínica.
 *
 * Contenedor de los ajustes de producto de la clínica, separados de los Datos
 * de la Clínica (que son fiscales y de contacto). Hoy sólo alberga la política
 * de descuentos; está estructurada en tarjetas para que quepan más secciones.
 */
export default function ClinicPrefsConfigPage() {
  const t = useTranslations('ClinicPrefsPage');
  const tCommon = useTranslations('Common');
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

  const isDirty = JSON.stringify(config) !== JSON.stringify(initial);

  const patch = (values: Partial<ClinicPreferences>) => setConfig((c) => ({ ...c, ...values }));

  // El porcentaje por defecto no puede superar el tope: si lo hiciera, cada
  // línea nacería ya inválida.
  const defaultOverMax = config.default_discount_pct > config.max_discount_pct;
  const save = useAsyncAction(
    async (values: ClinicPreferences) => {
      await updateClinicPreferences(values, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
      return values;
    },
    {
      onSuccess: (values) => {
        setInitial(values);
        // El resto de la app lee del store, no de esta página: sin esto el cambio
        // no se vería en las pantallas de venta hasta el próximo login.
        setStorePreferences(values);
        toast({ title: t('saved') });
      },
      // El guardado pudo aplicarse antes del timeout: se relee para mostrar el estado real.
      onError: (error) => { if (isTimeoutError(error)) reload(); },
      errorTitle: t('saveError'),
    }
  );
  const isBusy = save.isPending || isRefreshing;
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
              <Button onClick={() => save.run(config)} disabled={!canSave} loading={save.isPending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {t('save')}
              </Button>
            ) : null
          }
        />

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-1 pb-6">
          {/* ── Descuentos ─────────────────────────────────────────────── */}
          <Card>
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
          <Card>
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
                    checked={config.identity_document_required}
                    disabled={!canEdit}
                    onCheckedChange={(v) => patch({ identity_document_required: v })}
                  />
                }
              />
            </CardContent>
          </Card>

          {/* ── Contacto de pacientes ──────────────────────────────────── */}
          <Card>
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
