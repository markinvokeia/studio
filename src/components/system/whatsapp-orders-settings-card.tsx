'use client';

import * as React from 'react';
import { AlertTriangle, ClipboardList, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import type { SystemConfiguration } from '@/lib/types';
import api, { REQUEST_TIMEOUT_MS } from '@/services/api';

/**
 * Ajustes de las órdenes de estudio por WhatsApp (system_configurations).
 *
 * Es una tarjeta con su propio guardado y no parte del guardado de la página: esos
 * seis valores no dependen del horario del agente, y mezclarlos en la misma
 * secuencia de upserts haría que un fallo en uno deje al otro a medias.
 *
 * El interruptor de "Activar" nace apagado (migración 123): hasta que alguien lo
 * enciende, el asistente ignora las fotos y PDF como siempre.
 */

const KEYS = {
    enabled: 'whatsapp_orders_enabled',
    minConfidence: 'whatsapp_orders_min_confidence',
    visionModel: 'whatsapp_orders_vision_model',
    calendarIds: 'whatsapp_orders_calendar_ids',
    ttlHours: 'whatsapp_orders_intake_ttl_hours',
    mediaDebounceSeconds: 'whatsapp_orders_media_debounce_seconds',
} as const;

const DEFAULTS = {
    enabled: false,
    minConfidence: '0.85',
    visionModel: '',
    calendarIds: '',
    ttlHours: '24',
    mediaDebounceSeconds: '60',
};

type OrdersSettings = typeof DEFAULTS;
type OrdersLoaded = { values: OrdersSettings; configs: Record<string, SystemConfiguration | undefined> };

const EMPTY_LOADED: OrdersLoaded = { values: DEFAULTS, configs: {} };

async function loadSettings(signal: AbortSignal): Promise<OrdersLoaded> {
    // Si falla, se propaga: mostrar los valores por defecto dejaría guardar encima de los reales.
    const data = await api.get(API_ROUTES.SYSTEM.CONFIGS, undefined, undefined, { signal });
    const list = (Array.isArray(data) ? data : (data?.configs || data?.data || data?.result || [])) as SystemConfiguration[];
    const byKey = Object.fromEntries(Object.values(KEYS).map((key) => [key, list.find((c) => c.key === key)]));
    const read = (key: string, fallback: string) => byKey[key]?.value ?? fallback;
    return {
        configs: byKey,
        values: {
            enabled: read(KEYS.enabled, 'false') === 'true',
            minConfidence: read(KEYS.minConfidence, DEFAULTS.minConfidence),
            visionModel: read(KEYS.visionModel, DEFAULTS.visionModel),
            calendarIds: read(KEYS.calendarIds, DEFAULTS.calendarIds),
            ttlHours: read(KEYS.ttlHours, DEFAULTS.ttlHours),
            mediaDebounceSeconds: read(KEYS.mediaDebounceSeconds, DEFAULTS.mediaDebounceSeconds),
        },
    };
}

async function upsertConfig(payload: {
    id?: string;
    key: string;
    value: string;
    description: string;
    data_type: SystemConfiguration['data_type'];
}) {
    const response = await api.post(
        API_ROUTES.SYSTEM.CONFIGS_UPSERT,
        { ...payload, is_public: false },
        undefined,
        undefined,
        { timeoutMs: REQUEST_TIMEOUT_MS.mutation },
    );
    if (Array.isArray(response) && response[0]?.code >= 400) {
        throw new Error(response[0]?.message || 'Failed to save configuration');
    }
}

export interface WhatsappOrdersSettingsCardProps {
    canUpdate: boolean;
}

export function WhatsappOrdersSettingsCard({ canUpdate }: WhatsappOrdersSettingsCardProps) {
    const t = useTranslations('WhatsAppOrdersSettings');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();

    const { data: loaded, isLoading, isRefreshing, error: loadError, reload } = useDataLoader(loadSettings, EMPTY_LOADED);
    const [form, setForm] = React.useState<OrdersSettings>(DEFAULTS);
    const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<keyof OrdersSettings, string>>>({});

    React.useEffect(() => {
        setForm(loaded.values);
        setFieldErrors({});
    }, [loaded]);

    const validate = React.useCallback((values: OrdersSettings) => {
        const errors: Partial<Record<keyof OrdersSettings, string>> = {};
        const confidence = Number(values.minConfidence);
        if (!Number.isFinite(confidence) || confidence < 0.5 || confidence > 1) errors.minConfidence = t('errors.confidence');
        const ttl = Number(values.ttlHours);
        if (!Number.isInteger(ttl) || ttl < 1 || ttl > 168) errors.ttlHours = t('errors.ttl');
        // n8n acota a 300 s: más espera demora la respuesta sin juntar más fotos.
        const mediaDebounce = Number(values.mediaDebounceSeconds);
        if (!Number.isInteger(mediaDebounce) || mediaDebounce < 30 || mediaDebounce > 300) errors.mediaDebounceSeconds = t('errors.mediaDebounce');
        if (values.enabled && !values.visionModel.trim()) errors.visionModel = t('errors.model');
        if (values.calendarIds.trim() && !/^\d+(\s*,\s*\d+)*$/.test(values.calendarIds.trim())) errors.calendarIds = t('errors.calendars');
        return errors;
    }, [t]);

    const save = useAsyncAction(
        async (values: OrdersSettings) => {
            const errors = validate(values);
            setFieldErrors(errors);
            if (Object.keys(errors).length > 0) return false;

            const entries: Array<{ key: string; value: string; description: string; data_type: SystemConfiguration['data_type'] }> = [
                { key: KEYS.minConfidence, value: String(Number(values.minConfidence)), data_type: 'number', description: t('descriptions.minConfidence') },
                { key: KEYS.visionModel, value: values.visionModel.trim(), data_type: 'string', description: t('descriptions.visionModel') },
                { key: KEYS.calendarIds, value: values.calendarIds.replace(/\s+/g, ''), data_type: 'string', description: t('descriptions.calendarIds') },
                { key: KEYS.ttlHours, value: String(Number(values.ttlHours)), data_type: 'number', description: t('descriptions.ttlHours') },
                { key: KEYS.mediaDebounceSeconds, value: String(Number(values.mediaDebounceSeconds)), data_type: 'number', description: t('descriptions.mediaDebounce') },
                // El interruptor va al final: si algo antes falla, no queda activado con ajustes a medias.
                { key: KEYS.enabled, value: values.enabled ? 'true' : 'false', data_type: 'boolean', description: t('descriptions.enabled') },
            ];
            for (const entry of entries) {
                await upsertConfig({ id: loaded.configs[entry.key]?.id, ...entry });
            }
            return true;
        },
        {
            onSuccess: async (saved) => {
                if (!saved) return;
                toast({ title: t('toast.successTitle'), description: t('toast.saveSuccess') });
                await reload();
            },
            onError: () => {
                // Puede haberse guardado una parte: se vuelve a leer para mostrar lo real.
                void reload();
            },
            errorTitle: t('toast.errorTitle'),
        },
    );

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-10">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
                </CardContent>
            </Card>
        );
    }

    if (loadError) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('toast.loadError')}</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                    <span>{loadError}</span>
                    <Button size="sm" variant="outline" onClick={() => void reload()} loading={isRefreshing}>
                        {tCommon('retry')}
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    const set = <K extends keyof OrdersSettings>(key: K, value: OrdersSettings[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const isDirty = JSON.stringify(form) !== JSON.stringify(loaded.values);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5">
                        <ClipboardList className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="text-left">
                        <CardTitle>{t('title')}</CardTitle>
                        <CardDescription>{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="orders-enabled">{t('enable')}</Label>
                        <p className="text-sm text-muted-foreground">{t('enableDescription')}</p>
                    </div>
                    <Switch
                        id="orders-enabled"
                        checked={form.enabled}
                        onCheckedChange={(checked) => set('enabled', checked)}
                        disabled={!canUpdate || save.isPending}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="orders-model">{t('visionModel')}</Label>
                        <Input
                            id="orders-model"
                            value={form.visionModel}
                            onChange={(e) => set('visionModel', e.target.value)}
                            disabled={!canUpdate || save.isPending}
                            aria-invalid={!!fieldErrors.visionModel}
                        />
                        <p className="text-xs text-muted-foreground">{t('visionModelHelp')}</p>
                        {fieldErrors.visionModel && <p className="text-xs text-destructive">{fieldErrors.visionModel}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="orders-confidence">{t('minConfidence')}</Label>
                        <Input
                            id="orders-confidence"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.5"
                            max="1"
                            value={form.minConfidence}
                            onChange={(e) => set('minConfidence', e.target.value)}
                            disabled={!canUpdate || save.isPending}
                            aria-invalid={!!fieldErrors.minConfidence}
                        />
                        <p className="text-xs text-muted-foreground">{t('minConfidenceHelp')}</p>
                        {fieldErrors.minConfidence && <p className="text-xs text-destructive">{fieldErrors.minConfidence}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="orders-calendars">{t('calendarIds')}</Label>
                        <Input
                            id="orders-calendars"
                            value={form.calendarIds}
                            onChange={(e) => set('calendarIds', e.target.value)}
                            placeholder={t('calendarIdsPlaceholder')}
                            disabled={!canUpdate || save.isPending}
                            aria-invalid={!!fieldErrors.calendarIds}
                        />
                        <p className="text-xs text-muted-foreground">{t('calendarIdsHelp')}</p>
                        {fieldErrors.calendarIds && <p className="text-xs text-destructive">{fieldErrors.calendarIds}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="orders-ttl">{t('ttlHours')}</Label>
                        <Input
                            id="orders-ttl"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="168"
                            value={form.ttlHours}
                            onChange={(e) => set('ttlHours', e.target.value)}
                            disabled={!canUpdate || save.isPending}
                            aria-invalid={!!fieldErrors.ttlHours}
                        />
                        <p className="text-xs text-muted-foreground">{t('ttlHoursHelp')}</p>
                        {fieldErrors.ttlHours && <p className="text-xs text-destructive">{fieldErrors.ttlHours}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="orders-media-debounce">{t('mediaDebounce')}</Label>
                        <Input
                            id="orders-media-debounce"
                            type="number"
                            inputMode="numeric"
                            min="30"
                            max="300"
                            value={form.mediaDebounceSeconds}
                            onChange={(e) => set('mediaDebounceSeconds', e.target.value)}
                            disabled={!canUpdate || save.isPending}
                            aria-invalid={!!fieldErrors.mediaDebounceSeconds}
                        />
                        <p className="text-xs text-muted-foreground">{t('mediaDebounceHelp')}</p>
                        {fieldErrors.mediaDebounceSeconds && <p className="text-xs text-destructive">{fieldErrors.mediaDebounceSeconds}</p>}
                    </div>
                </div>

                {canUpdate && (
                    <div className="flex justify-end">
                        <Button onClick={() => void save.run(form)} loading={save.isPending} disabled={!isDirty}>
                            {t('save')}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default WhatsappOrdersSettingsCard;
