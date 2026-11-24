# Cobro rápido

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/09-billing.spec.ts`

Cobro rápido paso por paso: paciente, agregar servicios (con cantidad y precio), cambiar precio/cantidad, descuentos por línea o total (permiso y máximo), quitar, moneda, sede, total, pago mixto, el resto, notas, facturar/cobrar/cerrar; de punta a punta.

**155 frases** en **59 pruebas que pasan** (es 140 · es-ES 1 · en 14). Pantallas: `/purchases/providers`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## CR-PAT · Paciente

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «para Juan Pérez» lo elige y pasa a los servicios | es | `/purchases/providers` | «para Juan Pérez» | **Cobro rápido** · Paciente: Juan Pérez. ¿Qué servicio agrego? |
| el nombre solo en el paso del paciente | es | `/purchases/providers` | «Sofía Castro» | **Cobro rápido** · Paciente: Sofía Castro. ¿Qué servicio agrego? |
| varios: pregunta cuál | es | `/purchases/providers` | «el paciente es Ana» | **Cobro rápido** · Encontré varios. ¿Cuál? [Ana Gómez / Ana Martínez] |
| 〃 | es | `/purchases/providers` | «la segunda» | **Cobro rápido** · Paciente: Ana Martínez. ¿Qué servicio agrego? |
| en «the patient is Carlos López» | en | `/purchases/providers` | «the patient is Carlos López» | **Quick billing** · Patient: Carlos López. Which service should I add? |

## CR-ADD · Agregar servicios

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «agregá limpieza» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| «agregá una consulta» | es | `/purchases/providers` | «agregá una consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 1000,00 UYU. |
| «agregá 2 limpiezas» | es | `/purchases/providers` | «agregá 2 limpiezas» | **Cobro rápido** · Agregué 2 × Limpieza a 1500,00 UYU. Total: 3000,00 UYU. |
| «agregá dos radiografías» | es | `/purchases/providers` | «agregá dos radiografías» | **Cobro rápido** · Agregué 2 × Radiografía a 600,00 UYU. Total: 1200,00 UYU. |
| «sumá una consulta a 800» | es | `/purchases/providers` | «sumá una consulta a 800» | **Cobro rápido** · Agregué Consulta a 800,00 UYU. Total: 800,00 UYU. |
| «agregá el servicio blanqueamiento» | es | `/purchases/providers` | «agregá el servicio blanqueamiento» | **Cobro rápido** · Agregué Blanqueamiento a 8000,00 UYU. Total: 8000,00 UYU. |
| «agregá extracción simple» | es | `/purchases/providers` | «agregá extracción simple» | **Cobro rápido** · Agregué Extracción simple a 2500,00 UYU. Total: 2500,00 UYU. |
| «agregá un servicio» pregunta cuál y lo busca | es | `/purchases/providers` | «agregá un servicio» | **Cobro rápido** · ¿Qué servicio agrego? |
| 〃 | es | `/purchases/providers` | «consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 1000,00 UYU. |
| «agregá extracción» con dos: pregunta cuál | es | `/purchases/providers` | «agregá extracción» | **Cobro rápido** · ¿Cuál de estos? [Extracción simple / Extracción compleja] |
| 〃 | es | `/purchases/providers` | «la compleja» | **Cobro rápido** · Agregué Extracción compleja a 4000,00 UYU. Total: 4000,00 UYU. |
| no existe: lo dice | es | `/purchases/providers` | «agregá ortodoncia» | **Cobro rápido** · No encontré el servicio «ortodoncia». |
| en «add a cleaning» y «add 2 consultations at 900» | en | `/purchases/providers` | «add limpieza» | **Quick billing** · Added Limpieza at UYU 1,500.00. Total: UYU 1,500.00. |
| 〃 | en | `/purchases/providers` | «add 2 consulta at 900» | **Quick billing** · Added 2 × Consulta at UYU 900.00. Total: UYU 3,300.00. |
| es-ES «añade una limpieza» | es-ES | `/purchases/providers` | «añade una limpieza» | **Cobro rápido** · He añadido Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |

## CR-LINE · Precio, cantidad, quitar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «el precio de la limpieza a 1200» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «el precio de la limpieza a 1200» | **Cobro rápido** · Limpieza a 1200,00 UYU. Total: 2200,00 UYU. |
| «la consulta a 800» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «la consulta a 800» | **Cobro rápido** · Consulta a 800,00 UYU. Total: 2300,00 UYU. |
| «poné la limpieza en 1.300» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «poné la limpieza en 1.300» | **Cobro rápido** · Limpieza a 1300,00 UYU. Total: 2300,00 UYU. |
| «cantidad de la consulta 3» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «la cantidad de la consulta en 3» | **Cobro rápido** · Consulta: cantidad 3. Total: 4500,00 UYU. |
| «que sean 2 limpiezas» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «que sean 2 limpiezas» | **Cobro rápido** · Limpieza: cantidad 2. Total: 4000,00 UYU. |
| «quitá la consulta» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «quitá la consulta» | **Cobro rápido** · Quité Consulta. Total: 1500,00 UYU. |
| «sacá la última» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «sacá la última» | **Cobro rápido** · Quité Consulta. Total: 1500,00 UYU. |
| sin decir cuál con dos: pregunta | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «cantidad 2» | **Cobro rápido** · ¿Cuál de los servicios? [Limpieza / Consulta] |
| 〃 | es | `/purchases/providers` | «la primera» | **Cobro rápido** · Limpieza: cantidad 2. Total: 4000,00 UYU. |
| en «set the price of limpieza to 1100» y «remove consulta» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «set the price of limpieza to 1100» | **Cobro rápido** · Limpieza a 1100,00 UYU. Total: 2100,00 UYU. |
| 〃 | es | `/purchases/providers` | «remove consulta» | **Cobro rápido** · Quité Consulta. Total: 1100,00 UYU. |

## CR-DISC · Descuentos (si la clínica los tiene)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| por línea: «10% de descuento a la limpieza» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «10% de descuento a la limpieza» | **Cobro rápido** · Apliqué 10% de descuento. Total: 1350,00 UYU. |
| por línea con una sola: «aplicá un descuento de 200» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «aplicá un descuento de 200» | **Cobro rápido** · Apliqué 200,00 UYU de descuento. Total: 1300,00 UYU. |
| «descuento del 15 por ciento» y «sacá el descuento» | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 1000,00 UYU. |
| 〃 | es | `/purchases/providers` | «descuento del 15 por ciento» | **Cobro rápido** · Apliqué 15% de descuento. Total: 850,00 UYU. |
| 〃 | es | `/purchases/providers` | «sacá el descuento» | **Cobro rápido** · Saqué el descuento. Total: 1000,00 UYU. |
| sobre el total cuando la clínica lo usa así | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «10% de descuento» | **Cobro rápido** · Apliqué 10% de descuento. Total: 2250,00 UYU. |
| más del máximo: lo dice y no lo aplica | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «30% de descuento» | **Cobro rápido** · El descuento máximo es del 20%. |
| descuentos apagados: lo dice | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «10% de descuento» | **Cobro rápido** · Los descuentos no están activados en la clínica. |
| sin permiso: lo dice | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «10% de descuento» | **Cobro rápido** · No tenés permiso para aplicar descuentos. |
| en «give 10 percent discount» | en | `/purchases/providers` | «add limpieza» | **Quick billing** · Added Limpieza at UYU 1,500.00. Total: UYU 1,500.00. |
| 〃 | en | `/purchases/providers` | «give a 10 percent discount» | **Quick billing** · Applied a 10% discount. Total: UYU 1,350.00. |

## CR-INFO · Lo cargado, moneda y sede

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «¿cuánto da?» lee los servicios y el total | es | `/purchases/providers` | «agregá 2 limpiezas» | **Cobro rápido** · Agregué 2 × Limpieza a 1500,00 UYU. Total: 3000,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 4000,00 UYU. |
| 〃 | es | `/purchases/providers` | «cuánto da» | **Cobro rápido** · Hay 2 × Limpieza 3000,00 UYU, Consulta 1000,00 UYU. Total: 4000,00 UYU. |
| «en dólares» | es | `/purchases/providers` | «en dólares» | **Cobro rápido** · Moneda: USD. |
| «cambiá la moneda a pesos» | es | `/purchases/providers` | «cambiá la moneda a pesos» | **Cobro rápido** · Moneda: UYU. |
| «sede Pocitos» | es | `/purchases/providers` | «sede Pocitos» | **Cobro rápido** · Sede: Pocitos. |
| en «what is the total» | en | `/purchases/providers` | «add limpieza» | **Quick billing** · Added Limpieza at UYU 1,500.00. Total: UYU 1,500.00. |
| 〃 | en | `/purchases/providers` | «what is the total» | **Quick billing** · There is Limpieza UYU 1,500.00. Total: UYU 1,500.00. |

## CR-GO · El pie: seguir, facturar, cobrar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| sin servicios no sigue y dice por qué | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Primero agregá al menos un servicio. |
| «facturá y cobrá» pasa al pago | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| «solo facturar» termina sin cobrar | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «solo facturar» | **Cobro rápido** · Listo, solo facturo. |
| «siguiente» en el paso del paciente sin paciente: lo pide | es | `/purchases/providers` | «siguiente» | **Cobro rápido** · Primero decime para qué paciente es. |
| en «invoice and collect» | en | `/purchases/providers` | «add limpieza» | **Quick billing** · Added Limpieza at UYU 1,500.00. Total: UYU 1,500.00. |
| 〃 | en | `/purchases/providers` | «invoice and collect» | **Quick billing** · Invoicing and going to payment. |

## CR-PAY · Pago

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «en efectivo» elige el medio y deja el total | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «en efectivo» | **Cobro rápido** · Pago: Efectivo 2500,00 UYU. |
| «con tarjeta de débito» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «con tarjeta de débito» | **Cobro rápido** · Pago: Tarjeta de débito 2500,00 UYU. |
| «1000 en efectivo y el resto con tarjeta de crédito» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «1000 en efectivo y el resto con tarjeta de crédito» | **Cobro rápido** · Pago: Efectivo 1000,00 UYU, Tarjeta de crédito 1500,00 UYU. |
| «pagá 500 con transferencia» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «pagá 500 con transferencia» | **Cobro rápido** · Pago: Transferencia 500,00 UYU. Quedan 2000,00 UYU sin cubrir. |
| «todo en efectivo» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «todo en efectivo» | **Cobro rápido** · Pago: Efectivo 2500,00 UYU. |
| «agregá otro medio de pago» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «agregá otro medio de pago» | **Cobro rápido** · Agregué otro medio de pago. |
| «nota: paga el resto la semana que viene» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «nota: paga el resto la semana que viene» | **Cobro rápido** · Anoté la observación del pago. |
| «cuánto falta» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «cuánto falta» | **Cobro rápido** · Falta cobrar 2500,00 UYU; con lo cargado quedan 0,00 UYU. |
| «cobrá» sin medio: lo pide | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «cobrá» | **Cobro rápido** · Falta elegir el medio de pago. |
| «en efectivo» y «cobrá» cobra | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «en efectivo» | **Cobro rápido** · Pago: Efectivo 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «cobrá» | **Cobro rápido** · Cobrando… |
| «cerrar» al final | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «en efectivo» | **Cobro rápido** · Pago: Efectivo 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «cobrá» | **Cobro rápido** · Cobrando… |
| 〃 | es | `/purchases/providers` | «cerrar» | **Cobro rápido** · Listo, cerré el cobro. |
| en «pay 1000 in cash and the rest by card» | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá consulta» | **Cobro rápido** · Agregué Consulta a 1000,00 UYU. Total: 2500,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | en | `/purchases/providers` | «add limpieza» | **Quick billing** · Added Limpieza at UYU 1,500.00. Total: UYU 1,500.00. |
| 〃 | en | `/purchases/providers` | «add consulta» | **Quick billing** · Added Consulta at UYU 1,000.00. Total: UYU 2,500.00. |
| 〃 | en | `/purchases/providers` | «invoice and collect» | **Quick billing** · Invoicing and going to payment. |
| 〃 | en | `/purchases/providers` | «pay 1000 in cash and the rest by credit card» | **Quick billing** · Payment: Efectivo UYU 1,000.00, Tarjeta de crédito UYU 1,500.00. |
| 〃 | en | `/purchases/providers` | «charge it» | **Quick billing** · Collecting… |

## CR-FLOW · De punta a punta, como en la recepción

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| desde el panel derecho: «cobrale a Juan Pérez» → servicios → descuento → pago mixto → cobrar | es | `/purchases/providers` | «cobrale a Juan Pérez» | **Panel derecho** · Abrí el cobro rápido para Juan Pérez. |
| 〃 | es | `/purchases/providers` | «agregá 2 limpiezas» | **Cobro rápido** · Agregué 2 × Limpieza a 1500,00 UYU. Total: 3000,00 UYU. |
| 〃 | es | `/purchases/providers` | «agregá radiografía» | **Cobro rápido** · Agregué Radiografía a 600,00 UYU. Total: 3600,00 UYU. |
| 〃 | es | `/purchases/providers` | «10% de descuento a la radiografía» | **Cobro rápido** · Apliqué 10% de descuento. Total: 3540,00 UYU. |
| 〃 | es | `/purchases/providers` | «cuánto da» | **Cobro rápido** · Hay 2 × Limpieza 3000,00 UYU, Radiografía 540,00 UYU. Total: 3540,00 UYU. Incluye 60,00 UYU de descuento. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «2000 en efectivo y el resto con tarjeta de crédito» | **Cobro rápido** · Pago: Efectivo 2000,00 UYU, Tarjeta de crédito 1540,00 UYU. |
| 〃 | es | `/purchases/providers` | «cobrá» | **Cobro rápido** · Cobrando… |
| sin paciente: paciente, «¿qué servicio?» se contesta con el nombre | es | `/purchases/providers` | «para Carlos López» | **Cobro rápido** · Paciente: Carlos López. ¿Qué servicio agrego? |
| 〃 | es | `/purchases/providers` | «agregá un servicio» | **Cobro rápido** · ¿Qué servicio agrego? |
| 〃 | es | `/purchases/providers` | «blanqueamiento» | **Cobro rápido** · Agregué Blanqueamiento a 8000,00 UYU. Total: 8000,00 UYU. |
| 〃 | es | `/purchases/providers` | «facturá y cobrá» | **Cobro rápido** · Facturo y vamos al pago. |
| 〃 | es | `/purchases/providers` | «con transferencia» | **Cobro rápido** · Pago: Transferencia 8000,00 UYU. |
| 〃 | es | `/purchases/providers` | «cobrá» | **Cobro rápido** · Cobrando… |
| lo de la página de atrás no se toca mientras el cobro está abierto | es | `/purchases/providers` | «agregá limpieza» | **Cobro rápido** · Agregué Limpieza a 1500,00 UYU. Total: 1500,00 UYU. |
| 〃 | es | `/purchases/providers` | «exportar» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá a pacientes», «¿qué puedo hacer acá?» o «abrí la ficha de Ana Pérez». |
| «cancelar» con el cobro a medias: aprieta Cancelar de la ventana | es | `/purchases/providers` | «cancelar» | **Pantalla** · Listo, apreté «Cancelar». |

