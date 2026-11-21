import { publishVoiceBridge } from '@/lib/voice/screen-bridge';

import type { RailVoiceBridge } from '@/lib/types';

/**
 * El riel derecho simulado (lo que publica src/components/voice/rail-voice-bridge.tsx), con un
 * registro de lo que pidió la voz.
 */
export interface SimRail {
  bridge: RailVoiceBridge;
  log: string[];
}

const OWNER = {};

export function createSimRail(): SimRail {
  const log: string[] = [];
  const bridge: RailVoiceBridge = {
    expanded: true,
    setExpanded: (open) => { bridge.expanded = open; log.push(`panel:${open ? 'open' : 'closed'}`); },
    cash: { open: false, balances: [] },
    sedes: [{ id: 's1', name: 'Centro' }, { id: 's2', name: 'Pocitos' }],
    activeSedeId: 's1',
    setSede: async (id) => { bridge.activeSedeId = id; log.push(`sede:${id}`); },
    tv: {
      status: 'on',
      rooms: [{ id: 'c1', name: 'Sillón 1', hasNext: true }, { id: 'c2', name: 'Sillón 2', hasNext: true }],
      setStatus: (status) => { bridge.tv!.status = status; log.push(`tv:${status}`); },
      next: (id) => log.push(`tv-next:${id}`),
      openScreen: () => log.push('tv-screen'),
    },
    alerts: { count: 3, highest: 'HIGH' },
    inbox: { count: 0, open: () => log.push('inbox') },
    notes: { count: 1, open: () => log.push('notes'), create: async (text) => { log.push(`note:${text}`); return true; } },
    exchange: { code: 'USD', rate: 39.5 },
    openBilling: (ctx) => log.push(`bill:${ctx.patientId ?? '-'}:${ctx.patientName ?? '-'}`),
  };
  publishVoiceBridge('rail', bridge, OWNER);
  return { bridge, log };
}

export function disposeSimRail() {
  publishVoiceBridge('rail', null, OWNER);
}
