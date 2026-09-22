/**
 * La API con la que se escriben los specs de demo.
 *
 * Regla de estilo, opuesta a la de `e2e/tests/**`: acá NO se programa a la
 * defensiva. Los specs de QA hacen `if (!visible) return;` para tolerar estados
 * de backend variables, pero en una suite de video eso produce metraje vacío sin
 * fallar. Si el elemento no está, el video no sirve: que falle.
 */
import { test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { T, pause } from './timing';
import { kickerFor, type Question } from './registry';
import type { DemoRect } from './overlay';

export class Demo {
  private idx = 0;
  private finished = false;

  /** La pregunta principal. Un video puede cubrir dos de la misma subsección. */
  readonly q: Question;

  constructor(
    private readonly page: Page,
    readonly questions: Question[],
    private readonly info: TestInfo,
  ) {
    this.q = questions[0];
  }

  /**
   * Llama al overlay. Durante una navegación el contexto de ejecución muere y
   * `evaluate` rechaza; no es un error real porque el init script vuelve a
   * pintar el estado desde sessionStorage en el documento nuevo.
   */
  private ui<A>(fn: (arg: A) => void, arg: A): Promise<void> {
    // `evaluate` tipa el argumento como `Unboxed<A>`, que TS no puede reconciliar
    // con un genérico abierto. El cast es seguro: sólo pasamos datos planos.
    const evaluate = this.page.evaluate.bind(this.page) as (
      fn: (arg: A) => void,
      arg: A,
    ) => Promise<void>;
    return evaluate(fn, arg).catch(() => undefined);
  }

  private async boxOf(target: Locator, what: string): Promise<DemoRect> {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) {
      throw new Error(`[${this.q.id}] No hay boundingBox para ${what}. El elemento no es visible.`);
    }
    return box;
  }

  private async point(box: DemoRect, x: number, y: number): Promise<void> {
    await this.ui(
      (a: { box: DemoRect; x: number; y: number; ms: number }) => {
        window.__demo?.halo(a.box);
        window.__demo?.cursorTo(a.x, a.y, a.ms);
      },
      { box, x, y, ms: T.cursorMove },
    );
  }

  private clearHalo(): Promise<void> {
    return this.ui(() => window.__demo?.halo(null), null);
  }

  // ── apertura y cierre ─────────────────────────────────────────────────────

  /**
   * Cartel de título y navegación inicial. Primera línea de todo spec.
   *
   * La navegación ocurre CON el cartel puesto, y después sólo se espera lo que
   * falte para llegar a `T.introCard`. Así el cartel nunca supera 1,5 s aunque
   * la pantalla tarde en cargar.
   */
  async intro(
    path: string,
    sub = '',
    opts: { ready?: () => Promise<unknown> } = {},
  ): Promise<void> {
    const startedAt = Date.now();
    // Cuando el video responde dos preguntas, la segunda ocupa el subtítulo del
    // cartel: es más informativo que la pista de navegación.
    const second = this.questions[1];
    await this.ui(
      (a: { kicker: string; title: string; sub: string; ttl: number }) =>
        window.__demo?.card(a.kicker, a.title, a.sub, a.ttl),
      {
        kicker: kickerFor(this.q),
        title: this.q.title,
        sub: second ? second.title : sub,
        // Tope duro, aplicado por el propio overlay en el navegador.
        ttl: T.introCard,
      },
    );
    const navigation = this.page.goto(path, { waitUntil: 'domcontentloaded' });

    // El cartel se baja a los `T.introCard` SIEMPRE, se haya terminado de cargar
    // la pantalla o no. Antes se esperaba a que estuviera lista y recién ahí se
    // descontaba el tiempo, con lo cual una pantalla lenta dejaba el cartel
    // nueve segundos puesto. Ahora es un techo, no un piso.
    await pause(T.introCard - (Date.now() - startedAt));
    await this.ui(() => window.__demo?.off(), null);

    // La espera real ocurre con el cartel ya bajado: se ve la pantalla cargando,
    // que es lo que vería cualquiera.
    await navigation;
    await this.dismissBlockingModals();
    // `ready` para pantallas donde `networkidle` miente (el calendario encadena
    // tres tandas de peticiones y la red se aquieta antes de que monte).
    if (opts.ready) await opts.ready();
    else await this.settle();
    await pause(T.beat);
  }

  /** Cartel de cierre, 1,5 s. Lo llama el fixture aunque el spec se olvide. */
  async finish(sub = ''): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    const footer = sub || (this.q.permissions.length ? `Permiso: ${this.q.permissions[0]}` : '');
    const second = this.questions[1];
    await this.ui(
      (a: { kicker: string; title: string; sub: string }) => window.__demo?.card(a.kicker, a.title, a.sub),
      {
        kicker: this.questions.map((q) => q.id.toUpperCase()).join(' · '),
        title: this.q.title,
        sub: second ? second.title : footer,
      },
    );
    await pause(T.outroCard);
  }

  // ── narración ─────────────────────────────────────────────────────────────

  /** Subtítulo suelto, sin acción asociada. */
  async note(text: string): Promise<void> {
    await this.caption(text);
    await pause(T.read(text) + T.dwell);
  }

  /** Agrupa varias acciones bajo un mismo subtítulo y un paso del reporte. */
  async step(caption: string, fn: () => Promise<void>): Promise<void> {
    await test.step(`${this.idx + 1}. ${caption}`, async () => {
      await this.caption(caption);
      await pause(T.read(caption) + T.dwell);
      await fn();
    });
  }

  private caption(text: string): Promise<void> {
    this.idx += 1;
    return this.ui(
      (a: { t: string; i: string }) => window.__demo?.lower(a.t, a.i),
      { t: text, i: String(this.idx) },
    );
  }

  // ── acciones guiadas ──────────────────────────────────────────────────────

  /**
   * Ritmo de un paso guiado, pensado para que se siga sin correr:
   *
   *   [preparación invisible]  →  aparece el texto  →  (beat)  →  el cursor
   *   viaja y el área se resalta  →  se termina de leer  →  3 s de reposo  →
   *   clic  →  se ve el resultado
   *
   * La preparación (esperar la red, medir la posición del elemento) va ANTES de
   * mostrar el texto: si fuera después, quedaría un hueco muerto de duración
   * impredecible entre el subtítulo y el resaltado.
   */
  private async guide(
    target: Locator,
    caption: string | undefined,
    aim: (box: DemoRect) => { x: number; y: number },
    opts: { dwell?: number } = {},
  ): Promise<DemoRect> {
    await this.settle();
    const box = await this.boxOf(target, caption ?? 'el elemento');

    if (caption) await this.caption(caption);
    await pause(T.beat);

    const { x, y } = aim(box);
    await this.point(box, x, y);

    const readTime = caption ? T.read(caption) : 0;
    // El cursor viaja mientras se lee, así que sólo se descuenta lo ya transcurrido.
    await pause(Math.max(T.cursorMove, readTime - T.beat));
    await pause(opts.dwell ?? T.dwell);

    return box;
  }

  /** Clic con cursor animado y resaltado. */
  async click(target: Locator, caption?: string, opts: { dwell?: number } = {}): Promise<void> {
    await this.guide(target, caption, (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 }), opts);
    await this.ui(() => window.__demo?.press(), null);
    await target.click();
    await pause(T.afterAction);
    await this.clearHalo();
  }

  /** Escribe tecla por tecla: `fill()` hace aparecer el texto de golpe y arruina la demo. */
  async type(target: Locator, value: string, caption?: string): Promise<void> {
    // Menos reposo antes de escribir: el tecleo ya es movimiento y se ve solo.
    await this.guide(target, caption, (b) => ({ x: b.x + 18, y: b.y + b.height / 2 }), {
      dwell: Math.round(T.dwell / 3),
    });
    await this.ui(() => window.__demo?.press(), null);
    await target.click();
    await target.pressSequentially(value, { delay: T.keystroke });
    await pause(T.afterAction);
    await this.clearHalo();
  }

  /** Resalta algo para que el espectador lo mire, sin interactuar. */
  async spotlight(target: Locator, caption: string, opts: { dwell?: number } = {}): Promise<void> {
    await this.guide(target, caption, (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 }), opts);
    await this.clearHalo();
  }

  /**
   * Espera el toast, lo congela y lo resalta. Radix pausa su temporizador de
   * auto-cierre mientras el puntero está encima, así que mover el mouse real
   * sobre él nos da tiempo de que se lea.
   */
  async toast(caption = 'El sistema confirma la operación'): Promise<void> {
    const toast = this.page
      .getByRole('status')
      .or(this.page.locator('[data-radix-toast-root]'))
      .first();
    await toast.waitFor({ state: 'visible', timeout: 10_000 });

    const box = await toast.boundingBox();
    if (box) {
      await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await this.point(box, box.x + box.width / 2, box.y + box.height / 2);
    }
    await this.caption(caption);
    await pause(T.toastHold);
    await this.clearHalo();
    await this.page.mouse.move(10, 10);
  }

  // ── utilidades ────────────────────────────────────────────────────────────

  /** Tapa con desenfoque zonas con datos sensibles por el resto del video. */
  async redact(...targets: Locator[]): Promise<void> {
    const boxes = (await Promise.all(targets.map((t) => t.boundingBox()))).filter(
      (b): b is DemoRect => b !== null,
    );
    await this.ui((a: DemoRect[]) => window.__demo?.redact(a), boxes);
  }

  /**
   * Cierra lo que la app pueda haber abierto por su cuenta y que taparía la demo.
   *
   * El caso real es el modal de selección de sede: si la cuenta con la que se
   * graba no tiene sede de trabajo, sale un `AlertDialog` a pantalla completa
   * que **no se cierra con Escape** (está prevenido a propósito) y que deja
   * todos los clics bloqueados por su backdrop. El setup ya elige una sede, pero
   * reaparece, así que cada demo tiene que saber resolverlo.
   *
   * Corre con el cartel de título todavía puesto, así que no se ve en el video.
   */
  private async dismissBlockingModals(): Promise<void> {
    const sedeModal = this.page
      .getByRole('alertdialog')
      .filter({ hasText: 'Selecciona una sede' });

    if (await sedeModal.isVisible({ timeout: 2_500 }).catch(() => false)) {
      await sedeModal.getByRole('button').first().click().catch(() => undefined);
      await sedeModal.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
    }

    await this.closeNotificationsPanel();
  }

  /**
   * Cierra el panel de notificaciones si quedó abierto.
   *
   * El panel en sí queda fuera de pantalla (`x = 1280` con un viewport de 1280),
   * pero **su backdrop no**: es un `fixed inset-0 bg-black/30 backdrop-blur-[1px]`
   * que oscurece y desenfoca todo el contenido. En el video se nota mucho.
   *
   * No se puede cerrar con su propio botón —está fuera del viewport, el clic
   * nunca llega— ni con Escape. Lo que sí funciona es pulsar el backdrop.
   */
  private async closeNotificationsPanel(): Promise<void> {
    // Sólo actuar si el backdrop está realmente pintado: existe en el DOM con
    // `transition-opacity` y a opacidad 0 no molesta a nadie.
    const dimmed = await this.page
      .evaluate(() => {
        const el = [...document.querySelectorAll('div')].find(
          (d) => d.className.includes('z-[9980]') && d.getBoundingClientRect().width > 600,
        );
        return el ? Number(getComputedStyle(el).opacity) > 0.05 : false;
      })
      .catch(() => false);
    if (!dimmed) return;

    // Se cierra con el propio botón del panel derecho. Pulsar el backdrop no
    // sirve: un clic a ciegas puede caer sobre la barra lateral y navegar a otra
    // pantalla en medio de la demo.
    const toggle = this.page.getByRole('button', { name: /abrir notificaciones/i }).first();
    if (await toggle.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await toggle.click().catch(() => undefined);
      await pause(T.beat);
    }
  }

  /** Estabiliza la pantalla antes de medir una posición o resaltar algo. */
  async settle(timeout = T.settle): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
    await this.page
      .locator('[data-loading="true"], .animate-spin')
      .first()
      .waitFor({ state: 'hidden', timeout: 3_000 })
      .catch(() => undefined);
  }

  /** Nombre plausible para datos que van a salir en cámara. */
  demoName(base: string): string {
    const stamp = String(this.info.workerIndex) + String(Date.now()).slice(-4);
    return `${base} · demo ${stamp}`;
  }
}
