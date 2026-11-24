# Panel de control

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/91-dashboard.spec.ts`

Panel de control: períodos dichos, leer producción/cobrado/gastos/resultado/atenciones/agendados/nuevos de hoy y del mes, resumen, sede y servicio que más venden, comparación con el mes pasado; filtros de período, sede y moneda; actualizar.

**36 frases** en **33 pruebas que pasan** (es 26 · es-ES 1 · en 9). Pantallas: `/`, `/appointments`, `/patients`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## PC-READ · Leer los números

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «cuánto producimos hoy» | es | `/` | «cuánto producimos hoy» | **Panel de control** · Producción: hoy 45.000 UYU. |
| es «cuánto facturamos este mes» | es | `/` | «cuánto facturamos este mes» | **Panel de control** · Producción: en el mes 820.000 UYU (+12%). |
| es «cuánto cobramos» | es | `/` | «cuánto cobramos» | **Panel de control** · Cobrado: hoy 38.000 UYU, en el mes 700.000 UYU (-3%). |
| es «cuánto gastamos este mes» | es | `/` | «cuánto gastamos este mes» | **Panel de control** · Gastos: en el mes 210.000 UYU (+4%). |
| es «cuál es el resultado del mes» | es | `/` | «cuál es el resultado del mes» | **Panel de control** · Resultado: en el mes 490.000 UYU (+8%). |
| es «cuántos pacientes atendimos hoy» | es | `/` | «cuántos pacientes atendimos hoy» | **Panel de control** · Pacientes atendidos: hoy 18. |
| es «cuántas atenciones hubo este mes» | es | `/` | «cuántas atenciones hubo este mes» | **Panel de control** · Atenciones: en el mes 345 (+6%). |
| es «cuántos agendados hay para hoy» | es | `/` | «cuántos agendados hay para hoy» | **Panel de control** · Agendados para hoy: hoy 24. |
| es «cuántos pacientes nuevos tuvimos» | es | `/` | «cuántos pacientes nuevos tuvimos» | **Panel de control** · Pacientes nuevos: en el mes 42 (+15%). |
| es «dame un resumen del día» | es | `/` | «dame un resumen del día» | **Panel de control** · Hoy: producción 45.000 UYU, cobrado 38.000 UYU, 20 atenciones y 24 agendados. En el mes: producción 820.000 UYU, cobrado 700.000 UYU. |
| es «cómo va el día» | es | `/` | «cómo va el día» | **Panel de control** · Hoy: producción 45.000 UYU, cobrado 38.000 UYU, 20 atenciones y 24 agendados. En el mes: producción 820.000 UYU, cobrado 700.000 UYU. |
| es «qué sede produjo más» | es | `/` | «qué sede produjo más» | **Panel de control** · La sede que más produjo es Centro: 500.000 UYU (61% del total). |
| es «qué servicio se vendió más» | es | `/` | «qué servicio se vendió más» | **Panel de control** · El servicio más vendido es Blanqueamiento: 260.000 UYU (32%). |
| es «cómo venimos contra el mes pasado» | es | `/` | «cómo venimos contra el mes pasado» | **Panel de control** · La producción del mes va +12% contra el mes pasado: 820.000 UYU contra 730.000 UYU. |
| es-ES «cuánto hemos cobrado hoy» | es-ES | `/` | «cuánto hemos cobrado hoy» | **Panel de control** · Cobrado: hoy 38.000 UYU. |
| en «how much did we produce today» | en | `/` | «how much did we produce today» | **Dashboard** · Production: today UYU 45,000. |
| en «how much did we collect this month» | en | `/` | «how much did we collect this month» | **Dashboard** · Collected: this month UYU 700,000 (-3%). |
| en «how many patients did we see today» | en | `/` | «how many patients did we see today» | **Dashboard** · Patients seen: today 18. |
| en «give me a summary» | en | `/` | «give me a summary» | **Dashboard** · Today: production UYU 45,000, collected UYU 38,000, 20 visits and 24 scheduled. This month: production UYU 820,000, collected UYU 700,000. |
| en «which branch sold the most» | en | `/` | «which branch sold the most» | **Dashboard** · The top location is Centro: UYU 500,000 (61% of the total). |
| en «what are the best selling services» | en | `/` | «what are the best selling services» | **Dashboard** · The best-selling service is Blanqueamiento: UYU 260,000 (32%). |
| el ranking de sedes va en filas | es | `/` | «producción por sede, cuál vende más» | **Panel de control** · La sede que más produjo es Centro: 500.000 UYU (61% del total). |

## PC-FILTER · Período, sede, moneda, actualizar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «mostrame el mes pasado» | es | `/` | «mostrame el mes pasado» | **Panel de control** · Período: del 01/10/2026 al 31/10/2026. |
| «este mes» solo | es | `/` | «este mes» | **Panel de control** · Período: del 01/11/2026 al 30/11/2026. |
| «solo la sede Pocitos» y «todas las sedes» | es | `/` | «solo la sede Pocitos» | **Panel de control** · Muestro la sede Pocitos. |
| 〃 | es | `/` | «todas las sedes» | **Panel de control** · Muestro todas las sedes. |
| «filtrá por la sede centro» | es | `/` | «filtrá por la sede centro» | **Panel de control** · Muestro la sede Centro. |
| «en dólares» | es | `/` | «en dólares» | **Panel de control** · Panel en USD. |
| «actualizá el panel» | es | `/` | «actualizá el panel» | **Panel de control** · Actualizo el panel. |
| sin permiso de filtrar: lo dice | es | `/` | «mostrame el mes pasado» | **Panel de control** · No tenés permiso para hacer eso. |
| en «show me last month», «only the Pocitos location», «refresh» | en | `/` | «show me last month» | **Dashboard** · Period: 01/10/2026 to 31/10/2026. |
| 〃 | en | `/` | «only the location Pocitos» | **Dashboard** · Showing the Pocitos location. |
| 〃 | en | `/` | «refresh» | **Dashboard** · Refreshing the dashboard. |
| «cambiá a la sede Pocitos» es la sede de trabajo (panel derecho), no el filtro | es | `/` | «cambiá a la sede Pocitos» | **Panel derecho** · Listo, ahora trabajás en Pocitos. |

## PC-NAV · Llegar al panel y preguntar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| desde la agenda: «volvé al inicio y decime cuánto producimos hoy» | es | `/appointments` | «volvé al inicio y decime cuánto producimos hoy» | **Panel de control** · Producción: hoy 45.000 UYU. |
| en otra página no se lee el panel | es | `/patients` | «cuánto producimos hoy» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «buscá a Juan Pérez», «solo los deudores», «nueva sesión» o «¿cuánto debe?». |

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- PC-PERIOD · Períodos dichos › «hoy»
- PC-PERIOD · Períodos dichos › «ayer»
- PC-PERIOD · Períodos dichos › «esta semana»
- PC-PERIOD · Períodos dichos › «la semana pasada»
- PC-PERIOD · Períodos dichos › «este mes»
- PC-PERIOD · Períodos dichos › «el mes pasado»
- PC-PERIOD · Períodos dichos › «este año»
- PC-PERIOD · Períodos dichos › «el año pasado»
- PC-PERIOD · Períodos dichos › «los últimos 30 días»
- PC-PERIOD · Períodos dichos › «marzo»
- PC-PERIOD · Períodos dichos › «diciembre»
- PC-PERIOD · Períodos dichos › «marzo del año pasado»
- PC-PERIOD · Períodos dichos › «del 1 al 15»
- PC-PERIOD · Períodos dichos › «del 3 al 10 de octubre»
- PC-PERIOD · Períodos dichos › «last month»
- PC-PERIOD · Períodos dichos › «this week»
- PC-PERIOD · Períodos dichos › «last 7 days»
- PC-PERIOD · Períodos dichos › «march 2025»

