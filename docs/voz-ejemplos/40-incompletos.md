# Incompletos o mal dichos

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/40-incomplete-es.spec.ts`

Incompletos o mal dichos: pregunta lo que falta, nombres mal transcriptos, regla de oro (nunca se traba).

**32 frases** en **16 pruebas que pasan** (es 32 · es-ES 0 · en 0). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## N4.1 · Falta información: pregunta y sigue

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-400 «dame una cita» sin nada: pregunta paciente, hora… y abre el formulario | es | `/appointments` | «dame una cita para mañana» | **Nueva cita** · ¿Para qué paciente es? |
| 〃 | es | `/appointments` | «Sofía Castro» | **Nueva cita** · ¿A qué hora? |
| 〃 | es | `/appointments` | «a las 10» | **Nueva cita** · ¿Con qué doctor? Decí el nombre o el apellido, o «sin doctor». |
| 〃 | es | `/appointments` | «el doctor Pérez» | **Nueva cita** · ¿Qué tratamiento? Decí el nombre, o «ninguno». |
| 〃 | es | `/appointments` | «limpieza» | **Nueva cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| VZ-ES-401 «editá la cita» sin decir cuál (sin foco): pregunta cuál y sigue | es | `/appointments` | «editá la cita» | **Editar cita** · ¿Qué cita? Decí el paciente o la hora. |
| 〃 | es | `/appointments` | «la de Carlos López» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| VZ-ES-402 «cancelá la de las 10» sin motivo: pregunta el motivo | es | `/appointments` | «cancelá la de las 10» | **Estado de la cita** · ¿Por qué se cancela? [Cancelada con tiempo / Cancelada tarde / Cancelada sin aviso / Cancelada por el doctor / Cancelada por la clínica] |
| 〃 | es | `/appointments` | «avisó con tiempo» | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Cancelada. |
| VZ-ES-403 «bloqueá el lunes» sin horas: pregunta la franja | es | `/appointments` | «bloqueá el lunes» | **Bloquear horario** · ¿De qué hora a qué hora? Por ejemplo «de 14 a 16» o «todo el día». |
| VZ-ES-404 «resumen del paciente» sin cita en foco: pregunta de qué paciente | es | `/appointments` | «dame un resumen del paciente» | **Información del paciente** · ¿Para qué paciente es? |
| 〃 | es | `/appointments` | «Carlos López» | Información del paciente |
| VZ-ES-405 buscar paciente sin datos: pide cédula, email o teléfono | es | `/appointments` | «buscá el paciente» | **Buscar cita** · Busco «paciente». |

## N4.2 · Mal dicho o mal transcripto

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-410 «Juan Peres» (con s) encuentra a Juan Pérez | es | `/appointments` | «la cita de Juan Peres» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| VZ-ES-411 «carlos lopes llegó» sin tildes ni z | es | `/appointments` | «carlos lopes llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Llegó. |
| VZ-ES-412 números en palabras: «zoom al ciento cincuenta» | es | `/appointments` | «zoom al ciento cincuenta» | Zoom al 150 %. |
| VZ-ES-413 «slots de quince minutos» | es | `/appointments` | «slots de quince minutos» | **Configuración de la agenda** · Listo: slots de 15 minutos. |
| VZ-ES-414 muletillas: «eh bueno dale andá a mañana» | es | `/appointments` | «eh bueno dale andá a mañana» | Calendario en mar 24/11. |
| VZ-ES-415 respuestas que no se entienden: insiste y después lo deja sin cambiar nada | es | `/appointments` | «Juan Pérez llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «mmm» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «este» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «ehh» | **Estado de la cita** · Listo, no hice ningún cambio. |
| VZ-ES-416 una frase que nadie entiende (ni la IA): muestra ejemplos sin romper nada | es | `/appointments` | «blablablá trululú» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá al jueves», «¿qué tengo mañana?», «Ana Gómez llegó», «nueva cita para Ana Gómez el lunes a las 10», «poné la cita de Ana en rojo», «bloqueá el lunes de 14 a 16» o «recordame mañana a l… |
| 〃 | es | `/appointments` | «vista día» | **Calendario** · Listo, vista de día. |
| VZ-ES-417 la IA no responde (error de red): «No entendí» y se sigue usando | es | `/appointments` | «hacé algo con la caída del sistema» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá al jueves», «¿qué tengo mañana?», «Ana Gómez llegó», «nueva cita para Ana Gómez el lunes a las 10», «poné la cita de Ana en rojo», «bloqueá el lunes de 14 a 16» o «recordame mañana a l… |
| 〃 | es | `/appointments` | «vista mes» | **Calendario** · Listo, vista de mes. |

## N4.3 · Regla de oro: un paso que falla nunca deja trabada la voz

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-420 una acción de la pantalla que tira error: avisa y la voz sigue | es | `/appointments` | «Juan Pérez llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **No se pudo completar** · Ups, algo falló y no pude seguir con eso. No se cambió nada más. ¿Probamos de otra forma? Decime otra cosa o hacelo a mano. |
| 〃 | es | `/appointments` | «vista día» | **Calendario** · Listo, vista de día. |
| VZ-ES-421 sin la pantalla de citas cargada: lo dice y no se cuelga | es | `/appointments` | «vista día» | **Calendario** · Los comandos del calendario funcionan con la pantalla de citas abierta. |

