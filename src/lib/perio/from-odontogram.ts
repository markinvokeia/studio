import type { OdontogramState, PerioToothStatus } from '@/lib/types';

import { getToothProcedures } from '@/components/users/dental-record/odontogram-state';

import { PERIO_LOWER, PERIO_UPPER } from './teeth';

// Which teeth are probed, from the latest odontogram. It is only the starting point: the
// professional can change any tooth in the exam, and the exam keeps its own copy.
//
//   missing, edentulism                         → missing
//   implant (existing)                          → implant
//   inside an existing bridge (not its ends)    → pontic
//   everything else (also extraction-indicated: the tooth is still there) → present

const ABSENT = new Set(['missing', 'edentulism']);
const IMPLANT = new Set(['implant-osseo', 'implant']);
const BRIDGE = new Set(['fixed-prosth', 'bridge-defective']);

export function toothStatusesFromOdontogram(state: OdontogramState | null | undefined): Map<number, PerioToothStatus> {
  const out = new Map<number, PerioToothStatus>();
  if (!state) return out;
  const procedures = (tooth: number) => getToothProcedures(state[String(tooth)]);

  for (const tooth of [...PERIO_UPPER, ...PERIO_LOWER]) {
    const list = procedures(tooth);
    if (list.some((c) => IMPLANT.has(c))) out.set(tooth, 'implant');
    else if (list.some((c) => ABSENT.has(c))) out.set(tooth, 'missing');
  }

  // A bridge is a run of teeth marked with an existing bridge (grouped by `meta.range` when it
  // has one): its ends are the pillars, the teeth in between are pontics
  for (const arch of [PERIO_UPPER, PERIO_LOWER]) {
    const groupOf = (tooth: number | undefined) => {
      if (tooth == null) return null;
      const t = state[String(tooth)];
      const id = getToothProcedures(t).find((c) => BRIDGE.has(c));
      if (!id) return null;
      return t?.meta?.[`t:${id}`]?.range ?? 'run';
    };
    arch.forEach((tooth, i) => {
      const group = groupOf(tooth);
      if (!group) return;
      const inside = groupOf(arch[i - 1]) === group && groupOf(arch[i + 1]) === group;
      if (inside && out.get(tooth) !== 'implant') out.set(tooth, 'pontic');
    });
  }
  return out;
}
