# Agenda: formulario, exportar y pacientes

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/13-form-export-patients-es.spec.ts`

Atómicos en español: editor de la cita campo por campo, nueva cita, exportar, pacientes y agente clínico.

**61 frases** en **34 pruebas que pasan** (es 61 · es-ES 0 · en 0). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## N1.14 · Editor de la cita: cada campo

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-150 editar abre el formulario y queda parado ahí | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| VZ-ES-151 cambiar el doctor | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «con el doctor Gómez» | **Editar cita** · Listo: con Dr. Pablo Gómez. ¿La guardo? |
| VZ-ES-152 cambiar la hora de inicio | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «a las 11 y media» | **Editar cita** · Listo: hoy a las 11:30. ¿La guardo? |
| VZ-ES-153 cambiar la hora de fin | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «que termine a las 11» | **Editar cita** · Listo: termina a las 11:00. ¿La guardo? |
| VZ-ES-154 cambiar la fecha | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «el viernes» | **Editar cita** · Listo: viernes 27 de noviembre a las 10:00. ¿La guardo? |
| VZ-ES-155 cambiar el consultorio | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «en el sillón 1» | **Editar cita** · Listo: consultorio Sillón 1. ¿La guardo? |
| VZ-ES-156 agregar y sacar servicios | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «agregá limpieza» | **Editar cita** · Listo: tratamientos: Limpieza. ¿La guardo? |
| 〃 | es | `/appointments` | «agregá blanqueamiento» | **Editar cita** · Listo: tratamientos: Limpieza, Blanqueamiento. ¿La guardo? |
| 〃 | es | `/appointments` | «sacale la limpieza» | **Editar cita** · Listo: tratamientos: Blanqueamiento. ¿La guardo? |
| VZ-ES-157 agregar una nota (conserva tildes) | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «nota: viene con la mamá» | **Editar cita** · Listo: nota «Viene con la mamá». ¿La guardo? |
| VZ-ES-158 una segunda nota se agrega abajo; «borrá las notas» las limpia | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «agregá en notas que trae estudios» | **Editar cita** · Listo: nota «Trae estudios». ¿La guardo? |
| 〃 | es | `/appointments` | «nota: llamar antes» | **Editar cita** · Listo: nota «Llamar antes». ¿La guardo? |
| 〃 | es | `/appointments` | «borrá las notas» | **Editar cita** · Listo: sin notas. ¿La guardo? |
| VZ-ES-159 cambiar el paciente | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «el paciente es Sofía Castro» | **Editar cita** · Listo: paciente Sofía Castro. ¿La guardo? |
| VZ-ES-160 «guardar» guarda con todo lo cambiado | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «con el doctor Gómez» | **Editar cita** · Listo: con Dr. Pablo Gómez. ¿La guardo? |
| 〃 | es | `/appointments` | «guardar» | **Editar cita** · Listo, cita actualizada. |
| VZ-ES-161 «actualizá» también guarda | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «actualizá» | **Editar cita** · Listo, cita actualizada. |
| VZ-ES-162 «cancelar» cierra sin guardar | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «cancelar» | **Editar cita** · Listo, cerré el formulario sin guardar. |
| VZ-ES-163 «no» deja el formulario abierto para seguir a mano | es | `/appointments` | «editá la cita de Juan Pérez» | **Editar cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «no» | **Editar cita** · Lo dejé abierto para que lo completes. |
| VZ-ES-164 formulario abierto a mano: lo que se dice es para él | es | `/appointments` | «con la doctora Ruiz» | **Formulario de la cita** · Listo: con Dra. Laura Ruiz. ¿La guardo? |
| 〃 | es | `/appointments` | «guardar» | **Formulario de la cita** · Listo, guardé la cita. |

## N1.15 · Nueva cita

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-170 nueva cita completa abre el formulario y «sí» la guarda | es | `/appointments` | «nueva cita para Sofía Castro mañana a las 10 con el doctor Pérez, limpieza» | **Nueva cita** · Revisá el formulario. «Sí» la guarda; «no» lo deja abierto. También podés corregir: «con el doctor Pérez», «agregá limpieza», «sacá la consulta», «a las 11». |
| 〃 | es | `/appointments` | «sí» | **Nueva cita** · Listo, cita guardada. |

## N1.16 · Exportar agenda

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-180 «exportá la agenda» abre y pregunta si descarga | es | `/appointments` | «exportá la agenda» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| VZ-ES-181 «exportá la agenda de la semana que viene» pone Semana | es | `/appointments` | «exportá la agenda de la semana que viene» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| VZ-ES-182 «exportá la agenda del mes» pone Mes | es | `/appointments` | «exportá la agenda del mes» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| VZ-ES-183 rango «del 1 al 15 de diciembre» | es | `/appointments` | «exportá la agenda del 1 al 15 de diciembre» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| VZ-ES-184 de la sede Centro marca sus agendas | es | `/appointments` | «exportá la agenda de hoy de la sede Centro» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| VZ-ES-185 de todas las agendas | es | `/appointments` | «exportá la agenda de todas las agendas» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| VZ-ES-186 corregir con el diálogo abierto y «sí» descarga | es | `/appointments` | «exportá la agenda» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| 〃 | es | `/appointments` | «mejor la semana que viene» | **Exportar agenda** · Listo, lo cambié. ¿La descargo? |
| 〃 | es | `/appointments` | «sí» | **Exportar agenda** · Listo, se descargó la agenda. |
| VZ-ES-187 «cancelar» cierra sin exportar | es | `/appointments` | «exportá la agenda» | **Exportar agenda** · ¿La descargo? Decí «sí», o cambiá el período o las agendas. |
| 〃 | es | `/appointments` | «cancelar» | **Exportar agenda** · Listo, no la exporté. |

## N1.17 · Pacientes

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-190 buscá el paciente Juan Pérez: por sus citas, queda en foco | es | `/appointments` | «buscá el paciente Juan Pérez» | **Buscar paciente** · Encontré a Juan Pérez: su última cita fue hoy a las 10:00. |
| VZ-ES-191 citas muy viejas: va al buscador de pacientes y abre la ficha | es | `/appointments` | «buscá el paciente Roberto Díaz» | **Buscar paciente** · Listo, abrí la ficha de Roberto Díaz. |
| VZ-ES-192 sin citas: Sofía Castro por el buscador | es | `/appointments` | «buscame la información de Sofía Castro» | **Buscar paciente** · Listo, abrí la ficha de Sofía Castro. |
| VZ-ES-193 no lo encuentra por nombre: pide cédula y busca por ella | es | `/appointments` | «buscá el paciente Ernesto Valverde» | **Buscar paciente** · No encontré a ernesto valverde por el nombre. Decime la cédula, el email o el teléfono. |
| 〃 | es | `/appointments` | «cédula 1 2 3 4 5 6 7 8» | **Buscar paciente** · Listo, abrí la ficha de Roberto Díaz. |
| VZ-ES-194 por teléfono directo | es | `/appointments` | «buscá el paciente con teléfono 099 123 456» | **Buscar paciente** · Listo, abrí la ficha de Sofía Castro. |
| VZ-ES-195 por email dictado | es | `/appointments` | «buscá el paciente sofia arroba gmail punto com» | **Buscar paciente** · Listo, abrí la ficha de Sofía Castro. |
| VZ-ES-196 resumen del paciente en foco: sale de sus registros (sin elegir cita ni IA) | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «dame un resumen del paciente» | Información del paciente |
| VZ-ES-197 «¿cuánto debe Juan Pérez?» | es | `/appointments` | «cuánto debe Juan Pérez» | Información del paciente |
| VZ-ES-198 pregunta clínica sin acceso a Mi consultorio: no consulta al agente | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «qué alergias tiene» | **Paciente** · No tenés permiso para hacer eso. |
| VZ-ES-199 pregunta clínica con acceso: va al agente clínico de Mi consultorio | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «qué alergias tiene» | **Paciente** · Es alérgico a la penicilina. |

