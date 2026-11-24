# Agenda: agendas, filtros y engranaje

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/11-toolbar-settings-es.spec.ts`

Atómicos en español: agendas, doctores, sedes, agrupar, panel, buscar, huecos, actualizar y todo el engranaje.

**83 frases** en **67 pruebas que pasan** (es 83 · es-ES 0 · en 0). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## N1.5 · Agendas, doctores y sedes

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-040 «qué agendas hay» lista y «la segunda» la muestra (modo personalizado) | es | `/appointments` | «Invoke qué agendas hay» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «la segunda» | **Opciones** · Listo, solo Sillón 2. |
| VZ-ES-041 «cambiá de agenda» y se elige por nombre | es | `/appointments` | «Invoke cambiá de agenda» | **Opciones** · ¿Qué agenda? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | es | `/appointments` | «ortodoncia» | **Opciones** · Listo, solo Ortodoncia. |
| VZ-ES-042 «mostrá la agenda ortodoncia» directo | es | `/appointments` | «Invoke solo la agenda ortodoncia» | **Filtros del calendario** · Listo, solo Ortodoncia. |
| VZ-ES-043 «solo el doctor Pérez» filtra doctores | es | `/appointments` | «Invoke solo el doctor Pérez» | **Filtros del calendario** · Listo, solo Dr. Martín Pérez. |
| VZ-ES-044 «todos los doctores» saca el filtro | es | `/appointments` | «Invoke solo el doctor Pérez» | **Filtros del calendario** · Listo, solo Dr. Martín Pérez. |
| 〃 | es | `/appointments` | «todos los doctores» | **Filtros del calendario** · Listo, muestro todo. |
| VZ-ES-045 «qué doctores hay» y «la de abajo» | es | `/appointments` | «Invoke qué doctores hay» | **Opciones** · ¿Qué doctor muestro? [Dr. Martín Pérez / Dra. Laura Ruiz / Dr. Pablo Gómez] |
| 〃 | es | `/appointments` | «la de abajo» | **Opciones** · Listo, solo Dr. Pablo Gómez. |

## N1.6 · Agrupar (modo Invoke)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-050 agrupá por doctor | es | `/appointments` | «Invoke agrupá por doctor» | **Calendario** · Listo, agrupado por doctor. |
| VZ-ES-051 sin agrupar | es | `/appointments` | «Invoke agrupá por agenda» | **Calendario** · Listo, agrupado por agenda. |
| 〃 | es | `/appointments` | «sin agrupar» | **Calendario** · Listo, sin agrupar. |
| VZ-ES-052 «sacá la sede Pocitos» saca sus agendas | es | `/appointments` | «Invoke sacá la sede Pocitos» | **Filtros del calendario** · Listo, saqué Pocitos. |

## N1.7 · Panel de agendas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-060 abrí el panel de agendas | es | `/appointments` | «Invoke abrí el panel de agendas» | **Panel de agendas** · Listo, abrí el panel de agendas. |
| VZ-ES-061 cerrá el panel | es | `/appointments` | «Invoke abrí el panel de agendas» | **Panel de agendas** · Listo, abrí el panel de agendas. |
| 〃 | es | `/appointments` | «cerrá el panel» | **Cerrar** · Listo, cerré: el panel de agendas. |
| VZ-ES-062 «dejá fijo el panel» lo fija y lo abre | es | `/appointments` | «Invoke dejá fijo el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| VZ-ES-063 «que el panel se esconda solo» lo suelta | es | `/appointments` | «Invoke dejá fijo el panel» | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| 〃 | es | `/appointments` | «que el panel se esconda solo» | **Panel de agendas** · Listo, el panel de agendas se esconde solo al elegir una agenda. |
| VZ-ES-064 en modo Invoke ofrece pasar a personalizado; «sí» cambia el modo y abre el panel | es | `/appointments` | «Invoke abrí el panel de agendas» | **Panel de agendas** · El panel de agendas es del modo personalizado. ¿Paso la agenda a modo personalizado? |
| 〃 | es | `/appointments` | «sí» | **Panel de agendas** · Listo, abrí el panel de agendas. |
| VZ-ES-065 en modo Invoke «no» no cambia nada | es | `/appointments` | «Invoke abrí el panel de agendas» | **Panel de agendas** · El panel de agendas es del modo personalizado. ¿Paso la agenda a modo personalizado? |
| 〃 | es | `/appointments` | «no» | **Panel de agendas** · Listo, no hice ningún cambio. |

## N1.8 · Buscar, huecos, consultas y actualizar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-070 buscá a Ana Gómez abre el buscador | es | `/appointments` | «Invoke buscá a Ana Gómez» | **Buscar cita** · Busco «ana gomez». |
| VZ-ES-071 cerrá la búsqueda | es | `/appointments` | «Invoke buscá a Ana Gómez» | **Buscar cita** · Busco «ana gomez». |
| 〃 | es | `/appointments` | «cerrá la búsqueda» | **Calendario** · Listo, cerré la búsqueda. |
| VZ-ES-072 ¿qué tengo hoy? lee la agenda del día | es | `/appointments` | «Invoke qué tengo hoy» | **Agenda · lun 23/11** · hoy hay 4 citas. |
| VZ-ES-073 ¿cuándo viene Pedro Sánchez? | es | `/appointments` | «Invoke cuándo viene Pedro Sánchez» | **Próxima cita** · La próxima cita de Pedro Sánchez es lunes 30 de noviembre a las 10:00, con Dr. Martín Pérez. |
| VZ-ES-074 actualizá | es | `/appointments` | «Invoke actualizá» | **Actualizar** · Listo, actualicé el calendario. |
| VZ-ES-075 ocultá los huecos | es | `/appointments` | «Invoke ocultá los huecos» | **Calendario** · Listo, oculté los huecos. |

## N1.9 · Engranaje (preferencias)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-080 abrí la configuración | es | `/appointments` | «Invoke abrí la configuración» | **Configuración de la agenda** · Listo, abrí la configuración. |
| VZ-ES-081 cerrá la configuración | es | `/appointments` | «Invoke abrí la configuración» | **Configuración de la agenda** · Listo, abrí la configuración. |
| 〃 | es | `/appointments` | «cerrá la configuración» | **Configuración de la agenda** · Listo, cerré la configuración. |
| VZ-ES-082 modo Invoke | es | `/appointments` | «Invoke poné el modo invoke» | **Configuración de la agenda** · Listo: modo Invoke. |
| VZ-ES-083 modo personalizado | es | `/appointments` | «Invoke poné el modo invoke» | **Configuración de la agenda** · Listo: modo Invoke. |
| 〃 | es | `/appointments` | «modo personalizado» | **Configuración de la agenda** · Listo: modo personalizado. |
| VZ-ES-084 «vista predeterminada día» → default_view day | es | `/appointments` | «Invoke vista predeterminada día» | **Configuración de la agenda** · Listo: vista predeterminada día. |
| VZ-ES-084 «que arranque en semana» → default_view week | es | `/appointments` | «Invoke que arranque en semana» | **Configuración de la agenda** · Listo: vista predeterminada semana. |
| VZ-ES-084 «por defecto 2 días» → default_view 2_days | es | `/appointments` | «Invoke por defecto 2 días» | **Configuración de la agenda** · Listo: vista predeterminada 2 días. |
| VZ-ES-084 «vista por defecto mes» → default_view month | es | `/appointments` | «Invoke vista por defecto mes» | **Configuración de la agenda** · Listo: vista predeterminada mes. |
| VZ-ES-084 «vista predeterminada agenda» → default_view agenda | es | `/appointments` | «Invoke vista predeterminada agenda» | **Configuración de la agenda** · Listo: vista predeterminada agenda. |
| VZ-ES-085 altura de la hora 120 | es | `/appointments` | «Invoke altura de la hora 120» | **Configuración de la agenda** · Listo: altura de la hora 120 px. |
| VZ-ES-086 hora más alta (un paso) | es | `/appointments` | «Invoke horas más altas» | **Configuración de la agenda** · Listo: altura de la hora 100 px. |
| VZ-ES-087 la altura de la hora la más grande | es | `/appointments` | «Invoke la altura de la hora la más grande» | **Configuración de la agenda** · Listo: altura de la hora 200 px. |
| VZ-ES-088 la altura de la hora la más chica | es | `/appointments` | «Invoke la altura de la hora la más chica» | **Configuración de la agenda** · Listo: altura de la hora 60 px. |
| VZ-ES-089 «slots de 10 minutos» → 10 | es | `/appointments` | «Invoke slots de 10 minutos» | **Configuración de la agenda** · Listo: slots de 10 minutos. |
| VZ-ES-089 «slots de 15» → 15 | es | `/appointments` | «Invoke slots de 15» | **Configuración de la agenda** · Listo: slots de 15 minutos. |
| VZ-ES-089 «intervalos de 30 minutos» → 30 | es | `/appointments` | «Invoke intervalos de 30 minutos» | **Configuración de la agenda** · Listo: slots de 30 minutos. |
| VZ-ES-089 «slots de una hora» → 60 | es | `/appointments` | «Invoke slots de una hora» | **Configuración de la agenda** · Listo: slots de 60 minutos. |
| VZ-ES-089 «slots de 5 minutos» → 5 | es | `/appointments` | «Invoke slots de 5 minutos» | **Configuración de la agenda** · Listo: slots de 5 minutos. |
| VZ-ES-090 sede por defecto Pocitos | es | `/appointments` | «Invoke sede por defecto Pocitos» | **Configuración de la agenda** · Listo: sede por defecto Pocitos. |
| VZ-ES-091 sede por defecto todas | es | `/appointments` | «Invoke sede por defecto Pocitos» | **Configuración de la agenda** · Listo: sede por defecto Pocitos. |
| 〃 | es | `/appointments` | «sede por defecto todas» | **Configuración de la agenda** · Listo: todas las sedes por defecto. |
| VZ-ES-092 sede por defecto desconocida pregunta cuál | es | `/appointments` | «Invoke sede por defecto Carrasco» | **Configuración de la agenda** · ¿Qué sede? [Centro / Pocitos] |
| 〃 | es | `/appointments` | «la primera» | **Configuración de la agenda** · Listo: sede por defecto Centro. |
| VZ-ES-093 «título de la cita hora paciente y notas» | es | `/appointments` | «Invoke título de la cita hora paciente y notas» | **Configuración de la agenda** · Listo: título: hora, paciente y notas. |
| VZ-ES-093 «formato del título paciente tratamiento y hora» | es | `/appointments` | «Invoke formato del título paciente tratamiento y hora» | **Configuración de la agenda** · Listo: título: paciente, tratamiento y hora. |
| VZ-ES-093 «título hora paciente notas y tratamiento» | es | `/appointments` | «Invoke título hora paciente notas y tratamiento» | **Configuración de la agenda** · Listo: título: hora, paciente, notas y tratamiento. |
| VZ-ES-093 «título hora tratamiento paciente y notas» | es | `/appointments` | «Invoke título hora tratamiento paciente y notas» | **Configuración de la agenda** · Listo: título: hora, tratamiento, paciente y notas. |
| VZ-ES-094 ocultá los sábados y domingos | es | `/appointments` | «Invoke ocultá los sábados y domingos» | **Configuración de la agenda** · Listo: ocultos: sábado, domingo. |
| VZ-ES-095 ocultá el fin de semana y después mostrá los sábados | es | `/appointments` | «Invoke ocultá el fin de semana» | **Configuración de la agenda** · Listo: ocultos: sábado, domingo. |
| 〃 | es | `/appointments` | «mostrá los sábados» | **Configuración de la agenda** · Listo: ocultos: domingo. |
| VZ-ES-096 mostrá todos los días | es | `/appointments` | «Invoke ocultá los lunes» | **Configuración de la agenda** · Listo: ocultos: lunes. |
| 〃 | es | `/appointments` | «mostrá todos los días» | **Configuración de la agenda** · Listo: se ven todos los días. |
| VZ-ES-097 franja horaria completa | es | `/appointments` | «Invoke franja horaria completa» | **Estado de la cita** · No encontré la cita franja horaria hoy. |
| VZ-ES-098 horario de la clínica | es | `/appointments` | «Invoke mostrá el horario de la clínica» | **Configuración de la agenda** · Listo: franja del horario de la clínica. |
| VZ-ES-099 rango personalizado de 8 a 6 (hasta las 18) | es | `/appointments` | «Invoke rango personalizado de 8 a 6» | **Configuración de la agenda** · Listo: franja de 08:00 a 18:00. |
| VZ-ES-100 «activá colores por estado» → color_by_status true | es | `/appointments` | «Invoke activá colores por estado» | **Configuración de la agenda** · Listo: colores por estado activado. |
| VZ-ES-100 «sin colores por estado» → color_by_status false | es | `/appointments` | «Invoke sin colores por estado» | **Configuración de la agenda** · Listo: colores por estado desactivado. |
| VZ-ES-100 «activá verificar disponibilidad» → check_availability true | es | `/appointments` | «Invoke activá verificar disponibilidad» | **Configuración de la agenda** · Listo: verificar disponibilidad activado. |
| VZ-ES-100 «desactivá verificar disponibilidad» → check_availability false | es | `/appointments` | «Invoke desactivá verificar disponibilidad» | **Configuración de la agenda** · Listo: verificar disponibilidad desactivado. |
| VZ-ES-100 «bloqueá fuera de horario» → block_unavailable true | es | `/appointments` | «Invoke bloqueá fuera de horario» | **Configuración de la agenda** · Listo: bloquear fuera de horario activado. |
| VZ-ES-100 «permití agendar fuera de horario» → block_unavailable false | es | `/appointments` | «Invoke permití agendar fuera de horario» | **Configuración de la agenda** · Listo: bloquear fuera de horario desactivado. |
| VZ-ES-100 «filtrá los doctores por servicio» → filter_doctors_by_service true | es | `/appointments` | «Invoke filtrá los doctores por servicio» | **Configuración de la agenda** · Listo: filtrar doctores por servicio activado. |
| VZ-ES-100 «no filtres los doctores por servicio» → filter_doctors_by_service false | es | `/appointments` | «Invoke no filtres los doctores por servicio» | **Configuración de la agenda** · Listo: filtrar doctores por servicio desactivado. |
| VZ-ES-100 «crear citas en el calendario» → inline_appointment_creation true | es | `/appointments` | «Invoke crear citas en el calendario» | **Configuración de la agenda** · Listo: crear citas en el calendario activado. |
| VZ-ES-100 «que abra el modal» → inline_appointment_creation false | es | `/appointments` | «Invoke que abra el modal» | **Configuración de la agenda** · Listo: crear citas en el calendario desactivado. |
| VZ-ES-100 «activá la vista previa en vivo» → inline_draft_live_preview true | es | `/appointments` | «Invoke activá la vista previa en vivo» | **Configuración de la agenda** · Listo: vista previa en vivo activado. |
| VZ-ES-100 «apagá la vista previa en vivo» → inline_draft_live_preview false | es | `/appointments` | «Invoke apagá la vista previa en vivo» | **Configuración de la agenda** · Listo: vista previa en vivo desactivado. |
| VZ-ES-101 varias juntas: «slots de 15 y vista predeterminada semana» | es | `/appointments` | «Invoke slots de 15 y vista predeterminada semana» | **Configuración de la agenda** · Listo: vista predeterminada semana, slots de 15 minutos. |
| VZ-ES-102 si no se puede guardar lo dice | es | `/appointments` | «Invoke slots de 10 minutos» | **Configuración de la agenda** · No se pudo guardar la configuración. Probá de nuevo. |
| VZ-ES-103 no deja ocultar todos los días | es | `/appointments` | «Invoke ocultá los lunes martes miércoles jueves viernes sábados y domingos» | **Configuración de la agenda** · No se pueden ocultar todos los días. |

