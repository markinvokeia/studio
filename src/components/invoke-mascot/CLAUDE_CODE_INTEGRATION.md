# Integrar la mascota de Invoke — instrucciones para Claude Code

> Para quien pega este archivo en Claude Code: copiá la carpeta `invoke-mascot/` dentro del repositorio de la app y pedile:
> **"Integrá la mascota siguiendo `invoke-mascot/CLAUDE_CODE_INTEGRATION.md`."**

---

## Contexto para Claude Code

Esta carpeta es una librería React autocontenida (TypeScript, sin dependencias aparte de `react` y `react-dom`) con la mascota animada que hace de asistente virtual en la app web de **Invoke IA** (gestión de clínicas). La API completa está en `README.md`. No modifiques el dibujo ni las animaciones de `src/` salvo que te lo pidan: tu trabajo es **conectarla** a la app.

Antes de tocar nada, inspeccioná el repositorio y averiguá (no supongas):

1. Framework y router: React + React Router, Next.js (app router o pages), Vite, etc.
2. El componente raíz o layout donde se montan los providers globales.
3. El componente de la **barra de widgets** de la aplicación (la mascota se esconde detrás de ella).
4. Dónde vive el **chat o asistente de IA** (envío de mensajes del usuario, respuesta del agente, errores, estado de "pensando"). Invoke usa agentes en n8n detrás de un webchat: buscá el hook o servicio que llama a ese endpoint.
5. Si hay una pantalla de **configuración o preferencias del usuario** donde agregar "Mostrar asistente animado".
6. Alias de imports (`@/…`), z-index de los modales, header fijo, barras fijas, y si hay Content-Security-Policy con nonce.

Si algo no existe o es ambiguo, dejalo anotado en tu resumen final en vez de inventarlo.

## Pasos

### 1. Ubicar la librería

- Mové `invoke-mascot/src/` a la carpeta de componentes compartidos (por ejemplo `src/components/invoke-mascot/`), o dejalo como paquete del workspace si el repo es un monorepo. Lo que mejor encaje con la estructura existente.
- No hace falta instalar nada: solo `react` y `react-dom` (17 o superior).
- Si el proyecto usa Next.js, los archivos ya tienen `'use client'`.
- Verificá que compile con el `tsconfig` del proyecto (es TypeScript estricto y no debería dar errores).

### 2. Montar el provider (una sola vez)

En el layout raíz autenticado (no en el login), envolvé la app:

```tsx
<MascotProvider
  size={96}
  dock="bottom-right"
  insets={{ bottom: /* alto de la barra de widgets si está fija abajo */ 64, top: /* alto del header fijo */ 0 }}
  idleAfterMs={45_000}             // se esconde detrás de la barra tras 45 s sin interacción
  sleepAfterMs={3 * 60 * 60 * 1000} // se duerme tras 3 h sin pedidos
  enabled={userPrefs.showMascot ?? true}
  onMascotClick={(m) => { m.notifyRequest(); openAssistantChat(); }}
>
  {children}
</MascotProvider>
```

- `zIndex` (1000 por defecto): tiene que quedar **por encima** del contenido y **por debajo** de los modales y diálogos de la app. Ajustalo según los z-index que encuentres.
- `onMascotClick`: si la app tiene un chat del asistente, abrilo al hacer clic sobre la mascota. Si no hay chat, no pases la prop (por defecto despierta, sale del escondite o saluda).
- Ocultala (`hidden`) en las pantallas donde estorbe: login, impresión, visores a pantalla completa (DICOM, odontograma).

### 3. Envolver la barra de widgets

```tsx
<MascotPeekZone edge="top">
  <WidgetBar />
</MascotPeekZone>
```

- `edge="top"` si la barra está abajo o en medio de la página (asoma por arriba); `edge="bottom"` si está arriba (asoma por debajo).
- Si la barra es `position: fixed` o `sticky`, pasá ese posicionamiento al `MascotPeekZone` (por `className` o `style`) en lugar de a la barra, para que el escondite viaje con ella.
- **Requisitos**: la barra necesita fondo opaco, y ningún ancestro debe tener `overflow: hidden` que recorte el espacio de arriba de la barra (alto = `size` de la mascota). Si lo hay, avisá en el resumen y proponé la solución menos invasiva.

### 4. Cruzar la pantalla al cambiar de página

En un componente que esté dentro del provider y del router:

```tsx
// React Router
const { pathname } = useLocation();
useMascotRouteTravel(pathname, { animation: 'teleport' });

// Next.js app router
const pathname = usePathname();
useMascotRouteTravel(pathname, { animation: 'teleport' });
```

`teleport` = salta, se desvanece y reaparece del otro lado. Otras opciones: `'hop'`, `'jump'`, `'cycle'`. Con `positions` se puede fijar un lugar por ruta.

### 5. Conectar el asistente de IA (lo más importante)

Buscá el flujo del chat o agente y conectá estos eventos:

| Evento de la app | Llamada a la mascota |
|---|---|
| El usuario envía un mensaje o pide algo | `m.notifyRequest(); m.setMood('thinking')` |
| Esperando respuesta del agente (n8n), carga larga | `m.setMood('loading')` |
| Llega la respuesta | `m.say(resumenCorto)` (frase corta, no la respuesta entera) o `m.setMood('happy')` |
| La acción del agente salió bien (turno agendado, factura emitida) | `m.gesture('celebrate')` |
| Error, timeout o "no entendí" | `m.setMood('sad')` y, si corresponde, `m.say('Uy, algo falló. ¿Probamos de nuevo?')` |
| El agente quiere mostrar dónde está algo en pantalla | `m.pointAt('#selector', { say: '…', travel: true })` |
| El usuario desactiva el asistente en preferencias | `m.setEnabled(false)` (y guardar la preferencia) |

Notas:
- Las acciones van **en cola**; encadenalas con `await` si querés una coreografía.
- No hagas que la mascota hable en cada evento: tiene que acompañar, no interrumpir. Una frase por respuesta del asistente como máximo.
- Los textos van en español rioplatense ("agendás", "tenés").
- Si el agente devuelve instrucciones de UI (por ejemplo "abrir agenda"), podés mapearlas a `pointAt` sobre el elemento correspondiente. Usá ids o `data-mascot-target="…"` estables en vez de selectores frágiles.

### 6. Preferencia de usuario

Si existe una pantalla de preferencias, agregá un switch **"Mostrar asistente animado"** conectado a la prop `enabled` del provider y persistido donde la app guarda las preferencias. Desactivada, la mascota hiberna (duerme) y no reacciona.

### 7. Accesibilidad y rendimiento

- Ya respeta `prefers-reduced-motion`; no lo desactives.
- La burbuja usa `role="status"` y `aria-live="polite"`: no la dupliques con otro anuncio.
- El escenario flotante tiene `pointer-events: none` salvo sobre la mascota y la burbuja, así que no bloquea clics.
- Si la app tiene CSP estricta para `<style>`, pasá `styleNonce` al provider.

## Criterios de aceptación (verificá cada uno)

- [ ] Compila sin errores de tipos y sin warnings nuevos en la consola.
- [ ] La mascota aparece abajo a la derecha, por encima de la barra de widgets, y sus ojos siguen el cursor.
- [ ] Al cambiar de página salta, se desvanece y reaparece del otro lado.
- [ ] Tras unos segundos sin interacción (para probar, bajá temporalmente `idleAfterMs` a 8000) se esconde **detrás** de la barra y se asoma en distintos lugares; no se ve por delante de la barra.
- [ ] Al hacer clic sobre ella mientras está escondida, sale y vuelve a su lugar.
- [ ] Con `sleepAfterMs` bajo (por ejemplo 60000) bosteza, cierra los ojos y se duerme con "Z". Un clic la despierta.
- [ ] Al enviar un mensaje al asistente pasa a "pensando"; al responder, habla con la burbuja; ante un error se pone triste.
- [ ] `pointAt` sobre un botón real gira el brazo hacia él, lo mira y dibuja el anillo.
- [ ] No tapa modales ni diálogos (z-index correcto).
- [ ] Con "reducir movimiento" activado en el sistema operativo no hay animaciones en bucle.
- [ ] Al terminar, volvé a dejar los valores de prueba en 45 s y 3 h.

Al terminar, resumí: archivos tocados, dónde quedó cada conexión, lo que no pudiste conectar y por qué.
