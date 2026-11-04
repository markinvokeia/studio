'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { subMonths } from 'date-fns';
import { Check, FileSignature, Lock, MapPin, Minus, Printer, Repeat, Shapes } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useAsyncAction } from '@/hooks/use-async-action';
import { useInvalidSubmitToast } from '@/hooks/use-invalid-submit-toast';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDate, formatDateTime, formatDisplayDate, toLocalISOString } from '@/lib/utils';
import { signAestheticConsents, type AestheticConsentDraft } from '@/services/aesthetic-record';

import type { AestheticLayer, AestheticMarkKind, AestheticPhotoConsent, AestheticServiceConsent, ServiceAestheticConfig } from '@/lib/types';
import { printConsent } from './consent-print';
import { renderConsentTemplate } from './consent-template';
import { formatQuantity, layerColor, layerTitle, newLayer } from './layers';
import { useSessionFlow } from './session-flow-context';
import { isServiceSigned } from './session-status';
import { SignaturePad } from './signature-pad';
import { useAestheticFileUrl } from './use-aesthetic-file-url';

/** A consent of the same service signed this long ago can be used again with one tap */
export const CONSENT_REUSE_MONTHS = 12;

const TOOL_ICONS: Record<AestheticMarkKind, React.ElementType> = { point: MapPin, area: Shapes, line: Minus };

const signSchema = (t: ReturnType<typeof useTranslations>) =>
  z.object({
    signerName: z.string().trim().min(1, t('consent.validation.signerRequired')),
    risksExplained: z.boolean().refine((v) => v, t('consent.validation.risksRequired')),
    allowsClinicalPhotos: z.boolean(),
    allowsMarketingPhotos: z.boolean(),
    signature: z.custom<File>((v) => typeof File !== 'undefined' && v instanceof File, t('consent.validation.signatureRequired')),
  });

type SignValues = z.infer<ReturnType<typeof signSchema>>;

export function StepConsent() {
  const t = useTranslations('AestheticRecord');
  const { toast } = useToast();
  const flow = useSessionFlow();
  const { draft, updateDraft, setLayers, stored, configs, configsError, templates, readOnly, previousSessions, patientName, goToStep, done } = flow;
  const layers = draft.layers;
  const consents = stored?.consents ?? [];
  const pending = layers.filter((l) => !isServiceSigned(consents, l.serviceId));
  const [openText, setOpenText] = React.useState<string | null>(null);

  // ── Services ──
  const offered = configs.filter((c) => c.isActive || layers.some((l) => l.serviceId === c.serviceId));
  const lastWithServices = [...previousSessions].reverse().find((s) => s.layers.some((l) => l.serviceId));

  function toggleService(config: ServiceAestheticConfig) {
    const existing = layers.find((l) => l.serviceId === config.serviceId);
    if (existing) {
      if (existing.marks.length) {
        toast({ variant: 'destructive', title: t('flow.consent.hasMarks', { service: config.serviceName }) });
        return;
      }
      setLayers((list) => list.filter((l) => l.id !== existing.id));
      return;
    }
    setLayers((list) => [...list, { ...newLayer(config), color: config.serviceColor }]);
  }

  function addServices(serviceIds: string[]) {
    const toAdd = configs.filter((c) => serviceIds.includes(c.serviceId) && c.isActive && !layers.some((l) => l.serviceId === c.serviceId));
    if (toAdd.length) setLayers((list) => [...list, ...toAdd.map((c) => newLayer(c))]);
  }

  // ── Consent texts ──
  const patient = patientName || t('consent.patientFallback');
  const doctor = draft.doctorName || t('consent.doctorFallback');
  const consentDraft = React.useCallback((layer: AestheticLayer): AestheticConsentDraft => {
    const template = templates.find((tpl) => tpl.serviceId === layer.serviceId);
    const title = template?.title || t('consent.defaultTitle', { service: layer.serviceName });
    const text = template
      ? renderConsentTemplate(template.body, {
        patient_name: patient,
        doctor_name: doctor,
        service_name: layer.serviceName,
        product_name: layer.productName.trim() || layer.serviceName,
        session_date: formatDisplayDate(draft.date),
      })
      : t('consent.template', { patient, procedure: layerTitle(layer), doctor });
    return { serviceId: layer.serviceId!, serviceName: layer.serviceName, title, text, templateUpdatedAt: template?.updatedAt || undefined };
  }, [templates, patient, doctor, draft.date, t]);

  /** A consent of the same service, still in force and signed on the current text of its template */
  const reusableFor = React.useCallback((layer: AestheticLayer): AestheticServiceConsent | null => {
    if (!layer.serviceId) return null;
    const template = templates.find((tpl) => tpl.serviceId === layer.serviceId);
    const since = toLocalISOString(subMonths(new Date(), CONSENT_REUSE_MONTHS));
    const candidates = previousSessions
      .flatMap((s) => s.consents)
      .filter((c) => c.serviceId === layer.serviceId && c.signedAt >= since && (c.templateUpdatedAt || '') === (template?.updatedAt || ''))
      .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
    return candidates[0] ?? null;
  }, [previousSessions, templates]);

  // ── Signing ──
  const onInvalid = useInvalidSubmitToast();
  const lastPhotoConsent = stored?.photoConsent ?? [...previousSessions].reverse().find((s) => s.photoConsent)?.photoConsent ?? null;
  const defaults = React.useCallback((): Partial<SignValues> => ({
    signerName: patientName || '',
    risksExplained: false,
    allowsClinicalPhotos: lastPhotoConsent?.allowsClinicalPhotos ?? true,
    allowsMarketingPhotos: lastPhotoConsent?.allowsMarketingPhotos ?? false,
    signature: undefined,
  }), [patientName, lastPhotoConsent]);
  const form = useForm<SignValues>({ resolver: zodResolver(signSchema(t)), defaultValues: defaults() });
  const [padKey, setPadKey] = React.useState(0);
  const [signError, setSignError] = React.useState<string | null>(null);
  const signature = useWatch({ control: form.control, name: 'signature' });

  const sign = useAsyncAction(
    async (values: SignValues) => {
      const sessionId = await flow.ensureSaved();
      return signAestheticConsents(sessionId, {
        signerName: values.signerName.trim(),
        signedAt: toLocalISOString(new Date()),
        allowsClinicalPhotos: values.allowsClinicalPhotos,
        allowsMarketingPhotos: values.allowsMarketingPhotos,
        consents: pending.filter((l) => l.serviceId).map(consentDraft),
        signature: values.signature,
      });
    },
    {
      onSuccess: (session) => {
        flow.applyServer(session);
        toast({ title: t('consent.toastSigned', { count: pending.length }), description: t('flow.consent.storedSeparately') });
        setSignError(null);
        setPadKey((k) => k + 1);
        form.reset({ ...form.getValues(), risksExplained: false, signature: undefined });
      },
      onError: (error) => setSignError(flow.reportError(error)),
      showErrorToast: false,
    },
  );

  const permissionsText = (consent: Pick<AestheticPhotoConsent, 'allowsClinicalPhotos' | 'allowsMarketingPhotos'>) => [
    t(consent.allowsClinicalPhotos ? 'flow.consent.clinicalAllowed' : 'flow.consent.clinicalDeclined'),
    t(consent.allowsMarketingPhotos ? 'flow.consent.marketingAllowed' : 'flow.consent.marketingDeclined'),
  ].join(' · ');

  // Reusing never changes what the patient decided in this session: it keeps the permissions of
  // the session's last signature, or takes those of the reused one if nothing is signed yet. The
  // server enforces it (database/scripts/158); these values only say the same.
  const reuse = useAsyncAction(
    async (layer: AestheticLayer) => {
      const previous = reusableFor(layer);
      if (!previous) return null;
      const permissions = stored?.photoConsent ?? previous;
      const sessionId = await flow.ensureSaved();
      return signAestheticConsents(sessionId, {
        signerName: previous.signerName,
        signedAt: toLocalISOString(new Date()),
        allowsClinicalPhotos: permissions.allowsClinicalPhotos,
        allowsMarketingPhotos: permissions.allowsMarketingPhotos,
        consents: [consentDraft(layer)],
        reuseSignatureId: previous.signatureId,
      });
    },
    {
      onSuccess: (session) => {
        if (!session) return;
        flow.applyServer(session);
        const permissions = session.photoConsent;
        toast({ title: t('flow.consent.reused'), description: permissions ? t('flow.consent.sessionPermissions', { permissions: permissionsText(permissions) }) : undefined });
        // The next signature drawn starts from what the session has now
        if (permissions) {
          form.setValue('allowsClinicalPhotos', permissions.allowsClinicalPhotos);
          form.setValue('allowsMarketingPhotos', permissions.allowsMarketingPhotos);
        }
      },
      errorTitle: t('flow.consent.reuseError'),
      describeError: flow.reportError,
    },
  );

  const busy = sign.isPending || reuse.isPending;
  const signable = pending.filter((l) => l.serviceId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('flow.stepOf', { step: 1 })}</p>
          <h2 className="text-xl font-semibold leading-tight">{t('flow.consent.title')}</h2>
          <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">{t('flow.consent.lead')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="aes-session-date" className="text-xs">{t('session.date')}</Label>
            <Input
              id="aes-session-date"
              type="date"
              value={draft.date}
              max={formatDate(new Date())}
              onChange={(e) => e.target.value && updateDraft({ date: e.target.value })}
              disabled={readOnly}
              className="h-9 w-[9.5rem] text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t('session.doctor')}</Label>
            <DoctorSelector
              value={draft.doctorId}
              selectedDoctorName={draft.doctorName}
              onValueChange={(id, picked) => updateDraft({ doctorId: id || undefined, doctorName: picked?.name })}
              triggerText={t('session.doctorPick')}
              placeholder={t('session.doctorSearch')}
              emptyText={t('session.doctorEmpty')}
              loadingText={t('session.doctorLoading')}
              disabled={readOnly}
              className="h-9 w-52 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        {/* Services of today */}
        <section className="flex min-w-0 flex-[1_1_440px] flex-col gap-3 rounded-2xl border bg-card p-4" aria-labelledby="aes-services-title">
          <div className="flex items-center gap-2">
            <h3 id="aes-services-title" className="text-[15px] font-semibold">{t('flow.consent.services')}</h3>
            <span className="ml-auto text-xs text-muted-foreground">{t('flow.consent.selected', { count: layers.length })}</span>
          </div>
          {!readOnly && lastWithServices && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => addServices(lastWithServices.layers.map((l) => l.serviceId).filter((id): id is string => !!id))}
              >
                + {t('flow.consent.fromLastSession', { date: formatDisplayDate(lastWithServices.date) })}
              </Button>
            </div>
          )}
          {configsError && <Alert variant="destructive"><AlertDescription>{configsError}</AlertDescription></Alert>}
          {!configsError && offered.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">{t('layers.noConfigs')}</p>}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5">
            {(readOnly ? offered.filter((c) => layers.some((l) => l.serviceId === c.serviceId)) : offered).map((config, index) => {
              const selected = layers.some((l) => l.serviceId === config.serviceId);
              const color = config.serviceColor || layerColor({ color: null }, index);
              const ToolIcon = TOOL_ICONS[config.markingTool];
              return (
                <button
                  key={config.serviceId}
                  type="button"
                  aria-pressed={selected}
                  disabled={readOnly}
                  onClick={() => toggleService(config)}
                  style={{ '--c': color } as React.CSSProperties}
                  className={cn(
                    'relative flex min-h-[92px] flex-col gap-1 rounded-xl border-[1.5px] bg-card p-3 pl-3.5 text-left transition-colors disabled:cursor-default',
                    selected ? 'border-[var(--c)] bg-[color-mix(in_srgb,var(--c)_7%,transparent)]' : 'hover:border-foreground/25',
                  )}
                >
                  <span className="mb-1 h-[3px] w-7 rounded-full bg-[var(--c)]" aria-hidden />
                  <span className="pr-7 text-sm font-semibold leading-tight">{config.serviceName}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ToolIcon className="h-3 w-3" />
                    {t(`serviceConfig.tools.${config.markingTool}`)} · {config.unitSymbol}
                    {config.defaultQuantity != null && ` · ${t('flow.consent.perMark', { quantity: formatQuantity(config.defaultQuantity), unit: config.unitSymbol })}`}
                  </span>
                  <span className={cn('absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full border-[1.5px] text-white', selected ? 'border-[var(--c)] bg-[var(--c)]' : 'border-border')} aria-hidden>
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                  {isServiceSigned(consents, config.serviceId) && (
                    <span className="mt-1 self-start rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{t('flow.consent.signed')}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Consents */}
        <section className="flex min-w-0 flex-[1_1_420px] flex-col gap-3 rounded-2xl border bg-card p-4" aria-labelledby="aes-consents-title">
          <div className="flex items-center gap-2">
            <h3 id="aes-consents-title" className="text-[15px] font-semibold">{t('flow.consent.consents')}</h3>
            {layers.length > 0 && (
              <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold', pending.length ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400')}>
                {pending.length ? t('flow.consent.pendingCount', { count: pending.length }) : t('flow.consent.allSigned')}
              </span>
            )}
          </div>

          {layers.length === 0 && <p className="py-2 text-sm text-muted-foreground">{t('flow.consent.pickFirst')}</p>}
          {stored?.photoConsent && (
            <p className="text-xs text-muted-foreground">{t('flow.consent.sessionPermissions', { permissions: permissionsText(stored.photoConsent) })}</p>
          )}

          {layers.map((layer, index) => {
            const signed = consents.find((c) => c.serviceId === layer.serviceId);
            const reusable = !signed && !readOnly ? reusableFor(layer) : null;
            const isOpen = openText === layer.id;
            const text = signed ? { title: signed.title, text: signed.text } : layer.serviceId ? consentDraft(layer) : null;
            return (
              <div key={layer.id} className="flex flex-col gap-2 rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: layerColor(layer, index) }} aria-hidden />
                  <span className="text-sm font-semibold">{layer.serviceName}</span>
                  {signed ? (
                    <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {signed.signatureSource === 'reused'
                        ? t('flow.consent.reusedOn', { date: formatDisplayDate(signed.signedAt) })
                        : t('flow.consent.signedAt', { date: formatDateTime(signed.signedAt) })}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">{t('flow.consent.pending')}</span>
                  )}
                  <span className="flex-1" />
                  {reusable && (
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} loading={reuse.isPending} onClick={() => reuse.run(layer)}>
                      <Repeat className="mr-1 h-3 w-3" />
                      {t('flow.consent.reuse', { date: formatDisplayDate(reusable.signedAt) })}
                    </Button>
                  )}
                  {text && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" aria-expanded={isOpen} onClick={() => setOpenText(isOpen ? null : layer.id)}>
                      {isOpen ? t('consent.hideText') : t('flow.consent.showText')}
                    </Button>
                  )}
                </div>
                {reusable && (
                  <p className="text-xs text-muted-foreground">
                    {stored?.photoConsent
                      ? t('flow.consent.reuseKeeps', { permissions: permissionsText(stored.photoConsent) })
                      : t('flow.consent.reuseInherits', { permissions: permissionsText(reusable) })}
                  </p>
                )}
                {isOpen && text && (
                  <div className="max-h-52 overflow-y-auto rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
                    <p className="mb-1.5 font-semibold">{text.title}</p>
                    <p className="whitespace-pre-wrap">{text.text}</p>
                    {signed && <SignedFooter consent={signed} />}
                  </div>
                )}
              </div>
            );
          })}

          {!readOnly && signable.length > 0 && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(sign.run, onInvalid)} className="flex flex-col gap-3 border-t pt-3">
                {signError && <Alert variant="destructive"><AlertDescription>{signError}</AlertDescription></Alert>}
                <p className="text-xs text-muted-foreground">{t('flow.consent.authorizationsOnce')}</p>
                {(['risksExplained', 'allowsClinicalPhotos', 'allowsMarketingPhotos'] as const).map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field, fieldState }) => (
                      <FormItem className="flex flex-row items-start gap-2.5 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(v) => field.onChange(v === true)}
                            disabled={busy}
                            className={cn('mt-0.5', fieldState.error && 'border-destructive ring-2 ring-destructive/25')}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-snug">
                          <FormLabel className="text-sm font-normal">
                            {t(`consent.${name}`)} <span className="text-xs text-muted-foreground">· {t(`flow.consent.authorizationHints.${name}`)}</span>
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                ))}
                <FormField
                  control={form.control}
                  name="signerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{t('flow.consent.signerName')}</FormLabel>
                      <FormControl><Input {...field} autoComplete="off" disabled={busy} className="h-9" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="signature"
                  render={({ fieldState }) => (
                    <FormItem>
                      <SignaturePad
                        resetKey={padKey}
                        label={t('consent.signature')}
                        placeholder={t('flow.consent.signHere')}
                        invalid={!!fieldState.error}
                        disabled={busy}
                        onChange={(file) => form.setValue('signature', file as File, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={busy || !signature} onClick={() => { setPadKey((k) => k + 1); form.setValue('signature', undefined as unknown as File); }}>
                    {t('flow.consent.clearSignature')}
                  </Button>
                  <span className="flex-1" />
                  <Button type="submit" loading={sign.isPending} disabled={reuse.isPending}>
                    <FileSignature className="mr-1.5 h-4 w-4" />
                    {t('consent.submit', { count: signable.length })}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-xs text-muted-foreground">
          {done[1] ? t('flow.consent.readyHint') : layers.some((l) => isServiceSigned(consents, l.serviceId)) ? t('flow.consent.partialHint') : t('flow.consent.continueHint')}
        </span>
        {!done[1] && layers.some((l) => isServiceSigned(consents, l.serviceId)) && (
          <Button type="button" variant="outline" onClick={() => goToStep(3)}>
            <Lock className="mr-1.5 h-3.5 w-3.5" />
            {t('flow.consent.treatSigned')}
          </Button>
        )}
        <Button type="button" onClick={() => goToStep(2)} disabled={!done[1] && !readOnly}>{t('flow.consent.continue')}</Button>
      </div>
    </div>
  );
}

/** Who signed, when, how (drawn or reused) and the hash of what was signed; with a print copy */
function SignedFooter({ consent }: { consent: AestheticServiceConsent }) {
  const t = useTranslations('AestheticRecord');
  const url = useAestheticFileUrl(consent.signatureFileId);
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 border-t pt-2 text-[11px] text-muted-foreground">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- stored signature (object URL)
        <img src={url} alt={t('consent.signature')} className="h-12 rounded bg-white object-contain px-1" />
      )}
      <div className="min-w-0 flex-1">
        <p>{t('consent.signedBy', { name: consent.signerName, date: formatDateTime(consent.signedAt) })}{consent.signatureSource === 'reused' && ` · ${t('consent.reusedBadge')}`}</p>
        {consent.contentSha256 && <p className="truncate font-mono" title={consent.contentSha256}>SHA-256 {consent.contentSha256.slice(0, 16)}…</p>}
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={() => printConsent(consent, url ?? null, {
          signer: t('consent.signerName'),
          date: t('consent.signedAt'),
          signature: t('consent.signature'),
          reusedSignature: t('consent.reusedPrintNote'),
          clinicalPhotos: t('consent.allowsClinicalPhotos'),
          marketingPhotos: t('consent.allowsMarketingPhotos'),
          yes: t('consent.yes'),
          no: t('consent.no'),
        })}
      >
        <Printer className="mr-1 h-3 w-3" />
        {t('consent.print')}
      </Button>
    </div>
  );
}
