# Periodontograma

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/97-perio.spec.ts`

Periodontograma con el botón único: con el examen abierto lo dicho va a su dictado (sin cerrar la ventana); navegar, desplazarse y dejar de escuchar siguen generales; un solo micrófono a la vez.

**15 frases** en **14 pruebas que pasan** (es 13 · es-ES 0 · en 2). Pantallas: `/patients`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## PE-ROUTE · Lo dicho va al dictado del periodontograma

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «3 2 3» | es | `/patients` | «3 2 3» | **Periodontograma** · Al periodontograma: «3 2 3». |
| «sangrado en la 16» | es | `/patients` | «sangrado en la 16» | **Periodontograma** · Al periodontograma: «sangrado en la 16». |
| «siguiente diente» | es | `/patients` | «siguiente diente» | **Periodontograma** · Al periodontograma: «siguiente diente». |
| «vestibular del 26 4 3 5» | es | `/patients` | «vestibular del 26 4 3 5» | **Periodontograma** · Al periodontograma: «vestibular del 26 4 3 5». |
| «supuración» | es | `/patients` | «supuración» | **Periodontograma** · Al periodontograma: «supuración». |
| «terminé» | es | `/patients` | «terminé» | **Periodontograma** · Al periodontograma: «terminé». |
| «la 18 no está» | es | `/patients` | «la 18 no está» | **Periodontograma** · Al periodontograma: «la 18 no está». |
| «copiá el examen anterior» | es | `/patients` | «copiá el examen anterior» | **Periodontograma** · Al periodontograma: «copiá el examen anterior». |
| no cierra la ventana del examen ni aprieta sus botones | es | `/patients` | «guardar» | **Periodontograma** · Al periodontograma: «guardar». |
| en «three two three» y «bleeding on 16» | en | `/patients` | «three two three» | **Periodontal chart** · To the periodontal chart: “three two three”. |
| 〃 | en | `/patients` | «bleeding on 16» | **Periodontal chart** · To the periodontal chart: “bleeding on 16”. |

## PE-GENERAL · Lo general sigue siendo general

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «andá a la agenda» navega | es | `/patients` | «andá a la agenda» | **Menú** · Abro Citas. |
| «bajá» desplaza | es | `/patients` | «bajá un poco» | **Desplazar** · Bajé. |
| «dejá de escuchar» apaga el micrófono | es | `/patients` | «dejá de escuchar» | **Comando de voz** · Listo, dejé de escuchar. Tocá Voz cuando me necesites. |
| sin examen abierto no se dicta nada | es | `/patients` | «3 2 3» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «buscá a Juan Pérez», «solo los deudores», «nueva sesión» o «¿cuánto debe?». |

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- PE-MIC · Un solo micrófono a la vez › el dictado propio pide prestado el micrófono y lo devuelve
- PE-MIC · Un solo micrófono a la vez › si el botón Voz estaba apagado, no lo prende al devolver
- PE-MIC · Un solo micrófono a la vez › prender el botón Voz avisa (para apagar el dictado propio)

