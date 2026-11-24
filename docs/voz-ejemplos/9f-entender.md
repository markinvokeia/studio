# Entender lo no dicho tal cual

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/9f-understanding.spec.ts`

Entender lo que no se dijo tal cual: «¿te referís a…?» con lo más parecido (botones, pestañas, interruptores, menú), la IA de la pantalla (n8n «screen») que arma los pasos con lo que se ve, el aviso al abrirse una ventana, «cerrá» lo último que se abrió y el cambio de contexto.

**40 frases** en **29 pruebas que pasan** (es 35 · es-ES 1 · en 4 · 4 contestadas por la IA simulada). Pantallas: `/config/sedes`, `/workspace`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## UN-SUGGEST · «¿Te referís a…?»

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «los mapas sincronizados» propone apretar «Sincronizar mapas» | es | `/config/sedes` | «los mapas sincronizados» | **¿Te referís a…?** · No entendí «los mapas sincronizados». ¿Te referís a apretar «Sincronizar mapas»? Decí cuál, o «no». [apretar «Sincronizar mapas»] |
| es «el listado para exportar» propone apretar «Exportar listado» | es | `/config/sedes` | «el listado para exportar» | **¿Te referís a…?** · No entendí «el listado para exportar». ¿Te referís a apretar «Exportar listado»? Decí cuál, o «no». [apretar «Exportar listado»] |
| es-ES «los mapas sincronizados» propone pulsar «Sincronizar mapas» | es-ES | `/config/sedes` | «los mapas sincronizados» | **¿Te refieres a…?** · No he entendido «los mapas sincronizados». ¿Te refieres a pulsar «Sincronizar mapas»? Di cuál, o «no». [pulsar «Sincronizar mapas»] |
| en «listado exportar please» propone press “Exportar listado” | en | `/config/sedes` | «listado exportar please» | **Did you mean…?** · I didn't understand “listado exportar please”. Did you mean press “Exportar listado”? Say which one, or “no”. [press “Exportar listado”] |
| elegir la propuesta la hace («la primera») | es | `/config/sedes` | «los mapas sincronizados» | **¿Te referís a…?** · No entendí «los mapas sincronizados». ¿Te referís a apretar «Sincronizar mapas»? Decí cuál, o «no». [apretar «Sincronizar mapas»] |
| 〃 | es | `/config/sedes` | «la primera» | **Pantalla** · Listo, apreté «Sincronizar mapas». |
| o por su nombre («sincronizar mapas») | es | `/config/sedes` | «los mapas sincronizados» | **¿Te referís a…?** · No entendí «los mapas sincronizados». ¿Te referís a apretar «Sincronizar mapas»? Decí cuál, o «no». [apretar «Sincronizar mapas»] |
| 〃 | es | `/config/sedes` | «sincronizar mapas» | **Pantalla** · Listo, apreté «Sincronizar mapas». |
| «no» no hace nada | es | `/config/sedes` | «los mapas sincronizados» | **¿Te referís a…?** · No entendí «los mapas sincronizados». ¿Te referís a apretar «Sincronizar mapas»? Decí cuál, o «no». [apretar «Sincronizar mapas»] |
| 〃 | es | `/config/sedes` | «no» | **¿Te referís a…?** · Listo, no hice ningún cambio. |
| «ninguna» no hace nada | es | `/config/sedes` | «los mapas sincronizados» | **¿Te referís a…?** · No entendí «los mapas sincronizados». ¿Te referís a apretar «Sincronizar mapas»? Decí cuál, o «no». [apretar «Sincronizar mapas»] |
| 〃 | es | `/config/sedes` | «ninguna» | **¿Te referís a…?** · Listo, no hice ningún cambio. |
| «no, nada que ver» no hace nada | es | `/config/sedes` | «los mapas sincronizados» | **¿Te referís a…?** · No entendí «los mapas sincronizados». ¿Te referís a apretar «Sincronizar mapas»? Decí cuál, o «no». [apretar «Sincronizar mapas»] |
| 〃 | es | `/config/sedes` | «no, nada que ver» | **¿Te referís a…?** · Listo, no hice ningún cambio. |
| «none of those» no hace nada | en | `/config/sedes` | «los mapas sincronizados» | **Did you mean…?** · I didn't understand “los mapas sincronizados”. Did you mean press “Sincronizar mapas”? Say which one, or “no”. [press “Sincronizar mapas”] |
| 〃 | en | `/config/sedes` | «none of those» | **Did you mean…?** · OK, I didn't change anything. |
| otro pedido sigue sin preguntar («exportar listado») | es | `/config/sedes` | «los mapas sincronizados» | **¿Te referís a…?** · No entendí «los mapas sincronizados». ¿Te referís a apretar «Sincronizar mapas»? Decí cuál, o «no». [apretar «Sincronizar mapas»] |
| 〃 | es | `/config/sedes` | «exportar listado» | **Pantalla** · Listo, apreté «Exportar listado». |
| lo que no se parece a nada: «no entendí» sin propuestas | es | `/config/sedes` | «qué lindo día hace hoy en la playa» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá a pacientes», «¿qué puedo hacer acá?» o «abrí la ficha de Ana Pérez». |

## UN-OVERLAY · Se abrió una ventana: se dice qué se le puede pedir

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| lo que se dice después va a la ventana («guardar») | es | `/config/sedes` | «el nombre es Sede Pocitos» | **Comando de voz** · Listo: «Nombre» = Sede Pocitos. |
| 〃 | es | `/config/sedes` | «guardar» | **Comando de voz** · Listo, apreté «Guardar». |
| «cerrá» cierra la ventana (lo último que se abrió) | es | `/config/sedes` | «cerrá» | **Nueva sede** · Se abrió «Nueva sede». Decime qué completar (Nombre…) o qué apretar: Guardar. [Guardar] |
| 〃 | es | `/config/sedes` | «cerrá» | **Comando de voz** · Listo, cerré: Nueva sede. |

## UN-AI · La IA de la pantalla (n8n «screen»): pasos y propuestas con lo que se ve

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| arma los pasos y los hace («dejame esto guardado con el nombre Sede Pocitos») | es | `/config/sedes` | «dejame esto guardado con el nombre Sede Pocitos» · IA | **Pantalla** · Listo, apreté «Guardar». |
| un control que no está en pantalla no se toca (lo descarta la validación) | es | `/config/sedes` | «quiero esto borrado del sistema» | **¿Te referís a…?** · No entendí «quiero esto borrado del sistema». ¿Te referís a ir a «Sistema»? Decí cuál, o «no». [ir a «Sistema»] |
| «que no mande los recordatorios» → desactiva el interruptor | es | `/config/sedes` | «que no mande los recordatorios» · IA | **Pantalla** · Listo, desactivé «Enviar recordatorios». |
| propuestas de la IA: se elige y se hace | es | `/config/sedes` | «no sé qué hacer con el nombre» · IA | **¿Te referís a…?** · ¿Te referís a apretar «Guardar» o apretar «Cancelar»? Decí cuál, o «no». [apretar «Guardar» / apretar «Cancelar»] |
| 〃 | es | `/config/sedes` | «la segunda» | **Pantalla** · Listo, apreté «Cancelar». |
| en inglés | en | `/config/sedes` | «get this stored with the name Downtown» · IA | **Screen** · Done, I pressed “Save”. |
| lo que está en las filas no viaja a la IA (pueden ser pacientes) | es | `/config/sedes` | «quiero los mapas al día ya mismo» | **No entendí el pedido** · No entendí qué hacer. Probá, por ejemplo: «andá a pacientes», «¿qué puedo hacer acá?» o «abrí la ficha de Ana Pérez». |

## UN-SWITCH · Con un aviso abierto, otro pedido es un cambio de contexto

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «andá a pacientes» cierra el aviso sin elegir y va | es | `/config/sedes` | «andá a pacientes» | **Menú** · Abro Pacientes. |
| «sí» sigue siendo la respuesta del aviso | es | `/config/sedes` | «sí» | **Atención** · Listo, apreté «Sí». |

## UN-NONAME · Una pregunta que no es de ninguna tarea no pregunta «¿Cambiamos de tarea?»

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| con «¿Te referís a…?» abierto, «andá a pacientes» va sin preguntar ni nombrar «» | es | `/config/sedes` | «los mapas sincronizados» | **¿Te referís a…?** · No entendí «los mapas sincronizados». ¿Te referís a apretar «Sincronizar mapas»? Decí cuál, o «no». [apretar «Sincronizar mapas»] |
| 〃 | es | `/config/sedes` | «andá a pacientes» | **Menú** · Abro Pacientes. |
| con la ventana recién abierta a mano, «andá a pacientes» va sin preguntar | es | `/config/sedes` | «andá a pacientes» | **Menú** · Abro Pacientes. |

## UN-VERBS · El verbo dicho con otra palabra («aplicá los cambios» → «Confirmar todo»)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «aplicá los cambios» → Confirmar todo | es | `/config/sedes` | «aplicá los cambios» | **Pantalla** · Listo, apreté «Confirmar todo». |
| «aceptá todo» → Confirmar todo | es | `/config/sedes` | «aceptá todo» | **Pantalla** · Listo, apreté «Confirmar todo». |
| «grabá» → Guardar | es | `/config/sedes` | «grabá» | **Pantalla** · Listo, apreté «Guardar». |
| «borrá esto» → Eliminar | es | `/config/sedes` | «borrá esto» | **Pantalla** · Listo, apreté «Eliminar». |

## UN-NAMED · Un botón de lo abierto que se llama así gana (la bandeja sobre el riel)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cobro rápido» con la bandeja abierta aprieta el de la notificación | es | `/workspace` | «cobro rápido» | **Comando de voz** · Listo, apreté «Cobro Rápido». |

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- UN-OVERLAY · Se abrió una ventana: se dice qué se le puede pedir › abierta a mano: el título, sus campos y sus botones
- UN-OVERLAY · Se abrió una ventana: se dice qué se le puede pedir › sin campos: ¿qué hago?
- UN-OVERLAY · Se abrió una ventana: se dice qué se le puede pedir › es-ES y en
- UN-OVERLAY2 · El aviso de ventana con los nombres de los campos y los botones de acción primero › etiquetas (no ejemplos) y Guardar/Cancelar antes que los demás

