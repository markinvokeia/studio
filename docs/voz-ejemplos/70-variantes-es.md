# Variantes en español

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/70-variants-es.spec.ts`

La misma acción pedida de muchas formas, en español.

**243 frases** en **213 pruebas que pasan** (es 243 · es-ES 0 · en 0). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## V-ES-NAV · hoy

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «hoy» | es | `/appointments` | «hoy» | Calendario en lun 23/11. |
| «volvé a hoy» | es | `/appointments` | «volvé a hoy» | Calendario en lun 23/11. |
| «andá a hoy» | es | `/appointments` | «andá a hoy» | Calendario en lun 23/11. |
| «el día de hoy» | es | `/appointments` | «el día de hoy» | Calendario en lun 23/11. |
| «mostrame hoy» | es | `/appointments` | «mostrame hoy» | Calendario en lun 23/11. |
| «llevame a hoy» | es | `/appointments` | «llevame a hoy» | Calendario en lun 23/11. |
| «volvamos a hoy» | es | `/appointments` | «volvamos a hoy» | Calendario en lun 23/11. |

## V-ES-NAV · mañana y ayer

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «mañana» | es | `/appointments` | «mañana» | Calendario en mar 24/11. |
| «andá a mañana» | es | `/appointments` | «andá a mañana» | Calendario en mar 24/11. |
| «mostrame mañana» | es | `/appointments` | «mostrame mañana» | Calendario en mar 24/11. |
| «pasá a mañana» | es | `/appointments` | «pasá a mañana» | Calendario en mar 24/11. |
| «ayer» | es | `/appointments` | «ayer» | Calendario en dom 22/11. |
| «andá a ayer» | es | `/appointments` | «andá a ayer» | Calendario en dom 22/11. |
| «mostrame ayer» | es | `/appointments` | «mostrame ayer» | Calendario en dom 22/11. |

## V-ES-NAV · siguiente (vista semana)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «siguiente» | es | `/appointments` | «siguiente» | Calendario en lun 30/11. |
| «adelante» | es | `/appointments` | «adelante» | Calendario en lun 30/11. |
| «avanzá» | es | `/appointments` | «avanzá» | Calendario en lun 30/11. |
| «para adelante» | es | `/appointments` | «para adelante» | Calendario en lun 30/11. |
| «el próximo» | es | `/appointments` | «el próximo» | Calendario en lun 30/11. |

## V-ES-NAV · anterior (vista semana)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «anterior» | es | `/appointments` | «anterior» | Calendario en lun 16/11. |
| «atrás» | es | `/appointments` | «atrás» | Calendario en lun 16/11. |
| «para atrás» | es | `/appointments` | «para atrás» | Calendario en lun 16/11. |
| «retrocedé» | es | `/appointments` | «retrocedé» | Calendario en lun 16/11. |
| «volvé para atrás» | es | `/appointments` | «volvé para atrás» | Calendario en lun 16/11. |

## V-ES-NAV · semanas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «la semana que viene» | es | `/appointments` | «la semana que viene» | Calendario en lun 30/11. |
| «la próxima semana» | es | `/appointments` | «la próxima semana» | Calendario en lun 30/11. |
| «semana siguiente» | es | `/appointments` | «semana siguiente» | Calendario en lun 30/11. |
| «mostrame la semana que viene» | es | `/appointments` | «mostrame la semana que viene» | **Calendario** · Listo, vista de semana. |
| «la semana pasada» | es | `/appointments` | «la semana pasada» | Calendario en lun 16/11. |
| «semana anterior» | es | `/appointments` | «semana anterior» | Calendario en lun 16/11. |

## V-ES-NAV · meses

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «el mes que viene» | es | `/appointments` | «el mes que viene» | Calendario en mié 23/12. |
| «el próximo mes» | es | `/appointments` | «el próximo mes» | Calendario en sáb 26/12. |
| «el mes pasado» | es | `/appointments` | «el mes pasado» | Calendario en vie 23/10. |
| «mes anterior» | es | `/appointments` | «mes anterior» | Calendario en lun 26/10. |

## V-ES-NAV · día de la semana

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «andá al jueves» | es | `/appointments` | «andá al jueves» | Calendario en jue 26/11. |
| «el lunes» | es | `/appointments` | «el lunes» | Calendario en lun 23/11. |
| «mostrame el viernes» | es | `/appointments` | «mostrame el viernes» | Calendario en vie 27/11. |
| «el martes» | es | `/appointments` | «el martes» | Calendario en mar 24/11. |
| «el sábado» | es | `/appointments` | «el sábado» | Calendario en sáb 28/11. |
| «el miércoles» | es | `/appointments` | «el miércoles» | Calendario en mié 25/11. |

## V-ES-NAV · fechas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «el 15» | es | `/appointments` | «el 15» | Calendario en dom 15/11. |
| «andá al 3 de diciembre» | es | `/appointments` | «andá al 3 de diciembre» | Calendario en jue 03/12. |
| «el 20 de enero» | es | `/appointments` | «el 20 de enero» | Calendario en mié 20/01. |
| «mostrame el 1 de marzo» | es | `/appointments` | «mostrame el 1 de marzo» | Calendario en lun 01/03. |

## V-ES-VIEW

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «vista día» | es | `/appointments` | «vista día» | **Calendario** · Listo, vista de día. |
| «vista diaria» | es | `/appointments` | «vista diaria» | **Calendario** · Listo, vista de día. |
| «ver por día» | es | `/appointments` | «ver por día» | **Calendario** · Listo, vista de día. |
| «poné vista de día» | es | `/appointments` | «poné vista de día» | **Calendario** · Listo, vista de día. |
| «cambiá a vista día» | es | `/appointments` | «cambiá a vista día» | **Calendario** · Listo, vista de día. |
| «modo día» | es | `/appointments` | «modo día» | **Calendario** · Listo, vista de día. |
| «vista semana» | es | `/appointments` | «vista semana» | **Calendario** · Listo, vista de semana. |
| «vista semanal» | es | `/appointments` | «vista semanal» | **Calendario** · Listo, vista de semana. |
| «ver la semana» | es | `/appointments` | «ver la semana» | **Calendario** · Listo, vista de semana. |
| «cambiá a semana» | es | `/appointments` | «cambiá a semana» | **Calendario** · Listo, vista de semana. |
| «vista mes» | es | `/appointments` | «vista mes» | **Calendario** · Listo, vista de mes. |
| «vista mensual» | es | `/appointments` | «vista mensual» | **Calendario** · Listo, vista de mes. |
| «ver el mes» | es | `/appointments` | «ver el mes» | **Calendario** · Listo, vista de mes. |
| «vista lista» | es | `/appointments` | «vista lista» | **Calendario** · Listo, vista de agenda. |
| «vista agenda» | es | `/appointments` | «vista agenda» | **Calendario** · Listo, vista de agenda. |
| «ver como lista» | es | `/appointments` | «ver como lista» | **Calendario** · Listo, vista de agenda. |
| «vista de 2 días» | es | `/appointments` | «vista de 2 días» | **Calendario** · Listo, vista de 2 días. |
| «vista de 4 días» | es | `/appointments` | «vista de 4 días» | **Calendario** · Listo, vista de 4 días. |
| «ver 5 días» | es | `/appointments` | «ver 5 días» | **Calendario** · Listo, vista de 5 días. |
| «vista de 6 días» | es | `/appointments` | «vista de 6 días» | **Calendario** · Listo, vista de 6 días. |
| «vista de tres días» | es | `/appointments` | «vista de tres días» | **Calendario** · Listo, vista de 3 días. |

## V-ES-ZOOM

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «más zoom» | es | `/appointments` | «más zoom» | Zoom al 110 %. |
| «zoom» | es | `/appointments` | «zoom» | Zoom al 110 %. |
| «hacé zoom» | es | `/appointments` | «hacé zoom» | Zoom al 110 %. |
| «acercá» | es | `/appointments` | «acercá» | Zoom al 110 %. |
| «agrandá» | es | `/appointments` | «agrandá» | Zoom al 110 %. |
| «más grande» | es | `/appointments` | «más grande» | Zoom al 110 %. |
| «aumentá el zoom» | es | `/appointments` | «aumentá el zoom» | Zoom al 110 %. |
| «subí el zoom» | es | `/appointments` | «subí el zoom» | Zoom al 110 %. |
| «ampliá» | es | `/appointments` | «ampliá» | Zoom al 110 %. |
| «menos zoom» | es | `/appointments` | «menos zoom» | Zoom al 90 %. |
| «alejá» | es | `/appointments` | «alejá» | Zoom al 90 %. |
| «achicá» | es | `/appointments` | «achicá» | Zoom al 90 %. |
| «más chico» | es | `/appointments` | «más chico» | Zoom al 90 %. |
| «bajá el zoom» | es | `/appointments` | «bajá el zoom» | Zoom al 90 %. |
| «reducí el zoom» | es | `/appointments` | «reducí el zoom» | Zoom al 90 %. |
| «disminuí el zoom» | es | `/appointments` | «disminuí el zoom» | Zoom al 90 %. |
| «zoom al máximo» | es | `/appointments` | «zoom al máximo» | Zoom al 250 %. |
| «lo más grande posible» | es | `/appointments` | «lo más grande posible» | Zoom al 250 %. |
| «zoom máximo» | es | `/appointments` | «zoom máximo» | Zoom al 250 %. |
| «agrandá al máximo» | es | `/appointments` | «agrandá al máximo» | Zoom al 250 %. |
| «zoom mínimo» | es | `/appointments` | «zoom mínimo» | Zoom al 30 %. |
| «lo más chico posible» | es | `/appointments` | «lo más chico posible» | Zoom al 30 %. |
| «alejá al mínimo» | es | `/appointments` | «alejá al mínimo» | Zoom al 30 %. |
| «achicá al mínimo» | es | `/appointments` | «achicá al mínimo» | Zoom al 30 %. |
| «zoom al 80» | es | `/appointments` | «zoom al 80» | Zoom al 80 %. |
| «zoom 120 por ciento» | es | `/appointments` | «zoom 120 por ciento» | Zoom al 120 %. |
| «zoom al 200» | es | `/appointments` | «zoom al 200» | Zoom al 200 %. |
| «zoom normal» | es | `/appointments` | «zoom normal» | Zoom al 100 %. |
| «reiniciá el zoom» | es | `/appointments` | «reiniciá el zoom» | Zoom al 100 %. |
| «zoom por defecto» | es | `/appointments` | «zoom por defecto» | Zoom al 100 %. |
| «agrandá mucho» | es | `/appointments` | «agrandá mucho» | Zoom al 130 %. |
| «achicá bastante» | es | `/appointments` | «achicá bastante» | Zoom al 70 %. |

## V-ES-PANEL

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «abrí el panel de agendas» | es | `/appointments` | «abrí el panel de agendas» | **Panel de agendas** · Listo, abrí el panel de agendas. |
| «mostrá el panel» | es | `/appointments` | «mostrá el panel» | **Panel de agendas** · Listo, abrí el panel de agendas. |
| «abrí el panel lateral» | es | `/appointments` | «abrí el panel lateral» | **Panel de agendas** · Listo, abrí el panel de agendas. |
| «fijá el panel» | es | `/appointments` | «fijá el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| «dejá fijo el panel» | es | `/appointments` | «dejá fijo el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| «que el panel no se cierre» | es | `/appointments` | «que el panel no se cierre» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| «anclá el panel» | es | `/appointments` | «anclá el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| «que quede fijo el panel» | es | `/appointments` | «que quede fijo el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |

## V-ES-PANEL · cerrar y soltar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cerrá el panel» | es | `/appointments` | «dejá fijo el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| 〃 | es | `/appointments` | «cerrá el panel» | **Cerrar** · Listo, cerré: el panel de agendas. |
| «escondé el panel» | es | `/appointments` | «dejá fijo el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| 〃 | es | `/appointments` | «escondé el panel» | **Cerrar** · Listo, cerré: el panel de agendas. |
| «ocultá el panel de agendas» | es | `/appointments` | «dejá fijo el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| 〃 | es | `/appointments` | «ocultá el panel de agendas» | **Panel de agendas** · Listo, cerré el panel de agendas. |
| «soltá el panel» | es | `/appointments` | «dejá fijo el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| 〃 | es | `/appointments` | «soltá el panel» | **Panel de agendas** · Listo, el panel de agendas se esconde solo al elegir una agenda. |
| «desfijá el panel» | es | `/appointments` | «dejá fijo el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| 〃 | es | `/appointments` | «desfijá el panel» | **Panel de agendas** · Listo, el panel de agendas se esconde solo al elegir una agenda. |
| «que el panel se esconda solo» | es | `/appointments` | «dejá fijo el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| 〃 | es | `/appointments` | «que el panel se esconda solo» | **Panel de agendas** · Listo, el panel de agendas se esconde solo al elegir una agenda. |
| «no dejes fijo el panel» | es | `/appointments` | «dejá fijo el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| 〃 | es | `/appointments` | «no dejes fijo el panel» | **Panel de agendas** · Listo, el panel de agendas se esconde solo al elegir una agenda. |

## V-ES-AGENDA

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «solo la agenda ortodoncia» | es | `/appointments` | «solo la agenda ortodoncia» | **Filtros del calendario** · Listo, solo Ortodoncia. |
| «mostrame la agenda ortodoncia» | es | `/appointments` | «mostrame la agenda ortodoncia» | **Filtros del calendario** · Listo, solo Ortodoncia. |
| «cambiá a la agenda sillón 2» | es | `/appointments` | «cambiá a la agenda sillón 2» | **Filtros del calendario** · Listo, solo Sillón 2. |
| «pasá al sillón 2» | es | `/appointments` | «pasá al sillón 2» | **Filtros del calendario** · Listo, solo Sillón 2. |
| «ver el sillón 2» | es | `/appointments` | «ver el sillón 2» | **Filtros del calendario** · Listo, solo Sillón 2. |
| «solo el sillón 1» | es | `/appointments` | «solo el sillón 1» | **Filtros del calendario** · Listo, solo Sillón 1. |

## V-ES-STATUS · llegó

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «Juan Pérez llegó» | es | `/appointments` | «Juan Pérez llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |
| «llegó Juan Pérez» | es | `/appointments` | «llegó Juan Pérez» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |
| «Juan Pérez ya llegó» | es | `/appointments` | «Juan Pérez ya llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |
| «Juan Pérez está en la sala» | es | `/appointments` | «Juan Pérez está en la sala» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |
| «marcá a Juan Pérez como llegó» | es | `/appointments` | «marcá a Juan Pérez como llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |
| «Juan Pérez ya está acá» | es | `/appointments` | «Juan Pérez ya está acá» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |
| «la de las 10 llegó» | es | `/appointments` | «la de las 10 llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |

## V-ES-STATUS · confirmó

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «Carlos López confirmó» | es | `/appointments` | «Carlos López confirmó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Confirmada. |
| «confirmá la cita de Carlos López» | es | `/appointments` | «confirmá la cita de Carlos López» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Confirmada. |
| «Carlos López confirmó la cita» | es | `/appointments` | «Carlos López confirmó la cita» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Confirmada. |
| «marcá como confirmada la de Carlos López» | es | `/appointments` | «marcá como confirmada la de Carlos López» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Confirmada. |

## V-ES-STATUS · no vino

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «Carlos López no vino» | es | `/appointments` | «Carlos López no vino» | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en No asistió. |
| «Carlos López faltó» | es | `/appointments` | «Carlos López faltó» | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en No asistió. |
| «Carlos López no se presentó» | es | `/appointments` | «Carlos López no se presentó» | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en No asistió. |
| «la de las 3 no vino» | es | `/appointments` | «la de las 3 no vino» | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en No asistió. |

## V-ES-STATUS · en consulta y terminó

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «Juan Pérez pasó a consulta» | es | `/appointments` | «Juan Pérez pasó a consulta» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en En curso. |
| «Juan Pérez está en consulta» | es | `/appointments` | «Juan Pérez está en consulta» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en En curso. |
| «Juan Pérez entró» | es | `/appointments` | «Juan Pérez entró» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en En curso. |
| «terminó Juan Pérez» | es | `/appointments` | «terminó Juan Pérez» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Completada. |
| «Juan Pérez ya se atendió» | es | `/appointments` | «Juan Pérez ya se atendió» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Completada. |
| «completá la cita de Juan Pérez» | es | `/appointments` | «completá la cita de Juan Pérez» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Completada. |
| «Juan Pérez terminó» | es | `/appointments` | «Juan Pérez terminó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Completada. |
| «Juan Pérez llegó tarde» | es | `/appointments` | «Juan Pérez llegó tarde» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó tarde. |

## V-ES-INFO · visitas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cuántas veces vino Juan Pérez» | es | `/appointments` | «cuántas veces vino Juan Pérez» | Información del paciente |
| «cuántas visitas tiene Juan Pérez» | es | `/appointments` | «cuántas visitas tiene Juan Pérez» | Información del paciente |
| «cuántas consultas tuvo Juan Pérez» | es | `/appointments` | «cuántas consultas tuvo Juan Pérez» | Información del paciente |
| «Juan Pérez cuántas veces vino» | es | `/appointments` | «Juan Pérez cuántas veces vino» | Información del paciente |
| «cuántas veces lo atendimos a Juan Pérez» | es | `/appointments` | «cuántas veces lo atendimos a Juan Pérez» | Información del paciente |

## V-ES-INFO · faltas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cuántas veces faltó Juan Pérez» | es | `/appointments` | «cuántas veces faltó Juan Pérez» | Información del paciente |
| «cuántas faltas tiene Juan Pérez» | es | `/appointments` | «cuántas faltas tiene Juan Pérez» | Información del paciente |
| «cuántas veces no vino Juan Pérez» | es | `/appointments` | «cuántas veces no vino Juan Pérez» | Información del paciente |
| «cuántas inasistencias tiene Juan Pérez» | es | `/appointments` | «cuántas inasistencias tiene Juan Pérez» | Información del paciente |
| «cuándo fue la última vez que faltó Juan Pérez» | es | `/appointments` | «cuándo fue la última vez que faltó Juan Pérez» | Información del paciente |
| «última falta de Juan Pérez» | es | `/appointments` | «última falta de Juan Pérez» | Información del paciente |

## V-ES-INFO · cancelaciones

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cuántas citas canceló Juan Pérez» | es | `/appointments` | «cuántas citas canceló Juan Pérez» | Información del paciente |
| «cuántas cancelaciones tiene Juan Pérez» | es | `/appointments` | «cuántas cancelaciones tiene Juan Pérez» | Información del paciente |
| «cuántas veces canceló Juan Pérez» | es | `/appointments` | «cuántas veces canceló Juan Pérez» | Información del paciente |

## V-ES-INFO · deuda

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cuánto debe Juan Pérez» | es | `/appointments` | «cuánto debe Juan Pérez» | Información del paciente |
| «Juan Pérez tiene deuda» | es | `/appointments` | «Juan Pérez tiene deuda» | Información del paciente |
| «Juan Pérez debe algo» | es | `/appointments` | «Juan Pérez debe algo» | Información del paciente |
| «cuál es el saldo de Juan Pérez» | es | `/appointments` | «cuál es el saldo de Juan Pérez» | Información del paciente |
| «Juan Pérez está al día» | es | `/appointments` | «Juan Pérez está al día» | Información del paciente |
| «tiene algo pendiente de pagar Juan Pérez» | es | `/appointments` | «tiene algo pendiente de pagar Juan Pérez» | Información del paciente |

## V-ES-INFO · pagos

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cuál fue el último pago de Juan Pérez» | es | `/appointments` | «cuál fue el último pago de Juan Pérez» | Información del paciente |
| «cuándo pagó Juan Pérez por última vez» | es | `/appointments` | «cuándo pagó Juan Pérez por última vez» | Información del paciente |
| «último pago de Juan Pérez» | es | `/appointments` | «último pago de Juan Pérez» | Información del paciente |
| «cuánto ha pagado Juan Pérez» | es | `/appointments` | «cuánto ha pagado Juan Pérez» | Información del paciente |

## V-ES-INFO · presupuestos, facturas y tratamientos

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «qué presupuestos tiene Juan Pérez» | es | `/appointments` | «qué presupuestos tiene Juan Pérez» | Información del paciente |
| «cómo están los presupuestos de Juan Pérez» | es | `/appointments` | «cómo están los presupuestos de Juan Pérez» | Información del paciente |
| «en qué estado están los presupuestos de Juan Pérez» | es | `/appointments` | «en qué estado están los presupuestos de Juan Pérez» | Información del paciente |
| «qué facturas tiene Juan Pérez» | es | `/appointments` | «qué facturas tiene Juan Pérez» | Información del paciente |
| «cuántas facturas tiene Juan Pérez» | es | `/appointments` | «cuántas facturas tiene Juan Pérez» | Información del paciente |
| «qué tratamientos tiene en curso Juan Pérez» | es | `/appointments` | «qué tratamientos tiene en curso Juan Pérez» | Información del paciente |
| «cómo va el tratamiento de Juan Pérez» | es | `/appointments` | «cómo va el tratamiento de Juan Pérez» | Información del paciente |
| «tratamientos activos de Juan Pérez» | es | `/appointments` | «tratamientos activos de Juan Pérez» | Información del paciente |

## V-ES-INFO · resumen

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «resumen de Juan Pérez» | es | `/appointments` | «resumen de Juan Pérez» | Información del paciente |
| «dame un resumen de Juan Pérez» | es | `/appointments` | «dame un resumen de Juan Pérez» | Información del paciente |
| «estadísticas de Juan Pérez» | es | `/appointments` | «estadísticas de Juan Pérez» | Información del paciente |
| «qué sabemos de Juan Pérez» | es | `/appointments` | «qué sabemos de Juan Pérez» | Información del paciente |
| «resumime a Juan Pérez» | es | `/appointments` | «resumime a Juan Pérez» | Información del paciente |

## V-ES-ACTION

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «creá un presupuesto para Juan Pérez» | es | `/appointments` | «creá un presupuesto para Juan Pérez» | **Nuevo presupuesto** · Listo, abrí un presupuesto nuevo para Juan Pérez. |
| «hacé un presupuesto a Juan Pérez» | es | `/appointments` | «hacé un presupuesto a Juan Pérez» | **Nuevo presupuesto** · Listo, abrí un presupuesto nuevo para Juan Pérez. |
| «nuevo presupuesto para Juan Pérez» | es | `/appointments` | «nuevo presupuesto para Juan Pérez» | **Nuevo presupuesto** · Listo, abrí un presupuesto nuevo para Juan Pérez. |
| «armá un presupuesto para Juan Pérez» | es | `/appointments` | «armá un presupuesto para Juan Pérez» | **Nuevo presupuesto** · Listo, abrí un presupuesto nuevo para Juan Pérez. |
| «creá una factura para Juan Pérez» | es | `/appointments` | «creá una factura para Juan Pérez» | **Nueva factura** · Listo, abrí una factura nueva para Juan Pérez. |
| «facturale a Juan Pérez» | es | `/appointments` | «facturale a Juan Pérez» | **Nueva factura** · Listo, abrí una factura nueva para Juan Pérez. |
| «nueva factura para Juan Pérez» | es | `/appointments` | «nueva factura para Juan Pérez» | **Nueva factura** · Listo, abrí una factura nueva para Juan Pérez. |
| «creá un tratamiento para Juan Pérez» | es | `/appointments` | «creá un tratamiento para Juan Pérez» | **Nuevo tratamiento** · Listo, abrí un tratamiento nuevo para Juan Pérez. |
| «nuevo tratamiento para Juan Pérez» | es | `/appointments` | «nuevo tratamiento para Juan Pérez» | **Nuevo tratamiento** · Listo, abrí un tratamiento nuevo para Juan Pérez. |
| «cargá un tratamiento para Juan Pérez» | es | `/appointments` | «cargá un tratamiento para Juan Pérez» | **Nuevo tratamiento** · Listo, abrí un tratamiento nuevo para Juan Pérez. |
| «hacé un cobro rápido a Juan Pérez» | es | `/appointments` | «hacé un cobro rápido a Juan Pérez» | **Cobro rápido** · Listo, abrí el cobro rápido de Juan Pérez. |
| «cobro rápido para Juan Pérez» | es | `/appointments` | «cobro rápido para Juan Pérez» | **Cobro rápido** · Listo, abrí el cobro rápido de Juan Pérez. |
| «cobrale a Juan Pérez» | es | `/appointments` | «cobrale a Juan Pérez» | **Cobro rápido** · Listo, abrí el cobro rápido de Juan Pérez. |
| «registrá la sesión clínica de Juan Pérez» | es | `/appointments` | «registrá la sesión clínica de Juan Pérez» | **Sesión clínica** · Listo, abrí la sesión clínica de Juan Pérez. |
| «nueva sesión para Juan Pérez» | es | `/appointments` | «nueva sesión para Juan Pérez» | **Sesión clínica** · Listo, abrí la sesión clínica de Juan Pérez. |
| «abrí la sesión clínica de Juan Pérez» | es | `/appointments` | «abrí la sesión clínica de Juan Pérez» | **Sesión clínica** · Listo, abrí la sesión clínica de Juan Pérez. |

## V-ES-SETTINGS

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «slots de 15 minutos» | es | `/appointments` | «slots de 15 minutos» | **Configuración de la agenda** · Listo: slots de 15 minutos. |
| «franjas de 10 minutos» | es | `/appointments` | «franjas de 10 minutos» | **Configuración de la agenda** · Listo: slots de 10 minutos. |
| «intervalos de 20 minutos» | es | `/appointments` | «intervalos de 20 minutos» | **Configuración de la agenda** · Listo: slots de 20 minutos. |
| «slots de media hora» | es | `/appointments` | «slots de media hora» | **Configuración de la agenda** · Listo: slots de 30 minutos. |
| «que arranque en vista día» | es | `/appointments` | «que arranque en vista día» | **Configuración de la agenda** · Listo: vista predeterminada día. |
| «vista por defecto semana» | es | `/appointments` | «vista por defecto semana» | **Configuración de la agenda** · Listo: vista predeterminada semana. |
| «vista predeterminada mes» | es | `/appointments` | «vista predeterminada mes» | **Configuración de la agenda** · Listo: vista predeterminada mes. |
| «ocultá los domingos» | es | `/appointments` | «ocultá los domingos» | **Configuración de la agenda** · Listo: ocultos: domingo. |
| «no muestres los sábados» | es | `/appointments` | «no muestres los sábados» | **Configuración de la agenda** · Listo: ocultos: sábado. |
| «escondé el fin de semana» | es | `/appointments` | «escondé el fin de semana» | **Configuración de la agenda** · Listo: ocultos: sábado, domingo. |
| «mostrá solo el horario de la clínica» | es | `/appointments` | «mostrá solo el horario de la clínica» | **Configuración de la agenda** · Listo: franja del horario de la clínica. |
| «franja visible completa» | es | `/appointments` | «franja visible completa» | **Configuración de la agenda** · Listo: franja completa. |
| «horario visible de 9 a 18» | es | `/appointments` | «horario visible de 9 a 18» | **Configuración de la agenda** · Listo: franja de 09:00 a 18:00. |
| «altura de la hora 140» | es | `/appointments` | «altura de la hora 140» | **Configuración de la agenda** · Listo: altura de la hora 140 px. |
| «horas más bajas» | es | `/appointments` | «horas más bajas» | **Configuración de la agenda** · Listo: altura de la hora 60 px. |
| «modo personalizado» | es | `/appointments` | «modo personalizado» | **Configuración de la agenda** · Listo: modo personalizado. |
| «vista invoke» | es | `/appointments` | «vista invoke» | **Configuración de la agenda** · Listo: modo Invoke. |
| «activá colores por estado» | es | `/appointments` | «activá colores por estado» | **Configuración de la agenda** · Listo: colores por estado activado. |
| «desactivá colores por estado» | es | `/appointments` | «desactivá colores por estado» | **Configuración de la agenda** · Listo: colores por estado desactivado. |

