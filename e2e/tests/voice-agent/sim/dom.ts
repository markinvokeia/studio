/**
 * Lo mínimo del DOM para probar los avisos y las ventanas por voz en Node: avisos (AlertDialog o
 * ventanitas con data-voice-popup) y ventanas/paneles laterales (role="dialog") con sus botones.
 * Apretar un botón lo registra y, si corresponde, cierra el aviso. Avisa a los MutationObserver
 * como lo haría el navegador.
 */

import { portal, screen, type FakeEl } from './page';

type Observer = { callback: () => void };
const observers = new Set<Observer>();
const notify = () => { for (const o of observers) o.callback(); };

class FakeButton {
  dataset: Record<string, string> = {};
  offsetParent = {};
  disabled = false;
  constructor(public textContent: string, private onClick: () => void, kind?: 'confirm' | 'cancel', private aria = '') {
    if (kind) this.dataset.voiceDialog = kind;
  }
  click() { this.onClick(); }
  getAttribute(name: string) { return name === 'aria-label' ? this.aria : null; }
  querySelector(selector: string) { return selector === '.sr-only' && this.aria ? { textContent: this.aria } : null; }
}

export interface FakePopup {
  title: string;
  open: boolean;
  /** Botones apretados, en orden. */
  pressed: string[];
  close: () => void;
}

class FakeField {
  value = '';
  tagName: string;
  labels: Array<{ textContent: string }>;
  constructor(label: string, multiline = false) { this.labels = [{ textContent: label }]; this.tagName = multiline ? 'TEXTAREA' : 'INPUT'; }
  getAttribute() { return null; }
  dispatchEvent() { return true; }
}

class FakeDialog {
  fields: FakeField[] = [];
  /** Contenido armado con `screen` (para la voz genérica). */
  tree: FakeEl | null = null;
  dataState = 'open';
  offsetWidth = 400;
  buttons: FakeButton[] = [];
  constructor(public role: 'alertdialog' | 'dialog', public popup: FakePopup, private description: string, public voicePopup: boolean) {}
  querySelector(selector: string) {
    if (selector.includes('h2')) return { textContent: this.popup.title };
    if (selector.startsWith('p')) return this.description ? { textContent: this.description } : null;
    return null;
  }
  querySelectorAll(selector: string) {
    if (selector.startsWith('button')) return this.buttons.filter((b) => !b.disabled);
    if (selector.startsWith('input')) return this.fields;
    if (selector === '*') return this.tree ? this.tree.descendants() : [];
    return [];
  }
  getAttribute() { return null; }
  closest() { return null; }
  hasAttribute(name: string) { return name === 'data-voice-popup' && this.voicePopup; }
  dispatchEvent(event: { key?: string }) { if (event.key === 'Escape') this.popup.close(); return true; }
}

const dialogs: FakeDialog[] = [];

export interface PopupButtonSpec { label: string; kind?: 'confirm' | 'cancel'; closes?: boolean }

/** Abre un aviso con esos botones (por defecto cada botón lo cierra). */
export function openPopup(title: string, buttons: PopupButtonSpec[], { description = '', role = 'alertdialog' as 'alertdialog' | 'dialog' } = {}): FakePopup {
  const popup: FakePopup = { title, open: true, pressed: [], close: () => {} };
  const dialog = new FakeDialog(role, popup, description, role === 'dialog');
  popup.close = () => { popup.open = false; const i = dialogs.indexOf(dialog); if (i >= 0) dialogs.splice(i, 1); notify(); };
  dialog.buttons = buttons.map((b) => new FakeButton(b.label, () => { popup.pressed.push(b.label); if (b.closes !== false) popup.close(); }, b.kind));
  dialogs.push(dialog);
  notify();
  return popup;
}

export interface FakeWindow extends FakePopup {
  /** Lo escrito en cada campo, por su etiqueta. */
  values: Record<string, string>;
}

/** Abre una ventana o panel lateral (estado de cuenta, historia, un formulario…) con su X, botones y campos. */
export function openWindow(title: string, { buttons = [] as string[], fields = [] as string[], tree = null as FakeEl | null } = {}): FakeWindow {
  const popup: FakeWindow = { title, open: true, pressed: [], close: () => {}, values: {} };
  const dialog = new FakeDialog('dialog', popup, '', false);
  popup.close = () => { popup.open = false; const i = dialogs.indexOf(dialog); if (i >= 0) dialogs.splice(i, 1); notify(); };
  dialog.buttons = [
    new FakeButton('', () => { popup.pressed.push('X'); popup.close(); }, undefined, 'Close'),
    ...buttons.map((label) => new FakeButton(label, () => { popup.pressed.push(label); })),
  ];
  dialog.tree = tree;
  dialog.fields = fields.map((label) => {
    const field = new FakeField(label);
    Object.defineProperty(popup.values, label, { get: () => field.value, enumerable: true });
    return field;
  });
  dialogs.push(dialog);
  notify();
  return popup;
}

/** Notificaciones abiertas con botones (Radix Toast con ToastAction). */
const toasts: FakeDialog[] = [];

/** Abre una notificación con botones («Deshacer», «Ver»); apretar uno la cierra. */
export function openToast(title: string, actions: string[], { description = '' } = {}): FakePopup {
  const popup: FakePopup = { title, open: true, pressed: [], close: () => {} };
  const toast = new FakeDialog('dialog', popup, description, false);
  popup.close = () => { popup.open = false; const i = toasts.indexOf(toast); if (i >= 0) toasts.splice(i, 1); notify(); };
  toast.buttons = [
    new FakeButton('', () => popup.close(), undefined, 'Close'),
    ...actions.map((label) => {
      const b = new FakeButton(label, () => { popup.pressed.push(label); popup.close(); });
      (b as unknown as { closest: () => FakeDialog | null }).closest = () => (popup.open ? toast : null);
      return b;
    }),
  ];
  toasts.push(toast);
  notify();
  return popup;
}

export function resetDom() {
  toasts.length = 0;
  dialogs.length = 0;
  screen.reset();
  scrollLog.length = 0;
}

const matches = (d: FakeDialog, part: string) => {
  const role = part.match(/\[role="(\w+)"\]/)?.[1];
  if (role && d.role !== role) return false;
  if (part.includes('[data-voice-popup]') && !d.voicePopup) return false;
  return true;
};

/** Lo que se puede desplazar en la página (la grilla de la agenda) y lo que se pidió mover. */
export const scrollLog: Array<{ by?: Record<string, number>; to?: Record<string, number> }> = [];
const page = {
  scrollHeight: 3000, clientHeight: 800, scrollWidth: 1200, clientWidth: 1200, clientArea: 1,
  scrollBy: (opts: Record<string, number>) => { scrollLog.push({ by: { top: opts.top, left: opts.left } as Record<string, number> }); },
  scrollTo: (opts: Record<string, number>) => { scrollLog.push({ to: { top: opts.top, left: opts.left } as Record<string, number> }); },
  closest: () => null,
};

const g = globalThis as unknown as Record<string, unknown>;
g.document = {
  body: {},
  scrollingElement: page,
  querySelectorAll: (selector: string) => {
    if (selector === '*') return [page];
    if (selector === '[role="option"]') return portal.querySelectorAll('[role="option"]');
    if (selector === '[data-voice-toast-action]') return toasts.flatMap((t) => t.buttons.filter((b) => b.textContent));
    return dialogs.filter((d) => selector.split(',').some((part) => matches(d, part.trim())));
  },
  querySelector: (selector: string) => {
    if (selector === 'main') return screen.root;
    const help = selector.match(/^\[data-help-id="([^"]+)"\]$/);
    if (help) return screen.root?.descendants().find((el) => el.getAttribute('data-help-id') === help[1]) ?? null;
    return null;
  },
};
g.getComputedStyle = () => ({ overflowY: 'auto', overflowX: 'auto' });
g.MutationObserver = class {
  private entry: Observer;
  constructor(callback: () => void) { this.entry = { callback }; }
  observe() { observers.add(this.entry); }
  disconnect() { observers.delete(this.entry); }
};
g.requestAnimationFrame = (fn: () => void) => setTimeout(fn, 0) as unknown as number;
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
g.KeyboardEvent = class { key: string; constructor(_type: string, init: { key: string }) { this.key = init.key; } };
