'use client';

import * as React from 'react';
import { isValidPhoneNumber } from 'libphonenumber-js';

import { useDebounce } from '@/hooks/use-debounce';
import { DEFAULT_PHONE_COUNTRY } from '@/lib/countries';
import { isValidIdentityDocument } from '@/lib/identity-document';
import { isAbortError } from '@/services/api';
import { findExistingPatientMatches } from '@/components/patients/patient-form-utils';

import type { DuplicateContactOwner, IdentityDocumentType } from '@/lib/types';

const LOOKUP_DEBOUNCE_MS = 500;

/** Busca fichas con este valor exacto cuando el valor está completo; `[]` mientras tanto. */
function useFieldMatches(
  field: 'identity_document' | 'phone',
  value: string,
  isComplete: boolean,
  enabled: boolean,
): DuplicateContactOwner[] {
  const debounced = useDebounce(isComplete ? value.trim() : '', LOOKUP_DEBOUNCE_MS);
  const [matches, setMatches] = React.useState<{ value: string; owners: DuplicateContactOwner[] }>({ value: '', owners: [] });

  React.useEffect(() => {
    if (!enabled || !debounced) return;
    const controller = new AbortController();
    findExistingPatientMatches(field, debounced, controller.signal)
      .then((owners) => setMatches({ value: debounced, owners }))
      .catch((error) => {
        // Es solo un aviso: si falla, el control al guardar en `/users/upsert` sigue en pie.
        if (!isAbortError(error)) setMatches({ value: debounced, owners: [] });
      });
    return () => controller.abort();
  }, [debounced, enabled, field]);

  // Solo vale para el valor que sigue escrito: al corregirlo, el aviso desaparece enseguida.
  return enabled && isComplete && matches.value === value.trim() ? matches.owners : [];
}

/**
 * Aviso temprano durante el alta de un paciente: fichas que ya tienen la misma cédula o el
 * mismo teléfono, para que recepción elija la existente en vez de crear un duplicado.
 */
export function useExistingPatientLookup({
  enabled,
  identityDocument,
  identityDocumentType,
  phone,
}: {
  enabled: boolean;
  identityDocument: string;
  identityDocumentType: IdentityDocumentType;
  phone: string;
}) {
  const documentComplete = !!identityDocument.trim() && isValidIdentityDocument(identityDocument, identityDocumentType);
  const phoneComplete = !!phone.trim() && isValidPhoneNumber(phone, DEFAULT_PHONE_COUNTRY);

  return {
    identity_document: useFieldMatches('identity_document', identityDocument, documentComplete, enabled),
    phone: useFieldMatches('phone', phone, phoneComplete, enabled),
  };
}
