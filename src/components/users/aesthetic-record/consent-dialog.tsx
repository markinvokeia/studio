'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { PenLine, Repeat } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { SignaturePadDialog } from '@/components/users/signature-pad-dialog';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useInvalidSubmitToast } from '@/hooks/use-invalid-submit-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { cn, formatDateTime, formatDisplayDate } from '@/lib/utils';
import type { AestheticConsentDraft } from '@/services/aesthetic-record';

import type { AestheticLayer, AestheticServiceConsent, ServiceConsentTemplate } from '@/lib/types';
import { renderConsentTemplate } from './consent-template';
import { layerTitle } from './layers';
import { useAestheticFileUrl } from './use-aesthetic-file-url';

/** A signature the patient already gave, offered to sign again without drawing it */
export type PreviousSignature =
  /** Stored: `signatureId` is the drawn original */
  | { kind: 'stored'; signatureId: string; fileId: string; signerName: string; signedAt: string }
  /** Drawn earlier in this same edit, not saved yet */
  | { kind: 'pending'; key: string; file: File; previewUrl: string; signerName: string; signedAt: string };

export interface ConsentDialogResult {
  signerName: string;
  allowsClinicalPhotos: boolean;
  allowsMarketingPhotos: boolean;
  consents: AestheticConsentDraft[];
  /** Drawn now */
  signature?: File;
  /** Or the previous one, used again */
  reuse?: PreviousSignature;
}

const consentSchema = (t: ReturnType<typeof useTranslations>, hasPhotos: boolean) =>
  z.object({
    signerName: z.string().trim().min(1, t('consent.validation.signerRequired')),
    serviceIds: z.array(z.string()).min(1, t('consent.validation.servicesRequired')),
    risksExplained: z.boolean().refine((v) => v, t('consent.validation.risksRequired')),
    allowsClinicalPhotos: z.boolean(),
    allowsMarketingPhotos: z.boolean(),
    signatureMode: z.enum(['reuse', 'draw']),
    signature: z.custom<File>((v) => typeof File !== 'undefined' && v instanceof File).optional(),
  }).refine((v) => !hasPhotos || v.allowsClinicalPhotos, {
    path: ['allowsClinicalPhotos'],
    message: t('consent.validation.photosNeedConsent'),
  }).refine((v) => v.signatureMode === 'reuse' || !!v.signature, {
    path: ['signature'],
    message: t('consent.validation.signatureRequired'),
  });

type ConsentFormValues = z.infer<ReturnType<typeof consentSchema>>;

interface ConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Services of the session that can be signed */
  layers: AestheticLayer[];
  /** Ticked when the dialog opens */
  initialServiceIds: string[];
  templates: ServiceConsentTemplate[];
  patientName?: string;
  doctorName?: string;
  /** yyyy-MM-dd */
  sessionDate: string;
  /** The session has photos: clinical photos must be allowed */
  hasPhotos: boolean;
  /** Photo permissions given before in the session, kept as the starting point */
  photoDefaults?: { allowsClinicalPhotos: boolean; allowsMarketingPhotos: boolean };
  previousSignature: PreviousSignature | null;
  /** Stores the signed consents; the dialog closes when it resolves */
  onSubmit: (result: ConsentDialogResult) => Promise<unknown> | void;
}

/** Image of a previous signature: a local preview, or the stored file */
function PreviousSignatureImage({ signature, alt }: { signature: PreviousSignature; alt: string }) {
  const t = useTranslations('AestheticRecord');
  const storedUrl = useAestheticFileUrl(signature.kind === 'stored' ? signature.fileId : undefined);
  const url = signature.kind === 'pending' ? signature.previewUrl : storedUrl;
  if (url === undefined) return <Skeleton className="h-full w-full" />;
  // eslint-disable-next-line @next/next/no-img-element -- object URL
  if (url) return <img src={url} alt={alt} className="max-h-full max-w-full object-contain" />;
  return <span className="text-xs text-gray-400">{t('photos.unavailable')}</span>;
}

export function ConsentDialog({
  open,
  onOpenChange,
  layers,
  initialServiceIds,
  templates,
  patientName,
  doctorName,
  sessionDate,
  hasPhotos,
  photoDefaults,
  previousSignature,
  onSubmit,
}: ConsentDialogProps) {
  const t = useTranslations('AestheticRecord');
  const onInvalidSubmit = useInvalidSubmitToast();
  const [isPadOpen, setIsPadOpen] = React.useState(false);
  const [signaturePreview, setSignaturePreview] = React.useState<string | null>(null);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  const defaults = React.useCallback((): ConsentFormValues => ({
    signerName: previousSignature?.signerName || patientName || '',
    serviceIds: initialServiceIds,
    risksExplained: false,
    allowsClinicalPhotos: photoDefaults?.allowsClinicalPhotos ?? true,
    allowsMarketingPhotos: photoDefaults?.allowsMarketingPhotos ?? false,
    signatureMode: previousSignature ? 'reuse' : 'draw',
    signature: undefined,
  }), [previousSignature, patientName, initialServiceIds, photoDefaults]);

  const form = useForm<ConsentFormValues>({
    resolver: zodResolver(consentSchema(t, hasPhotos)),
    defaultValues: defaults(),
  });

  React.useEffect(() => {
    if (!open) return;
    setSubmissionError(null);
    setSignaturePreview(null);
    form.reset(defaults());
    // Only when it opens: the values it starts from don't change what is being filled in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => () => { if (signaturePreview) URL.revokeObjectURL(signaturePreview); }, [signaturePreview]);

  const serviceIds = useWatch({ control: form.control, name: 'serviceIds' });
  const signerName = useWatch({ control: form.control, name: 'signerName' });
  const signatureMode = useWatch({ control: form.control, name: 'signatureMode' });

  const signable = layers.filter((l) => l.serviceId);
  const patient = patientName || signerName || t('consent.patientFallback');
  const doctor = doctorName || t('consent.doctorFallback');

  /** Each ticked service's consent, its template's variables filled in (the generic text when it has none) */
  const drafts: AestheticConsentDraft[] = signable
    .filter((l) => serviceIds.includes(l.serviceId!))
    .map((layer) => {
      const template = templates.find((tpl) => tpl.serviceId === layer.serviceId);
      const title = template?.title || t('consent.defaultTitle', { service: layer.serviceName });
      const text = template
        ? renderConsentTemplate(template.body, {
          patient_name: patient,
          doctor_name: doctor,
          service_name: layer.serviceName,
          product_name: layer.productName.trim() || layer.serviceName,
          session_date: formatDisplayDate(sessionDate),
        })
        : t('consent.template', { patient, procedure: layerTitle(layer), doctor });
      return { serviceId: layer.serviceId!, serviceName: layer.serviceName, title, text, templateUpdatedAt: template?.updatedAt || undefined };
    });

  const sign = useAsyncAction(
    async (values: ConsentFormValues) => onSubmit({
      signerName: values.signerName.trim(),
      allowsClinicalPhotos: values.allowsClinicalPhotos,
      allowsMarketingPhotos: values.allowsMarketingPhotos,
      consents: drafts,
      signature: values.signatureMode === 'draw' ? values.signature : undefined,
      reuse: values.signatureMode === 'reuse' && previousSignature ? previousSignature : undefined,
    }),
    {
      onSuccess: () => onOpenChange(false),
      onError: (error) => setSubmissionError(getErrorMessage(error)),
      showErrorToast: false,
    },
  );

  const toggleService = (id: string, checked: boolean) => {
    const next = checked ? [...serviceIds, id] : serviceIds.filter((s) => s !== id);
    form.setValue('serviceIds', next, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  };

  const signatureBox = 'flex h-20 flex-1 items-center justify-center rounded-xl border bg-white p-1';

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && sign.isPending) return;
          onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-2xl" confirmOnClose isDirty={form.formState.isDirty}>
          <DialogHeader>
            <DialogTitle>{t('consent.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('consent.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(sign.run, onInvalidSubmit)}>
              <DialogBody className="space-y-4 px-6 py-4">
                {submissionError && (
                  <Alert variant="destructive">
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="serviceIds"
                  render={() => (
                    <FormItem>
                      <FormLabel>{t('consent.services')}</FormLabel>
                      <div className="flex flex-col gap-1.5">
                        {signable.map((layer) => {
                          const id = `aes-consent-service-${layer.serviceId}`;
                          return (
                            <label key={layer.id} htmlFor={id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                id={id}
                                checked={serviceIds.includes(layer.serviceId!)}
                                onCheckedChange={(v) => toggleService(layer.serviceId!, v === true)}
                                disabled={sign.isPending}
                              />
                              <span className="min-w-0 truncate">{layerTitle(layer)}</span>
                              {layer.productName.trim() && <span className="truncate text-xs text-muted-foreground">{layer.serviceName}</span>}
                              {!templates.some((tpl) => tpl.serviceId === layer.serviceId) && (
                                <span className="shrink-0 text-[11px] text-muted-foreground">· {t('consent.genericText')}</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="signerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('consent.signerName')}</FormLabel>
                      <FormControl><Input {...field} disabled={sign.isPending} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {drafts.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {drafts.map((draft, index) => (
                      <details key={draft.serviceId} open={index === 0} className="rounded-xl border bg-muted/30 text-xs">
                        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">{draft.title}</summary>
                        <p className="max-h-56 overflow-y-auto whitespace-pre-wrap border-t px-3 py-2 leading-relaxed text-foreground">{draft.text}</p>
                      </details>
                    ))}
                  </div>
                )}

                {(['risksExplained', 'allowsClinicalPhotos', 'allowsMarketingPhotos'] as const).map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field, fieldState }) => (
                      <FormItem className="flex flex-row items-start gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(v) => field.onChange(v === true)}
                            disabled={sign.isPending}
                            className={cn(fieldState.error && 'border-destructive ring-2 ring-destructive/25')}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">{t(`consent.${name}`)}</FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                ))}

                <FormField
                  control={form.control}
                  name="signature"
                  render={({ fieldState }) => (
                    <FormItem>
                      <FormLabel>{t('consent.signature')}</FormLabel>
                      {previousSignature && (
                        <div className="inline-flex rounded-lg border p-0.5" role="radiogroup" aria-label={t('consent.signature')}>
                          {([['reuse', Repeat], ['draw', PenLine]] as const).map(([mode, Icon]) => (
                            <button
                              key={mode}
                              type="button"
                              role="radio"
                              aria-checked={signatureMode === mode}
                              disabled={sign.isPending}
                              onClick={() => form.setValue('signatureMode', mode, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                                signatureMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {t(`consent.signatureModes.${mode}`)}
                            </button>
                          ))}
                        </div>
                      )}
                      {signatureMode === 'reuse' && previousSignature ? (
                        <div className="flex flex-col gap-1.5">
                          <div className={signatureBox}>
                            <PreviousSignatureImage signature={previousSignature} alt={t('consent.signature')} />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {previousSignature.kind === 'pending'
                              ? t('consent.reusePendingHint')
                              : t('consent.reuseHint', { name: previousSignature.signerName, date: formatDateTime(previousSignature.signedAt) })}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(signatureBox, 'border-dashed', fieldState.error && 'border-2 border-destructive bg-destructive/5')}
                            aria-invalid={!!fieldState.error || undefined}
                          >
                            {signaturePreview ? (
                              // eslint-disable-next-line @next/next/no-img-element -- local object URL
                              <img src={signaturePreview} alt={t('consent.signature')} className="max-h-16 max-w-full object-contain" />
                            ) : (
                              <span className={cn('text-xs', fieldState.error ? 'text-destructive' : 'text-gray-400')}>{t('consent.notSignedYet')}</span>
                            )}
                          </div>
                          <Button type="button" variant="outline" onClick={() => setIsPadOpen(true)} disabled={sign.isPending}>
                            <PenLine className="mr-2 h-4 w-4" />
                            {signaturePreview ? t('consent.signAgain') : t('consent.sign')}
                          </Button>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </DialogBody>
              <DialogFooter>
                <DialogCancelButton disabled={sign.isPending}>{t('cancel')}</DialogCancelButton>
                <Button type="submit" loading={sign.isPending}>
                  {t('consent.submit', { count: drafts.length })}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <SignaturePadDialog
        open={isPadOpen}
        onOpenChange={setIsPadOpen}
        onConfirm={(file) => {
          setSignaturePreview(URL.createObjectURL(file));
          form.setValue('signature', file, { shouldDirty: true, shouldValidate: true });
        }}
      />
    </>
  );
}

export interface ConsentPrintLabels {
  signer: string;
  date: string;
  signature: string;
  reusedSignature: string;
  clinicalPhotos: string;
  marketingPhotos: string;
  yes: string;
  no: string;
}

/** Opens the signed consent of a service in a new window ready to print */
export function printConsent(consent: AestheticServiceConsent, signatureUrl: string | null, labels: ConsentPrintLabels): void {
  const win = window.open('', '_blank');
  if (!win) return;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  const title = consent.title || consent.serviceName;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111;line-height:1.55}
h1{font-size:20px;margin:0 0 16px}p.text{white-space:pre-wrap;font-size:14px}dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;font-size:13px}
dt{color:#555}.sig{margin-top:32px;border-top:1px solid #999;padding-top:8px;width:280px;font-size:12px;color:#555}.sig img{max-height:90px;display:block;margin-bottom:6px}</style>
</head><body><h1>${esc(title)}</h1><p class="text">${esc(consent.text)}</p>
<dl><dt>${esc(labels.clinicalPhotos)}</dt><dd>${consent.allowsClinicalPhotos ? esc(labels.yes) : esc(labels.no)}</dd>
<dt>${esc(labels.marketingPhotos)}</dt><dd>${consent.allowsMarketingPhotos ? esc(labels.yes) : esc(labels.no)}</dd>
<dt>${esc(labels.date)}</dt><dd>${esc(formatDateTime(consent.signedAt))}</dd></dl>
<div class="sig">${signatureUrl ? `<img src="${esc(signatureUrl)}" alt="">` : ''}${esc(labels.signature)}: ${esc(consent.signerName)}${consent.signatureSource === 'reused' ? `<br>${esc(labels.reusedSignature)}` : ''}</div>
<script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
}
