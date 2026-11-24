# Rutinas reales

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/80-routines.spec.ts`

Rutinas reales de recepción y doctores: conversaciones largas que combinan todo, es y en.

**114 frases** en **27 pruebas que pasan** (es 70 · es-ES 0 · en 44 · 1 contestadas por la IA simulada). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## R-ES · Rutinas en español

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| R-ES-01 arranque del día: qué tengo, quién sigue, llega el primero y pasa a consulta | es | `/appointments` | «vista día» | **Calendario** · Listo, vista de día. |
| 〃 | es | `/appointments` | «qué tengo hoy» | **Agenda · lun 23/11** · hoy hay 4 citas. |
| 〃 | es | `/appointments` | «quién sigue» | **¿Quién sigue?** · No quedan citas por atender hoy. |
| 〃 | es | `/appointments` | «Ana Gómez llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Ana Gómez quedó en Llegó. |
| 〃 | es | `/appointments` | «pasó a consulta» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Ana Gómez quedó en En curso. |
| R-ES-02 un paciente llama para cambiar el turno: encontrarlo, moverlo y confirmar | es | `/appointments` | «la cita de María de mañana» | **Cita** · La cita de María Rodríguez, mañana a las 11:00. |
| 〃 | es | `/appointments` | «pasala al jueves a las 10» | **Reprogramar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «sí» | **Reprogramar cita** · Listo, cita reprogramada. |
| R-ES-03 el doctor arma su vista: día, solo él, más zoom, horario de la clínica | es | `/appointments` | «vista día» | **Calendario** · Listo, vista de día. |
| 〃 | es | `/appointments` | «solo el doctor Pérez» | **Filtros del calendario** · Listo, solo Dr. Martín Pérez. |
| 〃 | es | `/appointments` | «más zoom» | Zoom al 110 %. |
| 〃 | es | `/appointments` | «más zoom» | Zoom al 120 %. |
| 〃 | es | `/appointments` | «mostrá solo el horario de la clínica» | **Configuración de la agenda** · Listo: franja del horario de la clínica. |
| R-ES-04 paciente nuevo: cita completa, agregar control, nota y guardar | es | `/appointments` | «nueva cita para Sofía Castro mañana a las 10 con el doctor Pérez, limpieza» | **Nueva cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «agregá control» | **Nueva cita** · Listo: tratamientos: Limpieza, Control. ¿La guardo? |
| 〃 | es | `/appointments` | «nota: primera vez, viene derivada» | **Nueva cita** · Listo: nota «Primera vez, viene derivada». ¿La guardo? |
| 〃 | es | `/appointments` | «guardar» | **Nueva cita** · Listo, cita guardada. |
| R-ES-05 antes de atender: ¿debe algo? → cobro rápido | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «tiene deudas» | Información del paciente |
| 〃 | es | `/appointments` | «cobrale» | **Cobro rápido** · Listo, abrí el cobro rápido de Juan Pérez. |
| R-ES-06 ordenar la agenda a gusto: configuración en varias frases | es | `/appointments` | «abrí la configuración» | **Configuración de la agenda** · Listo, abrí la configuración. |
| 〃 | es | `/appointments` | «slots de 15» | **Configuración de la agenda** · Listo: slots de 15 minutos. |
| 〃 | es | `/appointments` | «ocultá los domingos» | **Configuración de la agenda** · Listo: ocultos: domingo. |
| 〃 | es | `/appointments` | «franja de la clínica» | **Configuración de la agenda** · Listo: franja del horario de la clínica. |
| 〃 | es | `/appointments` | «vista predeterminada semana» | **Configuración de la agenda** · Listo: vista predeterminada semana. |
| 〃 | es | `/appointments` | «cerrá la configuración» | **Configuración de la agenda** · Listo, cerré la configuración. |
| R-ES-07 exportar la semana que viene de Centro, corrigiendo en el camino | es | `/appointments` | «exportá la agenda» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| 〃 | es | `/appointments` | «de la semana que viene» | **Exportar agenda** · Listo, lo cambié. ¿La descargo? |
| 〃 | es | `/appointments` | «solo la sede Centro» | **Exportar agenda** · Listo, lo cambié. ¿La descargo? |
| 〃 | es | `/appointments` | «sí» | **Exportar agenda** · Listo, se descargó la agenda. |
| R-ES-08 cancelación tardía y después cuántas veces canceló | es | `/appointments` | «Juan Pérez canceló tarde» | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Cancelada. |
| 〃 | es | `/appointments` | «cuántas citas canceló Juan Pérez» | Información del paciente |
| R-ES-09 ambigüedad + herramienta en el medio + respuesta + acción | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «más zoom» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «la de las 10 y media» | **Cita** · La cita de Ana Martínez, hoy a las 10:30. |
| 〃 | es | `/appointments` | «llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Ana Martínez quedó en Llegó. |
| R-ES-10 empezar algo, cambiar de tema dos veces y terminar lo último | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «exportá la agenda de mañana» | **¿Cambiamos de tarea?** · Estábamos con «la cita de Ana». ¿Lo dejo para hacer «exportá la agenda de mañana»? |
| 〃 | es | `/appointments` | «no» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «la segunda» | **Cita** · La cita de Ana Martínez, hoy a las 10:30. |
| 〃 | es | `/appointments` | «editala» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «exportá la agenda de mañana» | **¿Cambiamos de tarea?** · Estábamos con «editala». ¿Lo dejo para hacer «exportá la agenda de mañana»? |
| 〃 | es | `/appointments` | «sí» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| 〃 | es | `/appointments` | «cancelar» | **Exportar agenda** · Listo, no la exporté. |
| R-ES-11 recorrer la semana buscando lugar: siguiente, huecos de la tarde, volver a hoy | es | `/appointments` | «siguiente» | Calendario en lun 30/11. |
| 〃 | es | `/appointments` | «huecos el jueves a la tarde» | **Huecos · jue 26/11** · No hay huecos jueves 26 de noviembre a la tarde. |
| 〃 | es | `/appointments` | «volvé a hoy» | Calendario en lun 23/11. |
| R-ES-12 consultorio: ver el sillón 2, mover la cita de Carlos ahí y volver | es | `/appointments` | «pasá al sillón 2» | **Filtros del calendario** · Listo, solo Sillón 2. |
| 〃 | es | `/appointments` | «pasá la cita de Carlos López al sillón 2» | **Cambiar de agenda** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Cambiar de agenda** · Listo, la cita de Carlos López quedó en Sillón 2. |
| R-ES-13 estadísticas antes de dar otra cita y presupuesto | es | `/appointments` | «cuántas veces faltó Juan Pérez» | Información del paciente |
| 〃 | es | `/appointments` | «y en qué estado están sus presupuestos» | Información del paciente |
| 〃 | es | `/appointments` | «nuevo presupuesto» | **Nuevo presupuesto** · Listo, abrí un presupuesto nuevo para Juan Pérez. |
| R-ES-14 editar todo de una cita en varias frases y guardar | es | `/appointments` | «editá la cita de Carlos López» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «con la doctora Ruiz» | **Editar cita** · Listo: con Dra. Laura Ruiz. ¿La guardo? |
| 〃 | es | `/appointments` | «en el sillón 1» | **Editar cita** · Listo: consultorio Sillón 1. ¿La guardo? |
| 〃 | es | `/appointments` | «a las 4» | **Editar cita** · Listo: hoy a las 16:00. ¿La guardo? |
| 〃 | es | `/appointments` | «que termine a las 5» | **Editar cita** · Listo: termina a las 17:00. ¿La guardo? |
| 〃 | es | `/appointments` | «agregá extracción» | **Editar cita** · Listo: tratamientos: Extracción. ¿La guardo? |
| 〃 | es | `/appointments` | «nota: trae radiografía» | **Editar cita** · Listo: nota «Trae radiografía». ¿La guardo? |
| 〃 | es | `/appointments` | «actualizá» | **Editar cita** · Listo, cita actualizada. |
| R-ES-15 dormirse a mitad de una pregunta y retomar al prender | es | `/appointments` | «Carlos López no vino» | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en No asistió. |
| R-ES-16 paciente que no aparece por nombre: buscar por cédula y preguntar su deuda | es | `/appointments` | «buscá el paciente Ernesto Valverde» | **Buscar paciente** · No encontré a ernesto valverde por el nombre. Decime la cédula, el email o el teléfono. |
| 〃 | es | `/appointments` | «cédula 1 2 3 4 5 6 7 8» | **Buscar paciente** · Listo, abrí la ficha de Roberto Díaz. |
| R-ES-17 con IA: frase larga con todo junto | es | `/appointments` | «mostrame mañana en vista día, solo la doctora Ruiz y agrandá un poco» · IA | Zoom al 120 %. |

## R-EN · Routines in English

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| R-EN-01 start of the day: agenda, who is next, check in and start | en | `/appointments` | «day view» | **Calendar** · Done, day view. |
| 〃 | en | `/appointments` | «what do I have today» | **Schedule · Mon 23/11** · 4 appointments today. |
| 〃 | en | `/appointments` | «Ana Gómez arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Ana Gómez’s appointment is now Arrived. |
| 〃 | en | `/appointments` | «mark it as in progress» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Ana Gómez’s appointment is now In progress. |
| R-EN-02 reschedule over the phone | en | `/appointments` | «María's appointment tomorrow» | **Appointment** · María Rodríguez's appointment, tomorrow at 11:00. |
| 〃 | en | `/appointments` | «move it to Thursday at 10» | **Reschedule appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «yes» | **Reschedule appointment** · Done, appointment rescheduled. |
| R-EN-03 doctor sets up the view | en | `/appointments` | «day view» | **Calendar** · Done, day view. |
| 〃 | en | `/appointments` | «only doctor Pérez» | **Calendar filters** · Done, only Dr. Martín Pérez. |
| 〃 | en | `/appointments` | «zoom in» | Zoom at 110%. |
| 〃 | en | `/appointments` | «zoom in» | Zoom at 120%. |
| 〃 | en | `/appointments` | «only show clinic hours» | **Calendar settings** · Done: clinic hours visible. |
| R-EN-04 new patient booking with corrections | en | `/appointments` | «new appointment for Sofía Castro tomorrow at 10 with doctor Pérez, limpieza» | **New appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «note: first visit» | **New appointment** · Done: note “First visit”. Save it? |
| 〃 | en | `/appointments` | «save» | **New appointment** · Done, appointment saved. |
| R-EN-05 before seeing the patient: balance, then quick charge | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «does he owe anything» | Patient information |
| 〃 | en | `/appointments` | «quick charge» | **Quick charge** · Done, I opened Juan Pérez's quick charge. |
| R-EN-06 settings session | en | `/appointments` | «open the settings» | **Calendar settings** · Done, I opened the settings. |
| 〃 | en | `/appointments` | «15 minute slots» | **Calendar settings** · Done: 15-minute slots. |
| 〃 | en | `/appointments` | «hide sundays» | **Calendar settings** · Done: hidden: Sunday. |
| 〃 | en | `/appointments` | «only show clinic hours» | **Calendar settings** · Done: clinic hours visible. |
| 〃 | en | `/appointments` | «default view week» | **Calendar settings** · Done: default view week. |
| 〃 | en | `/appointments` | «close the settings» | **Calendar settings** · Done, I closed the settings. |
| R-EN-07 export next week, all calendars | en | `/appointments` | «export the schedule» | **Export schedule** · Should I download it? Say “yes”, or change the period or the calendars. |
| 〃 | en | `/appointments` | «next week» | **Export schedule** · Done, I changed it. Should I download it? |
| 〃 | en | `/appointments` | «all calendars» | **Export schedule** · Done, I changed it. Should I download it? |
| 〃 | en | `/appointments` | «download it» | **Export schedule** · Done, the schedule was downloaded. |
| R-EN-08 ambiguity, a tool in the middle, answer, action | en | `/appointments` | «Ana's appointment» | **Appointment** · Which of these appointments? [Mon 23/11 09:00 · Ana Gómez / Mon 23/11 10:30 · Ana Martínez] |
| 〃 | en | `/appointments` | «zoom in» | **Appointment** · Which of these appointments? [Mon 23/11 09:00 · Ana Gómez / Mon 23/11 10:30 · Ana Martínez] |
| 〃 | en | `/appointments` | «the one at 10 30» | **Appointment** · Ana Martínez's appointment, today at 10:30. |
| 〃 | en | `/appointments` | «she arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Ana Martínez’s appointment is now Arrived. |
| R-EN-09 stats then a quote | en | `/appointments` | «how many no shows does Juan Pérez have» | Patient information |
| 〃 | en | `/appointments` | «new quote» | **New quote** · Done, I opened a new quote for Juan Pérez. |
| R-EN-10 edit everything in several phrases | en | `/appointments` | «edit Carlos López's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «with doctor Ruiz» | **Edit appointment** · Done: with Dra. Laura Ruiz. Save it? |
| 〃 | en | `/appointments` | «in chair 1» | **Edit appointment** · Done: room Sillón 1. Save it? |
| 〃 | en | `/appointments` | «at 4» | **Edit appointment** · Done: today at 16:00. Save it? |
| 〃 | en | `/appointments` | «ends at 5» | **Edit appointment** · Done: ends at 17:00. Save it? |
| 〃 | en | `/appointments` | «note: bring X-rays» | **Edit appointment** · Done: note “Bring X-rays”. Save it? |
| 〃 | en | `/appointments` | «update» | **Edit appointment** · Done, appointment updated. |

