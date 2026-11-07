/**
 * Registro de campos de React Hook Form que el asistente puede completar.
 *
 * `FormControl` registra cada campo con el id DOM de su control y un setter que
 * pasa por `form.setValue` — así se llenan igual inputs, Select de Radix,
 * checkboxes o PhoneInput, sin que cada página tenga que exponer nada. El motor
 * de guías busca el elemento visible por help id, toma su id DOM y usa el setter;
 * si el campo no está registrado (inputs sueltos), cae al setter nativo del DOM.
 */

type FieldSetter = (value: unknown) => void;

const registry = new Map<string, FieldSetter>();

export function registerHelpField(domId: string, setter: FieldSetter): () => void {
  registry.set(domId, setter);
  return () => {
    if (registry.get(domId) === setter) registry.delete(domId);
  };
}

export function getHelpFieldSetter(domId: string | null | undefined): FieldSetter | undefined {
  return domId ? registry.get(domId) : undefined;
}
