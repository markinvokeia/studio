import React from 'react';
import { useTranslations } from 'next-intl';

import { getErrorMessage } from '@/lib/error-utils';
import { isTimeoutError } from '@/services/api';

// The database functions raise 'PERIO:<CODE>|<detail>' (database/scripts/162), which reaches the
// screen as a 400 { success: false, code, detail }. Every code has its text in
// PerioRecord.errors.codes; anything else gets the generic one, never the raw message.

const TRANSLATED_CODES = [
  'AMENDMENT_REQUIRED',
  'BILLING_PENDING',
  'INVOICE_ALREADY_LINKED',
  'INVOICE_NOT_FOUND',
  'NEXT_VISIT_PENDING',
  'NOT_CLOSED',
  'DATE_REQUIRED',
  'EXAM_CLOSED',
  'EXAM_NOT_FOUND',
  'INVALID_DIAGNOSIS',
  'INVALID_TOOTH',
  'INVALID_TOOTH_STATUS',
  'INVALID_VALUE',
  'NOT_READY_TO_CLOSE',
  'PATIENT_REQUIRED',
] as const;

const CODE_IN_TEXT = /PERIO:([A-Z_]+)(?:\|([^\n]*))?/;

export function parsePerioError(error: unknown): { code: string | null; detail: string | null } {
  const data = error && typeof error === 'object' ? (error as { data?: unknown }).data : null;
  const payload = (Array.isArray(data) ? data[0] : data) as { code?: unknown; detail?: unknown } | null | undefined;
  if (typeof payload?.code === 'string' && payload.code !== 'UNKNOWN') {
    return { code: payload.code, detail: typeof payload.detail === 'string' ? payload.detail : null };
  }
  const match = getErrorMessage(error).match(CODE_IN_TEXT);
  return { code: match?.[1] ?? null, detail: match?.[2]?.trim() || null };
}

/** The exam was closed or deleted behind this screen: trying again can't work */
export function isExamLockedError(error: unknown): boolean {
  const { code } = parsePerioError(error);
  return code === 'EXAM_CLOSED' || code === 'EXAM_NOT_FOUND';
}

export function usePerioErrorMessage() {
  const t = useTranslations('PerioRecord.errors');
  const tCommon = useTranslations('Common');
  return React.useCallback((error: unknown): string => {
    if (isTimeoutError(error)) return tCommon('timeoutError');
    const { code } = parsePerioError(error);
    if (code && (TRANSLATED_CODES as readonly string[]).includes(code)) return t(`codes.${code}`);
    console.error('Perio record: unexpected error', error);
    return t('generic');
  }, [t, tCommon]);
}
