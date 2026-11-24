# Reportes

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/99-reports.spec.ts`

Reportes (piezas comunes de los 23): generar, período dicho (lo pone y genera), desde siempre, leer los totales, cuántas filas, exportar a Excel/PDF/CSV, imprimir, filtros de la barra.

**42 frases** en **33 pruebas que pasan** (es 32 · es-ES 2 · en 8). Pantallas: `/`, `/reports/cierre-caja`, `/reports/deudores`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## RP · Generar y período

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «generá el reporte» | es | `/reports/deudores` | «generá el reporte» | **Deudores** · Genero el reporte. |
| «generar» | es | `/reports/deudores` | «generar» | **Deudores** · Genero el reporte. |
| «corré el reporte» | es | `/reports/deudores` | «corré el reporte» | **Deudores** · Genero el reporte. |
| «consultá el informe» | es | `/reports/deudores` | «consultá el informe» | **Deudores** · Genero el reporte. |
| «el mes pasado» pone el período y genera | es | `/reports/deudores` | «el mes pasado» | **Deudores** · Período del 01/10/2026 al 31/10/2026; genero el reporte. |
| «mostrame marzo» | es | `/reports/deudores` | «mostrame marzo» | **Deudores** · Período del 01/03/2026 al 31/03/2026; genero el reporte. |
| «del 1 al 15» | es | `/reports/deudores` | «del 1 al 15» | **Deudores** · Período del 01/11/2026 al 15/11/2026; genero el reporte. |
| «desde siempre» | es | `/reports/deudores` | «desde siempre» | **Deudores** · Sin filtro de fecha; genero el reporte. |
| en «run the report» y «last month» | en | `/reports/deudores` | «run the report» | **Deudores** · Running the report. |
| 〃 | en | `/reports/deudores` | «last month» | **Deudores** · Period 01/10/2026 to 31/10/2026; running the report. |
| es-ES «genera el informe» | es-ES | `/reports/deudores` | «genera el informe» | **Deudores** · Genero el informe. |

## RP · Leer, exportar, imprimir

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| sin generar: lo pide | es | `/reports/deudores` | «cuánto da» | **Deudores** · Primero generá el reporte: decime «generá el reporte» o un período. |
| «¿cuánto da?» lee las tarjetas | es | `/reports/deudores` | «generá el reporte» | **Deudores** · Genero el reporte. |
| 〃 | es | `/reports/deudores` | «cuánto da» | **Deudores** · Total adeudado: $ 45.300. Deudores: 12. |
| «cuántas filas hay» | es | `/reports/deudores` | «generá el reporte» | **Deudores** · Genero el reporte. |
| 〃 | es | `/reports/deudores` | «cuántas filas hay» | **Deudores** · Hay 12 filas. |
| «exportá a Excel», «bajalo en PDF», «imprimilo» | es | `/reports/deudores` | «generá el reporte» | **Deudores** · Genero el reporte. |
| 〃 | es | `/reports/deudores` | «exportá a excel» | **Deudores** · Exporto a Excel. |
| 〃 | es | `/reports/deudores` | «bajalo en pdf» | **Deudores** · Exporto a PDF. |
| 〃 | es | `/reports/deudores` | «imprimilo» | **Deudores** · Imprimo el reporte. |
| formato que no tiene: lo dice | es | `/reports/deudores` | «generá el reporte» | **Deudores** · Genero el reporte. |
| 〃 | es | `/reports/deudores` | «exportá a csv» | **Deudores** · Este reporte no se exporta a CSV. |
| en «what is the total» y «export to excel» | en | `/reports/deudores` | «run the report» | **Deudores** · Running the report. |
| 〃 | en | `/reports/deudores` | «what is the total» | **Deudores** · Total adeudado: $ 45.300. Deudores: 12. |
| 〃 | en | `/reports/deudores` | «export to excel» | **Deudores** · Exporting to Excel. |

## RP-NAV · Llegar y pedir

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «llevame a reportes de deudores y mostrame el mes pasado» | es | `/` | «llevame a reportes de deudores y mostrame el mes pasado» | **Deudores** · Período del 01/10/2026 al 31/10/2026; genero el reporte. |

## RE-NOPERIOD · Reporte sin período

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «el mes pasado» en un reporte sin período: lo dice y lo genera igual | es | `/reports/deudores` | «el mes pasado» | **Deudores** · Este reporte no tiene período para elegir: lo genero igual. |
| en «last month» on a report without a period | en | `/reports/deudores` | «last month» | **Deudores** · This report has no period to choose: generating it anyway. |

## RE-FILTER · Los filtros de la barra (selectores)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «filtrá por la caja principal» | es | `/reports/cierre-caja` | «filtrá por la caja principal» | **Deudores** · Filtré por Caja Principal y genero el reporte. |
| es «la caja sede carrasco» | es | `/reports/cierre-caja` | «la caja sede carrasco» | **Deudores** · Filtré por Caja Sede Carrasco y genero el reporte. |
| es «solo efectivo» | es | `/reports/cierre-caja` | «solo efectivo» | **Deudores** · Filtré por Efectivo y genero el reporte. |
| es «pagos con tarjeta de crédito» | es | `/reports/cierre-caja` | «pagos con tarjeta de crédito» | **Deudores** · Filtré por Tarjeta de crédito y genero el reporte. |
| es «en dólares» | es | `/reports/cierre-caja` | «en dólares» | **Deudores** · Filtré por USD y genero el reporte. |
| es «solo egresos» | es | `/reports/cierre-caja` | «solo egresos» | **Deudores** · Filtré por Solo egresos y genero el reporte. |
| es «mostrá solo ingresos» | es | `/reports/cierre-caja` | «mostrá solo ingresos» | **Deudores** · Filtré por Solo ingresos y genero el reporte. |
| es-ES «filtra por transferencia» | es-ES | `/reports/cierre-caja` | «filtra por transferencia» | **Deudores** · He filtrado por Transferencia y genero el informe. |
| en «filter by caja principal» | en | `/reports/cierre-caja` | «filter by caja principal» | **Deudores** · Filtered by Caja Principal and generating the report. |
| en «in dollars» | en | `/reports/cierre-caja` | «in dollars» | **Deudores** · Filtered by USD and generating the report. |
| lo que no es ningún filtro lo dice | es | `/reports/deudores` | «filtrá por la caja fuerte» | **Deudores** · No encontré «la caja fuerte» en los filtros del reporte. |
| «sacá los filtros» pone todos en «todos» y genera | es | `/reports/deudores` | «sacá los filtros» | **Deudores** · Saqué los filtros y genero el reporte. |
| «qué cajas hay» lee las opciones | es | `/reports/deudores` | «qué cajas hay» | **Deudores** · Caja: Todas las cajas, Caja Principal, Caja Recepción Planta Alta, Caja Sede Carrasco. |
| el período sigue siendo el período | es | `/reports/deudores` | «el mes pasado» | **Deudores** · Período del 01/10/2026 al 31/10/2026; genero el reporte. |

