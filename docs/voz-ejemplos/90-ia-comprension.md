# Comprensión con IA

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/90-ai-understanding.spec.ts`

Adjetivos y formas indirectas con IA, ambigüedad y confianza (pregunta con confianza media), es y en.

**55 frases** en **42 pruebas que pasan** (es 39 · es-ES 0 · en 16 · 40 contestadas por la IA simulada). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## AI-ES · tamaño, panel y configuración dicho con adjetivos

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «está todo apretadito, no veo nada» | es | `/appointments` | «está todo apretadito, no veo nada» · IA | Zoom al 130 %. |
| «ponelo enorme» | es | `/appointments` | «ponelo enorme» · IA | Zoom al 250 %. |
| «quedó gigante, bajale un poquito» | es | `/appointments` | «quedó gigante, bajale un poquito» · IA | Zoom al 90 %. |
| «quiero más espacio entre las horas» | es | `/appointments` | «quiero más espacio entre las horas» · IA | **Configuración de la agenda** · Listo: altura de la hora 100 px. |
| «la listita de la izquierda que se quede ahí» | es | `/appointments` | «la listita de la izquierda que se quede ahí» · IA | **Panel de agendas** · Listo, el panel de agendas queda fijo. |
| «sacame de encima la columna de agendas» | es | `/appointments` | «sacame de encima la columna de agendas» · IA | **Panel de agendas** · Listo, cerré el panel de agendas. |
| «mostrame solo cuando atendemos» | es | `/appointments` | «mostrame solo cuando atendemos» · IA | **Configuración de la agenda** · Listo: franja del horario de la clínica. |
| «hacelo más finito, de a diez» | es | `/appointments` | «hacelo más finito, de a diez» · IA | **Configuración de la agenda** · Listo: slots de 10 minutos. |
| «el finde no lo quiero ver» | es | `/appointments` | «el finde no lo quiero ver» · IA | **Configuración de la agenda** · Listo: ocultos: sábado, domingo. |
| «que siempre me abra mirando la semana entera» | es | `/appointments` | «que siempre me abra mirando la semana entera» · IA | **Configuración de la agenda** · Listo: vista predeterminada semana. |

## AI-ES · citas dichas de otra forma

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «Carlitos ya está sentado afuera» | es | `/appointments` | «Carlitos ya está sentado afuera» · IA | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Llegó. |
| «a Juan ya lo hicimos pasar al sillón» | es | `/appointments` | «a Juan ya lo hicimos pasar al sillón» · IA | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en En curso. |
| «el de las tres nos dejó plantados» | es | `/appointments` | «el de las tres nos dejó plantados» · IA | **Estado de la cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en No asistió. |
| «la de Juan ponela coloradita» | es | `/appointments` | «la de Juan ponela coloradita» · IA | **Color de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Color de la cita** · Listo, la cita de Juan Pérez quedó en rojo. |
| «al de las tres dale una hora y media larga» | es | `/appointments` | «al de las tres dale una hora y media larga» · IA | **Duración de la cita** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Duración de la cita** · Listo, la cita de Carlos López termina a las 16:30. |
| «el de las tres ya dura una hora, dejalo así» | es | `/appointments` | «el de las tres ya dura una hora, dejalo así» · IA | **Duración de la cita** · La cita de Carlos López ya dura 60 minutos. |
| «que a Carlos lo vea la Ruiz» | es | `/appointments` | «que a Carlos lo vea la Ruiz» · IA | **Cambiar doctor** · Decí «sí» para hacerlo o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Cambiar doctor** · Listo, la cita de Carlos López quedó con Dra. Laura Ruiz. |
| «sacá del medio lo de Carlos de hoy» | es | `/appointments` | «sacá del medio lo de Carlos de hoy» · IA | **Borrar cita** · Ojo: revisá que sea la cita correcta. «Sí» la cambia, «no» la deja como está. |
| 〃 | es | `/appointments` | «sí» | **Borrar cita** · Listo, borré la cita de Carlos López. |

## AI-ES · información y acciones dichas de otra forma

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cómo viene Juan con la guita» | es | `/appointments` | «cómo viene Juan con la guita» · IA | Información del paciente |
| «Juan es de faltar mucho?» | es | `/appointments` | «Juan es de faltar mucho?» · IA | Información del paciente |
| «contame todo de Juan» | es | `/appointments` | «contame todo de Juan» · IA | Información del paciente |
| «armale los números a Juan para lo que le falta» | es | `/appointments` | «armale los números a Juan para lo que le falta» · IA | **Nuevo presupuesto** · Listo, abrí un presupuesto nuevo para Juan Pérez. |
| «cobrale lo de hoy a Juan» | es | `/appointments` | «cobrale lo de hoy a Juan» | **Cobro rápido** · Listo, abrí el cobro rápido de Juan Pérez. |

## AI-EN · adjectives and indirect phrasing

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «everything is tiny I can barely see» | en | `/appointments` | «everything is tiny I can barely see» · IA | Zoom at 130%. |
| «make it huge» | en | `/appointments` | «make it huge» · IA | Zoom at 250%. |
| «keep that left list from disappearing» | en | `/appointments` | «keep that left list from disappearing» · IA | **Calendars panel** · Done, the calendars panel stays pinned. |
| «only when we are open» | en | `/appointments` | «only when we are open» · IA | **Calendar settings** · Done: clinic hours visible. |
| «I don't want to see the weekend» | en | `/appointments` | «I don't want to see the weekend» · IA | **Calendar settings** · Done: hidden: Saturday, Sunday. |
| «Carlos is sitting outside» | en | `/appointments` | «Carlos is sitting outside» · IA | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now Arrived. |
| «the three o clock stood us up» | en | `/appointments` | «the three o clock stood us up» · IA | **Appointment status** · Careful: check it is the right appointment. “Yes” changes it, “no” leaves it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now No-show. |
| «paint Juan's slot a reddish color» | en | `/appointments` | «paint Juan's slot a reddish color» · IA | **Appointment color** · Say “yes” to do it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment color** · Done, Juan Pérez’s appointment is now red. |
| «how's Juan doing money wise» | en | `/appointments` | «how's Juan doing money wise» · IA | Patient information |
| «tell me everything you have on Juan» | en | `/appointments` | «tell me everything you have on Juan» · IA | Patient information |
| «put together an estimate for Juan» | en | `/appointments` | «put together an estimate for Juan» | **New quote** · Done, I opened a new quote for Juan Pérez. |

## AI · Ambigüedad y confianza

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| AI-001 confianza media: pregunta «¿querés cambiar el zoom?» y «sí» lo hace | es | `/appointments` | «ponelo más grandote» · IA | **Comando de voz** · No estoy seguro: ¿querés cambiar el zoom? |
| 〃 | es | `/appointments` | «sí» | Zoom al 110 %. |
| AI-002 confianza media: «no» no hace nada | es | `/appointments` | «ponelo más grandote» · IA | **Comando de voz** · No estoy seguro: ¿querés cambiar el zoom? |
| 〃 | es | `/appointments` | «no» | **Comando de voz** · Listo, no hice ningún cambio. |
| AI-003 confianza alta: lo hace sin preguntar | es | `/appointments` | «ponelo más grandote» · IA | Zoom al 110 %. |
| AI-004 confianza baja: no adivina y lo dice | es | `/appointments` | «ponelo más grandote» · IA | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá al jueves», «¿qué tengo mañana?», «Ana Gómez llegó», «nueva cita para Ana Gómez el lunes a las 10», «poné la cita de Ana en rojo», «bloqueá el lunes de 14 a 16» o «recordame mañana a l… |
| AI-005 un plan de varios pasos dudoso nombra lo que va a hacer | es | `/appointments` | «quiero verlo distinto y más cerquita» · IA | **Comando de voz** · No estoy seguro: ¿querés cambiar la vista y cambiar el zoom? |
| AI-006 ids inventados por el modelo se descartan en n8n y en el navegador | es | `/appointments` | «que lo vea el doctor que vino nuevo» · IA | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá al jueves», «¿qué tengo mañana?», «Ana Gómez llegó», «nueva cita para Ana Gómez el lunes a las 10», «poné la cita de Ana en rojo», «bloqueá el lunes de 14 a 16» o «recordame mañana a l… |
| AI-007 la IA no puede confirmar ni guardar por su cuenta: un «form_save» sin formulario no hace nada | es | `/appointments` | «mandale nomás» · IA | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá al jueves», «¿qué tengo mañana?», «Ana Gómez llegó», «nueva cita para Ana Gómez el lunes a las 10», «poné la cita de Ana en rojo», «bloqueá el lunes de 14 a 16» o «recordame mañana a l… |

## AI-EN · Ambiguity

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| AI-EN-001 medium confidence asks first | en | `/appointments` | «make it chunkier» · IA | **Voice command** · I'm not sure: do you want to change the zoom? |
| 〃 | en | `/appointments` | «yes» | Zoom at 110%. |

