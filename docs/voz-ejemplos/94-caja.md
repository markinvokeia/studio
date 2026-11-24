# Caja

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/94-cashier.spec.ts`

Caja: ver y abrir cajas (una abierta por persona), efectivo/entradas/salidas/tarjeta/movimientos de la sesión, empezar el cierre, contar el efectivo por billetes y monedas (en cifras o palabras), todo en cero, último cierre, total; por moneda.

**32 frases** en **29 pruebas que pasan** (es 27 · es-ES 1 · en 4). Pantallas: `/`, `/cashier`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## CJ-POINTS · Cajas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «qué cajas hay» | es | `/cashier` | «qué cajas hay» | **Caja** · Hay 2 cajas; abiertas: Caja Recepción. |
| «abrí la caja principal» | es | `/cashier` | «abrí la caja principal» | **Caja** · Empiezo la apertura de Caja Principal. |
| «abrí la caja» con dos: pregunta cuál | es | `/cashier` | «abrí la caja» | **Caja** · ¿Qué caja? [Caja Principal / Caja Recepción] |
| 〃 | es | `/cashier` | «la segunda» | **Caja** · Abrí la sesión de Caja Recepción. |
| «entrá a la caja recepción» (abierta): muestra la sesión | es | `/cashier` | «entrá a la caja recepción» | **Caja** · Abrí la sesión de Caja Recepción. |
| con una propia abierta no deja abrir otra | es | `/cashier` | «abrí la caja principal» | **Caja** · Ya tenés abierta Caja Recepción: cerrala antes de abrir otra. |
| «cerrá la caja» sin sesión: lo dice (no navega) | es | `/cashier` | «cerrá la caja» | **Caja** · No hay una sesión de caja abierta a la vista. |
| en «open the register Caja Principal» | en | `/cashier` | «open the register caja principal» | **Cashier** · Starting to open Caja Principal. |

## CJ-SESSION · La sesión abierta

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cuánto hay en efectivo» | es | `/cashier` | «cuánto hay en efectivo» | **Caja** · En efectivo hay 12.500,00 UYU en Caja Principal. |
| «cuánto hay en caja» | es | `/cashier` | «cuánto hay en caja» | **Caja** · En efectivo hay 12.500,00 UYU en Caja Principal. |
| «cuánto entró» | es | `/cashier` | «cuánto entró» | **Caja** · Entró 18.000,00 UYU. |
| «las salidas» | es | `/cashier` | «las salidas» | **Caja** · Salió 2500,00 UYU. |
| «cuánto con tarjeta» | es | `/cashier` | «cuánto con tarjeta» | **Caja** · Con tarjeta: 6000,00 UYU. |
| «el último movimiento» | es | `/cashier` | «el último movimiento» | **Caja** · El último movimiento: +1500,00 UYU Efectivo · Juan Pérez. |
| «cuántos movimientos hay» | es | `/cashier` | «cuántos movimientos hay» | **Caja** · Hay 2 movimientos. |
| «hacé el cierre» | es | `/cashier` | «hacé el cierre» | **Caja** · Empiezo el cierre: revisá los movimientos y decime «siguiente». |
| «volvé a las cajas» | es | `/cashier` | «volvé a las cajas» | **Caja** · Muestro todas las cajas. |
| en «how much cash is there» y «start the closing» | en | `/cashier` | «how much cash is there» | **Cashier** · There is UYU 12,500.00 in cash at Caja Principal. |
| 〃 | en | `/cashier` | «start the closing» | **Cashier** · Starting the closing: review the movements and say “next”. |

## CJ-COUNT · Contar el efectivo

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «5 billetes de 1000, 3 de 500 y 2 monedas de 10» | es | `/cashier` | «5 billetes de 1000, 3 de 500 y 2 monedas de 10» | **Caja** · Cargué 5 × 1000, 3 × 500, 2 × 10. Total: 6520,00 UYU. |
| «cinco de mil» (en palabras) | es | `/cashier` | «cinco de mil» | **Caja** · Cargué 5 × 1000. Total: 5000,00 UYU. |
| «de 200 pongo 4» | es | `/cashier` | «de 200 pongo 4» | **Caja** · Cargué 4 × 200. Total: 800,00 UYU. |
| «todo en cero» | es | `/cashier` | «todo en cero» | **Caja** · Puse todo en cero (UYU). |
| «lo mismo que el último cierre» | es | `/cashier` | «lo mismo que el último cierre» | **Caja** · Cargué lo del último cierre: 12.000,00 UYU. |
| «cuánto da» | es | `/cashier` | «2 de 2000» | **Caja** · Cargué 2 × 2000. Total: 4000,00 UYU. |
| 〃 | es | `/cashier` | «cuánto da» | **Caja** · Contado: 4000,00 UYU (2 × 2000). |
| un billete que no existe: lo dice | es | `/cashier` | «3 billetes de 300» | **Caja** · No hay billetes ni monedas de 300 en UYU. |
| moneda sin denominaciones: «el total es 1500» | es | `/cashier` | «el total es 1500» | **Caja** · Total: 1500,00 US$. |
| dos contadores: «3 de 100 en dólares» va al de dólares | es | `/cashier` | «3 de 100 dólares» | **Caja** · Cargué 3 × 100. Total: 300,00 US$. |
| es-ES «pon todo a cero» no confunde | es-ES | `/cashier` | «todo a cero» | **Caja** · He puesto todo a cero (UYU). |
| en «five notes of 1000 and two of 500» | en | `/cashier` | «5 notes of 1000 and 2 of 500» | **Cashier** · Entered 5 × 1000, 2 × 500. Total: UYU 6,000.00. |

## CJ-NAV · Desde otra página

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «andá a la caja y decime qué cajas hay» | es | `/` | «andá a la caja y decime qué cajas hay» | **Caja** · Hay 2 cajas; abiertas: Caja Recepción. |

