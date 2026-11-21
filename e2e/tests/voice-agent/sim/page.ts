/**
 * Una pantalla de mentira para probar la voz genérica (src/lib/voice/dom-ui.ts) en Node: botones,
 * pestañas, campos, interruptores, listas desplegables y filas, con lo mínimo del DOM que se usa
 * (querySelectorAll('*'), atributos, texto, click, eventos). Se arma con `screen` y queda como el
 * <main> de la página o como el contenido de una ventana (openWindow({ tree })).
 */

export class FakeEl {
  attrs: Record<string, string> = {};
  children: FakeEl[] = [];
  parentElement: FakeEl | null = null;
  own = '';
  value = '';
  type?: string;
  disabled = false;
  checked?: boolean;
  labels?: Array<{ textContent: string }>;
  onClick?: () => void;
  onInput?: (value: string) => void;
  constructor(public tagName: string, attrs: Record<string, string> = {}, text = '') {
    this.attrs = attrs;
    this.own = text;
  }
  get textContent(): string {
    return [this.own, ...this.children.map((c) => c.textContent)].filter(Boolean).join(' ');
  }
  append(...children: FakeEl[]) {
    for (const c of children) { c.parentElement = this; this.children.push(c); }
    return this;
  }
  remove() {
    if (!this.parentElement) return;
    const list = this.parentElement.children;
    list.splice(list.indexOf(this), 1);
    this.parentElement = null;
  }
  descendants(): FakeEl[] {
    return this.children.flatMap((c) => [c, ...c.descendants()]);
  }
  getAttribute(name: string) { return name in this.attrs ? this.attrs[name] : null; }
  hasAttribute(name: string) { return name in this.attrs; }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  querySelectorAll(selector: string): FakeEl[] {
    const all = this.descendants();
    if (selector === '*') return all;
    return all.filter((el) => selector.split(',').some((part) => matchesSimple(el, part.trim())));
  }
  querySelector(selector: string): FakeEl | null {
    if (selector.includes('h2')) return this.descendants().find((d) => d.tagName === 'H2') ?? null;
    return this.querySelectorAll(selector)[0] ?? null;
  }
  closest() { return null; }
  click() { this.onClick?.(); }
  focus() {}
  dispatchEvent(event: { type?: string }) {
    if (event.type === 'input') this.onInput?.(this.value);
    return true;
  }
}

/** Selectores simples: «button», «[role="option"]», «tag[attr="v"]». */
function matchesSimple(el: FakeEl, part: string): boolean {
  const m = part.match(/^([a-z0-9]*)((?:\[[^\]]+\])*)$/i);
  if (!m) return false;
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  for (const a of m[2].matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    if (a[2] === undefined ? !el.hasAttribute(a[1]) : el.getAttribute(a[1]) !== a[2]) return false;
  }
  return true;
}

/** Opciones abiertas de una lista desplegable (Radix las pone en un portal). */
export const portal = new FakeEl('DIV');

/** Lo que pasó en la pantalla (para verificar). */
export const uiLog: string[] = [];

export const screen = {
  root: null as FakeEl | null,
  /** Arma el <main> de la página. */
  page(...children: FakeEl[]) {
    screen.root = new FakeEl('MAIN').append(...children);
    return screen.root;
  },
  reset() { screen.root = null; portal.children.length = 0; uiLog.length = 0; },
  heading(text: string) { return new FakeEl('H2', {}, text); },
  button(label: string, { aria, onClick, disabled = false }: { aria?: string; onClick?: () => void; disabled?: boolean } = {}) {
    const el = new FakeEl('BUTTON', aria ? { 'aria-label': aria } : {}, label);
    el.disabled = disabled;
    el.onClick = () => { uiLog.push(`press:${label || aria}`); onClick?.(); };
    return el;
  },
  tab(label: string, selected = false) {
    const el = new FakeEl('BUTTON', { role: 'tab', 'aria-selected': String(selected) }, label);
    el.onClick = () => { uiLog.push(`tab:${label}`); el.attrs['aria-selected'] = 'true'; };
    return el;
  },
  field(label: string, { placeholder, type = 'text', value = '' }: { placeholder?: string; type?: string; value?: string } = {}) {
    const el = new FakeEl(type === 'textarea' ? 'TEXTAREA' : 'INPUT', placeholder ? { placeholder } : {});
    el.type = type === 'textarea' ? undefined : type;
    el.value = value;
    el.labels = label ? [{ textContent: label }] : [];
    el.onInput = (v) => uiLog.push(`fill:${label || placeholder}=${v}`);
    return el;
  },
  toggle(label: string, checked = false) {
    const el = new FakeEl('BUTTON', { role: 'switch', 'aria-checked': String(checked), 'aria-label': label });
    el.onClick = () => {
      const now = el.attrs['aria-checked'] !== 'true';
      el.attrs['aria-checked'] = String(now);
      uiLog.push(`toggle:${label}=${now ? 'on' : 'off'}`);
    };
    return el;
  },
  select(label: string, options: string[], value = '') {
    const el = new FakeEl('BUTTON', { role: 'combobox', 'aria-label': label }, value);
    el.onClick = () => {
      portal.children.length = 0;
      for (const option of options) {
        const o = new FakeEl('DIV', { role: 'option' }, option);
        o.onClick = () => { el.own = option; uiLog.push(`select:${label}=${option}`); portal.children.length = 0; };
        portal.append(o);
      }
    };
    return el;
  },
  table(rows: string[], onOpen?: (index: number) => void) {
    const body = new FakeEl('TBODY');
    rows.forEach((text, i) => {
      const tr = new FakeEl('TR', {}, text);
      tr.onClick = () => { uiLog.push(`row:${text}`); onOpen?.(i); };
      body.append(tr);
    });
    return new FakeEl('TABLE').append(body);
  },
  group(...children: FakeEl[]) { return new FakeEl('DIV').append(...children); },
};
