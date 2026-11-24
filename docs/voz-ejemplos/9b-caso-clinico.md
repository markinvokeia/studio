# Caso clínico (agente clínico)

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/9b-clinical-agent.spec.ts`

Caso clínico en Mi consultorio: con la cita elegida, lo pedido va al agente clínico (resumen, preguntas, dictar la sesión, guardar o revisar, odontograma); lo de la pantalla sigue siendo de la página; cerrar y volver al caso; la charla de la sala no se manda.

**117 frases** en **50 pruebas que pasan** (es 95 · es-ES 10 · en 12). Pantallas: `/workspace`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## CC-CASE · El caso es el paciente elegido

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| al elegir la cita queda marcado el caso clínico | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| sin cita elegida no hay caso: la pregunta no va al agente | es | `/workspace` | «qué alergias tiene» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «¿quién sigue?», «el de las 10», «nueva sesión» o «recetá». |
| otra cita: otro caso (y la pregunta va con esa cita) | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «qué alergias tiene» | **Caso clínico** · Alérgica a la penicilina. |

## CC-ASK · Preguntas y resúmenes al agente clínico

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «dame un resumen del paciente» va al agente con la cita elegida | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «dame un resumen del paciente» | **Caso clínico** · Ana Gómez: limpieza hace 6 meses; restauración pendiente en el 16. |
| es «qué alergias tiene» va al agente con la cita elegida | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «qué alergias tiene» | **Caso clínico** · Alérgica a la penicilina. |
| es «¿Qué le hice la última vez?» va al agente con la cita elegida | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «¿Qué le hice la última vez?» | **Caso clínico** · Preparé la sesión: limpieza y restauración en el 16. ¿La guardo o preferís revisarla? |
| es «resumime el caso» va al agente con la cita elegida | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «resumime el caso» | **Caso clínico** · Ana Gómez: limpieza hace 6 meses; restauración pendiente en el 16. |
| es «qué le toca hoy» va al agente con la cita elegida | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «qué le toca hoy» | **Caso clínico** · Sin novedades para este paciente. |
| es «tiene alguna deuda» va al agente con la cita elegida | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «tiene alguna deuda» | **Caso clínico** · Sin novedades para este paciente. |
| es-ES «dame un resumen de la paciente» va al agente con la cita elegida | es-ES | `/workspace` | «el de las 9» | **Mi consultorio** · He abierto la cita de las 09:00: Ana Gómez. |
| 〃 | es-ES | `/workspace` | «dame un resumen de la paciente» | **Caso clínico** · Ana Gómez: limpieza hace 6 meses; restauración pendiente en el 16. |
| es-ES «¿qué alergias tiene?» va al agente con la cita elegida | es-ES | `/workspace` | «el de las 9» | **Mi consultorio** · He abierto la cita de las 09:00: Ana Gómez. |
| 〃 | es-ES | `/workspace` | «¿qué alergias tiene?» | **Caso clínico** · Alérgica a la penicilina. |
| en «give me a summary of the patient» va al agente con la cita elegida | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «give me a summary of the patient» | **Clinical case** · Ana Gómez: limpieza hace 6 meses; restauración pendiente en el 16. |
| en «does she have any allergies» va al agente con la cita elegida | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «does she have any allergies» | **Clinical case** · Sin novedades para este paciente. |
| en «what did we do last time» va al agente con la cita elegida | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «what did we do last time» | **Clinical case** · Preparé la sesión: limpieza y restauración en el 16. ¿La guardo o preferís revisarla? |
| la respuesta se muestra y se lee | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «qué alergias tiene» | **Caso clínico** · Alérgica a la penicilina. |
| el resumen | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «dame un resumen» | **Caso clínico** · Ana Gómez: limpieza hace 6 meses; restauración pendiente en el 16. |
| si el agente no contesta, lo dice | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «qué alergias tiene» | **Caso clínico** · El agente clínico no contestó. Probá de nuevo. |
| lo que no se pudo hacer se muestra (el motivo de la pantalla) | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «le hice una limpieza» | **Caso clínico** · Abro la sesión. La sesión solo se puede completar el día de la cita. |

## CC-SESSION · Dictar la sesión, guardar o revisar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| el dictado va entero (aunque tenga varias partes) y el agente pregunta: «guardala» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «hice una limpieza y una restauración en el 16, próxima cita control en 6 meses» | **Caso clínico** · Preparé la sesión: limpieza y restauración en el 16. ¿La guardo o preferís revisarla? |
| 〃 | es | `/workspace` | «guardala» | **Caso clínico** · Guardé la sesión. |
| «revisala» abre la sesión para revisar | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «le hice una limpieza» | **Caso clínico** · Preparé la sesión: limpieza y restauración en el 16. ¿La guardo o preferís revisarla? |
| 〃 | es | `/workspace` | «revisala» | **Caso clínico** · Abrí la sesión para que la revises. |
| «sí» como respuesta va al agente | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «le hice una limpieza» | **Caso clínico** · Preparé la sesión: limpieza y restauración en el 16. ¿La guardo o preferís revisarla? |
| 〃 | es | `/workspace` | «sí» | **Caso clínico** · Guardé la sesión. |
| «completá la sesión: hice una limpieza…» con lo dictado va al agente (no abre la sesión vacía) | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «completá la sesión hice una limpieza en el 16» | **Caso clínico** · Preparé la sesión: limpieza y restauración en el 16. ¿La guardo o preferís revisarla? |
| «abrí el odontograma y marcá caries en el 16» lo arma el agente | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «abrí el odontograma y marcá caries en el 16» | **Caso clínico** · Abrí el odontograma con caries en el 16. |
| es-ES «le he hecho una limpieza» y «guárdala» | es-ES | `/workspace` | «el de las 9» | **Mi consultorio** · He abierto la cita de las 09:00: Ana Gómez. |
| 〃 | es-ES | `/workspace` | «le he hecho una limpieza» | **Caso clínico** · Preparé la sesión: limpieza y restauración en el 16. ¿La guardo o preferís revisarla? |
| 〃 | es-ES | `/workspace` | «guárdala» | **Caso clínico** · Guardé la sesión. |
| en «I did a cleaning on 16» then «save it» | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «I did a cleaning on 16» | **Clinical case** · Preparé la sesión: limpieza y restauración en el 16. ¿La guardo o preferís revisarla? |
| 〃 | en | `/workspace` | «save it» | **Clinical case** · Saved the session. |

## CC-SCREEN · Lo de la pantalla sigue siendo de la página

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «hacele una receta» lo hace la pantalla con el paciente del caso | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «hacele una receta» | **Mi consultorio** · Abrí la receta para Ana Gómez. |
| «nueva orden de laboratorio» lo hace la pantalla con el paciente del caso | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «nueva orden de laboratorio» | **Mi consultorio** · Abrí una orden de laboratorio para Ana Gómez. |
| «abrí el periodontograma» lo hace la pantalla con el paciente del caso | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «abrí el periodontograma» | **Mi consultorio** · Abrí el periodontograma de Ana Gómez. |
| «una sesión estética» lo hace la pantalla con el paciente del caso | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «una sesión estética» | **Mi consultorio** · Abrí una sesión estética para Ana Gómez. |
| «abrí la ficha» lo hace la pantalla con el paciente del caso | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «abrí la ficha» | **Mi consultorio** · Abrí la ficha de Ana Gómez. |
| «completá la sesión clínica» lo hace la pantalla con el paciente del caso | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «completá la sesión clínica» | **Mi consultorio** · Abrí la sesión clínica de Ana Gómez. |
| «el de las 10» cambia de paciente (y de caso) | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |

## CC-CLOSE · Cerrar el caso

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| lo que no es del caso pregunta antes de cerrarlo; «no» se queda | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «decime el clima de mañana» | **Caso clínico** · Eso no es del paciente. Eso no parece del caso de Ana Gómez. ¿Cierro el caso clínico y lo hago aparte? |
| 〃 | es | `/workspace` | «no» | **Caso clínico** · Eso no es del paciente. |
| «sí» lo cierra (y ya no se pregunta al agente) | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «decime el clima de mañana» | **Caso clínico** · Eso no es del paciente. Eso no parece del caso de Ana Gómez. ¿Cierro el caso clínico y lo hago aparte? |
| 〃 | es | `/workspace` | «sí» | **Caso clínico** · Cerré el caso de Ana Gómez, pero no entendí qué hacer. Decímelo de otra forma. |
| 〃 | es | `/workspace` | «qué alergias tiene» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «¿quién sigue?», «el de las 10», «nueva sesión» o «recetá». |
| «cerrá el caso» y «volvé al caso» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «cerrá el caso» | **Caso clínico** · Cerré el caso de Ana Gómez. Lo que pidas ya no es de ese paciente; decí «volvé al caso» para retomarlo. |
| 〃 | es | `/workspace` | «volvé al caso» | **Caso clínico** · Volví al caso de Ana Gómez. |
| 〃 | es | `/workspace` | «qué alergias tiene» | **Caso clínico** · Alérgica a la penicilina. |
| cerrado, elegir otra cita abre ese caso | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «cerrá el caso» | **Caso clínico** · Cerré el caso de Ana Gómez. Lo que pidas ya no es de ese paciente; decí «volvé al caso» para retomarlo. |
| 〃 | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es-ES «cierra el caso» / «vuelve al caso» | es-ES | `/workspace` | «el de las 9» | **Mi consultorio** · He abierto la cita de las 09:00: Ana Gómez. |
| 〃 | es-ES | `/workspace` | «cierra el caso» | **Caso clínico** · He cerrado el caso de Ana Gómez. Lo que pidas ya no es de ese paciente; di «vuelve al caso» para retomarlo. |
| 〃 | es-ES | `/workspace` | «vuelve al caso» | **Caso clínico** · He vuelto al caso de Ana Gómez. |
| en «close the case» / «back to the case» | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «close the case» | **Clinical case** · I closed Ana Gómez's case. What you ask is no longer about that patient; say “back to the case” to resume it. |
| 〃 | en | `/workspace` | «back to the case» | **Clinical case** · Back to Ana Gómez's case. |

## CC-ROOM · La charla de la sala no va al agente

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «bueno bueno» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «bueno bueno» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «¿quién sigue?», «el de las 10», «nueva sesión» o «recetá». |
| «muy bien así» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «muy bien así» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «¿quién sigue?», «el de las 10», «nueva sesión» o «recetá». |
| «aguantá un poquito» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «aguantá un poquito» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «¿quién sigue?», «el de las 10», «nueva sesión» o «recetá». |

## CC-CARD · La respuesta se lee con calma y con formato

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| la respuesta del agente no se esconde sola y viene con formato | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «dame un resumen» | **Caso clínico** · Ana Gómez: limpieza hace 6 meses; restauración pendiente en el 16. |
| «gracias» cierra la respuesta fija (y el caso sigue abierto) | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «dame un resumen» | **Caso clínico** · Ana Gómez: limpieza hace 6 meses; restauración pendiente en el 16. |
| 〃 | es | `/workspace` | «gracias» | — |
| «cerrá» cierra la respuesta fija (y el caso sigue abierto) | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «dame un resumen» | **Caso clínico** · Ana Gómez: limpieza hace 6 meses; restauración pendiente en el 16. |
| 〃 | es | `/workspace` | «cerrá» | — |
| «listo» cierra la respuesta fija (y el caso sigue abierto) | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «dame un resumen» | **Caso clínico** · Ana Gómez: limpieza hace 6 meses; restauración pendiente en el 16. |
| 〃 | es | `/workspace` | «listo» | — |
| «ok gracias» cierra la respuesta fija (y el caso sigue abierto) | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «dame un resumen» | **Caso clínico** · Ana Gómez: limpieza hace 6 meses; restauración pendiente en el 16. |
| 〃 | es | `/workspace` | «ok gracias» | — |
| «thanks» cierra la respuesta fija (y el caso sigue abierto) | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «dame un resumen» | **Caso clínico** · Ana Gómez: limpieza hace 6 meses; restauración pendiente en el 16. |
| 〃 | es | `/workspace` | «thanks» | — |

## CC-OVERLAY · Con una ventana abierta, lo suyo no va al agente

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cancelar» con la receta abierta aprieta Cancelar (no le pregunta al agente) | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «cancelar» | **Comando de voz** · Listo, apreté «Cancelar». |
| «la dosis es 400 mg» con la receta abierta va al campo | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «la dosis es 400 mg» | **Comando de voz** · Listo: «Dosis» = 400 mg. |
| una pregunta del paciente con la receta abierta sí va al agente | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «qué alergias tiene» | **Caso clínico** · Alérgica a la penicilina. |

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- CC-CARD · La respuesta se lee con calma y con formato › markdown: negritas, listas y títulos sin los símbolos
- CC-CARD · La respuesta se lee con calma y con formato › para leer en voz alta, sin asteriscos ni numerales

