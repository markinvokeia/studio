'use client';

import { HelpCircle, Loader2, Percent, Save, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

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
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
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
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission(CLINIC_PREFS_PERMISSIONS.UPDATE);
  const { toast } = useToast();

  const setStorePreferences = useClinicPreferencesStore((s) => s.setPreferences);

  const [config, setConfig] = React.useState<ClinicPreferences>(DEFAULT_CLINIC_PREFERENCES);
  const [initial, setInitial] = React.useState<ClinicPreferences>(DEFAULT_CLINIC_PREFERENCES);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Se relee del backend en vez de tomar el store: esta pantalla es la que
        // edita el dato, así que parte siempre del valor persistido.
        const loaded = await fetchClinicPreferences();
        if (cancelled) return;
        setConfig(loaded);
        setInitial(loaded);
      } catch (error) {
        console.error('Failed to load the clinic preferences:', error);
        if (!cancelled) toast({ variant: 'destructive', title: t('loadError') });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t, toast]);

  const isDirty = JSON.stringify(config) !== JSON.stringify(initial);

  const patch = (values: Partial<ClinicPreferences>) => setConfig((c) => ({ ...c, ...values }));

  // El porcentaje por defecto no puede superar el tope: si lo hiciera, cada
  // línea nacería ya inválida.
  const defaultOverMax = config.default_discount_pct > config.max_discount_pct;
  const canSave = canUpdate && isDirty && !isSaving && !defaultOverMax;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateClinicPreferences(config);
      setInitial(config);
      // El resto de la app lee del store, no de esta página: sin esto el cambio
      // no se vería en las pantallas de venta hasta el próximo login.
      setStorePreferences(config);
      toast({ title: t('saved') });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('saveError'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageHeader
          icon={<SlidersHorizontal className="h-5 w-5" />}
          title={t('title')}
          description={t('description')}
          actions={
            canUpdate ? (
              <Button onClick={handleSave} disabled={!canSave} className="gap-1.5">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
                    disabled={!canUpdate}
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
                      disabled={!canUpdate}
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
                        disabled={!canUpdate}
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
                        disabled={!canUpdate}
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
