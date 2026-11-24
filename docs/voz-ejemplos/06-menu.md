# Menú principal (navegar)

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/06-navigation.spec.ts`

Menú principal desde cualquier página: «andá a…», «abrí…», «go to…»; cada destino en es/es-ES/en; permisos; ambigüedad; ir y seguir en la página nueva; cambio de contexto; IA solo si no se nombró tal cual.

**45 frases** en **35 pruebas que pasan** (es 40 · es-ES 2 · en 3 · 7 contestadas por la IA simulada). Pantallas: `/`, `/appointments`, `/patients`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## NV · Ir a otra página

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| NV-001 desde la agenda «andá a pacientes»: va y cambia el contexto | es | `/appointments` | «andá a pacientes» | **Menú** · Abro Pacientes. |
| NV-002 «llevame a reportes de deudores» | es | `/` | «llevame a reportes de deudores» | **Menú** · Abro Deudores. |
| NV-003 desde otra página «andá a la agenda»: llega con la voz de la agenda | es | `/patients` | «andá a la agenda» | **Menú** · Abro Citas. |
| NV-004 ya está ahí: lo dice y no navega | es | `/appointments` | «andá a la agenda» | **Menú** · Ya estás en Citas. |
| NV-005 sin permiso: lo dice y no navega | es | `/appointments` | «andá a pacientes» | **Menú** · No tenés acceso a Pacientes. |
| NV-006 ambiguo: pregunta entre los dos y va al elegido | es | `/` | «andá a tratamientos» | **Menú** · ¿A cuál querés ir? [Tratamientos Realizados / Tratamientos en Curso] |
| 〃 | es | `/` | «los que están en curso» | **Menú** · Abro Tratamientos en Curso. |
| NV-007 ambiguo por número | es | `/` | «andá a tratamientos» | **Menú** · ¿A cuál querés ir? [Tratamientos Realizados / Tratamientos en Curso] |
| 〃 | es | `/` | «el primero» | **Menú** · Abro Tratamientos Realizados. |
| NV-008 sin IA: lo local alcanza | es | `/` | «andá a la caja» | **Menú** · Abro Caja. |
| NV-009 «abrí la caja» desde otra página | es | `/patients` | «abrí la caja» | **Panel derecho** · Te llevo a Caja para abrirla. |
| NV-010 el nombre solo de varias palabras: «centro de alertas» | es | `/` | «centro de alertas» | **Menú** · Abro Centro de Alertas. |
| NV-011 «volvé al inicio» | es | `/appointments` | «volvé al inicio» | **Menú** · Abro Panel de Control. |
| NV-012 es-ES «ve a pacientes» (tú) | es-ES | `/` | «ve a pacientes» | **Menú** · No tienes acceso a Pacientes. |
| NV-013 es-ES «llévame a la caja» | es-ES | `/` | «llévame a la caja» | **Menú** · Abro Caja. |

## NV-CHAIN · Primero va, después sigue en la página nueva

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| NV-CH-001 «andá a la agenda y mostrame mañana» desde pacientes | es | `/patients` | «andá a la agenda y mostrame mañana» | Calendario en mar 24/11. |
| NV-CH-002 «llevame a la agenda y después poné vista mes» | es | `/` | «llevame a la agenda y después poné vista mes» | **Calendario** · Listo, vista de mes. |
| NV-CH-003 ya en la agenda: «andá a la agenda y poné vista día» hace solo lo segundo | es | `/appointments` | «andá a la agenda y poné vista día» | **Calendario** · Listo, vista de día. |
| NV-CH-004 lo de la agenda no corre en otra página: «andá a pacientes y poné vista mes» | es | `/appointments` | «andá a pacientes y poné vista mes» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «buscá a Juan Pérez», «solo los deudores», «nueva sesión» o «¿cuánto debe?». |
| NV-CH-005 en «go to the calendar and switch to month view» | en | `/` | «go to the calendar and switch to month view» | **Calendar** · Done, month view. |
| NV-CH-006 en «take me to the calendar, then go to tomorrow» | en | `/patients` | «take me to the calendar, then go to tomorrow» | Calendar on Tue 24/11. |
| NV-CH-007 sin permiso no sigue con el resto | es | `/` | «andá a pacientes y bajá» | **Menú** · No tenés acceso a Pacientes. |

## NV-CTX · Ir a otra página es un cambio de contexto

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| NV-CTX-001 suelta la cita en foco | es | `/appointments` | «la cita de Carlos» | **Cita** · La cita de Carlos López, hoy a las 15:00. |
| 〃 | es | `/appointments` | «andá a la caja» | **Menú** · Abro Caja. |
| NV-CTX-002 con una ventana abierta: la cierra y va | es | `/` | «andá a la caja» | **Menú** · Abro Caja. |
| NV-CTX-003 con una pregunta abierta: pregunta si deja lo que se estaba haciendo | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «andá a la caja» | **¿Cambiamos de tarea?** · Estábamos con «la cita de Ana». ¿Lo dejo para hacer «andá a la caja»? |
| 〃 | es | `/appointments` | «sí» | **Menú** · Abro Caja. |
| NV-CTX-004 con una pregunta abierta, «no»: sigue con lo de antes | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «andá a la caja» | **¿Cambiamos de tarea?** · Estábamos con «la cita de Ana». ¿Lo dejo para hacer «andá a la caja»? |
| 〃 | es | `/appointments` | «no» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «la segunda» | **Cita** · La cita de Ana Martínez, hoy a las 10:30. |
| NV-CTX-005 en la agenda «abrí la configuración» es el engranaje, no la configuración del negocio | es | `/appointments` | «abrí la configuración» | **Configuración de la agenda** · Listo, abrí la configuración. |
| NV-CTX-006 en la agenda «mostrame las citas de hoy» sigue siendo de la agenda | es | `/appointments` | «mostrame las citas de hoy» | **Agenda · lun 23/11** · hoy hay 4 citas. |
| NV-CTX-007 en otra página se puede seguir hablando con la voz general (desplazarse) | es | `/` | «andá a pacientes» | **Menú** · Abro Pacientes. |
| 〃 | es | `/patients` | «bajá» | **Desplazar** · Bajé. |

## NV-AI · Con IA solo cuando lo dicho no es un nombre del menú

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| NV-AI-001 «llevame donde veo quién nos debe plata» → Deudores | es | `/` | «llevame donde veo quién nos debe plata» · IA | **Menú** · Abro Deudores. |
| NV-AI-002 desde la agenda: primero la IA de la agenda (no es suyo), después la general | es | `/appointments` | «llevame donde veo quién nos debe plata» · IA | **Menú** · Abro Deudores. |
| NV-AI-003 la IA no puede inventar un destino | es | `/` | «llevame donde veo quién nos debe plata» · IA | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «¿cuánto producimos hoy?», «resumen del día» o «mostrame el mes pasado». |
| NV-AI-004 a la IA solo le llegan los destinos con permiso | es | `/` | «llevame a donde están las fichas de la gente» · IA | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «¿cuánto producimos hoy?», «resumen del día» o «mostrame el mes pasado». |
| NV-AI-005 con lo que sigue: va y lo hace en la página nueva | es | `/` | «llevame a donde se ven los turnos y poné vista mes» · IA | **Calendario** · Listo, vista de mes. |
| NV-AI-006 confianza media: pregunta antes | es | `/` | «mostrame dónde está la plata» · IA | **Comando de voz** · No estoy seguro: ¿querés ir a otra sección del menú? |
| 〃 | es | `/` | «sí» | **Menú** · Abro Caja. |
| NV-AI-007 una charla de la sala no se le manda a la IA | es | `/` | «qué calor que hace hoy» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «¿cuánto producimos hoy?», «resumen del día» o «mostrame el mes pasado». |
| NV-AI-008 en «take me where I see today’s income» | en | `/` | «take me where I see the income» · IA | **Menu** · Opening Income by Period. |

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- NV-PARSE · Qué es ir a otra página (es) › «andá a pacientes» → Pacientes
- NV-PARSE · Qué es ir a otra página (es) › «ir a la caja» → Cashier
- NV-PARSE · Qué es ir a otra página (es) › «llevame a la agenda» → Appointments
- NV-PARSE · Qué es ir a otra página (es) › «andá al calendario» → Appointments
- NV-PARSE · Qué es ir a otra página (es) › «quiero ir a los turnos» → Appointments
- NV-PARSE · Qué es ir a otra página (es) › «vamos al centro de alertas» → AlertsCenter
- NV-PARSE · Qué es ir a otra página (es) › «andá a mi consultorio» → DoctorWorkspace
- NV-PARSE · Qué es ir a otra página (es) › «volvé al inicio» → Dashboard
- NV-PARSE · Qué es ir a otra página (es) › «ir al panel de control» → Dashboard
- NV-PARSE · Qué es ir a otra página (es) › «llevame a reportes de deudores» → ReportDeudores
- NV-PARSE · Qué es ir a otra página (es) › «andá al reporte de cierre de caja» → ReportCierreCaja
- NV-PARSE · Qué es ir a otra página (es) › «navegá a facturas» → Invoices
- NV-PARSE · Qué es ir a otra página (es) › «andá a presupuestos» → Quotes
- NV-PARSE · Qué es ir a otra página (es) › «andá a los presupuestos de compra» → PurchaseQuotes
- NV-PARSE · Qué es ir a otra página (es) › «entrá a órdenes de laboratorio» → LabOrders
- NV-PARSE · Qué es ir a otra página (es) › «pasame al laboratorio» → LabOrders
- NV-PARSE · Qué es ir a otra página (es) › «andá a la pantalla de estudios» → Studies
- NV-PARSE · Qué es ir a otra página (es) › «ir a configuración del negocio» → BusinessSetup
- NV-PARSE · Qué es ir a otra página (es) › «andá a doctores» → Doctors
- NV-PARSE · Qué es ir a otra página (es) › «llevame a las sedes» → Sedes
- NV-PARSE · Qué es ir a otra página (es) › «andá a facturación y cobranza» → ReportFactCobranza
- NV-PARSE · Qué es ir a otra página (es) › «andá a la sección de proveedores» → Providers
- NV-PARSE · Qué es ir a otra página (es) › «quiero ir a la pantalla tv» → TVDisplay
- NV-PARSE · Qué es ir a otra página (es) › «ir a sesiones de caja» → CashSessions
- NV-PARSE · Qué es ir a otra página (es) › «andá a ventas» → Sales
- NV-PARSE · Qué es ir a otra página (es) › «ir a usuarios» → SystemUsers
- NV-PARSE · Qué es ir a otra página (es) › «andá a monedas» → Currencies
- NV-PARSE · Qué es ir a otra página (es) › «abrí la caja» → Cashier
- NV-PARSE · Qué es ir a otra página (es) › «mostrame los reportes» → Reports
- NV-PARSE · Qué es ir a otra página (es) › «abrí el centro de alertas» → AlertsCenter
- NV-PARSE · Qué es ir a otra página (es) › «quiero ver los deudores» → ReportDeudores
- NV-PARSE · Qué es ir a otra página (es) › «centro de alertas» → AlertsCenter
- NV-PARSE · Qué es ir a otra página (es) › «mi consultorio» → DoctorWorkspace
- NV-PARSE · Qué es ir a otra página (es) › «andá a pacientes y buscá a Juan» → Pacientes + «buscá a Juan»
- NV-PARSE · Qué es ir a otra página (es) › «andá a la agenda y mostrame mañana» → Appointments + «mostrame mañana»
- NV-PARSE · Qué es ir a otra página (es) › «ir a la caja, abrí la caja» → Cashier + «abrí la caja»
- NV-PARSE · Qué es ir a otra página (es) › «llevame a la agenda y después poné vista semana» → Appointments + «poné vista semana»
- NV-PARSE · Qué es ir a otra página (en) › «go to patients» → Pacientes
- NV-PARSE · Qué es ir a otra página (en) › «take me to the cashier» → Cashier
- NV-PARSE · Qué es ir a otra página (en) › «go to the calendar» → Appointments
- NV-PARSE · Qué es ir a otra página (en) › «navigate to appointments» → Appointments
- NV-PARSE · Qué es ir a otra página (en) › «open the alerts center» → AlertsCenter
- NV-PARSE · Qué es ir a otra página (en) › «go to my workspace» → DoctorWorkspace
- NV-PARSE · Qué es ir a otra página (en) › «go home» → Dashboard
- NV-PARSE · Qué es ir a otra página (en) › «go back to the dashboard» → Dashboard
- NV-PARSE · Qué es ir a otra página (en) › «show me the debtors report» → ReportDeudores
- NV-PARSE · Qué es ir a otra página (en) › «take me to lab orders» → LabOrders
- NV-PARSE · Qué es ir a otra página (en) › «open invoices» → Invoices
- NV-PARSE · Qué es ir a otra página (en) › «go to purchase invoices» → PurchaseInvoices
- NV-PARSE · Qué es ir a otra página (en) › «switch to the reports» → Reports
- NV-PARSE · Qué es ir a otra página (en) › «go to business setup» → BusinessSetup
- NV-PARSE · Qué es ir a otra página (en) › «head over to suppliers» → Providers
- NV-PARSE · Qué es ir a otra página (en) › «bring me to the cash closing report» → ReportCierreCaja
- NV-PARSE · Qué es ir a otra página (en) › «open the patients page» → Pacientes
- NV-PARSE · Qué es ir a otra página (en) › «go to the calendar and switch to week view» → Appointments + «switch to week view»
- NV-PARSE · Qué es ir a otra página (en) › «go to patients and then search for John» → Pacientes + «search for John»
- NV-PARSE · Ambiguo: se pregunta solo si dos quedan igual › «andá a tratamientos» → realizados o en curso
- NV-PARSE · Ambiguo: se pregunta solo si dos quedan igual › «andá a facturas» no es ambiguo (Facturas de venta)
- NV-PARSE · Ambiguo: se pregunta solo si dos quedan igual › «andá a pagos» → Pagos (no pagos de compra)
- NV-PARSE · Ambiguo: se pregunta solo si dos quedan igual › «andá a calendarios» → configuración de calendarios
- NV-PARSE · No es ir a otra página › «andá a mañana»
- NV-PARSE · No es ir a otra página › «ir al lunes»
- NV-PARSE · No es ir a otra página › «andá a la semana que viene»
- NV-PARSE · No es ir a otra página › «go to next week»
- NV-PARSE · No es ir a otra página › «go to tomorrow»
- NV-PARSE · No es ir a otra página › «ir a hoy»
- NV-PARSE · No es ir a otra página › «andá al 15»
- NV-PARSE · No es ir a otra página › «andá a la cita de Juan»
- NV-PARSE · No es ir a otra página › «pasala a confirmada»
- NV-PARSE · No es ir a otra página › «cambiá a vista mes»
- NV-PARSE · No es ir a otra página › «switch to week view»
- NV-PARSE · No es ir a otra página › «volvé atrás»
- NV-PARSE · No es ir a otra página › «go back»
- NV-PARSE · No es ir a otra página › «andá al final»
- NV-PARSE · No es ir a otra página › «abrí la agenda de mañana»
- NV-PARSE · No es ir a otra página › «andá a la agenda del doctor Pérez»
- NV-PARSE · No es ir a otra página › «la caja»
- NV-PARSE · No es ir a otra página › «la agenda»
- NV-PARSE · No es ir a otra página › «sí»
- NV-PARSE · No es ir a otra página › «no»
- NV-PARSE · No es ir a otra página › «la segunda»
- NV-PARSE · No es ir a otra página › «cancelar»
- NV-PARSE · No es ir a otra página › «abrí la cuenta»
- NV-PARSE · No es ir a otra página › «mostrame la historia»
- NV-PARSE · No es ir a otra página › «andá al paciente Juan Pérez»
- NV-PARSE · No es ir a otra página › «move it to 3pm»
- NV-PARSE · No es ir a otra página › «volvé a intentar»
- NV-COVER · Cada destino del menú se reconoce por su nombre, en cada idioma › es: los 96 destinos
- NV-COVER · Cada destino del menú se reconoce por su nombre, en cada idioma › es-ES: los 96 destinos
- NV-COVER · Cada destino del menú se reconoce por su nombre, en cada idioma › en: los 96 destinos
- NV-COVER · Cada destino del menú se reconoce por su nombre, en cada idioma › todos los ítems del menú son destinos

