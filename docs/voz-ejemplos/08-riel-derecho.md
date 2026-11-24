# Riel derecho (panel flotante)

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/08-rail.spec.ts`

Panel derecho desde cualquier página: ficha/historia/cuenta de un paciente, cobro rápido, sede, caja, pantalla de la sala, alertas, bandeja, tipo de cambio, notas, asistente, mostrar/ocultar el panel.

**67 frases** en **60 pruebas que pasan** (es 50 · es-ES 3 · en 14). Pantallas: `/`, `/appointments`, `/purchases/providers`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## RL-PATIENT · Abrir un paciente desde cualquier lado

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «abrí la ficha de Juan Pérez» → p2:info | es | `/` | «abrí la ficha de Juan Pérez» | **Panel derecho** · Abrí la ficha de Juan Pérez. |
| es «mostrame la historia de Carlos López» → p4:clinical | es | `/` | «mostrame la historia de Carlos López» | **Panel derecho** · Abrí la historia de Carlos López. |
| es «abrí la cuenta de Sofía Castro» → p9:financial | es | `/` | «abrí la cuenta de Sofía Castro» | **Panel derecho** · Abrí la cuenta de Sofía Castro. |
| es «buscá al paciente Roberto Díaz» → p8:- | es | `/` | «buscá al paciente Roberto Díaz» | **Panel derecho** · Abrí la ficha de Roberto Díaz. |
| es «abrí el estado de cuenta de María Rodríguez» → p5:financial | es | `/` | «abrí el estado de cuenta de María Rodríguez» | **Panel derecho** · Abrí la cuenta de María Rodríguez. |
| es «traeme los datos de Pedro Sánchez» → p7:info | es | `/` | «traeme los datos de Pedro Sánchez» | **Panel derecho** · Abrí la ficha de Pedro Sánchez. |
| es-ES «abre la ficha del paciente Juan Pérez» → p2:info | es-ES | `/` | «abre la ficha del paciente Juan Pérez» | **Panel derecho** · He abierto la ficha de Juan Pérez. |
| en «open patient Juan Pérez» → p2:- | en | `/` | «open patient Juan Pérez» | **Right panel** · Opened Juan Pérez’s record. |
| en «open Carlos López history» → p4:clinical | en | `/` | «open Carlos López history» | **Right panel** · Opened Carlos López’s history. |
| en «show me Sofía Castro's account» → p9:financial | en | `/` | «show me Sofía Castro's account» | **Right panel** · Opened Sofía Castro’s account. |
| en «find patient Roberto» → p8:- | en | `/` | «find patient Roberto» | **Right panel** · Opened Roberto Díaz’s record. |
| varios con el mismo nombre: pregunta cuál | es | `/` | «abrí la ficha de Ana» | **Panel derecho** · Encontré varios. ¿Cuál? [Ana Gómez / Ana Martínez] |
| 〃 | es | `/` | «Martínez» | **Panel derecho** · Abrí la ficha de Ana Martínez. |
| no existe: lo dice | es | `/` | «abrí la ficha de Zoe Zamora» | **Panel derecho** · No encontré a «Zoe Zamora» entre los pacientes. |

## RL-BILL · Cobro rápido

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| es «cobro rápido» | es | `/purchases/providers` | «cobro rápido» | **Panel derecho** · Abrí el cobro rápido. |
| es «abrí el cobro rápido» | es | `/purchases/providers` | «abrí el cobro rápido» | **Panel derecho** · Abrí el cobro rápido. |
| es «quiero cobrar» | es | `/purchases/providers` | «quiero cobrar» | **Panel derecho** · Abrí el cobro rápido. |
| es «cobrale a Juan Pérez» | es | `/purchases/providers` | «cobrale a Juan Pérez» | **Panel derecho** · Abrí el cobro rápido para Juan Pérez. |
| es «hacé un cobro rápido a Carlos López» | es | `/purchases/providers` | «hacé un cobro rápido a Carlos López» | **Panel derecho** · Abrí el cobro rápido para Carlos López. |
| es-ES «cóbrale a Sofía Castro» | es-ES | `/purchases/providers` | «cóbrale a Sofía Castro» | **Panel derecho** · He abierto el cobro rápido para Sofía Castro. |
| en «quick bill» | en | `/purchases/providers` | «quick bill» | **Right panel** · Opened quick billing. |
| en «charge Juan Pérez» | en | `/purchases/providers` | «charge Juan Pérez» | **Right panel** · Opened quick billing for Juan Pérez. |
| en «open quick billing for Roberto Díaz» | en | `/purchases/providers` | «open quick billing for Roberto Díaz» | **Right panel** · Opened quick billing for Roberto Díaz. |

## RL-SEDE · Sede de trabajo

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cambiá a la sede Pocitos» | es | `/` | «cambiá a la sede Pocitos» | **Panel derecho** · Listo, ahora trabajás en Pocitos. |
| «quiero trabajar en la sede pocitos» | es | `/` | «quiero trabajar en la sede pocitos» | **Panel derecho** · Listo, ahora trabajás en Pocitos. |
| «en qué sede estoy» | es | `/` | «en qué sede estoy» | **Panel derecho** · Estás trabajando en Centro. |
| «cambiá de sede» pregunta cuál | es | `/` | «cambiá de sede» | **Panel derecho** · ¿En qué sede? [Centro / Pocitos] |
| 〃 | es | `/` | «la segunda» | **Panel derecho** · Listo, ahora trabajás en Pocitos. |
| ya está en esa sede | es | `/` | «cambiá a la sede centro» | **Panel derecho** · Estás trabajando en Centro. |
| en «switch to the Pocitos location» | en | `/` | «switch to the location Pocitos» | **Right panel** · Done, you are now working at Pocitos. |

## RL-CASH · Caja

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «¿está abierta la caja?» cerrada | es | `/` | «está abierta la caja» | **Panel derecho** · La caja está cerrada. |
| «cuánto hay en caja» abierta dice los saldos | es | `/` | «cuánto hay en caja» | **Panel derecho** · La caja está abierta: 1500,00 UYU. |
| «abrí la caja» cerrada: lleva a Caja para abrirla | es | `/` | «abrí la caja» | **Panel derecho** · Te llevo a Caja para abrirla. |
| «abrí la caja» ya abierta: lo dice | es | `/` | «abrí la caja» | **Panel derecho** · La caja ya está abierta: 0. |
| «cerrá la caja» abierta: lleva al cierre | es | `/` | «cerrá la caja» | **Panel derecho** · Te llevo a Caja para hacer el cierre. |
| en «is the cash register open» | en | `/` | «is the cash register open» | **Right panel** · The cash register is closed. |

## RL-TV · Pantalla de la sala

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «pausá la tele» | es | `/` | «pausá la tele» | **Panel derecho** · Pausé la pantalla de la sala. |
| «apagá la pantalla de la sala» | es | `/` | «apagá la pantalla de la sala» | **Panel derecho** · Apagué la pantalla de la sala. |
| «poné las promociones» | es | `/` | «poné las promociones» | **Panel derecho** · Puse las promociones en la pantalla de la sala. |
| «abrí la pantalla tv» | es | `/` | «abrí la pantalla tv» | **Panel derecho** · Abrí la pantalla de la sala. |
| «prendé la tele» ya prendida: lo dice | es | `/` | «prendé la tele» | **Panel derecho** · La pantalla de la sala está prendida. |
| «llamá al siguiente paciente» con dos sillones pregunta | es | `/` | «llamá al siguiente paciente» | **Panel derecho** · ¿En qué consultorio? [Sillón 1 / Sillón 2] |
| 〃 | es | `/` | «el segundo» | **Panel derecho** · Llamé al siguiente paciente en Sillón 2. |
| «siguiente paciente en el sillón 1» | es | `/` | «siguiente paciente en el sillón 1» | **Panel derecho** · Llamé al siguiente paciente en Sillón 1. |
| apagada: no llama | es | `/` | «llamá al siguiente paciente» | **Panel derecho** · La pantalla de la sala está apagada: prendela primero. |
| en «turn off the tv» | en | `/` | «turn off the tv» | **Right panel** · Turned the waiting room screen off. |

## RL-INFO · Alertas, bandeja, tipo de cambio

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «tengo alertas» | es | `/` | «tengo alertas» | **Panel derecho** · Tenés 3 alertas pendientes; la más urgente es alta. |
| es-ES «cuántas alertas tengo» | es-ES | `/` | «cuántas alertas tengo» | **Panel derecho** · Tienes 3 alertas pendientes; la más urgente es alta. |
| «abrí las notificaciones» | es | `/` | «abrí las notificaciones» | **Panel derecho** · Abrí las notificaciones. |
| «tengo mensajes» sin nada | es | `/` | «tengo mensajes» | **Panel derecho** · No tenés notificaciones nuevas. |
| «a cuánto está el dólar» | es | `/` | «a cuánto está el dólar» | **Panel derecho** · El tipo de cambio de la caja es USD 39.50. |
| en «what is the exchange rate» | en | `/` | «what is the exchange rate» | **Right panel** · The cash register exchange rate is USD 39.50. |
| en «any alerts» | en | `/` | «any alerts» | **Right panel** · You have 3 pending alerts; the most urgent is high. |

## RL-NOTES · Notas

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «abrí las notas» | es | `/` | «abrí las notas» | **Panel derecho** · Abrí las notas. |
| «nueva nota: llamar al laboratorio el lunes» | es | `/` | «nueva nota: llamar al laboratorio el lunes» | **Panel derecho** · Anoté: llamar al laboratorio el lunes. |
| «anotá que diga comprar guantes» | es | `/` | «anotá que diga comprar guantes» | **Panel derecho** · Anoté: comprar guantes. |
| «agregá una nota» sin texto pregunta | es | `/` | «agregá una nota» | **Panel derecho** · ¿Qué anoto? |
| 〃 | es | `/` | «Pedir turno con el técnico» | **Panel derecho** · Anoté: Pedir turno con el técnico. |
| en «add a note saying call the lab» | en | `/` | «add a note saying call the lab» | **Right panel** · Noted: call the lab. |

## RL-PANEL · Panel derecho y asistente

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «escondé el panel derecho» y «mostrá el panel derecho» | es | `/` | «escondé el panel derecho» | **Panel derecho** · Escondí el panel derecho. |
| 〃 | es | `/` | «mostrá el panel derecho» | **Panel derecho** · Mostré el panel derecho. |
| en «hide the right panel» | en | `/` | «hide the right panel» | **Right panel** · Hid the right panel. |
| «despertá al asistente» aprieta el botón del asistente | es | `/` | «despertá al asistente» | **Panel derecho** · Abrí el asistente. |

## RL-PRIORITY · En la agenda gana la agenda

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cobrale» con la cita en foco es de la agenda (cobra esa cita) | es | `/appointments` | «la cita de Carlos» | **Cita** · La cita de Carlos López, hoy a las 15:00. |
| 〃 | es | `/appointments` | «cobrale» | **Cobro rápido** · Listo, abrí el cobro rápido de Carlos López. |
| «abrí la cuenta» con la cita en foco es la de ese paciente (agenda) | es | `/appointments` | «la cita de Carlos» | **Cita** · La cita de Carlos López, hoy a las 15:00. |
| 〃 | es | `/appointments` | «abrí la cuenta» | **Estado de cuenta** · Abrí Estado de cuenta de Carlos López. |

