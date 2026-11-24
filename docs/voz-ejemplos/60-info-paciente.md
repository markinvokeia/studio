# Información y acciones del paciente

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/60-patient-info.spec.ts`

Información del paciente (estadísticas, deuda, pagos, presupuestos, tratamientos) y acciones (presupuesto, factura, tratamiento, sesión, cobro), es y en.

**54 frases** en **37 pruebas que pasan** (es 35 · es-ES 0 · en 19). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## N5.ES · Información del paciente (español)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-500 ¿cuántas veces vino Juan Pérez? (no pregunta qué cita) | es | `/appointments` | «cuántas veces vino Juan Pérez» | Información del paciente |
| VZ-ES-501 ¿cuántas citas canceló Juan Pérez? | es | `/appointments` | «cuántas citas canceló Juan Pérez» | Información del paciente |
| VZ-ES-502 ¿cuántas veces faltó Juan Pérez? | es | `/appointments` | «cuántas veces faltó Juan Pérez» | Información del paciente |
| VZ-ES-503 ¿cuándo fue la última vez que no vino? (paciente en foco) | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «cuándo fue la última vez que no vino» | Información del paciente |
| VZ-ES-504 ¿cuándo fue su última visita? | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «cuál fue su última visita» | Información del paciente |
| VZ-ES-505 ¿tiene deudas? | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «tiene deudas» | Información del paciente |
| VZ-ES-506 ¿cuál fue el último pago que hizo Juan Pérez? | es | `/appointments` | «cuál fue el último pago que hizo Juan Pérez» | Información del paciente |
| VZ-ES-507 ¿cuánto pagó en total? | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «cuánto ha pagado» | Información del paciente |
| VZ-ES-508 ¿en qué estado están sus presupuestos? | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «en qué estado están sus presupuestos» | Información del paciente |
| VZ-ES-509 ¿tiene facturas sin pagar? | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «qué facturas tiene» | Información del paciente |
| VZ-ES-510 ¿qué tratamientos tiene en curso? | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «qué tratamientos tiene en curso» | Información del paciente |
| VZ-ES-511 varias preguntas juntas: «cuántas veces faltó y si tiene deudas» | es | `/appointments` | «Juan Pérez cuántas veces faltó y si tiene deudas» | Información del paciente |
| VZ-ES-512 estadísticas del paciente (resumen completo) | es | `/appointments` | «dame las estadísticas de Juan Pérez» | Información del paciente |
| VZ-ES-513 paciente sin citas: lo busca en el buscador de pacientes y contesta | es | `/appointments` | «cuántas veces vino Sofía Castro» | Información del paciente |
| VZ-ES-514 sin decir de quién ni foco: pregunta el paciente | es | `/appointments` | «tiene deudas» | **Información del paciente** · ¿Para qué paciente es? |
| 〃 | es | `/appointments` | «Juan Pérez» | Información del paciente |
| VZ-ES-515 sin permiso de cuentas: no dice lo financiero (y lo aclara) | es | `/appointments` | «cuánto debe Juan Pérez» | **Información del paciente** · Lo financiero no te lo puedo decir: no tenés permiso para ver la cuenta del paciente. |
| VZ-ES-516 la información no cancela una pregunta abierta (herramienta) | es | `/appointments` | «la cita de Ana» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |
| 〃 | es | `/appointments` | «y cuántas veces vino Juan Pérez» | **Cita** · ¿Cuál de estas citas? [lun 23/11 09:00 · Ana Gómez / lun 23/11 10:30 · Ana Martínez] |

## N5.ES · Acciones del paciente (español)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-ES-52x «creá un presupuesto para Juan Pérez» → quote | es | `/appointments` | «creá un presupuesto para Juan Pérez» | **Nuevo presupuesto** · Listo, abrí un presupuesto nuevo para Juan Pérez. |
| VZ-ES-52x «hacé una factura para Juan Pérez» → invoice | es | `/appointments` | «hacé una factura para Juan Pérez» | **Nueva factura** · Listo, abrí una factura nueva para Juan Pérez. |
| VZ-ES-52x «vamos a crear un tratamiento para Juan Pérez» → treatment | es | `/appointments` | «vamos a crear un tratamiento para Juan Pérez» | **Nuevo tratamiento** · Listo, abrí un tratamiento nuevo para Juan Pérez. |
| VZ-ES-52x «abrí el cobro rápido de Juan Pérez» → bill | es | `/appointments` | «abrí el cobro rápido de Juan Pérez» | **Cobro rápido** · Listo, abrí el cobro rápido de Juan Pérez. |
| VZ-ES-525 registrar la sesión clínica usa la cita del paciente | es | `/appointments` | «la cita de Juan Pérez» | **Cita** · La cita de Juan Pérez, hoy a las 10:00. |
| 〃 | es | `/appointments` | «registrá la sesión clínica» | **Sesión clínica** · Listo, abrí la sesión clínica de Juan Pérez. |
| VZ-ES-526 sesión clínica de un paciente sin cita: lo dice | es | `/appointments` | «registrá la sesión clínica de Sofía Castro» | **Sesión clínica** · La sesión clínica se registra sobre una cita y Sofía Castro no tiene una cercana. Decime de qué cita, o abrila desde la cita. |
| VZ-ES-527 presupuesto para el paciente en foco | es | `/appointments` | «la cita de Carlos López» | **Cita** · La cita de Carlos López, hoy a las 15:00. |
| 〃 | es | `/appointments` | «nuevo presupuesto» | **Nuevo presupuesto** · Listo, abrí un presupuesto nuevo para Carlos López. |

## N5.EN · Patient information and actions (English)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-EN-500 how many times has Juan Pérez come | en | `/appointments` | «how many times has Juan Pérez come» | Patient information |
| VZ-EN-501 how many no shows does Juan Pérez have | en | `/appointments` | «how many no shows does Juan Pérez have» | Patient information |
| VZ-EN-502 how many cancellations | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «how many cancellations» | Patient information |
| VZ-EN-503 does he owe anything | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «does he owe anything» | Patient information |
| VZ-EN-504 last payment | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «what was the last payment» | Patient information |
| VZ-EN-505 quotes status | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «what is the status of his quotes» | Patient information |
| VZ-EN-506 treatments in progress | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «which treatments are in progress» | Patient information |
| VZ-EN-507 stats for Juan Pérez | en | `/appointments` | «give me the stats for Juan Pérez» | Patient information |
| VZ-EN-51x «create a quote for Juan Pérez» → quote | en | `/appointments` | «create a quote for Juan Pérez» | **New quote** · Done, I opened a new quote for Juan Pérez. |
| VZ-EN-51x «new invoice for Juan Pérez» → invoice | en | `/appointments` | «new invoice for Juan Pérez» | **New invoice** · Done, I opened a new invoice for Juan Pérez. |
| VZ-EN-51x «new treatment for Juan Pérez» → treatment | en | `/appointments` | «new treatment for Juan Pérez» | **New treatment** · Done, I opened a new treatment for Juan Pérez. |
| VZ-EN-51x «quick charge for Juan Pérez» → bill | en | `/appointments` | «quick charge for Juan Pérez» | **Quick charge** · Done, I opened Juan Pérez's quick charge. |
| VZ-EN-515 record the clinical session (focus) | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «record the clinical session» | **Clinical session** · Done, I opened Juan Pérez's clinical session. |

