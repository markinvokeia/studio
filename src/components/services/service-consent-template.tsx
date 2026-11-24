'use client';

import * as React from 'react';
import { FileSignature } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { CONSENT_VARIABLES, consentToken, renderConsentTemplate, unknownConsentVariables } from '@/components/users/aesthetic-record/consent-template';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useToast } from '@/hooks/use-toast';
import { useAestheticErrorMessage } from '@/components/users/aesthetic-record/aesthetic-errors';
import { formatDate, formatDisplayDate } from '@/lib/utils';
import { fetchServiceConsentTemplates, saveServiceConsentTemplate } from '@/services/aesthetic-record';

interface Draft {
  title: string;
  body: string;
}

interface ServiceConsentTemplatePanelProps {
  serviceId: string;
  serviceName: string;
  canManage?: boolean;
}

/**
 * Informed consent text of the service, signed on the aesthetic record each time the service is
 * applied. Saves on its own, apart from the service form. Without a text the generic one is used.
 */
export function ServiceConsentTemplatePanel({ serviceId, serviceName, canManage = false }: ServiceConsentTemplatePanelProps) {
  const t = useTranslations('AestheticRecord');
  const { toast } = useToast();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [saved, setSaved] = React.useState<Draft | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const describeError = useAestheticErrorMessage();
  const [showPreview, setShowPreview] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setDraft(null);
    setLoadError(null);
    fetchServiceConsentTemplates()
      .then((templates) => {
        if (!active) return;
        const template = templates.find((tpl) => tpl.serviceId === serviceId);
        const next: Draft = { title: template?.title ?? '', body: template?.body ?? '' };
        setSaved(next);
        setDraft(next);
      })
      .catch((error) => { if (active) setLoadError(describeError(error)); });
    return () => { active = false; };
  }, [serviceId, describeError]);

  const save = useAsyncAction(
    async (next: Draft) => {
      await saveServiceConsentTemplate(serviceId, { title: next.title.trim(), body: next.body.trim() });
      return { title: next.title.trim(), body: next.body.trim() };
    },
    {
      onSuccess: (next) => {
        setSaved(next);
        setDraft(next);
        toast({ title: next.body ? t('consentTemplate.saved') : t('consentTemplate.removed') });
      },
      errorTitle: t('consentTemplate.saveError'),
      describeError,
    },
  );

  if (loadError) return <p className="text-xs text-destructive">{loadError}</p>;
  if (!draft || !saved) return <Skeleton className="h-16 w-full" />;

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const isDirty = draft.title !== saved.title || draft.body !== saved.body;
  const disabled = !canManage || save.isPending;
  const unknown = unknownConsentVariables(draft.body);

  /** Puts the variable where the cursor is (at the end when the text was never focused) */
  function insertVariable(token: string) {
    const el = textareaRef.current;
    const body = draft?.body ?? '';
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    update({ body: body.slice(0, start) + token + body.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  /** The generic text, with its blanks turned into variables, as a starting point */
  const genericText = t('consent.template', {
    patient: consentToken('patient_name'),
    doctor: consentToken('doctor_name'),
    procedure: consentToken('service_name'),
  });

  const today = formatDate(new Date());
  const preview = renderConsentTemplate(draft.body, {
    patient_name: t('consentTemplate.sample.patient'),
    doctor_name: t('consentTemplate.sample.doctor'),
    service_name: serviceName,
    product_name: t('consentTemplate.sample.product'),
    session_date: formatDisplayDate(today),
  });

  return (
    <div className="flex flex-col gap-3">
      <div data-help-id="sales.services.section.consent-template" className="flex min-w-0 items-start gap-2">
        <FileSignature className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
        <div className="min-w-0">
          <Label htmlFor={`consent-tpl-body-${serviceId}`} className="text-sm font-medium">{t('consentTemplate.title')}</Label>
          <p className="text-xs text-muted-foreground">{t('consentTemplate.description')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`consent-tpl-title-${serviceId}`} className="text-xs">{t('consentTemplate.documentTitle')}</Label>
        <Input
          data-help-id="sales.services.field.consent-title"
          id={`consent-tpl-title-${serviceId}`}
          value={draft.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder={t('consentTemplate.documentTitlePlaceholder', { service: serviceName })}
          disabled={disabled}
          maxLength={255}
          className="h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-xs">{t('consentTemplate.body')}</Label>
          {canManage && !draft.body.trim() && (
            <Button data-help-id="sales.services.btn.consent-from-generic" type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => update({ body: genericText })} disabled={disabled}>
              {t('consentTemplate.startFromGeneric')}
            </Button>
          )}
        </div>
        <Textarea
          data-help-id="sales.services.field.consent-body"
          ref={textareaRef}
          id={`consent-tpl-body-${serviceId}`}
          value={draft.body}
          onChange={(e) => update({ body: e.target.value })}
          placeholder={t('consentTemplate.bodyPlaceholder')}
          disabled={disabled}
          rows={10}
          className="resize-y text-sm leading-relaxed"
        />
        {canManage && (
          <div data-help-id="sales.services.section.consent-variables" className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{t('consentTemplate.insertVariable')}</span>
            {CONSENT_VARIABLES.map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => insertVariable(consentToken(variable))}
                disabled={disabled}
                title={consentToken(variable)}
                className="rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
              >
                {t(`consentTemplate.variables.${variable}`)}
              </button>
            ))}
          </div>
        )}
        {!draft.body.trim() && <p className="text-[11px] text-muted-foreground">{t('consentTemplate.emptyHint')}</p>}
        {unknown.length > 0 && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{t('consentTemplate.unknownVariables', { names: unknown.map((n) => `{{${n}}}`).join(', ') })}</AlertDescription>
          </Alert>
        )}
      </div>

      {draft.body.trim() && (
        <div className="flex flex-col gap-1.5">
          <Button data-help-id="sales.services.btn.consent-preview" type="button" size="sm" variant="link" className="h-auto self-start p-0 text-xs" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? t('consentTemplate.hidePreview') : t('consentTemplate.showPreview')}
          </Button>
          {showPreview && (
            <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
              {draft.title.trim() && <p className="mb-2 font-semibold">{draft.title.trim()}</p>}
              {preview}
            </div>
          )}
        </div>
      )}

      {canManage && isDirty && (
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(saved)} disabled={save.isPending}>{t('consentTemplate.discard')}</Button>
          <Button data-help-id="sales.services.btn.consent-save" type="button" size="sm" onClick={() => save.run(draft)} disabled={unknown.length > 0} loading={save.isPending}>{t('consentTemplate.save')}</Button>
        </div>
      )}
    </div>
  );
}
