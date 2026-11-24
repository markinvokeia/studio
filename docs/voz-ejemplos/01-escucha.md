# Escucha y palabra «Invoke»

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/01-wake.spec.ts`

Escucha sin palabra de activación («Invoke» se tolera): cómo la transcribe el reconocedor, retomar y cancelar.

**0 frases** en **0 pruebas que pasan** (es 0 · es-ES 0 · en 0). Pantallas: —.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- VZ-WAKE · palabra de activación › despierta: «Invoke, andá al jueves»
- VZ-WAKE · palabra de activación › despierta: «invoke anda al jueves»
- VZ-WAKE · palabra de activación › despierta: «Inbox IA andá al jueves»
- VZ-WAKE · palabra de activación › despierta: «Inbox andá al jueves»
- VZ-WAKE · palabra de activación › despierta: «imbox zoom»
- VZ-WAKE · palabra de activación › despierta: «in voke vista semana»
- VZ-WAKE · palabra de activación › despierta: «in box vista semana»
- VZ-WAKE · palabra de activación › despierta: «Invoque, ¿qué tengo mañana?»
- VZ-WAKE · palabra de activación › despierta: «invoca hoy»
- VZ-WAKE · palabra de activación › despierta: «Envoke today»
- VZ-WAKE · palabra de activación › despierta: «hey invoke go to Thursday»
- VZ-WAKE · palabra de activación › despierta: «oye Invoke, actualizá»
- VZ-WAKE · palabra de activación › despierta: «ok inbook refresh»
- VZ-WAKE · palabra de activación › despierta: «Invoke»
- VZ-WAKE · palabra de activación › no despierta: «invoice Juan Pérez»
- VZ-WAKE · palabra de activación › no despierta: «pasá, sentate»
- VZ-WAKE · palabra de activación › no despierta: «importante llamar al laboratorio»
- VZ-WAKE · palabra de activación › no despierta: «y vos qué opinás»
- VZ-WAKE · palabra de activación › no despierta: «en la sala de espera»
- VZ-WAKE · palabra de activación › no despierta: «impresionante»
- VZ-WAKE · palabra de activación › no despierta: «bueno, invoke después lo vemos»
- VZ-WAKE · palabra de activación › restRaw conserva tildes: «Inbox IA, nota: Ana trae estudios»
- VZ-WAKE · palabra de activación › retomar y cancelar

