# Encadenados

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/20-chained-es.spec.ts`

Encadenados: foco, herramientas en el medio, cambio de tema, cancelar, elegir de muchas formas.

**66 frases** en **24 pruebas que pasan** (es 66 · es-ES 0 · en 0). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## N2.1 · Foco: elegida una cita, todo actúa sobre ella

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-200 seleccionar → «marcala como llegó» → «sí» | es | `/appointments` | «la cita de Carlos López» | **Cita** · La cita de Carlos López, hoy a las 15:00. |
| 〃 | es | `/appointments` | «marcala como llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Llegó. |
| VZ-ES-201 seleccionar → «abrí su cuenta» → «ponela en verde» → «sí» | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «abrí su cuenta» | **Estado de cuenta** · Abrí Estado de cuenta de Juan Pérez. |
| 〃 | es | `/appointments` | «ponela en verde» | **Color de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Color de la cita** · Listo, la cita de Juan Pérez quedó en verde. |
| VZ-ES-202 elegida entre dos «Ana», el foco sigue en la elegida | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «la de las 10 y media» | **Cita** · La cita de Ana Martínez, hoy a las 10:30. |
| 〃 | es | `/appointments` | «no vino» | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Ana Martínez quedó en No asistió. |
| VZ-ES-203 seleccionar → «editala» → cambiar doctor → «guardar» | es | `/appointments` | «la cita de Carlos López» | **Cita** · La cita de Carlos López, hoy a las 15:00. |
| 〃 | es | `/appointments` | «editala» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «con la doctora Ruiz» | **Editar cita** · Listo: con Dra. Laura Ruiz. ¿La guardo? |
| 〃 | es | `/appointments` | «guardar» | **Editar cita** · Listo, cita actualizada. |
| VZ-ES-204 seleccionar → «borrala» → «sí» | es | `/appointments` | «la cita de Carlos López» | **Cita** · La cita de Carlos López, hoy a las 15:00. |
| 〃 | es | `/appointments` | «borrala» | **Borrar cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Borrar cita** · Listo, borré la cita de Carlos López. |
| VZ-ES-205 nombrar otra cita cambia el foco | es | `/appointments` | «la cita de Carlos López» | **Cita** · La cita de Carlos López, hoy a las 15:00. |
| 〃 | es | `/appointments` | «Juan Pérez llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |

## N2.2 · Herramientas en el medio de una pregunta (no cancelan)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-210 eligiendo entre dos «Ana», «más zoom» se hace y la pregunta sigue | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «poné más zoom por favor» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «la primera» | **Cita** · La cita de Ana Gómez, hoy a las 09:00. |
| VZ-ES-211 confirmando un estado, «andá a mañana» no lo cancela | es | `/appointments` | «Juan Pérez llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «andá al día de mañana por favor» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |
| VZ-ES-212 en el editor, «más zoom» no es una corrección del formulario… pero el formulario sigue abierto | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «poné más zoom por favor» | **Editar cita** · Decí «sí» para guardarla, «no» para dejarla abierta, o qué cambiar, por ejemplo «con el doctor Pérez» o «agregá limpieza». |
| 〃 | es | `/appointments` | «guardar» | **Editar cita** · Listo, cita actualizada. |

## N2.3 · Cambio de tema y cancelar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-220 con una pregunta abierta, un pedido nuevo pregunta si se deja; «sí» hace lo nuevo | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «exportá la agenda de la semana que viene» | **¿Cambiamos de tarea?** · Estábamos con «la cita de Ana». ¿Lo dejo para hacer «exportá la agenda de la semana que viene»? |
| 〃 | es | `/appointments` | «sí» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| VZ-ES-221 «no» vuelve a la pregunta que estaba | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «exportá la agenda de la semana que viene» | **¿Cambiamos de tarea?** · Estábamos con «la cita de Ana». ¿Lo dejo para hacer «exportá la agenda de la semana que viene»? |
| 〃 | es | `/appointments` | «no» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «la segunda» | **Cita** · La cita de Ana Martínez, hoy a las 10:30. |
| VZ-ES-222 en el editor, un pedido de otra cosa pregunta si se deja el formulario | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «exportá la agenda de mañana» | **¿Cambiamos de tarea?** · Estábamos con «editá la cita de Juan Pérez». ¿Lo dejo para hacer «exportá la agenda de mañana»? |
| 〃 | es | `/appointments` | «sí» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| VZ-ES-223 «cancelá» corta la tarea en curso | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «cancelá» | **Comando de voz** · Listo, lo dejé. |
| VZ-ES-224 «olvidalo» en una confirmación no cambia nada | es | `/appointments` | «Carlos López no vino» | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «olvidalo» | **Comando de voz** · Listo, lo dejé. |
| VZ-ES-225 «sigamos» repite la pregunta abierta | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «sigamos» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |

## N2.4 · Elegir entre opciones de varias formas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-230 «la uno» | es | `/appointments` | «qué agendas hay» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «la uno» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| VZ-ES-231 «la tercera» | es | `/appointments` | «qué agendas hay» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «la tercera» | **Opciones** · Listo, solo Ortodoncia. |
| VZ-ES-232 «la última» | es | `/appointments` | «qué agendas hay» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «la última» | **Opciones** · Listo, solo Ortodoncia. |
| VZ-ES-233 «la penúltima» | es | `/appointments` | «qué agendas hay» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «la penúltima» | **Opciones** · Listo, solo Sillón 2. |
| VZ-ES-234 «la de arriba» | es | `/appointments` | «qué agendas hay» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «la de arriba» | **Opciones** · Listo, solo Sillón 1. |
| VZ-ES-235 «la del medio» | es | `/appointments` | «qué agendas hay» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «la del medio» | **Opciones** · Listo, solo Sillón 2. |
| VZ-ES-236 por nombre «ortodoncia» | es | `/appointments` | «qué agendas hay» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «ortodoncia» | **Opciones** · Listo, solo Ortodoncia. |
| VZ-ES-237 empate «sillón» pregunta solo entre los dos sillones | es | `/appointments` | «qué agendas hay» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «el sillón» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2] |
| 〃 | es | `/appointments` | «el 2» | **Opciones** · Listo, solo Sillón 2. |
| VZ-ES-238 una respuesta que no es ninguna vuelve a preguntar y «no» deja todo igual | es | `/appointments` | «qué agendas hay» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «la azul» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «no» | **Opciones** · Listo, no hice ningún cambio. |

