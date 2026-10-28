'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { PenLine } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';

import { SignaturePadDialog } from '@/components/users/signature-pad-dialog';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useInvalidSubmitToast } from '@/hooks/use-invalid-submit-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { cn } from '@/lib/utils';
import type { AestheticConsentInput } from '@/services/aesthetic-record';

import type { AestheticConsent } from '@/lib/types';

const consentSchema = (t: ReturnType<typeof useTranslations>, hasPhotos: boolean) =>
  z.object({
    signerName: z.string().trim().min(1, t('consent.validation.signerRequired')),
    procedure: z.string().trim().min(1, t('consent.validation.procedureRequired')),
    risksExplained: z.boolean().refine((v) => v, t('consent.validation.risksRequired')),
    allowsClinicalPhotos: z.boolean(),
    allowsMarketingPhotos: z.boolean(),
    signature: z.custom<File>((v) => typeof File !== 'undefined' && v instanceof File, t('consent.validation.signatureRequired')),
  }).refine((v) => !hasPhotos || v.allowsClinicalPhotos, {
    path: ['allowsClinicalPhotos'],
    message: t('consent.validation.photosNeedConsent'),
  });

type ConsentFormValues = z.infer<ReturnType<typeof consentSchema>>;

interface ConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName?: string;
  doctorName?: string;
  /** Prefill for the procedure (products of the session) */
  defaultProcedure: string;
  /** The session already has photos: clinical photos must be allowed */
  hasPhotos: boolean;
  /** Stores the signed consent; the dialog closes when it resolves */
  onSubmit: (input: AestheticConsentInput, signature: File) => Promise<unknown> | void;
}

export function ConsentDialog({ open, onOpenChange, patientName, doctorName, defaultProcedure, hasPhotos, onSubmit }: ConsentDialogProps) {
  const t = useTranslations('AestheticRecord');
  const onInvalidSubmit = useInvalidSubmitToast();
  const [isPadOpen, setIsPadOpen] = React.useState(false);
  const [signaturePreview, setSignaturePreview] = React.useState<string | null>(null);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  const form = useForm<ConsentFormValues>({
    resolver: zodResolver(consentSchema(t, hasPhotos)),
    defaultValues: {
      signerName: patientName ?? '',
      procedure: defaultProcedure,
      risksExplained: false,
      allowsClinicalPhotos: true,
      allowsMarketingPhotos: false,
      signature: undefined,
    },
  });

  React.useEffect(() => {
    if (!open) return;
    setSubmissionError(null);
    setSignaturePreview(null);
    form.reset({
      signerName: patientName ?? '',
      procedure: defaultProcedure,
      risksExplained: false,
      allowsClinicalPhotos: true,
      allowsMarketingPhotos: false,
      signature: undefined,
    });
  }, [open, patientName, defaultProcedure, form]);

  React.useEffect(() => () => { if (signaturePreview) URL.revokeObjectURL(signaturePreview); }, [signaturePreview]);

  const procedure = useWatch({ control: form.control, name: 'procedure' });
  const signerName = useWatch({ control: form.control, name: 'signerName' });
  const consentText = t('consent.template', {
    patient: patientName || signerName || t('consent.patientFallback'),
    procedure: procedure || '—',
    doctor: doctorName || t('consent.doctorFallback'),
  });

  const sign = useAsyncAction(
    async (values: ConsentFormValues) => onSubmit(
      {
        signerName: values.signerName.trim(),
        procedure: values.procedure.trim(),
        text: consentText,
        allowsClinicalPhotos: values.allowsClinicalPhotos,
        allowsMarketingPhotos: values.allowsMarketingPhotos,
      },
      values.signature,
    ),
    {
      onSuccess: () => onOpenChange(false),
      onError: (error) => setSubmissionError(getErrorMessage(error)),
      showErrorToast: false,
    },
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && sign.isPending) return;
          onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-xl" confirmOnClose isDirty={form.formState.isDirty}>
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

                <div className="grid gap-3 sm:grid-cols-2">
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
                  <FormField
                    control={form.control}
                    name="procedure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('consent.procedure')}</FormLabel>
                        <FormControl><Input {...field} disabled={sign.isPending} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
                  {consentText}
                </div>

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
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex h-20 flex-1 items-center justify-center rounded-xl border border-dashed bg-white',
                            fieldState.error && 'border-2 border-destructive bg-destructive/5',
                          )}
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </DialogBody>
              <DialogFooter>
                <DialogCancelButton disabled={sign.isPending}>{t('cancel')}</DialogCancelButton>
                <Button type="submit" loading={sign.isPending}>{t('consent.submit')}</Button>
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

/** Opens the signed consent in a new window ready to print */
export function printConsent(
  consent: AestheticConsent,
  signatureUrl: string | null,
  labels: { title: string; signer: string; date: string; procedure: string; signature: string; clinicalPhotos: string; marketingPhotos: string; yes: string; no: string },
  signedAtLabel: string,
): void {
  const win = window.open('', '_blank');
  if (!win) return;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(labels.title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111;line-height:1.55}
h1{font-size:20px;margin:0 0 16px}p.text{white-space:pre-wrap;font-size:14px}dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;font-size:13px}
dt{color:#555}.sig{margin-top:32px;border-top:1px solid #999;padding-top:8px;width:280px;font-size:12px;color:#555}.sig img{max-height:90px;display:block;margin-bottom:6px}</style>
</head><body><h1>${esc(labels.title)}</h1><p class="text">${esc(consent.text)}</p>
<dl><dt>${esc(labels.procedure)}</dt><dd>${esc(consent.procedure)}</dd>
<dt>${esc(labels.clinicalPhotos)}</dt><dd>${consent.allowsClinicalPhotos ? esc(labels.yes) : esc(labels.no)}</dd>
<dt>${esc(labels.marketingPhotos)}</dt><dd>${consent.allowsMarketingPhotos ? esc(labels.yes) : esc(labels.no)}</dd>
<dt>${esc(labels.date)}</dt><dd>${esc(signedAtLabel)}</dd></dl>
<div class="sig">${signatureUrl ? `<img src="${esc(signatureUrl)}" alt="">` : ''}${esc(labels.signature)}: ${esc(consent.signerName)}</div>
<script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
}
