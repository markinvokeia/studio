# Listas (Catálogo, Configuración, Sistema)

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/9a-crud.spec.ts`

Listas con la tabla común (Catálogo, Configuración del negocio, Sistema): crear con nombre («nuevo medicamento Diclofenac»), abrir por nombre o posición, contar, actualizar; el formulario con la voz genérica.

**46 frases** en **40 pruebas que pasan** (es 30 · es-ES 5 · en 11). Pantallas: `/`, `/clinic-catalog/measurement-units`, `/clinic-catalog/medications`, `/config/currencies`, `/config/doctors`, `/config/holidays`, `/config/sedes`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## LI-CREATE · Altas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «nuevo medicamento Diclofenac» abre el alta y escribe el nombre | es | `/clinic-catalog/medications` | «nuevo medicamento Diclofenac» | **Lista** · Abrí el alta y puse «Diclofenac» en Nombre. Completá lo que falta y decí «guardar». |
| «agregá un medicamento llamado Ácido Tranexámico» | es | `/clinic-catalog/medications` | «agregá un medicamento llamado Ácido Tranexámico» | **Lista** · Abrí el alta y puse «Ácido Tranexámico» en Nombre. Completá lo que falta y decí «guardar». |
| «nuevo medicamento» sin nombre: solo abre | es | `/clinic-catalog/medications` | «nuevo medicamento» | **Nuevo** · Se abrió «Nuevo». Decime qué completar (Nombre, Descripción…) o qué apretar: Guardar. [Guardar] |
| después, con la voz genérica: descripción y guardar | es | `/clinic-catalog/medications` | «nuevo medicamento Diclofenac» | **Lista** · Abrí el alta y puse «Diclofenac» en Nombre. Completá lo que falta y decí «guardar». |
| 〃 | es | `/clinic-catalog/medications` | «la descripción es antiinflamatorio» | **Pantalla** · Listo: «Descripción» = antiinflamatorio. |
| 〃 | es | `/clinic-catalog/medications` | «guardar» | **Pantalla** · Listo, apreté «Guardar». |
| en Sedes: «nueva sede Carrasco» | es | `/config/sedes` | «nueva sede Carrasco» | **Lista** · Abrí el alta y puse «Carrasco» en Nombre. Completá lo que falta y decí «guardar». |
| «nueva sede» en Medicamentos no es de esta lista | es | `/clinic-catalog/medications` | «nueva sede Carrasco» | **¿Te referís a…?** · No entendí «nueva sede Carrasco». ¿Te referís a ir a «Configuración de Negocio › Sedes»? Decí cuál, o «no». [ir a «Configuración de Negocio › Sedes»] |
| es-ES «añade un medicamento llamado Diclofenaco» | es-ES | `/clinic-catalog/medications` | «añade un medicamento llamado Diclofenaco» | **Lista** · He abierto el alta y he puesto «Diclofenaco» en Nombre. Completa lo que falta y di «guardar». |
| en «add a medication called Diclofenac» | en | `/clinic-catalog/medications` | «add a medication called Diclofenac» | **List** · Opened the new form and entered “Diclofenac” in Nombre. Fill in the rest and say “save”. |
| en «new medication Ibuprofen» | en | `/clinic-catalog/medications` | «new medication Ibuprofen» | **List** · Opened the new form and entered “Ibuprofen” in Nombre. Fill in the rest and say “save”. |
| en «create a new location Downtown» | en | `/config/sedes` | «create a location called Downtown» | **List** · Opened the new form and entered “Downtown” in Nombre. Fill in the rest and say “save”. |
| el botón de la tabla no dice qué crea: lo dice el menú («nuevo medicamento Ketorolac») | es | `/clinic-catalog/medications` | «nuevo medicamento Ketorolac» | **Lista** · Abrí el alta y puse «Ketorolac» en Nombre. Completá lo que falta y decí «guardar». |
| «nuevo Ibuprofeno» sin decir la cosa: el resto es el nombre | es | `/clinic-catalog/medications` | «nuevo Ibuprofeno» | **Lista** · Abrí el alta y puse «Ibuprofeno» en Nombre. Completá lo que falta y decí «guardar». |
| en plural o singular: «nueva unidad de medida Kilogramo» | es | `/clinic-catalog/measurement-units` | «nueva unidad de medida Kilogramo» | **Lista** · Abrí el alta y puse «Kilogramo» en Nombre. Completá lo que falta y decí «guardar». |
| «nuevo doctor Juan Pérez» en Doctores | es | `/config/doctors` | «nuevo doctor Juan Pérez» | **Lista** · Abrí el alta y puse «Juan Pérez» en Nombre. Completá lo que falta y decí «guardar». |
| es-ES «crea una moneda llamada Euro» | es-ES | `/config/currencies` | «crea una moneda llamada Euro» | **Lista** · He abierto el alta y he puesto «Euro» en Nombre. Completa lo que falta y di «guardar». |
| en «new location Downtown» on Medications is not this list | en | `/clinic-catalog/medications` | «new location Downtown» | **Did you mean…?** · I didn't understand “new location Downtown”. Did you mean go to “Business Setup › Branches”? Say which one, or “no”. [go to “Business Setup › Branches”] |

## LI-OPEN · Abrir, contar, actualizar

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «abrí la amoxicilina» | es | `/clinic-catalog/medications` | «abrí la amoxicilina» | **Lista** · Abrí Amoxicilina · 500 mg. |
| «editá el ibuprofeno» con dos: pregunta | es | `/clinic-catalog/medications` | «editá el ibuprofeno» | **Lista** · ¿Cuál? [Ibuprofeno · 400 mg / Ibuprofeno · 600 mg] |
| 〃 | es | `/clinic-catalog/medications` | «el de 600» | **Lista** · Abrí Ibuprofeno · 600 mg. |
| «abrí el último» | es | `/clinic-catalog/medications` | «abrí el último» | **Tabla** · Abrí Paracetamol · 1 g. |
| «abrí la sede Pocitos» | es | `/config/sedes` | «abrí la sede pocitos» | **Lista** · Abrí Pocitos · 21 de Setiembre 2900. |
| «cuántos hay» | es | `/clinic-catalog/medications` | «cuántos hay» | **Lista** · Hay 4 registros. |
| «actualizá la lista» | es | `/clinic-catalog/medications` | «actualizá la lista» | **Lista** · Actualizo la lista. |
| lo que no está no se abre | es | `/clinic-catalog/medications` | «abrí la morfina» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá a pacientes», «¿qué puedo hacer acá?» o «abrí la ficha de Ana Pérez». |
| «abrí el medicamento amoxicilina» (la cosa no se busca) | es | `/clinic-catalog/medications` | «abrí el medicamento amoxicilina» | **Lista** · Abrí Amoxicilina · 500 mg. |
| es-ES «abre la sede Centro» y «actualiza la tabla» | es-ES | `/config/sedes` | «abre la sede centro» | **Lista** · He abierto Centro · Av. Italia 123. |
| 〃 | es-ES | `/config/sedes` | «actualiza la tabla» | **Lista** · Actualizo la lista. |
| en «open the second one» y «refresh the list» | en | `/clinic-catalog/medications` | «open the second» | **Table** · Opened Amoxicilina · 500 mg. |
| 〃 | en | `/clinic-catalog/medications` | «refresh the list» | **List** · Refreshing the list. |
| en «open the location Pocitos» | en | `/config/sedes` | «open the location pocitos» | **List** · Opened Pocitos · 21 de Setiembre 2900. |
| en «open amoxicilina» y «how many are there» | en | `/clinic-catalog/medications` | «open amoxicilina» | **List** · Opened Amoxicilina · 500 mg. |
| 〃 | en | `/clinic-catalog/medications` | «how many are there» | **List** · There are 4 records. |

## LI-NAV · Llegar y crear

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «andá a medicamentos y agregá uno llamado Diclofenac» | es | `/` | «andá a medicamentos y agregá uno llamado Diclofenac» | **Lista** · Abrí el alta y puse «Diclofenac» en Nombre. Completá lo que falta y decí «guardar». |

## LI-BARE · Alta sin decir qué

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «nuevo» abre el alta | es | `/clinic-catalog/medications` | «nuevo» | **Nuevo** · Se abrió «Nuevo». Decime qué completar (Nombre, Descripción…) o qué apretar: Guardar. [Guardar] |
| es «crear uno» abre el alta | es | `/clinic-catalog/medications` | «crear uno» | **Nuevo** · Se abrió «Nuevo». Decime qué completar (Nombre, Descripción…) o qué apretar: Guardar. [Guardar] |
| es «agregá uno» abre el alta | es | `/clinic-catalog/medications` | «agregá uno» | **Nuevo** · Se abrió «Nuevo». Decime qué completar (Nombre, Descripción…) o qué apretar: Guardar. [Guardar] |
| es-ES «añade uno» abre el alta | es-ES | `/clinic-catalog/medications` | «añade uno» | **Nuevo** · Se ha abierto «Nuevo». Dime qué completar (Nombre, Descripción…) o qué pulsar: Guardar. [Guardar] |
| en «new» abre el alta | en | `/clinic-catalog/medications` | «new» | **Nuevo** · “Nuevo” is open. Tell me what to fill in (Nombre, Descripción…) or what to press: Guardar. [Guardar] |
| en «add one» abre el alta | en | `/clinic-catalog/medications` | «add one» | **Nuevo** · “Nuevo” is open. Tell me what to fill in (Nombre, Descripción…) or what to press: Guardar. [Guardar] |

## LI-PAGEBTN · El alta es un botón de la pantalla (no de la tabla)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «nuevo» aprieta «Crear» de la pantalla | es | `/config/holidays` | «nuevo» | **Lista** · Abrí el alta: decime los datos (por ejemplo «el nombre es …») y «guardar». |
| una lista de consulta (sin alta) lo dice | es | `/config/holidays` | «nuevo» | **Lista** · En esta lista no se pueden crear registros: es de consulta. |

## LI-OVERLAY · Con una ventana abierta, la tabla de atrás no se lleva lo dicho

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «agregá un artículo» con un presupuesto abierto aprieta «Agregar Artículo» (no crea en la lista) | es | `/clinic-catalog/medications` | «agregá un artículo» | **Comando de voz** · Listo, apreté «Agregar Artículo». |
| «nuevo» frente a un aviso que no crea nada (notificaciones): lo cierra y abre el alta | es | `/clinic-catalog/medications` | «nuevo» | **Nuevo** · Se abrió «Nuevo». Decime qué completar (Nombre, Descripción…) o qué apretar: Guardar. [Guardar] |
| «siguiente página» con una ventana abierta no mueve la lista de atrás | es | `/clinic-catalog/medications` | «siguiente página» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá a pacientes», «¿qué puedo hacer acá?» o «abrí la ficha de Ana Pérez». |

