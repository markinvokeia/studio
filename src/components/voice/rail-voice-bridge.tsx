'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';

import { useAuth } from '@/context/AuthContext';
import { useAlertNotifications } from '@/context/alert-notifications-context';
import { useNotifications } from '@/context/notifications-context';
import { useTVDisplay } from '@/context/tv-display-context';
import { useCurrencySettings } from '@/hooks/useCurrencySettings';
import { usePermissions } from '@/hooks/usePermissions';
import { normalizeCurrencyCode } from '@/constants/currencies';
import { useVoiceBridge } from '@/lib/voice/screen-bridge';
import { useBillingWizard } from '@/stores/billing-wizard-store';

import { CASHIER_PERMISSIONS, STICKY_NOTES_PERMISSIONS, TV_DISPLAY_PERMISSIONS } from '@/constants/permissions';
import type { RailVoiceBridge as RailBridge } from '@/lib/types';

interface Props {
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  notesCount: number;
  openNotes: () => void;
  createNote: (text: string) => Promise<boolean>;
}

/**
 * Publica para la voz lo que tiene el riel derecho (paciente, sede, caja, TV, cobrar, alertas,
 * bandeja, notas, asistente): «cambiá a la sede Centro», «¿está abierta la caja?», «siguiente
 * paciente en el sillón 1», «nueva nota: llamar a Ana». Lo monta el Header.
 */
export function RailVoiceBridge({ expanded, setExpanded, notesCount, openNotes, createNote }: Props) {
  const locale = useLocale();
  const { activeCashSession, sedes, activeSede, setActiveSede } = useAuth();
  const { pendingCount: alertCount, highestPriority } = useAlertNotifications();
  const { pendingCount: inboxCount, openPanel } = useNotifications();
  const tv = useTVDisplay();
  const { isDual, secondaryCode } = useCurrencySettings();
  const { hasPermission } = usePermissions();
  const { open: openBilling } = useBillingWizard();

  const balances = ((activeCashSession?.data?.current_balances ?? []) as Array<{ currency?: string; cash_on_hand?: number }>)
    .map((b) => ({ currency: normalizeCurrencyCode(b?.currency) ?? '', amount: Number(b?.cash_on_hand) || 0 }))
    .filter((b) => b.currency);
  const rate = Number(activeCashSession?.data?.opening_details?.date_rate) || 0;

  const bridge: RailBridge = {
    expanded,
    setExpanded,
    cash: hasPermission(CASHIER_PERMISSIONS.VIEW_WIDGET) ? { open: !!activeCashSession?.data?.current_balances, balances } : null,
    sedes: (sedes ?? []).map((s) => ({ id: String(s.id), name: String(s.name ?? '') })),
    activeSedeId: activeSede?.id ? String(activeSede.id) : null,
    setSede: (id) => setActiveSede(id),
    tv: hasPermission(TV_DISPLAY_PERMISSIONS.VIEW_MENU) ? {
      status: tv.status,
      rooms: tv.rooms.map((r) => ({ id: r.calendarId, name: r.calendarName, hasNext: r.currentIndex < r.appointments.length })),
      setStatus: tv.setStatus,
      next: tv.nextPatient,
      openScreen: () => tv.openTVScreen(locale),
    } : null,
    alerts: { count: alertCount, highest: highestPriority },
    inbox: { count: inboxCount, open: openPanel },
    notes: hasPermission(STICKY_NOTES_PERMISSIONS.VIEW) ? { count: notesCount, open: openNotes, create: createNote } : null,
    exchange: isDual && rate && secondaryCode ? { code: secondaryCode, rate } : null,
    openBilling: (context) => openBilling(context),
  };
  useVoiceBridge('rail', bridge);
  return null;
}
