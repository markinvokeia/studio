'use client';

import * as React from 'react';
import { AlertTriangle, BellRing, ChevronDown, Clock, SlidersHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

import { useAsyncAction } from '@/hooks/use-async-action';
import { cn } from '@/lib/utils';
import type { LabStageAlertOptions } from '@/services/lab-stage-alert-options';

import type { LabStageAlertConfig, LabStageAlertTrigger, LabStageAlerts, LabStageKind } from '@/lib/types';

/** Una alerta nueva: avisa en el sistema al doctor de la orden. */
export const DEFAULT_LAB_STAGE_ALERT: LabStageAlertConfig = {
  repeat_every_days: null,
  recipient_role_ids: [],
  recipient_user_ids: [],
  notify_order_doctor: true,
  notify_order_creator: false,
  channel_in_app: true,
  channel_email: false,
  channel_whatsapp: false,
  email_template_id: null,
  whatsapp_template_id: null,
};

export type LabStageAlertIssue = 'noRecipients' | 'noChannel' | 'whatsappTemplate' | 'invalidRepeat';

/** Lo mismo que valida lab_stage_alert_upsert (script 150). */
export function labStageAlertIssues(alert: LabStageAlertConfig | null): LabStageAlertIssue[] {
  if (!alert) return [];
  const issues: LabStageAlertIssue[] = [];
  if (alert.recipient_role_ids.length === 0 && alert.recipient_user_ids.length === 0 && !alert.notify_order_doctor && !alert.notify_order_creator) {
    issues.push('noRecipients');
  }
  if (!alert.channel_in_app && !alert.channel_email && !alert.channel_whatsapp) issues.push('noChannel');
  if (alert.channel_whatsapp && alert.whatsapp_template_id == null) issues.push('whatsappTemplate');
  if (alert.repeat_every_days != null && !(alert.repeat_every_days > 0)) issues.push('invalidRepeat');
  return issues;
}

export interface LabStageAlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName: string;
  stageKind: LabStageKind;
  /** Umbral de atraso de la etapa (días). Sin umbral no hay alerta por permanencia. */
  overdueDays: number | null;
  value: LabStageAlerts;
  options: LabStageAlertOptions | null;
  optionsError: string | null;
  onRetryOptions: () => void;
  disabled?: boolean;
  /**
   * true: "Guardar" guarda las alertas de esta etapa en el momento (etapa ya guardada y sin otros
   * cambios pendientes). false: "Aplicar" las deja en la etapa y se guardan con la página.
   */
  savesNow: boolean;
  /** Guarda (o aplica) las alertas. Si falla, la ventana queda abierta con lo elegido. */
  onSave: (alerts: LabStageAlerts) => Promise<void> | void;
}

/** Sin destinatarios extra, solo en el sistema y una sola vez: se ve como una frase, sin el detalle. */
function isSimpleAlert(alert: LabStageAlertConfig | null): boolean {
  return !alert || (
    alert.recipient_role_ids.length === 0 && alert.recipient_user_ids.length === 0
    && alert.channel_in_app && !alert.channel_email && !alert.channel_whatsapp
    && alert.repeat_every_days == null
  );
}

/**
 * Alertas de una etapa: al entrar y por atraso, cada una con destinatarios y canales. El atraso en la
 * etapa donde se fijó la fecha de entrega es esa fecha (script 177): no hay una alerta aparte.
 */
export function LabStageAlertsDialog({
  open, onOpenChange, stageName, stageKind, overdueDays, value, options, optionsError, onRetryOptions, disabled = false, savesNow, onSave,
}: LabStageAlertsDialogProps) {
  const t = useTranslations('LabStagesPage.alerts');
  const [draft, setDraft] = React.useState<LabStageAlerts>(value);
  const [showIssues, setShowIssues] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft(value);
    setShowIssues(false);
    // Solo al abrir: no pisar lo que se está editando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dwellAvailable = stageKind !== 'final' && overdueDays != null;
  const effective: LabStageAlerts = {
    enter: draft.enter,
    dwell: dwellAvailable ? draft.dwell : null,
  };
  const hasIssues = [effective.enter, effective.dwell].some((alert) => labStageAlertIssues(alert).length > 0);
  const isDirty = JSON.stringify(effective) !== JSON.stringify(value);

  const save = useAsyncAction(async (alerts: LabStageAlerts) => { await onSave(alerts); }, {
    onSuccess: () => onOpenChange(false),
    errorTitle: t('saveError'),
  });

  const apply = () => {
    if (hasIssues) {
      setShowIssues(true);
      return;
    }
    if (!isDirty) {
      onOpenChange(false);
      return;
    }
    void save.run(effective);
  };

  const busy = disabled || save.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && save.isPending) return; onOpenChange(next); }}>
      <DialogContent className="sm:max-w-2xl" confirmOnClose isDirty={isDirty && !save.isPending}>
        <DialogHeader>
          <DialogTitle>{t('title', { stage: stageName })}</DialogTitle>
          <DialogDescription>{savesNow ? t('descriptionNow') : t('description')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 px-6 py-4">
          {optionsError && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <span>{optionsError}</span>
              <Button size="sm" variant="outline" onClick={onRetryOptions}>{t('retry')}</Button>
            </div>
          )}

          <AlertSection
            trigger="enter"
            icon={<BellRing className="h-4 w-4" />}
            value={draft.enter}
            onChange={(enter) => setDraft((d) => ({ ...d, enter }))}
            options={options}
            disabled={busy}
            showIssues={showIssues}
          />

          {dwellAvailable ? (
            <AlertSection
              trigger="dwell"
              icon={<Clock className="h-4 w-4" />}
              overdueDays={overdueDays}
              value={draft.dwell}
              onChange={(dwell) => setDraft((d) => ({ ...d, dwell }))}
              options={options}
              disabled={busy}
              showIssues={showIssues}
            />
          ) : (
            <section className="rounded-xl border border-dashed border-border p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Clock className="h-4 w-4" />
                {t('dwell.title', { days: 0 })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {stageKind === 'final' ? t('dwell.notForFinal') : t('dwell.needsThreshold')}
              </p>
            </section>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogCancelButton disabled={save.isPending}>{t('cancel')}</DialogCancelButton>
          <Button data-help-id="config.lab-stages.btn.apply-alerts" onClick={apply} disabled={disabled} loading={save.isPending}>
            {savesNow ? t('save') : t('apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AlertSectionProps {
  trigger: LabStageAlertTrigger;
  icon: React.ReactNode;
  overdueDays?: number | null;
  value: LabStageAlertConfig | null;
  onChange: (value: LabStageAlertConfig | null) => void;
  options: LabStageAlertOptions | null;
  disabled: boolean;
  showIssues: boolean;
  /** Configuración con la que arranca al encenderla. */
  defaultValue?: LabStageAlertConfig;
}

function AlertSection({
  trigger, icon, overdueDays, value, onChange, options, disabled, showIssues, defaultValue = DEFAULT_LAB_STAGE_ALERT,
}: AlertSectionProps) {
  const t = useTranslations('LabStagesPage.alerts');
  const locale = useLocale();
  const [userFilter, setUserFilter] = React.useState('');
  const enabled = value !== null;
  const issues = labStageAlertIssues(value);
  // Lo avanzado (frecuencia, roles, usuarios, canales) queda plegado salvo que ya se use.
  const [customizing, setCustomizing] = React.useState(() => !isSimpleAlert(value));
  React.useEffect(() => {
    if (showIssues && issues.length > 0) setCustomizing(true);
  }, [showIssues, issues.length]);
  const patch = (p: Partial<LabStageAlertConfig>) => value && onChange({ ...value, ...p });
  const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const staff = options?.staff ?? [];
  const filteredStaff = userFilter.trim()
    ? staff.filter((u) => u.name.toLowerCase().includes(userFilter.trim().toLowerCase()))
    : staff;

  return (
    <section data-help-id={`config.lab-stages.section.alert-${trigger}`} className={cn('space-y-3 rounded-xl border p-3', enabled ? 'border-border bg-card' : 'border-dashed border-border')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {icon}
            {trigger === 'dwell' ? t('dwell.title', { days: overdueDays ?? 0 }) : t(`${trigger}.title`)}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t(`${trigger}.hint`)}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(on) => onChange(on ? { ...defaultValue } : null)}
          disabled={disabled}
          aria-label={trigger === 'dwell' ? t('dwell.title', { days: overdueDays ?? 0 }) : t(`${trigger}.title`)}
        />
      </div>

      {value && (
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('min-w-0 flex-1 basis-60 text-sm', issues.includes('noRecipients') || issues.includes('noChannel') ? 'text-destructive' : 'text-foreground')}>
            {alertSummary(value, trigger, options, locale, t)}
          </p>
          {!customizing && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('recipients.title')}>
              {([['notify_order_doctor', 'orderDoctor'], ['notify_order_creator', 'orderCreator']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => patch({ [key]: !value[key] })}
                  aria-pressed={value[key]}
                  disabled={disabled}
                  data-help-id={`config.lab-stages.toggle.alert-${label === 'orderDoctor' ? 'doctor' : 'creator'}`}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60',
                    value[key] ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
                  )}
                >
                  {t(`recipients.${label}`)}
                </button>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            data-help-id={`config.lab-stages.btn.customize-${trigger}`}
            aria-expanded={customizing}
            onClick={() => setCustomizing((v) => !v)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t('customize')}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', customizing && 'rotate-180')} />
          </Button>
        </div>
      )}

      {value && customizing && (
        <div className="space-y-4 border-t border-border pt-3">
          {trigger !== 'enter' && (
            <div className="grid gap-2 sm:grid-cols-[12rem_8rem] sm:items-end">
              <div className="space-y-1">
                <Label className="text-xs">{t('repeat.label')}</Label>
                <Select
                  value={value.repeat_every_days == null ? 'once' : 'repeat'}
                  onValueChange={(mode) => patch({ repeat_every_days: mode === 'once' ? null : (value.repeat_every_days ?? 3) })}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">{t('repeat.once')}</SelectItem>
                    <SelectItem value="repeat">{t('repeat.every')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {value.repeat_every_days != null && (
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={value.repeat_every_days || ''}
                    onChange={(e) => patch({ repeat_every_days: Number.parseInt(e.target.value, 10) || 0 })}
                    disabled={disabled}
                    aria-label={t('repeat.days')}
                    className="h-9 pr-12"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{t('repeat.daysSuffix')}</span>
                </div>
              )}
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold">{t('recipients.title')}</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <CheckRow label={t('recipients.orderDoctor')} checked={value.notify_order_doctor} onChange={(v) => patch({ notify_order_doctor: v })} disabled={disabled} />
              <CheckRow label={t('recipients.orderCreator')} checked={value.notify_order_creator} onChange={(v) => patch({ notify_order_creator: v })} disabled={disabled} />
            </div>
            {!options ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('recipients.roles')}</p>
                  <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border p-2">
                    {options.roles.map((role) => (
                      <CheckRow
                        key={role.id}
                        label={role.name}
                        checked={value.recipient_role_ids.includes(role.id)}
                        onChange={() => patch({ recipient_role_ids: toggleIn(value.recipient_role_ids, role.id) })}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t('recipients.users')}
                    {value.recipient_user_ids.length > 0 && ` · ${t('recipients.selected', { count: value.recipient_user_ids.length })}`}
                  </p>
                  <div className="space-y-1.5 rounded-md border p-2">
                    <Input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder={t('recipients.searchUsers')} className="h-8" />
                    <div className="max-h-28 space-y-1.5 overflow-y-auto">
                      {filteredStaff.map((user) => (
                        <CheckRow
                          key={user.id}
                          label={user.name}
                          checked={value.recipient_user_ids.includes(user.id)}
                          onChange={() => patch({ recipient_user_ids: toggleIn(value.recipient_user_ids, user.id) })}
                          disabled={disabled}
                        />
                      ))}
                      {filteredStaff.length === 0 && <p className="text-xs text-muted-foreground">{t('recipients.noUsers')}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold">{t('channels.title')}</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <CheckRow label={t('channels.inApp')} checked={value.channel_in_app} onChange={(v) => patch({ channel_in_app: v })} disabled={disabled} />
              <CheckRow label={t('channels.email')} checked={value.channel_email} onChange={(v) => patch({ channel_email: v })} disabled={disabled} />
              <CheckRow label={t('channels.whatsapp')} checked={value.channel_whatsapp} onChange={(v) => patch({ channel_whatsapp: v })} disabled={disabled} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {value.channel_email && (
                <div className="space-y-1">
                  <Label className="text-xs">{t('channels.emailTemplate')}</Label>
                  <Select
                    value={value.email_template_id == null ? 'default' : String(value.email_template_id)}
                    onValueChange={(v) => patch({ email_template_id: v === 'default' ? null : Number(v) })}
                    disabled={disabled || !options}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t('channels.defaultEmail')}</SelectItem>
                      {options?.emailTemplates.map((tpl) => (
                        <SelectItem key={tpl.id} value={String(tpl.id)}>{tpl.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {value.channel_whatsapp && (
                <div className="space-y-1">
                  <Label className="text-xs">{t('channels.whatsappTemplate')}</Label>
                  <Select
                    value={value.whatsapp_template_id == null ? '' : String(value.whatsapp_template_id)}
                    onValueChange={(v) => patch({ whatsapp_template_id: Number(v) })}
                    disabled={disabled || !options}
                  >
                    <SelectTrigger className="h-9" aria-invalid={showIssues && issues.includes('whatsappTemplate')}>
                      <SelectValue placeholder={t('channels.chooseTemplate')} />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.whatsappTemplates.map((tpl) => (
                        <SelectItem key={tpl.id} value={String(tpl.id)}>
                          {tpl.name}{tpl.entity_type && tpl.entity_type !== 'lab_order' ? ` · ${t('channels.otherEntity')}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">{t('channels.whatsappHint')}</p>
                </div>
              )}
            </div>
          </fieldset>

          {showIssues && issues.length > 0 && (
            <ul role="alert" className="space-y-0.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {issues.map((issue) => (
                <li key={issue} className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />{t(`issues.${issue}`)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** "Se avisa al doctor de la orden en el sistema, una sola vez.": la alerta en una frase. */
function alertSummary(
  alert: LabStageAlertConfig,
  trigger: LabStageAlertTrigger,
  options: LabStageAlertOptions | null,
  locale: string,
  t: ReturnType<typeof useTranslations<'LabStagesPage.alerts'>>,
): string {
  const list = (items: string[]) => new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
  const roleNames = alert.recipient_role_ids
    .map((id) => options?.roles.find((r) => r.id === id)?.name)
    .filter((name): name is string => !!name);
  const roles = roleNames.length === alert.recipient_role_ids.length
    ? roleNames.map((name) => t('summary.role', { name }))
    : [t('summary.roles', { count: alert.recipient_role_ids.length })];
  const who = [
    alert.notify_order_doctor ? t('summary.orderDoctor') : null,
    alert.notify_order_creator ? t('summary.orderCreator') : null,
    ...(alert.recipient_role_ids.length > 0 ? roles : []),
    alert.recipient_user_ids.length > 0 ? t('summary.users', { count: alert.recipient_user_ids.length }) : null,
  ].filter((x): x is string => !!x);
  if (who.length === 0) return t('issues.noRecipients');
  const channels = [
    alert.channel_in_app ? t('summary.inApp') : null,
    alert.channel_email ? t('summary.email') : null,
    alert.channel_whatsapp ? t('summary.whatsapp') : null,
  ].filter((x): x is string => !!x);
  if (channels.length === 0) return t('issues.noChannel');
  if (trigger === 'enter') return t('summary.each', { who: list(who), channels: list(channels) });
  const repeats = alert.repeat_every_days != null && alert.repeat_every_days > 0;
  return repeats
    ? t('summary.repeat', { who: list(who), channels: list(channels), days: alert.repeat_every_days ?? 0 })
    : t('summary.once', { who: list(who), channels: list(channels) });
}

function CheckRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  const id = React.useId();
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} disabled={disabled} />
      <label htmlFor={id} className="cursor-pointer truncate text-sm">{label}</label>
    </div>
  );
}
