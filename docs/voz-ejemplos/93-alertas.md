# Centro de alertas

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/93-alerts.spec.ts`

Centro de alertas: leer y filtrar (estado, prioridad), seleccionar, completar/ignorar (con motivo y confirmación), posponer (hasta cuándo), registrar llamada, nota, mail, WhatsApp (confirmado), abrir paciente; una, varias o todas.

**49 frases** en **33 pruebas que pasan** (es 41 · es-ES 1 · en 7). Pantallas: `/`, `/alerts`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## AL-READ · Leer y filtrar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cuántas alertas hay» | es | `/alerts` | «cuántas alertas hay» | **Centro de alertas** · Hay 5 alertas: 2 Cumpleaños, 1 Cobranza, 1 Laboratorio, 1 Recordatorios. |
| «qué alertas críticas hay» | es | `/alerts` | «qué alertas críticas hay» | **Centro de alertas** · Hay 1 alerta: 1 Laboratorio. |
| la lectura va en filas | es | `/alerts` | «leé las alertas» | **Centro de alertas** · Hay 5 alertas: 2 Cumpleaños, 1 Cobranza, 1 Laboratorio, 1 Recordatorios. |
| «mostrame las completadas» | es | `/alerts` | «mostrame las completadas» | **Centro de alertas** · Muestro las completadas. |
| «las ignoradas» | es | `/alerts` | «las ignoradas» | **Centro de alertas** · Muestro las ignoradas. |
| «solo las pendientes» | es | `/alerts` | «solo las pendientes» | **Centro de alertas** · Muestro las pendientes. |
| «ver todas» | es | `/alerts` | «ver todas» | **Centro de alertas** · Muestro todas. |
| «solo las críticas» | es | `/alerts` | «solo las críticas» | **Centro de alertas** · Solo las críticas. |
| «mostrame las de prioridad alta» | es | `/alerts` | «mostrame las de prioridad alta» | **Centro de alertas** · Solo las de prioridad alta. |
| «ver todas las prioridades» | es | `/alerts` | «ver todas las prioridades» | **Centro de alertas** · Todas las prioridades. |
| «actualizá las alertas» | es | `/alerts` | «actualizá las alertas» | **Centro de alertas** · Actualizo las alertas. |
| en «how many alerts are there» y «show me the completed alerts» | en | `/alerts` | «how many alerts are there» | **Alerts center** · There are 5 alerts: 2 Cumpleaños, 1 Cobranza, 1 Laboratorio, 1 Recordatorios. |
| 〃 | en | `/alerts` | «show me the completed alerts» | **Alerts center** · Showing completed ones. |

## AL-ACT · Actuar sobre alertas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «completá la de Carlos» confirma y completa | es | `/alerts` | «completá la de Carlos» | **Centro de alertas** · ¿Marco como completada Factura vencida (Carlos López)? |
| 〃 | es | `/alerts` | «sí» | **Centro de alertas** · Listo, completé Factura vencida (Carlos López). |
| «completá la primera» y «no»: no cambia nada | es | `/alerts` | «completá la primera» | **Centro de alertas** · ¿Marco como completada Cumpleaños (Juan Pérez)? |
| 〃 | es | `/alerts` | «no» | **Centro de alertas** · Listo, no hice ningún cambio. |
| «ignorá la del laboratorio porque ya llegó» con el motivo | es | `/alerts` | «ignorá la del laboratorio porque ya llegó» | **Centro de alertas** · ¿Ignoro Orden de laboratorio atrasada? |
| 〃 | es | `/alerts` | «sí» | **Centro de alertas** · Listo, ignoré Orden de laboratorio atrasada. |
| «ignorá la de Sofía» pregunta el motivo | es | `/alerts` | «ignorá la de Sofía» | **Centro de alertas** · ¿Por qué la ignoro? |
| 〃 | es | `/alerts` | «se atendió por teléfono» | **Centro de alertas** · ¿Ignoro Control pendiente (Sofía Castro)? |
| 〃 | es | `/alerts` | «sí» | **Centro de alertas** · Listo, ignoré Control pendiente (Sofía Castro). |
| «posponé las de cumpleaños hasta mañana» (varias, sin preguntar cuál) | es | `/alerts` | «posponé las de cumpleaños hasta mañana» | **Centro de alertas** · Pospuse 2 alertas hasta el 24/11 09:00. |
| «posponé la de Carlos una semana» | es | `/alerts` | «posponé la de Carlos una semana» | **Centro de alertas** · Pospuse Factura vencida (Carlos López) hasta el 30/11 09:00. |
| «posponé la de Juan» pregunta hasta cuándo | es | `/alerts` | «posponé la de Juan» | **Centro de alertas** · ¿Hasta cuándo la pospongo? |
| 〃 | es | `/alerts` | «hasta el lunes» | **Centro de alertas** · Pospuse Cumpleaños (Juan Pérez) hasta el 30/11 09:00. |
| «registrá una llamada a Carlos para mañana a las 10» | es | `/alerts` | «registrá una llamada a Carlos para mañana a las 10» | **Centro de alertas** · Agendé la llamada de Factura vencida (Carlos López) para el 24/11 10:00. |
| «agregá una nota a la de Carlos: pagará el viernes» | es | `/alerts` | «agregá una nota a la de Carlos: pagará el viernes» | **Centro de alertas** · Agregué la nota a Factura vencida (Carlos López). |
| «mandale un whatsapp a Juan» confirma y manda | es | `/alerts` | «mandale un whatsapp a Juan» | **Centro de alertas** · ¿Mando el WhatsApp a Juan Pérez? |
| 〃 | es | `/alerts` | «sí» | **Centro de alertas** · Mandé el WhatsApp. |
| sin teléfono ni plantilla: lo dice | es | `/alerts` | «mandale un whatsapp a la del laboratorio» | **Centro de alertas** · No se puede mandar WhatsApp: falta el teléfono o la plantilla. |
| «mandale un mail a Carlos» abre el mail | es | `/alerts` | «mandale un mail a Carlos» | **Centro de alertas** · Abrí el mail para escribirlo. |
| «abrí el paciente de la segunda» | es | `/alerts` | «abrí el paciente de la segunda» | **Centro de alertas** · Abrí a Carlos López. |
| «las de cumpleaños» con una sola acción por persona: pregunta cuál | es | `/alerts` | «mandale un mail a la de cumpleaños» | **Centro de alertas** · ¿Cuál? [Cumpleaños / Cumpleaños] |
| 〃 | es | `/alerts` | «la segunda» | **Centro de alertas** · Abrí el mail para escribirlo. |
| seleccionar y completar las seleccionadas | es | `/alerts` | «seleccioná la de Juan» | **Centro de alertas** · Seleccioné Cumpleaños (Juan Pérez). |
| 〃 | es | `/alerts` | «seleccioná la de Carlos» | **Centro de alertas** · Seleccioné Factura vencida (Carlos López). |
| 〃 | es | `/alerts` | «completá las seleccionadas» | **Centro de alertas** · ¿Marco como completada 2 alertas? |
| 〃 | es | `/alerts` | «sí» | **Centro de alertas** · Listo, completé 2 alertas. |
| «completá todas las críticas» | es | `/alerts` | «completá las críticas» | **Centro de alertas** · ¿Marco como completada Orden de laboratorio atrasada? |
| 〃 | es | `/alerts` | «sí» | **Centro de alertas** · Listo, completé Orden de laboratorio atrasada. |
| sin permiso: lo dice | es | `/alerts` | «completá la de Carlos» | **Centro de alertas** · No tenés permiso para hacer eso. |
| es-ES «pospón la de Carlos hasta mañana» | es-ES | `/alerts` | «pospón la de Carlos hasta mañana» | **Centro de alertas** · He pospuesto Factura vencida (Carlos López) hasta el 24/11 09:00. |
| en «complete the alert for Carlos», «yes», «snooze the alert for Juan until tomorrow» | en | `/alerts` | «complete the alert for Carlos» | **Alerts center** · Mark Factura vencida (Carlos López) as completed? |
| 〃 | en | `/alerts` | «yes» | **Alerts center** · Done, completed Factura vencida (Carlos López). |
| 〃 | en | `/alerts` | «snooze the alert for Juan until tomorrow» | **Alerts center** · Snoozed Cumpleaños (Juan Pérez) until 24/11 09:00. |
| en «send a whatsapp to Juan» and «yes» | en | `/alerts` | «send a whatsapp to Juan» | **Alerts center** · Shall I send the WhatsApp to Juan Pérez? |
| 〃 | en | `/alerts` | «yes» | **Alerts center** · Sent the WhatsApp. |

## AL-NAV · Llegar y actuar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «andá al centro de alertas y decime cuántas alertas hay» | es | `/` | «andá al centro de alertas y decime cuántas alertas hay» | **Centro de alertas** · Hay 5 alertas: 2 Cumpleaños, 1 Cobranza, 1 Laboratorio, 1 Recordatorios. |

