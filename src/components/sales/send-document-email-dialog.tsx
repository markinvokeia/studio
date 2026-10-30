'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';

import { useAsyncAction } from '@/hooks/use-async-action';
import { checkPreferencesByEmails, getDisabledEmails } from '@/hooks/use-communication-preferences';
import { useToast } from '@/hooks/use-toast';
import { usePrintDocument, type DocumentPdfRequest } from '@/hooks/usePrintDocument';
import { api, REQUEST_TIMEOUT_MS } from '@/services/api';

import { API_ROUTES } from '@/constants/routes';

/** The document to email: what to render to PDF plus how to present it. */
export interface EmailDocumentTarget {
  /** Rendered with the same template and data as "Imprimir". */
  request: DocumentPdfRequest;
  id: string;
  /** Shown in the dialog so the user knows which whole document goes out (a ledger
   *  row is often a single item of it). */
  docNo?: string;
  /** Pre-filled recipients (comma separated). */
  defaultEmails?: string;
}

interface SendDocumentEmailDialogProps {
  /** Opens the dialog when set; `null` keeps it closed. */
  document: EmailDocumentTarget | null;
  onClose: () => void;
}

type SendPhase = 'idle' | 'pdf' | 'sending';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(value: string) {
  return value.split(',').map((e) => e.trim()).filter(Boolean);
}

/**
 * Emails a quote, invoice, credit note or payment receipt with its PDF attached. The PDF
 * is rendered in the browser from the print templates (`renderDocumentPdf`), so it's
 * identical to the printed copy. Warns first when a recipient opted out of billing emails.
 */
export function SendDocumentEmailDialog({ document, onClose }: SendDocumentEmailDialogProps) {
  const t = useTranslations('SendDocumentEmailDialog');
  const { toast } = useToast();
  const { renderDocumentPdf } = usePrintDocument();
  const [recipients, setRecipients] = React.useState('');
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [disabledEmails, setDisabledEmails] = React.useState<string[]>([]);
  const [phase, setPhase] = React.useState<SendPhase>('idle');

  React.useEffect(() => {
    if (!document) return;
    setRecipients(document.defaultEmails || '');
    setValidationError(null);
    setDisabledEmails([]);
  }, [document]);

  // One lock covers the preference check, the PDF and the send, so a second click can't
  // race any step. Resolves to whether the email actually went out.
  const send = useAsyncAction(
    async (doc: EmailDocumentTarget, emails: string[], skipPreferenceCheck: boolean) => {
      try {
        if (!skipPreferenceCheck) {
          const disabled = getDisabledEmails(await checkPreferencesByEmails(emails, 'email', 'billing'));
          if (disabled.length > 0) {
            setDisabledEmails(disabled);
            return false;
          }
        }
        setPhase('pdf');
        let pdfBase64: string;
        try {
          pdfBase64 = await renderDocumentPdf(doc.request);
        } catch (error) {
          throw new Error(t('errorPdf'), { cause: error });
        }
        setPhase('sending');
        await api.post(
          API_ROUTES.DOCUMENTS_SEND,
          {
            document_type: doc.request.type,
            document_id: doc.id,
            doc_no: doc.docNo || '',
            is_sales: doc.request.isSales,
            emails,
            pdf_base64: pdfBase64,
          },
          undefined,
          undefined,
          { timeoutMs: REQUEST_TIMEOUT_MS.longRunning }
        );
        return true;
      } finally {
        setPhase('idle');
      }
    },
    {
      onSuccess: (sent) => {
        if (!sent) return;
        toast({ title: t(`success.${document?.request.type ?? 'invoice'}`) });
        onClose();
      },
      errorTitle: t('error'),
    }
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!document) return;
    const emails = parseEmails(recipients);
    if (emails.length === 0) {
      setValidationError(t('errorNoEmail'));
      return;
    }
    const invalid = emails.filter((e) => !EMAIL_REGEX.test(e));
    if (invalid.length > 0) {
      setValidationError(t('errorInvalidEmails', { emails: invalid.join(', ') }));
      return;
    }
    setValidationError(null);
    void send.run(document, emails, false);
  };

  const kind = document?.request.type ?? 'invoice';

  return (
    <>
      <Dialog
        open={!!document}
        onOpenChange={(next) => {
          if (!next && !send.isPending) onClose();
        }}
      >
        <DialogContent maxWidth="md" confirmOnClose isDirty={recipients.trim() !== (document?.defaultEmails || '').trim()}>
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>{t(`title.${kind}`)}</DialogTitle>
              <DialogDescription>
                {document?.docNo
                  ? t(`description.${kind}`, { docNo: document.docNo })
                  : t('descriptionNoNumber')}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-1.5 px-6 py-4">
              <Label htmlFor="send-document-email-recipients">{t('recipients')}</Label>
              <Input
                id="send-document-email-recipients"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder={t('placeholder')}
                disabled={send.isPending}
                aria-invalid={!!validationError}
              />
              {validationError ? (
                <p className="text-sm text-destructive">{validationError}</p>
              ) : (
                <p className="text-sm text-muted-foreground">{t('helperText')}</p>
              )}
            </DialogBody>
            <DialogFooter>
              <DialogCancelButton disabled={send.isPending}>{t('cancel')}</DialogCancelButton>
              <Button type="submit" loading={send.isPending}>
                {phase === 'pdf' ? t('generatingPdf') : phase === 'sending' ? t('sending') : t('send')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CommunicationWarningDialog
        open={disabledEmails.length > 0}
        onOpenChange={(open) => { if (!open) setDisabledEmails([]); }}
        disabledItems={disabledEmails}
        onConfirm={() => {
          if (document) void send.run(document, parseEmails(recipients), true);
        }}
      />
    </>
  );
}
