# General: desplazarse y lo abierto primero

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/05-core-overlay.spec.ts`

Cualquier página: desplazarse, prioridad de la ventana o panel abierto (sus botones y campos), cambio de contexto que cierra lo abierto y suelta el foco.

**33 frases** en **29 pruebas que pasan** (es 24 · es-ES 0 · en 9). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## CO-SCROLL · Desplaza la pantalla

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «bajá» | es | `/appointments` | «bajá» | **Desplazar** · Bajé. |
| «subí un poco» | es | `/appointments` | «subí un poco» | **Desplazar** · Subí. |
| «hasta abajo» | es | `/appointments` | «hasta abajo» | **Desplazar** · Bajé. |
| «a la derecha» | es | `/appointments` | «a la derecha» | **Desplazar** · Me moví a la derecha. |
| «scroll down» | en | `/appointments` | «scroll down» | Scrolled down. |
| «scroll to the top» | en | `/appointments` | «scroll to the top» | Scrolled up. |
| desplazarse en medio de una pregunta no la cancela | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «bajá un poco» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «la segunda» | **Cita** · La cita de Ana Martínez, hoy a las 10:30. |

## CO-OVERLAY · Con una ventana abierta, lo dicho es primero para ella

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «editar» aprieta «Editar» | es | `/appointments` | «editar» | **Comando de voz** · Listo, apreté «Editar». |
| «apretá guardar» aprieta «Guardar» | es | `/appointments` | «apretá guardar» | **Comando de voz** · Listo, apreté «Guardar». |
| «dale a más opciones» aprieta «Más opciones» | es | `/appointments` | «dale a más opciones» | **Comando de voz** · Listo, apreté «Más opciones». |
| «tocá editar» aprieta «Editar» | es | `/appointments` | «tocá editar» | **Comando de voz** · Listo, apreté «Editar». |
| «hacé clic en guardar» aprieta «Guardar» | es | `/appointments` | «hacé clic en guardar» | **Comando de voz** · Listo, apreté «Guardar». |
| «edit» aprieta «Edit» | en | `/appointments` | «edit» | **Voice command** · Done, I pressed “Edit”. |
| «click save» aprieta «Save» | en | `/appointments` | «click save» | **Voice command** · Done, I pressed “Save”. |
| «press more options» aprieta «More options» | en | `/appointments` | «press more options» | **Voice command** · Done, I pressed “More options”. |
| «tap edit» aprieta «Edit» | en | `/appointments` | «tap edit» | **Voice command** · Done, I pressed “Edit”. |
| «poné en teléfono 099 123 456» completa «Teléfono» | es | `/appointments` | «poné en teléfono 099 123 456» | **Comando de voz** · Listo: «Teléfono» = 099 123 456. |
| «el email es ana@gmail.com» completa «Email» | es | `/appointments` | «el email es ana@gmail.com» | **Comando de voz** · Listo: «Email» = ana@gmail.com. |
| «escribí en notas Trae estudios» completa «Notas» | es | `/appointments` | «escribí en notas Trae estudios» | **Comando de voz** · Listo: «Notas» = Trae estudios. |
| «cambiá el teléfono a 098 765 432» completa «Teléfono» | es | `/appointments` | «cambiá el teléfono a 098 765 432» | **Comando de voz** · Listo: «Teléfono» = 098 765 432. |
| «notas: alérgico a la penicilina» completa «Notas» | es | `/appointments` | «notas: alérgico a la penicilina» | **Comando de voz** · Listo: «Notas» = alérgico a la penicilina. |
| «set phone to 099 123 456» completa «Phone» | en | `/appointments` | «set phone to 099 123 456» | **Voice command** · Done: “Phone” = 099 123 456. |
| «the email is ana@gmail.com» completa «Email» | en | `/appointments` | «the email is ana@gmail.com» | **Voice command** · Done: “Email” = ana@gmail.com. |
| «write in notes Bring X-rays» completa «Notes» | en | `/appointments` | «write in notes Bring X-rays» | **Voice command** · Done: “Notes” = Bring X-rays. |
| un pedido de otro contexto cierra la ventana y hace lo nuevo | es | `/appointments` | «vista día» | **Calendario** · Listo, vista de día. |
| seguir con el paciente de la ventana no la cierra («cuánto debe» con su cita en foco) | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «cuánto debe» | Información del paciente |
| desplazarse dentro de la ventana no la cierra | es | `/appointments` | «bajá» | **Desplazar** · Bajé. |

## CO-SCREEN · El contexto lo da la página, sin apagar el micrófono

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| al pasar a otra página cambian los comandos y el micrófono sigue prendido | es | `/appointments` | «vista día» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «la orden 45 se envió ayer» o «creá una orden para Ana Pérez, corona en la 36». |
| 〃 | es | `/appointments` | «vista día» | **Calendario** · Listo, vista de día. |
| lo general (desplazarse) funciona en cualquier página | es | `/appointments` | «bajá» | **Desplazar** · Bajé. |

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- CO-SCROLL · Qué es desplazarse › «bajá» → down normal
- CO-SCROLL · Qué es desplazarse › «subí» → up normal
- CO-SCROLL · Qué es desplazarse › «más abajo» → down normal
- CO-SCROLL · Qué es desplazarse › «más arriba» → up normal
- CO-SCROLL · Qué es desplazarse › «para abajo» → down normal
- CO-SCROLL · Qué es desplazarse › «hacia arriba» → up normal
- CO-SCROLL · Qué es desplazarse › «bajá un poco» → down little
- CO-SCROLL · Qué es desplazarse › «subí un poquito» → up little
- CO-SCROLL · Qué es desplazarse › «bajá un poco más rápido» → down more
- CO-SCROLL · Qué es desplazarse › «bajá mucho» → down more
- CO-SCROLL · Qué es desplazarse › «subí bastante» → up more
- CO-SCROLL · Qué es desplazarse › «bajá hasta abajo» → down edge
- CO-SCROLL · Qué es desplazarse › «subí hasta arriba» → up edge
- CO-SCROLL · Qué es desplazarse › «andá al final» → down edge
- CO-SCROLL · Qué es desplazarse › «al principio» → up edge
- CO-SCROLL · Qué es desplazarse › «hasta el fondo» → down edge
- CO-SCROLL · Qué es desplazarse › «movete a la izquierda» → left normal
- CO-SCROLL · Qué es desplazarse › «movete a la derecha» → right normal
- CO-SCROLL · Qué es desplazarse › «desplazate a la derecha un poco» → right little
- CO-SCROLL · Qué es desplazarse › «scrolleá para abajo» → down normal
- CO-SCROLL · Qué es desplazarse › «scroll down» → down normal
- CO-SCROLL · Qué es desplazarse › «scroll up» → up normal
- CO-SCROLL · Qué es desplazarse › «scroll down a lot» → down more
- CO-SCROLL · Qué es desplazarse › «scroll up a little» → up little
- CO-SCROLL · Qué es desplazarse › «go to the bottom» → down edge
- CO-SCROLL · Qué es desplazarse › «scroll to the top» → up edge
- CO-SCROLL · Qué es desplazarse › «move left» → left normal
- CO-SCROLL · Qué es desplazarse › «move right a bit» → right little
- CO-SCROLL · Qué es desplazarse › «scroll all the way down» → down edge
- CO-SCROLL · Qué es desplazarse › «down» → down normal
- CO-SCROLL · Qué es desplazarse › no es desplazarse: «bajá el zoom»
- CO-SCROLL · Qué es desplazarse › no es desplazarse: «subí el zoom»
- CO-SCROLL · Qué es desplazarse › no es desplazarse: «subí la altura de las horas»
- CO-SCROLL · Qué es desplazarse › no es desplazarse: «bajá la cita de Ana»
- CO-SCROLL · Qué es desplazarse › no es desplazarse: «pasá al sillón 2»
- CO-SCROLL · Qué es desplazarse › no es desplazarse: «andá a mañana»
- CO-SCROLL · Qué es desplazarse › no es desplazarse: «bajame la agenda a excel»

