'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, CircleAlert, FileSignature, Printer, Repeat, Trash2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { cn, formatDateTime } from '@/lib/utils';
import type { AestheticConsentSigning } from '@/services/aesthetic-record';

import type { AestheticLayer, AestheticPhotoConsent, AestheticServiceConsent } from '@/lib/types';
import { printConsent } from './consent-dialog';
import { layerColor, layerTitle } from './layers';
import { useAestheticFileUrl } from './use-aesthetic-file-url';

/** Consents signed during the edit, saved together with the session */
export interface PendingSigning {
  signing: AestheticConsentSigning;
  /** Image of the signature: a local preview, or the stored file it reuses */
  previewUrl?: string;
  fileId?: string;
}

interface ConsentPanelProps {
  layers: AestheticLayer[];
  /** Stored consents of the session */
  consents: AestheticServiceConsent[];
  pending: PendingSigning[];
  /** Photo permissions in force: those of the last signature, saved or not */
  photoConsent: AestheticPhotoConsent | null;
  isEditing: boolean;
  canSign: boolean;
  /** Why signing is disabled, shown instead of the buttons */
  signDisabledReason?: string;
  /** Opens the signing with these services ticked */
  onSign: (serviceIds: string[]) => void;
  onRemovePending?: (key: string) => void;
}

/** Shown consent of a service: the one signed in this edit wins over the stored one */
type ConsentState =
  | { status: 'missing' }
  | { status: 'pending'; pending: PendingSigning; title: string; text: string }
  | { status: 'signed'; consent: AestheticServiceConsent };

function SignatureImage({ url, alt }: { url: string | null | undefined; alt: string }) {
  const t = useTranslations('AestheticRecord');
  return (
    <div className="flex h-20 w-full max-w-xs items-center justify-center rounded-xl border bg-white p-2">
      {url === undefined ? (
        <Skeleton className="h-full w-full" />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element -- object URL
        <img src={url} alt={alt} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="text-xs text-gray-400">{t('photos.unavailable')}</span>
      )}
    </div>
  );
}

function ConsentRow({ layer, index, state, canSign, isEditing, onSign, onRemovePending }: {
  layer: AestheticLayer;
  index: number;
  state: ConsentState;
  canSign: boolean;
  isEditing: boolean;
  onSign: () => void;
  onRemovePending?: (key: string) => void;
}) {
  const t = useTranslations('AestheticRecord');
  const [expanded, setExpanded] = React.useState(false);
  const pending = state.status === 'pending' ? state.pending : null;
  const consent = state.status === 'signed' ? state.consent : null;
  const storedUrl = useAestheticFileUrl(expanded || consent ? consent?.signatureFileId ?? pending?.fileId : undefined);
  const signatureUrl = pending?.previewUrl ?? storedUrl;
  const signerName = consent?.signerName ?? pending?.signing.signerName;
  const signedAt = consent?.signedAt ?? pending?.signing.signedAt;
  const reused = consent ? consent.signatureSource === 'reused' : !!(pending?.signing.reuseKey || pending?.signing.reuseSignatureId);
  const text = consent?.text ?? (state.status === 'pending' ? state.text : '');

  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-start gap-2">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: layerColor(layer, index) }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
            <span className="truncate">{layerTitle(layer)}</span>
            {pending && <Badge variant="outline" className="text-[10px]">{t('consent.pendingSave')}</Badge>}
            {reused && state.status !== 'missing' && (
              <Badge variant="secondary" className="gap-1 text-[10px]"><Repeat className="h-3 w-3" />{t('consent.reusedBadge')}</Badge>
            )}
          </div>
          {state.status === 'missing' ? (
            <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"><CircleAlert className="h-3.5 w-3.5" />{t('consent.missingForService')}</p>
          ) : (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {t('consent.signedBy', { name: signerName ?? '', date: formatDateTime(signedAt ?? '') })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {state.status === 'missing' ? (
            canSign && (
              <Button type="button" size="sm" className="h-8" onClick={onSign}>
                <FileSignature className="mr-1.5 h-3.5 w-3.5" />{t('consent.sign')}
              </Button>
            )
          ) : (
            <>
              <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                {expanded ? t('consent.hideText') : t('consent.showText')}
              </Button>
              {consent && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label={t('consent.print')}
                  title={t('consent.print')}
                  onClick={() => printConsent(consent, signatureUrl ?? null, {
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
                  <Printer className="h-4 w-4" />
                </Button>
              )}
              {pending ? onRemovePending && (
                <Button type="button" size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => onRemovePending(pending.signing.key)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />{t('consent.removePending')}
                </Button>
              ) : canSign && isEditing && (
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onSign}>{t('consent.signAgain')}</Button>
              )}
            </>
          )}
        </div>
      </div>
      {expanded && state.status !== 'missing' && (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs">
            <p className="mb-1.5 font-semibold text-foreground">{consent?.title || (state.status === 'pending' ? state.title : '')}</p>
            <p className="whitespace-pre-wrap leading-relaxed text-foreground">{text}</p>
          </div>
          <SignatureImage url={signatureUrl} alt={t('consent.signature')} />
        </div>
      )}
    </li>
  );
}

export function ConsentPanel({ layers, consents, pending, photoConsent, isEditing, canSign, signDisabledReason, onSign, onRemovePending }: ConsentPanelProps) {
  const t = useTranslations('AestheticRecord');
  const signable = layers.filter((l) => l.serviceId);

  const stateOf = (serviceId: string): ConsentState => {
    // The last signing of the edit that covers the service
    for (let i = pending.length - 1; i >= 0; i--) {
      const draft = pending[i].signing.consents.find((c) => c.serviceId === serviceId);
      if (draft) return { status: 'pending', pending: pending[i], title: draft.title, text: draft.text };
    }
    const consent = consents.find((c) => c.serviceId === serviceId);
    return consent ? { status: 'signed', consent } : { status: 'missing' };
  };

  const missing = signable.filter((l) => stateOf(l.serviceId!).status === 'missing');

  if (signable.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-6 text-center">
        <FileSignature className="h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm font-semibold text-foreground">{t('consent.noServicesTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('consent.noServicesDescription')}</p>
      </div>
    );
  }

  const flag = (value: boolean, label: string) => (
    <li className="flex items-center gap-2 text-xs">
      {value ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
      <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className={cn(
        'flex flex-wrap items-center gap-3 rounded-2xl border p-3',
        missing.length ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5',
      )}>
        {missing.length ? <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {missing.length ? t('consent.missingCount', { count: missing.length }) : t('consent.allSigned')}
          </p>
          <p className="text-xs text-muted-foreground">
            {missing.length && isEditing && canSign ? t('consent.pendingSaveHint') : t('consent.perServiceHint')}
          </p>
        </div>
        {missing.length > 0 && (canSign ? (
          <Button type="button" size="sm" onClick={() => onSign(missing.map((l) => l.serviceId!))}>
            <FileSignature className="mr-1.5 h-3.5 w-3.5" />
            {t('consent.signMissing', { count: missing.length })}
          </Button>
        ) : signDisabledReason && <p className="w-full text-xs text-muted-foreground">{signDisabledReason}</p>)}
      </div>

      <ul className="flex flex-col gap-2">
        {layers.map((layer, index) => layer.serviceId && (
          <ConsentRow
            key={layer.id}
            layer={layer}
            index={index}
            state={stateOf(layer.serviceId)}
            canSign={canSign}
            isEditing={isEditing}
            onSign={() => onSign([layer.serviceId!])}
            onRemovePending={onRemovePending}
          />
        ))}
      </ul>

      {photoConsent && (
        <section className="flex flex-col gap-1.5 rounded-xl border p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('consent.photosTitle')}</h4>
          <ul className="flex flex-col gap-1.5">
            {flag(photoConsent.allowsClinicalPhotos, t('consent.allowsClinicalPhotos'))}
            {flag(photoConsent.allowsMarketingPhotos, t('consent.allowsMarketingPhotos'))}
          </ul>
        </section>
      )}
    </div>
  );
}
