# Micrófono permanente

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/02-mic.spec.ts`

Micrófono permanente: pausa blanda (no se oye a sí mismo, no reinicia), juntar los pedazos de una frase.

**0 frases** en **0 pruebas que pasan** (es 0 · es-ES 0 · en 0). Pantallas: —.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- MIC · Reconocimiento continuo con pausa blanda › MIC-001 pausa blanda: mientras habla el asistente no toma nada y NO reinicia el reconocimiento
- MIC · Reconocimiento continuo con pausa blanda › MIC-002 si el navegador corta la sesión, se reinicia enseguida
- MIC · Juntar los pedazos hasta la pausa › MIC-010 una frase cortada en dos por el navegador es un solo pedido
- MIC · Juntar los pedazos hasta la pausa › MIC-011 mientras se sigue hablando (resultados parciales) no se procesa
- MIC · Juntar los pedazos hasta la pausa › MIC-012 dos pedidos con una pausa larga en el medio son dos pedidos
- MIC · Juntar los pedazos hasta la pausa › MIC-013 lo que se está diciendo se ve en la tarjeta mientras se habla
- MIC · Juntar los pedazos hasta la pausa › MIC-014 con la voz del asistente silenciada, lo dicho justo después de un resultado no se pierde

