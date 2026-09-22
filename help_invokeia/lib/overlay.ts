/**
 * Capa de presentación que se dibuja encima de la app durante la grabación:
 * cartel de título, subtítulo por paso, cursor falso y resaltado del elemento.
 *
 * `installOverlay` se serializa y se ejecuta EN EL NAVEGADOR vía
 * `context.addInitScript`, así que tiene que ser autocontenida: no puede
 * referenciar imports ni nada del ámbito del módulo.
 *
 * Tres decisiones que importan:
 *
 * - **Nada de DOM en el arranque.** `addInitScript` corre antes de que exista el
 *   documento: ahí `document.documentElement` y `document.body` son `null`.
 *   Todo el trabajo sobre el DOM se difiere a `ensure()`, idempotente, que
 *   llaman tanto el bootstrap como cada método de la API.
 *
 * - **Shadow root `closed`.** Los engines `css` y `text` de Playwright perforan
 *   los shadow roots abiertos. Con `open`, un `getByText('¿Cómo agendo una
 *   cita?')` del spec matchearía el cartel del overlay en vez de la app.
 *
 * - **Se oculta el overlay de desarrollo de Next.** `<nextjs-portal>` no sólo
 *   ensucia todos los frames: se superpone a la esquina inferior izquierda e
 *   **intercepta los clics** sobre el avatar de la barra lateral.
 */

export interface DemoBoot {
  id: string;
  title: string;
  kicker: string;
  /** Oculta el badge de devtools de Next (dev server). Inocuo en producción. */
  hideNextBadge: boolean;
  /** Logo de marca como data URI: se pinta centrado, encima del título. */
  logo: string;
  /** Línea de contacto del footer (correo · sitio · WhatsApp). */
  contact: string;
  /** Aviso de copyright y distribución, debajo del contacto. */
  copyright: string;
  /**
   * Tope del cartel de apertura, en ms, contado desde que carga el documento.
   *
   * Va acá y no sólo en la llamada a `card()` porque el cartel se pone estando
   * en `about:blank`, cuyo origen es opaco: ahí `sessionStorage.setItem` falla en
   * silencio y el tope nunca llega al documento siguiente. Ese era el motivo de
   * que el cartel se quedara casi diez segundos en pantalla.
   */
  introMs: number;
}

export interface DemoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** API que el overlay expone en `window.__demo`. */
export interface DemoApi {
  /** `ttlMs` pone un tope duro: pasado ese tiempo el cartel se baja solo. */
  card(kicker: string, title: string, sub?: string, ttlMs?: number): void;
  lower(text: string, idx?: string): void;
  off(): void;
  cursorTo(x: number, y: number, ms?: number): void;
  press(): void;
  halo(rect: DemoRect | null): void;
  redact(rects: DemoRect[]): void;
}

declare global {
  interface Window {
    __demo?: DemoApi;
  }
}

export function installOverlay(boot: DemoBoot): void {
  if (window.top !== window.self) return; // nunca dentro de iframes
  if (window.__demo) return;

  const KEY = '__demo_state__';
  type Mode = 'card' | 'lower' | 'off';
  interface State {
    mode: Mode;
    kicker: string;
    title: string;
    sub: string;
    idx: string;
    /** Marca de tiempo tras la cual el cartel deja de mostrarse. */
    cardUntil?: number;
  }

  const TEMPLATE = `
    <style>
      :host, * { box-sizing: border-box; }
      .layer { position:fixed; inset:0; pointer-events:none;
               font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif; }

      .card { position:absolute; inset:0; display:flex; flex-direction:column;
              align-items:center; justify-content:center; gap:12px;
              background: radial-gradient(120% 120% at 50% 0%, #4B1D97 0%, #2A0F57 100%);
              color:#fff; opacity:0; transition: opacity .28s ease; }
      .card[data-on="1"] { opacity:1; }
      .card .logo   { width:92px; height:92px; object-fit:contain; margin-bottom:2px;
                      filter: drop-shadow(0 6px 18px rgba(0,0,0,.35)); }
      .card .kicker { font-size:15px; letter-spacing:.16em; text-transform:uppercase;
                      opacity:.72; font-weight:600; }
      .card .title  { font-size:42px; font-weight:700; max-width:76%; text-align:center;
                      line-height:1.2; }
      .card .sub    { font-size:19px; opacity:.8; max-width:70%; text-align:center; }

      /* Footer de marca, anclado al borde inferior del cartel. */
      .card .footer { position:absolute; left:0; right:0; bottom:26px;
                      display:flex; flex-direction:column; align-items:center; gap:5px;
                      padding:0 8%; text-align:center; }
      .card .contact   { font-size:14px; font-weight:600; opacity:.9;
                         letter-spacing:.02em; }
      .card .copyright { font-size:10.5px; opacity:.55; line-height:1.45; max-width:80%; }

      .lower { position:absolute; left:50%; bottom:34px;
               transform:translateX(-50%) translateY(14px);
               display:flex; align-items:center; gap:12px; max-width:78vw;
               padding:13px 22px; border-radius:14px;
               background:rgba(17,12,30,.92); color:#fff; font-size:19px; font-weight:500;
               box-shadow:0 10px 34px rgba(0,0,0,.34);
               opacity:0; transition:opacity .26s ease, transform .26s ease; }
      .lower[data-on="1"] { opacity:1; transform:translateX(-50%) translateY(0); }
      .lower .idx { font-variant-numeric:tabular-nums; font-size:13px; font-weight:700;
                    padding:3px 9px; border-radius:999px; background:#7C3AED; }

      .halo { position:fixed; border-radius:10px; opacity:0;
              outline:3px solid #A78BFA; outline-offset:3px;
              box-shadow:0 0 0 9999px rgba(10,6,20,.30), 0 0 26px 6px rgba(167,139,250,.75);
              transition:opacity .2s ease, top .3s ease, left .3s ease,
                         width .3s ease, height .3s ease; }
      .halo[data-on="1"] { opacity:1; }

      /* El screencast de Playwright no captura el puntero real: lo dibujamos. */
      .cursor { position:fixed; top:0; left:0; width:26px; height:26px; opacity:0;
                transform:translate3d(-40px,-40px,0);
                transition:transform var(--move,520ms) cubic-bezier(.22,.61,.36,1),
                           opacity .2s ease;
                filter:drop-shadow(0 3px 5px rgba(0,0,0,.45)); }
      .cursor[data-on="1"] { opacity:1; }
      .cursor.press .ring { animation:ping .45s ease-out; }
      .ring { position:absolute; left:-9px; top:-9px; width:44px; height:44px;
              border-radius:50%; border:3px solid #7C3AED; opacity:0; }
      @keyframes ping { 0% { transform:scale(.3); opacity:.95 }
                        100% { transform:scale(1.25); opacity:0 } }

      .redact { position:fixed; border-radius:8px; backdrop-filter:blur(11px);
                background:rgba(120,110,140,.22); }
    </style>
    <div class="layer">
      <div class="card">
        <img class="logo" alt="" />
        <div class="kicker"></div>
        <div class="title"></div>
        <div class="sub"></div>
        <div class="footer">
          <div class="contact"></div>
          <div class="copyright"></div>
        </div>
      </div>
      <div class="lower"><span class="idx"></span><span class="txt"></span></div>
      <div class="halo"></div>
      <div class="cursor">
        <div class="ring"></div>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M5 2l14 9-6.2 1.2L16 20l-2.6 1.2-3-7.3L5 18z"
                fill="#12091f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="redacts"></div>
    </div>`;

  const HIDE_DEV_BADGE =
    'nextjs-portal,[data-next-badge],[data-next-badge-root],[data-nextjs-toast]' +
    '{display:none!important;pointer-events:none!important;}';

  const load = (): State => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as State;
    } catch {
      /* origin opaco (about:blank): caemos al bootstrap */
    }
    // Sin estado guardado: es el primer documento real. El tope se cuenta desde
    // acá, que es justo cuando se quiere empezar a contarlo.
    return {
      mode: 'card',
      kicker: boot.kicker,
      title: boot.title,
      sub: '',
      idx: '',
      cardUntil: boot.introMs ? Date.now() + boot.introMs : undefined,
    };
  };

  let st = load();
  const save = (): void => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(st));
    } catch {
      /* sin sessionStorage el overlay sigue funcionando en memoria */
    }
  };

  let host: HTMLDivElement | null = null;
  let root: ShadowRoot | null = null;
  let observing = false;

  const pick = <T extends HTMLElement>(sel: string): T | null =>
    (root?.querySelector(sel) as T | null) ?? null;

  let hideTimer: number | undefined;

  const render = (): void => {
    if (!root) return;

    // Tope duro del cartel. Vive acá, en el navegador, y no en el lado de Node,
    // porque durante una navegación el `evaluate` que lo bajaría se pierde: el
    // contexto de ejecución muere y la orden nunca llega. Así el cartel se baja
    // solo aunque la pantalla siguiente tarde en cargar.
    if (st.mode === 'card' && st.cardUntil) {
      const left = st.cardUntil - Date.now();
      if (left <= 0) {
        st = { ...st, mode: 'off' };
        save();
      } else if (hideTimer === undefined) {
        hideTimer = window.setTimeout(() => {
          hideTimer = undefined;
          render();
        }, left);
      }
    }

    const set = (sel: string, text: string) => {
      const el = pick(sel);
      if (el) el.textContent = text;
    };
    set('.card .kicker', st.kicker);
    set('.card .title', st.title);
    set('.card .sub', st.mode === 'card' ? st.sub : '');
    set('.card .contact', boot.contact);
    set('.card .copyright', boot.copyright);
    const logo = pick<HTMLImageElement>('.card .logo');
    if (logo && logo.src !== boot.logo) logo.src = boot.logo;
    set('.lower .txt', st.sub);
    set('.lower .idx', st.idx);
    const card = pick('.card');
    const lower = pick('.lower');
    if (card) card.dataset.on = st.mode === 'card' ? '1' : '0';
    if (lower) lower.dataset.on = st.mode === 'lower' ? '1' : '0';
  };

  const hideDevBadge = (): void => {
    if (!boot.hideNextBadge || !document.head) return;
    if (document.getElementById('__demo_hide_dev')) return;
    const style = document.createElement('style');
    style.id = '__demo_hide_dev';
    style.textContent = HIDE_DEV_BADGE;
    document.head.appendChild(style);
  };

  /** Construye y monta lo que falte. Seguro de llamar en cualquier momento. */
  const ensure = (): boolean => {
    if (!document.body) return false;
    if (!host) {
      host = document.createElement('div');
      host.setAttribute(
        'style',
        'position:fixed;inset:0;z-index:2147483647;pointer-events:none;contain:layout style;',
      );
      root = host.attachShadow({ mode: 'closed' });
      root.innerHTML = TEMPLATE;
    }
    if (!host.isConnected) document.body.appendChild(host);
    hideDevBadge();
    if (!observing && document.documentElement) {
      observing = true;
      // Seguro barato por si algún render limpia el body entero.
      new MutationObserver(() => ensure()).observe(document.documentElement, { childList: true });
    }
    render();
    return true;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensure(), { once: true });
  } else {
    ensure();
  }

  window.__demo = {
    card(kicker, title, sub = '', ttlMs) {
      if (hideTimer !== undefined) {
        window.clearTimeout(hideTimer);
        hideTimer = undefined;
      }
      st = {
        ...st,
        mode: 'card',
        kicker,
        title,
        sub,
        cardUntil: ttlMs ? Date.now() + ttlMs : undefined,
      };
      save();
      ensure();
    },
    lower(text, idx = '') {
      st = { ...st, mode: 'lower', sub: text, idx };
      save();
      ensure();
    },
    off() {
      st = { ...st, mode: 'off' };
      save();
      ensure();
    },
    cursorTo(x, y, ms = 520) {
      if (!ensure()) return;
      const cursor = pick('.cursor');
      if (!cursor) return;
      cursor.style.setProperty('--move', `${ms}ms`);
      cursor.dataset.on = '1';
      cursor.style.transform = `translate3d(${x - 3}px, ${y - 2}px, 0)`;
    },
    press() {
      if (!ensure()) return;
      const cursor = pick('.cursor');
      if (!cursor) return;
      cursor.classList.remove('press');
      void cursor.offsetWidth; // fuerza reflow para reiniciar la animación
      cursor.classList.add('press');
    },
    halo(rect) {
      if (!ensure()) return;
      const halo = pick('.halo');
      if (!halo) return;
      if (!rect) {
        halo.dataset.on = '0';
        return;
      }
      halo.style.left = `${rect.x}px`;
      halo.style.top = `${rect.y}px`;
      halo.style.width = `${rect.width}px`;
      halo.style.height = `${rect.height}px`;
      halo.dataset.on = '1';
    },
    redact(rects) {
      if (!ensure()) return;
      const redacts = pick('.redacts');
      if (!redacts) return;
      redacts.innerHTML = '';
      for (const r of rects) {
        const d = document.createElement('div');
        d.className = 'redact';
        d.style.left = `${r.x}px`;
        d.style.top = `${r.y}px`;
        d.style.width = `${r.width}px`;
        d.style.height = `${r.height}px`;
        redacts.appendChild(d);
      }
    },
  };
}
