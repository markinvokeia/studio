# Periodontograma · Comandos de voz

El dictado del sondaje se activa con **Dictar** (o escribiendo en la misma barra; `/` lleva el foco ahí). Cada frase se aplica apenas se termina de decir, sin esperar a apagar el micrófono. Se entienden **español e inglés** en cualquier idioma de la app.

Reglas generales:

- Los números van a la **línea activa** (profundidad, margen gingival o una línea de marcas) y la sonda avanza sola, en el mismo orden que con el teclado: superior vestibular 18→28, superior palatino 28→18, inferior vestibular 48→38, inferior lingual 38→48. Se saltean ausentes y pónticos.
- Mientras no se diga otra pieza u otra línea, se sigue llenando en secuencia.
- Lo dictado queda **subrayado en violeta** hasta decir «confirmar» (o tocar *Confirmar*). Para firmar el periodontograma no puede quedar nada dictado sin confirmar.
- Cada frase es un paso de *deshacer*.
- Los números se pueden decir en palabras («tres dos cuatro», «treinta y siete»). «324» se toma como tres sitios: 3, 2 y 4. Del 10 al 15 se toman como un solo valor.

Si una frase no se entiende, se manda a un respaldo con IA (`src/ai/flows/perio-dictation.ts`, Gemini por Genkit, ruta `/api/ai/perio-dictation`) que la reescribe en este mismo lenguaje; el intérprete la vuelve a leer y la barra muestra «IA». Necesita la clave de Google AI del servidor de Next (`GOOGLE_GENAI_API_KEY`); sin ella, la frase queda como «No entendí».

Con la configuración de la clínica en «Recesión negativa», en margen gingival «menos 2» es recesión de 2 mm y «2» es agrandamiento (se guarda igual que con la otra convención).

Lo que define el comportamiento está en `src/lib/perio/voice.ts` (qué se entiende) y `src/lib/perio/voice-engine.ts` (qué hace). La lista que ve el profesional está en `PerioRecord.voice.help` de `src/messages/*.json`. Si se cambia un comando, se cambian los tres.

## Valores

| Decir | Hace |
| --- | --- |
| «3 2 4» | Tres sitios seguidos en la línea activa |
| «menos 2» | Agrandamiento (margen gingival negativo) |
| «igual», «igual que antes» | El valor del examen anterior en ese sitio |
| «borrar» | Borra el último valor y vuelve a ese sitio |

## Moverse

| Decir | Hace |
| --- | --- |
| «siguiente», «anterior» | Pieza siguiente o anterior en la secuencia (en *Furcas y movilidad*, la pieza presente siguiente o anterior) |
| «diente 23», «pieza dos tres» | Va a la 23, en la cara actual |
| «38 lingual 3 2 4» | Pieza y cara, después los valores (distal, centro, mesial en orden de sondaje) |
| «vestibular», «lingual», «palatino» | Cambia de cara en la pieza actual |

## Líneas

Una línea es una fila del gráfico de una cara: **SS** (sangrado), **PS** (profundidad), **MG** (margen gingival) y **placa**. Si se dice solo la pieza, la cara es **palatina o lingual**.

| Decir | Hace |
| --- | --- |
| «SS 23» | Línea de sangrado de la 23, cara palatina |
| «SS vest», «SS ling», «SS lin» | Línea de sangrado en esa cara de la pieza actual |
| «SS 23 vest» | Línea de sangrado de la 23 vestibular |
| «PS 23 vest» | Profundidad de la 23 vestibular |
| «MG 16» | Margen gingival de la 16, cara palatina |
| «placa 23», «supuración 23» | Línea de placa o de supuración de la 23 |
| «sí», «no» (o 1 y 0) | En una línea de marcas: marca o deja limpio el sitio y avanza |

En una línea de marcas, «sangra» (en la línea SS) también cuenta como «sí». Nombrar una pieza sin línea («38 lingual …») vuelve a los valores.

## Marcas

Sin pieza, la marca va al **último sitio medido o elegido** (el que tiene el anillo punteado en el gráfico).

| Decir | Hace |
| --- | --- |
| «sangra» | Sangrado en el último sitio |
| «sangra distal», «sangra distal y mesial» | En esos sitios de la última pieza medida |
| «sangra 16 mesial» | En ese sitio de la 16 (cara actual) |
| «sangra 16» | En los tres sitios de la 16 (cara actual) |
| «supura …», «placa …» | Igual que «sangra» |
| «no sangra», «sin placa» | Quita la marca |

## Pasadas y vista

| Decir | Hace |
| --- | --- |
| «profundidad», «sondaje» | Pasada de profundidad y sangrado |
| «margen gingival», «definir margen gingival», «recesión» | Pasada de margen gingival |
| «furcas y movilidad», «ir a furcas y movilidad» | Pasada de furcas y movilidad |
| «movilidad 2», «46 movilidad 1» | Movilidad de la pieza actual o de la dicha (0 a 3) |
| «furca vestibular 2», «furca 2» | Grado de furca (0 a 3) de la entrada dicha o de la primera |
| «sonda superior», «arcada superior» | Muestra la arcada superior |
| «sonda inferior», «arcada inferior» | Muestra la arcada inferior |
| «ver ambas», «ver ambas sondas» | Muestra las dos arcadas |
| «sigue a la sonda» | Vuelve a mostrar la arcada donde está la sonda |

Si dentro de la misma frase se nombró una pieza, el cambio de pasada se queda en esa pieza: «46 vestibular recesión 1 0 1» carga el margen de la 46 vestibular.

## Edición

| Decir | Hace |
| --- | --- |
| «deshacer», «rehacer» | La última frase |
| «confirmar» | Deja firme todo lo dictado |
| «descartar» | Vuelve atrás todo lo dictado sin confirmar |
| «parar dictado» | Apaga el micrófono |

---

# Periodontal chart · Voice commands

Probing dictation starts with **Dictate** (or by typing in the same bar; `/` puts the focus there). Each phrase is applied as soon as it is said, without turning the microphone off. **Spanish and English** are both understood whatever the app's language.

General rules:

- Numbers go to the **active line** (depth, gingival margin or a line of marks) and the probe moves on by itself, in the same order as with the keyboard: upper buccal 18→28, upper palatal 28→18, lower buccal 48→38, lower lingual 38→48. Missing teeth and pontics are skipped.
- Until another tooth or line is said, it keeps filling in sequence.
- Dictated values stay **underlined in violet** until you say “confirm” (or tap *Confirm*). The chart cannot be signed while something dictated is unconfirmed.
- Each phrase is one *undo* step.
- Numbers can be said in words (“three two four”, “thirty-seven”). “324” is taken as three sites: 3, 2 and 4. 10 to 15 are taken as one value.

If a phrase is not understood, an AI fallback (`src/ai/flows/perio-dictation.ts`) rewrites it in this language and the parser reads it again; the bar shows “AI”. It needs the Google AI key of the Next server; without it the phrase stays “Not understood”.

## Values

| Say | Does |
| --- | --- |
| “3 2 4” | Three sites in a row on the active line |
| “minus 2” | Enlargement (negative gingival margin) |
| “same”, “same as before” | The previous exam's value at that site |
| “delete” | Deletes the last value and goes back to that site |

## Moving

| Say | Does |
| --- | --- |
| “next”, “previous” | Next or previous tooth in the sequence |
| “tooth 23” | Goes to 23, on the current face |
| “38 lingual 3 2 4” | Tooth and face, then the values |
| “buccal”, “lingual”, “palatal” | Changes face on the current tooth |

## Lines

| Say | Does |
| --- | --- |
| “SS 23” | Bleeding line of 23, palatal face |
| “SS buccal”, “SS lingual” | Bleeding line on that face of the current tooth |
| “PD 23 buccal” | Probing depth of 23, buccal |
| “MG 16” | Gingival margin of 16, palatal face |
| “plaque 23”, “suppuration 23” | Plaque or suppuration line of 23 |
| “yes”, “no” (or 1 and 0) | On a line of marks: marks or clears the site and moves on |

## Marks

| Say | Does |
| --- | --- |
| “bleeds” | Bleeding on the last site |
| “bleeds distal”, “bleeds distal and mesial” | On those sites of the last tooth measured |
| “bleeds 16 mesial” | On that site of 16 (current face) |
| “bleeds 16” | On the three sites of 16 (current face) |
| “suppurates …”, “plaque …” | Same as “bleeds” |
| “no bleeding” | Removes the mark |

## Passes and view

| Say | Does |
| --- | --- |
| “probing depth” | Depth and bleeding pass |
| “gingival margin”, “recession” | Gingival margin pass |
| “furcations and mobility” | Furcations and mobility pass |
| “mobility 2”, “46 mobility 1” | Mobility of the current tooth or of the one said (0 to 3) |
| “furcation buccal 2” | Furcation grade (0 to 3) |
| “upper arch”, “lower arch”, “both” | What the chart shows |
| “follow probe” | Back to showing the arch where the probe is |

## Editing

| Say | Does |
| --- | --- |
| “undo”, “redo” | The last phrase |
| “confirm” | Keeps everything dictated |
| “discard” | Reverts everything dictated and not confirmed |
| “stop dictation” | Turns the microphone off |
