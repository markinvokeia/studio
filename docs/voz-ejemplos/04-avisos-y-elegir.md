# Avisos y ventanas: elegir

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/04-popups-selection.spec.ts`

Avisos y ventanas: elegir por número, posición («la última», «la de abajo»), hora o texto; apretar botones por nombre; sí/no.

**201 frases** en **169 pruebas que pasan** (es 103 · es-ES 0 · en 98). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## PU-ES · Avisos de la agenda

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «citas futuras del paciente»: decir «No» aprieta ese botón | es | `/appointments` | «No» | **Atención** · Listo, apreté «No». |
| «citas futuras del paciente»: decir «Sí» aprieta ese botón | es | `/appointments` | «Sí» | **Atención** · Listo, apreté «Sí». |
| «citas futuras del paciente»: «sí» aprieta el principal | es | `/appointments` | «sí» | **Atención** · Listo, apreté «Sí». |
| «citas futuras del paciente»: «no» aprieta el de volver/cancelar | es | `/appointments` | «no» | **Atención** · Listo, apreté «No». |
| «citas futuras del paciente»: «el segundo» por posición | es | `/appointments` | «el segundo» | **Atención** · Listo, apreté «Sí». |
| «eliminar cita»: decir «Cancelar» aprieta ese botón | es | `/appointments` | «Cancelar» | **Eliminar cita** · Listo, apreté «Cancelar». |
| «eliminar cita»: decir «Sí, eliminar» aprieta ese botón | es | `/appointments` | «Sí, eliminar» | **Eliminar cita** · Listo, apreté «Sí, eliminar». |
| «eliminar cita»: «sí» aprieta el principal | es | `/appointments` | «sí» | **Eliminar cita** · Listo, apreté «Sí, eliminar». |
| «eliminar cita»: «no» aprieta el de volver/cancelar | es | `/appointments` | «no» | **Eliminar cita** · Listo, apreté «Cancelar». |
| «eliminar cita»: «el segundo» por posición | es | `/appointments` | «el segundo» | **Eliminar cita** · Listo, apreté «Sí, eliminar». |
| «cancelar cita»: decir «Cerrar» aprieta ese botón | es | `/appointments` | «Cerrar» | **Cancelar Cita** · Listo, apreté «Cerrar». |
| «cancelar cita»: decir «Cancelar» aprieta ese botón | es | `/appointments` | «Cancelar» | **Cancelar Cita** · Listo, apreté «Cancelar». |
| «cancelar cita»: «sí» aprieta el principal | es | `/appointments` | «sí» | **Cancelar Cita** · Listo, apreté «Cancelar». |
| «cancelar cita»: «no» aprieta el de volver/cancelar | es | `/appointments` | «no» | **Cancelar Cita** · Listo, apreté «Cerrar». |
| «cancelar cita»: «el segundo» por posición | es | `/appointments` | «el segundo» | **Cancelar Cita** · Listo, apreté «Cancelar». |
| «descartar cambios»: decir «Seguir editando» aprieta ese botón | es | `/appointments` | «Seguir editando» | **¿Descartar cambios?** · Listo, apreté «Seguir editando». |
| «descartar cambios»: decir «Descartar cambios» aprieta ese botón | es | `/appointments` | «Descartar cambios» | **¿Descartar cambios?** · Listo, apreté «Descartar cambios». |
| «descartar cambios»: «sí» aprieta el principal | es | `/appointments` | «sí» | **¿Descartar cambios?** · Listo, apreté «Descartar cambios». |
| «descartar cambios»: «no» aprieta el de volver/cancelar | es | `/appointments` | «no» | **¿Descartar cambios?** · Listo, apreté «Seguir editando». |
| «descartar cambios»: «el segundo» por posición | es | `/appointments` | «el segundo» | **¿Descartar cambios?** · Listo, apreté «Descartar cambios». |
| «falta el documento»: decir «Cerrar» aprieta ese botón | es | `/appointments` | «Cerrar» | **Falta el documento de identidad** · Listo, apreté «Cerrar». |
| «falta el documento»: decir «Entendido» aprieta ese botón | es | `/appointments` | «Entendido» | **Falta el documento de identidad** · Listo, apreté «Entendido». |
| «falta el documento»: «sí» aprieta el principal | es | `/appointments` | «sí» | **Falta el documento de identidad** · Listo, apreté «Entendido». |
| «falta el documento»: «no» aprieta el de volver/cancelar | es | `/appointments` | «no» | **Falta el documento de identidad** · Listo, apreté «Cerrar». |
| «falta el documento»: «el segundo» por posición | es | `/appointments` | «el segundo» | **Falta el documento de identidad** · Listo, apreté «Entendido». |
| «motivo de la cancelación»: decir «Volver» aprieta ese botón | es | `/appointments` | «Volver» | **Motivo de la cancelación** · Listo, apreté «Volver». |
| «motivo de la cancelación»: decir «Cancelar cita» aprieta ese botón | es | `/appointments` | «Cancelar cita» | **Motivo de la cancelación** · Listo, apreté «Cancelar cita». |
| «motivo de la cancelación»: «sí» aprieta el principal | es | `/appointments` | «sí» | **Motivo de la cancelación** · Listo, apreté «Cancelar cita». |
| «motivo de la cancelación»: «no» aprieta el de volver/cancelar | es | `/appointments` | «no» | **Motivo de la cancelación** · Listo, apreté «Volver». |
| «motivo de la cancelación»: «el segundo» por posición | es | `/appointments` | «el segundo» | **Motivo de la cancelación** · Listo, apreté «Cancelar cita». |
| si el aviso se cierra con el mouse, la pregunta se va y vuelve la que había | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| una respuesta que no es ningún botón vuelve a preguntar | es | `/appointments` | «qué lindo día» | **Eliminar cita** · No entendí qué botón. ¿Cancelar o Sí, eliminar? [Cancelar / Sí, eliminar] |
| 〃 | es | `/appointments` | «sí» | **Eliminar cita** · Listo, apreté «Sí, eliminar». |
| aviso de elegir y confirmar (alcance de un recordatorio): pregunta dos veces | es | `/appointments` | «Toda la serie» | **Recordatorio** · ¿Qué hago? Solo esta ocurrencia o Toda la serie o Continuar. [Solo esta ocurrencia / Toda la serie / Continuar] |
| 〃 | es | `/appointments` | «Continuar» | **Recordatorio** · Listo, apreté «Continuar». |

## PU-ES · Ventanas y paneles laterales

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «Estado de cuenta» + «cerrá» la cierra | es | `/appointments` | «cerrá» | **Cerrar** · Listo, cerré: Estado de cuenta. |
| «Estado de cuenta» + «cerrá eso» la cierra | es | `/appointments` | «cerrá eso» | **Cerrar** · Listo, cerré: Estado de cuenta. |
| «Estado de cuenta» + «cerralo» la cierra | es | `/appointments` | «cerralo» | **Cerrar** · Listo, cerré: Estado de cuenta. |
| «Estado de cuenta» + «escondé la ventana» la cierra | es | `/appointments` | «escondé la ventana» | **Cerrar** · Listo, cerré: Estado de cuenta. |
| «Estado de cuenta» + «que no se vea» la cierra | es | `/appointments` | «que no se vea» | **Cerrar** · Listo, cerré: Estado de cuenta. |
| «Estado de cuenta» + «no quiero ver eso» la cierra | es | `/appointments` | «no quiero ver eso» | **Cerrar** · Listo, cerré: Estado de cuenta. |
| «Estado de cuenta» + «volvé atrás» la cierra | es | `/appointments` | «volvé atrás» | **Cerrar** · Listo, cerré: Estado de cuenta. |
| «Estado de cuenta» + «sacalo de ahí» la cierra | es | `/appointments` | «sacalo de ahí» | **Cerrar** · Listo, cerré: Estado de cuenta. |
| «Historia clínica» + «cerrá» la cierra | es | `/appointments` | «cerrá» | **Cerrar** · Listo, cerré: Historia clínica. |
| «Historia clínica» + «cerrá eso» la cierra | es | `/appointments` | «cerrá eso» | **Cerrar** · Listo, cerré: Historia clínica. |
| «Historia clínica» + «cerralo» la cierra | es | `/appointments` | «cerralo» | **Cerrar** · Listo, cerré: Historia clínica. |
| «Historia clínica» + «escondé la ventana» la cierra | es | `/appointments` | «escondé la ventana» | **Cerrar** · Listo, cerré: Historia clínica. |
| «Historia clínica» + «que no se vea» la cierra | es | `/appointments` | «que no se vea» | **Cerrar** · Listo, cerré: Historia clínica. |
| «Historia clínica» + «no quiero ver eso» la cierra | es | `/appointments` | «no quiero ver eso» | **Cerrar** · Listo, cerré: Historia clínica. |
| «Historia clínica» + «volvé atrás» la cierra | es | `/appointments` | «volvé atrás» | **Cerrar** · Listo, cerré: Historia clínica. |
| «Historia clínica» + «sacalo de ahí» la cierra | es | `/appointments` | «sacalo de ahí» | **Cerrar** · Listo, cerré: Historia clínica. |
| «Datos del paciente» + «cerrá» la cierra | es | `/appointments` | «cerrá» | **Cerrar** · Listo, cerré: Datos del paciente. |
| «Datos del paciente» + «cerrá eso» la cierra | es | `/appointments` | «cerrá eso» | **Cerrar** · Listo, cerré: Datos del paciente. |
| «Datos del paciente» + «cerralo» la cierra | es | `/appointments` | «cerralo» | **Cerrar** · Listo, cerré: Datos del paciente. |
| «Datos del paciente» + «escondé la ventana» la cierra | es | `/appointments` | «escondé la ventana» | **Cerrar** · Listo, cerré: Datos del paciente. |
| «Datos del paciente» + «que no se vea» la cierra | es | `/appointments` | «que no se vea» | **Cerrar** · Listo, cerré: Datos del paciente. |
| «Datos del paciente» + «no quiero ver eso» la cierra | es | `/appointments` | «no quiero ver eso» | **Cerrar** · Listo, cerré: Datos del paciente. |
| «Datos del paciente» + «volvé atrás» la cierra | es | `/appointments` | «volvé atrás» | **Cerrar** · Listo, cerré: Datos del paciente. |
| «Datos del paciente» + «sacalo de ahí» la cierra | es | `/appointments` | «sacalo de ahí» | **Cerrar** · Listo, cerré: Datos del paciente. |
| «Imágenes y archivos» + «cerrá» la cierra | es | `/appointments` | «cerrá» | **Cerrar** · Listo, cerré: Imágenes y archivos. |
| «Imágenes y archivos» + «cerrá eso» la cierra | es | `/appointments` | «cerrá eso» | **Cerrar** · Listo, cerré: Imágenes y archivos. |
| «Imágenes y archivos» + «cerralo» la cierra | es | `/appointments` | «cerralo» | **Cerrar** · Listo, cerré: Imágenes y archivos. |
| «Imágenes y archivos» + «escondé la ventana» la cierra | es | `/appointments` | «escondé la ventana» | **Cerrar** · Listo, cerré: Imágenes y archivos. |
| «Imágenes y archivos» + «que no se vea» la cierra | es | `/appointments` | «que no se vea» | **Cerrar** · Listo, cerré: Imágenes y archivos. |
| «Imágenes y archivos» + «no quiero ver eso» la cierra | es | `/appointments` | «no quiero ver eso» | **Cerrar** · Listo, cerré: Imágenes y archivos. |
| «Imágenes y archivos» + «volvé atrás» la cierra | es | `/appointments` | «volvé atrás» | **Cerrar** · Listo, cerré: Imágenes y archivos. |
| «Imágenes y archivos» + «sacalo de ahí» la cierra | es | `/appointments` | «sacalo de ahí» | **Cerrar** · Listo, cerré: Imágenes y archivos. |
| «Historial de citas» + «cerrá» la cierra | es | `/appointments` | «cerrá» | **Cerrar** · Listo, cerré: Historial de citas. |
| «Historial de citas» + «cerrá eso» la cierra | es | `/appointments` | «cerrá eso» | **Cerrar** · Listo, cerré: Historial de citas. |
| «Historial de citas» + «cerralo» la cierra | es | `/appointments` | «cerralo» | **Cerrar** · Listo, cerré: Historial de citas. |
| «Historial de citas» + «escondé la ventana» la cierra | es | `/appointments` | «escondé la ventana» | **Cerrar** · Listo, cerré: Historial de citas. |
| «Historial de citas» + «que no se vea» la cierra | es | `/appointments` | «que no se vea» | **Cerrar** · Listo, cerré: Historial de citas. |
| «Historial de citas» + «no quiero ver eso» la cierra | es | `/appointments` | «no quiero ver eso» | **Cerrar** · Listo, cerré: Historial de citas. |
| «Historial de citas» + «volvé atrás» la cierra | es | `/appointments` | «volvé atrás» | **Cerrar** · Listo, cerré: Historial de citas. |
| «Historial de citas» + «sacalo de ahí» la cierra | es | `/appointments` | «sacalo de ahí» | **Cerrar** · Listo, cerré: Historial de citas. |
| «cerrá todo» cierra las ventanas y los paneles de la agenda | es | `/appointments` | «abrí el panel de agendas» | **Panel de agendas** · Listo, abrí el panel de agendas. |
| 〃 | es | `/appointments` | «cerrá todo» | **Cerrar** · Listo, cerré: Historia clínica, Estado de cuenta, el panel de agendas. |
| cierra la de arriba primero | es | `/appointments` | «cerrá» | **Cerrar** · Listo, cerré: Historia clínica. |

## SEL-ES · Lo seleccionado en pantalla es de lo que se habla

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| cita abierta con el mouse: «llegó» es sobre ella, sin nombrarla | es | `/appointments` | «llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Carlos López quedó en Llegó. |
| cita abierta: «¿cuánto debe?» es su paciente | es | `/appointments` | «cuánto debe» | Información del paciente |
| cita abierta: «editala» abre esa | es | `/appointments` | «editala» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| nombrar otra cita la reemplaza («buscá otra») | es | `/appointments` | «Juan Pérez llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |
| cambio de contexto («vista semana») suelta la cita en foco | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «vista semana» | **Calendario** · Listo, vista de semana. |
| cambio de contexto («más zoom») suelta la cita en foco | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «más zoom» | Zoom al 110 %. |
| cambio de contexto («andá a mañana») suelta la cita en foco | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «andá a mañana» | Calendario en mar 24/11. |
| cambio de contexto («slots de 15») suelta la cita en foco | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «slots de 15» | **Configuración de la agenda** · Listo: slots de 15 minutos. |
| cambio de contexto («exportá la agenda») suelta la cita en foco | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «exportá la agenda» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| cambio de contexto («cuántas veces faltó Carlos López») suelta la cita en foco | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «cuántas veces faltó Carlos López» | Información del paciente |
| seguir hablando de la cita no la suelta (estado, cuenta, color) | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «abrí su cuenta» | **Estado de cuenta** · Abrí Estado de cuenta de Juan Pérez. |
| 〃 | es | `/appointments` | «cuánto debe» | Información del paciente |
| una herramienta en medio de una pregunta sobre la cita no la suelta | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «llegó» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «más zoom» | **Estado de la cita** · Decí «sí» para cambiarla o «no» para dejarla como está. |
| 〃 | es | `/appointments` | «sí» | **Estado de la cita** · Listo, la cita de Juan Pérez quedó en Llegó. |

## PU-EN · Avisos de la agenda

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «patient future appointments»: decir «No» aprieta ese botón | en | `/appointments` | «No» | **Attention** · Done, I pressed “No”. |
| «patient future appointments»: decir «Yes» aprieta ese botón | en | `/appointments` | «Yes» | **Attention** · Done, I pressed “Yes”. |
| «patient future appointments»: «yes» aprieta el principal | en | `/appointments` | «yes» | **Attention** · Done, I pressed “Yes”. |
| «patient future appointments»: «no» aprieta el de volver/cancelar | en | `/appointments` | «no» | **Attention** · Done, I pressed “No”. |
| «patient future appointments»: «the second one» por posición | en | `/appointments` | «the second one» | **Attention** · Done, I pressed “Yes”. |
| «delete appointment»: decir «Cancel» aprieta ese botón | en | `/appointments` | «Cancel» | **Delete appointment** · Done, I pressed “Cancel”. |
| «delete appointment»: decir «Yes, delete» aprieta ese botón | en | `/appointments` | «Yes, delete» | **Delete appointment** · Done, I pressed “Yes, delete”. |
| «delete appointment»: «yes» aprieta el principal | en | `/appointments` | «yes» | **Delete appointment** · Done, I pressed “Yes, delete”. |
| «delete appointment»: «no» aprieta el de volver/cancelar | en | `/appointments` | «no» | **Delete appointment** · Done, I pressed “Cancel”. |
| «delete appointment»: «the second one» por posición | en | `/appointments` | «the second one» | **Delete appointment** · Done, I pressed “Yes, delete”. |
| «cancel appointment»: decir «Close» aprieta ese botón | en | `/appointments` | «Close» | **Cancel Appointment** · Done, I pressed “Close”. |
| «cancel appointment»: decir «Cancel» aprieta ese botón | en | `/appointments` | «Cancel» | **Cancel Appointment** · Done, I pressed “Cancel”. |
| «cancel appointment»: «yes» aprieta el principal | en | `/appointments` | «yes» | **Cancel Appointment** · Done, I pressed “Cancel”. |
| «cancel appointment»: «no» aprieta el de volver/cancelar | en | `/appointments` | «no» | **Cancel Appointment** · Done, I pressed “Close”. |
| «cancel appointment»: «the second one» por posición | en | `/appointments` | «the second one» | **Cancel Appointment** · Done, I pressed “Cancel”. |
| «discard changes»: decir «Keep editing» aprieta ese botón | en | `/appointments` | «Keep editing» | **Discard changes?** · Done, I pressed “Keep editing”. |
| «discard changes»: decir «Discard changes» aprieta ese botón | en | `/appointments` | «Discard changes» | **Discard changes?** · Done, I pressed “Discard changes”. |
| «discard changes»: «yes» aprieta el principal | en | `/appointments` | «yes» | **Discard changes?** · Done, I pressed “Discard changes”. |
| «discard changes»: «no» aprieta el de volver/cancelar | en | `/appointments` | «no» | **Discard changes?** · Done, I pressed “Keep editing”. |
| «discard changes»: «the second one» por posición | en | `/appointments` | «the second one» | **Discard changes?** · Done, I pressed “Discard changes”. |
| «identity document»: decir «Close» aprieta ese botón | en | `/appointments` | «Close» | **Identity document required** · Done, I pressed “Close”. |
| «identity document»: decir «Got it» aprieta ese botón | en | `/appointments` | «Got it» | **Identity document required** · Done, I pressed “Got it”. |
| «identity document»: «yes» aprieta el principal | en | `/appointments` | «yes» | **Identity document required** · Done, I pressed “Got it”. |
| «identity document»: «no» aprieta el de volver/cancelar | en | `/appointments` | «no» | **Identity document required** · Done, I pressed “Close”. |
| «identity document»: «the second one» por posición | en | `/appointments` | «the second one» | **Identity document required** · Done, I pressed “Got it”. |
| «cancellation reason»: decir «Back» aprieta ese botón | en | `/appointments` | «Back» | **Cancellation reason** · Done, I pressed “Back”. |
| «cancellation reason»: decir «Cancel appointment» aprieta ese botón | en | `/appointments` | «Cancel appointment» | **Cancellation reason** · Done, I pressed “Cancel appointment”. |
| «cancellation reason»: «yes» aprieta el principal | en | `/appointments` | «yes» | **Cancellation reason** · Done, I pressed “Cancel appointment”. |
| «cancellation reason»: «no» aprieta el de volver/cancelar | en | `/appointments` | «no» | **Cancellation reason** · Done, I pressed “Back”. |
| «cancellation reason»: «the second one» por posición | en | `/appointments` | «the second one» | **Cancellation reason** · Done, I pressed “Cancel appointment”. |
| si el aviso se cierra con el mouse, la pregunta se va y vuelve la que había | en | `/appointments` | «Ana's appointment» | **Appointment** · Which of these appointments? [Mon 23/11 09:00 · Ana Gómez / Mon 23/11 10:30 · Ana Martínez] |
| una respuesta que no es ningún botón vuelve a preguntar | en | `/appointments` | «what a nice day» | **Delete appointment** · I didn't catch which button. Cancel or Yes, delete? [Cancel / Yes, delete] |
| 〃 | en | `/appointments` | «yes» | **Delete appointment** · Done, I pressed “Yes, delete”. |
| aviso de elegir y confirmar (alcance de un recordatorio): pregunta dos veces | en | `/appointments` | «The whole series» | **Reminder** · What should I do? This occurrence only or The whole series or Continue. [This occurrence only / The whole series / Continue] |
| 〃 | en | `/appointments` | «Continue» | **Reminder** · Done, I pressed “Continue”. |

## PU-EN · Ventanas y paneles laterales

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «Account statement» + «close» la cierra | en | `/appointments` | «close» | **Close** · Done, I closed: Account statement. |
| «Account statement» + «close it» la cierra | en | `/appointments` | «close it» | **Close** · Done, I closed: Account statement. |
| «Account statement» + «close that window» la cierra | en | `/appointments` | «close that window» | **Close** · Done, I closed: Account statement. |
| «Account statement» + «hide it» la cierra | en | `/appointments` | «hide it» | **Close** · Done, I closed: Account statement. |
| «Account statement» + «I don't want to see that» la cierra | en | `/appointments` | «I don't want to see that» | **Close** · Done, I closed: Account statement. |
| «Account statement» + «go back» la cierra | en | `/appointments` | «go back» | **Close** · Done, I closed: Account statement. |
| «Account statement» + «get rid of that» la cierra | en | `/appointments` | «get rid of that» | **Close** · Done, I closed: Account statement. |
| «Medical history» + «close» la cierra | en | `/appointments` | «close» | **Close** · Done, I closed: Medical history. |
| «Medical history» + «close it» la cierra | en | `/appointments` | «close it» | **Close** · Done, I closed: Medical history. |
| «Medical history» + «close that window» la cierra | en | `/appointments` | «close that window» | **Close** · Done, I closed: Medical history. |
| «Medical history» + «hide it» la cierra | en | `/appointments` | «hide it» | **Close** · Done, I closed: Medical history. |
| «Medical history» + «I don't want to see that» la cierra | en | `/appointments` | «I don't want to see that» | **Close** · Done, I closed: Medical history. |
| «Medical history» + «go back» la cierra | en | `/appointments` | «go back» | **Close** · Done, I closed: Medical history. |
| «Medical history» + «get rid of that» la cierra | en | `/appointments` | «get rid of that» | **Close** · Done, I closed: Medical history. |
| «Patient details» + «close» la cierra | en | `/appointments` | «close» | **Close** · Done, I closed: Patient details. |
| «Patient details» + «close it» la cierra | en | `/appointments` | «close it» | **Close** · Done, I closed: Patient details. |
| «Patient details» + «close that window» la cierra | en | `/appointments` | «close that window» | **Close** · Done, I closed: Patient details. |
| «Patient details» + «hide it» la cierra | en | `/appointments` | «hide it» | **Close** · Done, I closed: Patient details. |
| «Patient details» + «I don't want to see that» la cierra | en | `/appointments` | «I don't want to see that» | **Close** · Done, I closed: Patient details. |
| «Patient details» + «go back» la cierra | en | `/appointments` | «go back» | **Close** · Done, I closed: Patient details. |
| «Patient details» + «get rid of that» la cierra | en | `/appointments` | «get rid of that» | **Close** · Done, I closed: Patient details. |
| «Images and files» + «close» la cierra | en | `/appointments` | «close» | **Close** · Done, I closed: Images and files. |
| «Images and files» + «close it» la cierra | en | `/appointments` | «close it» | **Close** · Done, I closed: Images and files. |
| «Images and files» + «close that window» la cierra | en | `/appointments` | «close that window» | **Close** · Done, I closed: Images and files. |
| «Images and files» + «hide it» la cierra | en | `/appointments` | «hide it» | **Close** · Done, I closed: Images and files. |
| «Images and files» + «I don't want to see that» la cierra | en | `/appointments` | «I don't want to see that» | **Close** · Done, I closed: Images and files. |
| «Images and files» + «go back» la cierra | en | `/appointments` | «go back» | **Close** · Done, I closed: Images and files. |
| «Images and files» + «get rid of that» la cierra | en | `/appointments` | «get rid of that» | **Close** · Done, I closed: Images and files. |
| «Appointment history» + «close» la cierra | en | `/appointments` | «close» | **Close** · Done, I closed: Appointment history. |
| «Appointment history» + «close it» la cierra | en | `/appointments` | «close it» | **Close** · Done, I closed: Appointment history. |
| «Appointment history» + «close that window» la cierra | en | `/appointments` | «close that window» | **Close** · Done, I closed: Appointment history. |
| «Appointment history» + «hide it» la cierra | en | `/appointments` | «hide it» | **Close** · Done, I closed: Appointment history. |
| «Appointment history» + «I don't want to see that» la cierra | en | `/appointments` | «I don't want to see that» | **Close** · Done, I closed: Appointment history. |
| «Appointment history» + «go back» la cierra | en | `/appointments` | «go back» | **Close** · Done, I closed: Appointment history. |
| «Appointment history» + «get rid of that» la cierra | en | `/appointments` | «get rid of that» | **Close** · Done, I closed: Appointment history. |
| «cerrá todo» cierra las ventanas y los paneles de la agenda | en | `/appointments` | «open the calendars panel» | **Calendars panel** · Done, I opened the calendars panel. |
| 〃 | en | `/appointments` | «close everything» | **Close** · Done, I closed: Medical history, Account statement, the calendars panel. |
| cierra la de arriba primero | en | `/appointments` | «close» | **Close** · Done, I closed: Medical history. |

## SEL-EN · Lo seleccionado en pantalla es de lo que se habla

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| cita abierta con el mouse: «llegó» es sobre ella, sin nombrarla | en | `/appointments` | «arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now Arrived. |
| cita abierta: «¿cuánto debe?» es su paciente | en | `/appointments` | «how much does he owe» | Patient information |
| cita abierta: «editala» abre esa | en | `/appointments` | «edit it» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| nombrar otra cita la reemplaza («buscá otra») | en | `/appointments` | «Juan Pérez arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Arrived. |
| cambio de contexto («week view») suelta la cita en foco | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «week view» | **Calendar** · Done, week view. |
| cambio de contexto («zoom in») suelta la cita en foco | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «zoom in» | Zoom at 110%. |
| cambio de contexto («go to tomorrow») suelta la cita en foco | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «go to tomorrow» | Calendar on Tue 24/11. |
| cambio de contexto («15 minute slots») suelta la cita en foco | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «15 minute slots» | **Calendar settings** · Done: 15-minute slots. |
| cambio de contexto («export the schedule») suelta la cita en foco | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «export the schedule» | **Export schedule** · Should I download it? Say “yes”, or change the period or the calendars. |
| cambio de contexto («how many no shows does Carlos López have») suelta la cita en foco | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «how many no shows does Carlos López have» | Patient information |
| seguir hablando de la cita no la suelta (estado, cuenta, color) | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «open his account» | **Account statement** · I opened Account statement for Juan Pérez. |
| 〃 | en | `/appointments` | «how much does he owe» | Patient information |
| una herramienta en medio de una pregunta sobre la cita no la suelta | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «zoom in» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Arrived. |

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- PU-ES · Avisos de la agenda › «citas futuras del paciente»: la voz lee el aviso y dice sus botones
- PU-ES · Avisos de la agenda › «eliminar cita»: la voz lee el aviso y dice sus botones
- PU-ES · Avisos de la agenda › «cancelar cita»: la voz lee el aviso y dice sus botones
- PU-ES · Avisos de la agenda › «descartar cambios»: la voz lee el aviso y dice sus botones
- PU-ES · Avisos de la agenda › «falta el documento»: la voz lee el aviso y dice sus botones
- PU-ES · Avisos de la agenda › «motivo de la cancelación»: la voz lee el aviso y dice sus botones
- PU-ES · Avisos de la agenda › con el micrófono apagado el aviso no pregunta nada
- SEL-ES · Lo seleccionado en pantalla es de lo que se habla › al cerrar la cita seleccionada se suelta el foco
- PU-EN · Avisos de la agenda › «patient future appointments»: la voz lee el aviso y dice sus botones
- PU-EN · Avisos de la agenda › «delete appointment»: la voz lee el aviso y dice sus botones
- PU-EN · Avisos de la agenda › «cancel appointment»: la voz lee el aviso y dice sus botones
- PU-EN · Avisos de la agenda › «discard changes»: la voz lee el aviso y dice sus botones
- PU-EN · Avisos de la agenda › «identity document»: la voz lee el aviso y dice sus botones
- PU-EN · Avisos de la agenda › «cancellation reason»: la voz lee el aviso y dice sus botones
- PU-EN · Avisos de la agenda › con el micrófono apagado el aviso no pregunta nada
- SEL-EN · Lo seleccionado en pantalla es de lo que se habla › al cerrar la cita seleccionada se suelta el foco

