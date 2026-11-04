'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { subMonths } from 'date-fns';
import { Check, FileSignature, Info, Lock, MapPin, Minus, Printer, Repeat, Shapes } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { useAsyncAction } from '@/hooks/use-async-action';
import { useInvalidSubmitToast } from '@/hooks/use-invalid-submit-toast';
import { usePanelWidth } from '@/hooks/use-panel-width';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDate, formatDateTime, formatDisplayDate, toLocalISOString } from '@/lib/utils';
import { signAestheticConsents, type AestheticConsentDraft } from '@/services/aesthetic-record';

import type { AestheticLayer, AestheticMarkKind, AestheticPhotoConsent, AestheticServiceConsent, ServiceAestheticConfig } from '@/lib/types';
import { printConsent } from './consent-print';
import { renderConsentTemplate } from './consent-template';
import { Hint } from './hint';
import { formatQuantity, layerColor, layerTitle, newLayer } from './layers';
import { useSessionFlow } from './session-flow-context';
import { isServiceSigned } from './session-status';
import { SignaturePad } from './signature-pad';
import { useAestheticFileUrl } from './use-aesthetic-file-url';

/** A consent of the same service signed this long ago can be used again with one tap */
export const CONSENT_REUSE_MONTHS = 12;

/** Panel width from which services and signature sit side by side and the step stops scrolling */
const TWO_COLUMNS_WIDTH = 860;
/** Panel width under which it is a phone: only there the sheet gets this narrow */
const COMPACT_WIDTH = 640;
const SIGN_FORM_ID = 'aes-consent-sign-form';
/** Room left above the consent's text when "see text" brings it into view */
const TEXT_SCROLL_GAP = 12;

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
  const rootRef = React.useRef<HTMLDivElement>(null);
  const width = usePanelWidth(rootRef);
  const twoColumns = width === 0 || width >= TWO_COLUMNS_WIDTH;
  const compact = width > 0 && width < COMPACT_WIDTH;
  const textRef = React.useRef<HTMLElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);

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
    const layer = { ...newLayer(config), color: config.serviceColor };
    setLayers((list) => [...list, layer]);
    setOpenText(layer.id);
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
        setOpenText(null);
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
  const showSignForm = !readOnly && signable.length > 0;

  // One row per service: the catalog's, plus any of the session no longer in the catalog (its consent still counts)
  const items = [
    ...(readOnly ? offered.filter((c) => layers.some((l) => l.serviceId === c.serviceId)) : offered).map((config) => ({
      key: config.serviceId,
      name: config.serviceName,
      config: config as ServiceAestheticConfig | null,
      layer: layers.find((l) => l.serviceId === config.serviceId) ?? null,
    })),
    ...layers.filter((l) => !configs.some((c) => c.serviceId === l.serviceId)).map((layer) => ({
      key: layer.id,
      name: layer.serviceName,
      config: null as ServiceAestheticConfig | null,
      layer: layer as AestheticLayer | null,
    })),
  ];

  // The text on screen: the one asked for, or else the next one to sign
  const textLayer = layers.find((l) => l.id === openText && l.serviceId) ?? pending.find((l) => l.serviceId) ?? layers.find((l) => l.serviceId) ?? null;
  const textSigned = textLayer ? consents.find((c) => c.serviceId === textLayer.serviceId) : undefined;
  const shownText = textSigned ? { title: textSigned.title, text: textSigned.text } : textLayer?.serviceId ? consentDraft(textLayer) : null;

  const statusChip = layers.length > 0 && (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', pending.length ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400')}>
      {pending.length ? t('flow.consent.pendingCount', { count: pending.length }) : t('flow.consent.allSigned')}
    </span>
  );

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      <div ref={bodyRef} className={cn('flex min-h-0 flex-1 flex-col gap-3.5 p-3.5', !twoColumns && 'overflow-y-auto')}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="min-w-0 text-base font-semibold leading-tight">{t('flow.consent.title')}</h2>
          <div className={cn('flex flex-wrap items-center gap-2', compact && 'w-full flex-nowrap')}>
            <Input
              id="aes-session-date"
              type="date"
              aria-label={t('session.date')}
              value={draft.date}
              max={formatDate(new Date())}
              onChange={(e) => e.target.value && updateDraft({ date: e.target.value })}
              disabled={readOnly}
              className={cn('h-9 text-sm', compact ? 'min-w-0 flex-1' : 'w-[9.5rem]')}
            />
            <DoctorSelector
              value={draft.doctorId}
              selectedDoctorName={draft.doctorName}
              onValueChange={(id, picked) => updateDraft({ doctorId: id || undefined, doctorName: picked?.name })}
              triggerText={t('session.doctorPick')}
              placeholder={t('session.doctorSearch')}
              emptyText={t('session.doctorEmpty')}
              loadingText={t('session.doctorLoading')}
              disabled={readOnly}
              className={cn('h-9 text-sm', compact ? 'w-auto min-w-0 flex-1' : 'w-52')}
            />
          </div>
        </div>

        <div className={cn('flex gap-3.5', twoColumns ? 'min-h-0 flex-1' : 'flex-col')}>
          {/* Services of today and the state of their consents */}
          <section className={cn('flex min-w-0 flex-col gap-2.5 rounded-2xl border bg-card p-3.5', twoColumns && 'min-h-0 flex-[5] basis-0')} aria-labelledby="aes-services-title">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <h3 id="aes-services-title" className="text-[15px] font-semibold">{t('flow.consent.services')}</h3>
              <span className="text-xs text-muted-foreground">{t('flow.consent.selected', { count: layers.length })}</span>
              <span className="flex-1" />
              {!readOnly && lastWithServices && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs max-sm:h-9"
                  onClick={() => addServices(lastWithServices.layers.map((l) => l.serviceId).filter((id): id is string => !!id))}
                >
                  + {t('flow.consent.fromLastSession', { date: formatDisplayDate(lastWithServices.date) })}
                </Button>
              )}
            </div>
            {configsError && <Alert variant="destructive"><AlertDescription>{configsError}</AlertDescription></Alert>}
            {!configsError && items.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">{t('layers.noConfigs')}</p>}
            <div className={cn('flex flex-col gap-1.5 overflow-y-auto', twoColumns && 'min-h-0 flex-1')}>
              {items.map(({ key, name, config, layer }, index) => {
                const selected = !!layer;
                const color = layer ? layerColor(layer, layers.indexOf(layer)) : config?.serviceColor || layerColor({ color: null }, index);
                const ToolIcon = config ? TOOL_ICONS[config.markingTool] : null;
                const signed = layer ? consents.find((c) => c.serviceId === layer.serviceId) : undefined;
                const reusable = layer && !signed && !readOnly ? reusableFor(layer) : null;
                return (
                  <div
                    key={key}
                    style={{ '--c': color } as React.CSSProperties}
                    className={cn(
                      'flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border-[1.5px] px-3 py-1.5 transition-colors',
                      selected ? 'border-[var(--c)] bg-[color-mix(in_srgb,var(--c)_7%,transparent)]' : 'hover:border-foreground/25',
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={selected}
                      disabled={readOnly || !config}
                      onClick={() => { if (config) toggleService(config); }}
                      className="flex min-w-0 flex-[1_1_7rem] items-center gap-2.5 py-0.5 text-left disabled:cursor-default"
                    >
                      <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] text-white', selected ? 'border-[var(--c)] bg-[var(--c)]' : 'border-border')} aria-hidden>
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold leading-tight">{name}</span>
                        {config && ToolIcon && (
                          <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                            <ToolIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {t(`serviceConfig.tools.${config.markingTool}`)} · {config.unitSymbol}
                              {config.defaultQuantity != null && ` · ${t('flow.consent.perMark', { quantity: formatQuantity(config.defaultQuantity), unit: config.unitSymbol })}`}
                            </span>
                          </span>
                        )}
                      </span>
                    </button>
                    {layer && (signed ? (
                      <span className="whitespace-nowrap rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {signed.signatureSource === 'reused'
                          ? t('flow.consent.reusedOn', { date: formatDisplayDate(signed.signedAt) })
                          : t('flow.consent.signedAt', { date: formatDateTime(signed.signedAt) })}
                      </span>
                    ) : (
                      <span className="whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">{t('flow.consent.pending')}</span>
                    ))}
                    {layer && reusable && (
                      <Hint
                        label={t('flow.consent.reuse', { date: formatDisplayDate(reusable.signedAt) })}
                        description={stored?.photoConsent
                          ? t('flow.consent.reuseKeeps', { permissions: permissionsText(stored.photoConsent) })
                          : t('flow.consent.reuseInherits', { permissions: permissionsText(reusable) })}
                      >
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs max-sm:h-9" disabled={busy} loading={reuse.isPending} onClick={() => reuse.run(layer)}>
                          <Repeat className="mr-1 h-3 w-3" />
                          {t('flow.consent.reuse', { date: formatDisplayDate(reusable.signedAt) })}
                        </Button>
                      </Hint>
                    )}
                    {layer?.serviceId && (
                      <Button type="button" size="sm" variant={textLayer?.id === layer.id ? 'secondary' : 'ghost'} aria-pressed={textLayer?.id === layer.id} className="h-7 px-2 text-xs max-sm:h-9" onClick={() => {
                        setOpenText(layer.id);
                        // Stacked, the text is further down. Only this column moves: scrollIntoView
                        // would also shift the sheet itself, hiding its header
                        const body = bodyRef.current;
                        const text = textRef.current;
                        if (!twoColumns && body && text) {
                          body.scrollTo({ top: body.scrollTop + text.getBoundingClientRect().top - body.getBoundingClientRect().top - TEXT_SCROLL_GAP, behavior: 'smooth' });
                        }
                      }}>
                        {t('flow.consent.showText')}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* The text of the consent on top and, below it, the signature */}
          <div className={cn('flex min-w-0 flex-col gap-3.5', twoColumns && 'min-h-0 flex-[6] basis-0 overflow-y-auto')}>
            <section ref={textRef} className={cn('flex min-w-0 flex-col gap-2 rounded-2xl border bg-card p-3.5', !twoColumns ? 'max-h-72' : showSignForm ? 'min-h-28 flex-[2] basis-0' : 'min-h-28 flex-1 basis-0')} aria-labelledby="aes-consents-title">
              <div className="flex shrink-0 items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 id="aes-consents-title" className="truncate text-[15px] font-semibold">{shownText?.title ?? t('flow.consent.consents')}</h3>
                  {textLayer && <p className="truncate text-xs text-muted-foreground">{textLayer.serviceName}</p>}
                </div>
                {statusChip}
              </div>
              {!textLayer && <p className="py-2 text-sm text-muted-foreground">{t('flow.consent.pickFirst')}</p>}
              {shownText && <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed">{shownText.text}</p>}
              {showSignForm && textSigned && <SignedFooter consent={textSigned} />}
            </section>

            {!showSignForm && textSigned && (
              <section className="flex shrink-0 flex-col gap-2 rounded-2xl border bg-card p-3.5">
                <h3 className="text-[15px] font-semibold">{t('consent.signature')}</h3>
                <SignedFooter consent={textSigned} large />
                {stored?.photoConsent && <p className="text-xs text-muted-foreground">{t('flow.consent.sessionPermissions', { permissions: permissionsText(stored.photoConsent) })}</p>}
              </section>
            )}

            {showSignForm && (
              <section className={cn('flex min-w-0 flex-col gap-2.5 rounded-2xl border bg-card p-3.5', twoColumns && 'min-h-[20rem] flex-[3] basis-0')} aria-label={t('consent.signature')}>
              <Form {...form}>
                <form id={SIGN_FORM_ID} onSubmit={form.handleSubmit(sign.run, onInvalid)} className={cn('flex flex-col gap-1.5', twoColumns && 'min-h-0 flex-1')}>
                  {signError && <Alert variant="destructive"><AlertDescription>{signError}</AlertDescription></Alert>}
                  {compact && <p className="text-xs text-muted-foreground">{t('flow.consent.authorizationsOnce')}</p>}
                  {(['risksExplained', 'allowsClinicalPhotos', 'allowsMarketingPhotos'] as const).map((name) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field, fieldState }) => (
                        <FormItem className="mb-0 flex flex-row items-start gap-2.5 space-y-0">
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
                      <FormItem className="mb-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 space-y-0">
                        <FormLabel className="text-xs">{t('flow.consent.signerName')}</FormLabel>
                        <FormControl><Input {...field} autoComplete="off" disabled={busy} className="h-9 min-w-40 flex-1" /></FormControl>
                        {!compact && (
                          <Hint label={t('consent.signature')} description={t('flow.consent.authorizationsOnce')}>
                            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t('flow.consent.authorizationsOnce')}><Info className="h-3.5 w-3.5" /></button>
                          </Hint>
                        )}
                        <FormMessage className="basis-full" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="signature"
                    render={({ fieldState }) => (
                      <FormItem className={cn('mb-0 flex flex-col', twoColumns && 'min-h-0 flex-1')}>
                        <div className={cn('relative flex flex-col', twoColumns ? 'max-h-80 min-h-24 flex-1' : 'h-36')}>
                          <SignaturePad
                            resetKey={padKey}
                            label={t('consent.signature')}
                            placeholder={t('flow.consent.signHere')}
                            invalid={!!fieldState.error}
                            disabled={busy}
                            className="h-auto flex-1"
                            onChange={(file) => form.setValue('signature', file as File, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
                          />
                          {signature && (
                            <Button type="button" size="sm" variant="ghost" className="absolute right-1.5 top-1.5 h-7 bg-card/80 text-xs" disabled={busy} onClick={() => { setPadKey((k) => k + 1); form.setValue('signature', undefined as unknown as File); }}>
                              {t('flow.consent.clearSignature')}
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
              </section>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t bg-card px-3.5 py-2.5">
        <span className={cn('mr-auto min-w-0 text-xs text-muted-foreground', compact && 'basis-full', compact && (showSignForm || done[1]) && 'hidden')}>
          {done[1] ? t('flow.consent.readyHint') : layers.some((l) => isServiceSigned(consents, l.serviceId)) ? t('flow.consent.partialHint') : t('flow.consent.continueHint')}
        </span>
        {!done[1] && layers.some((l) => isServiceSigned(consents, l.serviceId)) && (
          <Button type="button" variant="outline" className={cn(compact && 'flex-1')} onClick={() => goToStep(3)}>
            <Lock className="mr-1.5 h-3.5 w-3.5" />
            {t('flow.consent.treatSigned')}
          </Button>
        )}
        {showSignForm ? (
          <Button type="submit" form={SIGN_FORM_ID} className={cn(compact && 'flex-1')} loading={sign.isPending} disabled={reuse.isPending}>
            <FileSignature className="mr-1.5 h-4 w-4" />
            {t('consent.submit', { count: signable.length })}
          </Button>
        ) : (
          <Button type="button" className={cn(compact && 'flex-1')} onClick={() => goToStep(2)} disabled={!done[1] && !readOnly}>{t('flow.consent.continue')}</Button>
        )}
      </div>

    </div>
  );
}

/** Who signed, when, how (drawn or reused) and the hash of what was signed; with a print copy */
function SignedFooter({ consent, large }: { consent: AestheticServiceConsent; large?: boolean }) {
  const t = useTranslations('AestheticRecord');
  const url = useAestheticFileUrl(consent.signatureFileId);
  return (
    <div className={cn('flex shrink-0 flex-wrap items-end gap-3 text-[11px] text-muted-foreground', !large && 'border-t pt-2')}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- stored signature (object URL)
        <img src={url} alt={t('consent.signature')} className={cn('rounded bg-white object-contain px-1', large ? 'h-20' : 'h-10')} />
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
