# Voz · Pruebas en la app real, pantalla por pantalla

Generado por `scripts/voice-live-report.mjs` a partir de la última corrida de `e2e/tests/voice-live/page-matrix.live.ts` (app en modo producción, reconocimiento falso, sin guardar). En cada pantalla se descubre lo que hay y se prueba por voz: ayuda, tabla (ordenar, ocultar y mostrar columnas, filtrar con la palabra clave, elegir y cerrar el detalle), alta (se abre y avisa qué se le puede pedir; campos con tres sinónimos; interruptores y casillas; listas; opciones), cerrar lo último que se abrió y cambio de contexto con la ventana abierta.

**1775 de 1775 pasos bien** en 59 pantallas (en y es).

| Pantalla | Idioma | Bien | Falló |
| --- | --- | --- | --- |
| `/alerts` | en | 2/2 | — |
| `/alerts` | es | 2/2 | — |
| `/cashier/cash-points` | en | 17/17 | — |
| `/cashier/cash-points` | es | 17/17 | — |
| `/cashier/miscellaneous-categories` | en | 23/23 | — |
| `/cashier/miscellaneous-categories` | es | 23/23 | — |
| `/cashier/miscellaneous-transactions` | en | 21/21 | — |
| `/cashier/miscellaneous-transactions` | es | 21/21 | — |
| `/cashier/sessions` | en | 9/9 | — |
| `/cashier/sessions` | es | 9/9 | — |
| `/clinic-catalog/ailments` | en | 18/18 | — |
| `/clinic-catalog/ailments` | es | 18/18 | — |
| `/clinic-catalog/dental-conditions` | en | 20/20 | — |
| `/clinic-catalog/dental-conditions` | es | 20/20 | — |
| `/clinic-catalog/dental-surfaces` | en | 17/17 | — |
| `/clinic-catalog/dental-surfaces` | es | 17/17 | — |
| `/clinic-catalog/measurement-units` | en | 15/15 | — |
| `/clinic-catalog/measurement-units` | es | 15/15 | — |
| `/clinic-catalog/medications` | en | 17/17 | — |
| `/clinic-catalog/medications` | es | 17/17 | — |
| `/config/availability-exceptions` | en | 7/7 | — |
| `/config/availability-exceptions` | es | 7/7 | — |
| `/config/calendar-colors` | en | 2/2 | — |
| `/config/calendar-colors` | es | 2/2 | — |
| `/config/calendars` | en | 23/23 | — |
| `/config/calendars` | es | 23/23 | — |
| `/config/clinic-prefs` | en | 2/2 | — |
| `/config/clinic-prefs` | es | 2/2 | — |
| `/config/clinics` | en | 16/16 | — |
| `/config/clinics` | es | 16/16 | — |
| `/config/currencies` | en | 6/6 | — |
| `/config/currencies` | es | 6/6 | — |
| `/config/doctor-availability` | en | 19/19 | — |
| `/config/doctor-availability` | es | 18/18 | — |
| `/config/doctors` | en | 9/9 | — |
| `/config/doctors` | es | 9/9 | — |
| `/config/holidays` | en | 18/18 | — |
| `/config/holidays` | es | 18/18 | — |
| `/config/lab-stages` | en | 2/2 | — |
| `/config/lab-stages` | es | 2/2 | — |
| `/config/medical-instruction-templates` | en | 24/24 | — |
| `/config/medical-instruction-templates` | es | 24/24 | — |
| `/config/mutual-societies` | en | 19/19 | — |
| `/config/mutual-societies` | es | 19/19 | — |
| `/config/patient-groups` | en | 18/18 | — |
| `/config/patient-groups` | es | 21/21 | — |
| `/config/patients-portal` | en | 2/2 | — |
| `/config/patients-portal` | es | 2/2 | — |
| `/config/prescription-templates` | en | 24/24 | — |
| `/config/prescription-templates` | es | 24/24 | — |
| `/config/provider-groups` | en | 18/18 | — |
| `/config/provider-groups` | es | 21/21 | — |
| `/config/schedules` | en | 4/4 | — |
| `/config/schedules` | es | 4/4 | — |
| `/config/sedes` | en | 23/23 | — |
| `/config/sedes` | es | 23/23 | — |
| `/config/sequences` | en | 24/24 | — |
| `/config/sequences` | es | 24/24 | — |
| `/config/services` | en | 24/24 | — |
| `/config/services` | es | 24/24 | — |
| `/config/templates` | en | 2/2 | — |
| `/config/templates` | es | 2/2 | — |
| `/lab-orders` | en | 13/13 | — |
| `/lab-orders` | es | 13/13 | — |
| `/patients` | en | 23/23 | — |
| `/patients` | es | 23/23 | — |
| `/permissions` | en | 21/21 | — |
| `/permissions` | es | 21/21 | — |
| `/purchases/invoices` | en | 24/24 | — |
| `/purchases/invoices` | es | 23/23 | — |
| `/purchases/payments` | en | 22/22 | — |
| `/purchases/payments` | es | 21/21 | — |
| `/purchases/providers` | en | 24/24 | — |
| `/purchases/providers` | es | 24/24 | — |
| `/purchases/quotes` | en | 12/12 | — |
| `/purchases/quotes` | es | 12/12 | — |
| `/purchases/services` | en | 24/24 | — |
| `/purchases/services` | es | 24/24 | — |
| `/roles` | en | 14/14 | — |
| `/roles` | es | 14/14 | — |
| `/sales/invoices` | en | 24/24 | — |
| `/sales/invoices` | es | 24/24 | — |
| `/sales/payment-methods` | en | 21/21 | — |
| `/sales/payment-methods` | es | 21/21 | — |
| `/sales/payments` | en | 24/24 | — |
| `/sales/payments` | es | 24/24 | — |
| `/sales/quotes` | en | 14/14 | — |
| `/sales/quotes` | es | 14/14 | — |
| `/sales/services` | en | 26/26 | — |
| `/sales/services` | es | 26/26 | — |
| `/studies` | en | 2/2 | — |
| `/studies` | es | 2/2 | — |
| `/system/access` | en | 2/2 | — |
| `/system/access` | es | 2/2 | — |
| `/system/alert-categories` | en | 9/9 | — |
| `/system/alert-categories` | es | 9/9 | — |
| `/system/alert-rules` | en | 26/26 | — |
| `/system/alert-rules` | es | 26/26 | — |
| `/system/audit` | en | 9/9 | — |
| `/system/audit` | es | 9/9 | — |
| `/system/communication-history` | en | 9/9 | — |
| `/system/communication-history` | es | 9/9 | — |
| `/system/communication-templates` | en | 26/26 | — |
| `/system/communication-templates` | es | 26/26 | — |
| `/system/config` | en | 9/9 | — |
| `/system/config` | es | 9/9 | — |
| `/system/errors` | en | 2/2 | — |
| `/system/errors` | es | 2/2 | — |
| `/system/execution-history` | en | 9/9 | — |
| `/system/execution-history` | es | 9/9 | — |
| `/system/notification-settings` | en | 2/2 | — |
| `/system/notification-settings` | es | 2/2 | — |
| `/system/staff` | en | 24/24 | — |
| `/system/staff` | es | 24/24 | — |
| `/system/users` | en | 24/24 | — |
| `/system/users` | es | 24/24 | — |
| `/system/whatsapp-agent` | en | 2/2 | — |
| `/system/whatsapp-agent` | es | 2/2 | — |

## `/alerts` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Reload, Filters, Dates · 38, Send Email, Mark as Completed, Send WhatsApp.  |
| alta | «new» | ✅ | pantalla sin alta |

## `/alerts` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Recargar, Filtros, Fechas · 38, Enviar Correo, Marcar como Completada, Envi |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/cashier/cash-points` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, ID, Name, Location. What do you want to do? In the t |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Location column» | ✅ | Listening «hide the Location column» Table Hid the Location column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Location column» | ✅ | Listening «show the Location column» Table Showing the Location column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Caja» | ✅ | escribió «Caja» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Edit Cash Register “Edit Cash Register” is open. Tell me what to fill in (Name, Location *…) or what to press: Save Changes or Cancel.  |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Edit Cash Register. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Cash Register “Create Cash Register” is open. Tell me what to fill in (Name, Location *…) or what to press: Create or Cancel. 1 Create 2  |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Is Active» off | «turn off Is Active» | ✅ | quedó off |
| interruptor «Is Active» on | «turn on Is Active» | ✅ | quedó on |
| lista «Location *» | «choose Sede Carrasco in location *» | ✅ | quedó «Sede Carrasco» |
| cerrar la ventana | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Create Cash Register. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/cashier/cash-points` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, ID, Nombre, Sede. ¿Qué querés hacer? En la tabla tam |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Sede» | ✅ | Te escucho «ocultá la columna Sede» Tabla Oculté la columna Sede. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Sede» | ✅ | Te escucho «mostrá la columna Sede» Tabla Muestro la columna Sede. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Caja» | ✅ | escribió «Caja» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Editar Caja Registradora Se abrió «Editar Caja Registradora». Decime qué completar (Nombre, Sede *…) o qué apretar: Guardar Cambios |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Editar Caja Registradora. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Caja Registradora Se abrió «Crear Caja Registradora». Decime qué completar (Nombre, Sede *…) o qué apretar: Crear o Cancelar. 1 Crear 2 |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Está Activa» off | «desactivá Está Activa» | ✅ | quedó off |
| interruptor «Está Activa» on | «activá Está Activa» | ✅ | quedó on |
| lista «Sede *» | «elegí Sede Carrasco en sede *» | ✅ | quedó «Sede Carrasco» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Crear Caja Registradora. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/cashier/miscellaneous-categories` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Go to next page, Go to last page, Refresh, View, ID. What do you wa |
| tabla · ordenar | «sort by Code descending» | ✅ | Listening «sort by Code descending» Table Sorted by Code, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Name column» | ✅ | Listening «hide the Name column» Table Hid the Name column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Name column» | ✅ | Listening «show the Name column» Table Showing the Name column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Periodoncia» | ✅ | escribió «Periodoncia» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Edit Product Category “Edit Product Category” is open. Tell me what to fill in (Name, Code, Description, Type…) or what to press: Save  |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Edit Product Category. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Product Category “Create Product Category” is open. Tell me what to fill in (Name, Code, Description, Type…) or what to press: Create or  |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Code» (text, 1/3) | «set code to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Code» (text, 2/3) | «change code to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Code» (text, 3/3) | «the code is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Description» (text, 1/3) | «set description to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Description» (text, 2/3) | «change description to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Description» (text, 3/3) | «the description is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Is Active?» off | «turn off Is Active?» | ✅ | quedó off |
| interruptor «Is Active?» on | «turn on Is Active?» | ✅ | quedó on |
| lista «Type» | «choose Income in type» | ✅ | quedó «Expense» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/cashier/miscellaneous-categories` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Ir a la siguiente página, Ir a la última página, Refrescar, Ver, ID. |
| tabla · ordenar | «ordená por Código descendente» | ✅ | Te escucho «ordená por Código descendente» Tabla Ordené por Código, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Nombre» | ✅ | Te escucho «ocultá la columna Nombre» Tabla Oculté la columna Nombre. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Nombre» | ✅ | Te escucho «mostrá la columna Nombre» Tabla Muestro la columna Nombre. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Periodoncia» | ✅ | escribió «Periodoncia» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Editar Categoría Se abrió «Editar Categoría». Decime qué completar (Nombre, Código, Descripción, Tipo…) o qué apretar: Guardar Camb |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Editar Categoría. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Categoría de Producto Se abrió «Crear Categoría de Producto». Decime qué completar (Nombre, Código, Descripción, Tipo…) o qué apretar:  |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Código» (text, 1/3) | «poné código Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Código» (text, 2/3) | «cambiá código a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Código» (text, 3/3) | «el código es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Descripción» (text, 1/3) | «poné descripción Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Descripción» (text, 2/3) | «cambiá descripción a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Descripción» (text, 3/3) | «el descripción es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «¿Está Activa?» off | «desactivá ¿Está Activa?» | ✅ | quedó off |
| interruptor «¿Está Activa?» on | «activá ¿Está Activa?» | ✅ | quedó on |
| lista «Tipo» | «elegí Ingreso en tipo» | ✅ | quedó «Gasto» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/cashier/miscellaneous-transactions` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Go to next page, Go to last page, Refresh, View, Doc No.. What do y |
| tabla · ordenar | «sort by Doc No. descending» | ✅ | Listening «sort by Doc No. descending» Table Sorted by Doc No., descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Date column» | ✅ | Listening «hide the Date column» Table Hid the Date column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Date column» | ✅ | Listening «show the Date column» Table Showing the Date column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Laboratorio» | ✅ | escribió «Laboratorio» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened MSC-2026-11-000309 · 2026-11-10T00:00:00.000Z · Insumos de cafetería. I'm listening: just talk · Esc cancels · tap Voice t |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Transaction “Create Transaction” is open. Tell me what to fill in (Category, Beneficiary, Date, Payment Method…) or what to press: Create |
| campo «Beneficiary» (text, 1/3) | «set beneficiary to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Beneficiary» (text, 2/3) | «change beneficiary to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Beneficiary» (text, 3/3) | «the beneficiary is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Date» (date, 1/3) | «set date to December 15» | ✅ | quedó «15/12/2026» |
| campo «Date» (date, 2/3) | «change date to January 3» | ✅ | quedó «03/01/2027» |
| campo «Date» (date, 3/3) | «the date is March 20» | ✅ | quedó «20/03/2027» |
| campo «Amount» (number, 1/3) | «set amount to 1500» | ✅ | quedó «1500.00» |
| campo «Amount» (number, 2/3) | «change amount to 2300» | ✅ | quedó «2300.00» |
| campo «Amount» (number, 3/3) | «the amount is 99» | ✅ | quedó «99.00» |
| lista «Category» | «choose Odontología general in category» | ✅ | quedó «Odontología general» |
| lista «Payment Method» | «choose Compra ágil in payment method» | ✅ | quedó «Select method» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/cashier/miscellaneous-transactions` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Ir a la siguiente página, Ir a la última página, Refrescar, Ver, Doc |
| tabla · ordenar | «ordená por Doc No. descendente» | ✅ | Te escucho «ordená por Doc No. descendente» Tabla Ordené por Doc No., de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Fecha» | ✅ | Te escucho «ocultá la columna Fecha» Tabla Oculté la columna Fecha. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Fecha» | ✅ | Te escucho «mostrá la columna Fecha» Tabla Muestro la columna Fecha. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Laboratorio» | ✅ | escribió «Laboratorio» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí MSC-2026-11-000309 · 2026-11-10T00:00:00.000Z · Insumos de cafetería. Te escucho: hablá normalmente · Esc cancela · tocá |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Transacción Se abrió «Crear Transacción». Decime qué completar (Categoría, Beneficiario, Fecha, Método de Pago…) o qué apretar: Crear o |
| campo «Beneficiario» (text, 1/3) | «poné beneficiario Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Beneficiario» (text, 2/3) | «cambiá beneficiario a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Beneficiario» (text, 3/3) | «el beneficiario es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Fecha» (date, 1/3) | «poné fecha el 15 de diciembre» | ✅ | quedó «15/12/2026» |
| campo «Fecha» (date, 2/3) | «cambiá fecha a el 3 de enero» | ✅ | quedó «03/01/2027» |
| campo «Fecha» (date, 3/3) | «el fecha es el 20 de marzo» | ✅ | quedó «20/03/2027» |
| campo «Monto» (number, 1/3) | «poné monto 1500» | ✅ | quedó «1500.00» |
| campo «Monto» (number, 2/3) | «cambiá monto a 2300» | ✅ | quedó «2300.00» |
| campo «Monto» (number, 3/3) | «el monto es 99» | ✅ | quedó «99.00» |
| lista «Categoría» | «elegí Odontología general en categoría» | ✅ | quedó «Odontología general» |
| lista «Método de Pago» | «elegí Compra ágil en método de pago» | ✅ | quedó «Seleccionar método» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/cashier/sessions` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Go to next page, Go to last page, Refresh, View, User, Cash Point. What do  |
| tabla · ordenar | «sort by User descending» | ✅ | Listening «sort by User descending» Table Sorted by User, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Cash Point column» | ✅ | Listening «hide the Cash Point column» Table Hid the Cash Point column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Cash Point column» | ✅ | Listening «show the Cash Point column» Table Showing the Cash Point column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Raidel» | ✅ | escribió «Raidel» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Cash Session Details “Cash Session Details” is open. What should I do? Denomination Details or Movements. 1 Denomination Details 2 Move |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Cash Session Details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta | «new» | ✅ | pantalla sin alta |

## `/cashier/sessions` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Ir a la siguiente página, Ir a la última página, Refrescar, Ver, Usuario, P |
| tabla · ordenar | «ordená por Usuario descendente» | ✅ | Te escucho «ordená por Usuario descendente» Tabla Ordené por Usuario, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Punto de Caja» | ✅ | Te escucho «ocultá la columna Punto de Caja» Tabla Oculté la columna Punto de Caja. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Punto de Caja» | ✅ | Te escucho «mostrá la columna Punto de Caja» Tabla Muestro la columna Punto de Caja. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Raidel» | ✅ | escribió «Raidel» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Detalles de Sesión de Caja Se abrió «Detalles de Sesión de Caja». ¿Qué hago? Detalles de Denominación o Movimientos. 1 Detalles de  |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Detalles de Sesión de Caja. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/clinic-catalog/ailments` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Name, Category, Alert Level. What do you want to do? |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Category column» | ✅ | Listening «hide the Category column» Table Hid the Category column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Category column» | ✅ | Listening «show the Category column» Table Showing the Category column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Bruxismo» | ✅ | escribió «Bruxismo» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened VIH · Infeccioso · 3. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create New Ailment “Create New Ailment” is open. Tell me what to fill in (Name, Category, Alert Level…) or what to press: Cancel or Create Ailme |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Category» (text, 1/3) | «set category to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Category» (text, 2/3) | «change category to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Category» (text, 3/3) | «the category is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| lista «Alert Level» | «choose 1 (Normal) in alert level» | ✅ | quedó «Select a level» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/clinic-catalog/ailments` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre, Categoría, Nivel de Alerta. ¿Qué querés hace |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Categoría» | ✅ | Te escucho «ocultá la columna Categoría» Tabla Oculté la columna Categoría. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Categoría» | ✅ | Te escucho «mostrá la columna Categoría» Tabla Muestro la columna Categoría. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Bruxismo» | ✅ | escribió «Bruxismo» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí VIH · Infeccioso · 3. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Nuevo Padecimiento Se abrió «Crear Nuevo Padecimiento». Decime qué completar (Nombre, Categoría, Nivel de Alerta…) o qué apretar: Cance |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Categoría» (text, 1/3) | «poné categoría Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Categoría» (text, 2/3) | «cambiá categoría a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Categoría» (text, 3/3) | «el categoría es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| lista «Nivel de Alerta» | «elegí 1 (Normal) en nivel de alerta» | ✅ | quedó «Seleccione un nivel» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/clinic-catalog/dental-conditions` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Go to next page, Go to last page, Refresh, View, Name. What do you  |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Visual Code column» | ✅ | Listening «hide the Visual Code column» Table Hid the Visual Code column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Visual Code column» | ✅ | Listening «show the Visual Code column» Table Showing the Visual Code column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Abfracción» | ✅ | escribió «Abfracción» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened test · tet · #ffffff. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create New Dental Condition “Create New Dental Condition” is open. Tell me what to fill in (Name, Visual Code, Color…) or what to press: Cancel  |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Visual Code» (text, 1/3) | «set visual code to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Visual Code» (text, 2/3) | «change visual code to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Visual Code» (text, 3/3) | «the visual code is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Color» (color, 1/3) | «set color to red» | ✅ | quedó «#ef4444» |
| campo «Color» (color, 2/3) | «change color to blue» | ✅ | quedó «#3b82f6» |
| campo «Color» (color, 3/3) | «the color is green» | ✅ | quedó «#22c55e» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/clinic-catalog/dental-conditions` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Ir a la siguiente página, Ir a la última página, Refrescar, Ver, Nom |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Código Visual» | ✅ | Te escucho «ocultá la columna Código Visual» Tabla Oculté la columna Código Visual. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Código Visual» | ✅ | Te escucho «mostrá la columna Código Visual» Tabla Muestro la columna Código Visual. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Abfracción» | ✅ | escribió «Abfracción» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí test · tet · #ffffff. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Nueva Condición Dental Se abrió «Crear Nueva Condición Dental». Decime qué completar (Nombre, Código Visual, Color…) o qué apretar: Can |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Código Visual» (text, 1/3) | «poné código visual Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Código Visual» (text, 2/3) | «cambiá código visual a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Código Visual» (text, 3/3) | «el código visual es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Color» (color, 1/3) | «poné color rojo» | ✅ | quedó «#ef4444» |
| campo «Color» (color, 2/3) | «cambiá color a azul» | ✅ | quedó «#3b82f6» |
| campo «Color» (color, 3/3) | «el color es verde» | ✅ | quedó «#22c55e» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/clinic-catalog/dental-surfaces` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Name, Code. What do you want to do? In the table too |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Code column» | ✅ | Listening «hide the Code column» Table Hid the Code column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Code column» | ✅ | Listening «show the Code column» Table Showing the Code column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Distal» | ✅ | escribió «Distal» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Vestibular · V. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create New Dental Surface “Create New Dental Surface” is open. Tell me what to fill in (Name, Code…) or what to press: Cancel or Create Surface. |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Code» (text, 1/3) | «set code to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Code» (text, 2/3) | «change code to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Code» (text, 3/3) | «the code is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/clinic-catalog/dental-surfaces` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre, Código. ¿Qué querés hacer? En la tabla tambi |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Código» | ✅ | Te escucho «ocultá la columna Código» Tabla Oculté la columna Código. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Código» | ✅ | Te escucho «mostrá la columna Código» Tabla Muestro la columna Código. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Distal» | ✅ | escribió «Distal» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Vestibular · V. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Nueva Superficie Dental Se abrió «Crear Nueva Superficie Dental». Decime qué completar (Nombre, Código…) o qué apretar: Cancelar o Crea |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Código» (text, 1/3) | «poné código Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Código» (text, 2/3) | «cambiá código a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Código» (text, 3/3) | «el código es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/clinic-catalog/measurement-units` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: New unit, Edit, Delete. What do you want to do? 1 New unit 2 Edit 3 Delete  |
| alta · se abre y avisa | «new» | ✅ | Listening «new» New measurement unit “New measurement unit” is open. Tell me what to fill in (Name, Symbol, Code, Quantity step…) or what to press: Cancel or Sa |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Symbol» (text, 1/3) | «set symbol to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Symbol» (text, 2/3) | «change symbol to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Symbol» (text, 3/3) | «the symbol is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Code» (text, 1/3) | «set code to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Code» (text, 2/3) | «change code to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Code» (text, 3/3) | «the code is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Active» off | «turn off Active» | ✅ | quedó off |
| interruptor «Active» on | «turn on Active» | ✅ | quedó on |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/clinic-catalog/measurement-units` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Nueva unidad, Editar, Eliminar. ¿Qué querés hacer? 1 Nueva unidad 2 Editar  |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Nueva unidad de medida Se abrió «Nueva unidad de medida». Decime qué completar (Nombre, Símbolo, Código, Paso de la cantidad…) o qué apretar: |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Símbolo» (text, 1/3) | «poné símbolo Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Símbolo» (text, 2/3) | «cambiá símbolo a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Símbolo» (text, 3/3) | «el símbolo es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Código» (text, 1/3) | «poné código Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Código» (text, 2/3) | «cambiá código a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Código» (text, 3/3) | «el código es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Activa» off | «desactivá Activa» | ✅ | quedó off |
| interruptor «Activa» on | «activá Activa» | ✅ | quedó on |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/clinic-catalog/medications` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Generic Name, Commercial Name. What do you want to d |
| tabla · ordenar | «sort by Generic Name descending» | ✅ | Listening «sort by Generic Name descending» Table Sorted by Generic Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Commercial Name column» | ✅ | Listening «hide the Commercial Name column» Table Hid the Commercial Name column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Commercial Name column» | ✅ | Listening «show the Commercial Name column» Table Showing the Commercial Name column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Amoxicilina» | ✅ | escribió «Amoxicilina» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Ácido acetilsalicílico 100 mg · Aspirina. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create New Medication “Create New Medication” is open. Tell me what to fill in (Generic Name, Commercial Name…) or what to press: Cancel or Crea |
| campo «Generic Name» (text, 1/3) | «set generic name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Generic Name» (text, 2/3) | «change generic name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Generic Name» (text, 3/3) | «the generic name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Commercial Name» (text, 1/3) | «set commercial name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Commercial Name» (text, 2/3) | «change commercial name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Commercial Name» (text, 3/3) | «the commercial name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/clinic-catalog/medications` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre Genérico, Nombre Comercial. ¿Qué querés hacer |
| tabla · ordenar | «ordená por Nombre Genérico descendente» | ✅ | Te escucho «ordená por Nombre Genérico descendente» Tabla Ordené por Nombre Genérico, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz p |
| tabla · ocultar columna | «ocultá la columna Nombre Comercial» | ✅ | Te escucho «ocultá la columna Nombre Comercial» Tabla Oculté la columna Nombre Comercial. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Nombre Comercial» | ✅ | Te escucho «mostrá la columna Nombre Comercial» Tabla Muestro la columna Nombre Comercial. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Amoxicilina» | ✅ | escribió «Amoxicilina» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Ácido acetilsalicílico 100 mg · Aspirina. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Nuevo Medicamento Se abrió «Crear Nuevo Medicamento». Decime qué completar (Nombre Genérico, Nombre Comercial…) o qué apretar: Cancelar |
| campo «Nombre Genérico» (text, 1/3) | «poné nombre genérico Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre Genérico» (text, 2/3) | «cambiá nombre genérico a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre Genérico» (text, 3/3) | «el nombre genérico es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Nombre Comercial» (text, 1/3) | «poné nombre comercial Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre Comercial» (text, 2/3) | «cambiá nombre comercial a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre Comercial» (text, 3/3) | «el nombre comercial es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/availability-exceptions` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Doctor, Date, Available. What do you want to do? In  |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Availability Exception “Create Availability Exception” is open. Tell me what to fill in (Doctor, Start Time, End Time…) or what to press: |
| interruptor «Is Available?» on | «turn on Is Available?» | ✅ | quedó on |
| interruptor «Is Available?» off | «turn off Is Available?» | ✅ | quedó off |
| lista «Doctor» | «choose Dra. Valentina Sosa in doctor» | ✅ | quedó «Dra. Valentina Sosa» |
| cerrar la ventana | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Create Availability Exception. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/availability-exceptions` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Doctor, Fecha, Disponible. ¿Qué querés hacer? En la  |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Excepción de Disponibilidad Se abrió «Crear Excepción de Disponibilidad». Decime qué completar (Doctor, Hora de Inicio, Hora de Fin…) o |
| interruptor «¿Está Disponible?» on | «activá ¿Está Disponible?» | ✅ | quedó on |
| interruptor «¿Está Disponible?» off | «desactivá ¿Está Disponible?» | ✅ | quedó off |
| lista «Doctor» | «elegí Dra. Valentina Sosa en doctor» | ✅ | quedó «Dra. Valentina Sosa» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Crear Excepción de Disponibilidad. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/calendar-colors` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: General, Carrasco, Cirugia, Consultorio 33, Consultorio Caudillos, Consulto |
| alta | «new» | ✅ | pantalla sin alta |

## `/config/calendar-colors` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: General, Carrasco, Cirugia, Consultorio 33, Consultorio Caudillos, Consulto |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/config/calendars` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Name, Color, Active. What do you want to do? In the  |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Color column» | ✅ | Listening «hide the Color column» Table Hid the Color column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Color column» | ✅ | Listening «show the Color column» Table Showing the Color column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Carrasco» | ✅ | escribió «Carrasco» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Sillón Implantes 2 · #ffffff. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create calendar “Create calendar” is open. Tell me what to fill in (Name, Google Calendar ID, Color, Branch *…) or what to press: Cancel or Crea |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Google Calendar ID» (text, 1/3) | «set google calendar id to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Google Calendar ID» (text, 2/3) | «change google calendar id to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Google Calendar ID» (text, 3/3) | «the google calendar id is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Color» (color, 1/3) | «set color to red» | ✅ | quedó «#ef4444» |
| campo «Color» (color, 2/3) | «change color to blue» | ✅ | quedó «#3b82f6» |
| campo «Color» (color, 3/3) | «the color is green» | ✅ | quedó «#22c55e» |
| interruptor «Active» off | «turn off Active» | ✅ | quedó off |
| interruptor «Active» on | «turn on Active» | ✅ | quedó on |
| lista «Branch *» | «choose Sede Carrasco in branch *» | ✅ | quedó «Sede Carrasco» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/calendars` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre, Color, Activo. ¿Qué querés hacer? En la tabl |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Color» | ✅ | Te escucho «ocultá la columna Color» Tabla Oculté la columna Color. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Color» | ✅ | Te escucho «mostrá la columna Color» Tabla Muestro la columna Color. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Carrasco» | ✅ | escribió «Carrasco» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Sillón Implantes 2 · #ffffff. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear calendario Se abrió «Crear calendario». Decime qué completar (Nombre, ID de Google Calendar, Color, Sede *…) o qué apretar: Cancelar o  |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «ID de Google Calendar» (text, 1/3) | «poné id de google calendar Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «ID de Google Calendar» (text, 2/3) | «cambiá id de google calendar a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «ID de Google Calendar» (text, 3/3) | «el id de google calendar es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Color» (color, 1/3) | «poné color rojo» | ✅ | quedó «#ef4444» |
| campo «Color» (color, 2/3) | «cambiá color a azul» | ✅ | quedó «#3b82f6» |
| campo «Color» (color, 3/3) | «el color es verde» | ✅ | quedó «#22c55e» |
| interruptor «Activo» off | «desactivá Activo» | ✅ | quedó off |
| interruptor «Activo» on | «activá Activo» | ✅ | quedó on |
| lista «Sede *» | «elegí Sede Carrasco en sede *» | ✅ | quedó «Sede Carrasco» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/clinic-prefs` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Per service, On the total, Basic, Extended, Move Date down, Move Time up. W |
| alta | «new» | ✅ | pantalla sin alta |

## `/config/clinic-prefs` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Por servicio, Sobre el total, Básico, Extendido, Bajar Fecha, Subir Hora. ¿ |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/config/clinics` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: New branch, Edit branch, Delete, Save, Retry. What do you want to do? 1 New |
| alta · se abre y avisa | «new» | ✅ | Listening «new» New branch “New branch” is open. Tell me what to fill in (Name, Address, phone country, Phone…) or what to press: Cancel or Create. 1 Cancel 2 C |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Address» (text, 1/3) | «set address to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Address» (text, 2/3) | «change address to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Address» (text, 3/3) | «the address is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Phone» (phone, 1/3) | «set phone to 099 123 456» | ✅ | quedó «+598 99 123 456» |
| campo «Phone» (phone, 2/3) | «change phone to 098 765 432» | ✅ | quedó «+598 98 765 432» |
| campo «Phone» (phone, 3/3) | «the phone is 091 222 333» | ✅ | quedó «+598 91 222 333» |
| interruptor «Is Active?» off | «turn off Is Active?» | ✅ | quedó off |
| interruptor «Is Active?» on | «turn on Is Active?» | ✅ | quedó on |
| lista «phone country» | «choose Afghanistan in phone country» | ✅ | quedó «» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/clinics` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Nueva sede, Editar sede, Eliminar, Guardar, Reintentar. ¿Qué querés hacer?  |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Nueva sede Se abrió «Nueva sede». Decime qué completar (Nombre, Dirección, país del teléfono, Teléfono…) o qué apretar: Cancelar o Crear. 1 C |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Dirección» (text, 1/3) | «poné dirección Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Dirección» (text, 2/3) | «cambiá dirección a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Dirección» (text, 3/3) | «el dirección es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Teléfono» (phone, 1/3) | «poné teléfono 099 123 456» | ✅ | quedó «+598 99 123 456» |
| campo «Teléfono» (phone, 2/3) | «cambiá teléfono a 098 765 432» | ✅ | quedó «+598 98 765 432» |
| campo «Teléfono» (phone, 3/3) | «el teléfono es 091 222 333» | ✅ | quedó «+598 91 222 333» |
| interruptor «¿Está Activa?» off | «desactivá ¿Está Activa?» | ✅ | quedó off |
| interruptor «¿Está Activa?» on | «activá ¿Está Activa?» | ✅ | quedó on |
| lista «país del teléfono» | «elegí Afganistán en país del teléfono» | ✅ | quedó «» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/currencies` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Apply Filters, Date. What do you want to do? In the table too: “search…”, “ |
| tabla · ordenar | «sort by Date descending» | ✅ | Listening «sort by Date descending» Table Sorted by Date, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the USD Buy column» | ✅ | Listening «hide the USD Buy column» Table The USD Buy column can't be hidden. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened 2026-11-23T07:50:38.524. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta | «new» | ✅ | pantalla sin alta |

## `/config/currencies` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Aplicar Filtros, Fecha. ¿Qué querés hacer? En la tabla también: «buscá…», « |
| tabla · ordenar | «ordená por Fecha descendente» | ✅ | Te escucho «ordená por Fecha descendente» Tabla Ordené por Fecha, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Compra USD» | ✅ | Te escucho «ocultá la columna Compra USD» Tabla La columna Compra USD no se puede ocultar. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí 2026-11-23T07:50:38.524. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/config/doctor-availability` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Doctor, Recurrence, Start Time. What do you want to  |
| tabla · ordenar | «sort by Doctor descending» | ✅ | Listening «sort by Doctor descending» Table Sorted by Doctor, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Recurrence column» | ✅ | Listening «hide the Recurrence column» Table Hid the Recurrence column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Recurrence column» | ✅ | Listening «show the Recurrence column» Table Showing the Recurrence column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Raidel» | ✅ | escribió «Raidel» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Raidel Martínez · weekly · 08:00:00. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Availability “Create Availability” is open. Tell me what to fill in (Doctor, Recurrence, Start Time, End Time…) or what to press: Create  |
| campo «Start Date» (date, 1/3) | «set start date to December 15» | ✅ | quedó «15/12/2026» |
| campo «Start Date» (date, 2/3) | «change start date to January 3» | ✅ | quedó «03/01/2027» |
| campo «Start Date» (date, 3/3) | «the start date is March 20» | ✅ | quedó «20/03/2027» |
| campo «End Date» (date, 1/3) | «set end date to December 15» | ✅ | quedó «15/12/2026» |
| campo «End Date» (date, 2/3) | «change end date to January 3» | ✅ | quedó «03/01/2027» |
| campo «End Date» (date, 3/3) | «the end date is March 20» | ✅ | quedó «20/03/2027» |
| lista «Doctor» | «choose Dra. Valentina Sosa in doctor» | ✅ | quedó «Dra. Valentina Sosa» |
| lista «Recurrence» | «choose Biweekly in recurrence» | ✅ | quedó «Weekly» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/doctor-availability` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Doctor, Recurrencia, Hora de Inicio. ¿Qué querés hac |
| tabla · ordenar | «ordená por Doctor descendente» | ✅ | Te escucho «ordená por Doctor descendente» Tabla Ordené por Doctor, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Recurrencia» | ✅ | Te escucho «ocultá la columna Recurrencia» Tabla Oculté la columna Recurrencia. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Recurrencia» | ✅ | Te escucho «mostrá la columna Recurrencia» Tabla Muestro la columna Recurrencia. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Raidel» | ✅ | escribió «Raidel» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Raidel Martínez · weekly · 08:00:00. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Disponibilidad Se abrió «Crear Disponibilidad». Decime qué completar (Doctor, Recurrencia, Hora de Inicio, Hora de Fin…) o qué apretar: |
| campo «Fecha de Inicio» (date, 1/3) | «poné fecha de inicio el 15 de diciembre» | ✅ | quedó «15/12/2026» |
| campo «Fecha de Inicio» (date, 2/3) | «cambiá fecha de inicio a el 3 de enero» | ✅ | quedó «03/01/2027» |
| campo «Fecha de Inicio» (date, 3/3) | «el fecha de inicio es el 20 de marzo» | ✅ | quedó «20/03/2027» |
| campo «Fecha de Fin» (date, 1/3) | «poné fecha de fin el 15 de diciembre» | ✅ | quedó «15/12/2026» |
| campo «Fecha de Fin» (date, 2/3) | «cambiá fecha de fin a el 3 de enero» | ✅ | quedó «03/01/2027» |
| campo «Fecha de Fin» (date, 3/3) | «el fecha de fin es el 20 de marzo» | ✅ | quedó «20/03/2027» |
| lista «Doctor» | «elegí Dra. Valentina Sosa en doctor» | ✅ | quedó «» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/doctors` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Toggle columns, Create, Refresh, View, Name, Email. What do you want to do? |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Email column» | ✅ | Listening «hide the Email column» Table Hid the Email column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Email column» | ✅ | Listening «show the Email column» Table Showing the Email column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Raidel» | ✅ | escribió «Raidel» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Raidel Martínez · raidel@invokeia.com · 42321903. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta | «new» | ✅ | pantalla sin alta |

## `/config/doctors` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Alternar columnas, Crear, Refrescar, Ver, Nombre, Correo Electrónico. ¿Qué  |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Correo Electrónico» | ✅ | Te escucho «ocultá la columna Correo Electrónico» Tabla Oculté la columna Correo Electrónico. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Correo Electrónico» | ✅ | Te escucho «mostrá la columna Correo Electrónico» Tabla Muestro la columna Correo Electrónico. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apaga |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Raidel» | ✅ | escribió «Raidel» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Raidel Martínez · raidel@invokeia.com · 42321903. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/config/holidays` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Go to next page, Go to last page, Refresh, View, Date. What do you  |
| tabla · ordenar | «sort by Date descending» | ✅ | Listening «sort by Date descending» Table Sorted by Date, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Recurrence column» | ✅ | Listening «hide the Recurrence column» Table Hid the Recurrence column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Recurrence column» | ✅ | Listening «show the Recurrence column» Table Showing the Recurrence column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have time» | ✅ | escribió «time» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened 2027-01-06 · once · Día de Reyes. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create exception schedule “Create exception schedule” is open. Tell me what to fill in (Recurrence, Branch, Start Time, End Time…) or what to pr |
| campo «Notes» (text, 1/3) | «set notes to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Notes» (text, 2/3) | «change notes to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Notes» (text, 3/3) | «the notes is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Is Open?» on | «turn on Is Open?» | ✅ | quedó on |
| interruptor «Is Open?» off | «turn off Is Open?» | ✅ | quedó off |
| lista «Recurrence» | «choose Weekly in recurrence» | ✅ | quedó «One time» |
| lista «Branch» | «choose Sede Carrasco in branch» | ✅ | quedó «All branches» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/holidays` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Ir a la siguiente página, Ir a la última página, Refrescar, Ver, Fec |
| tabla · ordenar | «ordená por Fecha descendente» | ✅ | Te escucho «ordená por Fecha descendente» Tabla Ordené por Fecha, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Recurrencia» | ✅ | Te escucho «ocultá la columna Recurrencia» Tabla Oculté la columna Recurrencia. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Recurrencia» | ✅ | Te escucho «mostrá la columna Recurrencia» Tabla Muestro la columna Recurrencia. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Cerrado» | ✅ | escribió «Cerrado» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí 2027-01-06 · once · Día de Reyes. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear horario de excepción Se abrió «Crear horario de excepción». Decime qué completar (Recurrencia, Sede, Hora de Inicio, Hora de Fin…) o qu |
| campo «Notas» (text, 1/3) | «poné notas Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Notas» (text, 2/3) | «cambiá notas a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Notas» (text, 3/3) | «el notas es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «¿Está Abierto?» on | «activá ¿Está Abierto?» | ✅ | quedó on |
| interruptor «¿Está Abierto?» off | «desactivá ¿Está Abierto?» | ✅ | quedó off |
| lista «Recurrencia» | «elegí Semanal en recurrencia» | ✅ | quedó «Una vez» |
| lista «Sede» | «elegí Sede Carrasco en sede» | ✅ | quedó «Todas las sedes» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/lab-stages` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Add stage, Move stage Solicitud creada, Move stage Enviado al laboratorio,  |
| alta | «new» | ✅ | pantalla sin alta |

## `/config/lab-stages` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Agregar etapa, Mover la etapa Solicitud creada, Mover la etapa Enviado al l |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/config/medical-instruction-templates` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Name, Description, Active. What do you want to do? I |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Description column» | ✅ | Listening «hide the Description column» Table Hid the Description column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Description column» | ✅ | Listening «show the Description column» Table Showing the Description column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Cuidados» | ✅ | escribió «Cuidados» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Post Extracción · Plantilla por defecto. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Instruction Template “Create Instruction Template” is open. Tell me what to fill in (Name, Description, Fuente, Tamaño…) or what to press |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Description» (text, 1/3) | «set description to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Description» (text, 2/3) | «change description to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Description» (text, 3/3) | «the description is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Content» (text, 1/3) | «set content to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Content» (text, 2/3) | «change content to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Content» (text, 3/3) | «the content is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Is Active» off | «turn off Is Active» | ✅ | quedó off |
| interruptor «Is Active» on | «turn on Is Active» | ✅ | quedó on |
| lista «Fuente» | «choose Segoe UI in fuente» | ✅ | quedó «Fuente» |
| lista «Tamaño» | «choose 10px in tamaño» | ✅ | quedó «Tamaño» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/medical-instruction-templates` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre, Descripción, Activo. ¿Qué querés hacer? En l |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Descripción» | ✅ | Te escucho «ocultá la columna Descripción» Tabla Oculté la columna Descripción. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Descripción» | ✅ | Te escucho «mostrá la columna Descripción» Tabla Muestro la columna Descripción. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Cuidados» | ✅ | escribió «Cuidados» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Post Extracción · Plantilla por defecto. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Plantilla de Indicación Se abrió «Crear Plantilla de Indicación». Decime qué completar (Nombre, Descripción, Fuente, Tamaño…) o qué apr |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Descripción» (text, 1/3) | «poné descripción Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Descripción» (text, 2/3) | «cambiá descripción a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Descripción» (text, 3/3) | «el descripción es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Contenido» (text, 1/3) | «poné contenido Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Contenido» (text, 2/3) | «cambiá contenido a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Contenido» (text, 3/3) | «el contenido es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Está Activa» off | «desactivá Está Activa» | ✅ | quedó off |
| interruptor «Está Activa» on | «activá Está Activa» | ✅ | quedó on |
| lista «Fuente» | «elegí Segoe UI en fuente» | ✅ | quedó «Fuente» |
| lista «Tamaño» | «elegí 10px en tamaño» | ✅ | quedó «Tamaño» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/mutual-societies` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Name, Code, Active. What do you want to do? In the t |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Code column» | ✅ | Listening «hide the Code column» Table Hid the Code column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Code column» | ✅ | Listening «show the Code column» Table Showing the Code column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Corporación» | ✅ | escribió «Corporación» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Universal Sociedad de Producción Sanitaria · UNIVERSAL. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Mutual Society “Create Mutual Society” is open. Tell me what to fill in (Name, Code…) or what to press: Cancel or Create Society or Start |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Code» (text, 1/3) | «set code to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Code» (text, 2/3) | «change code to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Code» (text, 3/3) | «the code is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Active» off | «turn off Active» | ✅ | quedó off |
| interruptor «Active» on | «turn on Active» | ✅ | quedó on |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/mutual-societies` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre, Código, Activo. ¿Qué querés hacer? En la tab |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Código» | ✅ | Te escucho «ocultá la columna Código» Tabla Oculté la columna Código. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Código» | ✅ | Te escucho «mostrá la columna Código» Tabla Muestro la columna Código. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Corporación» | ✅ | escribió «Corporación» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Universal Sociedad de Producción Sanitaria · UNIVERSAL. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apag |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Sociedad Mutual Se abrió «Crear Sociedad Mutual». Decime qué completar (Nombre, Código…) o qué apretar: Cancelar o Crear Sociedad o Ini |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Código» (text, 1/3) | «poné código Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Código» (text, 2/3) | «cambiá código a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Código» (text, 3/3) | «el código es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Activo» off | «desactivá Activo» | ✅ | quedó off |
| interruptor «Activo» on | «activá Activo» | ✅ | quedó on |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/patient-groups` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Export all, Refresh, View, Name, Description. What do you want to d |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Description column» | ✅ | Listening «hide the Description column» Table Hid the Description column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Description column» | ✅ | Listening «show the Description column» Table Showing the Description column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Ortodoncia» | ✅ | escribió «Ortodoncia» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Ortodoncia · Brackets, controles y retenedores. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Patient Group “Create Patient Group” is open. Tell me what to fill in (Name…) or what to press: Cancel or Create Group or Start dictation |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Active» off | «turn off Active» | ✅ | quedó off |
| interruptor «Active» on | «turn on Active» | ✅ | quedó on |
| interruptor «This group represents a doctor» on | «turn on This group represents a doctor» | ✅ | quedó on |
| interruptor «This group represents a doctor» off | «turn off This group represents a doctor» | ✅ | quedó off |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/patient-groups` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Exportar todos, Refrescar, Ver, Nombre, Descripción. ¿Qué querés hac |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Descripción» | ✅ | Te escucho «ocultá la columna Descripción» Tabla Oculté la columna Descripción. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Descripción» | ✅ | Te escucho «mostrá la columna Descripción» Tabla Muestro la columna Descripción. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Ortodoncia» | ✅ | escribió «Ortodoncia» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Ortodoncia · Brackets, controles y retenedores. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Grupo de Pacientes Se abrió «Crear Grupo de Pacientes». Decime qué completar (Nombre, Descripción…) o qué apretar: Cancelar o Crear Gru |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Descripción» (text, 1/3) | «poné descripción Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Descripción» (text, 2/3) | «cambiá descripción a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Descripción» (text, 3/3) | «el descripción es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Activo» off | «desactivá Activo» | ✅ | quedó off |
| interruptor «Activo» on | «activá Activo» | ✅ | quedó on |
| interruptor «Este grupo representa a un doctor» on | «activá Este grupo representa a un doctor» | ✅ | quedó on |
| interruptor «Este grupo representa a un doctor» off | «desactivá Este grupo representa a un doctor» | ✅ | quedó off |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/patients-portal` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Try it, Download, Print flyer, Start dictation. What do you want to do? 1 T |
| alta | «new» | ✅ | pantalla sin alta |

## `/config/patients-portal` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Probar, Descargar, Imprimir flier, Iniciar dictado. ¿Qué querés hacer? 1 Pr |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/config/prescription-templates` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Name, Description, Active. What do you want to do? I |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Description column» | ✅ | Listening «hide the Description column» Table Hid the Description column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Description column» | ✅ | Listening «show the Description column» Table Showing the Description column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Receta» | ✅ | escribió «Receta» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Receta médica estándar · Formato clásico de receta uruguaya: membrete de la clínica, datos del paciente, Rp. y firma del p |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Prescription Template “Create Prescription Template” is open. Tell me what to fill in (Name, Description, Fuente, Tamaño…) or what to pre |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Description» (text, 1/3) | «set description to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Description» (text, 2/3) | «change description to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Description» (text, 3/3) | «the description is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Content» (text, 1/3) | «set content to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Content» (text, 2/3) | «change content to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Content» (text, 3/3) | «the content is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Is Active» off | «turn off Is Active» | ✅ | quedó off |
| interruptor «Is Active» on | «turn on Is Active» | ✅ | quedó on |
| lista «Fuente» | «choose Segoe UI in fuente» | ✅ | quedó «Fuente» |
| lista «Tamaño» | «choose 10px in tamaño» | ✅ | quedó «Tamaño» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/prescription-templates` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre, Descripción, Activo. ¿Qué querés hacer? En l |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Descripción» | ✅ | Te escucho «ocultá la columna Descripción» Tabla Oculté la columna Descripción. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Descripción» | ✅ | Te escucho «mostrá la columna Descripción» Tabla Muestro la columna Descripción. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Receta» | ✅ | escribió «Receta» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Receta médica estándar · Formato clásico de receta uruguaya: membrete de la clínica, datos del paciente, Rp. y firma del |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Plantilla de Receta Se abrió «Crear Plantilla de Receta». Decime qué completar (Nombre, Descripción, Fuente, Tamaño…) o qué apretar: Cr |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Descripción» (text, 1/3) | «poné descripción Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Descripción» (text, 2/3) | «cambiá descripción a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Descripción» (text, 3/3) | «el descripción es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Contenido» (text, 1/3) | «poné contenido Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Contenido» (text, 2/3) | «cambiá contenido a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Contenido» (text, 3/3) | «el contenido es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Está Activa» off | «desactivá Está Activa» | ✅ | quedó off |
| interruptor «Está Activa» on | «activá Está Activa» | ✅ | quedó on |
| lista «Fuente» | «elegí Segoe UI en fuente» | ✅ | quedó «Fuente» |
| lista «Tamaño» | «elegí 10px en tamaño» | ✅ | quedó «Tamaño» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/provider-groups` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Name, Description, Active. What do you want to do? I |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Description column» | ✅ | Listening «hide the Description column» Table Hid the Description column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Description column» | ✅ | Listening «show the Description column» Table Showing the Description column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Protesis» | ✅ | escribió «Protesis» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Prótesis removible · Prótesis parciales y completas, acrílicas y de cromo-cobalto.. I'm listening: just talk · Esc cancels |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Provider Group “Create Provider Group” is open. Tell me what to fill in (Name…) or what to press: Cancel or Create Group or Start dictati |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Active» off | «turn off Active» | ✅ | quedó off |
| interruptor «Active» on | «turn on Active» | ✅ | quedó on |
| interruptor «Laboratory category» on | «turn on Laboratory category» | ✅ | quedó on |
| interruptor «Laboratory category» off | «turn off Laboratory category» | ✅ | quedó off |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/provider-groups` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre, Descripción, Activo. ¿Qué querés hacer? En l |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Descripción» | ✅ | Te escucho «ocultá la columna Descripción» Tabla Oculté la columna Descripción. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Descripción» | ✅ | Te escucho «mostrá la columna Descripción» Tabla Muestro la columna Descripción. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Protesis» | ✅ | escribió «Protesis» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Prótesis removible · Prótesis parciales y completas, acrílicas y de cromo-cobalto.. Te escucho: hablá normalmente · Esc  |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Grupo de Proveedores Se abrió «Crear Grupo de Proveedores». Decime qué completar (Nombre, Descripción…) o qué apretar: Cancelar o Crear |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Descripción» (text, 1/3) | «poné descripción Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Descripción» (text, 2/3) | «cambiá descripción a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Descripción» (text, 3/3) | «el descripción es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Activo» off | «desactivá Activo» | ✅ | quedó off |
| interruptor «Activo» on | «activá Activo» | ✅ | quedó on |
| interruptor «Categoría de laboratorio» on | «activá Categoría de laboratorio» | ✅ | quedó on |
| interruptor «Categoría de laboratorio» off | «desactivá Categoría de laboratorio» | ✅ | quedó off |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/schedules` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Sede Carrasco, Sede Malvín, Convencion 1560, Clínica Salud Dental Total, Se |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create schedule— Sede Carrasco “Create schedule— Sede Carrasco” is open. Tell me what to fill in (Start Time, End Time…) or what to press: Cance |
| cerrar la ventana | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Create schedule— Sede Carrasco. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/schedules` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Sede Carrasco, Sede Malvín, Convencion 1560, Clínica Salud Dental Total, Se |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear horario— Sede Carrasco Se abrió «Crear horario— Sede Carrasco». Decime qué completar (Hora de Inicio, Hora de Fin…) o qué apretar: Canc |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Crear horario— Sede Carrasco. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/sedes` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Name, Address, Phone. What do you want to do? In the |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Address column» | ✅ | Listening «hide the Address column» Table Hid the Address column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Address column» | ✅ | Listening «show the Address column» Table Showing the Address column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Sede» | ✅ | escribió «Sede» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Sede de la Esquina · Carlos Quijano 1536. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» New Branch “New Branch” is open. Tell me what to fill in (Name, Address, phone country, Phone…) or what to press: Cancel or Create. 1 Cancel 2 C |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Address» (text, 1/3) | «set address to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Address» (text, 2/3) | «change address to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Address» (text, 3/3) | «the address is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Phone» (phone, 1/3) | «set phone to 099 123 456» | ✅ | quedó «+598 99 123 456» |
| campo «Phone» (phone, 2/3) | «change phone to 098 765 432» | ✅ | quedó «+598 98 765 432» |
| campo «Phone» (phone, 3/3) | «the phone is 091 222 333» | ✅ | quedó «+598 91 222 333» |
| interruptor «Is Active?» off | «turn off Is Active?» | ✅ | quedó off |
| interruptor «Is Active?» on | «turn on Is Active?» | ✅ | quedó on |
| lista «phone country» | «choose Afghanistan in phone country» | ✅ | quedó «» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/sedes` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre, Dirección, Teléfono. ¿Qué querés hacer? En l |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Dirección» | ✅ | Te escucho «ocultá la columna Dirección» Tabla Oculté la columna Dirección. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Dirección» | ✅ | Te escucho «mostrá la columna Dirección» Tabla Muestro la columna Dirección. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Sede» | ✅ | escribió «Sede» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Sede de la Esquina · Carlos Quijano 1536. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Nueva Sede Se abrió «Nueva Sede». Decime qué completar (Nombre, Dirección, país del teléfono, Teléfono…) o qué apretar: Cancelar o Crear. 1 C |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Dirección» (text, 1/3) | «poné dirección Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Dirección» (text, 2/3) | «cambiá dirección a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Dirección» (text, 3/3) | «el dirección es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Teléfono» (phone, 1/3) | «poné teléfono 099 123 456» | ✅ | quedó «+598 99 123 456» |
| campo «Teléfono» (phone, 2/3) | «cambiá teléfono a 098 765 432» | ✅ | quedó «+598 98 765 432» |
| campo «Teléfono» (phone, 3/3) | «el teléfono es 091 222 333» | ✅ | quedó «+598 91 222 333» |
| interruptor «¿Está Activa?» off | «desactivá ¿Está Activa?» | ✅ | quedó off |
| interruptor «¿Está Activa?» on | «activá ¿Está Activa?» | ✅ | quedó on |
| lista «país del teléfono» | «elegí Afganistán en país del teléfono» | ✅ | quedó «» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/sequences` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Advanced Filters, Create New, Refresh, Name, Document Type, Pattern. What d |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Document Type column» | ✅ | Listening «hide the Document Type column» Table Hid the Document Type column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Document Type column» | ✅ | Listening «show the Document Type column» Table Showing the Document Type column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Gastos» | ✅ | escribió «Gastos» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Quote Sequence · quote · QUO-{YYYY}-{MM}-{COUNTER:6}. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Sequence “Create Sequence” is open. Tell me what to fill in (Sequence Name, Document Type, Pattern, Current Counter…) or what to press: C |
| campo «Sequence Name» (text, 1/3) | «set sequence name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Sequence Name» (text, 2/3) | «change sequence name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Sequence Name» (text, 3/3) | «the sequence name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Pattern» (text, 1/3) | «set pattern to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Pattern» (text, 2/3) | «change pattern to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Pattern» (text, 3/3) | «the pattern is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Current Counter» (number, 1/3) | «set current counter to 1500» | ✅ | quedó «1500» |
| campo «Current Counter» (number, 2/3) | «change current counter to 2300» | ✅ | quedó «2300» |
| campo «Current Counter» (number, 3/3) | «the current counter is 99» | ✅ | quedó «99» |
| interruptor «Active» off | «turn off Active» | ✅ | quedó off |
| interruptor «Active» on | «turn on Active» | ✅ | quedó on |
| lista «Document Type» | «choose Quote in document type» | ✅ | quedó «Invoice» |
| lista «Reset Period» | «choose Yearly in reset period» | ✅ | quedó «Never» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/sequences` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Filtros Avanzados, Crear Nuevo, Guardar, Nombre, Tipo de Documento, Patrón. |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Tipo de Documento» | ✅ | Te escucho «ocultá la columna Tipo de Documento» Tabla Oculté la columna Tipo de Documento. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Tipo de Documento» | ✅ | Te escucho «mostrá la columna Tipo de Documento» Tabla Muestro la columna Tipo de Documento. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Gastos» | ✅ | escribió «Gastos» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Quote Sequence · quote · QUO-{YYYY}-{MM}-{COUNTER:6}. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Secuencia Se abrió «Crear Secuencia». Decime qué completar (Nombre de Secuencia, Tipo de Documento, Patrón, Contador Actual…) o qué apr |
| campo «Nombre de Secuencia» (text, 1/3) | «poné nombre de secuencia Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre de Secuencia» (text, 2/3) | «cambiá nombre de secuencia a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre de Secuencia» (text, 3/3) | «el nombre de secuencia es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Patrón» (text, 1/3) | «poné patrón Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Patrón» (text, 2/3) | «cambiá patrón a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Patrón» (text, 3/3) | «el patrón es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Contador Actual» (number, 1/3) | «poné contador actual 1500» | ✅ | quedó «1500» |
| campo «Contador Actual» (number, 2/3) | «cambiá contador actual a 2300» | ✅ | quedó «2300» |
| campo «Contador Actual» (number, 3/3) | «el contador actual es 99» | ✅ | quedó «99» |
| interruptor «Activo» off | «desactivá Activo» | ✅ | quedó off |
| interruptor «Activo» on | «activá Activo» | ✅ | quedó on |
| lista «Tipo de Documento» | «elegí Presupuesto en tipo de documento» | ✅ | quedó «Factura» |
| lista «Período de Reinicio» | «elegí Anualmente en período de reinicio» | ✅ | quedó «Nunca» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/services` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Go to next page, Go to last page, Refresh, View, ID. What do you wa |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Category column» | ✅ | Listening «hide the Category column» Table Hid the Category column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Category column» | ✅ | Listening «show the Category column» Table Showing the Category column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Prueba» | ✅ | escribió «Prueba» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Edit Service “Edit Service” is open. Tell me what to fill in (Name, Category, Price, Currency…) or what to press: Save Changes or Cance |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Edit Service. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Service “Create Service” is open. Tell me what to fill in (Name, Category, Price, Currency…) or what to press: Save or Cancel or Start di |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Price» (number, 1/3) | «set price to 1500» | ✅ | quedó «1500.00» |
| campo «Price» (number, 2/3) | «change price to 2300» | ✅ | quedó «2300.00» |
| campo «Price» (number, 3/3) | «the price is 99» | ✅ | quedó «99.00» |
| campo «Duration» (number, 1/3) | «set duration to 1500» | ✅ | quedó «1500» |
| campo «Duration» (number, 2/3) | «change duration to 2300» | ✅ | quedó «2300» |
| campo «Duration» (number, 3/3) | «the duration is 99» | ✅ | quedó «99» |
| interruptor «Workflow Service» on | «turn on Workflow Service» | ✅ | quedó on |
| interruptor «Workflow Service» off | «turn off Workflow Service» | ✅ | quedó off |
| lista «Category» | «choose Odontología general in category» | ✅ | quedó «Select Category» |
| lista «Currency» | «choose USD · US$ in currency» | ✅ | quedó «UYU · $U» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/config/services` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Ir a la siguiente página, Ir a la última página, Refrescar, Ver, ID. |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Categoría» | ✅ | Te escucho «ocultá la columna Categoría» Tabla Oculté la columna Categoría. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Categoría» | ✅ | Te escucho «mostrá la columna Categoría» Tabla Muestro la columna Categoría. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Prueba» | ✅ | escribió «Prueba» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Editar Servicio Se abrió «Editar Servicio». Decime qué completar (Nombre, Categoría, Precio, Moneda…) o qué apretar: Guardar Cambio |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Editar Servicio. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Servicio Se abrió «Crear Servicio». Decime qué completar (Nombre, Categoría, Precio, Moneda…) o qué apretar: Guardar o Cancelar o Inici |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Precio» (number, 1/3) | «poné precio 1500» | ✅ | quedó «1500.00» |
| campo «Precio» (number, 2/3) | «cambiá precio a 2300» | ✅ | quedó «2300.00» |
| campo «Precio» (number, 3/3) | «el precio es 99» | ✅ | quedó «99.00» |
| campo «Duración» (number, 1/3) | «poné duración 1500» | ✅ | quedó «1500» |
| campo «Duración» (number, 2/3) | «cambiá duración a 2300» | ✅ | quedó «2300» |
| campo «Duración» (number, 3/3) | «el duración es 99» | ✅ | quedó «99» |
| interruptor «Servicio con Flujo» on | «activá Servicio con Flujo» | ✅ | quedó on |
| interruptor «Servicio con Flujo» off | «desactivá Servicio con Flujo» | ✅ | quedó off |
| lista «Categoría» | «elegí Odontología general en categoría» | ✅ | quedó «Seleccionar Categoría» |
| lista «Moneda» | «elegí USD · US$ en moneda» | ✅ | quedó «UYU · $U» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/config/templates` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Invoice, Quote, Payment, Credit Note, Prepayment, Financial Summary. What d |
| alta | «new» | ✅ | pantalla sin alta |

## `/config/templates` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Factura, Presupuesto, Pago, Nota de Crédito, Prepago, Resumen Financiero. ¿ |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/lab-orders` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Set up, List, Board, New order, Overdue only · 4, Urgent. What do you want  |
| tabla · ordenar | «sort by Patient descending» | ✅ | Listening «sort by Patient descending» Table Sorted by Patient, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Lab column» | ✅ | Listening «hide the Lab column» Table Hid the Lab column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Lab column» | ✅ | Listening «show the Lab column» Table Showing the Lab column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Carolina» | ✅ | escribió «Carolina» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened 3 · Valentina Rodríguez Barreto · ProtéticaLab Montevideo. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» New lab order “New lab order” is open. Tell me what to fill in (Patient, doctor…) or what to press: Cancel or Continue or 1 · Patient or 2 · Job |
| lista «Patient» | «choose Jorge Méndez in patient» | ✅ | quedó «Jorge Méndez» |
| lista «doctor» | «choose Dra. Valentina Sosa in doctor» | ✅ | quedó «Raidel Martínez» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/lab-orders` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Configurar, Lista, Tablero, Nueva orden, Solo atrasadas · 4, Urgentes. ¿Qué |
| tabla · ordenar | «ordená por Paciente descendente» | ✅ | Te escucho «ordená por Paciente descendente» Tabla Ordené por Paciente, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Laboratorio» | ✅ | Te escucho «ocultá la columna Laboratorio» Tabla Oculté la columna Laboratorio. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Laboratorio» | ✅ | Te escucho «mostrá la columna Laboratorio» Tabla Muestro la columna Laboratorio. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Carolina» | ✅ | escribió «Carolina» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí 3 · Valentina Rodríguez Barreto · ProtéticaLab Montevideo. Te escucho: hablá normalmente · Esc cancela · tocá Voz para a |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Nueva orden de laboratorio Se abrió «Nueva orden de laboratorio». Decime qué completar (Paciente, doctor…) o qué apretar: Cancelar o Continua |
| lista «Paciente» | «elegí Jorge Méndez en paciente» | ✅ | quedó «Jorge Méndez» |
| lista «doctor» | «elegí Dra. Valentina Sosa en doctor» | ✅ | quedó «Dra. Valentina Sosa» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/patients` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Toggle columns, Create, Go to next page, Go to last page, Refresh, View. Wh |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Email column» | ✅ | Listening «hide the Email column» Table Hid the Email column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Email column» | ✅ | Listening «show the Email column» Table Showing the Email column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Jorge» | ✅ | escribió «Jorge» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Yamila · yamila@invokeia.com. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create New Patient “Create New Patient” is open. Tell me what to fill in (Name, Email, phone country, Phone…) or what to press: Create Patient o |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Email» (text, 1/3) | «set email to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Email» (text, 2/3) | «change email to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Email» (text, 3/3) | «the email is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Phone» (phone, 1/3) | «set phone to 099 123 456» | ✅ | quedó «+598 99 123 456» |
| campo «Phone» (phone, 2/3) | «change phone to 098 765 432» | ✅ | quedó «+598 98 765 432» |
| campo «Phone» (phone, 3/3) | «the phone is 091 222 333» | ✅ | quedó «+598 91 222 333» |
| interruptor «Is Active» off | «turn off Is Active» | ✅ | quedó off |
| interruptor «Is Active» on | «turn on Is Active» | ✅ | quedó on |
| lista «phone country» | «choose Afghanistan in phone country» | ✅ | quedó «» |
| lista «Document Type» | «choose Foreign National ID in document type» | ✅ | quedó «Uruguayan National ID» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |

## `/patients` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Alternar columnas, Crear, Ir a la siguiente página, Ir a la última página,  |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Correo Electrónico» | ✅ | Te escucho «ocultá la columna Correo Electrónico» Tabla Oculté la columna Correo Electrónico. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Correo Electrónico» | ✅ | Te escucho «mostrá la columna Correo Electrónico» Tabla Muestro la columna Correo Electrónico. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apaga |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Jorge» | ✅ | escribió «Jorge» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Yamila · yamila@invokeia.com. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Nuevo Paciente Se abrió «Crear Nuevo Paciente». Decime qué completar (Nombre, Correo Electrónico, país del teléfono, Teléfono…) o qué a |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Correo Electrónico» (text, 1/3) | «poné correo electrónico Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Correo Electrónico» (text, 2/3) | «cambiá correo electrónico a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Correo Electrónico» (text, 3/3) | «el correo electrónico es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Teléfono» (phone, 1/3) | «poné teléfono 099 123 456» | ✅ | quedó «+598 99 123 456» |
| campo «Teléfono» (phone, 2/3) | «cambiá teléfono a 098 765 432» | ✅ | quedó «+598 98 765 432» |
| campo «Teléfono» (phone, 3/3) | «el teléfono es 091 222 333» | ✅ | quedó «+598 91 222 333» |
| interruptor «Está Activo» off | «desactivá Está Activo» | ✅ | quedó off |
| interruptor «Está Activo» on | «activá Está Activo» | ✅ | quedó on |
| lista «país del teléfono» | «elegí Afganistán en país del teléfono» | ✅ | quedó «» |
| lista «Tipo de Documento» | «elegí Cédula Extranjera en tipo de documento» | ✅ | quedó «Cédula Uruguaya» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |

## `/permissions` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Go to next page, Go to last page, Refresh, View, ID. What do you wa |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Description column» | ✅ | Listening «hide the Description column» Table Hid the Description column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Description column» | ✅ | Listening «show the Description column» Table Showing the Description column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Abrir» | ✅ | escribió «Abrir» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened 117 · Ver órdenes recientes · Ver tabla de órdenes recientes en el dashboard. I'm listening: just talk · Esc cancels · tap |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create a new permission “Create a new permission” is open. Tell me what to fill in (Name, Description, Action, Resource…) or what to press: Crea |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Description» (text, 1/3) | «set description to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Description» (text, 2/3) | «change description to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Description» (text, 3/3) | «the description is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Resource» (text, 1/3) | «set resource to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Resource» (text, 2/3) | «change resource to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Resource» (text, 3/3) | «the resource is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| lista «Action» | «choose Create in action» | ✅ | quedó «Select Action» |
| cerrar la ventana | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Create a new permission. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/permissions` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Ir a la siguiente página, Ir a la última página, Refrescar, Ver, ID. |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Descripción» | ✅ | Te escucho «ocultá la columna Descripción» Tabla Oculté la columna Descripción. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Descripción» | ✅ | Te escucho «mostrá la columna Descripción» Tabla Muestro la columna Descripción. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Abrir» | ✅ | escribió «Abrir» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí 117 · Ver órdenes recientes · Ver tabla de órdenes recientes en el dashboard. Te escucho: hablá normalmente · Esc cancel |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear un nuevo permiso Se abrió «Crear un nuevo permiso». Decime qué completar (Nombre, Descripción, Acción, Recurso…) o qué apretar: Crear o |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Descripción» (text, 1/3) | «poné descripción Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Descripción» (text, 2/3) | «cambiá descripción a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Descripción» (text, 3/3) | «el descripción es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Recurso» (text, 1/3) | «poné recurso Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Recurso» (text, 2/3) | «cambiá recurso a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Recurso» (text, 3/3) | «el recurso es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| lista «Acción» | «elegí Crear en acción» | ✅ | quedó «Seleccionar Acción» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Crear un nuevo permiso. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/purchases/invoices` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Toggle columns, Create, Import, Export, Go to next page, Go to last page. W |
| tabla · ordenar | «sort by Doc. No descending» | ✅ | Listening «sort by Doc. No descending» Table Sorted by Doc. No, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Provider column» | ✅ | Listening «hide the Provider column» Table Hid the Provider column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Provider column» | ✅ | Listening «show the Provider column» Table Showing the Provider column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Cerámica» | ✅ | escribió «Cerámica» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened INV-2026-10-003394 · Cerámica Dental Prado · 18200.00. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Invoice “Create Invoice” is open. Tell me what to fill in (Provider, Type, Currency, doctor…) or what to press: Cancel or Save or Open ca |
| campo «Invoice Date» (date, 1/3) | «set invoice date to December 15» | ✅ | quedó «15/12/2026» |
| campo «Invoice Date» (date, 2/3) | «change invoice date to January 3» | ✅ | quedó «03/01/2027» |
| campo «Invoice Date» (date, 3/3) | «the invoice date is March 20» | ✅ | quedó «20/03/2027» |
| campo «Due Date» (date, 1/3) | «set due date to December 15» | ✅ | quedó «15/12/2026» |
| campo «Due Date» (date, 2/3) | «change due date to January 3» | ✅ | quedó «03/01/2027» |
| campo «Due Date» (date, 3/3) | «the due date is March 20» | ✅ | quedó «20/03/2027» |
| campo «Notes» (text, 1/3) | «set notes to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Notes» (text, 2/3) | «change notes to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Notes» (text, 3/3) | «the notes is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Historical» on | «turn on Historical» | ✅ | quedó on |
| interruptor «Historical» off | «turn off Historical» | ✅ | quedó off |
| lista «Provider» | «choose Laboratorio Y in provider» | ✅ | quedó «Laboratorio Y» |
| lista «Type» | «choose Credit Note in type» | ✅ | quedó «Invoice» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/purchases/invoices` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Alternar columnas, Crear, Importar, Exportar, Ir a la siguiente página, Ir  |
| tabla · ordenar | «ordená por Doc. No descendente» | ✅ | Te escucho «ordená por Doc. No descendente» Tabla Ordené por Doc. No, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Proveedor» | ✅ | Te escucho «ocultá la columna Proveedor» Tabla Oculté la columna Proveedor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Proveedor» | ✅ | Te escucho «mostrá la columna Proveedor» Tabla Muestro la columna Proveedor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Cerámica» | ✅ | escribió «Cerámica» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí INV-2026-10-003394 · Cerámica Dental Prado · 18200.00. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apaga |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Factura Se abrió «Crear Factura». Decime qué completar (Proveedor, Tipo, Moneda, doctor…) o qué apretar: Cancelar o Guardar o Open cale |
| campo «Fecha de Factura» (date, 1/3) | «poné fecha de factura el 15 de diciembre» | ✅ | quedó «15/12/2026» |
| campo «Fecha de Factura» (date, 2/3) | «cambiá fecha de factura a el 3 de enero» | ✅ | quedó «03/01/2027» |
| campo «Fecha de Factura» (date, 3/3) | «el fecha de factura es el 20 de marzo» | ✅ | quedó «20/03/2027» |
| campo «Vencimiento» (date, 1/3) | «poné vencimiento el 15 de diciembre» | ✅ | quedó «15/12/2026» |
| campo «Vencimiento» (date, 2/3) | «cambiá vencimiento a el 3 de enero» | ✅ | quedó «03/01/2027» |
| campo «Vencimiento» (date, 3/3) | «el vencimiento es el 20 de marzo» | ✅ | quedó «20/03/2027» |
| campo «Notas» (text, 1/3) | «poné notas Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Notas» (text, 2/3) | «cambiá notas a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Notas» (text, 3/3) | «el notas es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Histórico» on | «activá Histórico» | ✅ | quedó on |
| interruptor «Histórico» off | «desactivá Histórico» | ✅ | quedó off |
| lista «Tipo» | «elegí Nota de Crédito en tipo» | ✅ | quedó «Factura» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/purchases/payments` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Toggle columns, Create Prepaid, Export, Go to next page, Go to last page, R |
| tabla · ordenar | «sort by Document No. descending» | ✅ | Listening «sort by Document No. descending» Table Sorted by Document No., descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the User column» | ✅ | Listening «hide the User column» Table Hid the User column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the User column» | ✅ | Listening «show the User column» Table Showing the User column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Cerámica» | ✅ | escribió «Cerámica» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened PAY-2026-10-003250 · Cerámica Dental Prado · INV-2026-10-003394. I'm listening: just talk · Esc cancels · tap Voice to tur |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» New Supplier Pre-payment “New Supplier Pre-payment” is open. Tell me what to fill in (Supplier, Amount, Currency, Payment Method…) or what to pr |
| campo «Amount» (number, 1/3) | «set amount to 1500» | ✅ | quedó «1500.00» |
| campo «Amount» (number, 2/3) | «change amount to 2300» | ✅ | quedó «2300.00» |
| campo «Amount» (number, 3/3) | «the amount is 99» | ✅ | quedó «99.00» |
| campo «Payment Date» (date, 1/3) | «set payment date to December 15» | ✅ | quedó «15/12/2026» |
| campo «Payment Date» (date, 2/3) | «change payment date to January 3» | ✅ | quedó «03/01/2027» |
| campo «Payment Date» (date, 3/3) | «the payment date is March 20» | ✅ | quedó «20/03/2027» |
| campo «Notes» (text, 1/3) | «set notes to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Notes» (text, 2/3) | «change notes to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Notes» (text, 3/3) | «the notes is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| lista «Supplier» | «choose Laboratorio Y in supplier» | ✅ | quedó «» |
| lista «Currency» | «choose USD · US$ in currency» | ✅ | quedó «UYU · $U» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/purchases/payments` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Alternar columnas, Crear Prepago, Exportar, Ir a la siguiente página, Ir a  |
| tabla · ordenar | «ordená por No. Documento descendente» | ✅ | Te escucho «ordená por No. Documento descendente» Tabla Ordené por No. Documento, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para  |
| tabla · ocultar columna | «ocultá la columna Usuario» | ✅ | Te escucho «ocultá la columna Usuario» Tabla Oculté la columna Usuario. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Usuario» | ✅ | Te escucho «mostrá la columna Usuario» Tabla Muestro la columna Usuario. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Cerámica» | ✅ | escribió «Cerámica» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí PAY-2026-10-003250 · Cerámica Dental Prado · INV-2026-10-003394. Te escucho: hablá normalmente · Esc cancela · tocá Voz  |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Nuevo Pre-pago a Proveedor Se abrió «Nuevo Pre-pago a Proveedor». Decime qué completar (Proveedor, Monto, Moneda, Método de Pago…) o qué apre |
| campo «Monto» (number, 1/3) | «poné monto 1500» | ✅ | quedó «1500.00» |
| campo «Monto» (number, 2/3) | «cambiá monto a 2300» | ✅ | quedó «2300.00» |
| campo «Monto» (number, 3/3) | «el monto es 99» | ✅ | quedó «99.00» |
| campo «Fecha de Pago» (date, 1/3) | «poné fecha de pago el 15 de diciembre» | ✅ | quedó «15/12/2026» |
| campo «Fecha de Pago» (date, 2/3) | «cambiá fecha de pago a el 3 de enero» | ✅ | quedó «03/01/2027» |
| campo «Fecha de Pago» (date, 3/3) | «el fecha de pago es el 20 de marzo» | ✅ | quedó «20/03/2027» |
| campo «Notas» (text, 1/3) | «poné notas Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Notas» (text, 2/3) | «cambiá notas a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Notas» (text, 3/3) | «el notas es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| lista «Proveedor» | «elegí Laboratorio Y en proveedor» | ✅ | quedó «» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/purchases/providers` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Name, Email, Identity Document. What do you want to  |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Email column» | ✅ | Listening «hide the Email column» Table Hid the Email column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Email column» | ✅ | Listening «show the Email column» Table Showing the Email column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Laboratorio» | ✅ | escribió «Laboratorio» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened ProtéticaLab Montevideo · lab.mvd@prueba.invalid · +59899100003. I'm listening: just talk · Esc cancels · tap Voice to tur |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create provider “Create provider” is open. Tell me what to fill in (Name, Email, phone country, Phone…) or what to press: Cancel or Create or St |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Email» (text, 1/3) | «set email to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Email» (text, 2/3) | «change email to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Email» (text, 3/3) | «the email is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Phone» (phone, 1/3) | «set phone to 099 123 456» | ✅ | quedó «+598 99 123 456» |
| campo «Phone» (phone, 2/3) | «change phone to 098 765 432» | ✅ | quedó «+598 98 765 432» |
| campo «Phone» (phone, 3/3) | «the phone is 091 222 333» | ✅ | quedó «+598 91 222 333» |
| interruptor «Is Active?» off | «turn off Is Active?» | ✅ | quedó off |
| interruptor «Is Active?» on | «turn on Is Active?» | ✅ | quedó on |
| lista «phone country» | «choose Afghanistan in phone country» | ✅ | quedó «» |
| lista «phone country» | «choose Afghanistan in phone country» | ✅ | quedó «» |
| cerrar la ventana | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Create provider. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/purchases/providers` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre, Correo Electrónico, Documento de Identidad.  |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Correo Electrónico» | ✅ | Te escucho «ocultá la columna Correo Electrónico» Tabla Oculté la columna Correo Electrónico. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Correo Electrónico» | ✅ | Te escucho «mostrá la columna Correo Electrónico» Tabla Muestro la columna Correo Electrónico. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apaga |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Laboratorio» | ✅ | escribió «Laboratorio» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí ProtéticaLab Montevideo · lab.mvd@prueba.invalid · +59899100003. Te escucho: hablá normalmente · Esc cancela · tocá Voz  |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear proveedor Se abrió «Crear proveedor». Decime qué completar (Nombre, Correo Electrónico, país del teléfono, Teléfono…) o qué apretar: Ca |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Correo Electrónico» (text, 1/3) | «poné correo electrónico Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Correo Electrónico» (text, 2/3) | «cambiá correo electrónico a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Correo Electrónico» (text, 3/3) | «el correo electrónico es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Teléfono» (phone, 1/3) | «poné teléfono 099 123 456» | ✅ | quedó «+598 99 123 456» |
| campo «Teléfono» (phone, 2/3) | «cambiá teléfono a 098 765 432» | ✅ | quedó «+598 98 765 432» |
| campo «Teléfono» (phone, 3/3) | «el teléfono es 091 222 333» | ✅ | quedó «+598 91 222 333» |
| interruptor «¿Está Activo?» off | «desactivá ¿Está Activo?» | ✅ | quedó off |
| interruptor «¿Está Activo?» on | «activá ¿Está Activo?» | ✅ | quedó on |
| lista «país del teléfono» | «elegí Afganistán en país del teléfono» | ✅ | quedó «» |
| lista «país del teléfono» | «elegí Afganistán en país del teléfono» | ✅ | quedó «» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Crear proveedor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/purchases/quotes` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Export, Refresh, Tabla, Lista, View. What do you want to do? 1 Crea |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Quote “Create Quote” is open. Tell me what to fill in (User, Date, Currency, location…) or what to press: Cancel or Save or Open calendar |
| campo «Date» (date, 1/3) | «set date to December 15» | ✅ | quedó «15/12/2026» |
| campo «Date» (date, 2/3) | «change date to January 3» | ✅ | quedó «03/01/2027» |
| campo «Date» (date, 3/3) | «the date is March 20» | ✅ | quedó «20/03/2027» |
| campo «Notes» (text, 1/3) | «set notes to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Notes» (text, 2/3) | «change notes to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Notes» (text, 3/3) | «the notes is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| lista «User» | «choose Laboratorio Y in user» | ✅ | quedó «Laboratorio Y» |
| lista «Currency» | «choose USD · US$ in currency» | ✅ | quedó «UYU · $U» |
| cerrar la ventana | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Create Quote. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/purchases/quotes` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Exportar, Refrescar, Tabla, Lista, Ver. ¿Qué querés hacer? 1 Crear 2 |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Presupuesto Se abrió «Crear Presupuesto». Decime qué completar (Usuario, Fecha, Moneda, sede…) o qué apretar: Cancelar o Guardar o Open |
| campo «Fecha» (date, 1/3) | «poné fecha el 15 de diciembre» | ✅ | quedó «15/12/2026» |
| campo «Fecha» (date, 2/3) | «cambiá fecha a el 3 de enero» | ✅ | quedó «03/01/2027» |
| campo «Fecha» (date, 3/3) | «el fecha es el 20 de marzo» | ✅ | quedó «20/03/2027» |
| campo «Notas» (text, 1/3) | «poné notas Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Notas» (text, 2/3) | «cambiá notas a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Notas» (text, 3/3) | «el notas es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| lista «Usuario» | «elegí Laboratorio Y en usuario» | ✅ | quedó «Laboratorio Y» |
| lista «Moneda» | «elegí USD · US$ en moneda» | ✅ | quedó «UYU · $U» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Crear Presupuesto. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/purchases/services` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, ID, Name, Category. What do you want to do? In the t |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Category column» | ✅ | Listening «hide the Category column» Table Hid the Category column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Category column» | ✅ | Listening «show the Category column» Table Showing the Category column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Name» | ✅ | escribió «Name» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened srv_puxxu9ei1 · No Name · No Category. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Service “Create Service” is open. Tell me what to fill in (Name, Category, Price, Currency…) or what to press: Save or Cancel or Start di |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Price» (number, 1/3) | «set price to 1500» | ✅ | quedó «1500.00» |
| campo «Price» (number, 2/3) | «change price to 2300» | ✅ | quedó «2300.00» |
| campo «Price» (number, 3/3) | «the price is 99» | ✅ | quedó «99.00» |
| campo «Color» (color, 1/3) | «set color to red» | ✅ | quedó «#ef4444» |
| campo «Color» (color, 2/3) | «change color to blue» | ✅ | quedó «#3b82f6» |
| campo «Color» (color, 3/3) | «the color is green» | ✅ | quedó «#22c55e» |
| interruptor «Active» off | «turn off Active» | ✅ | quedó off |
| interruptor «Active» on | «turn on Active» | ✅ | quedó on |
| lista «Category» | «choose Artículos de oficina in category» | ✅ | quedó «Artículos de oficina» |
| lista «Currency» | «choose USD · US$ in currency» | ✅ | quedó «UYU · $U» |
| cerrar la ventana | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Create Service. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/purchases/services` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, ID, Nombre, Categoría. ¿Qué querés hacer? En la tabl |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Categoría» | ✅ | Te escucho «ocultá la columna Categoría» Tabla Oculté la columna Categoría. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Categoría» | ✅ | Te escucho «mostrá la columna Categoría» Tabla Muestro la columna Categoría. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Name» | ✅ | escribió «Name» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí srv_usxpzhgrc · No Name · No Category. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Servicio Se abrió «Crear Servicio». Decime qué completar (Nombre, Categoría, Precio, Moneda…) o qué apretar: Guardar o Cancelar o Inici |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Precio» (number, 1/3) | «poné precio 1500» | ✅ | quedó «1500.00» |
| campo «Precio» (number, 2/3) | «cambiá precio a 2300» | ✅ | quedó «2300.00» |
| campo «Precio» (number, 3/3) | «el precio es 99» | ✅ | quedó «99.00» |
| campo «Color» (color, 1/3) | «poné color rojo» | ✅ | quedó «#ef4444» |
| campo «Color» (color, 2/3) | «cambiá color a azul» | ✅ | quedó «#3b82f6» |
| campo «Color» (color, 3/3) | «el color es verde» | ✅ | quedó «#22c55e» |
| interruptor «Activo» off | «desactivá Activo» | ✅ | quedó off |
| interruptor «Activo» on | «activá Activo» | ✅ | quedó on |
| lista «Categoría» | «elegí Artículos de oficina en categoría» | ✅ | quedó «Artículos de oficina» |
| lista «Moneda» | «elegí USD · US$ en moneda» | ✅ | quedó «UYU · $U» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Crear Servicio. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/roles` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, ID, Name, Select row. What do you want to do? In the |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Name column» | ✅ | Listening «hide the Name column» Table Hid the Name column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Name column» | ✅ | Listening «show the Name column» Table Showing the Name column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have administrador» | ✅ | escribió «administrador» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened 8 · recepcionista. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create a new role “Create a new role” is open. Tell me what to fill in (Name…) or what to press: Save or Cancel. 1 Save 2 Cancel I'm listening:  |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| cerrar la ventana | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Create a new role. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/roles` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, ID, Nombre, Select row. ¿Qué querés hacer? En la tab |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Nombre» | ✅ | Te escucho «ocultá la columna Nombre» Tabla Oculté la columna Nombre. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Nombre» | ✅ | Te escucho «mostrá la columna Nombre» Tabla Muestro la columna Nombre. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan administrador» | ✅ | escribió «administrador» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí 8 · recepcionista. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear un nuevo rol Se abrió «Crear un nuevo rol». Decime qué completar (Nombre…) o qué apretar: Guardar o Cancelar. 1 Guardar 2 Cancelar Te e |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Crear un nuevo rol. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/sales/invoices` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Toggle columns, Create, Export, Go to next page, Go to last page, Refresh.  |
| tabla · ordenar | «sort by Doc. No descending» | ✅ | Listening «sort by Doc. No descending» Table Sorted by Doc. No, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Provider column» | ✅ | Listening «hide the Provider column» Table Hid the Provider column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Provider column» | ✅ | Listening «show the Provider column» Table Showing the Provider column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Claudio» | ✅ | escribió «Claudio» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened INV-2026-11-003433 · Claudio Suarez · 1000.00. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Invoice “Create Invoice” is open. Tell me what to fill in (Patient, Type, Currency, doctor…) or what to press: Cancel or Save or Open cal |
| campo «Invoice Date» (date, 1/3) | «set invoice date to December 15» | ✅ | quedó «15/12/2026» |
| campo «Invoice Date» (date, 2/3) | «change invoice date to January 3» | ✅ | quedó «03/01/2027» |
| campo «Invoice Date» (date, 3/3) | «the invoice date is March 20» | ✅ | quedó «20/03/2027» |
| campo «Due Date» (date, 1/3) | «set due date to December 15» | ✅ | quedó «15/12/2026» |
| campo «Due Date» (date, 2/3) | «change due date to January 3» | ✅ | quedó «03/01/2027» |
| campo «Due Date» (date, 3/3) | «the due date is March 20» | ✅ | quedó «20/03/2027» |
| campo «Notes» (text, 1/3) | «set notes to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Notes» (text, 2/3) | «change notes to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Notes» (text, 3/3) | «the notes is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Historical» on | «turn on Historical» | ✅ | quedó on |
| interruptor «Historical» off | «turn off Historical» | ✅ | quedó off |
| lista «Patient» | «choose Jorge Méndez in patient» | ✅ | quedó «Jorge Méndez» |
| lista «Type» | «choose Credit Note in type» | ✅ | quedó «Invoice» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/sales/invoices` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Alternar columnas, Crear, Exportar, Ir a la siguiente página, Ir a la últim |
| tabla · ordenar | «ordená por Doc. No descendente» | ✅ | Te escucho «ordená por Doc. No descendente» Tabla Ordené por Doc. No, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Proveedor» | ✅ | Te escucho «ocultá la columna Proveedor» Tabla Oculté la columna Proveedor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Proveedor» | ✅ | Te escucho «mostrá la columna Proveedor» Tabla Muestro la columna Proveedor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Claudio» | ✅ | escribió «Claudio» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí INV-2026-11-003433 · Claudio Suarez · 1000.00. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Factura Se abrió «Crear Factura». Decime qué completar (Paciente, Tipo, Moneda, doctor…) o qué apretar: Cancelar o Guardar o Open calen |
| campo «Fecha de Factura» (date, 1/3) | «poné fecha de factura el 15 de diciembre» | ✅ | quedó «15/12/2026» |
| campo «Fecha de Factura» (date, 2/3) | «cambiá fecha de factura a el 3 de enero» | ✅ | quedó «03/01/2027» |
| campo «Fecha de Factura» (date, 3/3) | «el fecha de factura es el 20 de marzo» | ✅ | quedó «20/03/2027» |
| campo «Vencimiento» (date, 1/3) | «poné vencimiento el 15 de diciembre» | ✅ | quedó «15/12/2026» |
| campo «Vencimiento» (date, 2/3) | «cambiá vencimiento a el 3 de enero» | ✅ | quedó «03/01/2027» |
| campo «Vencimiento» (date, 3/3) | «el vencimiento es el 20 de marzo» | ✅ | quedó «20/03/2027» |
| campo «Notas» (text, 1/3) | «poné notas Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Notas» (text, 2/3) | «cambiá notas a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Notas» (text, 3/3) | «el notas es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Histórico» on | «activá Histórico» | ✅ | quedó on |
| interruptor «Histórico» off | «desactivá Histórico» | ✅ | quedó off |
| lista «Paciente» | «elegí Jorge Méndez en paciente» | ✅ | quedó «Jorge Méndez» |
| lista «Tipo» | «elegí Nota de Crédito en tipo» | ✅ | quedó «Factura» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/sales/payment-methods` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Name, Code, Is Active?. What do you want to do? In t |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Code column» | ✅ | Listening «hide the Code column» Table Hid the Code column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Code column» | ✅ | Listening «show the Code column» Table Showing the Code column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Compra» | ✅ | escribió «Compra» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Transferencia Bancaria · BANK_TRANSFER. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Payment Method “Create Payment Method” is open. Tell me what to fill in (Name, Code…) or what to press: Cancel or Create. 1 Cancel 2 Crea |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Code» (text, 1/3) | «set code to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Code» (text, 2/3) | «change code to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Code» (text, 3/3) | «the code is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Is Cash Equivalent?» on | «turn on Is Cash Equivalent?» | ✅ | quedó on |
| interruptor «Is Cash Equivalent?» off | «turn off Is Cash Equivalent?» | ✅ | quedó off |
| interruptor «Is Active?» off | «turn off Is Active?» | ✅ | quedó off |
| interruptor «Is Active?» on | «turn on Is Active?» | ✅ | quedó on |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/sales/payment-methods` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre, Código, ¿Está Activo?. ¿Qué querés hacer? En |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Código» | ✅ | Te escucho «ocultá la columna Código» Tabla Oculté la columna Código. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Código» | ✅ | Te escucho «mostrá la columna Código» Tabla Muestro la columna Código. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Compra» | ✅ | escribió «Compra» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Transferencia Bancaria · BANK_TRANSFER. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Método de Pago Se abrió «Crear Método de Pago». Decime qué completar (Nombre, Código…) o qué apretar: Cancelar o Crear. 1 Cancelar 2 Cr |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Código» (text, 1/3) | «poné código Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Código» (text, 2/3) | «cambiá código a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Código» (text, 3/3) | «el código es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «¿Es Equivalente a Efectivo?» on | «activá ¿Es Equivalente a Efectivo?» | ✅ | quedó on |
| interruptor «¿Es Equivalente a Efectivo?» off | «desactivá ¿Es Equivalente a Efectivo?» | ✅ | quedó off |
| interruptor «¿Está Activo?» off | «desactivá ¿Está Activo?» | ✅ | quedó off |
| interruptor «¿Está Activo?» on | «activá ¿Está Activo?» | ✅ | quedó on |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/sales/payments` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Toggle columns, Create Prepaid, Export, Go to next page, Go to last page, R |
| tabla · ordenar | «sort by Document No. descending» | ✅ | Listening «sort by Document No. descending» Table Sorted by Document No., descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the User column» | ✅ | Listening «hide the User column» Table Hid the User column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the User column» | ✅ | Listening «show the User column» Table Showing the User column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Paula» | ✅ | escribió «Paula» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened PAY-2026-11-003295 · Paula Acosta · INV-2026-11-003431. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Prepaid Payment “Prepaid Payment” is open. Tell me what to fill in (client, Amount, Currency, Payment Method…) or what to press: Cancel or Save  |
| campo «Amount» (number, 1/3) | «set amount to 1500» | ✅ | quedó «1500.00» |
| campo «Amount» (number, 2/3) | «change amount to 2300» | ✅ | quedó «2300.00» |
| campo «Amount» (number, 3/3) | «the amount is 99» | ✅ | quedó «99.00» |
| campo «Payment Date» (date, 1/3) | «set payment date to December 15» | ✅ | quedó «15/12/2026» |
| campo «Payment Date» (date, 2/3) | «change payment date to January 3» | ✅ | quedó «03/01/2027» |
| campo «Payment Date» (date, 3/3) | «the payment date is March 20» | ✅ | quedó «20/03/2027» |
| campo «Notes» (text, 1/3) | «set notes to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Notes» (text, 2/3) | «change notes to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Notes» (text, 3/3) | «the notes is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Historical» on | «turn on Historical» | ✅ | quedó on |
| interruptor «Historical» off | «turn off Historical» | ✅ | quedó off |
| lista «client» | «choose Jorge Méndez in client» | ✅ | quedó «» |
| lista «Currency» | «choose UYU · $U in currency» | ✅ | quedó «USD · US$» |
| cerrar la ventana | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Prepaid Payment. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/sales/payments` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Alternar columnas, Crear Prepago, Exportar, Ir a la siguiente página, Ir a  |
| tabla · ordenar | «ordená por No. Documento descendente» | ✅ | Te escucho «ordená por No. Documento descendente» Tabla Ordené por No. Documento, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para  |
| tabla · ocultar columna | «ocultá la columna Usuario» | ✅ | Te escucho «ocultá la columna Usuario» Tabla Oculté la columna Usuario. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Usuario» | ✅ | Te escucho «mostrá la columna Usuario» Tabla Muestro la columna Usuario. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Paula» | ✅ | escribió «Paula» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí PAY-2026-11-003295 · Paula Acosta · INV-2026-11-003431. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apag |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Pago Prepagado Se abrió «Pago Prepagado». Decime qué completar (cliente, Monto, Moneda, Método de Pago…) o qué apretar: Cancelar o Guardar o  |
| campo «Monto» (number, 1/3) | «poné monto 1500» | ✅ | quedó «1500.00» |
| campo «Monto» (number, 2/3) | «cambiá monto a 2300» | ✅ | quedó «2300.00» |
| campo «Monto» (number, 3/3) | «el monto es 99» | ✅ | quedó «99.00» |
| campo «Fecha de Pago» (date, 1/3) | «poné fecha de pago el 15 de diciembre» | ✅ | quedó «15/12/2026» |
| campo «Fecha de Pago» (date, 2/3) | «cambiá fecha de pago a el 3 de enero» | ✅ | quedó «03/01/2027» |
| campo «Fecha de Pago» (date, 3/3) | «el fecha de pago es el 20 de marzo» | ✅ | quedó «20/03/2027» |
| campo «Notas» (text, 1/3) | «poné notas Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Notas» (text, 2/3) | «cambiá notas a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Notas» (text, 3/3) | «el notas es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Histórico» on | «activá Histórico» | ✅ | quedó on |
| interruptor «Histórico» off | «desactivá Histórico» | ✅ | quedó off |
| lista «cliente» | «elegí Jorge Méndez en cliente» | ✅ | quedó «» |
| lista «Moneda» | «elegí UYU · $U en moneda» | ✅ | quedó «USD · US$» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Pago Prepagado. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/sales/quotes` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Export, Go to next page, Go to last page, Refresh, Tabla. What do y |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Quote “Create Quote” is open. Tell me what to fill in (User, Date, Currency, location…) or what to press: Cancel or Save or Open calendar |
| campo «Date» (date, 1/3) | «set date to December 15» | ✅ | quedó «15/12/2026» |
| campo «Date» (date, 2/3) | «change date to January 3» | ✅ | quedó «03/01/2027» |
| campo «Date» (date, 3/3) | «the date is March 20» | ✅ | quedó «20/03/2027» |
| campo «Notes» (text, 1/3) | «set notes to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Notes» (text, 2/3) | «change notes to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Notes» (text, 3/3) | «the notes is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Confirmed by patient» on | «turn on Confirmed by patient» | ✅ | quedó on |
| interruptor «Confirmed by patient» off | «turn off Confirmed by patient» | ✅ | quedó off |
| lista «User» | «choose Jorge Méndez in user» | ✅ | quedó «Jorge Méndez» |
| lista «Currency» | «choose USD · US$ in currency» | ✅ | quedó «UYU · $U» |
| cerrar la ventana | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Create Quote. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/sales/quotes` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Exportar, Ir a la siguiente página, Ir a la última página, Refrescar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Presupuesto Se abrió «Crear Presupuesto». Decime qué completar (Usuario, Fecha, Moneda, sede…) o qué apretar: Cancelar o Guardar o Open |
| campo «Fecha» (date, 1/3) | «poné fecha el 15 de diciembre» | ✅ | quedó «15/12/2026» |
| campo «Fecha» (date, 2/3) | «cambiá fecha a el 3 de enero» | ✅ | quedó «03/01/2027» |
| campo «Fecha» (date, 3/3) | «el fecha es el 20 de marzo» | ✅ | quedó «20/03/2027» |
| campo «Notas» (text, 1/3) | «poné notas Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Notas» (text, 2/3) | «cambiá notas a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Notas» (text, 3/3) | «el notas es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Confirmado por el paciente» on | «activá Confirmado por el paciente» | ✅ | quedó on |
| interruptor «Confirmado por el paciente» off | «desactivá Confirmado por el paciente» | ✅ | quedó off |
| lista «Usuario» | «elegí Jorge Méndez en usuario» | ✅ | quedó «Jorge Méndez» |
| lista «Moneda» | «elegí USD · US$ en moneda» | ✅ | quedó «UYU · $U» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Crear Presupuesto. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/sales/services` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Go to next page, Go to last page, Refresh, View, ID. What do you wa |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Category column» | ✅ | Listening «hide the Category column» Table Hid the Category column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Category column» | ✅ | Listening «show the Category column» Table Showing the Category column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Prueba» | ✅ | escribió «Prueba» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened 88 · Skinbooster · Medicina estética. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Service “Create Service” is open. Tell me what to fill in (Name, Category, Price, Currency…) or what to press: Save or Cancel or Start di |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Price» (number, 1/3) | «set price to 1500» | ✅ | quedó «1500.00» |
| campo «Price» (number, 2/3) | «change price to 2300» | ✅ | quedó «2300.00» |
| campo «Price» (number, 3/3) | «the price is 99» | ✅ | quedó «99.00» |
| campo «Description» (text, 1/3) | «set description to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Description» (text, 2/3) | «change description to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Description» (text, 3/3) | «the description is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Active» off | «turn off Active» | ✅ | quedó off |
| interruptor «Active» on | «turn on Active» | ✅ | quedó on |
| interruptor «Patient can book this online» on | «turn on Patient can book this online» | ✅ | quedó on |
| interruptor «Patient can book this online» off | «turn off Patient can book this online» | ✅ | quedó off |
| lista «Category» | «choose Medicina estética in category» | ✅ | quedó «Medicina estética» |
| lista «Currency» | «choose USD · US$ in currency» | ✅ | quedó «UYU · $U» |
| cerrar la ventana | «close it» | ✅ | Listening «close it» Voice command Done, I closed: Create Service. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/sales/services` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Ir a la siguiente página, Ir a la última página, Refrescar, Ver, ID. |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Categoría» | ✅ | Te escucho «ocultá la columna Categoría» Tabla Oculté la columna Categoría. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Categoría» | ✅ | Te escucho «mostrá la columna Categoría» Tabla Muestro la columna Categoría. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Prueba» | ✅ | escribió «Prueba» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí 88 · Skinbooster · Medicina estética. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Servicio Se abrió «Crear Servicio». Decime qué completar (Nombre, Categoría, Precio, Moneda…) o qué apretar: Guardar o Cancelar o Inici |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Precio» (number, 1/3) | «poné precio 1500» | ✅ | quedó «1500.00» |
| campo «Precio» (number, 2/3) | «cambiá precio a 2300» | ✅ | quedó «2300.00» |
| campo «Precio» (number, 3/3) | «el precio es 99» | ✅ | quedó «99.00» |
| campo «Descripción» (text, 1/3) | «poné descripción Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Descripción» (text, 2/3) | «cambiá descripción a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Descripción» (text, 3/3) | «el descripción es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Activo» off | «desactivá Activo» | ✅ | quedó off |
| interruptor «Activo» on | «activá Activo» | ✅ | quedó on |
| interruptor «Agendable online por el paciente» on | «activá Agendable online por el paciente» | ✅ | quedó on |
| interruptor «Agendable online por el paciente» off | «desactivá Agendable online por el paciente» | ✅ | quedó off |
| lista «Categoría» | «elegí Medicina estética en categoría» | ✅ | quedó «Medicina estética» |
| lista «Moneda» | «elegí USD · US$ en moneda» | ✅ | quedó «UYU · $U» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: Crear Servicio. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/studies` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Listening «what can I do here» Screen I don’t see any buttons on this screen. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta | «new» | ✅ | pantalla sin alta |

## `/studies` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Te escucho «qué puedo hacer acá» Pantalla No veo botones en esta pantalla. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/system/access` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Refresh, View, User ID, Timestamp, Action, Success. What do you want to do? |
| alta | «new» | ✅ | pantalla sin alta |

## `/system/access` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Refrescar, Ver, ID de Usuario, Marca de Tiempo, Acción, Éxito. ¿Qué querés  |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/system/alert-categories` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Icon, Name, Code. What do you want to do? In the tab |
| tabla · ordenar | «sort by Icon descending» | ✅ | Listening «sort by Icon descending» Table Sorted by Icon, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Name column» | ✅ | Listening «hide the Name column» Table Hid the Name column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Name column» | ✅ | Listening «show the Name column» Table Showing the Name column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Pacientes» | ✅ | escribió «Pacientes» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened flask-conical · Laboratorio · LAB_ORDERS. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta | «new» | ✅ | pantalla sin alta |

## `/system/alert-categories` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Icono, Nombre, Código. ¿Qué querés hacer? En la tabl |
| tabla · ordenar | «ordená por Icono descendente» | ✅ | Te escucho «ordená por Icono descendente» Tabla Ordené por Icono, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Nombre» | ✅ | Te escucho «ocultá la columna Nombre» Tabla Oculté la columna Nombre. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Nombre» | ✅ | Te escucho «mostrá la columna Nombre» Tabla Muestro la columna Nombre. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Pacientes» | ✅ | escribió «Pacientes» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí flask-conical · Laboratorio · LAB_ORDERS. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/system/alert-rules` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Name, Category, Priority. What do you want to do? In |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Category column» | ✅ | Listening «hide the Category column» Table Hid the Category column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Category column» | ✅ | Listening «show the Category column» Table Showing the Category column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Orden» | ✅ | escribió «Orden» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Recordatorio de Cita 24h · 8 · HIGH. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Alert Rule “Create Alert Rule” is open. Tell me what to fill in (Name, Code, Category, Priority…) or what to press: Create Rule or Cancel |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Code» (text, 1/3) | «set code to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Code» (text, 2/3) | «change code to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Code» (text, 3/3) | «the code is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Description» (text, 1/3) | «set description to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Description» (text, 2/3) | «change description to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Description» (text, 3/3) | «the description is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Send Email Automatically» on | «turn on Send Email Automatically» | ✅ | quedó on |
| interruptor «Send Email Automatically» off | «turn off Send Email Automatically» | ✅ | quedó off |
| interruptor «Send SMS Automatically» on | «turn on Send SMS Automatically» | ✅ | quedó on |
| interruptor «Send SMS Automatically» off | «turn off Send SMS Automatically» | ✅ | quedó off |
| lista «Category» | «choose Pacientes in category» | ✅ | quedó «Select a category» |
| lista «Priority» | «choose Low in priority» | ✅ | quedó «Medium» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/system/alert-rules` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre, Categoría, Prioridad. ¿Qué querés hacer? En  |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Categoría» | ✅ | Te escucho «ocultá la columna Categoría» Tabla Oculté la columna Categoría. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Categoría» | ✅ | Te escucho «mostrá la columna Categoría» Tabla Muestro la columna Categoría. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Orden» | ✅ | escribió «Orden» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Recordatorio de Cita 24h · 8 · HIGH. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Regla de Alerta Se abrió «Crear Regla de Alerta». Decime qué completar (Nombre, Código, Categoría, Prioridad…) o qué apretar: Crear Reg |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Código» (text, 1/3) | «poné código Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Código» (text, 2/3) | «cambiá código a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Código» (text, 3/3) | «el código es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Descripción» (text, 1/3) | «poné descripción Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Descripción» (text, 2/3) | «cambiá descripción a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Descripción» (text, 3/3) | «el descripción es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Enviar Correo Automáticamente» on | «activá Enviar Correo Automáticamente» | ✅ | quedó on |
| interruptor «Enviar Correo Automáticamente» off | «desactivá Enviar Correo Automáticamente» | ✅ | quedó off |
| interruptor «Enviar SMS Automáticamente» on | «activá Enviar SMS Automáticamente» | ✅ | quedó on |
| interruptor «Enviar SMS Automáticamente» off | «desactivá Enviar SMS Automáticamente» | ✅ | quedó off |
| lista «Categoría» | «elegí Pacientes en categoría» | ✅ | quedó «Seleccione una categoría» |
| lista «Prioridad» | «elegí Baja en prioridad» | ✅ | quedó «Media» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/system/audit` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: All time, Go to next page, Go to last page, Refresh, View, Changed At. What |
| tabla · ordenar | «sort by Changed At descending» | ✅ | Listening «sort by Changed At descending» Table Sorted by Changed At, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Table column» | ✅ | Listening «hide the Table column» Table Hid the Table column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Table column» | ✅ | Listening «show the Table column» Table Showing the Table column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have appointments» | ✅ | escribió «appointments» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened 2026-11-23T14:55:45.535Z · appointments · {"id": 7575}. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta | «new» | ✅ | pantalla sin alta |

## `/system/audit` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Todo el tiempo, Ir a la siguiente página, Ir a la última página, Refrescar, |
| tabla · ordenar | «ordená por Cambiado En descendente» | ✅ | Te escucho «ordená por Cambiado En descendente» Tabla Ordené por Cambiado En, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apag |
| tabla · ocultar columna | «ocultá la columna Tabla» | ✅ | Te escucho «ocultá la columna Tabla» Tabla Oculté la columna Tabla. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Tabla» | ✅ | Te escucho «mostrá la columna Tabla» Tabla Muestro la columna Tabla. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan appointments» | ✅ | escribió «appointments» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí 2026-11-23T14:55:45.535Z · appointments · {"id": 7575}. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apag |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/system/communication-history` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Refresh, View, Sent At, Channel, Recipient, Title. What do you want to do?  |
| tabla · ordenar | «sort by Sent At descending» | ✅ | Listening «sort by Sent At descending» Table Sorted by Sent At, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Channel column» | ✅ | Listening «hide the Channel column» Table Hid the Channel column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Channel column» | ✅ | Listening «show the Channel column» Table Showing the Channel column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have EMAIL» | ✅ | escribió «EMAIL» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened 2026-11-23T12:00:26.941Z · EMAIL · Recordatorio de Cita 24h. I'm listening: just talk · Esc cancels · tap Voice to turn of |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta | «new» | ✅ | pantalla sin alta |

## `/system/communication-history` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Refrescar, Ver, Enviado En, Canal, Destinatario, Título. ¿Qué querés hacer? |
| tabla · ordenar | «ordená por Enviado En descendente» | ✅ | Te escucho «ordená por Enviado En descendente» Tabla Ordené por Enviado En, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Canal» | ✅ | Te escucho «ocultá la columna Canal» Tabla Oculté la columna Canal. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Canal» | ✅ | Te escucho «mostrá la columna Canal» Tabla Muestro la columna Canal. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan EMAIL» | ✅ | escribió «EMAIL» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí 2026-11-23T12:00:26.941Z · EMAIL · Recordatorio de Cita 24h. Te escucho: hablá normalmente · Esc cancela · tocá Voz para |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/system/communication-templates` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Refresh, View, Name, Type, Version. What do you want to do? In the  |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Type column» | ✅ | Listening «hide the Type column» Table Hid the Type column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Type column» | ✅ | Listening «show the Type column» Table Showing the Type column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Orden» | ✅ | escribió «Orden» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened 24h Appointment Reminder (SMS) · SMS · 1. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create Template “Create Template” is open. Tell me what to fill in (Name, Code, Type, Category…) or what to press: Create Template or Cancel or  |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Code» (text, 1/3) | «set code to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Code» (text, 2/3) | «change code to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Code» (text, 3/3) | «the code is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Subject» (text, 1/3) | «set subject to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Subject» (text, 2/3) | «change subject to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Subject» (text, 3/3) | «the subject is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| interruptor «Preview» on | «turn on Preview» | ✅ | quedó on |
| interruptor «Preview» off | «turn off Preview» | ✅ | quedó off |
| interruptor «Is Active» off | «turn off Is Active» | ✅ | quedó off |
| interruptor «Is Active» on | «turn on Is Active» | ✅ | quedó on |
| lista «Type» | «choose SMS in type» | ✅ | quedó «Email» |
| lista «Category» | «choose Pacientes in category» | ✅ | quedó «Select a category» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/system/communication-templates` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Refrescar, Ver, Nombre, Tipo, Versión. ¿Qué querés hacer? En la tabl |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Tipo» | ✅ | Te escucho «ocultá la columna Tipo» Tabla Oculté la columna Tipo. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Tipo» | ✅ | Te escucho «mostrá la columna Tipo» Tabla Muestro la columna Tipo. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Orden» | ✅ | escribió «Orden» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí 24h Appointment Reminder (SMS) · SMS · 1. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Plantilla Se abrió «Crear Plantilla». Decime qué completar (Nombre, Código, Tipo, Categoría…) o qué apretar: Crear Plantilla o Cancelar |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Código» (text, 1/3) | «poné código Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Código» (text, 2/3) | «cambiá código a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Código» (text, 3/3) | «el código es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Asunto» (text, 1/3) | «poné asunto Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Asunto» (text, 2/3) | «cambiá asunto a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Asunto» (text, 3/3) | «el asunto es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| interruptor «Vista Previa» on | «activá Vista Previa» | ✅ | quedó on |
| interruptor «Vista Previa» off | «desactivá Vista Previa» | ✅ | quedó off |
| interruptor «Está Activa» off | «desactivá Está Activa» | ✅ | quedó off |
| interruptor «Está Activa» on | «activá Está Activa» | ✅ | quedó on |
| lista «Tipo» | «elegí SMS en tipo» | ✅ | quedó «Email» |
| lista «Categoría» | «elegí Pacientes en categoría» | ✅ | quedó «Seleccione una categoría» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/system/config` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Create, Go to next page, Go to last page, Refresh, View, Key. What do you w |
| tabla · ordenar | «sort by Key descending» | ✅ | Listening «sort by Key descending» Table Sorted by Key, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Value column» | ✅ | Listening «hide the Value column» Table Hid the Value column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Value column» | ✅ | Listening «show the Value column» Table Showing the Value column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have true» | ✅ | escribió «true» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened whatsapp_test_phone_whitelist · +554184409653,+59894022691,+5989575173 · string. I'm listening: just talk · Esc cancels ·  |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta | «new» | ✅ | pantalla sin alta |

## `/system/config` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Crear, Ir a la siguiente página, Ir a la última página, Refrescar, Ver, Cla |
| tabla · ordenar | «ordená por Clave descendente» | ✅ | Te escucho «ordená por Clave descendente» Tabla Ordené por Clave, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Valor» | ✅ | Te escucho «ocultá la columna Valor» Tabla Oculté la columna Valor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Valor» | ✅ | Te escucho «mostrá la columna Valor» Tabla Muestro la columna Valor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan true» | ✅ | escribió «true» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí whatsapp_test_phone_whitelist · +554184409653,+59894022691,+5989575173 · string. Te escucho: hablá normalmente · Esc can |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/system/errors` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Refresh, View, Created At, Severity, Message, Channel. What do you want to  |
| alta | «new» | ✅ | pantalla sin alta |

## `/system/errors` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Refrescar, Ver, Creado En, Severidad, Mensaje, Canal. ¿Qué querés hacer? En |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/system/execution-history` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Refresh, View, Run Date, Status, Rules Processed, Alerts Created. What do y |
| tabla · ordenar | «sort by Run Date descending» | ✅ | Listening «sort by Run Date descending» Table Sorted by Run Date, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Status column» | ✅ | Listening «hide the Status column» Table Hid the Status column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Status column» | ✅ | Listening «show the Status column» Table Showing the Status column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have COMPLETED» | ✅ | escribió «COMPLETED» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened 2026-11-23T00:00:00.000Z · COMPLETED · 5. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta | «new» | ✅ | pantalla sin alta |

## `/system/execution-history` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Refrescar, Ver, Fecha de Ejecución, Estado, Reglas Procesadas, Alertas Crea |
| tabla · ordenar | «ordená por Fecha de Ejecución descendente» | ✅ | Te escucho «ordená por Fecha de Ejecución descendente» Tabla Ordené por Fecha de Ejecución, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá |
| tabla · ocultar columna | «ocultá la columna Estado» | ✅ | Te escucho «ocultá la columna Estado» Tabla Oculté la columna Estado. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Estado» | ✅ | Te escucho «mostrá la columna Estado» Tabla Muestro la columna Estado. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan COMPLETED» | ✅ | escribió «COMPLETED» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí 2026-11-23T00:00:00.000Z · COMPLETED · 5. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/system/notification-settings` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Enabled, SAVE CHANGES. What do you want to do? 1 Enabled 2 SAVE CHANGES I'm |
| alta | «new» | ✅ | pantalla sin alta |

## `/system/notification-settings` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Habilitado, GUARDAR CAMBIOS. ¿Qué querés hacer? 1 Habilitado 2 GUARDAR CAMB |
| alta | «nuevo» | ✅ | pantalla sin alta |

## `/system/staff` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Toggle columns, Create, Refresh, View. What do you want to do? In the table |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Email column» | ✅ | Listening «hide the Email column» Table Hid the Email column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Email column» | ✅ | Listening «show the Email column» Table Showing the Email column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Raidel» | ✅ | escribió «Raidel» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Raidel Martínez · raidel@invokeia.com. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create system user “Create system user” is open. Tell me what to fill in (Role, Name, Email, phone country…) or what to press: Cancel or Save. 1 |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Email» (text, 1/3) | «set email to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Email» (text, 2/3) | «change email to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Email» (text, 3/3) | «the email is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Phone» (phone, 1/3) | «set phone to 099 123 456» | ✅ | quedó «+598 99 123 456» |
| campo «Phone» (phone, 2/3) | «change phone to 098 765 432» | ✅ | quedó «+598 98 765 432» |
| campo «Phone» (phone, 3/3) | «the phone is 091 222 333» | ✅ | quedó «+598 91 222 333» |
| interruptor «Is Active?» off | «turn off Is Active?» | ✅ | quedó off |
| interruptor «Is Active?» on | «turn on Is Active?» | ✅ | quedó on |
| lista «Role» | «choose administrador in role» | ✅ | quedó «Select role...» |
| lista «phone country» | «choose administrador in phone country» | ✅ | quedó «» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/system/staff` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Alternar columnas, Crear, Refrescar, Ver. ¿Qué querés hacer? En la tabla ta |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Correo» | ✅ | Te escucho «ocultá la columna Correo» Tabla Oculté la columna Correo. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Correo» | ✅ | Te escucho «mostrá la columna Correo» Tabla Muestro la columna Correo. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Raidel» | ✅ | escribió «Raidel» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Raidel Martínez · raidel@invokeia.com. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear usuario de sistema Se abrió «Crear usuario de sistema». Decime qué completar (Rol, Nombre, Correo Electrónico, país del teléfono…) o qu |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Correo Electrónico» (text, 1/3) | «poné correo electrónico Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Correo Electrónico» (text, 2/3) | «cambiá correo electrónico a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Correo Electrónico» (text, 3/3) | «el correo electrónico es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Teléfono» (phone, 1/3) | «poné teléfono 099 123 456» | ✅ | quedó «+598 99 123 456» |
| campo «Teléfono» (phone, 2/3) | «cambiá teléfono a 098 765 432» | ✅ | quedó «+598 98 765 432» |
| campo «Teléfono» (phone, 3/3) | «el teléfono es 091 222 333» | ✅ | quedó «+598 91 222 333» |
| interruptor «¿Está Activo?» off | «desactivá ¿Está Activo?» | ✅ | quedó off |
| interruptor «¿Está Activo?» on | «activá ¿Está Activo?» | ✅ | quedó on |
| lista «Rol» | «elegí administrador en rol» | ✅ | quedó «Seleccionar rol...» |
| lista «país del teléfono» | «elegí administrador en país del teléfono» | ✅ | quedó «» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/system/users` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Toggle columns, Create, Go to next page, Go to last page, Refresh, View. Wh |
| tabla · ordenar | «sort by Name descending» | ✅ | Listening «sort by Name descending» Table Sorted by Name, descending. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · ocultar columna | «hide the Email column» | ✅ | Listening «hide the Email column» Table Hid the Email column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · mostrar columna | «show the Email column» | ✅ | Listening «show the Email column» Table Showing the Email column. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| tabla · filtrar con la palabra clave | «filter the ones that have Jorge» | ✅ | escribió «Jorge» |
| tabla · borrar la búsqueda | «clear the search» | ✅ | vacía |
| tabla · elegir el primero | «select row 1» | ✅ | Listening «select row 1» Table Opened Yamila · yamila@invokeia.com. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cerrar el detalle | «close it» | ✅ | Listening «close it» Voice command Done, I closed: the details. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| alta · se abre y avisa | «new» | ✅ | Listening «new» Create System User “Create System User” is open. Tell me what to fill in (Name, Email, phone country, Phone…) or what to press: Save or Cancel.  |
| campo «Name» (text, 1/3) | «set name to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Name» (text, 2/3) | «change name to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Name» (text, 3/3) | «the name is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Email» (text, 1/3) | «set email to Voice Test» | ✅ | quedó «Voice Test» |
| campo «Email» (text, 2/3) | «change email to Voice Test Two» | ✅ | quedó «Voice Test Two» |
| campo «Email» (text, 3/3) | «the email is Voice Test Three» | ✅ | quedó «Voice Test Three» |
| campo «Phone» (phone, 1/3) | «set phone to 099 123 456» | ✅ | quedó «+598 99 123 456» |
| campo «Phone» (phone, 2/3) | «change phone to 098 765 432» | ✅ | quedó «+598 98 765 432» |
| campo «Phone» (phone, 3/3) | «the phone is 091 222 333» | ✅ | quedó «+598 91 222 333» |
| interruptor «Is Active?» off | «turn off Is Active?» | ✅ | quedó off |
| interruptor «Is Active?» on | «turn on Is Active?» | ✅ | quedó on |
| lista «phone country» | «choose Afghanistan in phone country» | ✅ | quedó «» |
| lista «sede» | «choose Sede Carrasco in sede» | ✅ | quedó «Sede Carrasco» |
| cerrar la ventana | «close it» | ✅ | Listening «yes» Discard changes? Done, I pressed “Discard changes”. I'm listening: just talk · Esc cancels · tap Voice to turn off |
| cambio de contexto (ventana abierta → otra pantalla) | «go to patients» | ✅ | http://localhost:3000/en/patients |

## `/system/users` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Alternar columnas, Crear, Ir a la siguiente página, Ir a la última página,  |
| tabla · ordenar | «ordená por Nombre descendente» | ✅ | Te escucho «ordená por Nombre descendente» Tabla Ordené por Nombre, de mayor a menor. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · ocultar columna | «ocultá la columna Correo Electrónico» | ✅ | Te escucho «ocultá la columna Correo Electrónico» Tabla Oculté la columna Correo Electrónico. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| tabla · mostrar columna | «mostrá la columna Correo Electrónico» | ✅ | Te escucho «mostrá la columna Correo Electrónico» Tabla Muestro la columna Correo Electrónico. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apaga |
| tabla · filtrar con la palabra clave | «filtrá los que tengan Jorge» | ✅ | escribió «Jorge» |
| tabla · borrar la búsqueda | «borrá la búsqueda» | ✅ | vacía |
| tabla · elegir el primero | «seleccioná el 1» | ✅ | Te escucho «seleccioná el 1» Tabla Abrí Yamila · yamila@invokeia.com. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cerrar el detalle | «cerrá» | ✅ | Te escucho «cerrá» Comando de voz Listo, cerré: el detalle. Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| alta · se abre y avisa | «nuevo» | ✅ | Te escucho «nuevo» Crear Usuario del Sistema Se abrió «Crear Usuario del Sistema». Decime qué completar (Nombre, Correo Electrónico, país del teléfono, Teléfono |
| campo «Nombre» (text, 1/3) | «poné nombre Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Nombre» (text, 2/3) | «cambiá nombre a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Nombre» (text, 3/3) | «el nombre es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Correo Electrónico» (text, 1/3) | «poné correo electrónico Prueba Voz» | ✅ | quedó «Prueba Voz» |
| campo «Correo Electrónico» (text, 2/3) | «cambiá correo electrónico a Prueba Voz Dos» | ✅ | quedó «Prueba Voz Dos» |
| campo «Correo Electrónico» (text, 3/3) | «el correo electrónico es Prueba Voz Tres» | ✅ | quedó «Prueba Voz Tres» |
| campo «Teléfono» (phone, 1/3) | «poné teléfono 099 123 456» | ✅ | quedó «+598 99 123 456» |
| campo «Teléfono» (phone, 2/3) | «cambiá teléfono a 098 765 432» | ✅ | quedó «+598 98 765 432» |
| campo «Teléfono» (phone, 3/3) | «el teléfono es 091 222 333» | ✅ | quedó «+598 91 222 333» |
| interruptor «¿Está Activo?» off | «desactivá ¿Está Activo?» | ✅ | quedó off |
| interruptor «¿Está Activo?» on | «activá ¿Está Activo?» | ✅ | quedó on |
| lista «país del teléfono» | «elegí Afganistán en país del teléfono» | ✅ | quedó «» |
| lista «sede» | «elegí Sede Carrasco en sede» | ✅ | quedó «Sede Carrasco» |
| cerrar la ventana | «cerrá» | ✅ | Te escucho «sí» ¿Descartar cambios? Listo, apreté «Descartar cambios». Te escucho: hablá normalmente · Esc cancela · tocá Voz para apagar |
| cambio de contexto (ventana abierta → otra pantalla) | «andá a pacientes» | ✅ | http://localhost:3000/es/patients |

## `/system/whatsapp-agent` (en)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «what can I do here» | ✅ | Waiting for your answer what can I do here «what can I do here» Screen Here you can: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday. What do you want to |
| alta | «new» | ✅ | pantalla sin alta |

## `/system/whatsapp-agent` (es)

| Paso | Se dijo | Resultado | Qué pasó |
| --- | --- | --- | --- |
| ayuda | «qué puedo hacer acá» | ✅ | Esperando tu respuesta qué puedo hacer acá «qué puedo hacer acá» Pantalla Acá podés: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado. ¿Qué querés hacer? 1 Lun |
| alta | «nuevo» | ✅ | pantalla sin alta |

