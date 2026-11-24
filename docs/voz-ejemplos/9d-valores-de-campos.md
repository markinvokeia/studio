# Valores de los campos

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/9d-field-values.spec.ts`

Lo dicho como lo espera cada campo: horas («las 9 y media» → 09:30), fechas, números («mil quinientos», «3 coma 5») y colores («rojo»).

**0 frases** en **0 pruebas que pasan** (es 0 · es-ES 0 · en 0). Pantallas: —.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- FV-NUM · Números › «veinte» → 20
- FV-NUM · Números › «veintidós» → 22
- FV-NUM · Números › «ciento cincuenta» → 150
- FV-NUM · Números › «mil quinientos» → 1500
- FV-NUM · Números › «dos mil trescientos cuarenta» → 2340
- FV-NUM · Números › «1.500» → 1500
- FV-NUM · Números › «1500» → 1500
- FV-NUM · Números › «3 coma 5» → 3.5
- FV-NUM · Números › «tres coma cinco» → 3.5
- FV-NUM · Números › «12,5» → 12.5
- FV-NUM · Números › «quince por ciento» → 15
- FV-NUM · Números › «twenty five» → 25
- FV-NUM · Números › «two thousand» → 2000
- FV-NUM · Números › «one hundred» → 100
- FV-NUM · Números › «three point five» → 3.5
- FV-NUM · Números › lo que no es número: null
- FV-NUM · Números › campo numérico
- FV-NUM · Números › con la unidad: «5 días» → 5, «400 mg» → 400
- FV-NUM · Números › campo de texto: tal cual
- FV-TIME · Horas › «las 9 y media» → 09:30
- FV-TIME · Horas › «a las 14» → 14:00
- FV-TIME · Horas › «8:15» → 08:15
- FV-TIME · Horas › «las 3 de la tarde» → 15:00
- FV-TIME · Horas › «mediodía» → 12:00
- FV-TIME · Horas › «nueve y cuarto» → 09:15
- FV-DATE · Fechas › campo date: yyyy-mm-dd
- FV-DATE · Fechas › campo de texto dd/mm/aaaa
- FV-DATE · Fechas › «mañana»
- FV-COLOR · Colores › «rojo» → #ef4444
- FV-COLOR · Colores › «azul oscuro» → #3b82f6
- FV-COLOR · Colores › «el color verde» → #22c55e
- FV-COLOR · Colores › «#3366FF» → #3366ff
- FV-COLOR · Colores › «purple» → #8b5cf6
- FV-COLOR · Colores › campo color
- FV-COLOR · Colores › la caja del código del color (#…): «rojo» → #ef4444

