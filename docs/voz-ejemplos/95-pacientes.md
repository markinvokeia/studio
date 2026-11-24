# Pacientes

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/95-patients.spec.ts`

Pacientes: buscar y abrir (posición, nombre, busca si no está), filtros (deudores, activos, fechas), nuevo paciente; pestañas y todas las acciones de la ficha (también con el nombre en la frase); preguntas (deuda, visitas, resumen).

**91 frases** en **63 pruebas que pasan** (es 81 · es-ES 2 · en 8). Pantallas: `/`, `/patients`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## PA-LIST · Buscar, abrir, filtrar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «buscá a Roberto Díaz» con uno solo: lo abre | es | `/patients` | «buscá a Roberto Díaz» | **Pacientes** · Abrí la ficha de Roberto Díaz. |
| «buscá a Ana» con varios: los lee | es | `/patients` | «buscá a Ana» | **Pacientes** · Encontré 2 pacientes: decime cuál, por ejemplo «el primero». |
| «abrí el segundo» | es | `/patients` | «abrí el segundo» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| «abrí la ficha de Carlos López» (está en la lista) | es | `/patients` | «abrí la ficha de Carlos López» | **Pacientes** · Abrí la ficha de Carlos López. |
| «abrí la ficha de Sofía Castro» (no está a la vista): la busca | es | `/patients` | «abrí la ficha de Sofía Castro» | **Pacientes** · Abrí la ficha de Sofía Castro. |
| «mostrá la columna Correo Electrónico» es de la tabla, no un nombre de paciente | es | `/patients` | «mostrá la columna Correo Electrónico» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «buscá a Juan Pérez», «solo los deudores», «nueva sesión» o «¿cuánto debe?». |
| «seleccioná el 1» es de la tabla, no un nombre de paciente | es | `/patients` | «seleccioná el 1» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «buscá a Juan Pérez», «solo los deudores», «nueva sesión» o «¿cuánto debe?». |
| «abrí el registro 3» es de la tabla, no un nombre de paciente | es | `/patients` | «abrí el registro 3» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «buscá a Juan Pérez», «solo los deudores», «nueva sesión» o «¿cuánto debe?». |
| «mostrá la fila 2» es de la tabla, no un nombre de paciente | es | `/patients` | «mostrá la fila 2» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «buscá a Juan Pérez», «solo los deudores», «nueva sesión» o «¿cuánto debe?». |
| «show the Email column» es de la tabla, no un nombre de paciente | es | `/patients` | «show the Email column» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «buscá a Juan Pérez», «solo los deudores», «nueva sesión» o «¿cuánto debe?». |
| «show the Last name column» es de la tabla, no un nombre de paciente | es | `/patients` | «show the Last name column» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «buscá a Juan Pérez», «solo los deudores», «nueva sesión» o «¿cuánto debe?». |
| con el alta abierta, «elegí Uruguay en país del teléfono» es de la ventana, no un paciente | es | `/patients` | «elegí Uruguay en país del teléfono» | **Pantalla** · Listo: país del teléfono = Uruguay. |
| «abrí a Ana» con dos: pregunta | es | `/patients` | «abrí a Ana» | **Pacientes** · ¿Cuál? [Ana Gómez / Ana Martínez] |
| 〃 | es | `/patients` | «Martínez» | **Pacientes** · Abrí la ficha de Ana Martínez. |
| «solo los deudores» | es | `/patients` | «solo los deudores» | **Pacientes** · Muestro solo los deudores. |
| «mostrame los que deben» | es | `/patients` | «mostrame los que deben» | **Pacientes** · Muestro solo los deudores. |
| «sacá el filtro de deudores» | es | `/patients` | «sacá el filtro de deudores» | **Pacientes** · Saqué el filtro de deudores. |
| «incluí los inactivos» | es | `/patients` | «incluí los inactivos» | **Pacientes** · Incluyo los inactivos. |
| «solo los activos» | es | `/patients` | «solo los activos» | **Pacientes** · Muestro solo los activos. |
| «los registrados esta semana» | es | `/patients` | «los registrados esta semana» | **Pacientes** · Muestro los registrados esta semana. |
| «todos los pacientes» | es | `/patients` | «todos los pacientes» | **Pacientes** · Saqué los filtros. |
| «actualizá la lista» | es | `/patients` | «actualizá la lista» | **Pacientes** · Actualizo la lista. |
| «nuevo paciente» | es | `/patients` | «nuevo paciente» | **Pacientes** · Abrí el formulario de paciente nuevo: decime los datos, por ejemplo «el nombre es Ana López». |
| «agregá un paciente» | es | `/patients` | «agregá un paciente» | **Pacientes** · Abrí el formulario de paciente nuevo: decime los datos, por ejemplo «el nombre es Ana López». |
| «cuántos pacientes hay» | es | `/patients` | «cuántos pacientes hay» | **Pacientes** · Hay 9 pacientes con los filtros de ahora. |
| en «search for Roberto», «only debtors», «new patient» | en | `/patients` | «search for Roberto» | **Patients** · Opened Roberto Díaz’s record. |
| 〃 | en | `/patients` | «only debtors» | **Patients** · Showing only debtors. |
| 〃 | en | `/patients` | «new patient» | **Patients** · Opened the new patient form: tell me the details, for example “the name is Ann Smith”. |
| es-ES «busca a Roberto» | es-ES | `/patients` | «busca a Roberto» | **Pacientes** · He abierto la ficha de Roberto Díaz. |

## PA-DETAIL · La ficha: pestañas y acciones

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «la historia clínica» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «la historia clínica» | **Pacientes** · Muestro la historia clínica. |
| «mostrame las finanzas» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «mostrame las finanzas» | **Pacientes** · Muestro las finanzas. |
| «andá a los datos» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «andá a los datos» | **Pacientes** · Muestro los datos. |
| «la pestaña de facturas» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «la pestaña de facturas» | **Pacientes** · Muestro las finanzas. |
| «nueva sesión» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «nueva sesión» | **Pacientes** · Abrí una sesión clínica para Juan Pérez. |
| «hacele un presupuesto» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «hacele un presupuesto» | **Pacientes** · Abrí un presupuesto para Juan Pérez. |
| «nueva factura» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «nueva factura» | **Pacientes** · Abrí una factura para Juan Pérez. |
| «un prepago» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «un prepago» | **Pacientes** · Abrí un prepago para Juan Pérez. |
| «cobrale» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «cobrale» | **Pacientes** · Abrí el cobro rápido para Juan Pérez. |
| «dale una cita» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «dale una cita» | **Pacientes** · Abrí una cita nueva para Juan Pérez. |
| «abrí el odontograma» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «abrí el odontograma» | **Pacientes** · Abrí un odontograma para Juan Pérez. |
| «nuevo periodontograma» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «nuevo periodontograma» | **Pacientes** · Abrí un periodontograma para Juan Pérez. |
| «una sesión estética» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «una sesión estética» | **Pacientes** · Abrí una sesión estética para Juan Pérez. |
| «nuevo documento» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «nuevo documento» | **Pacientes** · Abrí un documento para Juan Pérez. |
| «hacé una receta» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «hacé una receta» | **Pacientes** · Abrí una receta para Juan Pérez. |
| «nuevas indicaciones» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «nuevas indicaciones» | **Pacientes** · Abrí indicaciones para Juan Pérez. |
| «imprimí el estado de cuenta» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «imprimí el estado de cuenta» | **Pacientes** · Imprimo el estado de cuenta de Juan Pérez. |
| «editá los datos» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «editá los datos» | **Pacientes** · Abrí la edición de Juan Pérez. |
| «dale el alta» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «dale el alta» | **Pacientes** · Abrí el alta de Juan Pérez. |
| «cerrá la ficha» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «cerrá la ficha» | **Pacientes** · Cerré la ficha. |
| «andá a facturas» con la ficha abierta es la pestaña, no el menú | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «andá a facturas» | **Pacientes** · Muestro las finanzas. |

## PA-ACT · Acciones con el nombre en la frase

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «nueva sesión para Carlos López» abre y hace | es | `/patients` | «nueva sesión para Carlos López» | **Pacientes** · Abrí una sesión clínica para Carlos López. |
| «hacele un presupuesto a Sofía Castro» | es | `/patients` | «hacele un presupuesto a Sofía Castro» | **Pacientes** · Abrí un presupuesto para Sofía Castro. |
| sin ficha ni nombre: la pide | es | `/patients` | «nueva sesión» | **Pacientes** · Primero abrí la ficha de un paciente: por ejemplo «abrí la ficha de Juan Pérez». |
| en «new session for Carlos López» y «make a quote» | en | `/patients` | «new session for Carlos López» | **Patients** · Opened a clinical session for Carlos López. |
| 〃 | en | `/patients` | «make a quote» | **Patients** · Opened a quote for Carlos López. |

## PA-INFO · Preguntas sobre el paciente

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| con la ficha abierta «¿cuánto debe?» | es | `/patients` | «abrí la ficha de Juan Pérez» | **Pacientes** · Abrí la ficha de Juan Pérez. |
| 〃 | es | `/patients` | «cuánto debe» | Juan Pérez: Debe $ 1.200,00. |
| «¿cuántas veces vino Juan Pérez?» | es | `/patients` | «cuántas veces vino Juan Pérez» | Juan Pérez: Vino 5 veces. |
| «resumen de Juan Pérez» | es | `/patients` | «resumen de Juan Pérez» | Juan Pérez: Vino 5 veces. Faltó 2 veces; la última fue el 10 de septiembre de 2026. Canceló una cita, una sobre la hora. Debe $ 1.200,00. El último pago fue de $ 500,00 el 5 de octubre de 2026 (Tarjeta). Tiene 2 presupuestos: 2 aceptados y uno sin facturar. T… |
| sin paciente pregunta de quién | es | `/patients` | «cuánto debe» | **Pacientes** · ¿De qué paciente? |
| 〃 | es | `/patients` | «Juan Pérez» | Juan Pérez: Debe $ 1.200,00. |
| en «how much does he owe» con la ficha | en | `/patients` | «open Juan Pérez record» | **Patients** · Opened Juan Pérez’s record. |
| 〃 | en | `/patients` | «how much does he owe» | Juan Pérez: Owes UYU 1,200.00. |

## PA-NAV · Llegar y buscar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «andá a pacientes y buscá a Roberto Díaz» | es | `/` | «andá a pacientes y buscá a Roberto Díaz» | **Pacientes** · Abrí la ficha de Roberto Díaz. |

## PA-SECTION · «el estado de cuenta de …» abre el paciente y esa pestaña

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «abrí el estado de cuenta de Roberto Díaz» | es | `/patients` | «abrí el estado de cuenta de Roberto Díaz» | **Pacientes** · Abrí la ficha de Roberto Díaz. Muestro las finanzas. |
| es «abrí las facturas de Carlos López» | es | `/patients` | «abrí las facturas de Carlos López» | **Pacientes** · Abrí la ficha de Carlos López. Muestro las finanzas. |
| es «abrí la historia clínica de Roberto Díaz» | es | `/patients` | «abrí la historia clínica de Roberto Díaz» | **Pacientes** · Abrí la ficha de Roberto Díaz. Muestro la historia clínica. |
| es-ES «abre el estado de cuenta de Roberto Díaz» | es-ES | `/patients` | «abre el estado de cuenta de Roberto Díaz» | **Pacientes** · He abierto la ficha de Roberto Díaz. Muestro las finanzas. |
| en «open the account statement of Roberto Díaz» | en | `/patients` | «open the account statement of Roberto Díaz» | **Patients** · Opened Roberto Díaz’s record. Showing the finances. |
| un nombre que no está no ofrece la lista de antes | es | `/patients` | «abrí el estado de cuenta de Zoe Zamora» | **Pacientes** · No encontré a «Zoe Zamora». |

