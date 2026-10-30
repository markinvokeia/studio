'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { SystemConfiguration } from '@/lib/types';
import api, { isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { AlertTriangle, BotMessageSquare, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import * as z from 'zod';

const AGENT_ENABLED_KEY = 'whatsapp_agent_enabled';
const BUSINESS_HOURS_KEY = 'whatsapp_agent_business_hours';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAY_KEYS)[number];
const WEEKDAYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
const WEEKEND: DayKey[] = ['sat', 'sun'];

const TIMEZONES = ['America/Montevideo', 'America/Argentina/Buenos_Aires', 'America/Sao_Paulo', 'America/New_York', 'Europe/Madrid'];

type TimeRange = [string, string];
interface Rule {
    days: DayKey[];
    ranges: TimeRange[];
}
interface BusinessHours {
    enabled: boolean;
    timezone: string;
    rules: Rule[];
    off_hours_reply?: string;
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
    enabled: true,
    timezone: 'America/Montevideo',
    rules: [
        { days: ['mon', 'tue', 'wed', 'thu', 'fri'], ranges: [['00:00', '09:00'], ['20:00', '24:00']] },
        { days: ['sat'], ranges: [['00:00', '09:00'], ['14:00', '24:00']] },
        { days: ['sun'], ranges: [['00:00', '24:00']] },
    ],
    off_hours_reply: '',
};

// 00:00, 00:30, ... 23:30, plus 24:00 (fin del día) for range ends.
const TIME_OPTIONS: string[] = [
    ...Array.from({ length: 48 }, (_, i) => {
        const h = String(Math.floor(i / 2)).padStart(2, '0');
        const m = i % 2 === 0 ? '00' : '30';
        return `${h}:${m}`;
    }),
    '24:00',
];

function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const timeRangeSchema = z
    .tuple([z.string().regex(HHMM), z.string().regex(HHMM)])
    .refine(([from, to]) => toMinutes(from) < toMinutes(to), { message: 'range' });
const ruleSchema = z.object({
    days: z.array(z.enum(DAY_KEYS)).min(1, { message: 'days' }),
    ranges: z.array(timeRangeSchema).min(1, { message: 'ranges' }),
});
const businessHoursSchema = z.object({
    enabled: z.boolean(),
    timezone: z.string().min(1),
    rules: z.array(ruleSchema),
    off_hours_reply: z.string().optional(),
});

function isTimeRange(v: unknown): v is TimeRange {
    return Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string';
}

function normalizeRules(raw: unknown): Rule[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
        .map((r) => ({
            days: Array.isArray(r.days)
                ? (r.days.filter((d): d is DayKey => (DAY_KEYS as readonly string[]).includes(d as string)))
                : [],
            ranges: Array.isArray(r.ranges) ? r.ranges.filter(isTimeRange).map((x) => [x[0], x[1]] as TimeRange) : [],
        }));
}

// Backwards compat: convierte el formato viejo { schedule: { mon..sun: [...] } } a reglas,
// agrupando los días que comparten exactamente los mismos rangos.
function rulesFromSchedule(schedule: unknown): Rule[] {
    if (!schedule || typeof schedule !== 'object') return [];
    const byRanges = new Map<string, Rule>();
    for (const day of DAY_KEYS) {
        const raw = (schedule as Record<string, unknown>)[day];
        if (!Array.isArray(raw)) continue;
        const ranges = raw.filter(isTimeRange).map((x) => [x[0], x[1]] as TimeRange);
        if (ranges.length === 0) continue;
        const key = JSON.stringify(ranges);
        const existing = byRanges.get(key);
        if (existing) existing.days.push(day);
        else byRanges.set(key, { days: [day], ranges });
    }
    return [...byRanges.values()];
}

// Throws on failure: without the stored records' ids, saving would create duplicate config keys.
async function getConfigs(signal?: AbortSignal): Promise<SystemConfiguration[]> {
    const data = await api.get(API_ROUTES.SYSTEM.CONFIGS, undefined, undefined, { signal });
    const list = Array.isArray(data) ? data : (data?.configs || data?.data || data?.result || []);
    return list as SystemConfiguration[];
}

type AgentConfigIds = { agentEnabled?: string; businessHours?: string };

function extractIds(configs: SystemConfiguration[]): AgentConfigIds {
    const agentCfg = configs.find((c) => c.key === AGENT_ENABLED_KEY);
    const hoursCfg = configs.find((c) => c.key === BUSINESS_HOURS_KEY);
    return {
        agentEnabled: agentCfg ? String(agentCfg.id) : undefined,
        businessHours: hoursCfg ? String(hoursCfg.id) : undefined,
    };
}

function parseAgentConfig(configs: SystemConfiguration[]) {
    const agentCfg = configs.find((c) => c.key === AGENT_ENABLED_KEY);
    const hoursCfg = configs.find((c) => c.key === BUSINESS_HOURS_KEY);
    let businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS;
    if (hoursCfg?.value) {
        try {
            const parsed = JSON.parse(hoursCfg.value);
            const rules = Array.isArray(parsed?.rules) ? normalizeRules(parsed.rules) : rulesFromSchedule(parsed?.schedule);
            businessHours = {
                enabled: parsed?.enabled !== false,
                timezone: typeof parsed?.timezone === 'string' && parsed.timezone ? parsed.timezone : 'America/Montevideo',
                rules: rules.length > 0 ? rules : DEFAULT_BUSINESS_HOURS.rules,
                off_hours_reply: typeof parsed?.off_hours_reply === 'string' ? parsed.off_hours_reply : '',
            };
        } catch {
            businessHours = DEFAULT_BUSINESS_HOURS;
        }
    }
    return {
        ids: extractIds(configs),
        agentEnabled: agentCfg ? agentCfg.value !== 'false' : true,
        businessHours,
    };
}

/** A save that failed after the first of its two upserts was already applied. */
class PartialSaveError extends Error {}

async function upsertConfig(payload: {
    id?: string;
    key: string;
    value: string;
    description?: string;
    data_type: SystemConfiguration['data_type'];
    is_public: boolean;
}) {
    const response = await api.post(API_ROUTES.SYSTEM.CONFIGS_UPSERT, payload, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    if (Array.isArray(response) && response[0]?.code >= 400) {
        throw new Error(response[0]?.message || 'Failed to save configuration');
    }
    return response;
}

export default function WhatsAppAgentConfigPage() {
    const t = useTranslations('WhatsAppAgentConfigPage');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const canUpdate = hasPermission(SYSTEM_PERMISSIONS.WHATSAPP_AGENT_CONFIG_UPDATE);

    const [agentEnabled, setAgentEnabled] = React.useState(true);
    const [businessHours, setBusinessHours] = React.useState<BusinessHours>(DEFAULT_BUSINESS_HOURS);
    const idsRef = React.useRef<AgentConfigIds>({});

    const {
        data: loaded,
        isLoading,
        isRefreshing,
        error: loadError,
        reload: loadData,
    } = useDataLoader(
        async (signal) => parseAgentConfig(await getConfigs(signal)),
        { ids: {} as AgentConfigIds, agentEnabled: true, businessHours: DEFAULT_BUSINESS_HOURS }
    );

    React.useEffect(() => {
        idsRef.current = loaded.ids;
        setAgentEnabled(loaded.agentEnabled);
        setBusinessHours(loaded.businessHours);
    }, [loaded]);

    /** Best-effort: after a failed/partial save, learn the ids of any record just created so a retry updates it. */
    const refreshIds = async () => {
        try {
            idsRef.current = extractIds(await getConfigs());
        } catch {
            // Keep the known ids; the error the user sees is the save error.
        }
    };

    const mutateRule = (ruleIndex: number, fn: (rule: Rule) => Rule) => {
        setBusinessHours((prev) => ({
            ...prev,
            rules: prev.rules.map((r, i) => (i === ruleIndex ? fn(r) : r)),
        }));
    };

    const toggleDay = (ruleIndex: number, day: DayKey) => {
        mutateRule(ruleIndex, (rule) => ({
            ...rule,
            days: rule.days.includes(day) ? rule.days.filter((d) => d !== day) : [...rule.days, day],
        }));
    };

    const applyPreset = (ruleIndex: number, preset: 'weekdays' | 'weekend' | 'all') => {
        const days = preset === 'weekdays' ? [...WEEKDAYS] : preset === 'weekend' ? [...WEEKEND] : [...DAY_KEYS];
        mutateRule(ruleIndex, (rule) => ({ ...rule, days }));
    };

    const updateRange = (ruleIndex: number, rangeIndex: number, position: 0 | 1, value: string) => {
        mutateRule(ruleIndex, (rule) => ({
            ...rule,
            ranges: rule.ranges.map((r, i) => {
                if (i !== rangeIndex) return r;
                const next = [...r] as TimeRange;
                next[position] = value;
                return next;
            }),
        }));
    };

    const addRange = (ruleIndex: number) => {
        mutateRule(ruleIndex, (rule) => ({ ...rule, ranges: [...rule.ranges, ['09:00', '18:00'] as TimeRange] }));
    };

    const removeRange = (ruleIndex: number, rangeIndex: number) => {
        mutateRule(ruleIndex, (rule) => ({ ...rule, ranges: rule.ranges.filter((_, i) => i !== rangeIndex) }));
    };

    const addRule = () => {
        setBusinessHours((prev) => ({ ...prev, rules: [...prev.rules, { days: [], ranges: [['09:00', '18:00']] }] }));
    };

    const removeRule = (ruleIndex: number) => {
        setBusinessHours((prev) => ({ ...prev, rules: prev.rules.filter((_, i) => i !== ruleIndex) }));
    };

    // Both upserts run under one lock; if the second fails, the message says what was already saved.
    const save = useAsyncAction(
        async (values: { agentEnabled: boolean; hours: BusinessHours }) => {
            const parsed = businessHoursSchema.safeParse(values.hours);
            if (!parsed.success) {
                toast({ variant: 'destructive', title: t('toast.errorTitle'), description: t('toast.validationError') });
                return false;
            }
            await upsertConfig({
                id: idsRef.current.agentEnabled,
                key: AGENT_ENABLED_KEY,
                value: values.agentEnabled ? 'true' : 'false',
                data_type: 'boolean',
                description: 'Habilita el agente conversacional de WhatsApp.',
                is_public: false,
            });
            try {
                await upsertConfig({
                    id: idsRef.current.businessHours,
                    key: BUSINESS_HOURS_KEY,
                    value: JSON.stringify(parsed.data),
                    data_type: 'json',
                    description: 'Ventana horaria en la que el agente de WhatsApp responde consultas.',
                    is_public: false,
                });
            } catch (error) {
                if (isTimeoutError(error)) throw error;
                throw new PartialSaveError(t('toast.partialSaveError'));
            }
            return true;
        },
        {
            onSuccess: async (saved) => {
                if (!saved) return;
                toast({ title: t('toast.successTitle'), description: t('toast.saveSuccess') });
                await loadData();
            },
            onError: (error) => {
                refreshIds();
                toast({
                    variant: 'destructive',
                    title: t('toast.errorTitle'),
                    description: error instanceof PartialSaveError
                        ? error.message
                        : isTimeoutError(error) ? tCommon('timeoutError') : t('toast.saveError'),
                });
            },
            showErrorToast: false,
        }
    );

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col min-h-0 items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Showing the defaults after a failed load would let a save overwrite the real configuration.
    if (loadError) {
        return (
            <div className="flex-1 p-1">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('toast.loadError')}</AlertTitle>
                    <AlertDescription className="flex flex-wrap items-center gap-3">
                        <span>{loadError}</span>
                        <Button size="sm" variant="outline" onClick={() => loadData()} loading={isRefreshing}>
                            {tCommon('retry')}
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <fieldset disabled={save.isPending} className="flex-1 min-w-0 overflow-y-auto space-y-6 p-1">
            <Card className="shadow-sm border-0">
                <CardHeader className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <BotMessageSquare className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col text-left">
                            <CardTitle className="text-lg">{t('title')}</CardTitle>
                            <CardDescription className="text-xs">{t('description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('agent.title')}</CardTitle>
                    <CardDescription>{t('agent.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="agent-enabled">{t('agent.enable')}</Label>
                            <p className="text-sm text-muted-foreground">{t('agent.enableDescription')}</p>
                        </div>
                        <Switch id="agent-enabled" checked={agentEnabled} onCheckedChange={setAgentEnabled} disabled={!canUpdate} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('hours.title')}</CardTitle>
                    <CardDescription>{t('hours.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="hours-enabled">{t('hours.enable')}</Label>
                            <p className="text-sm text-muted-foreground">{t('hours.enableDescription')}</p>
                        </div>
                        <Switch
                            id="hours-enabled"
                            checked={businessHours.enabled}
                            onCheckedChange={(checked) => setBusinessHours((prev) => ({ ...prev, enabled: checked }))}
                            disabled={!canUpdate}
                        />
                    </div>

                    {businessHours.enabled && (
                        <>
                            <div className="space-y-2 max-w-xs">
                                <Label>{t('hours.timezone')}</Label>
                                <Select
                                    value={businessHours.timezone}
                                    onValueChange={(value) => setBusinessHours((prev) => ({ ...prev, timezone: value }))}
                                    disabled={!canUpdate}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {TIMEZONES.map((tz) => (
                                            <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <p className="text-sm text-muted-foreground">{t('hours.rulesHelp')}</p>

                            <div className="space-y-4">
                                {businessHours.rules.map((rule, ruleIndex) => (
                                    <div key={ruleIndex} className="rounded-lg border p-4 space-y-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {DAY_KEYS.map((day) => (
                                                    <Button
                                                        key={day}
                                                        type="button"
                                                        size="sm"
                                                        variant={rule.days.includes(day) ? 'default' : 'outline'}
                                                        className="h-7 px-2.5"
                                                        onClick={() => toggleDay(ruleIndex, day)}
                                                        disabled={!canUpdate}
                                                    >
                                                        {t(`days.${day}`)}
                                                    </Button>
                                                ))}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeRule(ruleIndex)}
                                                disabled={!canUpdate}
                                                aria-label={t('hours.removeRule')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            <button
                                                type="button"
                                                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                                                onClick={() => applyPreset(ruleIndex, 'weekdays')}
                                                disabled={!canUpdate}
                                            >
                                                {t('hours.preset.weekdays')}
                                            </button>
                                            <span className="text-xs text-muted-foreground">·</span>
                                            <button
                                                type="button"
                                                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                                                onClick={() => applyPreset(ruleIndex, 'weekend')}
                                                disabled={!canUpdate}
                                            >
                                                {t('hours.preset.weekend')}
                                            </button>
                                            <span className="text-xs text-muted-foreground">·</span>
                                            <button
                                                type="button"
                                                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                                                onClick={() => applyPreset(ruleIndex, 'all')}
                                                disabled={!canUpdate}
                                            >
                                                {t('hours.preset.all')}
                                            </button>
                                        </div>

                                        {rule.days.length === 0 && (
                                            <p className="text-sm text-destructive">{t('hours.noDays')}</p>
                                        )}

                                        <div className="space-y-2">
                                            {rule.ranges.map((range, rangeIndex) => (
                                                <div key={rangeIndex} className="flex items-center gap-2">
                                                    <Select value={range[0]} onValueChange={(v) => updateRange(ruleIndex, rangeIndex, 0, v)} disabled={!canUpdate}>
                                                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {TIME_OPTIONS.filter((o) => o !== '24:00').map((o) => (
                                                                <SelectItem key={o} value={o}>{o}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <span className="text-muted-foreground">–</span>
                                                    <Select value={range[1]} onValueChange={(v) => updateRange(ruleIndex, rangeIndex, 1, v)} disabled={!canUpdate}>
                                                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {TIME_OPTIONS.filter((o) => o !== '00:00').map((o) => (
                                                                <SelectItem key={o} value={o}>{o}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeRange(ruleIndex, rangeIndex)}
                                                        disabled={!canUpdate || rule.ranges.length <= 1}
                                                        aria-label={t('hours.removeRange')}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => addRange(ruleIndex)}
                                                disabled={!canUpdate}
                                            >
                                                <Plus className="h-4 w-4 mr-1" />
                                                {t('hours.addRange')}
                                            </Button>
                                        </div>
                                    </div>
                                ))}

                                <Button type="button" variant="outline" onClick={addRule} disabled={!canUpdate}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    {t('hours.addRule')}
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="off-hours-reply">{t('hours.offHoursReply')}</Label>
                                <Textarea
                                    id="off-hours-reply"
                                    value={businessHours.off_hours_reply ?? ''}
                                    onChange={(e) => setBusinessHours((prev) => ({ ...prev, off_hours_reply: e.target.value }))}
                                    placeholder={t('hours.offHoursReplyPlaceholder')}
                                    rows={3}
                                    disabled={!canUpdate}
                                />
                                <p className="text-sm text-muted-foreground">{t('hours.offHoursReplyHelp')}</p>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end">
                {canUpdate && (
                    <Button onClick={() => save.run({ agentEnabled, hours: businessHours })} loading={save.isPending}>
                        {t('saveChanges')}
                    </Button>
                )}
            </div>
        </fieldset>
    );
}
