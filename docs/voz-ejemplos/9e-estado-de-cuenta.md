# Estado de cuenta del paciente

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/9e-ledger.spec.ts`

Estado de cuenta: moneda, orden, período, altas en línea, saldo y movimientos, acciones por fila con confirmación.

**50 frases** en **42 pruebas que pasan** (es 38 · es-ES 4 · en 8). Pantallas: `/patients`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## EC-VIEW · Moneda, orden y período

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «en dólares» | es | `/patients` | «en dólares» | **Estado de cuenta** · Muestro el estado de cuenta en USD. |
| es «mostrame el estado de cuenta en dólares» | es | `/patients` | «mostrame el estado de cuenta en dólares» | **Estado de cuenta** · Muestro el estado de cuenta en USD. |
| es «cambiá la moneda a pesos» | es | `/patients` | «cambiá la moneda a pesos» | **Estado de cuenta** · Muestro el estado de cuenta en UYU. |
| es «en la moneda secundaria» | es | `/patients` | «en la moneda secundaria» | **Estado de cuenta** · Muestro el estado de cuenta en USD. |
| es «en la moneda principal» | es | `/patients` | «en la moneda principal» | **Estado de cuenta** · Muestro el estado de cuenta en UYU. |
| es-ES «enséñamelo en dólares» | es-ES | `/patients` | «enséñamelo en dólares» | **Estado de cuenta** · Muestro el estado de cuenta en USD. |
| en «show it in dollars» | en | `/patients` | «show it in dollars» | **Account statement** · Showing the account statement in USD. |
| es «ordená descendente» | es | `/patients` | «ordená descendente» | **Estado de cuenta** · Los más recientes arriba. |
| es «los más recientes arriba» | es | `/patients` | «los más recientes arriba» | **Estado de cuenta** · Los más recientes arriba. |
| es «ordená ascendente» | es | `/patients` | «ordená ascendente» | **Estado de cuenta** · Los más recientes al final. |
| es «los más viejos primero» | es | `/patients` | «los más viejos primero» | **Estado de cuenta** · Los más recientes al final. |
| en «newest first» | en | `/patients` | «newest first» | **Account statement** · Newest on top. |
| en «sort ascending» | en | `/patients` | «sort ascending» | **Account statement** · Newest at the bottom. |
| es «todo el tiempo» | es | `/patients` | «todo el tiempo» | **Estado de cuenta** · Muestro todo el tiempo. |
| en «all time» | en | `/patients` | «all time» | **Account statement** · Showing all time. |
| «el mes pasado» pone el período | es | `/patients` | «mostrame el mes pasado» | **Estado de cuenta** · Muestro del 01/10/2026 al 31/10/2026. |
| una sola moneda: «en dólares» lo dice | es | `/patients` | «en dólares» | **Estado de cuenta** · El estado de cuenta tiene una sola moneda: UYU. |

## EC-CREATE · Altas y saldo

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «nuevo presupuesto» | es | `/patients` | «nuevo presupuesto» | **Estado de cuenta** · Abrí un presupuesto nuevo: decime los servicios («servicio limpieza», «cantidad 2», «precio 1500») y «guardar». |
| es «agregá un presupuesto» | es | `/patients` | «agregá un presupuesto» | **Estado de cuenta** · Abrí un presupuesto nuevo: decime los servicios («servicio limpieza», «cantidad 2», «precio 1500») y «guardar». |
| es «nuevo tratamiento» | es | `/patients` | «nuevo tratamiento» | **Estado de cuenta** · Abrí un tratamiento nuevo: decime los servicios y «guardar». |
| es «nueva factura» | es | `/patients` | «nueva factura» | **Estado de cuenta** · Abrí un tratamiento nuevo: decime los servicios y «guardar». |
| es «registrá un pago» | es | `/patients` | «registrá un pago» | **Estado de cuenta** · Abrí un pago nuevo: decime el monto y el medio de pago, y «guardar». |
| es «cobrale» | es | `/patients` | «cobrale» | **Estado de cuenta** · Abrí un pago nuevo: decime el monto y el medio de pago, y «guardar». |
| es-ES «añade un presupuesto» | es-ES | `/patients` | «añade un presupuesto» | **Estado de cuenta** · He abierto un presupuesto nuevo: dime los servicios («servicio limpieza», «cantidad 2», «precio 1500») y «guardar». |
| en «new payment» | en | `/patients` | «new payment» | **Account statement** · Opened a new payment: tell me the amount and the payment method, and “save”. |
| en «add a quote» | en | `/patients` | «add a quote» | **Account statement** · Opened a new quote: tell me the services (“service cleaning”, “quantity 2”, “price 1500”) and “save”. |
| «¿cuánto debe?» | es | `/patients` | «cuánto debe» | **Estado de cuenta** · Debe UYU 2.500,00. |
| «leeme los movimientos» | es | `/patients` | «leeme los movimientos» | **Estado de cuenta** · 3 movimientos; saldo UYU 2.500,00. |
| en «what is the balance» | en | `/patients` | «what is the balance» | **Account statement** · Owes UYU 2.500,00. |

## EC-ROW · Una fila

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «facturá el presupuesto 1» confirma y factura | es | `/patients` | «facturá el presupuesto 1» | **Estado de cuenta** · ¿Seguro que querés facturar Limpieza y profilaxis (P-0001) · 17/03/2026? |
| 〃 | es | `/patients` | «sí» | **Estado de cuenta** · Facturo Limpieza y profilaxis (P-0001) · 17/03/2026. |
| «imprimí la factura 12» (sin confirmar) | es | `/patients` | «imprimí la factura 12» | **Estado de cuenta** · Imprimo Restauración pieza 16 (F-0012) · 23/03/2026. |
| «editá el pago» | es | `/patients` | «editá el pago» | **Estado de cuenta** · Abrí la edición de Pago en efectivo (R-0005) · 28/03/2026. |
| «hacé una nota de crédito de la restauración» | es | `/patients` | «hacé una nota de crédito de la restauración» | **Estado de cuenta** · ¿Seguro que querés hacer una nota de crédito de Restauración pieza 16 (F-0012) · 23/03/2026? |
| 〃 | es | `/patients` | «sí» | **Estado de cuenta** · Abrí la nota de crédito de Restauración pieza 16 (F-0012) · 23/03/2026. |
| «finalizá la factura 12» | es | `/patients` | «finalizá la factura 12» | **Estado de cuenta** · ¿Seguro que querés finalizar Restauración pieza 16 (F-0012) · 23/03/2026? |
| 〃 | es | `/patients` | «sí» | **Estado de cuenta** · Finalicé Restauración pieza 16 (F-0012) · 23/03/2026. |
| «volvé a presupuesto la factura 12» | es | `/patients` | «volvé a presupuesto la factura 12» | **Estado de cuenta** · ¿Seguro que querés volver a presupuesto Restauración pieza 16 (F-0012) · 23/03/2026? |
| 〃 | es | `/patients` | «sí» | **Estado de cuenta** · Volví Restauración pieza 16 (F-0012) · 23/03/2026 a presupuesto. |
| «eliminá el pago» pide confirmar; «no» no hace nada | es | `/patients` | «eliminá el pago» | **Estado de cuenta** · ¿Seguro que querés eliminar Pago en efectivo (R-0005) · 28/03/2026? |
| 〃 | es | `/patients` | «no» | **Estado de cuenta** · No hice nada. |
| «mandá por mail el presupuesto 1» | es | `/patients` | «mandá por mail el presupuesto 1» | **Estado de cuenta** · Abrí el envío por email de Limpieza y profilaxis (P-0001) · 17/03/2026. |
| «facturá el del 17 de marzo» | es | `/patients` | «facturá el del 17 de marzo» | **Estado de cuenta** · ¿Seguro que querés facturar Limpieza y profilaxis (P-0001) · 17/03/2026? |
| 〃 | es | `/patients` | «sí» | **Estado de cuenta** · Facturo Limpieza y profilaxis (P-0001) · 17/03/2026. |
| «seleccioná el último» y «facturalo» no se puede (es un pago) | es | `/patients` | «seleccioná el último» | **Estado de cuenta** · Elegí Pago en efectivo (R-0005) · 28/03/2026. |
| 〃 | es | `/patients` | «facturalo» | **Estado de cuenta** · No se puede facturar Pago en efectivo (R-0005) · 28/03/2026. |
| es-ES «factura el presupuesto 1» y «sí» | es-ES | `/patients` | «factura el presupuesto 1» | **Estado de cuenta** · ¿Seguro que quieres facturar Limpieza y profilaxis (P-0001) · 17/03/2026? |
| 〃 | es-ES | `/patients` | «sí» | **Estado de cuenta** · Facturo Limpieza y profilaxis (P-0001) · 17/03/2026. |
| en «print invoice 12» | en | `/patients` | «print invoice 12» | **Account statement** · Printing Restauración pieza 16 (F-0012) · 23/03/2026. |
| lo que no está lo dice | es | `/patients` | «imprimí la factura 99» | **Estado de cuenta** · No encontré ese movimiento en el estado de cuenta. |

