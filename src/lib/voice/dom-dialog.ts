import { normalizeSpeech, parseChoice } from '@/lib/voice/parse';

/**
 * Avisos de la pantalla (AlertDialog: «¿Seguro que querés borrar la cita?», «El paciente ya tiene
 * citas futuras…», «Falta el documento…») que aparecen en medio de una acción. La voz los lee, dice
 * qué botones tienen y aprieta el que se nombre: por su texto («agendar igual»), por su posición
 * («el segundo») o por sí/no (el botón principal o el de cancelar). Los botones principal y de
 * cancelar se marcan con data-voice-dialog en src/components/ui/alert-dialog.tsx.
 */

export type DialogAnswer = 'confirm' | 'cancel';

export interface DialogButton {
  label: string;
  kind: 'confirm' | 'cancel' | 'other';
  element: HTMLButtonElement;
}

export interface OpenDialog {
  element: HTMLElement;
  title: string;
  description: string;
  buttons: DialogButton[];
}

const CONFIRM_RE = /^(?:(?:si|ok|okay|dale|bueno)\s?)?(?:continua\w*|segui\w*|sigue|acepta\w*|confirma\w*|adelante|hacelo|hazlo|si|ok|okay|dale|listo|de acuerdo|continue|proceed|accept|confirm|go ahead|yes|yeah|yep|sure|okay|ok|do it)(?:\s(?:igual|de todas formas|igualmente|anyway|please|por favor))?$/;
const CANCEL_RE = /^(?:(?:no\s)?(?:cancela\w*|volve\w*|vuelve|atras|cerra\w*|cierra\w*|no|nop|mejor no|no gracias|dejalo|deja|cancel|go back|back|close|no thanks|dismiss|nope|never mind))(?:\s(?:por favor|please))?$/;

/** Qué botón pide la frase por sí/no, o null. */
export function parseDialogAnswer(normalized: string): DialogAnswer | null {
  if (CANCEL_RE.test(normalized)) return 'cancel';
  if (CONFIRM_RE.test(normalized)) return 'confirm';
  return null;
}

/** El aviso abierto más reciente (el de arriba), o null. */
function topDialog(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  // Avisos (AlertDialog) y ventanitas de elegir marcadas con data-voice-popup (nota de cancelación, alcance de un recordatorio).
  const open = Array.from(document.querySelectorAll<HTMLElement>('[role="alertdialog"][data-state="open"], [role="dialog"][data-state="open"][data-voice-popup]'));
  return open.length ? open[open.length - 1] : null;
}

export function isDialogOpen(): boolean {
  return topDialog() !== null;
}

/** Título del aviso abierto (para decir qué se está contestando). */
export function openDialogTitle(): string | null {
  return readOpenDialog()?.title || null;
}

/** El aviso abierto con su texto y sus botones (visibles y habilitados), o null. */
export function readOpenDialog(): OpenDialog | null {
  const element = topDialog();
  if (!element) return null;
  const title = element.querySelector('h2, [id$="-title"]')?.textContent?.trim() ?? '';
  const description = element.querySelector('p, [id$="-description"]')?.textContent?.trim() ?? '';
  const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
    .filter((b) => (b.offsetParent !== null || typeof b.offsetParent === 'undefined') && (b.textContent ?? '').trim())
    .map((b) => ({
      label: (b.textContent ?? '').replace(/\s+/g, ' ').trim(),
      kind: (b.dataset.voiceDialog === 'confirm' ? 'confirm' : b.dataset.voiceDialog === 'cancel' ? 'cancel' : 'other') as DialogButton['kind'],
      element: b,
    }));
  if (!buttons.length) return null;
  // Sin marcas (avisos armados a mano): el último botón es el principal; el que dice cancelar, el de cancelar.
  if (!buttons.some((b) => b.kind === 'confirm')) buttons[buttons.length - 1].kind = 'confirm';
  if (!buttons.some((b) => b.kind === 'cancel')) {
    const cancel = buttons.find((b) => /cancel|volver|cerrar|close|back|no\b/i.test(b.label));
    if (cancel && cancel.kind !== 'confirm') cancel.kind = 'cancel';
  }
  return { element, title, description, buttons };
}

/**
 * El botón que pide lo dicho: el texto del botón («agendar igual», «eliminar»), la posición
 * («el segundo», «el último») o sí/no (principal / cancelar). null si no se entiende.
 */
export function pickDialogButton(normalized: string, buttons: DialogButton[]): DialogButton | null {
  const labels = buttons.map((b) => normalizeSpeech(b.label));
  // El texto entero de un botón dicho tal cual gana («cancelar», «aceptar», «sí, borrar»).
  const exact = labels.findIndex((l) => l && (normalized === l || ` ${normalized} `.includes(` ${l} `)));
  if (exact >= 0) return buttons[exact];
  const yesNo = parseDialogAnswer(normalized);
  if (yesNo) return buttons.find((b) => b.kind === yesNo) ?? null;
  const index = parseChoice(normalized, buttons.length, buttons.map((b) => b.label));
  return index !== null ? buttons[index] : null;
}

/** Aprieta el botón pedido del aviso abierto. false si no hay aviso o ese botón. */
export function answerDialog(answer: DialogAnswer): boolean {
  const button = readOpenDialog()?.buttons.find((b) => b.kind === answer);
  if (!button) return false;
  button.element.click();
  return true;
}

/**
 * Avisa cuando se abre un aviso nuevo y cuando se cierra (con el mouse o por voz). Devuelve la
 * función para dejar de mirar.
 */
export function watchDialogs(onOpen: (dialog: OpenDialog) => void, onClose: () => void): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  let current: HTMLElement | null = null;
  let frame = 0;
  const check = () => {
    frame = 0;
    const dialog = readOpenDialog();
    if (dialog && dialog.element !== current) {
      current = dialog.element;
      onOpen(dialog);
    } else if (!dialog && current) {
      current = null;
      onClose();
    }
  };
  const schedule = () => {
    if (frame) return;
    frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(check) : (setTimeout(check, 16) as unknown as number);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
  check();
  return () => observer.disconnect();
}

// ── Ventanas y paneles laterales abiertos (no avisos) ─────────────────────────

/** Ventanas, paneles laterales y popovers abiertos (estado de cuenta, historia, ficha…), el de arriba al final. */
function openOverlays(): HTMLElement[] {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]'))
    .filter((el) => !el.closest('[data-voice-card]') && !el.hasAttribute('data-voice-popup') && el.offsetWidth > 0);
}

export function hasOpenOverlay(): boolean {
  return openOverlays().length > 0;
}

/**
 * Cierra la ventana o el panel lateral de arriba como lo cerraría la persona: su botón de cerrar
 * (la X) o, si no tiene, la tecla Escape. Devuelve su título (o '' si no tiene), o null si no había.
 */
export function closeTopOverlay(): string | null {
  const overlays = openOverlays();
  const top = overlays[overlays.length - 1];
  if (!top) return null;
  const title = top.querySelector('h2, [id$="-title"]')?.textContent?.trim() ?? '';
  const closeButton = Array.from(top.querySelectorAll<HTMLButtonElement>('button')).find((b) => {
    const label = `${b.getAttribute('aria-label') ?? ''} ${b.querySelector('.sr-only')?.textContent ?? ''} ${b.getAttribute('title') ?? ''}`.toLowerCase();
    return /\b(?:close|cerrar)\b/.test(label);
  });
  if (closeButton) closeButton.click();
  else top.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  return title;
}

// ── Lo de la ventana abierta tiene prioridad: sus botones y sus campos ────────

export interface OverlayField {
  label: string;
  element: HTMLInputElement | HTMLTextAreaElement;
}

export interface OpenOverlay {
  element: HTMLElement;
  title: string;
  buttons: Array<{ label: string; element: HTMLButtonElement }>;
  fields: OverlayField[];
}

/** La ventana o panel lateral de arriba con sus botones (con texto) y sus campos de texto, o null. */
export function readTopOverlay(): OpenOverlay | null {
  const overlays = openOverlays();
  const element = overlays[overlays.length - 1];
  if (!element) return null;
  const title = element.querySelector('h2, [id$="-title"]')?.textContent?.trim() ?? '';
  const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
    .map((b) => ({ label: (b.textContent ?? '').replace(/\s+/g, ' ').trim(), element: b }))
    .filter((b) => b.label.length >= 2);
  const fields = Array.from(element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])'))
    .map((el) => ({
      label: (el.labels?.[0]?.textContent ?? el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? '').replace(/[*:]/g, '').replace(/\s+/g, ' ').trim(),
      element: el,
    }))
    .filter((f) => f.label.length >= 2);
  return { element, title, buttons, fields };
}

const PRESS = /^(?:(?:apreta\w*|apretar|toca\w*|tocar|presiona\w*|clic(?:k)?ea\w*|hace\w* (?:clic|click)|haz (?:clic|click)|dale(?: (?:clic|click))?|selecciona\w*|elegi\w*|click(?: on)?|press|tap(?: on)?|hit|choose|select)\s(?:en |a |al |el |la |on |the )?(?:boton |button )?)/;

/** «apretá Guardar», «dale a Editar», «click Save», o el texto de un botón dicho tal cual. */
export function pickOverlayButton(normalized: string, overlay: OpenOverlay): OpenOverlay['buttons'][number] | null {
  const press = normalized.match(PRESS);
  const said = press ? normalized.slice(press[0].length).trim() : normalized;
  const labels = overlay.buttons.map((b) => normalizeSpeech(b.label));
  const exact = labels.findIndex((l) => l === said);
  if (exact >= 0) return overlay.buttons[exact];
  if (!press) return null;
  const partial = labels.findIndex((l) => l.startsWith(said) || said.startsWith(l));
  return partial >= 0 ? overlay.buttons[partial] : null;
}

const FILL = /^(?:pone\w*|pon|escribi\w*|escribe|completa\w*|llena\w*|cambia\w*|carga\w*|ingresa\w*|anota\w*|set|type|write|fill(?: in)?|enter|put|change)\s(?:en |in |el campo |the field |el |la |the )*/;

/** «poné en teléfono 099…», «el email es ana@…», «notas: trae estudios»: el campo y su valor. */
export function pickOverlayField(raw: string, normalized: string, overlay: OpenOverlay): { field: OverlayField; value: string } | null {
  const fill = normalized.match(FILL);
  const body = fill ? normalized.slice(fill[0].length) : normalized;
  let best: { field: OverlayField; rest: string; len: number; connector: string } | null = null;
  for (const field of overlay.fields) {
    const label = normalizeSpeech(field.label);
    if (!label) continue;
    const m = body.match(new RegExp(`^(?:el |la |los |las |the |my |mi |su |his |her )?${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s(es|son|sea|a|con|en|por|is|are|to|with|as)\\b)?\\s?(.*)$`));
    if (m && m[2] && (!best || label.length > best.len)) best = { field, rest: m[2], len: label.length, connector: m[1] ?? '' };
  }
  if (!best) return null;
  // Sin verbo («poné…»), solo «el email es …» o «notas: …» (si no, podría ser otra cosa).
  if (!fill && !/^(?:es|son|is|are)$/.test(best.connector) && !/:/.test(raw)) return null;
  // El valor tal como se dijo (mayúsculas, tildes, «@», «-»): lo que sigue al campo en la frase original.
  const prefix = normalized.slice(0, normalized.length - best.rest.length).trim();
  const tokens = raw.trim().split(/\s+/);
  let cut = 0;
  for (let i = 1; i <= tokens.length; i++) {
    if (normalizeSpeech(tokens.slice(0, i).join(' ')) === prefix) { cut = i; break; }
  }
  const value = (cut ? tokens.slice(cut) : tokens.slice(-best.rest.split(' ').length)).join(' ').replace(/^[:,\s]+/, '').replace(/^(?:es|son|a|con|en|is|to|with)\s+/i, '');
  return value ? { field: best.field, value } : null;
}

/** Escribe en el campo como si se tipeara (React se entera del cambio). */
export function setFieldValue(field: OverlayField, value: string) {
  const el = field.element;
  const Ctor = el.tagName === 'TEXTAREA'
    ? (typeof HTMLTextAreaElement !== 'undefined' ? HTMLTextAreaElement : null)
    : (typeof HTMLInputElement !== 'undefined' ? HTMLInputElement : null);
  const setter = Ctor ? Object.getOwnPropertyDescriptor(Ctor.prototype, 'value')?.set : undefined;
  if (setter) setter.call(el, value); else (el as { value: string }).value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
