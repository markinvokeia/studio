'use client';

import * as React from 'react';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { CommunicationTemplate } from '@/lib/types';

export type CommTemplateMap = Record<string, CommunicationTemplate>;

let _cache: CommTemplateMap | null = null;
let _pending: Promise<CommTemplateMap> | null = null;

function loadTemplates(): Promise<CommTemplateMap> {
  if (_cache) return Promise.resolve(_cache);
  if (!_pending) {
    _pending = api
      .get(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES)
      .then((raw: unknown) => {
        const list: CommunicationTemplate[] = Array.isArray(raw) ? raw : [];
        _cache = Object.fromEntries(list.map((t) => [t.code, t]));
        return _cache;
      })
      .catch(() => {
        _pending = null;
        return {} as CommTemplateMap;
      });
  }
  return _pending;
}

export function invalidateCommTemplatesCache() {
  _cache = null;
  _pending = null;
}

export function useCommunicationTemplates(): CommTemplateMap {
  const [map, setMap] = React.useState<CommTemplateMap>(_cache ?? {});
  React.useEffect(() => { loadTemplates().then(setMap); }, []);
  return map;
}

export function substituteTokens(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
