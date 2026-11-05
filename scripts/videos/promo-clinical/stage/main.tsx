/**
 * Escenario de las promos de la historia clínica (odontograma, estética, periodontograma).
 * Lo graba make-promo.mjs con capturas de Chrome; todo se calcula a partir de un único reloj (t),
 * así que cada cuadro sale igual en cada render.
 *
 * 16:9: la app en una ventana a la derecha; a la izquierda, el título de la escena y la lista de
 * funcionalidades, que se suman a medida que aparecen. 9:16: la app en un celular, el título arriba
 * y la funcionalidad de la escena abajo. Fondo oscuro con una foto, distinto en cada promo.
 *
 * window.__PROMO: { format, locale, feature, segments, available, logo, photo }
 * window.__ready → todo cargado · window.__start() → arranca · window.__done → terminó.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { FORMATS, TEXT, THEMES, featureList, scenes as buildScenes } from '../storyboard.mjs';

type Feature = 'odo' | 'aes' | 'perio';
interface Box { x: number; y: number; w: number; h: number }
interface Callout { t: number; dur?: number; kicker?: string; big?: string }
interface Scene {
  id: string; seg?: string; dur?: number; layout?: 'hook' | 'outro'; feature?: number;
  title?: { title: string; sub?: string }; callouts?: Callout[];
}
interface Segment { src: string; dur: number; w: number; h: number; boxes: Record<string, Box> }
interface Promo { format: 'landscape' | 'reel'; locale: 'es' | 'en'; feature: Feature; segments: Record<string, Segment>; available: string[]; logo: string; photo: string }

const P: Promo = (window as unknown as { __PROMO: Promo }).__PROMO;
const F = FORMATS[P.format];
const T = TEXT[P.locale];
const X = T[P.feature];
const TH = THEMES[P.feature];
const REEL = P.format === 'reel';

/** Pantalla de la app, en píxeles del video final */
const SCREEN = REEL ? { x: 170, y: 372, w: 740, h: 1402 } : { x: 610, y: 186, w: 1256, h: 707 };

const SCENES = (() => {
  let at = 0;
  return (buildScenes(P.feature, P.format, T, P.available) as Scene[]).map((s) => {
    const length = s.seg ? P.segments[s.seg].dur : s.dur ?? 3;
    const out = { ...s, start: at, length };
    at += length;
    return out;
  });
})();
type Placed = (typeof SCENES)[number];
const TOTAL = SCENES.reduce((n, s) => n + s.length, 0);
const FEATURE_NAMES: string[] = featureList(P.feature, T, P.available);
/** Cuándo aparece cada funcionalidad: al empezar su primera escena */
const FEATURE_AT = FEATURE_NAMES.map((_, i) => SCENES.find((s) => s.feature === i)?.start ?? 0);
/** Funcionalidades a la vista en la lista de 16:9 (las anteriores salen por arriba) */
const LIST_MAX = 9;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const easeOut = (p: number) => 1 - (1 - p) ** 3;
const spring = (p: number) => (p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(9 * p));

const [BG1, BG2] = TH.bg;
const A1 = TH.accent;
const A2 = TH.accent2;
const CSS = `
*{box-sizing:border-box}
html,body{margin:0;width:${F.width}px;height:${F.height}px;overflow:hidden;background:${BG1}}
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
.photo{position:fixed;inset:-3%;width:106%;height:106%;object-fit:cover;filter:saturate(.9) contrast(1.05)}
.shade{position:fixed;inset:0;background:${REEL
    ? `linear-gradient(180deg,${BG1}f2 0%,${BG2}d9 22%,${BG2}b3 50%,${BG1}e6 82%,${BG1} 100%)`
    : `linear-gradient(100deg,${BG1}fa 0%,${BG1}f0 30%,${BG2}cc 55%,${BG2}a6 100%)`}}
.vignette{position:fixed;inset:0;box-shadow:inset 0 0 ${REEL ? 260 : 320}px rgba(0,0,0,.65);pointer-events:none}
.glow{position:fixed;border-radius:50%;pointer-events:none}
.win{position:fixed;left:${SCREEN.x}px;top:${SCREEN.y}px;width:${SCREEN.w}px;height:${SCREEN.h}px;will-change:transform}
.frame{position:absolute;inset:${REEL ? '-20px' : '-40px -10px -10px -10px'};border-radius:${REEL ? 70 : 20}px;background:${REEL ? '#07060c' : '#ffffff1f'};box-shadow:0 60px 140px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.16),0 0 80px ${A1}33}
.bar{position:absolute;left:0;right:0;top:0;height:40px;display:flex;align-items:center;gap:8px;padding:0 18px}
.bar i{width:12px;height:12px;border-radius:50%;background:#f87171}.bar i:nth-child(2){background:#fbbf24}.bar i:nth-child(3){background:#34d399}
.url{margin-left:16px;width:460px;height:24px;border-radius:12px;background:rgba(255,255,255,.14);font-size:13px;font-weight:600;color:rgba(255,255,255,.75);display:flex;align-items:center;gap:8px;padding:0 14px}
.url b{width:8px;height:8px;border-radius:50%;background:#22c55e}
.notch{position:absolute;left:50%;top:-4px;width:150px;height:28px;margin-left:-75px;border-radius:0 0 16px 16px;background:#07060c;z-index:5}
.screen{position:absolute;inset:0;overflow:hidden;border-radius:${REEL ? 52 : '0 0 12px 12px'};background:#fff}
.cam{position:absolute;left:0;top:0}
.cam video{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:top}
.wipe{position:fixed;top:-20%;height:140%;width:${REEL ? 760 : 900}px;transform:skewX(-14deg);background:linear-gradient(90deg,transparent,${A2}cc 25%,${A1} 55%,${A1}cc 75%,transparent);z-index:40;pointer-events:none;mix-blend-mode:screen}
.brand{position:fixed;${REEL ? 'left:0;right:0;top:34px;justify-content:center' : 'left:80px;top:62px'};display:flex;align-items:center;gap:12px;z-index:30;font-size:${REEL ? 26 : 24}px;font-weight:800;letter-spacing:-.01em}
.brand img{width:${REEL ? 44 : 46}px;height:auto}
.brand em{font-style:normal;color:${A1}}
.side{position:fixed;left:80px;top:150px;width:480px;z-index:20}
.kicker{display:inline-flex;align-items:center;gap:12px;font-size:${REEL ? 23 : 18}px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${A1}}
.kicker i{display:block;width:34px;height:3px;border-radius:2px;background:linear-gradient(90deg,${A1},${A2})}
.title{margin:${REEL ? 12 : 14}px 0 0;font-size:${REEL ? 52 : 46}px;line-height:1.06;font-weight:800;letter-spacing:-.025em}
.title span{display:inline-block;white-space:pre}
.sub{margin:${REEL ? 12 : 14}px 0 0;font-size:${REEL ? 27 : 22}px;line-height:1.35;font-weight:500;color:rgba(255,255,255,.8)}
.list{position:fixed;left:80px;top:470px;width:480px;display:flex;flex-direction:column;gap:8px;z-index:20}
.item{display:flex;align-items:center;gap:14px;font-size:20px;font-weight:700;line-height:1.2;padding:8px 14px 8px 10px;border-radius:14px}
.item .dot{flex:none;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;font-size:14px;font-weight:800}
.item.past{color:rgba(255,255,255,.6)}
.item.past .dot{background:${A1}2e;color:${A1}}
.item.now{background:linear-gradient(90deg,${A1}38,${A1}0d);box-shadow:inset 3px 0 0 ${A1};color:#fff}
.item.now .dot{background:${A1};color:${BG1}}
.counter{position:fixed;left:80px;bottom:56px;font-size:16px;font-weight:800;letter-spacing:.14em;color:rgba(255,255,255,.55);z-index:20}
.counter b{color:${A1}}
.head{position:fixed;left:60px;right:60px;top:96px;text-align:center;z-index:20}
.chip{position:fixed;left:0;right:0;bottom:44px;display:flex;justify-content:center;z-index:30}
.chip div{display:flex;align-items:center;gap:16px;padding:14px 28px 14px 16px;border-radius:999px;background:rgba(8,6,14,.9);box-shadow:0 0 0 1px ${A1}66,0 20px 50px rgba(0,0,0,.45);font-size:29px;font-weight:800}
.chip b{display:grid;place-items:center;min-width:48px;height:48px;padding:0 10px;border-radius:24px;background:${A1};color:${BG1};font-size:22px}
.callout{position:fixed;z-index:25;padding:${REEL ? '20px 26px' : '18px 24px'};border-radius:22px;background:rgba(8,6,14,.92);box-shadow:0 0 0 1px ${A1}55,0 26px 60px rgba(0,0,0,.5)}
.callout small{display:block;font-size:${REEL ? 20 : 15}px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${A2}}
.callout strong{display:block;margin-top:4px;font-size:${REEL ? 46 : 40}px;line-height:1.05;font-weight:800;letter-spacing:-.02em}
.callout strong em{font-style:normal;color:${A1}}
.hook,.outro{position:fixed;inset:0;display:flex;flex-direction:column;justify-content:center;z-index:15;padding:0 ${REEL ? 80 : 160}px}
.hook{align-items:${REEL ? 'center' : 'flex-start'};text-align:${REEL ? 'center' : 'left'}}
.outro{align-items:center;text-align:center}
.logo{width:${REEL ? 190 : 150}px;height:auto;filter:drop-shadow(0 20px 50px ${A1}55)}
.hook h1{margin:14px 0 0;font-size:${REEL ? 96 : 104}px;line-height:1.0;font-weight:800;letter-spacing:-.04em;white-space:pre-line}
.hook h1 span{display:inline-block;white-space:pre}
.hook p{margin:${REEL ? 30 : 26}px 0 0;max-width:900px;font-size:${REEL ? 34 : 30}px;line-height:1.3;font-weight:600;color:rgba(255,255,255,.82)}
.tag{display:inline-flex;align-items:center;gap:10px;margin-top:${REEL ? 30 : 28}px;padding:10px 20px;border-radius:999px;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2);font-size:${REEL ? 23 : 19}px;font-weight:800;letter-spacing:.04em}
.tag b{width:10px;height:10px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 6px rgba(239,68,68,.25)}
.outro h2{margin:${REEL ? 40 : 30}px 0 0;font-size:${REEL ? 74 : 70}px;line-height:1.05;font-weight:800;letter-spacing:-.03em}
.outro .pills{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:${REEL ? 34 : 30}px}
.outro .pills span{padding:12px 22px;border-radius:999px;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2);font-size:${REEL ? 26 : 22}px;font-weight:800}
.outro .pills span.on{background:${A1};color:${BG1};box-shadow:none}
.outro .site{margin-top:${REEL ? 44 : 36}px;font-size:${REEL ? 32 : 27}px;font-weight:800;letter-spacing:.03em;color:${A1}}
`;

/** Aparición: sube y se enfoca */
function rise(t: number, at: number, dist = 40): React.CSSProperties {
  const p = clamp01((t - at) / 0.55);
  return { opacity: clamp01(p * 2), transform: `translateY(${(1 - spring(p)) * dist}px)`, filter: `blur(${(1 - easeOut(p)) * 8}px)` };
}
const words = (text: string, t: number, at: number, step = 0.06) =>
  text.split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) ? w : <span key={i} style={rise(t, at + Math.floor(i / 2) * step)}>{w}</span>));

function Screen({ scene, t, videos }: { scene: Placed; t: number; videos: React.MutableRefObject<Record<string, HTMLVideoElement | null>> }) {
  return (
    <div className="screen">
      {Object.entries(P.segments).map(([id, seg]) => {
        const on = scene.seg === id;
        const k = SCREEN.w / seg.w;
        // Leve acercamiento continuo, sin zoom a detalles: da movimiento sin perder lo que se ve
        const drift = on ? 1 + 0.02 * ease(clamp01((t - scene.start) / Math.max(2, scene.length))) : 1;
        return (
          <div key={id} className="cam" style={{ width: SCREEN.w, height: seg.h * k, opacity: on ? 1 : 0, transform: `scale(${drift})`, transformOrigin: '50% 30%' }}>
            <video ref={(v) => { videos.current[id] = v; }} src={seg.src} muted playsInline preload="auto" />
          </div>
        );
      })}
    </div>
  );
}

function Callouts({ items, t }: { items: Callout[]; t: number }) {
  return (
    <>
      {items.map((c, i) => {
        const p = clamp01((t - c.t) / 0.5);
        const out = clamp01((t - (c.t + (c.dur ?? 3))) / 0.35);
        if (p <= 0 || out >= 1) return null;
        const e = spring(p);
        const pos: React.CSSProperties = REEL ? { right: 60, top: SCREEN.y + 60 } : { right: 90, bottom: 120 };
        return (
          <div key={i} className="callout" style={{ ...pos, opacity: (1 - out) * clamp01(p * 1.6), transform: `translateY(${(1 - e) * 36}px) scale(${0.92 + 0.08 * e})` }}>
            {c.kicker && <small>{c.kicker}</small>}
            {c.big && <strong dangerouslySetInnerHTML={{ __html: c.big }} />}
          </div>
        );
      })}
    </>
  );
}

function Stage() {
  const [t, setT] = React.useState(0);
  const videos = React.useRef<Record<string, HTMLVideoElement | null>>({});
  const current = React.useRef<string | null>(null);

  React.useEffect(() => {
    let raf = 0;
    let t0 = 0;
    const tick = () => {
      const now = (performance.now() - t0) / 1000;
      setT(now);
      if (now > TOTAL + 0.2) { (window as unknown as { __done: boolean }).__done = true; return; }
      raf = requestAnimationFrame(tick);
    };
    (window as unknown as { __start: () => void }).__start = () => { t0 = performance.now(); raf = requestAnimationFrame(tick); };
    return () => cancelAnimationFrame(raf);
  }, []);

  const scene = SCENES.find((s) => t >= s.start && t < s.start + s.length) ?? SCENES[SCENES.length - 1];
  // Video del tramo: quedó parado en su primer cuadro al cargar; arranca al entrar en la escena
  React.useEffect(() => {
    if (!scene.seg || current.current === scene.id) return;
    current.current = scene.id;
    const v = videos.current[scene.seg];
    if (v) void v.play();
  }, [scene]);

  const local = t - scene.start;
  const firstSeg = SCENES.find((s) => s.seg)!;
  const outroScene = SCENES.find((s) => s.layout === 'outro')!;
  const lastSegScene = [...SCENES].reverse().find((s) => s.seg && s.start <= t) ?? firstSeg;
  const enter = clamp01((t - firstSeg.start + 0.4) / 0.9);
  const leave = clamp01((t - outroScene.start + 0.2) / 0.7);
  const inApp = t > firstSeg.start - 0.4 && t < outroScene.start + 0.5;
  const winStyle: React.CSSProperties = {
    opacity: inApp ? easeOut(enter) * (1 - leave) : 0,
    transform: `translate${REEL ? 'Y' : 'X'}(${(1 - easeOut(enter)) * 140 + leave * 80}px) scale(${0.95 + 0.05 * easeOut(enter) - leave * 0.05})`,
  };

  // Cortina entre escenas
  const boundary = SCENES.find((s) => s.start > 0 && Math.abs(t - s.start) < 0.42);
  const wipeP = boundary ? clamp01((t - boundary.start + 0.42) / 0.84) : -1;
  const wipeX = wipeP >= 0 ? -1100 + ease(wipeP) * (F.width + 2200) : -9999;

  const title = scene.title;
  const idx = SCENES.indexOf(scene);
  let headStart = scene.start;
  for (let i = idx; i > 0 && SCENES[i - 1].title?.title === title?.title; i--) headStart = SCENES[i - 1].start;
  const headAt = t - headStart;
  const nowFeature = scene.feature ?? -1;
  const shown = FEATURE_AT.filter((at) => at <= t + 0.01).length;

  // Fondo: la foto se mueve despacio y se ve más en el gancho y el cierre
  const kb = 1.04 + 0.05 * (t / Math.max(1, TOTAL));
  const photoOpacity = scene.layout ? 0.85 : 0.5;

  return (
    <>
      <style>{CSS}</style>
      <img className="photo" src={P.photo} alt="" style={{ transform: 'scale(1.06)', opacity: photoOpacity, transition: 'opacity .8s' }} />
      <div className="shade" />
      <div className="glow" style={{ width: 900, height: 900, left: REEL ? -300 : 900, top: REEL ? 1100 : -300, background: `radial-gradient(circle,${A1}33,${A1}00 65%)` }} />
      <div className="glow" style={{ width: 800, height: 800, left: REEL ? 500 : -260, top: REEL ? -200 : 640, background: `radial-gradient(circle,${A2}26,${A2}00 65%)` }} />
      <div className="vignette" />

      <div className="brand" style={{ opacity: scene.layout === 'outro' ? 0 : 1 }}><img src={P.logo} alt="" /><span>Invoke <em>IA</em></span></div>

      {scene.layout === 'hook' && (
        <div className="hook">
          <img className="logo" src={P.logo} alt="" style={{ opacity: clamp01(local / 0.3), transform: `scale(${0.6 + 0.4 * spring(clamp01(local / 0.7))}) rotate(${(1 - easeOut(clamp01(local / 0.8))) * -30}deg)` }} />
          <div className="kicker" style={{ ...rise(local, 0.25), marginTop: REEL ? 40 : 34 }}><i />{X.name}</div>
          <h1>{words(X.hook.title, local, 0.4)}</h1>
          <p style={rise(local, 1.0)}>{X.hook.sub}</p>
          <div className="tag" style={rise(local, 1.3)}><b />{T.real}</div>
        </div>
      )}

      <div className="win" style={winStyle}>
        <div className="frame">{REEL ? <div className="notch" /> : <div className="bar"><i /><i /><i /><div className="url"><b />app.invokeia.com/{P.locale}/patients</div></div>}</div>
        <Screen scene={scene.seg ? scene : lastSegScene} t={scene.seg ? t : lastSegScene.start + lastSegScene.length - 0.01} videos={videos} />
      </div>

      {scene.seg && title && !REEL && (
        <>
          <div className="side" key={title.title}>
            <div className="kicker" style={rise(headAt, 0)}><i />{X.name}</div>
            <h2 className="title">{words(title.title, headAt, 0.05, 0.05)}</h2>
            {title.sub && <p className="sub" style={rise(headAt, 0.3, 24)}>{title.sub}</p>}
          </div>
          <div className="list">
            {FEATURE_NAMES.map((name, i) => {
              if (FEATURE_AT[i] > t + 0.01 || i < Math.max(0, shown - LIST_MAX)) return null;
              const p = clamp01((t - FEATURE_AT[i]) / 0.5);
              return (
                <div key={name} className={`item ${i === nowFeature ? 'now' : 'past'}`} style={{ opacity: clamp01(p * 2), transform: `translateX(${(1 - spring(p)) * -40}px)` }}>
                  <span className="dot">{i === nowFeature ? i + 1 : '✓'}</span>{name}
                </div>
              );
            })}
          </div>
          <div className="counter"><b>{String(Math.min(shown, FEATURE_NAMES.length)).padStart(2, '0')}</b> / {String(FEATURE_NAMES.length).padStart(2, '0')}</div>
        </>
      )}

      {scene.seg && title && REEL && (
        <>
          <div className="head" key={title.title}>
            <div className="kicker" style={rise(headAt, 0)}><i />{X.name}</div>
            <h2 className="title">{words(title.title, headAt, 0.05, 0.05)}</h2>
            {title.sub && <p className="sub" style={rise(headAt, 0.3, 24)}>{title.sub}</p>}
          </div>
          {nowFeature >= 0 && (
            <div className="chip" key={`chip-${nowFeature}`}>
              <div style={rise(headAt, 0.15, 30)}><b>{String(nowFeature + 1).padStart(2, '0')}</b>{FEATURE_NAMES[nowFeature]}</div>
            </div>
          )}
        </>
      )}

      {scene.seg && scene.callouts && <Callouts items={scene.callouts} t={local} />}

      {scene.layout === 'outro' && (
        <div className="outro">
          <img className="logo" src={P.logo} alt="" style={{ opacity: clamp01(local / 0.3), transform: `scale(${0.7 + 0.3 * spring(clamp01(local / 0.7))})` }} />
          <h2>{words(X.outro, local, 0.3)}</h2>
          <div className="pills" style={rise(local, 0.9)}>{(T.pills as string[]).map((p, i) => <span key={p} className={i === { odo: 1, aes: 2, perio: 3 }[P.feature] ? 'on' : ''}>{p}</span>)}</div>
          <div className="site" style={rise(local, 1.2)}>www.invokeia.com</div>
        </div>
      )}

      <div className="wipe" style={{ left: wipeX }} />
    </>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Stage />);

// Listo cuando cargaron fuentes, imágenes y el primer cuadro de cada tramo
void (async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
  const vids = [...document.querySelectorAll('video')];
  await Promise.all(vids.map((v) => (v.readyState >= 3 ? null : new Promise((r) => { v.oncanplaythrough = r; v.onerror = r; setTimeout(r, 20000); }))));
  // Cada tramo decodificado y parado en su primer cuadro, listo para arrancar sin parpadeo
  for (const v of vids) {
    await v.play().catch(() => {});
    v.pause();
    await new Promise((r) => { v.onseeked = r; v.currentTime = 0; setTimeout(r, 3000); });
  }
  (window as unknown as { __ready: boolean }).__ready = true;
})();
