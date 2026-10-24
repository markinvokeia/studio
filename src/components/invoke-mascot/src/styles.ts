/**
 * Estilos de la mascota. Se inyectan solos una vez en <head> (id="ivm-styles"),
 * así no hace falta configurar nada en el bundler.
 * Todas las clases usan el prefijo `ivm-` para no chocar con los estilos de la app.
 */
export const MASCOT_CSS = `
.ivm-svg{display:block;overflow:visible}
.ivm-arm,.ivm-arm-anim,.ivm-body,.ivm-face,.ivm-orbit{transform-box:view-box}
.ivm-arm-r,.ivm-arm-r .ivm-arm-anim{transform-origin:182px 124px}
.ivm-arm-l,.ivm-arm-l .ivm-arm-anim{transform-origin:58px 124px}
.ivm-arm{transition:transform .45s cubic-bezier(.34,1.56,.64,1)}
.ivm-finger{opacity:0;transition:opacity .2s}
.ivm-pointing .ivm-finger{opacity:1}
.ivm-body{transform-origin:120px 205px}
.ivm-face{transform-origin:120px 112px}
.ivm-eyes-open{transform-box:fill-box;transform-origin:center;transition:transform .07s ease-in}
.ivm-blinking .ivm-eyes-open{transform:scaleY(.1)}
.ivm-pupils{transition:transform .18s ease-out}
.ivm-brows{transition:d .3s ease}
.ivm-fill{transition:filter 1.2s ease}
.ivm-mic{transition:fill .6s}
.ivm-shadow{transform-box:fill-box;transform-origin:center}

/* reposo: flota suave */
.ivm-anim .ivm-body{animation:ivm-bob 3s ease-in-out infinite}
.ivm-anim .ivm-shadow{animation:ivm-shadow 3s ease-in-out infinite}
@keyframes ivm-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes ivm-shadow{0%,100%{transform:scaleX(1);opacity:.16}50%{transform:scaleX(.84);opacity:.09}}

/* hablando */
.ivm-mouth-talk{transform-box:fill-box;transform-origin:50% 0;animation:ivm-talk .2s ease-in-out infinite alternate}
@keyframes ivm-talk{from{transform:scaleY(.3)}to{transform:scaleY(1)}}
.ivm-mood-talking .ivm-mic{animation:ivm-mic .5s ease-in-out infinite alternate}
@keyframes ivm-mic{from{opacity:1}to{opacity:.5}}

/* pensando */
.ivm-think circle{transform-box:fill-box;transform-origin:center;animation:ivm-pop 1.5s ease-in-out infinite}
.ivm-think circle:nth-child(2){animation-delay:.2s}
.ivm-think circle:nth-child(3){animation-delay:.4s}
@keyframes ivm-pop{0%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}

/* cargando */
.ivm-orbit{transform-origin:120px 112px;animation:ivm-spin 1.2s linear infinite}
.ivm-pupils-anim{transform-box:view-box}
.ivm-mood-loading .ivm-pupils-anim{animation:ivm-roll 1.2s linear infinite}
@keyframes ivm-spin{to{transform:rotate(360deg)}}
@keyframes ivm-roll{0%,100%{transform:translate(3px,0)}25%{transform:translate(0,3px)}50%{transform:translate(-3px,0)}75%{transform:translate(0,-3px)}}

/* triste */
.ivm-tear{animation:ivm-tear 1.9s ease-in infinite}
@keyframes ivm-tear{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(22px);opacity:0}}

/* con sueño: bosteza y se estira */
.ivm-mood-sleepy .ivm-body{animation:ivm-yawn 1.8s ease-in-out}
@keyframes ivm-yawn{0%{transform:scale(1,1)}40%{transform:scale(.96,1.06)}100%{transform:scale(1,1)}}

/* durmiendo / hibernando: respira lento, se apaga el color, flotan las Z */
.ivm-mood-sleeping .ivm-body{animation:ivm-breathe 4.2s ease-in-out infinite}
.ivm-mood-sleeping .ivm-shadow{animation:none;opacity:.16}
.ivm-mood-sleeping .ivm-fill{filter:saturate(.45) brightness(.88)}
.ivm-mood-sleeping .ivm-mic,.ivm-mood-sleepy .ivm-mic{fill:#6B6478}
@keyframes ivm-breathe{0%,100%{transform:translateY(5px) scale(1,1)}50%{transform:translateY(5px) scale(1.03,.97)}}
.ivm-zzz text{transform-box:fill-box;transform-origin:center;opacity:0;animation:ivm-z 3.3s ease-out infinite}
.ivm-zzz text:nth-child(2){animation-delay:1.1s}
.ivm-zzz text:nth-child(3){animation-delay:2.2s}
@keyframes ivm-z{0%{transform:translate(0,0) scale(.5);opacity:0}20%{opacity:1}100%{transform:translate(22px,-46px) scale(1.25);opacity:0}}

/* gestos */
.ivm-gesture-wave .ivm-arm-r .ivm-arm-anim{animation:ivm-wave .42s ease-in-out infinite alternate}
@keyframes ivm-wave{from{transform:rotate(-18deg)}to{transform:rotate(16deg)}}
.ivm-gesture-celebrate .ivm-arm-anim{animation:ivm-wave .22s ease-in-out infinite alternate}
.ivm-gesture-celebrate .ivm-body{animation:ivm-jump .6s cubic-bezier(.3,.7,.4,1) infinite}
@keyframes ivm-jump{0%,100%{transform:translateY(0) scale(1.06,.94)}15%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-22px) scale(.97,1.04)}85%{transform:translateY(0) scale(1,1)}}
.ivm-sparkles{opacity:0;transition:opacity .2s}
.ivm-gesture-celebrate .ivm-sparkles{opacity:1}
.ivm-sparkles path{transform-box:fill-box;transform-origin:center;animation:ivm-twinkle .7s ease-in-out infinite alternate}
.ivm-sparkles path:nth-child(even){animation-delay:.35s}
@keyframes ivm-twinkle{from{transform:scale(.4) rotate(0)}to{transform:scale(1.1) rotate(45deg)}}
.ivm-gesture-nod .ivm-face{animation:ivm-nod .42s ease-in-out 3}
@keyframes ivm-nod{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}
.ivm-gesture-shake .ivm-face{animation:ivm-shake .36s ease-in-out 3}
@keyframes ivm-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}

/* escenario flotante */
.ivm-stage{position:fixed;left:0;top:0;width:0;height:0;pointer-events:none}
.ivm-actor{position:fixed;left:0;top:0;transform-origin:50% 100%;will-change:transform,opacity}
.ivm-hit{all:unset;display:block;cursor:pointer;border-radius:40%;pointer-events:auto;-webkit-tap-highlight-color:transparent}
.ivm-hit:focus-visible{outline:3px solid #7C3AED;outline-offset:4px}
.ivm-hidden{visibility:hidden}

/* burbuja de diálogo */
.ivm-bubble{position:absolute;bottom:calc(100% - 6px);width:max-content;max-width:240px;box-sizing:border-box;background:#7C3AED;color:#fff;font:500 14px/1.45 Poppins,'Segoe UI',system-ui,sans-serif;padding:10px 14px;border-radius:16px;box-shadow:0 10px 28px rgba(60,20,90,.25);pointer-events:auto;animation:ivm-bubble-in .3s cubic-bezier(.34,1.56,.64,1)}
.ivm-bubble-left{right:62%;border-bottom-right-radius:4px;transform-origin:100% 100%}
.ivm-bubble-right{left:62%;border-bottom-left-radius:4px;transform-origin:0 100%}
@keyframes ivm-bubble-in{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}

/* anillo sobre el elemento señalado */
.ivm-highlight{position:fixed;pointer-events:none;border-radius:14px;box-shadow:0 0 0 3px #EC4899,0 0 0 9px rgba(236,72,153,.22);animation:ivm-ring 1.1s ease-in-out infinite}
@keyframes ivm-ring{0%,100%{box-shadow:0 0 0 3px #EC4899,0 0 0 6px rgba(236,72,153,.28)}50%{box-shadow:0 0 0 3px #EC4899,0 0 0 13px rgba(236,72,153,.08)}}

/* chispas al desvanecerse / reaparecer */
.ivm-burst{position:fixed;width:0;height:0;pointer-events:none}
.ivm-burst i{position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;animation:ivm-burst .75s cubic-bezier(.2,.8,.3,1) forwards}
@keyframes ivm-burst{from{transform:translate(0,0) scale(1.2);opacity:1}to{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}

/* zona para esconderse detrás de la barra de widgets */
.ivm-peekzone{position:relative;isolation:isolate}
.ivm-peekzone-content{position:relative;z-index:1}
.ivm-peek-layer{position:absolute;left:0;right:0;z-index:0;overflow:hidden;pointer-events:none}
.ivm-peek-actor{position:absolute;pointer-events:auto}
.ivm-peek-actor-inner{transition:transform .55s cubic-bezier(.34,1.35,.64,1)}
.ivm-peek-actor-inner.ivm-fast{transition:transform .3s cubic-bezier(.5,0,.75,0)}

@media (prefers-reduced-motion: reduce){
  .ivm-svg *,.ivm-bubble,.ivm-highlight,.ivm-burst i{animation:none !important}
  .ivm-arm,.ivm-pupils,.ivm-peek-actor-inner{transition:none !important}
  .ivm-mood-sleeping .ivm-zzz text:first-child{opacity:1}
}
`;

let injected = false;

/** Inserta los estilos una sola vez. Seguro para SSR (no hace nada sin `document`). */
export function ensureMascotStyles(nonce?: string): void {
  if (injected || typeof document === 'undefined') return;
  if (document.getElementById('ivm-styles')) {
    injected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'ivm-styles';
  if (nonce) style.nonce = nonce;
  style.textContent = MASCOT_CSS;
  document.head.appendChild(style);
  injected = true;
}
