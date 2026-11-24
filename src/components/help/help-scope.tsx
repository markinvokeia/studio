'use client';

import * as React from 'react';

import { composeHelpId } from '@/lib/help/help-id';

import type { HelpElementKind } from '@/lib/types';

/**
 * Scope de help ids de la pantalla actual. El layout autenticado lo deriva de la
 * ruta; un componente puede anidar otro (`<HelpScopeProvider scope="billing-wizard">`)
 * cuando se monta en muchas pantallas y conviene un id propio.
 */
const HelpScopeContext = React.createContext<string>('app');

export function HelpScopeProvider({ scope, children }: { scope: string; children: React.ReactNode }) {
  return <HelpScopeContext.Provider value={scope}>{children}</HelpScopeContext.Provider>;
}

export function useHelpScope(): string {
  return React.useContext(HelpScopeContext);
}

/**
 * Help id automático para una primitiva. Devuelve `undefined` cuando no hay
 * nombre (no se inventan ids) y respeta el `data-help-id` explícito.
 */
export function useAutoHelpId(kind: HelpElementKind, name: string | undefined, explicit?: string): string | undefined {
  const scope = useHelpScope();
  if (explicit) return explicit;
  if (!name) return undefined;
  return composeHelpId(scope, kind, name);
}
