import { publishVoiceBridge } from '@/lib/voice/screen-bridge';

import { openWindow } from './dom';
import { screen } from './page';

import type { CrudVoiceBridge } from '@/lib/types';

/** Una lista con la tabla común (lo que publica DataTable), p. ej. Medicamentos del catálogo. */
export interface SimCrud { bridge: CrudVoiceBridge; log: string[] }

const OWNER = {};

export function publishSimCrud({ createLabel = 'Nuevo medicamento', rows = ['Ibuprofeno · 400 mg', 'Amoxicilina · 500 mg', 'Ibuprofeno · 600 mg', 'Paracetamol · 1 g'] } = {}): SimCrud {
  const log: string[] = [];
  const bridge: CrudVoiceBridge = {
    createLabel,
    rows: rows.map((label, i) => ({ id: `r${i + 1}`, label })),
    total: rows.length,
    create: () => {
      log.push('create');
      // Se abre el formulario (con su campo de nombre), como en la app.
      openWindow(createLabel, { tree: screen.group(screen.field('Nombre'), screen.field('Descripción'), screen.button('Guardar')) });
    },
    open: (id) => log.push(`open:${id}`),
    refresh: () => log.push('refresh'),
  };
  publishVoiceBridge('crud.sim', bridge, OWNER);
  return { bridge, log };
}

export function clearSimCrud() { publishVoiceBridge('crud.sim', null, OWNER); }
