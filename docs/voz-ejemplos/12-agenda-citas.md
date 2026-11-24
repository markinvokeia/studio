# Agenda: la cita

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/12-appointments-es.spec.ts`

Atómicos en español sobre una cita: encontrar, estados, cancelar con motivo, borrar, color, doctor, consultorio, duración, mover, abrir.

**52 frases** en **31 pruebas que pasan** (es 52 · es-ES 0 · en 0). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## N1.10 · Encontrar y seleccionar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-110 «la cita de Juan Pérez» la selecciona y queda en foco | es | `/appointments` | «Invoke la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| VZ-ES-111 «mostrame la cita de las 15» por hora | es | `/appointments` | «Invoke mostrame la cita de las 15» | **Cita** · La cita de Carlos López, hoy a las 15:00. |
| VZ-ES-112 «la cita de María de mañana» por día | es | `/appointments` | «Invoke la cita de María de mañana» | **Cita** · La cita de María Rodríguez, mañana a las 11:00. |
| VZ-ES-113 dos «Ana» hoy: pregunta cuál y «la segunda» elige 10:30 | es | `/appointments` | «Invoke la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «la segunda» | **Cita** · La cita de Ana Martínez, hoy a las 10:30. |
| VZ-ES-114 dos «Ana»: «la de las 9» elige por hora | es | `/appointments` | «Invoke la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «la de las 9» | **Cita** · La cita de Ana Gómez, hoy a las 09:00. |
| VZ-ES-115 dos «Ana»: «Martínez» elige por nombre | es | `/appointments` | «Invoke la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «Martínez» | **Cita** · La cita de Ana Martínez, hoy a las 10:30. |
| VZ-ES-116 dos «Ana»: «la última» elige la de abajo | es | `/appointments` | «Invoke la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «la última» | **Cita** · La cita de Ana Martínez, hoy a las 10:30. |
| VZ-ES-117 una que no existe lo dice | es | `/appointments` | «Invoke la cita de Ricardo Montes» | **Cita** · No encontré la cita ricardo montes hoy. |
| VZ-ES-118 «olvidá esa cita» limpia el foco | es | `/appointments` | «Invoke la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «olvidá esa cita» | **Comando de voz** · Listo, ya no estoy con ninguna cita. |

## N1.11 · Estados (menú de la cita)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-12x «Juan Pérez llegó» → arrived (confirma y «sí» lo aplica) | es | `/appointments` | «Invoke Juan Pérez llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |
| VZ-ES-12x «Carlos López confirmó» → confirmed (confirma y «sí» lo aplica) | es | `/appointments` | «Invoke Carlos López confirmó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Confirmada. |
| VZ-ES-12x «Juan Pérez llegó tarde» → arrived_late (confirma y «sí» lo aplica) | es | `/appointments` | «Invoke Juan Pérez llegó tarde» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó tarde. |
| VZ-ES-12x «Juan Pérez pasó a consulta» → in_progress (confirma y «sí» lo aplica) | es | `/appointments` | «Invoke Juan Pérez pasó a consulta» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en En curso. |
| VZ-ES-12x «marcá como completada la de Carlos López» → completed (confirma y «sí» lo aplica) | es | `/appointments` | «Invoke marcá como completada la de Carlos López» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Completada. |
| VZ-ES-12x «Carlos López no vino» → no_show (confirma y «sí» lo aplica) | es | `/appointments` | «Invoke Carlos López no vino» | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en No asistió. |
| VZ-ES-127 «no» deja el estado como estaba | es | `/appointments` | «Invoke Juan Pérez llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «no» | **Estado de la cita** · Listo, no hice ningún cambio. |
| VZ-ES-128 cancelar con motivo dicho: «Carlos López canceló con tiempo» | es | `/appointments` | «Invoke Carlos López canceló con tiempo» | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Cancelada. |
| VZ-ES-129 cancelar sin motivo lo pregunta | es | `/appointments` | «Invoke cancelá la cita de Carlos López» | **Estado de la cita** · ¿Por qué se cancela? [Cancelada con tiempo / Cancelada tarde / Cancelada sin aviso / Cancelada por el doctor / Cancelada por la clínica] |
| 〃 | es | `/appointments` | «canceló tarde» | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Cancelada. |

## N1.12 · Menú: borrar, color, doctor, consultorio, duración, mover

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-130 borrá la cita de Carlos López (confirmación de peligro) | es | `/appointments` | «Invoke borrá la cita de Carlos López» | **Borrar cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Borrar cita** · Listo, borré la cita de Carlos López. |
| VZ-ES-131 «poné la cita de Juan en rojo» | es | `/appointments` | «Invoke poné la cita de Juan en rojo» | **Color de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Color de la cita** · Listo, la cita de Juan Pérez quedó en rojo. |
| VZ-ES-132 «pasá la cita de Juan Pérez al doctor Gómez» | es | `/appointments` | «Invoke pasá la cita de Juan Pérez al doctor Gómez» | **Cambiar doctor** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Cambiar doctor** · Listo, la cita de Juan Pérez quedó con Dr. Pablo Gómez. |
| VZ-ES-133 «pasá la cita de Carlos López al sillón 2» | es | `/appointments` | «Invoke pasá la cita de Carlos López al sillón 2» | **Cambiar de agenda** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Cambiar de agenda** · Listo, la cita de Carlos López quedó en Sillón 2. |
| VZ-ES-134 «que la cita de Juan Pérez dure 45 minutos» | es | `/appointments` | «Invoke que la cita de Juan Pérez dure 45 minutos» | **Duración de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Duración de la cita** · Listo, la cita de Juan Pérez termina a las 10:45. |
| VZ-ES-135 «pasá la cita de Juan Pérez al viernes a las 11» abre Reprogramar completo | es | `/appointments` | «Invoke pasá la cita de Juan Pérez al viernes a las 11» | **Reprogramar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «sí» | **Reprogramar cita** · Listo, cita reprogramada. |

## N1.13 · Abrir lo del paciente

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-14x «abrí la cuenta de Juan Pérez» → accounts | es | `/appointments` | «Invoke abrí la cuenta de Juan Pérez» | **Estado de cuenta** · Abrí Estado de cuenta de Juan Pérez. |
| VZ-ES-14x «abrí la historia clínica de Juan Pérez» → history | es | `/appointments` | «Invoke abrí la historia clínica de Juan Pérez» | **Historia clínica** · Abrí Historia clínica de Juan Pérez. |
| VZ-ES-14x «mostrame las imágenes de Juan Pérez» → documents | es | `/appointments` | «Invoke mostrame las imágenes de Juan Pérez» | **Imágenes y archivos** · Abrí Imágenes y archivos de Juan Pérez. |
| VZ-ES-14x «abrí el historial de citas de Juan Pérez» → appointments | es | `/appointments` | «Invoke abrí el historial de citas de Juan Pérez» | **Historial de citas** · Abrí Historial de citas de Juan Pérez. |
| VZ-ES-14x «mostrame los datos del paciente Juan Pérez» → patient | es | `/appointments` | «Invoke mostrame los datos del paciente Juan Pérez» | **Datos del paciente** · Abrí Datos del paciente de Juan Pérez. |
| VZ-ES-146 «cobrale a Juan Pérez» abre el cobro rápido con su cita | es | `/appointments` | «Invoke cobrale a Juan Pérez» | **Cobro rápido** · Listo, abrí el cobro rápido de Juan Pérez. |
| VZ-ES-147 sin permiso de cuentas lo dice | es | `/appointments` | «Invoke abrí la cuenta de Juan Pérez» | **Estado de cuenta** · No tenés permiso para hacer eso. |

