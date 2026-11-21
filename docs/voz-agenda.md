# Agenda por voz · Levantamiento y reglas del agente

Todo lo que se hace en la agenda (`/appointments`) con el mouse se tiene que poder pedir con la voz, en **español o inglés** (en cualquier idioma de la app). Este documento es la especificación: qué se puede pedir, con qué palabras, qué pasos sigue el sistema y qué confirma antes. Es también la base del patrón de voz para el resto de Invoke IA (ver [voz-patron-hibrido.md](voz-patron-hibrido.md)).

- Lo que define qué se entiende sin IA: `src/lib/voice/commands/calendar-parse.ts` y `calendar-settings-parse.ts`.
- Lo que hace cada acción: `src/lib/voice/commands/calendar*.ts`, contra el puente `src/lib/voice/calendar-bridge.ts`.
- Lo que entiende la IA (cuando lo local no alcanza): `VOICE_DOMAINS.calendar` en `scripts/n8n/generate-help-workflows.mjs` → `n8n-workflows/help-voice-interpret.json` («Voz - Interpretar»), revalidado en `src/lib/voice/commands/calendar-ai.ts`.

## 1. Reglas del agente (ley para toda la voz de Invoke IA)

### 1.1 Escucha

| Modo | Cómo se activa | Qué escucha |
| --- | --- | --- |
| **Micrófono prendido** | Botón **Voz** (queda prendido hasta apagarlo; se recuerda en ese navegador) | Todo lo que se dice, **sin palabra de activación** |
| **Mantener para hablar** | **Ctrl+Espacio** mantenido | Una frase |

- Prendido, procesa todo. Si pasan **90 s** sin hablarle (o **3 min** con una pregunta abierta) **se duerme y apaga el micrófono**, guardando la tarea. Al tocar Voz de nuevo retoma la pregunta abierta.
- «Invoke …» no hace falta, pero si se dice se saca («Invoke, andá al jueves», «Inbox IA…», que es como lo suele transcribir el reconocedor). «Invoke» solo responde «Te escucho».
- **Frases cortadas**: el navegador cierra una frase en cualquier pausa corta. Los pedazos se juntan hasta **1,2 s** sin oír nada, así una pausa no parte el pedido en dos. Mientras se sigue hablando no se procesa.
- **No se oye a sí mismo**: mientras habla el asistente (o la mascota leyendo una guía) el micrófono descarta lo que oye, sin cortar el reconocimiento. Así no se reinicia y no se pierden las primeras palabras de la respuesta.
- Lo que no se entiende con el micrófono prendido (puede ser una charla de la sala) se muestra en la tarjeta sin decirlo en voz alta. Si la IA dice que no era para el asistente (`ignore`), no hace nada.
- El punto verde del botón indica que el micrófono está oyendo a alguien en ese momento.

### 1.2 Pila de tareas y contexto

- Cada pedido es una **tarea** (p. ej. «cambiar el doctor de la cita de Ana»). Si para cumplirla hace falta antes **buscar o elegir** algo (la cita, el paciente, el doctor), se busca, se pregunta cuál y **se retoma la tarea original** con lo elegido, sin volver a pedir lo que ya se dijo.
- Si la IA devuelve varios pasos («editá la cita de Ana y ponele el doctor Pérez»), se ejecutan **en orden**; si uno falla, se frena ahí y se dice por qué.
- **Foco**: la última cita (y su paciente) elegida queda como contexto. «Marcala como llegó», «cambiale el color a rojo», «abrí su cuenta», «¿cuánto debe?» actúan sobre ella sin volver a nombrarla. «Olvidá esa cita» / «otra cita» lo limpia; se limpia solo a los 30 min sin usarlo.
- **Herramientas en el medio**: con una pregunta abierta, moverse de día, cambiar la vista, el zoom, filtrar, ver huecos o buscar **no cancela nada**: se hace y se repite la pregunta pendiente.
- **Cambio de tema**: si con una tarea a medias se pide algo que no tiene nada que ver (ni con el paso actual ni con los que faltan), se pregunta **«¿Dejo «X» para hacer lo nuevo?»**. «Sí» cancela y hace lo nuevo; «no» repite la pregunta pendiente.
- «Cancelá», «pará», «olvidalo», «stop», «never mind» cancela la tarea en curso (sin pregunta de por medio). Escape también.

### 1.3 Cuándo se confirma y cuándo se pregunta

| Situación | Qué pasa |
| --- | --- |
| Varias coincidencias (citas, pacientes, doctores, agendas, tratamientos, opciones) | **Siempre** se listan (hasta 6) y se pregunta cuál: «la dos», «la de las 10», el nombre, o tocándola |
| Mirar / moverse (navegar, vistas, zoom, filtros, panel, huecos, búsqueda, preferencias visuales) | Se hace directo y se dice qué quedó |
| Cambiar una cita (estado, doctor, agenda, color, duración, mover) | Se confirma antes («¿La paso a confirmada?») |
| Borrar, cancelar, no asistió, descartar un formulario | Confirmación de peligro |
| Dar, editar, reprogramar | Se abre **el formulario de siempre** completo; se puede seguir cambiando campos por voz; «guardar/actualizar/sí» aprieta Guardar (con sus validaciones); «cancelar/cerrar» lo cierra sin guardar |
| Un aviso de la pantalla (pop-up) abierto | «Continuar / aceptar / sí» aprieta el botón principal del aviso; «cancelar / no / volver» el de cancelar |
| La IA no está segura (< 0,5) o no responde | «No entendí» con ejemplos. Nunca adivina |
| Datos del paciente | No viajan a la IA de voz (solo el nombre dicho dentro de la frase). El resumen y las preguntas del paciente van al agente clínico (`POST ai/doctor/query`) con la cita, como en Mi consultorio |

### 1.4 Regla de oro: la voz nunca rompe la pantalla

- Si un paso falla (un error del backend, algo que no existe, una acción que no se puede hacer), se dice «Ups, algo falló y no pude seguir con eso. No se cambió nada más. ¿Probamos de otra forma?» y la voz sigue funcionando.
- Si un plan de varios pasos se frena, se dice en qué paso y que lo anterior quedó hecho.
- El botón y la tarjeta de voz tienen su propio límite de errores: si algo de la voz falla al dibujarse, se apaga la voz y la agenda sigue funcionando.
- La conexión pantalla↔voz es de cada montaje de la pantalla. Al cambiar de idioma o recargar, la pantalla vieja no puede borrar la de la nueva. Si un comando no encuentra la agenda, espera unos segundos a que aparezca.

### 1.5 Avisos, cerrar y dejar de escuchar

- **Avisos (pop-ups)**: cuando aparece uno («¿Seguro que querés borrar la cita?», «El paciente ya tiene citas futuras…») y la voz está en uso, se lee el título, se dicen sus botones («¿Qué hago? Cancelar o Agendar igual») y se aprieta el que se nombre: por su texto, por su posición («el segundo») o por sí/no (el principal o el de cancelar). Si se cierra con el mouse, la pregunta se va. Ver `src/lib/voice/dom-dialog.ts`.
- **Cerrar**: «cerrá», «cerrá el panel», «escondé eso», «que no se vea», «no quiero ver eso», «volvé atrás», «close the panel», «hide it» cierran lo que esté abierto, de arriba hacia abajo: primero las ventanas y paneles laterales (estado de cuenta, historia, ficha del paciente…, con su X o Escape) y después la configuración, exportar, la búsqueda, los huecos, operaciones en lotes y el panel de agendas. «Cerrá todo» / «close everything» cierra todo. «Atrás» solo cierra si hay algo abierto; si no, va para atrás en la agenda.
- **Dejar de escuchar**: «dejá de escuchar», «pausá el dictado», «apagá el micrófono», «no me escuches más», «eso es todo», «stop listening», «mute the mic»… apagan el micrófono (si había una pregunta abierta, queda guardada).
- **Buscar huecos** («buscá huecos», «find slots», «show me open slots») muestra los huecos, nunca el buscador de citas.

### 1.6 Ambigüedad

- Entre opciones de una lista se elige diciendo el número u ordinal («la segunda»), la posición («la última», «la penúltima», «la de arriba», «la de abajo», «la del medio»), la hora («la de las 10») o el texto de la opción. Si lo dicho calza igual con dos, se pregunta solo entre esas.
- Si la IA duda (confianza 0,5–0,8: dos lecturas parejas), se pregunta «No estoy seguro: ¿querés *cambiar el zoom*?» antes de hacerlo. Con confianza alta se hace sin preguntar; con baja se dice que no se entendió.
- Si lo local entendió la forma pero lo nombrado no existe («solo cuando atendemos» no es un doctor, «put together…» no es un paciente), se le pregunta a la IA antes de decir «No encontré…».

### 1.7 Local primero, IA solo si hace falta

1. Respuestas (sí/no, «la dos», un nombre de la lista) y frases comunes se entienden **en el navegador**, al instante y sin costo.
2. Lo que no se entiende va a `POST voice/interpret` con el estado de la pantalla (vista, rango, listas cerradas de doctores/agendas/sedes/tratamientos, preferencias, foco, tarea y pregunta pendiente) y devuelve una **lista de pasos** de un catálogo cerrado + la **relación** con lo que se venía haciendo (`new`, `answer`, `aux`, `ignore`, `cancel`, `resume`).
3. Todo se revalida dos veces (n8n y navegador). La IA nunca ejecuta: devuelve pasos y el navegador decide.

## 2. Levantamiento: barra de la agenda

Columna **Pasos**: lo que hace el sistema, en orden. ⟶ = acción de la pantalla (las mismas funciones que los botones).

### 2.1 Navegación

| Acción | Ejemplos ES | Ejemplos EN | Pasos |
| --- | --- | --- | --- |
| Hoy | «hoy», «volvé a hoy», «andá a hoy», «el día de hoy» | «today», «go to today», «back to today» | ⟶ Hoy. Dice la fecha |
| Siguiente / anterior según la vista | «siguiente», «adelante», «para atrás», «anterior», «el próximo» | «next», «forward», «back», «previous» | ⟶ flecha. Vista día = 1 día, N días = N días, semana = 1 semana, mes = 1 mes, lista = su rango |
| Siguiente / anterior por unidad | «la semana que viene», «semana anterior», «mes siguiente», «el mes pasado», «mañana», «ayer», «dos semanas adelante» | «next week», «last month», «tomorrow», «yesterday» | ⟶ salta esa unidad. «Semana» desde vista día pasa a vista semana; «mes» a vista mes |
| Ir a una fecha | «andá al jueves», «el 3 de diciembre», «el 14», «el lunes que viene», «mostrame el 20 de enero» | «go to Thursday», «December 3rd», «jump to the 14th» | ⟶ selector de fecha. Fecha más cercana (o futura si se dice «que viene») |

### 2.2 Ver (vista y agendas)

| Acción | Ejemplos ES | Ejemplos EN | Pasos |
| --- | --- | --- | --- |
| Cambiar la vista | «vista día», «ver semana», «de a 3 días», «vista mes», «lista», «agenda», «mostrame la semana» | «day view», «week view», «3 day view», «month», «list view» | ⟶ Vista. Opciones: día, 2–6 días, semana, mes, lista (año en modo Invoke) |
| ¿Qué vistas hay? | «¿cómo puedo ver?», «qué vistas hay», «cambiá la vista» (sin decir cuál) | «what views are there», «change the view» | Lista las vistas → pregunta cuál → la aplica |
| Mostrar / ocultar agendas | «mostrá el sillón 2», «ocultá la agenda de ortodoncia», «solo la agenda 1», «todas las agendas», «sacá el consultorio 3» | «show chair 2», «hide the ortho calendar», «only calendar 1», «all calendars» | Busca la agenda en la lista (varias → pregunta). ⟶ casilla de la agenda. En modo personalizado: elige la agenda a mostrar |
| ¿Qué agendas hay? | «qué agendas hay», «mostrame las agendas», «cambiá de agenda» (sin decir cuál) | «which calendars are there», «switch calendar» | Lista (por sede) → pregunta cuál → la muestra |
| Filtrar doctores / sedes | «solo el doctor Pérez», «agregá a la doctora Ruiz», «sacá la sede Centro», «todos los doctores» | «only Dr. Pérez», «add Dr. Ruiz», «remove the downtown site» | Igual que agendas. Una sede = sus agendas |
| Agrupar | «agrupá por doctor», «por agenda», «sin agrupar» | «group by doctor», «ungroup» | ⟶ Agrupar (no en modo personalizado: lo dice) |

### 2.3 Zoom

| Acción | Ejemplos ES | Ejemplos EN | Pasos |
| --- | --- | --- | --- |
| Acercar / alejar | «zoom», «más zoom», «acercá», «agrandá», «más grande», «menos zoom», «alejá», «achicá», «más chico» | «zoom in», «bigger», «zoom out», «smaller» | ⟶ +/− (10 %). «Mucho más» = 3 pasos |
| Al máximo / al mínimo | «zoom al máximo», «lo más grande posible», «zoom mínimo», «lo más chico» | «max zoom», «zoom all the way out» | ⟶ 250 % / 30 % |
| Un valor | «zoom al 150», «zoom 80 por ciento» | «zoom to 120 percent» | ⟶ ese valor (30–250) |
| Normal | «zoom normal», «reiniciá el zoom», «zoom al 100» | «reset zoom» | ⟶ 100 % |

### 2.4 Buscar citas y huecos (también como herramientas)

| Acción | Ejemplos ES | Ejemplos EN | Pasos |
| --- | --- | --- | --- |
| Buscar cita | «buscá a Ana Gómez», «buscá la cita de 099123456», «buscá citas de limpieza» | «search Ana Gómez», «find appointments for…» | ⟶ Buscar cita con el texto. Lee cuántas hay; si se pide algo sobre una, pregunta cuál y la enfoca |
| Cerrar búsqueda | «cerrá la búsqueda» | «close search» | ⟶ cerrar |
| Huecos | «¿qué huecos hay mañana?», «horarios libres el jueves a la tarde», «buscá huecos», «¿hay lugar el lunes?» | «free slots tomorrow», «any openings Monday afternoon» | ⟶ Buscar huecos en ese día/franja. Lee los primeros; «el segundo» abre la cita en ese horario |
| Ocultar huecos | «ocultá los huecos», «sacá los huecos» | «hide gaps» | ⟶ cerrar huecos |
| Agenda del día / quién sigue / próxima de un paciente | «¿qué tengo mañana?», «¿quién sigue?», «¿cuándo viene Ana?» | «what do I have tomorrow», «who's next», «when is Ana coming» | Solo lee, no cambia nada |

### 2.5 Exportar agenda

| Acción | Ejemplos ES | Ejemplos EN | Pasos |
| --- | --- | --- | --- |
| Abrir exportar | «exportá la agenda», «bajá la agenda a Excel», «imprimí la agenda» | «export the schedule», «download to Excel» | ⟶ abre Exportar agenda |
| Período | «de hoy», «de mañana», «de esta semana», «de la semana que viene», «del mes», «de diciembre», «del 1 al 15 de diciembre» | «today's», «this week», «for December», «from the 1st to the 15th» | ⟶ Día / Semana / Mes / Rango + fecha (o desde–hasta) |
| Agendas / sedes | «de la sede Centro», «solo la agenda 1 y la 2», «de todas las agendas» | «for the downtown site», «calendars 1 and 2», «all calendars» | ⟶ casillas (formato extendido) o la agenda (básico). Varias coincidencias → pregunta |
| Descargar | «exportá», «descargalo», «sí» | «export», «download it» | ⟶ Exportar. Si falta algo lo dice |
| Ejemplo completo | «exportá la agenda de la semana que viene de la sede Centro» | | abre, pone Semana + fecha, marca las agendas de Centro, pregunta «¿La descargo?» → «sí» ⟶ Exportar |

### 2.6 Actualizar

| Acción | Ejemplos ES | Ejemplos EN | Pasos |
| --- | --- | --- | --- |
| Actualizar | «actualizá», «refrescá», «recargá la agenda» | «refresh», «reload» | ⟶ Actualizar |

### 2.7 Panel de agendas (izquierda)

| Acción | Ejemplos ES | Ejemplos EN | Pasos |
| --- | --- | --- | --- |
| Abrir / cerrar | «abrí el panel de agendas», «mostrá las agendas al costado», «cerrá el panel», «escondé el panel» | «open the calendars panel», «close the panel», «hide the sidebar» | ⟶ botón Agendas |
| Fijar / soltar | «dejá fijo el panel», «fijalo», «que no se cierre», «soltá el panel», «que se esconda solo», «no lo dejes fijo» | «pin the panel», «keep it open», «unpin», «auto-hide» | ⟶ pin. Fijar también lo abre |

### 2.8 Configuración de la agenda (engranaje) — preferencias del usuario

Cada cambio se guarda solo (como en el engranaje). Se pueden decir varios juntos («vista semana, slots de 15 y franja de la clínica»). «Abrí la configuración» / «cerrá la configuración» muestra u oculta el engranaje.

| Ajuste | Ejemplos ES | Ejemplos EN | Valores |
| --- | --- | --- | --- |
| Modo | «modo personalizado», «vista Invoke», «poné el modo Invoke» | «custom mode», «Invoke mode» | `custom`, `invoke` |
| Vista predeterminada | «que arranque en semana», «vista predeterminada día», «por defecto 2 días» | «default view week» | día, 2 días, 3 días, semana, mes, agenda |
| Agrupar por (predeterminado) | «agrupar por doctor por defecto» | «group by calendar by default» | ninguno, doctor, agenda |
| Altura de la hora | «altura de la hora 120», «hora más alta», «hora más baja», «la más grande», «la más chica» | «taller hours», «hour height 100», «the biggest» | 60, 80, 100, 120, 140, 160, 180, 200 px (más/menos = un paso) |
| Duración del slot | «slots de 15», «franjas de 10 minutos», «slot de una hora» | «15 minute slots» | 5, 10, 15, 20, 30, 60 |
| Sede por defecto | «sede por defecto Centro», «mostrame todas las sedes», «solo la sede Norte» | «default site downtown», «all sites» | una sede o todas |
| Formato del título de la cita | «título: hora, paciente y notas», «paciente, tratamiento y hora», «que muestre el tratamiento primero» | «label: time, patient, notes» | hora·paciente·notas · paciente·tratamiento·hora · hora·paciente·notas·tratamiento · hora·tratamiento·paciente·notas |
| Ocultar días | «ocultá los sábados y domingos», «mostrá el sábado», «no muestres los domingos», «mostrá todos los días» | «hide weekends», «show Saturday» | varios a la vez; nunca los 7 |
| Franja horaria visible | «franja completa», «horario de la clínica», «de 8 a 20», «rango personalizado de 9 a 18» | «full day», «clinic hours», «from 8 to 6» | completa, clínica, personalizada (inicio < fin) |
| Colorear por estado | «colores por estado», «sin colores por estado» | «color by status on/off» | sí/no |
| Verificar disponibilidad | «activá verificar disponibilidad», «desactivá…» | «turn on availability check» | sí/no |
| Bloquear fuera de horario | «bloqueá fuera de horario», «permití fuera de horario» | «block out of hours» | sí/no |
| Filtrar doctores por servicio | «filtrar doctores por servicio» on/off | «filter doctors by service» | sí/no |
| Crear citas en la agenda (sin modal) | «crear citas en el calendario», «que abra el modal» | «inline creation on/off» | sí/no |
| Vista previa en vivo | «vista previa en vivo» on/off | «live preview on/off» | sí/no |

## 3. Levantamiento: la agenda y las citas

### 3.1 Encontrar la cita (lo primero de todo)

Pasos (`resolveAppointment`):

1. Si no se nombra ninguna y hay **foco**, es esa.
2. Si se dijo día, se va a ese día (si no, hoy) y se buscan las visibles con los filtros, después sin filtros.
3. Por hora exacta («la de las 10:30»), si no la misma hora; por nombre (mejor coincidencia).
4. Si se nombró un paciente que no está ese día: buscador global de citas (la próxima, o la última).
5. **Una** → sigue. **Varias** → lista y pregunta cuál. **Ninguna** → lo dice (y para pedidos de paciente, sigue con 3.4).
6. La elegida queda en **foco** y se retoma lo pedido.

| Acción | Ejemplos ES | Ejemplos EN | Pasos |
| --- | --- | --- | --- |
| Seleccionar / ir a la cita | «la cita de Ana», «mostrame la cita de las 10», «andá a la cita de Juan del jueves», «seleccioná la de Pérez» | «Ana's appointment», «go to the 10 o'clock» | Encontrar → ⟶ salta, resalta y abre el detalle. Queda en foco |

### 3.2 Menú de la cita (clic derecho)

Todas usan la cita encontrada (3.1) o la del foco.

| Acción | Ejemplos ES | Ejemplos EN | Pasos |
| --- | --- | --- | --- |
| Estado | «confirmó», «Ana llegó», «llegó tarde», «pasó a consulta / en curso», «terminó / completada», «atendida tarde», «no vino / no asistió», «pendiente», «agendada» | «confirmed», «arrived», «arrived late», «in progress», «completed», «no show» | Encontrar → «¿La paso a X?» → ⟶ estado (mismas reglas y avisos del menú) |
| Cancelar con motivo | «cancelala», «canceló con tiempo», «canceló tarde», «sin aviso», «la cancela el doctor / la clínica» | «cancel it», «cancelled late» | Encontrar → si falta el motivo lo pregunta → confirmación de peligro → ⟶ cancelar |
| Editar | «editá la cita de Ana», «abrí la cita para editar» | «edit Ana's appointment» | Encontrar → ⟶ Editar (formulario de siempre) → sección 3.3 |
| Eliminar | «borrá la cita de Ana», «eliminala» | «delete it» | Encontrar → confirmación de peligro → ⟶ eliminar |
| Mover a otra fecha / hora | «pasala al viernes a las 11», «reprogramá la de Ana para el lunes», «movela a las 15» | «move it to Friday at 11», «reschedule» | Encontrar → ⟶ Reprogramar completo → «¿Guardo?» |
| Duración | «que dure 45 minutos», «alargala a una hora», «acortala a 30» | «make it 45 minutes» | Encontrar → confirma → ⟶ duración |
| Doctor | «pasá la cita al doctor Pérez», «cambiale el doctor» (sin decir cuál → pregunta de la lista) | «assign Dr. Pérez» | Encontrar → doctor (varios → pregunta) → confirma → ⟶ |
| Consultorio / agenda | «pasala al sillón 2», «cambiala de consultorio» | «move it to chair 2» | Igual que doctor |
| Color | «ponela en rojo», «sin color», «pintala de verde» | «make it red», «clear color» | Encontrar → confirma → ⟶ color |
| Abrir del paciente | «abrí su cuenta», «estado de cuenta», «historia clínica», «imágenes y archivos», «historial de citas», «datos del paciente», «sesión clínica», «cobrale» | «open the account», «medical history», «files», «appointment history», «patient details», «charge» | Encontrar → ⟶ lo mismo del menú (permisos de la pantalla) |
| Aviso (pop-up) | «continuar», «aceptar», «sí, seguí», «cancelar», «volver» | «continue», «ok», «cancel», «go back» | ⟶ botón principal o cancelar del aviso abierto |

### 3.3 Dentro del editor (formulario de la cita)

Con el formulario abierto (dar, editar o reprogramar), la voz sabe que **está parada ahí**: cada frase cambia campos y vuelve a preguntar. Lo que no se toca queda igual.

| Campo | Ejemplos ES | Ejemplos EN |
| --- | --- | --- |
| Fecha | «el viernes», «cambiá la fecha al 3 de diciembre» | «on Friday» |
| Hora de inicio | «a las 11», «que empiece 10 y media» | «at 11» |
| Hora de fin | «que termine a las 12», «hasta las 11:30» | «ends at noon» |
| Doctor | «con el doctor Pérez», «sin doctor» | «with Dr. Pérez» |
| Consultorio | «en el sillón 2», «consultorio 3» | «in chair 2» |
| Servicios | «agregá limpieza», «sacale el blanqueamiento», «solo control» | «add cleaning», «remove whitening» |
| Paciente | «el paciente es Juan Pérez», «cambiá el paciente a Ana» | «patient is…» |
| Notas | «nota: viene con la madre», «agregá en notas que trae estudios», «borrá las notas» | «note: …» |
| Guardar | «guardar», «actualizar», «sí», «listo» | «save», «update», «yes» |
| Cancelar | «cancelar», «cerrá sin guardar», «descartá» | «cancel», «discard» |

«No» deja el formulario abierto sin guardar (para seguir con el mouse).

### 3.4 Pacientes

| Acción | Ejemplos ES | Ejemplos EN | Pasos |
| --- | --- | --- | --- |
| Buscar paciente | «buscá el paciente Ana Gómez», «buscame la información de Juan Pérez» | «find patient…» | 1) Citas del paciente (buscador global) → varias: pregunta cuál → foco. 2) Sin citas: buscador de pacientes (el widget de la derecha) por nombre → varias: pregunta → abre la ficha. 3) Sin resultados: «No lo encontré por el nombre. Decime la cédula, el email o el teléfono» → busca por eso → abre |
| Ver de la cita | «estado de cuenta», «historia», «imágenes», «historial de citas», «datos» | | 3.2 «Abrir del paciente» |
| Resumen / preguntas | «dame un resumen del paciente», «¿qué tratamientos tiene?», «¿cuánto debe?», «¿cuándo vino por última vez?», «resumen de lo financiero» | «summarize this patient», «what does he owe» | Cita en foco (o la encuentra) → agente clínico de Mi consultorio (`ai/doctor/query`, canal voz) → lee la respuesta. Sin permiso de la cuenta, lo financiero no se responde |

### 3.5 Información del paciente (sin elegir una cita)

Preguntas que se contestan con los registros del paciente (lo que muestra su perfil y su estado de cuenta), **sin pedir que se elija una cita**. El paciente sale del foco o del nombre dicho: primero sus citas, después el buscador de pacientes y, si no, el documento, email o teléfono. Endpoints existentes: historial de citas (`users_appointments`), finanzas (`user_financial`), presupuestos/facturas/pagos (`user_quotes_invoices`, `user_payments`) y planes de tratamiento. Lo financiero solo con permiso de ver la cuenta del paciente. Módulo genérico: `src/lib/voice/patient-info.ts` + `src/services/patient-facts.ts`.

| Pregunta | Ejemplos ES | Ejemplos EN |
| --- | --- | --- |
| Veces que vino | «¿cuántas veces vino Juan?», «¿cuántas consultas tuvo?» | «how many times has Juan come», «how many visits» |
| Faltas y última falta | «¿cuántas veces faltó?», «¿cuándo fue la última vez que no vino?» | «how many no shows», «last no show» |
| Cancelaciones | «¿cuántas citas canceló?» | «how many cancellations» |
| Última visita | «¿cuál fue su última visita?» | «last visit» |
| Deuda | «¿cuánto debe?», «¿tiene deudas?», «¿está al día?» | «does he owe anything», «balance» |
| Pagos | «¿cuál fue el último pago?», «¿cuánto pagó?» | «last payment», «how much has he paid» |
| Presupuestos y facturas | «¿en qué estado están sus presupuestos?», «¿qué facturas tiene?» | «quotes status», «invoices» |
| Tratamientos | «¿qué tratamientos tiene en curso?», «¿cómo va su tratamiento?» | «treatments in progress» |
| Resumen | «resumen de Juan», «estadísticas», «¿qué sabemos de Juan?» | «summarize», «stats for», «tell me about» |

Las preguntas clínicas libres («¿qué alergias tiene?») van al agente clínico de Mi consultorio (`ai/doctor/query`).

### 3.6 Acciones del paciente

| Acción | Ejemplos ES | Ejemplos EN | Qué abre |
| --- | --- | --- | --- |
| Nuevo presupuesto | «creá un presupuesto para Juan», «nuevo presupuesto» | «create a quote for Juan», «new estimate» | Presupuesto rápido |
| Nueva factura | «hacé una factura para Juan», «facturale a Juan» | «new invoice for Juan», «invoice Juan» | Factura |
| Nuevo tratamiento | «creá un tratamiento para Juan» | «new treatment for Juan» | Tratamiento rápido (factura directa) |
| Sesión clínica | «registrá la sesión clínica» (de la cita) | «record the clinical session» | Sesión clínica de la cita |
| Cobro rápido | «cobrale a Juan», «cobro rápido» | «quick charge for Juan» | Asistente de cobro |

### 3.7 Crear y horarios

| Acción | Ejemplos ES | Ejemplos EN | Pasos |
| --- | --- | --- | --- |
| Nueva cita | «nueva cita para Ana el lunes a las 10 con el doctor Pérez, limpieza» | «new appointment for…» | Pregunta lo que falte (paciente, hora, doctor, tratamiento) → formulario completo → 3.3 |
| Bloquear horario | «bloqueá el lunes de 14 a 16 por reunión» | «block Monday 2 to 4» | Diálogo de siempre con la franja → «¿Bloqueo?» → ⟶ Confirmar |
| Habilitar horario | «habilitá el sábado de 9 a 13» | «enable Saturday 9 to 1» | Igual |
| Recordatorio / nota | «recordame mañana a las 9 llamar al laboratorio», «nota el viernes: falta material» | «remind me…» | Formulario con lo dictado → «¿Lo guardo?» |
| Recordatorio hecho / borrar | «marcá hecho el recordatorio del laboratorio», «borrá la nota del viernes» | | Encontrar (varios → pregunta) → confirma |
| Reasignar en lote | «reasigná las citas del doctor Pérez de mañana a la doctora Ruiz» | | Modo lotes con los filtros → confirma (fase 2) |

## 4. Tarjeta de voz

Compacta (letra chica, listas con scroll). Se ubica sola: abajo a la izquierda; con un diálogo abierto (editar o crear cita, un aviso), al costado donde haya lugar (izquierda o derecha); si no entra al costado, arriba o abajo sin taparlo. Se recalcula cuando el diálogo o la tarjeta cambian de tamaño. Tocarla no cierra el diálogo.

## 5. Pruebas

- `pnpm test:voice`: **la batería completa** (casi mil casos, es y en) en Node, sin navegador ni DEV. Se simula que se habla por el micrófono permanente, con la agenda simulada y el flujo de n8n real (solo el modelo simulado).
- Catálogo de casos: [voz-agenda-pruebas.md](voz-agenda-pruebas.md), generado con `pnpm test:voice:catalog`.
- En el navegador contra DEV: `e2e/tests/appointments/calendar-voice*.spec.ts`.
