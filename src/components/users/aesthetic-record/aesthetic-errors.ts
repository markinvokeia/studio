import React from 'react';
import { useTranslations } from 'next-intl';

import { getErrorMessage } from '@/lib/error-utils';
import { isTimeoutError } from '@/services/api';

// The database functions and the "Aesthetic Record" flow raise 'AESTHETIC:<CODE>|<detail>', which
// reaches the screen as a 400 { success: false, code, detail, message }. Every code has its text in
// AestheticRecord.errors.codes; anything else gets the generic one, never the raw message.

/** Every code raised in database/scripts/151–158 and the flow, except SESSION_CLOSED (it depends on its detail) */
const TRANSLATED_CODES = [
  'CONSENT_REQUIRED',
  'CONSENT_SERVICES_REQUIRED',
  'CONSENT_SERVICE_NOT_IN_SESSION',
  'CONSENT_TEXT_REQUIRED',
  'DATE_REQUIRED',
  'DUPLICATE_SERVICE_LAYER',
  'FILE_REQUIRED',
  'INVALID_AREA',
  'INVALID_CONSENT',
  'INVALID_FILE_TYPE',
  'INVALID_LINE',
  'INVALID_NOTE_KIND',
  'INVALID_PHOTO_KIND',
  'INVALID_TOOL',
  'NOTE_REQUIRED',
  'NOT_READY_TO_CLOSE',
  'PATIENT_REQUIRED',
  'PHOTO_NOT_FOUND',
  'SERVICE_NOT_FOUND',
  'SESSION_NOT_FOUND',
  'SIGNATURE_NOT_FOUND',
  'SIGNER_REQUIRED',
  'UNIT_DUPLICATE_CODE',
  'UNIT_INVALID_STEP',
  'UNIT_NOT_FOUND',
  'UNIT_REQUIRED',
  'UNIT_REQUIRED_FIELDS',
  'VOID_REASON_REQUIRED',
] as const;

const CODE_IN_TEXT = /AESTHETIC:([A-Z_]+)(?:\|([^\n]*))?/;

interface AestheticErrorInfo {
  code: string | null;
  detail: string | null;
}

export function parseAestheticError(error: unknown): AestheticErrorInfo {
  const data = error && typeof error === 'object' ? (error as { data?: unknown }).data : null;
  const payload = (Array.isArray(data) ? data[0] : data) as { code?: unknown; detail?: unknown } | null | undefined;
  if (typeof payload?.code === 'string' && payload.code !== 'UNKNOWN') {
    return { code: payload.code, detail: typeof payload.detail === 'string' ? payload.detail : null };
  }
  const match = getErrorMessage(error).match(CODE_IN_TEXT);
  return { code: match?.[1] ?? null, detail: match?.[2]?.trim() || null };
}

/** The session was closed, voided or deleted behind this screen: trying again can't work */
export function isSessionLockedError(error: unknown): boolean {
  const { code, detail } = parseAestheticError(error);
  return code === 'SESSION_NOT_FOUND' || (code === 'SESSION_CLOSED' && (detail === 'closed' || detail === 'void'));
}

/** Text to show for an error of the aesthetic module's endpoints */
export function useAestheticErrorMessage() {
  const t = useTranslations('AestheticRecord.errors');
  const tCommon = useTranslations('Common');

  return React.useCallback((error: unknown): string => {
    if (isTimeoutError(error)) return tCommon('timeoutError');
    const { code, detail } = parseAestheticError(error);
    if (code === 'SESSION_CLOSED') {
      if (detail === 'closed') return t('sessionClosed');
      if (detail === 'void') return t('sessionVoided');
      return t('sessionStateChanged');
    }
    if (code && (TRANSLATED_CODES as readonly string[]).includes(code)) return t(`codes.${code}`);
    console.error('Aesthetic record: unexpected error', error);
    return t('generic');
  }, [t, tCommon]);
}
