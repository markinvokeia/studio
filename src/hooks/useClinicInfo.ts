'use client';

import { API_ROUTES } from '@/constants/routes';
import { getWebhookBaseUrl } from '@/lib/runtime-config';
import { api } from '@/services/api';
import { useEffect, useState } from 'react';

export interface ClinicInfo {
  name: string;
  logoUrl: string;
  phone?: string;
  address?: string;
  email?: string;
  /** RUT de la clínica — se imprime en el membrete de recetas y comprobantes. */
  rut?: string;
  currency?: 'UYU' | 'USD';
}

// Module-level cache — fetched at most once per session across all components
let _cache: ClinicInfo | null = null;
let _promise: Promise<ClinicInfo | null> | null = null;

export function fetchClinicInfo(): Promise<ClinicInfo | null> {
  if (_promise) return _promise;
  _promise = api
    .get(API_ROUTES.CLINIC)
    .then((raw: unknown) => {
      const data = Array.isArray(raw) ? (raw as Record<string, unknown>[])[0] : (raw as Record<string, unknown>);
      if (!data) return null;
      const get = (...keys: string[]) => keys.map((k) => data[k]).find((v) => v != null && v !== '') as string | undefined;
      const rawCurrency = get('currency', 'moneda');
      const info: ClinicInfo = {
        name: get('name', 'clinic_name', 'nombre') ?? '',
        // Always use the n8n webhook endpoint — it handles Drive auth transparently.
        logoUrl: `${getWebhookBaseUrl()}/clinic/logo`,
        phone: get('phone', 'telefono', 'phone_number', 'tel'),
        address: get('address', 'direccion', 'domicilio'),
        email: get('email', 'correo'),
        rut: get('rut', 'RUT'),
        currency: rawCurrency === 'USD' || rawCurrency === 'UYU' ? rawCurrency : undefined,
      };
      _cache = info;
      return info;
    })
    .catch(() => null);
  return _promise;
}

export function useClinicInfo(): ClinicInfo | null {
  const [info, setInfo] = useState<ClinicInfo | null>(_cache);

  useEffect(() => {
    if (_cache) { setInfo(_cache); return; }
    fetchClinicInfo().then(setInfo);
  }, []);

  return info;
}
