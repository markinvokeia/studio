# Mi consultorio

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/92-workspace.spec.ts`

Mi consultorio: elegir la cita (hora, nombre, siguiente, anterior, posición), ¿quién sigue?, la agenda del día, sesión/receta/laboratorio/estética/perio/ficha/anamnesis/odontograma sobre la cita, filtros de día/semana/mes, mis citas, agenda de un consultorio, cambiar de caso.

**194 frases** en **129 pruebas que pasan** (es 143 · es-ES 14 · en 37). Pantallas: `/`, `/workspace`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## MC-SELECT · Elegir la cita

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «el de las 10» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es «abrí la cita de las 10 y media» | es | `/workspace` | «abrí la cita de las 10 y media» | **Mi consultorio** · Abrí la cita de las 10:30: Carlos López. |
| es «el paciente de las 3 y media» | es | `/workspace` | «el paciente de las 3 y media» | **Mi consultorio** · Abrí la cita de las 15:30: Sofía Castro. |
| es «el siguiente» | es | `/workspace` | «el siguiente» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| es «el próximo paciente» | es | `/workspace` | «el próximo paciente» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| es «abrí la cita de Carlos» | es | `/workspace` | «abrí la cita de Carlos» | **Mi consultorio** · Abrí la cita de las 10:30: Carlos López. |
| es «pasá al de Sofía Castro» | es | `/workspace` | «pasá al de Sofía Castro» | **Mi consultorio** · Abrí la cita de las 15:30: Sofía Castro. |
| es «el último» | es | `/workspace` | «el último» | **Mi consultorio** · Abrí la cita de las 15:30: Sofía Castro. |
| es «atendé a Juan» | es | `/workspace` | «atendé a Juan» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es-ES «abre la cita de las 9» | es-ES | `/workspace` | «abre la cita de las 9» | **Mi consultorio** · He abierto la cita de las 09:00: Ana Gómez. |
| en «the 10 o clock» | en | `/workspace` | «the 10 o clock» | **My workspace** · Opened the 10:00 appointment: Juan Pérez. |
| en «open the appointment at 3 30 pm» | en | `/workspace` | «open the appointment at 3 30 pm» | **My workspace** · Opened the 15:30 appointment: Sofía Castro. |
| en «next patient» | en | `/workspace` | «next patient» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| en «open Carlos's appointment» | en | `/workspace` | «open Carlos's appointment» | **My workspace** · Opened the 10:30 appointment: Carlos López. |
| «el siguiente» después del elegido sigue al que viene | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «el siguiente» | **Mi consultorio** · Abrí la cita de las 10:30: Carlos López. |
| «el anterior» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «el anterior» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| hora que no está: lo dice | es | `/workspace` | «el de las 8» | **Mi consultorio** · No encontré esa cita en la agenda que se está viendo. |

## MC-READ · Preguntar la agenda

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «¿quién sigue?» | es | `/workspace` | «quién sigue» | **Mi consultorio** · Sigue Ana Gómez a las 09:00 (Limpieza). |
| «qué pacientes tengo» | es | `/workspace` | «qué pacientes tengo» | **Mi consultorio** · Tenés 4 citas; la primera: 09:00 Ana Gómez. |
| «qué pacientes tengo mañana» cambia el día y lee | es | `/workspace` | «qué pacientes tengo mañana» | **Mi consultorio** · Tenés 1 cita; la primera: 11:00 María Rodríguez. |
| es-ES «qué pacientes tengo» | es-ES | `/workspace` | «qué pacientes tengo» | **Mi consultorio** · Tienes 4 citas; la primera: 09:00 Ana Gómez. |
| en «who is next» y «what is on my schedule» | en | `/workspace` | «who is next» | **My workspace** · Next is Ana Gómez at 09:00 (Limpieza). |
| 〃 | en | `/workspace` | «what is on my schedule» | **My workspace** · You have 4 appointments; the first: 09:00 Ana Gómez. |

## MC-ACTION · Acciones sobre la cita

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| con la cita elegida «nueva sesión» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «nueva sesión» | **Mi consultorio** · Abrí la sesión clínica de Juan Pérez. |
| con la cita elegida «registrá la sesión» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «registrá la sesión» | **Mi consultorio** · Abrí la sesión clínica de Juan Pérez. |
| con la cita elegida «recetale» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «recetale» | **Mi consultorio** · Abrí la receta para Juan Pérez. |
| con la cita elegida «hacé una receta» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «hacé una receta» | **Mi consultorio** · Abrí la receta para Juan Pérez. |
| con la cita elegida «orden de laboratorio» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «orden de laboratorio» | **Mi consultorio** · Abrí una orden de laboratorio para Juan Pérez. |
| con la cita elegida «abrí una sesión estética» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «abrí una sesión estética» | **Mi consultorio** · Abrí una sesión estética para Juan Pérez. |
| con la cita elegida «abrí el periodontograma» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «abrí el periodontograma» | **Mi consultorio** · Abrí el periodontograma de Juan Pérez. |
| con la cita elegida «abrí la ficha» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «abrí la ficha» | **Mi consultorio** · Abrí la ficha de Juan Pérez. |
| con la cita elegida «mostrame la anamnesis» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «mostrame la anamnesis» | **Mi consultorio** · Abrí la anamnesis de Juan Pérez. |
| con la cita elegida «abrí la línea de tiempo» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «abrí la línea de tiempo» | **Mi consultorio** · Abrí la línea de tiempo de Juan Pérez. |
| con la cita elegida «mostrame el odontograma» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «mostrame el odontograma» | **Mi consultorio** · Muestro el odontograma. |
| con la cita elegida «volvé a las sesiones» | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «volvé a las sesiones» | **Mi consultorio** · Muestro las sesiones. |
| con el paciente en la frase: elige y hace | es | `/workspace` | «nueva sesión para Carlos» | **Mi consultorio** · Abrí la sesión clínica de Carlos López. |
| «recetale a Sofía» | es | `/workspace` | «recetale a Sofía» | **Mi consultorio** · Abrí la receta para Sofía Castro. |
| «orden de laboratorio para el de las 10» | es | `/workspace` | «hacé una orden de laboratorio para el de las 10» | **Mi consultorio** · Abrí una orden de laboratorio para Juan Pérez. |
| sin cita elegida: la pide | es | `/workspace` | «nueva sesión» | **Mi consultorio** · Primero elegí la cita: por ejemplo «el de las 10». |
| cita futura: dice por qué no | es | `/workspace` | «el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| 〃 | es | `/workspace` | «nueva sesión» | **Mi consultorio** · Esa cita todavía no pasó: la sesión se registra el día de la cita o después. |
| «abrí la ficha de alguien que no está en la agenda» va al buscador del panel derecho | es | `/workspace` | «abrí la ficha de Roberto Díaz» | **Panel derecho** · Abrí la ficha de Roberto Díaz. |
| en «new session» y «prescribe» | en | `/workspace` | «the 10 o clock» | **My workspace** · Opened the 10:00 appointment: Juan Pérez. |
| 〃 | en | `/workspace` | «new session» | **My workspace** · Opened Juan Pérez’s clinical session. |
| 〃 | en | `/workspace` | «prescribe» | **My workspace** · Opened a prescription for Juan Pérez. |
| 〃 | en | `/workspace` | «open the periodontal chart» | **My workspace** · Opened Juan Pérez’s periodontal chart. |

## MC-FILTER · Lo que muestra la agenda

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «mostrame mañana» | es | `/workspace` | «mostrame mañana» | **Mi consultorio** · Muestro mañana. |
| «esta semana» | es | `/workspace` | «esta semana» | **Mi consultorio** · Muestro esta semana. |
| «los próximos 7 días» | es | `/workspace` | «los próximos 7 días» | **Mi consultorio** · Muestro los próximos 7 días. |
| «ver este mes» | es | `/workspace` | «ver este mes» | **Mi consultorio** · Muestro este mes. |
| «el mes que viene» | es | `/workspace` | «el mes que viene» | **Mi consultorio** · Muestro el mes que viene. |
| «mostrame el mes pasado» | es | `/workspace` | «mostrame el mes pasado» | **Mi consultorio** · Muestro el mes pasado. |
| «mis citas» | es | `/workspace` | «mis citas» | **Mi consultorio** · Muestro tus citas. |
| «ver la agenda Sillón 2» | es | `/workspace` | «ver la agenda Sillón 2» | **Mi consultorio** · Muestro la agenda Sillón 2. |
| «actualizá la agenda» | es | `/workspace` | «actualizá la agenda» | **Mi consultorio** · Actualizo la agenda. |
| «las agendas» pregunta cuál | es | `/workspace` | «ver las agendas» | **Mi consultorio** · ¿Qué agenda? [Sillón 1 / Sillón 2] |
| 〃 | es | `/workspace` | «la primera» | **Mi consultorio** · Muestro la agenda Sillón 1. |
| «mostrame del 1 al 15» | es | `/workspace` | «mostrame del 1 al 15» | **Mi consultorio** · Muestro del 01/11 al 15/11. |
| en «show me tomorrow» y «my appointments» | en | `/workspace` | «show me tomorrow» | **My workspace** · Showing tomorrow. |
| 〃 | en | `/workspace` | «my appointments» | **My workspace** · Showing your appointments. |

## MC-FILTER2 · Pestañas, calendario y fecha (también juntos)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «asignadas a mí» | es | `/workspace` | «asignadas a mí» | **Mi consultorio** · Muestro tus citas. |
| es «mostrame las asignadas a mí» | es | `/workspace` | «mostrame las asignadas a mí» | **Mi consultorio** · Muestro tus citas. |
| es «mis citas» | es | `/workspace` | «mis citas» | **Mi consultorio** · Muestro tus citas. |
| es «pasá a mis calendarios» | es | `/workspace` | «pasá a mis calendarios» | **Mi consultorio** · ¿Qué agenda? [Sillón 1 / Sillón 2] |
| 〃 | es | `/workspace` | «el primero» | **Mi consultorio** · Muestro la agenda Sillón 1. |
| es «mis calendarios» | es | `/workspace` | «mis calendarios» | **Mi consultorio** · ¿Qué agenda? [Sillón 1 / Sillón 2] |
| 〃 | es | `/workspace` | «el primero» | **Mi consultorio** · Muestro la agenda Sillón 1. |
| es «el calendario sillón 2» | es | `/workspace` | «el calendario sillón 2» | **Mi consultorio** · Muestro la agenda Sillón 2. |
| es «mostrame el sillón 2» | es | `/workspace` | «mostrame el sillón 2» | **Mi consultorio** · Muestro la agenda Sillón 2. |
| es «mis citas de mañana» | es | `/workspace` | «mis citas de mañana» | **Mi consultorio** · Muestro tus citas. Muestro mañana. |
| es «el sillón 2 mañana» | es | `/workspace` | «el sillón 2 mañana» | **Mi consultorio** · Muestro la agenda Sillón 2. Muestro mañana. |
| es «las citas de mañana» | es | `/workspace` | «las citas de mañana» | **Mi consultorio** · Muestro mañana. |
| es «la semana que viene» | es | `/workspace` | «la semana que viene» | **Mi consultorio** · Muestro los próximos 7 días. |
| es «mostrame el mes» | es | `/workspace` | «mostrame el mes» | **Mi consultorio** · Muestro este mes. |
| es «hoy» | es | `/workspace` | «hoy» | **Mi consultorio** · Muestro hoy. |
| es «volvé a hoy» | es | `/workspace` | «volvé a hoy» | **Mi consultorio** · Muestro hoy. |
| es-ES «enséñame mis calendarios» | es-ES | `/workspace` | «enséñame mis calendarios» | **Mi consultorio** · ¿Qué agenda? [Sillón 1 / Sillón 2] |
| 〃 | es-ES | `/workspace` | «el primero» | **Mi consultorio** · Muestro la agenda Sillón 1. |
| es-ES «las asignadas a mí» | es-ES | `/workspace` | «las asignadas a mí» | **Mi consultorio** · Muestro tus citas. |
| en «assigned to me» | en | `/workspace` | «assigned to me» | **My workspace** · Showing your appointments. |
| en «my calendars» | en | `/workspace` | «my calendars» | **My workspace** · Which calendar? [Sillón 1 / Sillón 2] |
| 〃 | en | `/workspace` | «the first one» | **My workspace** · Showing the Sillón 1 calendar. |
| en «appointments for tomorrow» | en | `/workspace` | «appointments for tomorrow» | **My workspace** · Showing tomorrow. |
| en «the calendar Sillón 2» | en | `/workspace` | «the calendar Sillón 2» | **My workspace** · Showing the Sillón 2 calendar. |
| «el martes» | es | `/workspace` | «el martes» | **Mi consultorio** · Muestro el 24/11. |
| «la agenda del martes» | es | `/workspace` | «la agenda del martes» | **Mi consultorio** · Muestro el 24/11. |
| «el 15 de diciembre» | es | `/workspace` | «el 15 de diciembre» | **Mi consultorio** · Muestro el 15/12. |
| «la semana pasada» | es | `/workspace` | «la semana pasada» | **Mi consultorio** · Muestro del 16/11 al 22/11. |
| «desde el 1 hasta el 10» | es | `/workspace` | «desde el 1 hasta el 10» | **Mi consultorio** · Muestro del 01/11 al 10/11. |
| «del 1 al 10 de diciembre» | es | `/workspace` | «del 1 al 10 de diciembre» | **Mi consultorio** · Muestro del 01/12 al 10/12. |
| «las citas del mes pasado» | es | `/workspace` | «las citas del mes pasado» | **Mi consultorio** · Muestro del 01/10 al 31/10. |
| «show last week» | en | `/workspace` | «show last week» | **My workspace** · Showing 16/11 to 22/11. |
| «¿qué tengo el viernes?» pone el día y lee la agenda | es | `/workspace` | «qué tengo el viernes» | **Mi consultorio** · Tenés 4 citas; la primera: 09:00 Ana Gómez. |
| con el caso clínico abierto, las fechas siguen siendo de la agenda (no van al agente) | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «mis citas de mañana» | **Mi consultorio** · Muestro tus citas. Muestro mañana. |
| «le hice una limpieza hoy» no es un filtro | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «le hice una limpieza hoy» | **Caso clínico** · Preparé la sesión: limpieza y restauración en el 16. ¿La guardo o preferís revisarla? |

## MC-SWITCH · Cambiar de caso clínico (de paciente)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «cambiá de Ana a Juan» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «cambiá de Ana a Juan» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es «cambia de Ana Gómez a Juan Pérez» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «cambia de Ana Gómez a Juan Pérez» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es «seleccioná a Juan» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «seleccioná a Juan» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es «pasá a Juan» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «pasá a Juan» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es «cambiá a Carlos» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «cambiá a Carlos» | **Mi consultorio** · Abrí la cita de las 10:30: Carlos López. |
| es «ahora Sofía» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «ahora Sofía» | **Mi consultorio** · Abrí la cita de las 15:30: Sofía Castro. |
| es «quiero ver a Juan» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «quiero ver a Juan» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es «cambiá al paciente Carlos López» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «cambiá al paciente Carlos López» | **Mi consultorio** · Abrí la cita de las 10:30: Carlos López. |
| es «abrí el caso de Sofía» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «abrí el caso de Sofía» | **Mi consultorio** · Abrí la cita de las 15:30: Sofía Castro. |
| es-ES «cambia de Ana a Juan» | es-ES | `/workspace` | «el de las 9» | **Mi consultorio** · He abierto la cita de las 09:00: Ana Gómez. |
| 〃 | es-ES | `/workspace` | «cambia de Ana a Juan» | **Mi consultorio** · He abierto la cita de las 10:00: Juan Pérez. |
| es-ES «selecciona a Carlos» | es-ES | `/workspace` | «el de las 9» | **Mi consultorio** · He abierto la cita de las 09:00: Ana Gómez. |
| 〃 | es-ES | `/workspace` | «selecciona a Carlos» | **Mi consultorio** · He abierto la cita de las 10:30: Carlos López. |
| en «switch from Ana to Juan» | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «switch from Ana to Juan» | **My workspace** · Opened the 10:00 appointment: Juan Pérez. |
| en «select Carlos» | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «select Carlos» | **My workspace** · Opened the 10:30 appointment: Carlos López. |
| en «switch to Sofía» | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «switch to Sofía» | **My workspace** · Opened the 15:30 appointment: Sofía Castro. |
| es «cerrá este caso clínico y abrí el de Juan» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «cerrá este caso clínico y abrí el de Juan» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es «cerrá el caso y ahora el de Carlos» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «cerrá el caso y ahora el de Carlos» | **Mi consultorio** · Abrí la cita de las 10:30: Carlos López. |
| es «quiero ver ahora el de Sofía» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «quiero ver ahora el de Sofía» | **Mi consultorio** · Abrí la cita de las 15:30: Sofía Castro. |
| es «ahora el de Juan Pérez» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «ahora el de Juan Pérez» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es «mostrame el caso de Carlos» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «mostrame el caso de Carlos» | **Mi consultorio** · Abrí la cita de las 10:30: Carlos López. |
| es «abrí el caso de Juan» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «abrí el caso de Juan» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es-ES «cierra este caso y abre el de Juan» | es-ES | `/workspace` | «el de las 9» | **Mi consultorio** · He abierto la cita de las 09:00: Ana Gómez. |
| 〃 | es-ES | `/workspace` | «cierra este caso y abre el de Juan» | **Mi consultorio** · He abierto la cita de las 10:00: Juan Pérez. |
| en «close this case and open Carlos» | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «close this case and open Carlos» | **My workspace** · Opened the 10:30 appointment: Carlos López. |
| en «now the one of Juan» | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «now the one of Juan» | **My workspace** · Opened the 10:00 appointment: Juan Pérez. |
| es «ahora el de las 15:30» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «ahora el de las 15:30» | **Mi consultorio** · Abrí la cita de las 15:30: Sofía Castro. |
| es «y ahora el de las 10» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «y ahora el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es-ES «ahora el de las 10:30» | es-ES | `/workspace` | «el de las 9» | **Mi consultorio** · He abierto la cita de las 09:00: Ana Gómez. |
| 〃 | es-ES | `/workspace` | «ahora el de las 10:30» | **Mi consultorio** · He abierto la cita de las 10:30: Carlos López. |
| en «now the one at 10:30» | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «now the one at 10:30» | **My workspace** · Opened the 10:30 appointment: Carlos López. |
| es «el paciente Juan» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «el paciente Juan» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es «paciente Carlos» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «paciente Carlos» | **Mi consultorio** · Abrí la cita de las 10:30: Carlos López. |
| es «el siguiente paciente» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «el siguiente paciente» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es «el paciente siguiente» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «el paciente siguiente» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |
| es «el último paciente» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «el último paciente» | **Mi consultorio** · Abrí la cita de las 15:30: Sofía Castro. |
| es «el primer paciente» | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «el primer paciente» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| en «the next patient» | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «the next patient» | **My workspace** · Opened the 10:00 appointment: Juan Pérez. |
| en «the patient Carlos» | en | `/workspace` | «the 9 o clock» | **My workspace** · Opened the 09:00 appointment: Ana Gómez. |
| 〃 | en | `/workspace` | «the patient Carlos» | **My workspace** · Opened the 10:30 appointment: Carlos López. |
| un nombre que no está en la lista no cambia de caso | es | `/workspace` | «el de las 9» | **Mi consultorio** · Abrí la cita de las 09:00: Ana Gómez. |
| 〃 | es | `/workspace` | «cambiá a Roberto» | **Caso clínico** · Sin novedades para este paciente. |

## MC-DATE · Cambiar la fecha

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «cambiá la fecha al martes» | es | `/workspace` | «cambiá la fecha al martes» | **Mi consultorio** · Muestro el 24/11. |
| es «cambiá la fecha a mañana» | es | `/workspace` | «cambiá la fecha a mañana» | **Mi consultorio** · Muestro mañana. |
| es «poné la fecha de mañana» | es | `/workspace` | «poné la fecha de mañana» | **Mi consultorio** · Muestro mañana. |
| es-ES «cambia la fecha a mañana» | es-ES | `/workspace` | «cambia la fecha a mañana» | **Mi consultorio** · Muestro mañana. |
| en «change the date to tomorrow» | en | `/workspace` | «change the date to tomorrow» | **My workspace** · Showing tomorrow. |
| es «mis citas asignadas a mí» | es | `/workspace` | «mis citas asignadas a mí» | **Mi consultorio** · Muestro tus citas. |
| «cambialo de fecha» pregunta cuál | es | `/workspace` | «cambialo de fecha» | **Mi consultorio** · ¿Qué fecha querés ver? Por ejemplo «mañana», «el martes» o «del 1 al 10». |
| 〃 | es | `/workspace` | «el 15 de diciembre» | **Mi consultorio** · Muestro el 15/12. |
| en «change the date» asks which | en | `/workspace` | «change the date» | **My workspace** · Which date do you want to see? For example “tomorrow”, “Tuesday” or “from the 1st to the 10th”. |
| 〃 | en | `/workspace` | «tomorrow» | **My workspace** · Showing tomorrow. |

## MC-NAV · Llegar y seguir

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «andá a mi consultorio y abrí el de las 10» | es | `/` | «andá a mi consultorio y abrí el de las 10» | **Mi consultorio** · Abrí la cita de las 10:00: Juan Pérez. |

