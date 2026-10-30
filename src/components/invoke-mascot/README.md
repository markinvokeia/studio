# @invokeia/mascot — Mascota animada de Invoke IA

Asistente virtual animado para la app web de Invoke, versión **D · Recepción**: la flor de 5 pétalos del logo con cara, auriculares con micrófono, guantes, zapatillas y un diente en la panza.

- Hecho en SVG + CSS + Web Animations API. **Sin dependencias** aparte de React (17 o superior).
- TypeScript estricto. Compatible con Next.js (los archivos traen `'use client'`).
- Los estilos se inyectan solos (clases con prefijo `ivm-`), así que no hace falta configurar nada.
- Respeta `prefers-reduced-motion`: si el usuario pidió menos movimiento, los viajes se vuelven un fundido y no hay animaciones en bucle.

## Qué sabe hacer

| Comportamiento | Cómo se dispara |
|---|---|
| **Estados de ánimo**: normal, feliz, pensando, sorpresa, triste, hablando, cargando, con sueño y durmiendo | `m.setMood('thinking')` |
| **Gestos**: saludar, festejar, asentir, negar | `m.gesture('wave')` |
| **Hablar** con burbuja de diálogo (y boca animada) | `m.say('¡Hola!')` |
| **Señalar** un elemento: gira el brazo hacia él, **lo mira con los ojos** y le dibuja un anillo | `m.pointAt('#nuevo-turno', { say: '…' })` |
| **Ojos que siguen el cursor** (y vuelven al frente si el cursor se queda quieto) | automático |
| **Parpadeo** natural (intervalos aleatorios, a veces doble) | automático |
| **Viajar por la pantalla**: `teleport` (salta, se desvanece y reaparece en otro lado), `hop` (saltitos), `jump` (salto grande en arco) | `m.travelTo('bottom-left', { animation: 'teleport' })` |
| **Cruzar la pantalla al cambiar de página** | `useMascotRouteTravel(pathname)` |
| **Esconderse detrás de la barra de widgets y asomarse** cuando está en reposo: mira a un lado y al otro, a veces saluda, y reaparece en otro lugar de la barra | automático tras `idleAfterMs` (45 s), o `m.hide()` |
| **Dormirse / hibernar**: bosteza, cierra los ojos, se apaga el color, respira lento y le salen "Z" | automático tras `sleepAfterMs` (3 h) sin pedidos, al desactivarla, o `m.sleep()` |
| **Despertarse**: se sobresalta y festeja | clic sobre ella, cualquier acción, o `m.wake()` |

## Uso mínimo

```tsx
import { MascotProvider, MascotPeekZone, useMascot, useMascotRouteTravel } from '@/components/invoke-mascot';

export function AppRoot() {
  return (
    <MascotProvider size={96} dock="bottom-right" insets={{ bottom: 64 }}>
      <Layout />
    </MascotProvider>
  );
}

function Layout() {
  const { pathname } = useLocation();      // React Router  (Next.js: usePathname())
  useMascotRouteTravel(pathname);          // cruza la pantalla al cambiar de página

  return (
    <>
      <Sidebar />
      <main>{/* … */}</main>
      {/* La mascota se esconde DETRÁS de esta barra y se asoma cuando está en reposo */}
      <MascotPeekZone edge="top" className="widget-bar-wrapper">
        <WidgetBar />
      </MascotPeekZone>
    </>
  );
}

function NuevoTurnoHelp() {
  const m = useMascot();
  return <button onClick={() => m.pointAt('#nuevo-turno', { say: 'Desde acá agendás un turno.' })}>¿Ayuda?</button>;
}
```

## API

### `<MascotProvider>`

Montalo una sola vez, cerca de la raíz. Renderiza la mascota flotante (en un portal sobre `document.body`) y da acceso al control con `useMascot()`.

| Prop | Tipo | Por defecto | Para qué |
|---|---|---|---|
| `size` | `number` | `96` | Tamaño en px |
| `dock` | `DockPosition` | `'bottom-right'` | Lugar de anclaje: `bottom-right`, `bottom-left`, `top-right`, `top-left`, `center-right`, `center-left` |
| `margin` | `number` | `20` | Distancia a los bordes |
| `insets` | `{top,right,bottom,left}` | — | Espacio a respetar (header, barra inferior fija…) |
| `idleAfterMs` | `number` | `45000` | Sin interacción → se esconde detrás de la barra. `0` = nunca |
| `sleepAfterMs` | `number` | `10800000` (3 h) | Sin pedidos → se duerme. `0` = nunca |
| `enabled` | `boolean` | `true` | `false` = durmiendo y sin reaccionar |
| `defaultTravel` | `'auto' \| 'hop' \| 'jump' \| 'teleport'` | `'auto'` | Animación por defecto de `travelTo` |
| `storageKey` | `string \| null` | `'invoke-mascot:last-request'` | Guarda la hora del último pedido en localStorage, así se duerme aunque recarguen la página |
| `zIndex` | `number` | `1000` | z-index de la capa flotante |
| `hidden` | `boolean` | `false` | No mostrarla (ej. en el login) |
| `onMascotClick` | `(m) => void` | despierta / sale / saluda | Qué hacer al hacer clic sobre ella (ej. abrir el chat del asistente) |
| `label` | `string` | `'Asistente de Invoke'` | Texto accesible |
| `styleNonce` | `string` | — | nonce si la app usa Content-Security-Policy estricta |

### `useMascot()` → `MascotController`

Estado de solo lectura: `phase` (`active` · `traveling` · `peeking` · `sleeping`), `mood`, `currentGesture`, `message`, `enabled`.

Acciones (todas devuelven `Promise` y se ejecutan **en cola**, una tras otra, así se pueden encadenar con `await`):

| Método | Descripción |
|---|---|
| `setMood(mood)` | Cambia el ánimo (inmediato, sin cola). |
| `gesture(g, ms?)` | `'wave' \| 'celebrate' \| 'nod' \| 'shake'`. |
| `say(text, { mood?, duration?, gesture? })` | Burbuja + boca animada. La duración se calcula según el largo del texto. |
| `pointAt(target, { say?, duration?, highlight?, travel? })` | Señala y mira el objetivo. `travel: true \| 'hop' \| …` para ir primero junto al elemento. |
| `lookAt(target \| 'cursor')` | Mira un punto o elemento; `'cursor'` vuelve a seguir el puntero. |
| `travelTo(target, { animation?, speed? })` | Viaja. `target`: posición de anclaje, selector CSS, elemento o `{x, y}` (centro, en px del viewport). |
| `hide()` / `show()` | Se esconde detrás de la barra / sale de su escondite. |
| `sleep()` / `wake()` | Hibernar / despertar. |
| `setEnabled(bool)` | Activar/desactivar (desactivada = duerme). |
| `notifyRequest()` | Avisa que el usuario le pidió algo al asistente (reinicia los temporizadores de reposo y sueño). `say`, `pointAt` y `gesture` ya lo hacen solos. |

Si está **dormida o escondida** y se llama a una acción, primero se despierta o sale y después la hace. Si está **desactivada**, las acciones se ignoran.

### `<MascotPeekZone edge="top" | "bottom">`

Envuelve la barra de widgets. Cuando la mascota está en reposo se mete detrás y se asoma.

- `edge="top"` (por defecto): asoma la cabeza **por arriba** de la barra (barra abajo o en medio de la página).
- `edge="bottom"`: asoma **por debajo**, cabeza abajo (para una barra arriba, tipo header).
- **Requisitos**: la barra debe tener **fondo opaco**, y ningún contenedor padre debe recortar con `overflow: hidden` el espacio por donde asoma (alto = tamaño de la mascota).
- Podés darle `className`/`style` (por ejemplo `position: fixed; bottom: 0`): ese posicionamiento se respeta.
- Si la barra se desmonta (otra página), la mascota vuelve sola a su lugar.

### `useMascotRouteTravel(routeKey, options?)`

Al cambiar `routeKey`, la mascota cruza al otro lado de la pantalla.

| Opción | Por defecto | |
|---|---|---|
| `animation` | `'teleport'` | o `'hop'`, `'jump'`, `'auto'`, `'cycle'` (va rotando) |
| `sides` | `['bottom-right','bottom-left']` | lados entre los que alterna |
| `positions` | — | `{ '/agenda': 'bottom-left', '/pacientes': '#buscador' }` para fijar un lugar por ruta |
| `say` | — | frase al llegar: objeto por ruta o función |
| `wakeOnNavigate` | `false` | si está escondida o dormida, ¿sale igual? |

### `<InvokeMascot>`

El dibujo solo, sin comportamiento (útil para un ícono, un empty state o una pantalla de bienvenida):

```tsx
<InvokeMascot size={160} mood="happy" gesture="wave" />
```

Props: `size`, `mood`, `gesture`, `pointAngle` (grados), `look` (`{x,y}` de −1 a 1), `autoBlink`, `animated`, `title`.

## Desarrollo

```bash
npm install
npm run typecheck   # TypeScript estricto
npm run demo        # genera dist-demo/index.html (demo autocontenida)
```

## Estructura

```
src/
  InvokeMascot.tsx        dibujo SVG, ánimos, gestos, parpadeo, mirada, brazo que señala
  MascotProvider.tsx      escenario flotante, cola de acciones, viajes, temporizadores, burbuja
  MascotPeekZone.tsx      escondite detrás de la barra de widgets y bucle de "asomarse"
  useMascotRouteTravel.ts cruzar la pantalla al cambiar de página
  useLookVector.ts        hacia dónde mirar (cursor o punto)
  travel.ts               keyframes de los viajes (saltitos, salto, teletransporte)
  styles.ts               CSS inyectado (prefijo ivm-)
  types.ts                tipos públicos
demo/                     app simulada para probar todo
```

## Cambios hechos al integrarla en Invoke Studio

Para incorporar en la próxima versión del paquete:

1. `PointAtOptions.signal` (`types.ts`, `MascotProvider.tsx`): el señalamiento se corta al
   abortar la señal y libera la cola; con `duration: Infinity` señala hasta que se aborte.
   Lo usan las guías paso a paso, que señalan mientras el paso espera a la persona.
2. `MascotPeekZone edge="left" | "right"` (`MascotPeekZone.tsx`): escondite detrás de una
   barra **vertical** (el riel de widgets de Invoke está a la derecha, de alto completo).
   Asoma de costado con la cabeza hacia afuera; la mirada se pasa al marco rotado.
3. `index.ts` en la raíz de la carpeta re-exporta `./src` (`@/components/invoke-mascot`).
4. `pointAt(…, { say, duration: Infinity, signal })`: habla el tiempo de lectura y después
   sigue señalando con ánimo `happy` (el globo queda visible hasta que se aborta).
5. **Globo que entra completo** (`MascotProvider.tsx`, `styles.ts`): se mide y va arriba del lado
   de siempre; si no entra (cerca del tope), a un costado; si no, abajo. No tapa el elemento que
   señala ni lo que indique `bubbleAvoid` (selector).
6. **Lugar elegido arrastrando** (`home`, `draggable`, `onHomeChange`; tipos `MascotHome`,
   `MascotAnchor`): en reposo se arrastra; el lado donde la sueltan (franjas izquierda/derecha
   del 25 %, si no arriba/abajo) define detrás de qué zona se esconde (`hideZones`, por nombre:
   `right`, `left`, `content`) y se asoma justo donde la dejaron. `travelTo('home')` vuelve a ese
   lugar (sin uno, al `dock`).
7. `MascotPeekZone`: `name`, `edge="auto"` (`bottom` si el lugar está abajo, si no `top`), y sólo
   sirve de escondite si es visible. Sin `isolation` ni `z-index`: la capa se pinta debajo del
   contenido por orden del DOM, así envolver el panel de la página no encierra sus z-index.
8. `useMascotRouteTravel(…, { disabled })`: no cruza de lado (con un lugar elegido).
9. `interactive={false}`: la mascota y su globo dejan pasar clics, clic derecho y arrastres
   (mientras guía se para sobre el elemento que señala).
10. `canTalk={false}` (`MascotProvider`): nunca pone la cara de hablar (`talking` → `happy`);
    el globo se sigue mostrando. Invoke lo apaga cuando la voz está silenciada.
11. `pointAt(…, { talkUntil })`: con `say`, mueve la boca hasta que la promesa se resuelve
    (la voz que lee el globo terminó) en vez del tiempo de lectura calculado.

El ESLint del proyecto apaga `react-hooks/refs` y `react-hooks/purity` sólo para esta
carpeta (el dibujo usa refs y `Date.now()` en render a propósito).
