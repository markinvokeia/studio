# Órdenes de laboratorio

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/96-lab-orders.spec.ts`

Órdenes de laboratorio por lo que se ve: «la de Ana Gómez», «la primera», la orden abierta; abrir, mover de etapa (con confirmación), estado; cerrar; con backend de laboratorio simulado.

**26 frases** en **17 pruebas que pasan** (es 20 · es-ES 2 · en 4). Pantallas: `/`, `/lab-orders`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## LB · Por lo que se ve

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «abrí la de Juan Pérez» abre su orden | es | `/lab-orders` | «abrí la de Juan Pérez» | **Laboratorio** · Abrí la orden 46 de Juan Pérez. |
| «abrí la tercera» | es | `/lab-orders` | «abrí la tercera» | **Laboratorio** · Abrí la orden 47 de Ana Martínez. |
| «pasá la de Juan a recibida» la mueve | es | `/lab-orders` | «pasá la de Juan a recibida en clínica» | **Orden #46** · Decí «sí» para confirmar o «no» para dejarla como está. |
| 〃 | es | `/lab-orders` | «sí» | **Orden #46** · Ups, algo falló y no pude seguir con eso. No se cambió nada más. ¿Probamos de otra forma? Decime otra cosa o hacelo a mano. |
| «llegó la de Juan» | es | `/lab-orders` | «llegó la de Juan» | **Orden #46** · Decí «sí» para confirmar o «no» para dejarla como está. |
| 〃 | es | `/lab-orders` | «sí» | **Orden #46** · Ups, algo falló y no pude seguir con eso. No se cambió nada más. ¿Probamos de otra forma? Decime otra cosa o hacelo a mano. |
| «¿dónde está la de Juan?» dice la etapa | es | `/lab-orders` | «dónde está la de Juan» | Orden #46 |
| «la de Ana» con dos: pregunta cuál | es | `/lab-orders` | «dónde está la de Ana» | **Laboratorio** · ¿Cuál orden? [#45 Ana Gómez / #47 Ana Martínez] |
| 〃 | es | `/lab-orders` | «la segunda» | Orden #47 |
| con la orden abierta: «llegó» sin nombrar | es | `/lab-orders` | «abrí la de Juan» | **Laboratorio** · Abrí la orden 46 de Juan Pérez. |
| 〃 | es | `/lab-orders` | «ya llegó» | **Orden #46** · Decí «sí» para confirmar o «no» para dejarla como está. |
| 〃 | es | `/lab-orders` | «sí» | **Orden #46** · Ups, algo falló y no pude seguir con eso. No se cambió nada más. ¿Probamos de otra forma? Decime otra cosa o hacelo a mano. |
| «no» deja la orden como está | es | `/lab-orders` | «llegó la de Juan» | **Orden #46** · Decí «sí» para confirmar o «no» para dejarla como está. |
| 〃 | es | `/lab-orders` | «no» | **Orden #46** · Listo, no hice ningún cambio. |
| sin orden abierta ni nombre: no la inventa | es | `/lab-orders` | «ya llegó» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «la orden 45 se envió ayer» o «creá una orden para Ana Pérez, corona en la 36». |
| nombre que no está: lo dice | es | `/lab-orders` | «abrí la de Roberto» | **Laboratorio** · No encontré esa orden en la lista que se ve. |
| con número sigue igual: «la orden 46 llegó» | es | `/lab-orders` | «la orden 46 llegó» | **Orden #46** · Decí «sí» para confirmar o «no» para dejarla como está. |
| 〃 | es | `/lab-orders` | «sí» | **Orden #46** · Ups, algo falló y no pude seguir con eso. No se cambió nada más. ¿Probamos de otra forma? Decime otra cosa o hacelo a mano. |
| es-ES «abre la de Juan Pérez» | es-ES | `/lab-orders` | «abre la de Juan Pérez» | **Laboratorio** · He abierto la orden 46 de Juan Pérez. |
| en «open the one for Juan» y «it arrived» | en | `/lab-orders` | «open the one for Juan» | **Lab orders** · Opened order 46 for Juan Pérez. |
| 〃 | en | `/lab-orders` | «it arrived» | **Order #46** · Say “yes” to confirm or “no” to leave it as it is. |
| 〃 | en | `/lab-orders` | «yes» | **Order #46** · Oops, something failed and I couldn't go on with that. Nothing else was changed. Shall we try another way? Tell me something else or do it by hand. |

## LB-NAV · Llegar y seguir

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «andá a laboratorio y abrí la de Juan Pérez» | es | `/` | «andá a laboratorio y abrí la de Juan Pérez» | **Laboratorio** · Abrí la orden 46 de Juan Pérez. |

## LO-CLOSE · «cerrá» cierra la orden abierta

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «cerrá» | es | `/lab-orders` | «cerrá» | **Comando de voz** · Listo, cerré: el detalle. |
| es-ES «cierra el detalle» | es-ES | `/lab-orders` | «cierra el detalle» | **Comando de voz** · Listo, he cerrado: el detalle. |
| en «close it» | en | `/lab-orders` | «close it» | **Voice command** · Done, I closed: the details. |

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- LB-PARSE · Qué orden se nombró › «abrí la de Ana Gómez»
- LB-PARSE · Qué orden se nombró › «pasá la de Juan a recibida»
- LB-PARSE · Qué orden se nombró › «dónde está la de Juan Pérez»
- LB-PARSE · Qué orden se nombró › «la primera llegó»
- LB-PARSE · Qué orden se nombró › «mandá la orden de Dental Sur»
- LB-PARSE · Qué orden se nombró › «marcala como urgente»
- LB-PARSE · Qué orden se nombró › no: «la orden 45 llegó»
- LB-PARSE · Qué orden se nombró › no: «mostrame las de Ana»
- LB-PARSE · Qué orden se nombró › no: «creá una orden para Ana Gómez»
- LB-PARSE · Qué orden se nombró › no: «abrí la caja»
- LB-PARSE · Qué orden se nombró › no: «hola»
- LO-COLUMN · «mostrá la columna Laboratorio» es de la tabla, no la lista de órdenes › no: «mostrá la columna Laboratorio»
- LO-COLUMN · «mostrá la columna Laboratorio» es de la tabla, no la lista de órdenes › no: «ocultá la columna Laboratorio»
- LO-COLUMN · «mostrá la columna Laboratorio» es de la tabla, no la lista de órdenes › no: «show the Lab column»
- LO-COLUMN · «mostrá la columna Laboratorio» es de la tabla, no la lista de órdenes › sí: «mostrame las órdenes en el tablero»
- LO-COLUMN · «mostrá la columna Laboratorio» es de la tabla, no la lista de órdenes › sí: «mostrame las órdenes en columnas»
- LO-COLUMN · «mostrá la columna Laboratorio» es de la tabla, no la lista de órdenes › sí: «show the overdue orders»

