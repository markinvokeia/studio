# Agenda: escucha, navegación, vistas y zoom

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/10-atomic-es.spec.ts`

Atómicos en español: escucha, navegación, vistas, zoom.

**34 frases** en **27 pruebas que pasan** (es 34 · es-ES 0 · en 0). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## N1.1 · Escucha

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-001 con Voz prendido escucha todo, sin palabra de activación | es | `/appointments` | «andá a mañana» | Calendario en mar 24/11. |
| VZ-ES-002 «Invoke» solo (opcional) dice que escucha | es | `/appointments` | «Invoke» | **Comando de voz** · Te escucho. Decime qué hago. |
| VZ-ES-003 «Inbox IA …» (como lo transcribe el reconocedor) se saca y se hace el pedido | es | `/appointments` | «Inbox IA volvé a hoy» | Calendario en lun 23/11. |
| VZ-ES-004 frases seguidas, cada una se hace | es | `/appointments` | «vista día» | **Calendario** · Listo, vista de día. |
| 〃 | es | `/appointments` | «mañana» | Calendario en mar 24/11. |
| VZ-ES-005 una charla de la sala no hace nada ni se dice en voz alta | es | `/appointments` | «vista semana» | **Calendario** · Listo, vista de semana. |
| 〃 | es | `/appointments` | «qué lindo día hace hoy afuera» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá al jueves», «¿qué tengo mañana?», «Ana Gómez llegó», «nueva cita para Ana Gómez el lunes a las 10», «poné la cita de Ana en rojo», «bloqueá el lunes de 14 a 16» o «recordame mañana a l… |
| VZ-ES-007 un rato sin hablarle se duerme (apaga el micrófono) | es | `/appointments` | «vista día» | — |
| VZ-ES-008 se duerme con una pregunta abierta y al prenderlo la retoma | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «la segunda» | **Cita** · La cita de Ana Martínez, hoy a las 10:30. |

## N1.2 · Navegación

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-010 hoy | es | `/appointments` | «Invoke hoy» | Calendario en lun 23/11. |
| VZ-ES-011 mañana | es | `/appointments` | «Invoke andá a mañana» | Calendario en mar 24/11. |
| VZ-ES-012 siguiente en vista semana avanza una semana | es | `/appointments` | «Invoke siguiente» | Calendario en lun 30/11. |
| VZ-ES-013 anterior en vista día retrocede un día | es | `/appointments` | «Invoke vista día» | **Calendario** · Listo, vista de día. |
| 〃 | es | `/appointments` | «anterior» | Calendario en dom 22/11. |
| VZ-ES-014 la semana que viene | es | `/appointments` | «Invoke la semana que viene» | Calendario en lun 30/11. |
| VZ-ES-015 ir a una fecha con el mes | es | `/appointments` | «Invoke andá al 3 de diciembre» | Calendario en jue 03/12. |

## N1.3 · Vista

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-02x «vista día» → day | es | `/appointments` | «Invoke vista día» | **Calendario** · Listo, vista de día. |
| VZ-ES-02x «ver semana» → week | es | `/appointments` | «Invoke ver semana» | **Calendario** · Listo, vista de semana. |
| VZ-ES-02x «vista de 3 días» → 3-day | es | `/appointments` | «Invoke vista de 3 días» | **Calendario** · Listo, vista de 3 días. |
| VZ-ES-02x «vista mes» → month | es | `/appointments` | «Invoke vista mes» | **Calendario** · Listo, vista de mes. |
| VZ-ES-02x «vista lista» → schedule | es | `/appointments` | «Invoke vista lista» | **Calendario** · Listo, vista de agenda. |
| VZ-ES-026 «¿cómo puedo ver?» lista las vistas y elige «la última» | es | `/appointments` | «Invoke cómo puedo ver» | **Opciones** · ¿Qué vista querés? [día / 2 días / 3 días / 4 días / 5 días / 6 días] |
| 〃 | es | `/appointments` | «la última» | **Opciones** · Listo, vista de agenda. |
| VZ-ES-027 «cambiá la vista» sin decir cuál pregunta, y se elige por nombre | es | `/appointments` | «Invoke cambiá la vista» | **Opciones** · ¿Qué vista querés? [día / 2 días / 3 días / 4 días / 5 días / 6 días] |
| 〃 | es | `/appointments` | «la de mes» | **Opciones** · Listo, vista de mes. |

## N1.4 · Zoom

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-030 más zoom | es | `/appointments` | «Invoke más zoom» | Zoom al 110 %. |
| VZ-ES-031 alejá (menos zoom) | es | `/appointments` | «Invoke alejá» | Zoom al 90 %. |
| VZ-ES-032 zoom al máximo | es | `/appointments` | «Invoke zoom al máximo» | Zoom al 250 %. |
| VZ-ES-033 lo más chico posible | es | `/appointments` | «Invoke lo más chico posible» | Zoom al 30 %. |
| VZ-ES-034 zoom al 150 | es | `/appointments` | «Invoke zoom al 150» | Zoom al 150 %. |
| VZ-ES-035 zoom normal | es | `/appointments` | «Invoke zoom al máximo» | Zoom al 250 %. |
| 〃 | es | `/appointments` | «zoom normal» | Zoom al 100 %. |
| VZ-ES-036 agrandá mucho (3 pasos) | es | `/appointments` | «Invoke agrandá mucho» | Zoom al 130 %. |

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- N1.1 · Escucha › VZ-ES-006 tocar Voz lo apaga y no escucha más

