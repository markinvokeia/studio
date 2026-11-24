# Cualquier pantalla (voz genérica)

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/07-screen.spec.ts`

Cualquier pantalla sin voz propia: tocar botones y pestañas, escribir en campos, prender/apagar, elegir en listas, buscar, abrir filas, «¿qué puedo hacer acá?»; lo abierto primero; lo propio de la pantalla gana.

**126 frases** en **114 pruebas que pasan** (es 99 · es-ES 5 · en 22). Pantallas: `/`, `/appointments`, `/cashier`, `/purchases/providers`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## UI-PRESS · Botones y pestañas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «tocá nuevo paciente» → press:Nuevo paciente | es | `/purchases/providers` | «tocá nuevo paciente» | **Pantalla** · Listo, apreté «Nuevo paciente». |
| «apretá exportar» → press:Exportar | es | `/purchases/providers` | «apretá exportar» | **Pantalla** · Listo, apreté «Exportar». |
| «nuevo paciente» → press:Nuevo paciente | es | `/purchases/providers` | «nuevo paciente» | **Pantalla** · Listo, apreté «Nuevo paciente». |
| «exportar» → press:Exportar | es | `/purchases/providers` | «exportar» | **Pantalla** · Listo, apreté «Exportar». |
| «dale a actualizar» → press:Actualizar | es | `/purchases/providers` | «dale a actualizar» | **Pantalla** · Listo, apreté «Actualizar». |
| «hacé clic en exportar» → press:Exportar | es | `/purchases/providers` | «hacé clic en exportar» | **Pantalla** · Listo, apreté «Exportar». |
| «presioná el botón nuevo paciente» → press:Nuevo paciente | es | `/purchases/providers` | «presioná el botón nuevo paciente» | **Pantalla** · Listo, apreté «Nuevo paciente». |
| «tocá nuevo» → press:Nuevo paciente | es | `/purchases/providers` | «tocá nuevo» | **Pantalla** · Listo, apreté «Nuevo paciente». |
| «la pestaña inactivos» → tab:Inactivos | es | `/purchases/providers` | «la pestaña inactivos» | **Pantalla** · Listo, pestaña «Inactivos». |
| «andá a la pestaña todos» → tab:Todos | es | `/purchases/providers` | «andá a la pestaña todos» | **Pantalla** · Listo, pestaña «Todos». |
| «abrí la pestaña de inactivos» → tab:Inactivos | es | `/purchases/providers` | «abrí la pestaña de inactivos» | **Pantalla** · Listo, pestaña «Inactivos». |
| «pestaña todos» → tab:Todos | es | `/purchases/providers` | «pestaña todos» | **Pantalla** · Listo, pestaña «Todos». |
| lo que no está en la pantalla no se toca | es | `/purchases/providers` | «tocá imprimir» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá a pacientes», «¿qué puedo hacer acá?» o «abrí la ficha de Ana Pérez». |

## UI-FILL · Campos y buscador

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «poné Ana López en nombre» → fill:Nombre=Ana López | es | `/purchases/providers` | «poné Ana López en nombre» | **Pantalla** · Listo: «Nombre» = Ana López. |
| «el teléfono es 099 123 456» → fill:Teléfono=099 123 456 | es | `/purchases/providers` | «el teléfono es 099 123 456» | **Pantalla** · Listo: «Teléfono» = 099 123 456. |
| «escribí en notas trae los estudios» → fill:Notas=trae los estudios | es | `/purchases/providers` | «escribí en notas trae los estudios» | **Pantalla** · Listo: «Notas» = trae los estudios. |
| «notas: llamar el lunes» → fill:Notas=llamar el lunes | es | `/purchases/providers` | «notas: llamar el lunes» | **Pantalla** · Listo: «Notas» = llamar el lunes. |
| «el email es ana@mail.com» → fill:Email=ana@mail.com | es | `/purchases/providers` | «el email es ana@mail.com» | **Pantalla** · Listo: «Email» = ana@mail.com. |
| «completá el nombre con Juan Pérez» → fill:Nombre=Juan Pérez | es | `/purchases/providers` | «completá el nombre con Juan Pérez» | **Pantalla** · Listo: «Nombre» = Juan Pérez. |
| «buscá Juan» → fill:Buscar...=Juan | es | `/purchases/providers` | «buscá Juan» | **Pantalla** · Busco «Juan». |
| «buscá a María Fernández» → fill:Buscar...=María Fernández | es | `/purchases/providers` | «buscá a María Fernández» | **Pantalla** · Busco «María Fernández». |
| «borrá la búsqueda» → fill:Buscar...= | es | `/purchases/providers` | «borrá la búsqueda» | **Pantalla** · Borré la búsqueda. |
| «limpiá el buscador» → fill:Buscar...= | es | `/purchases/providers` | «limpiá el buscador» | **Pantalla** · Borré la búsqueda. |
| en «clear the search» vacía el buscador de la pantalla | en | `/purchases/providers` | «clear the search» | **Screen** · Cleared the search. |
| sin valor pregunta qué poner | es | `/purchases/providers` | «poné el teléfono» | **Pantalla** · ¿Qué pongo en Teléfono? |
| 〃 | es | `/purchases/providers` | «098 765 432» | **Pantalla** · Listo: «Teléfono» = 098 765 432. |

## UI-TOGGLE · Interruptores

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «activá enviar por email» | es | `/purchases/providers` | «activá enviar por email» | **Pantalla** · Listo, activé «Enviar por email». |
| «desactivá el recordatorio» | es | `/purchases/providers` | «desactivá el recordatorio» | **Pantalla** · Listo, desactivé «Recordatorio». |
| «prendé recordatorio» ya prendido: lo dice y no lo toca | es | `/purchases/providers` | «prendé recordatorio» | **Pantalla** · «Recordatorio» ya está activado. |
| «tocá enviar por email» lo cambia | es | `/purchases/providers` | «tocá enviar por email» | **Pantalla** · Listo, activé «Enviar por email». |
| «marcá enviar por mail» (mail = email no) no adivina | es | `/purchases/providers` | «marcá la casilla de factura» | **¿Te referís a…?** · No entendí «marcá la casilla de factura». ¿Te referís a ir a «Ventas › Facturas»? Decí cuál, o «no». [ir a «Ventas › Facturas»] |

## UI-SELECT · Listas desplegables

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «elegí efectivo en método de pago» → select:Método de pago=Efectivo | es | `/cashier` | «elegí efectivo en método de pago» | **Pantalla** · Listo: Método de pago = Efectivo. |
| «método de pago tarjeta» → select:Método de pago=Tarjeta de crédito | es | `/cashier` | «método de pago tarjeta» | **Pantalla** · Listo: Método de pago = Tarjeta de crédito. |
| «método de pago: transferencia» → select:Método de pago=Transferencia | es | `/cashier` | «método de pago: transferencia» | **Pantalla** · Listo: Método de pago = Transferencia. |
| «cambiá la moneda a USD» → select:Moneda=USD | es | `/cashier` | «cambiá la moneda a USD» | **Pantalla** · Listo: Moneda = USD. |
| «poné tarjeta como método de pago» → select:Método de pago=Tarjeta de crédito | es | `/cashier` | «poné tarjeta como método de pago» | **Pantalla** · Listo: Método de pago = Tarjeta de crédito. |
| sin opción: abre la lista y pregunta | es | `/cashier` | «elegí el método de pago» | **Pantalla** · ¿Qué opción de Método de pago? [Efectivo / Tarjeta de crédito / Transferencia] |
| 〃 | es | `/cashier` | «la última» | **Pantalla** · Listo: Método de pago = Transferencia. |
| opción que no está: lo dice y pregunta entre las que hay | es | `/cashier` | «método de pago cheque» | **Pantalla** · No encontré «cheque» en Método de pago. ¿Qué opción de Método de pago? [Efectivo / Tarjeta de crédito / Transferencia] |
| 〃 | es | `/cashier` | «efectivo» | **Pantalla** · Listo: Método de pago = Efectivo. |

## UI-ROW · Filas de una lista

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «abrí el primero» | es | `/purchases/providers` | «abrí el primero» | **Pantalla** · Abrí: Ana García 4.567.890-1 099 111 222. |
| «abrí el segundo» | es | `/purchases/providers` | «abrí el segundo» | **Pantalla** · Abrí: Juan Pérez 3.111.222-3 098 333 444. |
| «abrí el último» | es | `/purchases/providers` | «abrí el último» | **Pantalla** · Abrí: Carla Gómez 2.222.333-4 091 555 666. |
| «seleccioná la fila 2» | es | `/purchases/providers` | «seleccioná la fila 2» | **Pantalla** · Abrí: Juan Pérez 3.111.222-3 098 333 444. |
| «abrí el de Juan Pérez» | es | `/purchases/providers` | «abrí el de Juan Pérez» | **Pantalla** · Abrí: Juan Pérez 3.111.222-3 098 333 444. |
| «abrí la de Carla» | es | `/purchases/providers` | «abrí la de Carla» | **Pantalla** · Abrí: Carla Gómez 2.222.333-4 091 555 666. |
| «el tercero» | es | `/purchases/providers` | «el tercero» | **Pantalla** · Abrí: Carla Gómez 2.222.333-4 091 555 666. |
| «abrí el de Gómez» con dos Gómez pregunta entre esos | es | `/purchases/providers` | «abrí el de Gómez» | **Pantalla** · ¿Cuál? [Carla Gómez / Pedro Gómez] |
| 〃 | es | `/purchases/providers` | «Pedro» | **Pantalla** · Abrí: Pedro Gómez. |

## UI-HELP · ¿Qué puedo hacer acá?

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| lista lo que hay y aprieta lo elegido | es | `/purchases/providers` | «qué puedo hacer acá» | **Pantalla** · Acá podés: Activos, Inactivos, Todos, Nuevo paciente, Exportar, Actualizar. ¿Qué querés hacer? [Activos / Inactivos / Todos / Nuevo paciente / Exportar / Actualizar] |
| 〃 | es | `/purchases/providers` | «nuevo paciente» | **Pantalla** · Listo, apreté «Nuevo paciente». |
| sin botones lo dice | es | `/purchases/providers` | «qué puedo hacer acá» | **Pantalla** · No veo botones en esta pantalla. |

## UI-OVERLAY · Con una ventana abierta, se trabaja sobre ella

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| lo de la ventana y no lo de la página | es | `/purchases/providers` | «activá enviar bienvenida» | **Pantalla** · Listo, activé «Enviar bienvenida». |
| 〃 | es | `/purchases/providers` | «sexo femenino» | **Pantalla** · Listo: Sexo = Femenino. |
| 〃 | es | `/purchases/providers` | «exportar» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá a pacientes», «¿qué puedo hacer acá?» o «abrí la ficha de Ana Pérez». |

## UI-PRIORITY · Lo propio de la pantalla gana

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| en la agenda «hoy» es de la agenda aunque haya un botón Hoy | es | `/appointments` | «hoy» | Calendario en lun 23/11. |
| navegar le gana a un botón con el mismo nombre | es | `/` | «andá a pacientes» | **Menú** · Abro Pacientes. |
| la agenda sin pantalla de mentira sigue igual (no se rompe sin <main>) | es | `/appointments` | «qué puedo hacer acá» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá al jueves», «¿qué tengo mañana?», «Ana Gómez llegó», «nueva cita para Ana Gómez el lunes a las 10», «poné la cita de Ana en rojo», «bloqueá el lunes de 14 a 16» o «recordame mañana a l… |

## UI-EN · English

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «click new patient» → press:New patient | en | `/purchases/providers` | «click new patient» | **Screen** · Done, I pressed “New patient”. |
| «save changes» → press:Save changes | en | `/purchases/providers` | «save changes» | **Screen** · Done, I pressed “Save changes”. |
| «press save» → press:Save changes | en | `/purchases/providers` | «press save» | **Screen** · Done, I pressed “Save changes”. |
| «go to the payments tab» → tab:Payments | en | `/purchases/providers` | «go to the payments tab» | **Screen** · Done, “Payments” tab. |
| «open the invoices tab» → tab:Invoices | en | `/purchases/providers` | «open the invoices tab» | **Screen** · Done, “Invoices” tab. |
| «type John Smith in name» → fill:Name=John Smith | en | `/purchases/providers` | «type John Smith in name» | **Screen** · Done: “Name” = John Smith. |
| «the name is Anna» → fill:Name=Anna | en | `/purchases/providers` | «the name is Anna» | **Screen** · Done: “Name” = Anna. |
| «search for John» → fill:Search patients...=John | en | `/purchases/providers` | «search for John» | **Screen** · Searching for “John”. |
| «turn on send by email» → toggle:Send by email=on | en | `/purchases/providers` | «turn on send by email» | **Screen** · Done, turned on “Send by email”. |
| «set payment method to cash» → select:Payment method=Cash | en | `/purchases/providers` | «set payment method to cash» | **Screen** · Done: Payment method = Cash. |
| «select credit card as payment method» → select:Payment method=Credit card | en | `/purchases/providers` | «select credit card as payment method» | **Screen** · Done: Payment method = Credit card. |
| «open the second one» → row:John Smith | en | `/purchases/providers` | «open the second one» | **Screen** · Opened: John Smith. |
| «open the last one» → row:John Smith | en | `/purchases/providers` | «open the last one» | **Screen** · Opened: John Smith. |
| «what can I do here» | en | `/purchases/providers` | «what can I do here» | **Screen** · Here you can: Invoices, Payments, New patient, Save changes. What do you want to do? [Invoices / Payments / New patient / Save changes] |

## UI-ES-ES · Castellano (tú)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «pulsa nuevo paciente» y «busca a Juan» | es-ES | `/purchases/providers` | «pulsa nuevo paciente» | **Pantalla** · Vale, he pulsado «Nuevo paciente». |
| 〃 | es-ES | `/purchases/providers` | «busca a Juan» | **Pantalla** · Busco «Juan». |
| «qué puedo hacer aquí» | es-ES | `/purchases/providers` | «qué puedo hacer aquí» | **Pantalla** · Aquí puedes: Activos, Inactivos, Todos, Nuevo paciente, Exportar, Actualizar. ¿Qué quieres hacer? [Activos / Inactivos / Todos / Nuevo paciente / Exportar / Actualizar] |

## UI-SEARCHSEL · Selectores con búsqueda (paciente, sede, doctor)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «paciente Carolina Píriz» escribe en la búsqueda y elige | es | `/purchases/providers` | «paciente Carolina Píriz» | **Pantalla** · Listo: Paciente = Carolina Píriz Fernández. |
| «elegí a Leonardo en paciente» | es | `/purchases/providers` | «elegí Leonardo en paciente» | **Pantalla** · Listo: Paciente = Leonardo Acosta Ramos. |
| varios con ese nombre: pregunta entre esos | es | `/purchases/providers` | «paciente Juan» | **Pantalla** · ¿Qué opción de Paciente? [Juan Pérez / Juan Bengoa] |
| 〃 | es | `/purchases/providers` | «Bengoa» | **Pantalla** · Listo: Paciente = Juan Bengoa. |
| «elegí el paciente» sin decir cuál: pregunta qué buscar y lo escribe | es | `/purchases/providers` | «elegí el paciente» | **Pantalla** · ¿Qué Paciente busco? |
| 〃 | es | `/purchases/providers` | «Martín Machado» | **Pantalla** · Listo: Paciente = Martín Machado. |
| «la sede Pocitos» y «doctor Martínez» | es | `/purchases/providers` | «sede Pocitos» | **Pantalla** · Listo: Sede = Pocitos. |
| 〃 | es | `/purchases/providers` | «doctor Martínez» | **Pantalla** · Listo: Doctor = Raidel Martínez. |
| en «set the doctor to Benítez» | en | `/purchases/providers` | «set the doctor to Benítez» | **Screen** · Done: Doctor = Sofía Benítez. |

## UI-CREATE · «nuevo» aprieta el botón de alta de la pantalla

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «nuevo» → Nueva sede | es | `/purchases/providers` | «nuevo» | **Pantalla** · Listo, apreté «Nueva sede». |
| es «agregá uno» → Agregar etapa | es | `/purchases/providers` | «agregá uno» | **Pantalla** · Listo, apreté «Agregar etapa». |
| es-ES «añade uno» → Agregar etapa | es-ES | `/purchases/providers` | «añade uno» | **Pantalla** · Vale, he pulsado «Agregar etapa». |
| en «new» → New template | en | `/purchases/providers` | «new» | **Screen** · Done, I pressed “New template”. |
| con dos botones de alta no adivina | es | `/purchases/providers` | «nuevo» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá a pacientes», «¿qué puedo hacer acá?» o «abrí la ficha de Ana Pérez». |

## UI-ROWACT · La acción de una fila («desactivá la etapa X»)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «desactivá la etapa enviado al laboratorio» | es | `/purchases/providers` | «desactivá la etapa enviado al laboratorio» | **Pantalla** · Apreté «Desactivar» en «Enviado al laboratorio Desactivar Eliminar». |
| «eliminá recibido en clínica» | es | `/purchases/providers` | «eliminá recibido en clínica» | **Pantalla** · Apreté «Eliminar» en «Recibido en clínica Desactivar Eliminar». |
| una fila que no está: nada | es | `/purchases/providers` | «desactivá la etapa entregado» | **¿Te referís a…?** · No entendí «desactivá la etapa entregado». ¿Te referís a apretar «Desactivar»? Decí cuál, o «no». [apretar «Desactivar»] |
| en «deactivate solicitud creada» | en | `/purchases/providers` | «deactivate solicitud creada» | **Screen** · Pressed “Deactivate” on “Solicitud creada Deactivate”. |

## UI-ROWCOLOR · El color de una fila («el color de Confirmada es rojo»)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «el color de confirmada es rojo» | es | `/purchases/providers` | «el color de confirmada es rojo» | **Pantalla** · Puse Confirmada en #ef4444. |
| es «poné programada en azul» | es | `/purchases/providers` | «poné programada en azul» | **Pantalla** · Puse Programada en #3b82f6. |
| es «cambiá el color de cancelada a #ff0000» | es | `/purchases/providers` | «cambiá el color de cancelada a #ff0000» | **Pantalla** · Puse Cancelada en #ff0000. |
| es-ES «pon el color de confirmada en verde» | es-ES | `/purchases/providers` | «pon el color de confirmada en verde» | **Pantalla** · He puesto Confirmada en #22c55e. |
| en «set the color of confirmada to purple» | en | `/purchases/providers` | «set the color of confirmada to purple» | **Screen** · Set Confirmada to #8b5cf6. |
| una fila que no está: no pinta nada | es | `/purchases/providers` | «el color de atendida es rojo» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá a pacientes», «¿qué puedo hacer acá?» o «abrí la ficha de Ana Pérez». |

## UI-FIELDNAME · Nombre sin paréntesis y número sin unidad

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «la duración es 5 días» en «Duración (días)» (numérico) | es | `/purchases/providers` | «la duración es 5 días» | **Pantalla** · Listo: «Duración (días)» = 5. |
| «la hora es las 9 y media» en un campo de hora | es | `/purchases/providers` | «la hora es las 9 y media» | **Pantalla** · Listo: «Hora» = 09:30. |

## UI-EDIT · Editar un campo dicho de cualquier forma

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «modificá el nombre de la clínica a Clínica Prueba» | es | `/purchases/providers` | «modificá el nombre de la clínica a Clínica Prueba» | **Pantalla** · Listo: «Nombre» = Clínica Prueba. |
| «cambiá el teléfono por 099 123 456» | es | `/purchases/providers` | «cambiá el teléfono por 099 123 456» | **Pantalla** · Listo: «Teléfono» = 099 123 456. |
| «editá el nombre a Centro Dental» | es | `/purchases/providers` | «editá el nombre a Centro Dental» | **Pantalla** · Listo: «Nombre» = Centro Dental. |
| «asigná el teléfono 098 765» | es | `/purchases/providers` | «asigná el teléfono 098 765» | **Pantalla** · Listo: «Teléfono» = 098 765. |
| «la fecha de inicio es el 15 de diciembre» | es | `/purchases/providers` | «la fecha de inicio es el 15 de diciembre» | **Pantalla** · Listo: «Fecha de inicio» = 15/12/2026. |
| «poné la fecha de fin el 20 de diciembre» | es | `/purchases/providers` | «poné la fecha de fin el 20 de diciembre» | **Pantalla** · Listo: «Fecha de fin» = 20/12/2026. |

## UI-ABBR · Etiquetas abreviadas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «la cantidad es 2» en «Cant.» | es | `/purchases/providers` | «la cantidad es 2» | **Pantalla** · Listo: «Cant.» = 2. |

## UI-SYN · Sinónimos de «poner un valor» (verbos y sustantivos) y campo + valor

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «definí la vía oral» | es | `/purchases/providers` | «definí la vía oral» | **Pantalla** · Listo: «Vía» = oral. |
| «registrá la dosis 400 mg» | es | `/purchases/providers` | «registrá la dosis 400 mg» | **Pantalla** · Listo: «Dosis» = 400 mg. |
| «establecé el precio en 1500» | es | `/purchases/providers` | «establecé el precio en 1500» | **Pantalla** · Listo: «Precio» = 1500. |
| «fijá la vía a sublingual» | es | `/purchases/providers` | «fijá la vía a sublingual» | **Pantalla** · Listo: «Vía» = sublingual. |
| «indicá la dosis 2 comprimidos» | es | `/purchases/providers` | «indicá la dosis 2 comprimidos» | **Pantalla** · Listo: «Dosis» = 2 comprimidos. |
| «colocá en notas tomar con comida» | es | `/purchases/providers` | «colocá en notas tomar con comida» | **Pantalla** · Listo: «Notas» = tomar con comida. |
| «especificá la vía tópica» | es | `/purchases/providers` | «especificá la vía tópica» | **Pantalla** · Listo: «Vía» = tópica. |
| «cambio de vía a oral» | es | `/purchases/providers` | «cambio de vía a oral» | **Pantalla** · Listo: «Vía» = oral. |
| «actualización del precio a 2000» | es | `/purchases/providers` | «actualización del precio a 2000» | **Pantalla** · Listo: «Precio» = 2000. |
| «nueva dosis 500 mg» | es | `/purchases/providers` | «nueva dosis 500 mg» | **Pantalla** · Listo: «Dosis» = 500 mg. |
| «vía oral» | es | `/purchases/providers` | «vía oral» | **Pantalla** · Listo: «Vía» = oral. |
| «dosis 400 mg» | es | `/purchases/providers` | «dosis 400 mg» | **Pantalla** · Listo: «Dosis» = 400 mg. |
| «seteá la vía en oral» | es | `/purchases/providers` | «seteá la vía en oral» | **Pantalla** · Listo: «Vía» = oral. |
| en «set the dosis to 400 mg» / «record the precio 1500» | en | `/purchases/providers` | «set the dosis to 400 mg» | **Screen** · Done: “Dosis” = 400 mg. |
| 〃 | en | `/purchases/providers` | «record the precio 1500» | **Screen** · Done: “Precio” = 1500. |

## UI-FILTER-EN · «filter …» en inglés escribe la palabra clave en el buscador

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «filter the ones that have Carolina» | en | `/purchases/providers` | «filter the ones that have Carolina» | **Screen** · Searching for “Carolina”. |

## UI-NOSEARCH · Buscar donde no hay buscador

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «filtrá por Juan» lo dice (no «no entendí») | es | `/purchases/providers` | «filtrá por Juan» | **Pantalla** · Esta tabla no tiene buscador. |

## UI-SEARCHSEL-MISS · Una opción que no aparece no cierra la ventana

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «elegí Zeta en proveedor» con el pago abierto: lo dice y la ventana sigue | es | `/purchases/providers` | «elegí Zeta en proveedor» | **Pantalla** · Proveedor no tiene opciones para elegir. |

