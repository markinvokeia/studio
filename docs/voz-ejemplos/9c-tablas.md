# Tablas

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/9c-tables.spec.ts`

Tablas: buscar, filtro de la barra, exportar (pregunta el formato), páginas, cantidad por página, vista tabla/lista, columnas, ordenar, elegir el registro por posición, por columna o por ID/código, cerrar el detalle.

**128 frases** en **116 pruebas que pasan** (es 88 · es-ES 12 · en 28). Pantallas: `/clinic-catalog/medications`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## TB-PAGE · Páginas y cantidad por página

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «siguiente página» | es | `/clinic-catalog/medications` | «siguiente página» | **Tabla** · Página 2 de 3. |
| es «andá a la página siguiente» | es | `/clinic-catalog/medications` | «andá a la página siguiente» | **Tabla** · Página 2 de 3. |
| es «pasá a la próxima página» | es | `/clinic-catalog/medications` | «pasá a la próxima página» | **Tabla** · Página 2 de 3. |
| es «última página» | es | `/clinic-catalog/medications` | «última página» | **Tabla** · Página 3 de 3. |
| es «andá a la última página» | es | `/clinic-catalog/medications` | «andá a la última página» | **Tabla** · Página 3 de 3. |
| es «página 2» | es | `/clinic-catalog/medications` | «página 2» | **Tabla** · Página 2 de 3. |
| es «andá a la página dos» | es | `/clinic-catalog/medications` | «andá a la página dos» | **Tabla** · Página 2 de 3. |
| es-ES «ve a la página siguiente» | es-ES | `/clinic-catalog/medications` | «ve a la página siguiente» | **Tabla** · Página 2 de 3. |
| es-ES «última página» | es-ES | `/clinic-catalog/medications` | «última página» | **Tabla** · Página 3 de 3. |
| en «next page» | en | `/clinic-catalog/medications` | «next page» | **Table** · Page 2 of 3. |
| en «go to the last page» | en | `/clinic-catalog/medications` | «go to the last page» | **Table** · Page 3 of 3. |
| en «page 2» | en | `/clinic-catalog/medications` | «page 2» | **Table** · Page 2 of 3. |
| «página anterior» y «primera página» | es | `/clinic-catalog/medications` | «última página» | **Tabla** · Página 3 de 3. |
| 〃 | es | `/clinic-catalog/medications` | «página anterior» | **Tabla** · Página 2 de 3. |
| 〃 | es | `/clinic-catalog/medications` | «primera página» | **Tabla** · Página 1 de 3. |
| en la primera, «página anterior» lo dice | es | `/clinic-catalog/medications` | «página anterior» | **Tabla** · Ya estás en la primera página. |
| en la última, «siguiente página» lo dice | es | `/clinic-catalog/medications` | «última página» | **Tabla** · Página 3 de 3. |
| 〃 | es | `/clinic-catalog/medications` | «siguiente página» | **Tabla** · Ya estás en la última página. |
| «página 9» cuando hay 3 | es | `/clinic-catalog/medications` | «página 9» | **Tabla** · La lista tiene 3 páginas. |
| una sola página | es | `/clinic-catalog/medications` | «siguiente página» | **Tabla** · La lista tiene una sola página. |
| es «poné 50 por página» | es | `/clinic-catalog/medications` | «poné 50 por página» | **Tabla** · Muestro 50 por página. |
| es «mostrá 10 filas por página» | es | `/clinic-catalog/medications` | «mostrá 10 filas por página» | **Tabla** · Muestro 10 por página. |
| es «100 por página» | es | `/clinic-catalog/medications` | «100 por página» | **Tabla** · Muestro 100 por página. |
| es «mostrá de a cincuenta por página» | es | `/clinic-catalog/medications` | «mostrá de a cincuenta por página» | **Tabla** · Muestro 50 por página. |
| es «mostrá todos en una página» | es | `/clinic-catalog/medications` | «mostrá todos en una página» | **Tabla** · Muestro todos en una página. |
| es-ES «pon 25 por página» | es-ES | `/clinic-catalog/medications` | «pon 25 por página» | **Tabla** · Muestro 25 por página. |
| en «show 50 per page» | en | `/clinic-catalog/medications` | «show 50 per page» | **Table** · Showing 50 per page. |
| en «10 rows per page» | en | `/clinic-catalog/medications` | «10 rows per page» | **Table** · Showing 10 per page. |

## TB-VIEW · Vista tabla / lista

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «vista de lista» | es | `/clinic-catalog/medications` | «vista de lista» | **Tabla** · Vista de lista. |
| es «poné la vista de tabla» | es | `/clinic-catalog/medications` | «poné la vista de tabla» | **Tabla** · Vista de tabla. |
| es «mostralo como lista» | es | `/clinic-catalog/medications` | «mostralo como lista» | **Tabla** · Vista de lista. |
| es «modo tabla» | es | `/clinic-catalog/medications` | «modo tabla» | **Tabla** · Vista de tabla. |
| es-ES «cambia a vista de lista» | es-ES | `/clinic-catalog/medications` | «cambia a vista de lista» | **Tabla** · Vista de lista. |
| en «list view» | en | `/clinic-catalog/medications` | «list view» | **Table** · List view. |
| en «switch to table view» | en | `/clinic-catalog/medications` | «switch to table view» | Table view. |
| «lista» suelta no cambia la vista | es | `/clinic-catalog/medications` | «lista» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá a pacientes», «¿qué puedo hacer acá?» o «abrí la ficha de Ana Pérez». |

## TB-COL · Columnas y orden

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «ocultá la columna teléfono» | es | `/clinic-catalog/medications` | «ocultá la columna teléfono» | **Tabla** · Oculté la columna Teléfono. |
| es «sacá la columna detalle» | es | `/clinic-catalog/medications` | «sacá la columna detalle» | **Tabla** · Oculté la columna Detalle. |
| es «mostrá la columna teléfono» | es | `/clinic-catalog/medications` | «mostrá la columna teléfono» | **Tabla** · Muestro la columna Teléfono. |
| es-ES «oculta la columna teléfono» | es-ES | `/clinic-catalog/medications` | «oculta la columna teléfono» | **Tabla** · He ocultado la columna Teléfono. |
| en «hide the teléfono column» | en | `/clinic-catalog/medications` | «hide the teléfono column» | **Table** · Hid the Teléfono column. |
| en «show the detalle column» | en | `/clinic-catalog/medications` | «show the detalle column» | **Table** · Showing the Detalle column. |
| es «ordená por nombre» | es | `/clinic-catalog/medications` | «ordená por nombre» | **Tabla** · Ordené por Nombre, de menor a mayor. |
| es «ordená por nombre descendente» | es | `/clinic-catalog/medications` | «ordená por nombre descendente» | **Tabla** · Ordené por Nombre, de mayor a menor. |
| es «ordená por fecha de alta de mayor a menor» | es | `/clinic-catalog/medications` | «ordená por fecha de alta de mayor a menor» | **Tabla** · Ordené por Fecha de alta, de mayor a menor. |
| es «nombre de la z a la a» | es | `/clinic-catalog/medications` | «nombre de la z a la a» | **Tabla** · Ordené por Nombre, de mayor a menor. |
| es «ordená la lista por detalle ascendente» | es | `/clinic-catalog/medications` | «ordená la lista por detalle ascendente» | **Tabla** · Ordené por Detalle, de menor a mayor. |
| es-ES «ordena por nombre» | es-ES | `/clinic-catalog/medications` | «ordena por nombre» | **Tabla** · He ordenado por Nombre, de menor a mayor. |
| en «sort by nombre descending» | en | `/clinic-catalog/medications` | «sort by nombre descending» | **Table** · Sorted by Nombre, descending. |
| en «sort by fecha de alta» | en | `/clinic-catalog/medications` | «sort by fecha de alta» | **Table** · Sorted by Fecha de alta, ascending. |
| una columna que no se puede ocultar lo dice | es | `/clinic-catalog/medications` | «ocultá la columna fecha de alta» | **Tabla** · La columna Fecha de alta no se puede ocultar. |
| una columna por la que no se ordena lo dice | es | `/clinic-catalog/medications` | «ordená por teléfono» | **Tabla** · Por Teléfono no se puede ordenar. |
| «sacá el orden» | es | `/clinic-catalog/medications` | «ordená por nombre» | **Tabla** · Ordené por Nombre, de menor a mayor. |
| 〃 | es | `/clinic-catalog/medications` | «sacá el orden» | **Tabla** · Saqué el orden. |
| «qué columnas hay» | es | `/clinic-catalog/medications` | «qué columnas hay» | **Tabla** · Columnas: Nombre, Detalle, Teléfono, Fecha de alta. |
| en «which columns are there» | en | `/clinic-catalog/medications` | «which columns are there» | **Table** · Columns: Nombre, Detalle, Teléfono, Fecha de alta. |
| una columna que no existe no se toma | es | `/clinic-catalog/medications` | «ocultá la columna precio» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá a pacientes», «¿qué puedo hacer acá?» o «abrí la ficha de Ana Pérez». |

## TB-SEARCH · Buscar y filtrar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «buscá ibuprofeno» escribe y dice lo que sale | es | `/clinic-catalog/medications` | «buscá ibuprofeno» | **Tabla** · Busqué «ibuprofeno»: 2 resultados. |
| sin resultados | es | `/clinic-catalog/medications` | «buscá morfina» | **Tabla** · Busqué «morfina»: no hay resultados. |
| «borrá la búsqueda» | es | `/clinic-catalog/medications` | «buscá ibuprofeno» | **Tabla** · Busqué «ibuprofeno»: 2 resultados. |
| 〃 | es | `/clinic-catalog/medications` | «borrá la búsqueda» | **Tabla** · Borré la búsqueda. |
| es-ES «busca paracetamol» | es-ES | `/clinic-catalog/medications` | «busca paracetamol» | **Tabla** · He buscado «paracetamol»: 1 resultado. |
| en «search for amoxicilina» | en | `/clinic-catalog/medications` | «search for amoxicilina» | **Table** · Searched “amoxicilina”: 1 result. |
| es «solo las notas de crédito» | es | `/clinic-catalog/medications` | «solo las notas de crédito» | **Tabla** · Muestro Notas de crédito. |
| es «filtrá por facturas» | es | `/clinic-catalog/medications` | «filtrá por facturas» | **Tabla** · Muestro Facturas. |
| es «mostrá solo las facturas» | es | `/clinic-catalog/medications` | «mostrá solo las facturas» | **Tabla** · Muestro Facturas. |
| es «mostrá todas» | es | `/clinic-catalog/medications` | «mostrá todas» | **Tabla** · Muestro todos. |
| es-ES «filtra por notas de crédito» | es-ES | `/clinic-catalog/medications` | «filtra por notas de crédito» | **Tabla** · Muestro Notas de crédito. |
| en «only facturas» | en | `/clinic-catalog/medications` | «only facturas» | **Table** · Showing Facturas. |
| un filtro que la tabla no tiene no se toma | es | `/clinic-catalog/medications` | «solo los presupuestos» | **¿Te referís a…?** · No entendí «solo los presupuestos». ¿Te referís a ir a «Ventas › Presupuestos»? Decí cuál, o «no». [ir a «Ventas › Presupuestos»] |

## TB-KEYWORD · Al filtrar se escribe solo la palabra clave

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «filtrá los que se llaman ibuprofeno» | es | `/clinic-catalog/medications` | «filtrá los que se llaman ibuprofeno» | **Tabla** · Busqué «ibuprofeno»: 2 resultados. |
| es «filtrá por paracetamol» | es | `/clinic-catalog/medications` | «filtrá por paracetamol» | **Tabla** · Busqué «paracetamol»: 1 resultado. |
| es «buscá los medicamentos que contengan amoxicilina» | es | `/clinic-catalog/medications` | «buscá los medicamentos que contengan amoxicilina» | **Tabla** · Busqué «amoxicilina»: 1 resultado. |
| es «buscá el registro con el nombre Ibuprofeno» | es | `/clinic-catalog/medications` | «buscá el registro con el nombre Ibuprofeno» | **Tabla** · Busqué «Ibuprofeno»: 2 resultados. |
| es «filtrá la lista por los que tengan paracetamol» | es | `/clinic-catalog/medications` | «filtrá la lista por los que tengan paracetamol» | **Tabla** · Busqué «paracetamol»: 1 resultado. |
| es-ES «filtra los que tengan amoxicilina» | es-ES | `/clinic-catalog/medications` | «filtra los que tengan amoxicilina» | **Tabla** · He buscado «amoxicilina»: 1 resultado. |
| es-ES «busca los medicamentos llamados paracetamol» | es-ES | `/clinic-catalog/medications` | «busca los medicamentos llamados paracetamol» | **Tabla** · He buscado «paracetamol»: 1 resultado. |
| en «filter by the ones named paracetamol» | en | `/clinic-catalog/medications` | «filter by the ones named paracetamol» | **Table** · Searched “paracetamol”: 1 result. |
| en «search for records containing ibuprofeno» | en | `/clinic-catalog/medications` | «search for records containing ibuprofeno» | **Table** · Searched “ibuprofeno”: 2 results. |
| en «filter the medications called amoxicilina» | en | `/clinic-catalog/medications` | «filter the medications called amoxicilina» | **Table** · Searched “amoxicilina”: 1 result. |
| una opción del filtro sigue siendo el filtro («filtrá por facturas») | es | `/clinic-catalog/medications` | «filtrá por facturas» | **Tabla** · Muestro Facturas. |

## TB-ID · Elegir por ID o código

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «seleccioná el código MED-2» | es | `/clinic-catalog/medications` | «seleccioná el código MED-2» | **Tabla** · Abrí Amoxicilina · 500 mg. |
| es «abrí el de código med 3» | es | `/clinic-catalog/medications` | «abrí el de código med 3» | **Tabla** · Abrí Ibuprofeno · 600 mg. |
| es «el registro con id r4» | es | `/clinic-catalog/medications` | «el registro con id r4» | **Tabla** · Abrí Paracetamol · 1 g. |
| es-ES «abre el código MED-1» | es-ES | `/clinic-catalog/medications` | «abre el código MED-1» | **Tabla** · He abierto Ibuprofeno · 400 mg. |
| en «open the one with code med 4» | en | `/clinic-catalog/medications` | «open the one with code med 4» | **Table** · Opened Paracetamol · 1 g. |
| en «select id r2» | en | `/clinic-catalog/medications` | «select id r2» | **Table** · Opened Amoxicilina · 500 mg. |
| si no está en la página lo busca, y si no aparece lo dice | es | `/clinic-catalog/medications` | «abrí el código MED-9» | **Tabla** · No encontré un registro con «MED-9». |

## TB-ROW · Elegir el registro

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «seleccioná el 3» | es | `/clinic-catalog/medications` | «seleccioná el 3» | **Tabla** · Abrí Ibuprofeno · 600 mg. |
| es «abrí el registro 2» | es | `/clinic-catalog/medications` | «abrí el registro 2» | **Tabla** · Abrí Amoxicilina · 500 mg. |
| es «seleccioná la fila número 4» | es | `/clinic-catalog/medications` | «seleccioná la fila número 4» | **Tabla** · Abrí Paracetamol · 1 g. |
| es «abrí el tercero» | es | `/clinic-catalog/medications` | «abrí el tercero» | **Tabla** · Abrí Ibuprofeno · 600 mg. |
| es «seleccioná el último» | es | `/clinic-catalog/medications` | «seleccioná el último» | **Tabla** · Abrí Paracetamol · 1 g. |
| es «el primero» | es | `/clinic-catalog/medications` | «el primero» | **Tabla** · Abrí Ibuprofeno · 400 mg. |
| es «abrí el registro tres» | es | `/clinic-catalog/medications` | «abrí el registro tres» | **Tabla** · Abrí Ibuprofeno · 600 mg. |
| es-ES «selecciona el 2» | es-ES | `/clinic-catalog/medications` | «selecciona el 2» | **Tabla** · He abierto Amoxicilina · 500 mg. |
| en «select row 3» | en | `/clinic-catalog/medications` | «select row 3» | **Table** · Opened Ibuprofeno · 600 mg. |
| en «open the second one» | en | `/clinic-catalog/medications` | «open the second one» | **Table** · Opened Amoxicilina · 500 mg. |
| un número que no está lo dice | es | `/clinic-catalog/medications` | «seleccioná el 15» | **Tabla** · No hay un registro 15 en lo que se ve (hay 4). |
| es «abrí el que tiene teléfono 093552000» | es | `/clinic-catalog/medications` | «abrí el que tiene teléfono 093552000» | **Tabla** · Abrí Ibuprofeno · 600 mg. |
| es «seleccioná el registro con detalle 600 mg» | es | `/clinic-catalog/medications` | «seleccioná el registro con detalle 600 mg» | **Tabla** · Abrí Ibuprofeno · 600 mg. |
| es «abrí el que tiene fecha de alta 02/03/2026» | es | `/clinic-catalog/medications` | «abrí el que tiene fecha de alta 02/03/2026» | **Tabla** · Abrí Amoxicilina · 500 mg. |
| en «open the one with teléfono 094553000» | en | `/clinic-catalog/medications` | «open the one with teléfono 094553000» | **Table** · Opened Paracetamol · 1 g. |
| por columna con varios: pregunta | es | `/clinic-catalog/medications` | «abrí el que tiene nombre ibuprofeno» | **Tabla** · ¿Cuál? [Ibuprofeno · 400 mg / Ibuprofeno · 600 mg] |
| 〃 | es | `/clinic-catalog/medications` | «el segundo» | **Tabla** · Abrí Ibuprofeno · 600 mg. |
| «cerrá el detalle» suelta el registro | es | `/clinic-catalog/medications` | «seleccioná el 2» | **Tabla** · Abrí Amoxicilina · 500 mg. |
| 〃 | es | `/clinic-catalog/medications` | «cerrá el detalle» | **Comando de voz** · Listo, cerré: el detalle. |
| en «back to the list» | en | `/clinic-catalog/medications` | «select row 2» | **Table** · Opened Amoxicilina · 500 mg. |
| 〃 | en | `/clinic-catalog/medications` | «back to the list» | **Table** · Closed the detail. |
| con la tabla recargándose (recién borrada la búsqueda) espera sus filas | es | `/clinic-catalog/medications` | «seleccioná el 1» | **Tabla** · Abrí Ibuprofeno · 400 mg. |
| una tabla que no abre sola: aprieta «Editar» de esa fila | es | `/clinic-catalog/medications` | «seleccioná el 2» | **Tabla** · Abrí Amoxicilina · 500 mg. |
| con «Ver» y «Editar», «Ver» primero | en | `/clinic-catalog/medications` | «select row 1» | **Table** · Opened Ibuprofeno · 400 mg. |
| por el código, en una tabla que no abre sola | es | `/clinic-catalog/medications` | «seleccioná el código MED-3» | **Tabla** · Abrí Ibuprofeno · 600 mg. |
| filas sin cómo abrirse: lo dice (no «no hay registros») | es | `/clinic-catalog/medications` | «seleccioná el 1» | **Tabla** · Las filas de esta tabla no se abren: probá con lo que tiene cada una (por ejemplo «editá…»). |
| una tabla que sigue vacía lo dice | es | `/clinic-catalog/medications` | «seleccioná el 1» | **Tabla** · No hay registros para elegir. |

## TB-EXPORT · Exportar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| con la ventana de exportar abierta: «exportá a CSV» | es | `/clinic-catalog/medications` | «exportá a CSV» | **Tabla** · Exporto en CSV. |
| sin decir el formato: pregunta | es | `/clinic-catalog/medications` | «exportá» | **Tabla** · ¿En qué formato? Excel, CSV. [Excel / CSV] |
| 〃 | es | `/clinic-catalog/medications` | «Excel» | **Tabla** · Exporto en Excel. |
| PDF no está: pregunta entre los que hay | es | `/clinic-catalog/medications` | «exportá a PDF» | **Tabla** · En PDF no se puede: ¿en cuál? Excel, CSV. [Excel / CSV] |
| en «export to excel» | en | `/clinic-catalog/medications` | «export to excel» | **Table** · Exporting as Excel. |
| sin nada para exportar lo dice | es | `/clinic-catalog/medications` | «exportá a Excel» | **Tabla** · Acá no hay para exportar. |

## TB-LAYER · La tabla de arriba primero

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| con dos tablas (lista y la de una pestaña del detalle), «siguiente página» va a la de arriba | es | `/clinic-catalog/medications` | «seleccioná el 2» | **Tabla** · Abrí Amoxicilina · 500 mg. |

## TB-HELP · Después de «¿qué puedo hacer acá?»

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| un pedido nuevo se hace sin preguntar si cambiamos de tarea | es | `/clinic-catalog/medications` | «qué puedo hacer acá» | **Pantalla** · Acá podés: Crear, Refrescar. ¿Qué querés hacer? En la tabla también: «buscá…», «ordená por…», «siguiente página», «50 por página», «ocultá la columna…», «seleccioná el 3», «exportá a Excel». [Crear / Refrescar] |
| 〃 | es | `/clinic-catalog/medications` | «ordená por nombre» | **Tabla** · Ordené por Nombre, de menor a mayor. |
| «ordená por …» no se toma como elegir «Nueva orden» del menú de ayuda | es | `/clinic-catalog/medications` | «qué puedo hacer acá» | **Pantalla** · Acá podés: Nueva orden, Tablero. ¿Qué querés hacer? En la tabla también: «buscá…», «ordená por…», «siguiente página», «50 por página», «ocultá la columna…», «seleccioná el 3», «exportá a Excel». [Nueva orden / Tablero] |
| 〃 | es | `/clinic-catalog/medications` | «ordená por nombre descendente» | **Tabla** · Ordené por Nombre, de mayor a menor. |
| en «sort by nombre descending» con el menú de ayuda abierto | en | `/clinic-catalog/medications` | «what can I do here» | **Screen** · Here you can: New order, Board. What do you want to do? In the table too: “search…”, “sort by…”, “next page”, “50 per page”, “hide the … column”, “select row 3”, “export to Excel”. [New order / Board] |
| 〃 | en | `/clinic-catalog/medications` | «sort by nombre descending» | **Table** · Sorted by Nombre, descending. |

