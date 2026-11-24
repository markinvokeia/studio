# Más variantes

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/72-variants-more.spec.ts`

Más variantes es/en: menú de la cita, recordatorios, bloqueos, exportar y cada corrección del editor.

**196 frases** en **119 pruebas que pasan** (es 114 · es-ES 0 · en 82). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## V-ES-MENU · borrar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «borrá la cita de Carlos López» | es | `/appointments` | «borrá la cita de Carlos López» | **Borrar cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Borrar cita** · Listo, borré la cita de Carlos López. |
| «eliminá la cita de Carlos López» | es | `/appointments` | «eliminá la cita de Carlos López» | **Borrar cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Borrar cita** · Listo, borré la cita de Carlos López. |
| «borrá el turno de Carlos López» | es | `/appointments` | «borrá el turno de Carlos López» | **Borrar cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Borrar cita** · Listo, borré la cita de Carlos López. |
| «eliminá la de las 3» | es | `/appointments` | «eliminá la de las 3» | **Borrar cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Borrar cita** · Listo, borré la cita de Carlos López. |

## V-EN-MENU · delete

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «delete Carlos López's appointment» | en | `/appointments` | «delete Carlos López's appointment» | **Delete appointment** · Careful: check it is the right appointment. “Yes” changes it, “no” leaves it as it is. |
| 〃 | en | `/appointments` | «yes» | **Delete appointment** · Done, I deleted Carlos López’s appointment. |
| «delete the appointment at 3» | en | `/appointments` | «delete the appointment at 3» | **Delete appointment** · Careful: check it is the right appointment. “Yes” changes it, “no” leaves it as it is. |
| 〃 | en | `/appointments` | «yes» | **Delete appointment** · Done, I deleted Carlos López’s appointment. |
| «remove Carlos López's appointment» | en | `/appointments` | «remove Carlos López's appointment» | **Delete appointment** · Careful: check it is the right appointment. “Yes” changes it, “no” leaves it as it is. |
| 〃 | en | `/appointments` | «yes» | **Delete appointment** · Done, I deleted Carlos López’s appointment. |

## V-ES-MENU · color

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «poné la cita de Juan Pérez en rojo» | es | `/appointments` | «poné la cita de Juan Pérez en rojo» | **Color de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Color de la cita** · Listo, la cita de Juan Pérez quedó en rojo. |
| «pintá de verde la cita de Juan Pérez» | es | `/appointments` | «pintá de verde la cita de Juan Pérez» | **Color de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Color de la cita** · Listo, la cita de Juan Pérez quedó en verde. |
| «la cita de Juan Pérez en azul» | es | `/appointments` | «la cita de Juan Pérez en azul» | **Color de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Color de la cita** · Listo, la cita de Juan Pérez quedó en azul. |
| «cambiá el color de la cita de Juan Pérez a amarillo» | es | `/appointments` | «cambiá el color de la cita de Juan Pérez a amarillo» | **Color de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Color de la cita** · Listo, la cita de Juan Pérez quedó en amarillo. |

## V-EN-MENU · color

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «make Juan Pérez's appointment red» | en | `/appointments` | «make Juan Pérez's appointment red» | **Appointment color** · Say “yes” to do it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment color** · Done, Juan Pérez’s appointment is now red. |
| «paint Juan Pérez's appointment green» | en | `/appointments` | «paint Juan Pérez's appointment green» | **Appointment color** · Say “yes” to do it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment color** · Done, Juan Pérez’s appointment is now green. |
| «change the color of Juan Pérez's appointment to yellow» | en | `/appointments` | «change the color of Juan Pérez's appointment to yellow» | **Appointment color** · Say “yes” to do it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment color** · Done, Juan Pérez’s appointment is now yellow. |

## V-ES-MENU · doctor

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «pasá la cita de Juan Pérez al doctor Gómez» | es | `/appointments` | «pasá la cita de Juan Pérez al doctor Gómez» | **Cambiar doctor** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Cambiar doctor** · Listo, la cita de Juan Pérez quedó con Dr. Pablo Gómez. |
| «asigná la cita de Juan Pérez al doctor Gómez» | es | `/appointments` | «asigná la cita de Juan Pérez al doctor Gómez» | **Cambiar doctor** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Cambiar doctor** · Listo, la cita de Juan Pérez quedó con Dr. Pablo Gómez. |
| «cambiá el doctor de la cita de Juan Pérez al doctor Gómez» | es | `/appointments` | «cambiá el doctor de la cita de Juan Pérez al doctor Gómez» | **Cambiar doctor** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Cambiar doctor** · Listo, la cita de Juan Pérez quedó con Dr. Pablo Gómez. |
| «que a Juan Pérez lo atienda el doctor Gómez» | es | `/appointments` | «que a Juan Pérez lo atienda el doctor Gómez» | **Cambiar doctor** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Cambiar doctor** · Listo, la cita de Juan Pérez quedó con Dr. Pablo Gómez. |

## V-EN-MENU · doctor

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «assign Juan Pérez's appointment to doctor Gómez» | en | `/appointments` | «assign Juan Pérez's appointment to doctor Gómez» | **Change doctor** · Say “yes” to do it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Change doctor** · Done, Juan Pérez’s appointment is now with Dr. Pablo Gómez. |
| «move Juan Pérez's appointment to doctor Gómez» | en | `/appointments` | «move Juan Pérez's appointment to doctor Gómez» | **Change doctor** · Say “yes” to do it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Change doctor** · Done, Juan Pérez’s appointment is now with Dr. Pablo Gómez. |

## V-ES-MENU · duración

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «que la cita de Juan Pérez dure 45 minutos» | es | `/appointments` | «que la cita de Juan Pérez dure 45 minutos» | **Duración de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Duración de la cita** · Listo, la cita de Juan Pérez termina a las 10:45. |
| «alargá la cita de Juan Pérez a una hora» | es | `/appointments` | «alargá la cita de Juan Pérez a una hora» | **Duración de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Duración de la cita** · Listo, la cita de Juan Pérez termina a las 11:00. |
| «acortá la cita de Juan Pérez a 15 minutos» | es | `/appointments` | «acortá la cita de Juan Pérez a 15 minutos» | **Duración de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Duración de la cita** · Listo, la cita de Juan Pérez termina a las 10:15. |
| «la cita de Juan Pérez que dure una hora y media» | es | `/appointments` | «la cita de Juan Pérez que dure una hora y media» | **Duración de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Duración de la cita** · Listo, la cita de Juan Pérez termina a las 11:30. |

## V-EN-MENU · duration

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «make Juan Pérez's appointment 45 minutes» | en | `/appointments` | «make Juan Pérez's appointment 45 minutes» | **Appointment length** · Say “yes” to do it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment length** · Done, Juan Pérez’s appointment ends at 10:45. |
| «extend Juan Pérez's appointment to one hour» | en | `/appointments` | «extend Juan Pérez's appointment to one hour» | **Appointment length** · Say “yes” to do it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment length** · Done, Juan Pérez’s appointment ends at 11:00. |

## V-ES-MENU · mover

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «pasá la cita de Juan Pérez al viernes a las 11» | es | `/appointments` | «pasá la cita de Juan Pérez al viernes a las 11» | **Reprogramar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| «reprogramá la cita de Juan Pérez para pasado mañana» | es | `/appointments` | «reprogramá la cita de Juan Pérez para pasado mañana» | **Reprogramar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| «mové la cita de Juan Pérez a las 4» | es | `/appointments` | «mové la cita de Juan Pérez a las 4» | **Reprogramar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| «corré la cita de Juan Pérez para mañana» | es | `/appointments` | «corré la cita de Juan Pérez para mañana» | **Reprogramar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |

## V-EN-MENU · move

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «move Juan Pérez's appointment to Friday at 11» | en | `/appointments` | «move Juan Pérez's appointment to Friday at 11» | **Reschedule appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| «reschedule Juan Pérez's appointment for the day after tomorrow» | en | `/appointments` | «reschedule Juan Pérez's appointment for the day after tomorrow» | **Reschedule appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| «move Juan Pérez's appointment to 4» | en | `/appointments` | «move Juan Pérez's appointment to 4» | **Reschedule appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |

## V-ES-MENU · abrir

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «abrí la historia clínica de Juan Pérez» | es | `/appointments` | «abrí la historia clínica de Juan Pérez» | **Historia clínica** · Abrí Historia clínica de Juan Pérez. |
| «mostrame la historia de Juan Pérez» | es | `/appointments` | «mostrame la historia de Juan Pérez» | **Historia clínica** · Abrí Historia clínica de Juan Pérez. |
| «abrí los archivos de Juan Pérez» | es | `/appointments` | «abrí los archivos de Juan Pérez» | **Imágenes y archivos** · Abrí Imágenes y archivos de Juan Pérez. |
| «mostrame las radiografías de Juan Pérez» | es | `/appointments` | «mostrame las radiografías de Juan Pérez» | **Imágenes y archivos** · Abrí Imágenes y archivos de Juan Pérez. |
| «abrí el estado de cuenta de Juan Pérez» | es | `/appointments` | «abrí el estado de cuenta de Juan Pérez» | **Estado de cuenta** · Abrí Estado de cuenta de Juan Pérez. |
| «mostrame la cuenta corriente de Juan Pérez» | es | `/appointments` | «mostrame la cuenta corriente de Juan Pérez» | **Estado de cuenta** · Abrí Estado de cuenta de Juan Pérez. |
| «abrí el historial de citas de Juan Pérez» | es | `/appointments` | «abrí el historial de citas de Juan Pérez» | **Historial de citas** · Abrí Historial de citas de Juan Pérez. |
| «mostrame los datos de Juan Pérez» | es | `/appointments` | «mostrame los datos de Juan Pérez» | **Datos del paciente** · Abrí Datos del paciente de Juan Pérez. |

## V-EN-MENU · open

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «open Juan Pérez's medical history» | en | `/appointments` | «open Juan Pérez's medical history» | **Clinical history** · I opened Clinical history for Juan Pérez. |
| «show Juan Pérez's files» | en | `/appointments` | «show Juan Pérez's files» | **Images and files** · I opened Images and files for Juan Pérez. |
| «open Juan Pérez's account statement» | en | `/appointments` | «open Juan Pérez's account statement» | **Account statement** · I opened Account statement for Juan Pérez. |
| «show Juan Pérez's appointment history» | en | `/appointments` | «show Juan Pérez's appointment history» | **Appointment history** · I opened Appointment history for Juan Pérez. |
| «open Juan Pérez's patient details» | en | `/appointments` | «open Juan Pérez's patient details» | **Patient details** · I opened Patient details for Juan Pérez. |

## V-ES-REMINDER

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «recordame mañana a las 9 llamar al laboratorio» | es | `/appointments` | «recordame mañana a las 9 llamar al laboratorio» | **Nuevo recordatorio** · Decí «sí» para guardarlo, «no» para cancelar, otra hora o «que diga…» para cambiar el texto. |
| «nuevo recordatorio para el viernes a las 10 pedir materiales» | es | `/appointments` | «nuevo recordatorio para el viernes a las 10 pedir materiales» | **Nuevo recordatorio** · Decí «sí» para guardarlo, «no» para cancelar, otra hora o «que diga…» para cambiar el texto. |
| «anotá una nota para mañana que falta material» | es | `/appointments` | «anotá una nota para mañana que falta material» | **Nueva nota** · ¿A qué hora? |
| 〃 | es | `/appointments` | «a las 9» | **Nueva nota** · Decí «sí» para guardarlo, «no» para cancelar, otra hora o «que diga…» para cambiar el texto. |

## V-EN-REMINDER

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «remind me tomorrow at 9 to call the lab» | en | `/appointments` | «remind me tomorrow at 9 to call the lab» | **New reminder** · Say “yes” to save it, “no” to cancel, another time, or “saying…” to change the text. |
| «new reminder for Friday at 10 order supplies» | en | `/appointments` | «new reminder for Friday at 10 order supplies» | **New reminder** · Say “yes” to save it, “no” to cancel, another time, or “saying…” to change the text. |
| «new note for tomorrow missing material» | en | `/appointments` | «new note for tomorrow missing material» | **New note** · At what time? |
| 〃 | en | `/appointments` | «a las 9» | **New note** · Say “yes” to save it, “no” to cancel, another time, or “saying…” to change the text. |

## V-ES-BLOCK

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «bloqueá el lunes de 14 a 16» | es | `/appointments` | «bloqueá el lunes de 14 a 16» | **Bloquear horario** · Decí «sí» para guardarlo, «no» para cancelar u otras horas para cambiarlas. |
| «cerrá el horario del viernes de 9 a 12» | es | `/appointments` | «cerrá el horario del viernes de 9 a 12» | **Bloquear horario** · Decí «sí» para guardarlo, «no» para cancelar u otras horas para cambiarlas. |
| «habilitá el sábado de 9 a 13» | es | `/appointments` | «habilitá el sábado de 9 a 13» | **Habilitar horario** · Decí «sí» para guardarlo, «no» para cancelar u otras horas para cambiarlas. |

## V-EN-BLOCK

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «block Monday from 2 to 4» | en | `/appointments` | «block Monday from 2 to 4» | **Block time** · Say “yes” to save it, “no” to cancel, or other hours to change them. |
| «enable Saturday from 9 to 1» | en | `/appointments` | «enable Saturday from 9 to 1» | **Open time** · Say “yes” to save it, “no” to cancel, or other hours to change them. |

## V-ES-EXPORT

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «exportá la agenda de hoy» | es | `/appointments` | «exportá la agenda de hoy» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| «bajame la agenda de mañana a excel» | es | `/appointments` | «bajame la agenda de mañana a excel» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| «descargá la agenda de esta semana» | es | `/appointments` | «descargá la agenda de esta semana» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| «exportá la agenda de la semana que viene» | es | `/appointments` | «exportá la agenda de la semana que viene» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| «imprimí la agenda del mes» | es | `/appointments` | «imprimí la agenda del mes» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| «exportá la agenda de diciembre» | es | `/appointments` | «exportá la agenda de diciembre» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| «exportá la agenda del 1 al 10 de diciembre» | es | `/appointments` | «exportá la agenda del 1 al 10 de diciembre» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |

## V-EN-EXPORT

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «export today's schedule» | en | `/appointments` | «export today's schedule» | **Export schedule** · Should I download it? Say “yes”, or change the period or the calendars. |
| «download the schedule for tomorrow» | en | `/appointments` | «download the schedule for tomorrow» | **Export schedule** · Should I download it? Say “yes”, or change the period or the calendars. |
| «export the schedule for this week» | en | `/appointments` | «export the schedule for this week» | **Export schedule** · Should I download it? Say “yes”, or change the period or the calendars. |
| «export the schedule for next week» | en | `/appointments` | «export the schedule for next week» | **Export schedule** · Should I download it? Say “yes”, or change the period or the calendars. |
| «print the schedule for this month» | en | `/appointments` | «print the schedule for this month» | **Export schedule** · Should I download it? Say “yes”, or change the period or the calendars. |
| «export the schedule for December» | en | `/appointments` | «export the schedule for December» | **Export schedule** · Should I download it? Say “yes”, or change the period or the calendars. |

## V-ES-FORM

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «con el doctor Gómez» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «con el doctor Gómez» | **Editar cita** · Listo: con Dr. Pablo Gómez. ¿La guardo? |
| «ponele la doctora Ruiz» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «ponele la doctora Ruiz» | **Editar cita** · Listo: con Dra. Laura Ruiz. ¿La guardo? |
| «sin doctor» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «sin doctor» | **Editar cita** · Listo: sin doctor. ¿La guardo? |
| «a las 11» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «a las 11» | **Editar cita** · Listo: hoy a las 11:00. ¿La guardo? |
| «mejor a las 4 de la tarde» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «mejor a las 4 de la tarde» | **Editar cita** · Listo: hoy a las 16:00. ¿La guardo? |
| «cambiá la hora a las 9 y media» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «cambiá la hora a las 9 y media» | **Editar cita** · Listo: hoy a las 09:30. ¿La guardo? |
| «el viernes» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «el viernes» | **Editar cita** · Listo: viernes 27 de noviembre a las 10:00. ¿La guardo? |
| «pasala para el lunes» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «pasala para el lunes» | **Editar cita** · Listo: hoy a las 10:00. ¿La guardo? |
| «que termine a las 11» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «que termine a las 11» | **Editar cita** · Listo: termina a las 11:00. ¿La guardo? |
| «hasta las 12» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «hasta las 12» | **Editar cita** · Listo: termina a las 12:00. ¿La guardo? |
| «en el sillón 1» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «en el sillón 1» | **Editar cita** · Listo: consultorio Sillón 1. ¿La guardo? |
| «en el consultorio ortodoncia» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «en el consultorio ortodoncia» | **Editar cita** · Listo: consultorio Ortodoncia. ¿La guardo? |
| «agregá limpieza» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «agregá limpieza» | **Editar cita** · Listo: tratamientos: Limpieza. ¿La guardo? |
| «agregale blanqueamiento y control» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «agregale blanqueamiento y control» | **Editar cita** · Listo: tratamientos: Blanqueamiento, Control. ¿La guardo? |
| «nota: alérgico a la penicilina» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «nota: alérgico a la penicilina» | **Editar cita** · Listo: nota «Alérgico a la penicilina». ¿La guardo? |
| «agregá en notas que trae estudios» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «agregá en notas que trae estudios» | **Editar cita** · Listo: nota «Trae estudios». ¿La guardo? |
| «el paciente es Sofía Castro» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «el paciente es Sofía Castro» | **Editar cita** · Listo: paciente Sofía Castro. ¿La guardo? |
| «cambiá el paciente a Sofía Castro» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «cambiá el paciente a Sofía Castro» | **Editar cita** · Listo: paciente Sofía Castro. ¿La guardo? |

## V-EN-FORM

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «with doctor Gómez» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «with doctor Gómez» | **Edit appointment** · Done: with Dr. Pablo Gómez. Save it? |
| «without doctor» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «without doctor» | **Edit appointment** · Done: no doctor. Save it? |
| «at 11» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «at 11» | **Edit appointment** · Done: today at 11:00. Save it? |
| «at 4 pm» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «at 4 pm» | **Edit appointment** · Done: today at 16:00. Save it? |
| «on Friday» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «on Friday» | **Edit appointment** · Done: Friday, November 27 at 10:00. Save it? |
| «ends at 11» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «ends at 11» | **Edit appointment** · Done: ends at 11:00. Save it? |
| «until 12» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «until 12» | **Edit appointment** · Done: ends at 12:00. Save it? |
| «in chair 1» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «in chair 1» | **Edit appointment** · Done: room Sillón 1. Save it? |
| «add limpieza» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «add limpieza» | **Edit appointment** · Done: treatments: Limpieza. Save it? |
| «note: allergic to penicillin» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «note: allergic to penicillin» | **Edit appointment** · Done: note “Allergic to penicillin”. Save it? |
| «add a note that he brings X-rays» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «add a note that he brings X-rays» | **Edit appointment** · Done: note “He brings X-rays”. Save it? |
| «patient is Sofía Castro» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «patient is Sofía Castro» | **Edit appointment** · Done: patient Sofía Castro. Save it? |
| «change the patient to Sofía Castro» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «change the patient to Sofía Castro» | **Edit appointment** · Done: patient Sofía Castro. Save it? |

## V-ES-FORM · guardar / cancelar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «guardar» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «guardar» | **Editar cita** · Listo, cita actualizada. |
| «guardá» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «guardá» | **Editar cita** · Listo, cita actualizada. |
| «actualizá» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «actualizá» | **Editar cita** · Listo, cita actualizada. |
| «listo» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «listo» | **Editar cita** · Listo, cita actualizada. |
| «sí» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «sí» | **Editar cita** · Listo, cita actualizada. |
| «dale guardalo» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «dale guardalo» | **Editar cita** · Listo, cita actualizada. |
| «cancelar» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «cancelar» | **Editar cita** · Listo, cerré el formulario sin guardar. |
| «cerrá sin guardar» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «cerrá sin guardar» | **Editar cita** · Listo, cerré el formulario sin guardar. |
| «descartá» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «descartá» | **Editar cita** · Listo, cerré el formulario sin guardar. |
| «no guardes» | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «no guardes» | **Editar cita** · Listo, cerré el formulario sin guardar. |

## V-EN-FORM · save / cancel

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «save» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «save» | **Edit appointment** · Done, appointment updated. |
| «update» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «update» | **Edit appointment** · Done, appointment updated. |
| «done» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «done» | **Edit appointment** · Done, appointment updated. |
| «yes» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «yes» | **Edit appointment** · Done, appointment updated. |
| «save it» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «save it» | **Edit appointment** · Done, appointment updated. |
| «cancel» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «cancel» | **Edit appointment** · Done, I closed the form without saving. |
| «discard» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «discard» | **Edit appointment** · Done, I closed the form without saving. |
| «close without saving» | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «close without saving» | **Edit appointment** · Done, I closed the form without saving. |

