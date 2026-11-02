/**
 * Escenario de la promo: la mascota real (src/components/invoke-mascot) presenta el
 * asistente sobre los clips que corta make-promo.mjs. Lo graba make-promo.mjs.
 *
 * window.__PROMO: { format, locale, poster, segments, logo, bg, stills }
 * window.__ready → todo cargado · window.__start() → arranca · window.__done → terminó.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { InvokeMascot, MascotProvider, useMascot } from '../../../../src/components/invoke-mascot/src';
import type { MascotGesture, MascotMood } from '../../../../src/components/invoke-mascot/src/types';
import { FORMATS, TEXT, scenes as buildScenes } from '../storyboard.mjs';

interface Box { x: number; y: number; w: number; h: number }
interface Segment { src: string; dur: number; w: number; h: number; reveal?: { start: number; end: number }; hl?: { t: number; box: Box } }
interface Scene { id: string; seg?: string; dur?: number; layout?: 'hook' | 'intro' | 'outro'; title: { title: string; sub: string }; overlay?: 'dictation' | 'error'; act?: (string | number)[][]; say?: (string | number)[][] }
interface Promo { format: 'landscape' | 'reel'; locale: 'es' | 'en'; poster?: boolean; segments: Record<string, Segment>; logo: string; bg: string; stills?: string[] }

const P: Promo = (window as unknown as { __PROMO: Promo }).__PROMO;
const F = FORMATS[P.format];
const T = TEXT[P.locale];
const REEL = P.format === 'reel';

/** Pantalla (16:9: ventana de navegador · 9:16: celular), puntos de la mascota y tamaños. */
const L = REEL
  ? { screen: { x: 280, y: 350, w: 520, h: 1125 }, pts: { home: { x: 190, y: 1735 }, right: { x: 890, y: 1735 }, end: { x: 540, y: 1560 }, left: { x: 190, y: 1735 }, low: { x: 190, y: 1735 } }, mascot: 220, bubble: 32 }
  : { screen: { x: 300, y: 214, w: 1320, h: 742 }, pts: { home: { x: 1765, y: 845 }, low: { x: 165, y: 845 }, left: { x: 330, y: 640 }, end: { x: 960, y: 905 }, right: { x: 1765, y: 845 } }, mascot: 200, bubble: 26 };

const SCENES = (() => {
  let at = 0;
  return (buildScenes(P.format, T) as Scene[]).map((s) => {
    const length = s.seg ? P.segments[s.seg].dur : (s.dur ?? 3);
    const out = { ...s, start: at, length };
    at += length;
    return out;
  });
})();
type PlacedScene = (typeof SCENES)[number];
/** Número de tema de cada escena con video (las que comparten título son el mismo tema). */
const CHAPTER: Record<string, number> = {};
const CHAPTERS = (() => {
  const titles: string[] = [];
  for (const s of SCENES) {
    if (!s.seg) continue;
    if (!titles.includes(s.title.title)) titles.push(s.title.title);
    CHAPTER[s.id] = titles.indexOf(s.title.title) + 1;
  }
  return titles.length;
})();
const TOTAL = SCENES.reduce((n, s) => n + s.length, 0);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (p: number) => p * p * (3 - 2 * p);

const INK = '#1f1638';
const CSS = `
*{box-sizing:border-box}
html,body{margin:0;width:${F.width}px;height:${F.height}px;overflow:hidden;background:#eef0f4}
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:${INK}}
.bgimg{position:fixed;inset:-2%;width:104%;height:104%;object-fit:cover;animation:kb 40s ease-in-out infinite alternate;will-change:transform}
@keyframes kb{from{transform:scale(1) translate(0,0)}to{transform:scale(1.07) translate(-1.2%,-1%)}}
.aurora{position:fixed;inset:0;pointer-events:none}
.aurora i{position:absolute;border-radius:50%;opacity:.5;animation:drift 18s ease-in-out infinite;will-change:transform}
.aurora i:nth-child(1){width:900px;height:900px;background:radial-gradient(circle,rgba(167,139,250,.55) 0%,rgba(167,139,250,0) 65%);left:-260px;top:${REEL ? 460 : 240}px}
.aurora i:nth-child(2){width:820px;height:820px;background:radial-gradient(circle,rgba(249,168,212,.55) 0%,rgba(249,168,212,0) 65%);right:-240px;top:-220px;animation-delay:-6s}
.aurora i:nth-child(3){width:760px;height:760px;background:radial-gradient(circle,rgba(125,211,252,.5) 0%,rgba(125,211,252,0) 65%);left:38%;bottom:-320px;animation-delay:-11s}
@keyframes drift{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(90px,-60px) scale(1.12)}66%{transform:translate(-60px,50px) scale(.94)}}
.sparks{position:fixed;inset:0;pointer-events:none}
.sparks b{position:absolute;width:10px;height:10px;border-radius:50%;background:#c4b5fd;opacity:0;animation:spark 7s linear infinite}
@keyframes spark{0%{opacity:0;transform:translateY(0) scale(.6)}15%{opacity:.7}100%{opacity:0;transform:translateY(-260px) scale(1.2)}}
.top{position:fixed;left:0;right:0;top:${REEL ? 104 : 14}px;text-align:center;padding:0 ${REEL ? 60 : 300}px}
.top h1{margin:0;font-size:${REEL ? 54 : 44}px;line-height:1.08;font-weight:800;letter-spacing:-.02em;animation:up .5s cubic-bezier(.2,.9,.3,1.2) both}
.top p{margin:${REEL ? 12 : 6}px 0 0;font-size:${REEL ? 28 : 23}px;font-weight:600;color:#5b4f75;animation:up .5s .1s cubic-bezier(.2,.9,.3,1.2) both}
@keyframes up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.grad{background:linear-gradient(90deg,#5b21b6,#c026d3 55%,#2563eb);-webkit-background-clip:text;background-clip:text;color:transparent}
/* pantalla */
.device{position:fixed;left:${L.screen.x}px;top:${L.screen.y}px;width:${L.screen.w}px;height:${L.screen.h}px}
.browser{position:absolute;left:-10px;right:-10px;top:-46px;bottom:-10px;border-radius:22px;background:#fff;box-shadow:0 40px 90px rgba(31,22,56,.25),0 0 0 1px rgba(31,22,56,.08)}
.browser .bar{position:absolute;left:0;right:0;top:0;height:46px;display:flex;align-items:center;gap:9px;padding:0 18px}
.browser .bar i{width:13px;height:13px;border-radius:50%;background:#f87171}.browser .bar i:nth-child(2){background:#fbbf24}.browser .bar i:nth-child(3){background:#34d399}
.browser .url{margin-left:18px;flex:1;max-width:560px;height:28px;border-radius:14px;background:#f1f2f6;font-size:15px;font-weight:600;color:#6b6385;display:flex;align-items:center;padding:0 16px}
.phone{position:absolute;left:-20px;right:-20px;top:-20px;bottom:-20px;border-radius:72px;background:#15121f;box-shadow:0 40px 90px rgba(31,22,56,.32),inset 0 0 0 3px #2e2940}
.screen{position:absolute;inset:0;overflow:hidden;${REEL ? 'border-radius:54px;' : 'border-radius:0 0 14px 14px;'}background:#fff}
.clip{position:absolute;inset:0;opacity:0}
.clip.on{opacity:1;z-index:2;animation:cutin .55s cubic-bezier(.2,.9,.3,1) both}
.clip.prev{opacity:1;z-index:1;animation:cutout .45s ease-in forwards}
@keyframes cutin{from{opacity:0;transform:translateX(70px) scale(.97)}to{opacity:1;transform:none}}
@keyframes cutout{from{opacity:1;transform:none}to{opacity:0;transform:translateX(-70px) scale(.97)}}
/* contador de temas */
.chap{display:inline-flex;align-items:center;gap:10px;margin-bottom:${REEL ? 14 : 10}px;padding:${REEL ? '8px 18px' : '6px 16px'};border-radius:999px;background:#fff;color:#6d28d9;font-size:${REEL ? 24 : 20}px;font-weight:800;letter-spacing:.04em;box-shadow:0 6px 18px rgba(109,40,217,.15);animation:pop .45s cubic-bezier(.2,.9,.3,1.4) both}
.chap i{display:block;width:${REEL ? 30 : 26}px;height:6px;border-radius:3px;background:linear-gradient(90deg,#7c3aed,#ec4899)}
.clip video{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:top}
.err .screen{box-shadow:inset 0 0 0 6px #f43f5e;animation:shake .45s ease 2}
@keyframes shake{0%,100%{translate:0}25%{translate:-9px}75%{translate:9px}}
/* resaltado */
.hl{position:absolute;border-radius:16px;box-shadow:0 0 0 4px #7c3aed,0 0 0 12px rgba(124,58,237,.25),0 0 40px rgba(124,58,237,.55);animation:hl 1.1s ease-in-out infinite;pointer-events:none}
.hl::after{content:'';position:absolute;inset:-18px;border-radius:24px;border:3px solid rgba(236,72,153,.7);animation:ripple 1.1s ease-out infinite}
@keyframes hl{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes ripple{from{opacity:1;transform:scale(.8)}to{opacity:0;transform:scale(1.35)}}
/* dictado */
.dict{position:absolute;left:${REEL ? 20 : 40}px;right:${REEL ? 20 : 520}px;${REEL ? 'top:330px' : 'top:250px'};display:flex;align-items:center;gap:18px;padding:${REEL ? '20px 22px' : '20px 28px'};border-radius:${REEL ? 30 : 999}px;background:rgba(255,255,255,.97);box-shadow:0 20px 60px rgba(31,22,56,.3),0 0 0 2px rgba(124,58,237,.45);animation:up .35s both}
.mic{flex:none;width:${REEL ? 70 : 72}px;height:${REEL ? 70 : 72}px;border-radius:50%;background:linear-gradient(135deg,#ec4899,#7c3aed);display:grid;place-items:center;position:relative}
.mic::after{content:'';position:absolute;inset:-9px;border-radius:50%;border:3px solid rgba(236,72,153,.6);animation:ripple 1s ease-out infinite}
.mic.ok{background:#10b981}.mic.ok::after{display:none}
.wave{display:flex;align-items:center;gap:5px;height:40px;flex:none}
.wave i{display:block;width:6px;border-radius:3px;background:#c026d3;animation:bar .6s ease-in-out infinite}
@keyframes bar{0%,100%{height:8px}50%{height:38px}}
.said{font-size:${REEL ? 27 : 30}px;font-weight:700;line-height:1.25;min-width:0;color:${INK}}
.said small{display:block;font-size:17px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#c026d3;margin-bottom:3px}
.caret{display:inline-block;width:3px;height:1em;background:#c026d3;vertical-align:-3px;margin-left:3px;animation:blink .8s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
/* marca */
.powered{position:fixed;left:0;right:0;${REEL ? 'top:34px' : 'bottom:30px'};display:flex;justify-content:center;align-items:center;gap:14px;font-size:${REEL ? 26 : 22}px;font-weight:700;color:#3b2f57;pointer-events:none;z-index:60}
.powered img{width:${REEL ? 40 : 34}px;height:auto}
.powered span{color:#6d28d9;font-weight:800}
.site{position:fixed;left:0;right:0;bottom:${REEL ? 34 : 30}px;text-align:center;font-size:${REEL ? 30 : 22}px;font-weight:800;letter-spacing:.02em;color:#5b21b6;pointer-events:none;z-index:60}
/* gancho */
.hook{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 ${REEL ? 70 : 220}px;background:rgba(246,247,250,.92)}
.hook h1{margin:0;font-size:${REEL ? 92 : 90}px;line-height:1.08;font-weight:800;letter-spacing:-.025em;color:${INK}}
.hook h1 span{display:inline-block;opacity:0;animation:word .5s cubic-bezier(.2,.9,.3,1.3) forwards}
.hook p{margin:${REEL ? 40 : 30}px 0 0;font-size:${REEL ? 46 : 42}px;font-weight:800;opacity:0;animation:up .6s forwards}
.badge{display:inline-flex;align-items:center;gap:14px;margin-bottom:${REEL ? 44 : 36}px;font-size:${REEL ? 28 : 24}px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#be123c;padding:12px 24px;border-radius:999px;background:#fff;box-shadow:0 8px 24px rgba(190,18,60,.15);animation:up .4s both}
.badge i{width:16px;height:16px;border-radius:50%;background:#f43f5e;animation:blink 1s steps(1) infinite}
@keyframes word{from{opacity:0;transform:translateY(30px) scale(.9);filter:blur(8px)}to{opacity:1;transform:none;filter:none}}
body.hidemascot .ivm-actor{opacity:0!important}
/* intro */
.introcap{position:fixed;${REEL ? 'left:70px;right:70px;top:150px;text-align:center' : 'left:120px;top:290px;width:900px'}}
.introcap h1{margin:0;font-size:${REEL ? 82 : 76}px;line-height:1.02;font-weight:800;letter-spacing:-.03em;animation:up .6s .2s both}
.introcap p{margin:${REEL ? 22 : 26}px 0 0;font-size:${REEL ? 36 : 34}px;font-weight:600;color:#5b4f75;animation:up .6s .35s both}
.pillar{position:fixed;border-radius:38px;background:linear-gradient(180deg,#ffffff,#f4f1ff);box-shadow:0 30px 80px rgba(31,22,56,.22),inset 0 0 0 1px rgba(124,58,237,.12);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:46px;gap:16px;z-index:3}
.pillar img{width:120px}
.pillar b{font-size:30px;font-weight:800;letter-spacing:-.01em}
.pillar u{display:block;width:60%;height:10px;border-radius:5px;background:linear-gradient(90deg,#7c3aed,#ec4899,#38bdf8)}
.bigm{position:fixed;z-index:2;will-change:transform}
.ibubble{position:fixed;z-index:4;background:#7C3AED;color:#fff;font-weight:700;font-size:${REEL ? 36 : 32}px;line-height:1.3;padding:${REEL ? '18px 26px' : '16px 24px'};border-radius:26px;box-shadow:0 16px 40px rgba(60,20,90,.3);animation:pop .35s cubic-bezier(.2,.9,.3,1.4) both;white-space:nowrap}
@keyframes pop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
.burst{position:fixed;z-index:5;width:20px;height:20px;pointer-events:none}
.burst i{position:absolute;left:0;top:0;width:18px;height:18px;border-radius:50%;animation:fly .7s ease-out forwards}
@keyframes fly{from{transform:translate(0,0) scale(1);opacity:1}to{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
/* cierre */
.support{position:fixed;left:0;right:0;margin:0 auto;top:${REEL ? 760 : 470}px;width:${REEL ? 900 : 820}px;display:flex;gap:22px;align-items:flex-start;padding:28px 32px;border-radius:30px;background:#fff;color:${INK};box-shadow:0 30px 80px rgba(31,22,56,.22);animation:up .6s both}
.support .av{flex:none;width:${REEL ? 92 : 80}px;height:${REEL ? 92 : 80}px;border-radius:50%;background:linear-gradient(135deg,#38bdf8,#7C3AED);display:grid;place-items:center}
.support b{display:block;font-size:${REEL ? 30 : 25}px;color:#6d28d9}
.support span{display:block;font-size:${REEL ? 36 : 32}px;font-weight:700;line-height:1.3;margin-top:6px}
.end{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${REEL ? 30 : 24}px;background:rgba(246,247,250,.94);animation:fade .5s both;padding-bottom:${REEL ? 260 : 180}px}
.end img{width:${REEL ? 290 : 220}px;filter:drop-shadow(0 20px 40px rgba(31,22,56,.25));animation:pop .7s cubic-bezier(.2,.9,.3,1.3) both}
.end h2{margin:0;padding:0 ${REEL ? 60 : 160}px;text-align:center;font-size:${REEL ? 92 : 84}px;line-height:1.05;font-weight:800;letter-spacing:-.025em}
.end p{margin:0;font-size:${REEL ? 38 : 32}px;font-weight:600;color:#5b4f75}
@keyframes fade{from{opacity:0}to{opacity:1}}
.ivm-bubble{font-size:${L.bubble}px!important;line-height:1.35!important;max-width:${REEL ? 600 : 460}px!important;padding:${REEL ? '18px 24px' : '15px 21px'}!important;border-radius:${REEL ? 28 : 22}px!important;font-family:'Plus Jakarta Sans',system-ui,sans-serif!important;font-weight:700!important;box-shadow:0 16px 40px rgba(60,20,90,.3)!important}
/* miniatura */
.poster{position:fixed;inset:0}
.poster .kick{font-size:${REEL ? 52 : 44}px;font-weight:800;color:#c026d3;margin:0}
.poster h1{margin:6px 0 0;font-size:${REEL ? 110 : 100}px;line-height:1;font-weight:800;letter-spacing:-.03em}
.poster .sub{margin-top:22px;font-size:${REEL ? 34 : 29}px;font-weight:700;color:#4c4366}
.poster .shot{position:absolute;border-radius:26px;overflow:hidden;background:#fff;box-shadow:0 30px 80px rgba(31,22,56,.28),0 0 0 6px #fff}
.poster .shot img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
.poster .logo{position:absolute;width:${REEL ? 120 : 96}px}
`;

function Backdrop() {
  const sparks = React.useMemo(() => Array.from({ length: 14 }, (_, i) => ({ left: `${(i * 73) % 100}%`, top: `${30 + ((i * 41) % 65)}%`, delay: `${-((i * 0.53) % 7)}s` })), []);
  return (
    <>
      <img className="bgimg" src={P.bg} alt="" />
      <div className="aurora"><i /><i /><i /></div>
      <div className="sparks">{sparks.map((s, i) => <b key={i} style={{ left: s.left, top: s.top, animationDelay: s.delay }} />)}</div>
    </>
  );
}

function Brand() {
  return (
    <>
      <div className="powered"><img src={P.logo} alt="" />{T.powered}{!REEL && <span>· {T.site}</span>}</div>
      {REEL && <div className="site">{T.site}</div>}
    </>
  );
}

function Hook({ scene }: { scene: PlacedScene }) {
  const words = scene.title.title.split(' ');
  const per = REEL ? 0.1 : 0.13;
  return (
    <div className="hook">
      <div className="badge"><i />{T.hookBadge}</div>
      <h1>{words.map((w, i) => <React.Fragment key={i}><span style={{ animationDelay: `${0.15 + i * per}s` }}>{w}</span>{' '}</React.Fragment>)}</h1>
      <p className="grad" style={{ animationDelay: `${0.3 + words.length * per}s` }}>{scene.title.sub}</p>
    </div>
  );
}

/**
 * Intro: la mascota grande se esconde detrás de una columna, se asoma, sale, saluda,
 * salta y saluda, piensa (cargando), se ríe y desaparece. Fotogramas clave por tiempo.
 */
type Key = { t: number; x: number; y: number; rot?: number; s?: number; mood?: MascotMood; gesture?: MascotGesture; say?: string | null };
function introKeys(): { keys: Key[]; pillar: Box; size: number } {
  const [ask, hi, think, go] = T.introSay as string[];
  if (REEL) {
    const pillar = { x: 560, y: 1000, w: 420, h: 720 };
    const hide = pillar.x + pillar.w / 2, peek = pillar.x - 50, out = 330, y = 1480;
    return {
      pillar, size: 360,
      keys: [
        { t: 0, x: hide, y, mood: 'neutral', say: null },
        { t: 0.3, x: peek, y, rot: -14, mood: 'surprised', say: ask },
        { t: 0.75, x: peek, y, rot: -14 },
        { t: 1.05, x: out, y, rot: 0, mood: 'happy', gesture: 'wave', say: hi },
        { t: 1.5, x: out, y: y - 190, gesture: 'wave' },
        { t: 1.8, x: out, y },
        { t: 2.0, x: out, y, mood: 'loading', gesture: 'none', say: think },
        { t: 2.5, x: out, y, mood: 'happy', gesture: 'celebrate', say: go },
        { t: 2.85, x: out, y, s: 1 },
        { t: 3.15, x: out, y, s: 0 },
      ],
    };
  }
  const pillar = { x: 1300, y: 250, w: 400, h: 760 };
  const hide = pillar.x + pillar.w / 2, peek = pillar.x - 40, out = 1010, y = 760;
  return {
    pillar, size: 360,
    keys: [
      { t: 0, x: hide, y, mood: 'neutral', say: null },
      { t: 0.9, x: hide, y },
      { t: 1.3, x: peek, y, rot: -14, mood: 'surprised', say: ask },
      { t: 1.9, x: peek, y, rot: -14 },
      { t: 2.2, x: hide, y, rot: 0, say: null },
      { t: 2.6, x: hide, y },
      { t: 3.0, x: out, y, rot: 0, mood: 'happy', gesture: 'wave', say: hi },
      { t: 3.6, x: out, y },
      { t: 3.9, x: out, y: y - 210, gesture: 'wave' },
      { t: 4.25, x: out, y, gesture: 'wave' },
      { t: 4.7, x: out, y, mood: 'loading', gesture: 'none', say: think },
      { t: 6.0, x: out, y, mood: 'happy', gesture: 'celebrate', say: go },
      { t: 7.0, x: out, y, s: 1 },
      { t: 7.45, x: out, y, s: 0 },
    ],
  };
}
const INTRO = introKeys();

function Intro({ local }: { local: number }) {
  const { keys, pillar, size } = INTRO;
  let i = keys.findIndex((k) => k.t > local) - 1;
  if (i < 0) i = local < keys[0].t ? 0 : keys.length - 1;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const p = b.t > a.t ? smooth(clamp01((local - a.t) / (b.t - a.t))) : 1;
  const mix = (u: number, v: number) => u + (v - u) * p;
  // Estado "pegajoso": el último ánimo/gesto/globo definido hasta ahora.
  const last = <K extends keyof Key>(k: K): Key[K] | undefined => { for (let j = i; j >= 0; j--) if (keys[j][k] !== undefined) return keys[j][k]; return undefined; };
  const x = mix(a.x, b.x), y = mix(a.y, b.y);
  const rot = mix(a.rot ?? 0, b.rot ?? a.rot ?? 0), s = mix(a.s ?? 1, b.s ?? a.s ?? 1);
  const say = last('say');
  const vanishAt = keys[keys.length - 2].t;
  return (
    <>
      <div className="introcap"><h1 className="grad">{T.intro.title}</h1><p>{T.intro.sub}</p></div>
      <div className="pillar" style={{ left: pillar.x, top: pillar.y, width: pillar.w, height: pillar.h }}>
        <img src={P.logo} alt="" /><b>Invoke IA</b><u />
      </div>
      {s > 0.02 && (
        <div className="bigm" style={{ left: x - size / 2, top: y - size / 2, transform: `rotate(${rot}deg) scale(${s})` }}>
          <InvokeMascot size={size} mood={last('mood') ?? 'neutral'} gesture={last('gesture') ?? 'none'} />
        </div>
      )}
      {say && s > 0.5 && <div className="ibubble" key={say} style={{ left: x - size / 2 - 20, top: y - size / 2 - 100 }}>{say}</div>}
      {local >= vanishAt && local < vanishAt + 0.8 && <Burst x={x} y={y} />}
    </>
  );
}

function Burst({ x, y }: { x: number; y: number }) {
  const colors = ['#7c3aed', '#ec4899', '#38bdf8', '#a3e635', '#f59e0b'];
  return (
    <div className="burst" style={{ left: x, top: y }}>
      {Array.from({ length: 16 }, (_, i) => {
        const ang = (i / 16) * Math.PI * 2;
        return <i key={i} style={{ background: colors[i % colors.length], ['--dx' as string]: `${Math.cos(ang) * 210}px`, ['--dy' as string]: `${Math.sin(ang) * 210}px` }} />;
      })}
    </div>
  );
}

function Dictation({ local, reveal }: { local: number; reveal: { start: number; end: number } }) {
  const q: string = T.question;
  const p = clamp01((local - reveal.start) / Math.max(0.1, reveal.end - reveal.start));
  const shown = q.slice(0, Math.round(q.length * p));
  const done = p >= 1;
  return (
    <div className="dict">
      <div className={`mic${done ? ' ok' : ''}`}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          {done ? <path d="M5 12l5 5L20 7" /> : <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" /></>}
        </svg>
      </div>
      {!done && <div className="wave">{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ animationDelay: `${-i * 0.1}s` }} />)}</div>}
      <div className="said"><small>{done ? T.transcribed : T.dictating}</small>{shown}{!done && <span className="caret" />}</div>
    </div>
  );
}

function Clip({ scene, active, shown, prev, local, onPlaying }: { scene: PlacedScene; active: boolean; shown: boolean; prev: boolean; local: number; onPlaying: (id: string) => void }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const seg = P.segments[scene.seg!];
  React.useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      v.currentTime = 0;
      // Se muestra recién cuando el video está corriendo: hasta entonces sigue el anterior.
      const ready = () => onPlaying(scene.id);
      v.addEventListener('playing', ready, { once: true });
      void v.play();
      return () => v.removeEventListener('playing', ready);
    }
    v.pause();
    return undefined;
  }, [active, onPlaying, scene.id]);
  // Resaltado: en la posición que guardó la grabación, escalada a la pantalla.
  const k = L.screen.w / seg.w;
  const hl = seg.hl;
  const hlOn = active && hl && local >= hl.t && local < hl.t + 1.5;
  return (
    <div className={`clip${shown ? ' on' : prev ? ' prev' : ''}`}>
      <video ref={ref} src={seg.src} muted playsInline preload="auto" />
      {hlOn && hl && <div className="hl" style={{ left: hl.box.x * k - 8, top: hl.box.y * k - 8, width: hl.box.w * k + 16, height: hl.box.h * k + 16 }} />}
      {active && scene.overlay === 'dictation' && seg.reveal && <Dictation local={local} reveal={seg.reveal} />}
    </div>
  );
}

function Device({ scene, local }: { scene: PlacedScene; local: number }) {
  const err = scene.overlay === 'error' && local > 0.4;
  // El clip anterior queda debajo (congelado) mientras entra el nuevo: corte limpio, sin blanco.
  const [{ shownId, prevId }, setShown] = React.useState<{ shownId: string | null; prevId: string | null }>({ shownId: null, prevId: null });
  const onPlaying = React.useCallback((id: string) => setShown((cur) => (cur.shownId === id ? cur : { shownId: id, prevId: cur.shownId })), []);
  return (
    <div className={`device${err ? ' err' : ''}`}>
      {REEL ? <div className="phone" /> : <div className="browser"><div className="bar"><i /><i /><i /><div className="url">app.invokeia.com</div></div></div>}
      <div className="screen">
        {SCENES.filter((s) => s.seg).map((s) => <Clip key={s.id} scene={s} active={s === scene} shown={s.id === shownId} prev={s.id === prevId} local={s === scene ? local : 0} onPlaying={onPlaying} />)}
      </div>
    </div>
  );
}

function Outro({ local, length }: { local: number; length: number }) {
  const endAt = length - (REEL ? 1.5 : 3.2);
  return (
    <>
      {local > (REEL ? 0.2 : 1.2) && local < endAt && (
        <div className="support">
          <div className="av">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2z" /><path d="M18 17v1a3 3 0 0 1-3 3h-3" /></svg>
          </div>
          <div><b>{T.support.who}</b><span>{T.support.msg}</span></div>
        </div>
      )}
      {local >= endAt && (
        <div className="end">
          <img src={P.logo} alt="" />
          <h2 className="grad">{T.end.brand}</h2>
          <p>{T.end.tag}</p>
        </div>
      )}
    </>
  );
}

function Director() {
  const m = useMascot();
  const [now, setNow] = React.useState(-1);
  const started = React.useRef(false);

  React.useEffect(() => {
    const w = window as unknown as { __start?: () => void; __ready?: boolean; __done?: boolean };
    const videos = [...document.querySelectorAll('video')];
    Promise.all(videos.map((v) => (v.readyState >= 4 ? null : new Promise((r) => v.addEventListener('canplaythrough', r, { once: true })))))
      .then(() => document.fonts.ready)
      .then(() => Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; })))))
      .then(() => { w.__ready = true; });
    w.__start = () => {
      if (started.current) return;
      started.current = true;
      const t0 = performance.now();
      const tick = () => {
        const s = (performance.now() - t0) / 1000;
        setNow(s);
        if (s < TOTAL + 0.4) requestAnimationFrame(tick);
        else w.__done = true;
      };
      requestAnimationFrame(tick);
      // La mascota encola sus acciones (cada una espera a la anterior): para que no se
      // atrasen, cada una termina antes de la siguiente (globos y gestos más cortos,
      // viajes más rápidos).
      type Ev = { t: number; kind: string; args: (string | number)[] };
      const evs: Ev[] = [];
      for (const scene of SCENES) {
        for (const [at, act, ...args] of scene.act ?? []) evs.push({ t: scene.start + (at as number), kind: act as string, args });
        for (const [at, ...args] of scene.say ?? []) evs.push({ t: scene.start + (at as number), kind: 'say', args });
      }
      evs.sort((a, b) => a.t - b.t);
      const queued = (e: Ev) => e.kind !== 'mood';
      let pos = { x: F.width - 60 - L.mascot / 2, y: F.height - 60 - L.mascot / 2 };
      evs.forEach((e, i) => {
        const next = evs.slice(i + 1).find(queued);
        const room = next ? Math.max(0.3, next.t - e.t - 0.08) : 9;
        setTimeout(() => {
          if (e.kind === 'travel') {
            const to = L.pts[e.args[0] as keyof typeof L.pts];
            const dist = Math.hypot(to.x - pos.x, to.y - pos.y);
            const anim = e.args[1] as 'hop' | 'jump' | 'teleport';
            const est = (anim === 'teleport' ? 1150 : anim === 'jump' ? 1140 + Math.min(500, dist * 0.4) : 240 + Math.max(2, Math.min(10, Math.round(dist / 110))) * 360) / 1000;
            pos = to;
            void m.travelTo(to, { animation: anim, speed: Math.min(4, Math.max(1, est / room)) });
          } else if (e.kind === 'mood') void m.setMood(e.args[0] as MascotMood);
          else if (e.kind === 'gesture') void m.gesture(e.args[0] as Exclude<MascotGesture, 'point'>, Math.min(1400, room * 1000));
          else if (e.kind === 'say') {
            const [text, mood, gesture, dur] = e.args;
            void m.say(text as string, { mood: mood as MascotMood, gesture: gesture === 'none' ? undefined : (gesture as MascotGesture), duration: Math.min(dur as number, room) * 1000 });
          }
        }, e.t * 1000);
      });
    };
  }, [m]);

  const found = SCENES.findIndex((s) => now >= s.start && now < s.start + s.length);
  const scene = now < 0 ? SCENES[0] : SCENES[found === -1 ? SCENES.length - 1 : found];
  const local = Math.max(0, now - scene.start);
  const full = scene.layout === 'hook' || scene.layout === 'intro';
  const endCard = scene.layout === 'outro' && local >= scene.length - (REEL ? 1.5 : 3.2);
  // La mascota real no se ve en el gancho ni en el intro (ahí está la grande).
  React.useEffect(() => { document.body.classList.toggle('hidemascot', full); }, [full]);
  return (
    <>
      <Backdrop />
      {!full && !endCard && (
        <div className="top" key={scene.title.title}>
          {CHAPTER[scene.id] && <div className="chap"><i />{CHAPTER[scene.id]} / {CHAPTERS}</div>}
          <h1 className={scene.layout === 'outro' ? 'grad' : undefined}>{scene.title.title}</h1>
          <p>{scene.title.sub}</p>
        </div>
      )}
      <div style={{ visibility: full || scene.layout === 'outro' ? 'hidden' : 'visible' }}><Device scene={scene} local={local} /></div>
      {scene.layout === 'intro' && now >= 0 && <Intro local={local} />}
      {scene.layout === 'outro' && <Outro local={local} length={scene.length} />}
      {scene.layout === 'hook' && <Hook scene={scene} />}
      <Brand />
    </>
  );
}

/** Miniatura: la mascota grande, el titular y dos capturas reales. */
function Poster() {
  const shots = P.stills ?? [];
  const pos = REEL
    ? [{ left: 40, top: 860, width: 380, height: 700, rot: -6 }, { left: 350, top: 800, width: 380, height: 700, rot: 1 }, { left: 660, top: 860, width: 380, height: 700, rot: 6 }]
    : [{ left: 860, top: 120, width: 560, height: 470, rot: -3 }, { left: 1330, top: 150, width: 520, height: 470, rot: 4 }, { left: 1060, top: 560, width: 640, height: 400, rot: -2 }];
  return (
    <div className="poster">
      <Backdrop />
      {shots.map((s, i) => (
        <div key={s} className="shot" style={{ left: pos[i].left, top: pos[i].top, width: pos[i].width, height: pos[i].height, transform: `rotate(${pos[i].rot}deg)` }}>
          <img src={s} alt="" />
        </div>
      ))}
      <img className="logo" src={P.logo} alt="" style={REEL ? { left: 80, top: 100 } : { left: 80, top: 70 }} />
      <div style={{ position: 'absolute', left: 80, top: REEL ? 270 : 210, width: REEL ? 920 : 800 }}>
        <div className="badge" style={{ animation: 'none' }}><i />{T.hookBadge}</div>
        <p className="kick">{T.poster.kicker}</p>
        <h1 className="grad">{T.poster.title}</h1>
        <div className="sub">{T.poster.sub}</div>
      </div>
      <div style={{ position: 'absolute', left: REEL ? 300 : 300, top: REEL ? 1360 : 560 }}>
        <InvokeMascot size={REEL ? 500 : 460} mood="happy" gesture="wave" animated={false} />
      </div>
      <Brand />
    </div>
  );
}

function App() {
  if (P.poster) return <Poster />;
  return (
    <MascotProvider size={L.mascot} dock="bottom-right" margin={60} storageKey={null} idleAfterMs={1e9} sleepAfterMs={1e9} interactive={false} defaultTravel="hop" zIndex={50}>
      <Director />
    </MascotProvider>
  );
}

const style = document.createElement('style');
style.textContent = CSS;
document.head.appendChild(style);
createRoot(document.getElementById('root')!).render(<App />);
