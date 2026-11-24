# Con IA: planes de varios pasos

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/30-ai-plans-es.spec.ts`

Con IA: solo cuando hace falta, sinónimos, planes de varios pasos, relación con la tarea, formulario con IA.

**49 frases** en **27 pruebas que pasan** (es 49 · es-ES 0 · en 0 · 17 contestadas por la IA simulada). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## N3.0 · Solo se llama a la IA cuando hace falta

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-300 lo que entiende el intérprete local no llama a la IA | es | `/appointments` | «vista día» | **Calendario** · Listo, vista de día. |
| 〃 | es | `/appointments` | «más zoom» | Zoom al 110 %. |
| 〃 | es | `/appointments` | «qué agendas hay» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «la primera» | **Opciones** · Listo, solo Sillón 1. |
| 〃 | es | `/appointments` | «Juan Pérez llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «no» | **Estado de la cita** · Listo, no hice ningún cambio. |
| VZ-ES-301 la IA recibe la pantalla, el foco y la conversación (sin datos del paciente) | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «me gustaría la que viene más tarde de las dos» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |

## N3.1 · Sinónimos y formas que lo local no conoce

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-310 «agrandame un montón la grilla» → zoom | es | `/appointments` | «agrandame un montón la grilla que no veo nada» · IA | Zoom al 130 %. |
| VZ-ES-311 «que la columna de agendas no desaparezca» → fijar el panel | es | `/appointments` | «que la columna de agendas no desaparezca» · IA | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| VZ-ES-312 «quiero ver menos horas en la pantalla, de 9 a 5» → franja personalizada | es | `/appointments` | «quiero ver menos horas en la pantalla, de 9 a 5» · IA | **Configuración de la agenda** · Listo: franja de 09:00 a 17:00. |
| VZ-ES-313 «el sabadito y el domingo que no aparezcan» → ocultar días | es | `/appointments` | «el sabadito y el domingo que no aparezcan» · IA | **Configuración de la agenda** · Listo: ocultos: sábado, domingo. |
| VZ-ES-314 «Carlitos López ya está en la sala» → estado llegó (confirma) | es | `/appointments` | «Carlitos López ya está en la sala» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Llegó. |
| VZ-ES-315 la IA no puede inventar ids: un doctor que no está se descarta | es | `/appointments` | «quiero ver nada más lo que atiende el doctor house» · IA | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá al jueves», «¿qué tengo mañana?», «Ana Gómez llegó», «nueva cita para Ana Gómez el lunes a las 10», «poné la cita de Ana en rojo», «bloqueá el lunes de 14 a 16» o «recordame mañana a l… |
| VZ-ES-315b un doctor que no está, dicho como filtro: lo dice y no filtra | es | `/appointments` | «mostrame solo lo del doctor house» | **Filtros del calendario** · No encontré «house» entre los doctores, agendas ni sedes. |
| VZ-ES-316 confianza baja: no adivina | es | `/appointments` | «hacé la cosa esa de antes» · IA | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá al jueves», «¿qué tengo mañana?», «Ana Gómez llegó», «nueva cita para Ana Gómez el lunes a las 10», «poné la cita de Ana en rojo», «bloqueá el lunes de 14 a 16» o «recordame mañana a l… |

## N3.2 · Planes de varios pasos

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-320 «la cita de Juan, marcala como llegó y abrí su cuenta» → 3 pasos con el foco | es | `/appointments` | «la cita de Juan, marcala como llegó y abrí su cuenta» · IA | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de cuenta** · Abrí Estado de cuenta de Juan Pérez. |
| VZ-ES-321 «editá la cita de Carlos, ponele la doctora Ruiz y limpieza, y guardá» | es | `/appointments` | «editá la cita de Carlos, ponele la doctora Ruiz y limpieza» · IA | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «guardá» | **Editar cita** · Listo, cita actualizada. |
| VZ-ES-322 configurar varias cosas de una: «vista semana por defecto, slots de 15, colores por estado y sin sábados» | es | `/appointments` | «dejame la agenda en semana por defecto con slots de 15, colorcitos por estado y sin sábados por favor» · IA | **Configuración de la agenda** · Listo: ocultos: sábado. |
| VZ-ES-323 «andá a mañana, vista día y mostrame los huecos de la tarde» | es | `/appointments` | «andá a mañana, poneme día y mostrame los huecos de la tarde y listo» · IA | **Huecos · mar 24/11** · No hay huecos mañana a la tarde. |
| VZ-ES-324 un paso que falla frena el plan y avisa dónde | es | `/appointments` | «la cita del paciente inventado, marcala como llegó» · IA | **Comando de voz** · No pude completar todos los pasos: me frené en «1/2». Lo anterior quedó hecho. ¿Seguimos con otra cosa? |
| VZ-ES-325 exportar con todo dicho: «bajame en excel la semana que viene de Pocitos» | es | `/appointments` | «bajame en excel lo de la semana que viene de pocitos» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| 〃 | es | `/appointments` | «sí» | **Exportar agenda** · Listo, se descargó la agenda. |

## N3.3 · Relación con la tarea en curso

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-330 respuesta larga a «¿cuál?» la entiende la IA («la de la que viene más tarde») | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «me gustaría la que viene más tarde de las dos» · IA | **Cita** · La cita de Ana Martínez, hoy a las 10:30. |
| VZ-ES-331 charla de la sala en medio de una pregunta se ignora y la pregunta sigue | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «María traeme un café cuando puedas por favor» · IA | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «la primera» | **Cita** · La cita de Ana Gómez, hoy a las 09:00. |
| VZ-ES-332 herramienta dicha raro en medio: «dejame ver cómo viene el jueves» (aux) | es | `/appointments` | «Juan Pérez llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «dejame ver primero cómo viene el día» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |
| VZ-ES-333 «no, dejá, ya fue» (cancelar) lo dice la IA | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «no no dejá eso ya fue» | **Cita** · Listo, no hice ningún cambio. |
| VZ-ES-334 un pedido nuevo largo con una pregunta abierta pregunta si se deja | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «poneme un recordatorio para mañana a las nueve de llamar al laboratorio» | **¿Cambiamos de tarea?** · Estábamos con «la cita de Ana». ¿Lo dejo para hacer «poneme un recordatorio para mañana a las nueve de llamar al laboratorio»? |

## N3.4 · Formulario con IA

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-340 «que dure lo mismo pero arranque media hora después» → form_set | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «que dure lo mismo pero arranque media hora después» · IA | **Editar cita** · Listo: hoy a las 10:30, termina a las 11:00. ¿La guardo? |
| VZ-ES-341 «sacale lo que tenga y dejá solo control» → form_set con servicios | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «agregá limpieza» | **Editar cita** · Listo: tratamientos: Limpieza. ¿La guardo? |
| 〃 | es | `/appointments` | «dejale solo control» | **Editar cita** · Listo: tratamientos: Control. ¿La guardo? |
| VZ-ES-342 «dale mandale nomás» → guardar (form_save) | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «mandale nomás así como está» · IA | **Editar cita** · Listo, cita actualizada. |

## N3.5 · Pacientes con IA

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-350 «¿la de las 3 tiene algo pendiente de pagar?» → la deuda del paciente de esa cita | es | `/appointments` | «la cita de las 3» | **Cita** · La cita de Carlos López, hoy a las 15:00. |
| 〃 | es | `/appointments` | «tiene algo pendiente de pagar» | Información del paciente |
| VZ-ES-350b con IA: «¿cómo viene de plata el de las 3?» → patient_info debt | es | `/appointments` | «el de las 3 está complicado con la guita» · IA | Información del paciente |
| VZ-ES-351 «traeme la ficha de la señora Castro» → buscar paciente | es | `/appointments` | «traeme la ficha de la señora Castro» · IA | **Buscar paciente** · Listo, abrí la ficha de Sofía Castro. |

