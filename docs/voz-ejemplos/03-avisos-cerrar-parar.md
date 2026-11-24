# Avisos, cerrar y dejar de escuchar

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/03-dialogs-close-stop.spec.ts`

Avisos (elegir el botón por texto, posición o sí/no), cerrar lo que esté abierto, dejar de escuchar, buscar huecos.

**60 frases** en **35 pruebas que pasan** (es 39 · es-ES 0 · en 21). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## AV-STOP · Dejar de escuchar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| AV-STOP-01 dicho con el micrófono prendido: se apaga y avisa | es | `/appointments` | «dejá de escuchar» | **Comando de voz** · Listo, dejé de escuchar. Tocá Voz cuando me necesites. |
| AV-STOP-02 con una pregunta abierta: se apaga y la deja guardada | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «pausá el dictado» | **Comando de voz** · Listo, dejé de escuchar. Tocá Voz cuando me necesites. |
| AV-STOP-03 en inglés | en | `/appointments` | «stop listening please» | **Voice command** · Done, I stopped listening. Tap Voice when you need me. |

## AV-CLOSE · Cerrar lo que esté abierto

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cerrá» cierra la búsqueda abierta | es | `/appointments` | «buscá a Ana Gómez» | **Buscar cita** · Busco «ana gomez». |
| 〃 | es | `/appointments` | «cerrá» | **Cerrar** · Listo, cerré: la búsqueda. |
| «cerralo» cierra la búsqueda abierta | es | `/appointments` | «buscá a Ana Gómez» | **Buscar cita** · Busco «ana gomez». |
| 〃 | es | `/appointments` | «cerralo» | **Cerrar** · Listo, cerré: la búsqueda. |
| «cerrá el panel» cierra la búsqueda abierta | es | `/appointments` | «buscá a Ana Gómez» | **Buscar cita** · Busco «ana gomez». |
| 〃 | es | `/appointments` | «cerrá el panel» | **Cerrar** · Listo, cerré: la búsqueda. |
| «escondé eso» cierra la búsqueda abierta | es | `/appointments` | «buscá a Ana Gómez» | **Buscar cita** · Busco «ana gomez». |
| 〃 | es | `/appointments` | «escondé eso» | **Cerrar** · Listo, cerré: la búsqueda. |
| «que no se vea» cierra la búsqueda abierta | es | `/appointments` | «buscá a Ana Gómez» | **Buscar cita** · Busco «ana gomez». |
| 〃 | es | `/appointments` | «que no se vea» | **Cerrar** · Listo, cerré: la búsqueda. |
| «no quiero ver eso» cierra la búsqueda abierta | es | `/appointments` | «buscá a Ana Gómez» | **Buscar cita** · Busco «ana gomez». |
| 〃 | es | `/appointments` | «no quiero ver eso» | **Cerrar** · Listo, cerré: la búsqueda. |
| «sacalo de ahí» cierra la búsqueda abierta | es | `/appointments` | «buscá a Ana Gómez» | **Buscar cita** · Busco «ana gomez». |
| 〃 | es | `/appointments` | «sacalo de ahí» | **Cerrar** · Listo, cerré: la búsqueda. |
| «close» cierra la búsqueda abierta | en | `/appointments` | «search Ana Gómez» | **Find appointment** · Searching for “ana gomez”. |
| 〃 | en | `/appointments` | «close» | **Close** · Done, I closed: the search. |
| «close the panel» cierra la búsqueda abierta | en | `/appointments` | «search Ana Gómez» | **Find appointment** · Searching for “ana gomez”. |
| 〃 | en | `/appointments` | «close the panel» | **Close** · Done, I closed: the search. |
| «hide it» cierra la búsqueda abierta | en | `/appointments` | «search Ana Gómez» | **Find appointment** · Searching for “ana gomez”. |
| 〃 | en | `/appointments` | «hide it» | **Close** · Done, I closed: the search. |
| «hide the panel» cierra la búsqueda abierta | en | `/appointments` | «search Ana Gómez» | **Find appointment** · Searching for “ana gomez”. |
| 〃 | en | `/appointments` | «hide the panel» | **Close** · Done, I closed: the search. |
| «I don't want to see that» cierra la búsqueda abierta | en | `/appointments` | «search Ana Gómez» | **Find appointment** · Searching for “ana gomez”. |
| 〃 | en | `/appointments` | «I don't want to see that» | **Close** · Done, I closed: the search. |
| AV-CLOSE-01 cierra lo de arriba primero: configuración antes que el panel de agendas | es | `/appointments` | «abrí el panel de agendas» | **Panel de agendas** · Listo, abrí el panel de agendas. |
| 〃 | es | `/appointments` | «abrí la configuración» | **Configuración de la agenda** · Listo, abrí la configuración. |
| 〃 | es | `/appointments` | «cerrá» | **Cerrar** · Listo, cerré: la configuración. |
| 〃 | es | `/appointments` | «cerrá» | **Cerrar** · Listo, cerré: el panel de agendas. |
| AV-CLOSE-02 «cerrá todo» cierra todo de una | es | `/appointments` | «abrí el panel de agendas» | **Panel de agendas** · Listo, abrí el panel de agendas. |
| 〃 | es | `/appointments` | «buscá a Ana Gómez» | **Buscar cita** · Busco «ana gomez». |
| 〃 | es | `/appointments` | «abrí la configuración» | **Configuración de la agenda** · Listo, abrí la configuración. |
| 〃 | es | `/appointments` | «cerrá todo» | **Cerrar** · Listo, cerré: la configuración, la búsqueda, el panel de agendas. |
| AV-CLOSE-03 «close everything» en inglés | en | `/appointments` | «open the calendars panel» | **Calendars panel** · Done, I opened the calendars panel. |
| 〃 | en | `/appointments` | «open the settings» | **Calendar settings** · Done, I opened the settings. |
| 〃 | en | `/appointments` | «close everything» | **Close** · Done, I closed: the settings, the calendars panel. |
| AV-CLOSE-04 cierra exportar y operaciones en lotes | es | `/appointments` | «exportá la agenda» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| 〃 | es | `/appointments` | «no» | **Exportar agenda** · Listo, no la exporté. |
| 〃 | es | `/appointments` | «cerrá todo» | **Cerrar** · Listo, cerré: operaciones en lotes. |
| AV-CLOSE-05 sin nada abierto lo dice | es | `/appointments` | «cerrá» | **Cerrar** · No hay nada abierto para cerrar. |
| AV-CLOSE-06 «atrás» con algo abierto lo cierra; sin nada, va para atrás en la agenda | es | `/appointments` | «buscá a Ana Gómez» | **Buscar cita** · Busco «ana gomez». |
| 〃 | es | `/appointments` | «volvé atrás» | **Cerrar** · Listo, cerré: la búsqueda. |
| 〃 | es | `/appointments` | «para atrás» | Calendario en lun 16/11. |

## AV-GAPS · Buscar huecos no es buscar citas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «buscar huecos» muestra los huecos | es | `/appointments` | «buscar huecos» | **Huecos · lun 23/11** · No hay huecos hoy . |
| «buscá huecos» muestra los huecos | es | `/appointments` | «buscá huecos» | **Huecos · lun 23/11** · No hay huecos hoy . |
| «buscame los huecos libres» muestra los huecos | es | `/appointments` | «buscame los huecos libres» | **Huecos · lun 23/11** · No hay huecos hoy . |
| «buscá horarios disponibles» muestra los huecos | es | `/appointments` | «buscá horarios disponibles» | **Huecos · lun 23/11** · No hay huecos hoy . |
| «encontrá un turno libre» muestra los huecos | es | `/appointments` | «encontrá un turno libre» | **Huecos · lun 23/11** · No hay huecos hoy . |
| «find slots» muestra los huecos | en | `/appointments` | «find slots» | **Gaps · Mon 23/11** · No gaps today . |
| «find free slots» muestra los huecos | en | `/appointments` | «find free slots» | **Gaps · Mon 23/11** · No gaps today . |
| «search for open slots» muestra los huecos | en | `/appointments` | «search for open slots» | **Gaps · Mon 23/11** · No gaps today . |
| «find available times» muestra los huecos | en | `/appointments` | «find available times» | **Gaps · Mon 23/11** · No gaps today . |
| «look for openings» muestra los huecos | en | `/appointments` | «look for openings» | **Gaps · Mon 23/11** · No gaps today . |
| «show me the gaps» muestra los huecos | en | `/appointments` | «show me the gaps» | **Gaps · Mon 23/11** · No gaps today . |

## AV-TOAST · Notificaciones con botones

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| una notificación con botones se lee y ofrece sus botones; «deshacer» lo aprieta | es | `/appointments` | «deshacer» | **Marcas aplicadas** · Listo, apreté «Deshacer». |
| por posición: «el segundo» | es | `/appointments` | «el segundo» | **Guardado** · Listo, apreté «Ver». |
| en «undo» | en | `/appointments` | «undo» | **Saved** · Done, I pressed “Undo”. |

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- AV-DLG · Elegir el botón de un aviso › «agendar igual» → Agendar igual
- AV-DLG · Elegir el botón de un aviso › «cancelar» → Cancelar
- AV-DLG · Elegir el botón de un aviso › «sí» → Agendar igual
- AV-DLG · Elegir el botón de un aviso › «no» → Cancelar
- AV-DLG · Elegir el botón de un aviso › «dale» → Agendar igual
- AV-DLG · Elegir el botón de un aviso › «continuar» → Agendar igual
- AV-DLG · Elegir el botón de un aviso › «volver» → Cancelar
- AV-DLG · Elegir el botón de un aviso › «el segundo» → Agendar igual
- AV-DLG · Elegir el botón de un aviso › «el primero» → Cancelar
- AV-DLG · Elegir el botón de un aviso › «sí, eliminar» → Sí, eliminar
- AV-DLG · Elegir el botón de un aviso › «eliminar» → Sí, eliminar
- AV-DLG · Elegir el botón de un aviso › «no volver» → No, volver
- AV-DLG · Elegir el botón de un aviso › «confirmar» → Sí, eliminar
- AV-DLG · Elegir el botón de un aviso › «solo esta» → Solo esta
- AV-DLG · Elegir el botón de un aviso › «esta y las siguientes» → Esta y las siguientes
- AV-DLG · Elegir el botón de un aviso › «todas» → Todas
- AV-DLG · Elegir el botón de un aviso › «la última» → Todas
- AV-DLG · Elegir el botón de un aviso › «la del medio» → Esta y las siguientes
- AV-DLG · Elegir el botón de un aviso › «yes» → Agendar igual
- AV-DLG · Elegir el botón de un aviso › «cancel» → Cancelar
- AV-DLG · Elegir el botón de un aviso › «go ahead» → Agendar igual
- AV-DLG · Elegir el botón de un aviso › «the second one» → Agendar igual
- AV-DLG · Elegir el botón de un aviso › algo que no es ningún botón: null (vuelve a preguntar)
- AV-STOP · Dejar de escuchar › apaga: «dejá de escuchar»
- AV-STOP · Dejar de escuchar › apaga: «deja de escuchar»
- AV-STOP · Dejar de escuchar › apaga: «pará de escuchar»
- AV-STOP · Dejar de escuchar › apaga: «pausá el dictado»
- AV-STOP · Dejar de escuchar › apaga: «pausar dictado»
- AV-STOP · Dejar de escuchar › apaga: «dejá de dictar»
- AV-STOP · Dejar de escuchar › apaga: «apagá el micrófono»
- AV-STOP · Dejar de escuchar › apaga: «apagar micrófono»
- AV-STOP · Dejar de escuchar › apaga: «desactivá la voz»
- AV-STOP · Dejar de escuchar › apaga: «no me escuches más»
- AV-STOP · Dejar de escuchar › apaga: «cortá el micrófono»
- AV-STOP · Dejar de escuchar › apaga: «detené el dictado»
- AV-STOP · Dejar de escuchar › apaga: «listo, dejá de escuchar»
- AV-STOP · Dejar de escuchar › apaga: «eso es todo»
- AV-STOP · Dejar de escuchar › apaga: «ya pará de escuchar por favor»
- AV-STOP · Dejar de escuchar › apaga: «stop listening»
- AV-STOP · Dejar de escuchar › apaga: «stop dictation»
- AV-STOP · Dejar de escuchar › apaga: «pause listening»
- AV-STOP · Dejar de escuchar › apaga: «turn off the mic»
- AV-STOP · Dejar de escuchar › apaga: «mute the microphone»
- AV-STOP · Dejar de escuchar › apaga: «mic off»
- AV-STOP · Dejar de escuchar › apaga: «that's all»
- AV-STOP · Dejar de escuchar › apaga: «you can stop listening»
- AV-STOP · Dejar de escuchar › no apaga: «pará»
- AV-STOP · Dejar de escuchar › no apaga: «cancelá la cita de Juan»
- AV-STOP · Dejar de escuchar › no apaga: «dejá fijo el panel»
- AV-STOP · Dejar de escuchar › no apaga: «pausá»
- AV-STOP · Dejar de escuchar › no apaga: «stop»
- AV-STOP · Dejar de escuchar › no apaga: «escuchá esto»
- AV-TOAST · Notificaciones con botones › si la notificación se va sola, la pregunta se saca
- AV-VERB · El botón por su verbo conjugado › «agrega un articulo» → Agregar Artículo
- AV-VERB · El botón por su verbo conjugado › «confirma» → Confirmar
- AV-VERB · El botón por su verbo conjugado › «guarda» → Guardar
- AV-VERB · El botón por su verbo conjugado › «add an item» → Add item

