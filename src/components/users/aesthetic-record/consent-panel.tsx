'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, FileSignature, Printer, Trash2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { formatDateTime } from '@/lib/utils';

import type { AestheticConsent } from '@/lib/types';
import { printConsent } from './consent-dialog';
import { useAestheticFileUrl } from './use-aesthetic-file-url';

interface ConsentPanelProps {
  consent: AestheticConsent | null;
  /** Signed in this edit and not saved yet: its signature is a local preview */
  pendingSignatureUrl?: string;
  /** The consent will be saved with the session (shown in the empty state) */
  isEditing: boolean;
  canSign: boolean;
  /** Why signing is disabled, shown instead of the button */
  signDisabledReason?: string;
  onSign: () => void;
  onRemovePending?: () => void;
}

export function ConsentPanel({ consent, pendingSignatureUrl, isEditing, canSign, signDisabledReason, onSign, onRemovePending }: ConsentPanelProps) {
  const t = useTranslations('AestheticRecord');
  const isPending = pendingSignatureUrl !== undefined;
  const storedSignatureUrl = useAestheticFileUrl(isPending ? undefined : consent?.signatureFileId);
  const signatureUrl = isPending ? pendingSignatureUrl : storedSignatureUrl;

  if (!consent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-6 text-center">
        <FileSignature className="h-8 w-8 text-muted-foreground/60" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{t('consent.missingTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('consent.missingDescription')}</p>
          {isEditing && canSign && <p className="text-xs text-muted-foreground">{t('consent.pendingSaveHint')}</p>}
        </div>
        {canSign ? (
          <Button type="button" onClick={onSign}>
            <FileSignature className="mr-2 h-4 w-4" />
            {t('consent.open')}
          </Button>
        ) : signDisabledReason ? (
          <p className="text-xs text-muted-foreground">{signDisabledReason}</p>
        ) : null}
      </div>
    );
  }

  const flag = (value: boolean, label: string) => (
    <li className="flex items-center gap-2 text-xs">
      {value ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
      <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
  );

  const signedAt = formatDateTime(consent.signedAt);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {t('consent.signedTitle')}
            {isPending && <Badge variant="outline">{t('consent.pendingSave')}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{t('consent.signedBy', { name: consent.signerName, date: signedAt })}</p>
        </div>
        {isPending ? onRemovePending && (
          <Button type="button" variant="outline" size="sm" onClick={onRemovePending} className="text-destructive hover:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            {t('consent.removePending')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => printConsent(consent, signatureUrl ?? null, {
              title: t('consent.printTitle'),
              signer: t('consent.signerName'),
              date: t('consent.signedAt'),
              procedure: t('consent.procedure'),
              signature: t('consent.signature'),
              clinicalPhotos: t('consent.allowsClinicalPhotos'),
              marketingPhotos: t('consent.allowsMarketingPhotos'),
              yes: t('consent.yes'),
              no: t('consent.no'),
            }, signedAt)}
          >
            <Printer className="mr-2 h-4 w-4" />
            {t('consent.print')}
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{t('consent.procedure')}</dt>
        <dd className="text-foreground">{consent.procedure}</dd>
      </dl>

      <ul className="flex flex-col gap-1.5">
        {flag(true, t('consent.risksExplained'))}
        {flag(consent.allowsClinicalPhotos, t('consent.allowsClinicalPhotos'))}
        {flag(consent.allowsMarketingPhotos, t('consent.allowsMarketingPhotos'))}
      </ul>

      <details className="rounded-xl border bg-muted/30 p-3 text-xs">
        <summary className="cursor-pointer font-medium text-foreground">{t('consent.showText')}</summary>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-foreground">{consent.text}</p>
      </details>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('consent.signature')}</span>
        <div className="flex h-24 w-full max-w-xs items-center justify-center rounded-xl border bg-white p-2">
          {signatureUrl === undefined ? (
            <Skeleton className="h-full w-full" />
          ) : signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL
            <img src={signatureUrl} alt={t('consent.signature')} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-gray-400">{t('photos.unavailable')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
