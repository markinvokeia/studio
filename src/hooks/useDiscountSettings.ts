'use client';

import { SALES_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import type { DiscountScope } from '@/lib/types';
import { useClinicPreferencesStore } from '@/stores/clinic-preferences-store';

export interface DiscountSettings {
  /** La clínica tiene los descuentos habilitados. FALSE ⇒ no renderizar nada. */
  enabled: boolean;
  /** Sólo se muestra el control del ámbito activo: o por línea, o al total. */
  scope: DiscountScope;
  /** Porcentaje con el que arranca el campo. 0 ⇒ vacío. */
  defaultPct: number;
  /** Tope que el formulario deja guardar, en % sobre la base. */
  maxPct: number;
  /** Sin `SALES_APPLY_DISCOUNT` el campo se muestra, pero en solo lectura. */
  canApply: boolean;
  /** Atajos para no repetir `enabled && scope === '…'` en cada formulario. */
  showLineDiscount: boolean;
  showTotalDiscount: boolean;
}

/**
 * Única puerta de entrada de los formularios de venta a la política de
 * descuentos: combina las preferencias cacheadas de la clínica con el permiso
 * del usuario. Nunca dispara una petición.
 */
export function useDiscountSettings(): DiscountSettings {
  const preferences = useClinicPreferencesStore((s) => s.preferences);
  const { hasPermission } = usePermissions();

  const enabled = preferences.discounts_enabled;
  const scope = preferences.discount_scope;

  return {
    enabled,
    scope,
    defaultPct: preferences.default_discount_pct,
    maxPct: preferences.max_discount_pct,
    canApply: hasPermission(SALES_PERMISSIONS.APPLY_DISCOUNT),
    showLineDiscount: enabled && scope === 'line',
    showTotalDiscount: enabled && scope === 'total',
  };
}
