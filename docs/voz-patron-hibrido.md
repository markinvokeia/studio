# Voz e IA · Patrón híbrido

Cómo se arma un comando por voz (o por texto libre) que **primero se entiende en el navegador** y solo si no se entiende le pregunta a la IA. Así funcionan hoy **Órdenes de laboratorio** (`lab_orders`) y el **Periodontograma** (`perio`). Este documento sirve para llevar el mismo patrón a otras partes de la app que hoy usan agentes.

## La idea en una frase

Primero el **intérprete local** (rápido, gratis, predecible). Si no alcanza, la **IA devuelve lo mismo que habría armado el intérprete** (comandos estructurados, nunca texto libre). Eso se **revalida** dos veces (en n8n y en el navegador), y la pantalla **pregunta antes** de hacer algo pesado o dudoso.

```
frase ──► intérprete local ──► ¿entendió? ──sí──► política ──► ejecutar
                                   │no                ▲
                                   ▼                  │
                     POST voice/interpret (JWT)       │
                     { domain, text, context }        │
                                   │                  │
                     n8n "Voz - Interpretar":         │
                     prepare → agente → validate      │
                                   │                  │
                     { domain, confidence, result } ──┘
                     (sanitize en el navegador)
```

## Piezas

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| Módulo de voz (`VoiceDomain`) | `src/lib/types.ts`, `src/lib/voice/registry.ts` | Un id (`lab_orders`, `perio`), el contexto que se le cuenta a la IA y el `sanitize` que revalida su respuesta |
| Comandos (`VoiceCommand`) | `src/lib/voice/commands/*.ts` | `match` local, `run`, y `ai.from` para convertir el resultado de la IA en lo que espera `run`. Cada comando lleva su `domain` |
| Pedido a la IA | `src/lib/voice/ai.ts` (`requestInterpretation`, `interpretWithAi`) y `src/services/voice.ts` | `POST voice/interpret` con JWT. Devuelve `{ domain, confidence, result }` ya sanitizado |
| Flujo n8n | `scripts/n8n/generate-help-workflows.mjs` → `n8n-workflows/help-voice-interpret.json` («Voz - Interpretar») | Un flujo para todos los módulos. `VOICE_DOMAINS[id]` define `system` (prompt), `prepare` (contexto → texto) y `validate` (lista cerrada). Un módulo desconocido da error |
| Escucha | `src/lib/voice/speech-recognition.ts` | `startHoldListening` (mantener apretado), `startContinuousListening` (dictado continuo, con `pause`/`resume`) |
| Tarjeta y atajo | `src/components/voice/voice-command-host.tsx` | `VoiceCommandHost({ domains })`: Ctrl+Espacio, la tarjeta con lo entendido y las preguntas. Lo monta cada pantalla con sus módulos |

Hay dos formas de usarlo:

- **Comandos sueltos** (Órdenes de laboratorio): Ctrl+Espacio o el botón del micrófono, una frase por vez, tarjeta flotante. `session.ts` prueba los comandos de los módulos activos y, si ninguno entiende, le pregunta a la IA de cada módulo activo.
- **Comandos sueltos sobre una pantalla grande** (Calendario de citas, módulo `calendar`): igual que Órdenes de laboratorio, pero la página publica su estado y sus propias acciones en un puente (`src/lib/voice/calendar-bridge.ts`, `publishCalendarVoice` en un `useLayoutEffect` sin deps) y los comandos (`src/lib/voice/commands/calendar*.ts`) esperan a la pantalla con `waitForCalendar`. Navegar, vistas, filtros, agrupar, búsqueda y huecos van directo; consultas (agenda del día, quién sigue, próxima cita de un paciente, huecos) solo leen. Cambiar estados se confirma en la tarjeta; dar y reprogramar abren **el formulario de siempre ya completo** (modal o tarjeta del modo personalizado) y «sí» aprieta Guardar, así aplican todas sus validaciones (`submitSignal` del diálogo, `saveInlineDraft` de la tarjeta). El resto del clic derecho y de la barra (`calendar-actions.ts`: color, agenda, doctor, duración, borrar, abrir historia/documentos/cuenta/sesión/cobro, recordatorios, imprimir, actualizar) llama a las mismas funciones de la página por el puente, que ahora devuelven si se aplicó; bloquear/habilitar horario y el formulario de recordatorio reciben pedidos numerados (`voiceControl`, `src/lib/voice/dialog-voice.ts`) y avisan su estado (`onVoiceStatus`), así «sí» aprieta el mismo Confirmar/Guardar con sus validaciones. A la IA van doctores, agendas, sedes, tratamientos y la vista; nunca datos de pacientes (el nombre dicho viaja solo dentro de la frase).
- **Dictado continuo** (Periodontograma): el micrófono queda abierto y cada frase entra en una **cola ordenada**. El intérprete es propio del módulo (`src/lib/perio/voice.ts` arma una lista de comandos, `voice-engine.ts` los corre). Usa el mismo `voice/interpret`, pero con su propia barra (`perio-voice-bar.tsx`).

## Política (lo que hace la pantalla con la respuesta)

Los mismos números en los dos módulos:

| Situación | Qué pasa |
| --- | --- |
| Confianza < 0,5, timeout (8 s) o error | Queda como «No entendí». Nunca se adivina |
| 0,5 – 0,8, o la IA usó un número que no se dijo | Pregunta «¿Quisiste decir «…»?» con la frase reconstruida (`voiceCommandsToPhrase`) |
| ≥ 0,8 y todos los números se dijeron | Se aplica, marcado «IA» (en perio: subrayado punteado, sin confirmar) |
| Acción pesada (estado de pieza, copiar del examen anterior, descartar, cancelar o mover una orden…) | **Siempre** pregunta antes, venga del intérprete o de la IA |
| Pregunta («¿cuánto tenía el 16?») | Se responde en pantalla, no escribe nada |
| Confirmar, descartar, parar | **Nunca** vienen de la IA: el `sanitize` los saca |

Reglas que no se negocian:

1. **La IA no ejecuta nada.** Devuelve comandos; el navegador decide.
2. **Lista cerrada.** Ids, piezas, fechas y rangos se validan en `validate` (n8n) y otra vez en `sanitize` (navegador). Lo que no cierra se descarta.
3. **Sin datos del paciente en el contexto**, salvo que el comando los necesite de verdad (y entonces solo el mínimo).
4. **Una sola pregunta abierta.** El siguiente «sí» / «no» la contesta; otra frase la deja sin responder (sin hacer nada) y sigue.
5. **Los permisos se revisan en `run`**, igual que en la pantalla (`ctx.hasPermission`).
6. **Todo lo escrito por voz se puede deshacer** o queda pendiente de confirmar.

## Cómo agregar un módulo nuevo

Ejemplo: comandos de voz en el calendario (`calendar`).

1. **Comandos locales.** `src/lib/voice/commands/calendar.ts`:

   ```ts
   export const CALENDAR_VOICE_DOMAIN = 'calendar';

   registerVoiceDomain<CalendarAiResult>({
     id: CALENDAR_VOICE_DOMAIN,
     ai: {
       context: async (ctx) => ({ doctors: …, today: … }), // sin datos de pacientes
       sanitize: (raw) => sanitizeCalendarAiResult(raw),    // lista cerrada
     },
   });

   registerVoiceCommand<GotoDate, CalendarAiResult>({
     id: 'calendar.goto',
     domain: CALENDAR_VOICE_DOMAIN,
     match: (normalized) => parseGotoDate(normalized),        // null si no es para este
     run: async (parsed, ctx) => { … },
     ai: { from: (result) => (result.intent === 'calendar.goto' ? { date: result.date } : null) },
   });
   ```

   Importarlo en `src/lib/voice/commands/index.ts`.

2. **El flujo.** En `scripts/n8n/generate-help-workflows.mjs`, agregar `VOICE_DOMAINS.calendar` con `system`, `prepare` y `validate`. Correr `pnpm n8n:help` (nunca editar el JSON a mano) y reimportar «Voz - Interpretar» en n8n.

3. **La pantalla.** Montar `<VoiceCommandHost domains={[CALENDAR_VOICE_DOMAIN]} />` (o el botón `VoiceCommandButton`).

4. **Textos.** Las claves de la tarjeta y las ayudas en `src/messages/es.json`, `es-ES.json` (tú) y `en.json`, con los mismos placeholders. `pnpm i18n:check`.

5. **Asistente.** Help ids de lo nuevo en `knowledge/screens/*.json` (es y en) y `pnpm knowledge:build`.

6. **Pruebas.** Lógica sin navegador (parser y `sanitize`, como `e2e/tests/patients/perio-voice-logic.spec.ts`) y en navegador simulando `voice/interpret` con `page.route` (como `e2e/tests/lab-orders/voice-commands.spec.ts`). Nada se escribe en DEV.

## Otras partes de la app que usan IA hoy

| Parte | Dónde | Estado | Qué conviene |
| --- | --- | --- | --- |
| Mejorar texto clínico | `src/ai/flows/enhance-clinical-text.ts`, ruta Next `/api/ai/enhance-text` (Genkit, sin JWT) | En uso | No es un comando: es reescritura de texto. Si se mantiene, pasarlo a n8n con JWT como hizo el dictado del periodontograma (la ruta Next sin autenticación usa la clave del servidor) |
| Interpretar comando de usuario | `src/ai/flows/interpret-user-command.ts` | **No se usa** (solo `src/ai/dev.ts`) | Si vuelve, como módulo de `voice/interpret`: devuelve `actions` + `parameters` libres, que es justo lo que este patrón evita. Si no, borrarlo |
| Consultas a la base en lenguaje natural | `src/ai/flows/execute-database-operations-with-natural-language.ts` | **No se usa** | No llevarlo así: la IA no debe armar operaciones sobre la base. Si hace falta, comandos de consulta con lista cerrada (como `query` del periodontograma) contra endpoints existentes |
| Asistente guiado (ayuda) | `src/components/help/`, flujos «Help - …» | En uso | Ya tiene su propia política (siempre deja el OK final al usuario). Puede sumar voz montando un módulo `help` cuyos comandos abran guías (`run` → la guía) |
| Agente de WhatsApp | Flujos n8n del agente | En uso | Es una conversación, no un comando de pantalla. Lo que sí aplica: router local antes de la IA (ya existe el clasificador de órdenes) y lista cerrada en las herramientas |

## Checklist antes de dar por terminado un módulo

- [ ] Lo común se entiende **sin** IA (probar con las frases reales de los usuarios).
- [ ] `sanitize` y `validate` rechazan lo que no está en la lista.
- [ ] Lo pesado pregunta antes; confirmar/descartar no vienen de la IA.
- [ ] Sin el flujo importado la pantalla sigue funcionando (queda «No entendí»).
- [ ] Textos en los 3 idiomas, help ids en `knowledge/`, pruebas con la IA simulada.
- [ ] `pnpm typecheck && pnpm lint`, `pnpm i18n:check`, `pnpm knowledge:check`.
