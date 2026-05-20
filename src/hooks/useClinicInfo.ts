'use client';

import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { useEffect, useState } from 'react';

export interface ClinicInfo {
  name: string;
  logoUrl: string;
  phone?: string;
  address?: string;
  email?: string;
}

// Module-level cache — fetched at most once per session across all components
let _cache: ClinicInfo | null = null;
let _promise: Promise<ClinicInfo | null> | null = null;

const BASE_WEBHOOK = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/webhook`
  : 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook';

function fetchClinicInfo(): Promise<ClinicInfo | null> {
  if (_promise) return _promise;
  _promise = api
    .get(API_ROUTES.CLINIC)
    .then((raw: unknown) => {
      const data = Array.isArray(raw) ? (raw as Record<string, unknown>[])[0] : (raw as Record<string, unknown>);
      if (!data) return null;
      const get = (...keys: string[]) => keys.map((k) => data[k]).find((v) => v != null && v !== '') as string | undefined;
      const info: ClinicInfo = {
        name: get('name', 'clinic_name', 'nombre') ?? '',
        // Always use the n8n webhook endpoint — it handles Drive auth transparently.
        logoUrl: `${BASE_WEBHOOK}/clinic/logo`,
        phone: get('phone', 'telefono', 'phone_number', 'tel'),
        address: get('address', 'direccion', 'domicilio'),
        email: get('email', 'correo'),
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
