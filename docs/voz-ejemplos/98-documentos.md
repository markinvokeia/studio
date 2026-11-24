# Facturas, pagos y presupuestos

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/98-documents.spec.ts`

Facturas, pagos y presupuestos en las tablas compartidas (Ventas, Compras, ficha): leer y sumar (pendientes), abrir/imprimir/mail/editar/confirmar/rechazar/cobrar/asignar una fila (número, nombre, posición), crear, exportar, actualizar, filtrar.

**41 frases** en **35 pruebas que pasan** (es 29 · es-ES 2 · en 10). Pantallas: `/`, `/purchases/invoices`, `/sales/invoices`, `/sales/quotes`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## DO-READ · Leer y sumar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cuántas facturas hay» | es | `/sales/invoices` | «cuántas facturas hay» | **Documentos** · Hay 4 documentos en facturas; suman 8200,00 UYU, 800,00 US$. |
| «cuánto suman las pendientes» | es | `/sales/invoices` | «cuánto suman las pendientes» | **Documentos** · Hay 3 pendientes en facturas; falta cobrar 5200,00 UYU, 800,00 US$. |
| «cuántos presupuestos hay» | es | `/sales/quotes` | «cuántos presupuestos hay» | **Documentos** · Hay 2 documentos en presupuestos; suman 5500,00 UYU. |
| en «how many invoices are there» | en | `/sales/invoices` | «how many invoices are there» | **Documents** · There are 4 documents in invoices; they add up to UYU 8,200.00, $800.00. |
| en «how much do the pending ones add up to» | en | `/sales/invoices` | «how much do the pending ones add up to» | **Documents** · There are 3 pending in invoices; UYU 5,200.00, $800.00 left to collect. |
| en «how much is pending» | en | `/sales/invoices` | «how much is pending» | **Documents** · There are 3 pending in invoices; UYU 5,200.00, $800.00 left to collect. |
| en «what is the total of the unpaid ones» | en | `/sales/invoices` | «what is the total of the unpaid ones» | **Documents** · There are 3 pending in invoices; UYU 5,200.00, $800.00 left to collect. |
| en «how much is outstanding» | en | `/sales/invoices` | «how much is outstanding» | **Documents** · There are 3 pending in invoices; UYU 5,200.00, $800.00 left to collect. |
| es-ES «¿cuánto suman las pendientes?» | es-ES | `/sales/invoices` | «¿cuánto suman las pendientes?» | **Documentos** · Hay 3 pendientes en facturas; falta cobrar 5200,00 UYU, 800,00 US$. |

## DO-ROW · Una fila

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «abrí la factura 120» | es | `/sales/invoices` | «abrí la factura 120» | **Documentos** · Abrí F-120 de Juan Pérez. |
| «abrí la factura F-121» | es | `/sales/invoices` | «abrí la factura F-121» | **Documentos** · Abrí F-121 de Ana Gómez. |
| «imprimí la de Juan Pérez» | es | `/sales/invoices` | «imprimí la de Juan Pérez» | **Documentos** · Imprimo F-120. |
| «mandá por mail la factura 122» | es | `/sales/invoices` | «mandá por mail la factura 122» | **Documentos** · Abrí el mail de F-122 para Carlos López. |
| «editá la de Carlos» | es | `/sales/invoices` | «editá la de Carlos» | **Documentos** · Abrí F-122 para editarlo. |
| «confirmá la factura 122» | es | `/sales/invoices` | «confirmá la factura 122» | **Documentos** · Confirmo F-122: contestá el aviso. |
| «cobrá la factura 120» | es | `/sales/invoices` | «cobrá la factura 120» | **Documentos** · Abrí el cobro de F-120. |
| «cobrá la última» | es | `/sales/invoices` | «cobrá la última» | **Documentos** · Abrí el cobro de F-123. |
| «abrí la segunda» | es | `/sales/invoices` | «abrí la segunda» | **Documentos** · Abrí F-121 de Ana Gómez. |
| «imprimí el pago 45» | es | `/sales/invoices` | «imprimí el pago 45» | **Documentos** · Imprimo R-45. |
| «asigná el pago 45» | es | `/sales/invoices` | «asigná el pago 45» | **Documentos** · Abrí la asignación de R-45. |
| «la de Ana» con dos: pregunta | es | `/sales/invoices` | «imprimí la de Ana» | **Documentos** · ¿Cuál? [F-121 · Ana Gómez / F-123 · Ana Martínez] |
| 〃 | es | `/sales/invoices` | «la segunda» | **Documentos** · Imprimo F-123. |
| número que no está: lo dice | es | `/sales/invoices` | «abrí la factura 999» | **Documentos** · No encontré eso en la lista de facturas. |
| presupuestos: confirmar, rechazar, cobrar | es | `/sales/quotes` | «confirmá el presupuesto P-10» | **Documentos** · Confirmo P-10: contestá el aviso. |
| 〃 | es | `/sales/quotes` | «rechazá el de Sofía Castro» | **Documentos** · Rechazo P-11: contestá el aviso. |
| 〃 | es | `/sales/quotes` | «cobrá el presupuesto 11» | **Documentos** · Abrí el cobro de P-11. |
| compras: «imprimí la de Dental Sur» | es | `/purchases/invoices` | «imprimí la de Dental Sur» | **Documentos** · Imprimo F-120. |
| es-ES «imprime la factura 120» | es-ES | `/sales/invoices` | «imprime la factura 120» | **Documentos** · Imprimo F-120. |
| en «print invoice 120», «email the one for Juan Pérez», «collect invoice 123» | en | `/sales/invoices` | «print invoice 120» | **Documents** · Printing F-120. |
| 〃 | en | `/sales/invoices` | «email the one for Juan Pérez» | **Documents** · Opened the email for F-120 to Juan Pérez. |
| 〃 | en | `/sales/invoices` | «collect invoice 123» | **Documents** · Opened the payment for F-123. |

## DO-LIST · Crear, exportar, actualizar, filtrar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «nueva factura» | es | `/sales/invoices` | «nueva factura» | **Documentos** · Abrí el alta de facturas. |
| «exportá las facturas» | es | `/sales/invoices` | «exportá las facturas» | **Documentos** · Abrí la exportación de facturas. |
| «actualizá las facturas» | es | `/sales/invoices` | «actualizá las facturas» | **Documentos** · Actualizo facturas. |
| «solo las pagadas» | es | `/sales/invoices` | «solo las pagadas» | **Documentos** · Filtro: Pagadas. |
| «mostrame solo las pendientes» | es | `/sales/invoices` | «mostrame solo las pendientes» | **Documentos** · Filtro: Pendientes. |
| «nuevo presupuesto» en presupuestos | es | `/sales/quotes` | «nuevo presupuesto» | **Documentos** · Abrí el alta de presupuestos. |
| filtro que no existe: lo dice | es | `/sales/invoices` | «solo las anuladas» | **Documentos** · No hay un filtro «anuladas» en esta lista. |
| en «new invoice» y «export the invoices» | en | `/sales/invoices` | «new invoice» | **Documents** · Opened a new one in invoices. |
| 〃 | en | `/sales/invoices` | «export the invoices» | **Documents** · Opened the invoices export. |

## DO-NAV · Llegar y actuar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «andá a facturas y cobrá la factura 120» | es | `/` | «andá a facturas y cobrá la factura 120» | **Documentos** · Abrí el cobro de F-120. |

