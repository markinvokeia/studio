import type { AestheticLayer, AestheticServiceConsent } from '@/lib/types';

/** Variables a service's consent text can use, filled in when the patient signs */
export const CONSENT_VARIABLES = ['patient_name', 'doctor_name', 'service_name', 'product_name', 'session_date'] as const;

export type ConsentVariable = (typeof CONSENT_VARIABLES)[number];

export type ConsentValues = Record<ConsentVariable, string>;

const VARIABLE_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g;

export const consentToken = (variable: ConsentVariable) => `{{${variable}}}`;

/** Replaces the known `{{variables}}`; an unknown one is left as written, so it shows up in the text */
export function renderConsentTemplate(body: string, values: ConsentValues): string {
  return body.replace(VARIABLE_PATTERN, (token, name: string) => (
    (CONSENT_VARIABLES as readonly string[]).includes(name) ? values[name as ConsentVariable] : token
  ));
}

/** Variables of the text that aren't any of the known ones (typos) */
export function unknownConsentVariables(body: string): string[] {
  const names = Array.from(body.matchAll(VARIABLE_PATTERN), (m) => m[1]);
  return [...new Set(names.filter((name) => !(CONSENT_VARIABLES as readonly string[]).includes(name)))];
}

/** Services of the session still waiting for a signed consent */
export function unsignedLayers(layers: AestheticLayer[], consents: Pick<AestheticServiceConsent, 'serviceId'>[]): AestheticLayer[] {
  const signed = new Set(consents.map((c) => c.serviceId));
  return layers.filter((l) => l.serviceId && !signed.has(l.serviceId));
}
