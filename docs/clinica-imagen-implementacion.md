# Clínica Imagen sobre InvokeIA — Fase 1: Agenda, Doctores y Pacientes

> Versión web para el cliente: https://claude.ai/code/artifact/709b6819-affe-416c-b3af-7bc6e7c047ff
>
> Documento preparado sobre la reunión del **2 de septiembre de 2026** con Javier de Lima
> (dueño), Dulce Castellanos y Luis Rodriguez. Plazo acordado en la reunión: migrar las 13
> sedes de Google Calendar en **2 semanas**. Seguimiento: miércoles 8:00 con Federico (contador).

**Estados usados en este documento**

| Estado | Significado |
| --- | --- |
| `LISTO` | Configurar y usar, sin escribir código |
| `CUSTOM` | Ajuste chico, 1–3 días |
| `DESARROLLO` | Proyecto de semanas |
| `BLOQUEANTE` | Hay que resolverlo antes de habilitar |

---

## 1. Qué se pone en marcha

La fase 1 no toca Watique, ni Facturap, ni Image Cloud. Toma el problema que Javier puso
primero sobre la mesa — la agenda — y lo resuelve completo, hasta el informe del estudio.

| Rol | Qué recibe |
| --- | --- |
| **Recepción y central** | Las 13 sedes en columnas paralelas, slots de 10 min, huecos libres marcados, horario de cada sede respetado. Cada operador con su usuario. |
| **Técnico en sede** | Su agenda del día, el paciente que entra, y la sesión clínica donde queda el informe y las imágenes adjuntas. Pantalla de TV para sala de espera. |
| **Odontólogo derivador** | "Mi Consultorio": entra con su usuario y ve solo lo que él derivó, en qué estado está cada estudio, y el informe cuando sale. |
| **Paciente** | Portal con login por código de 6 dígitos por email, sin contraseña. Reserva su hora eligiendo sede, ve sus citas, documentos y estado de cuenta. |
| **Contador y dirección** | La cita como fuente: lo que el doctor mandó a hacer, lo que se hizo, y el enlace a presupuesto, factura y pago. |

Fuera de fase 1 (ver §10): **orden web nativa** con WhatsApp automático, **integración por API
con Image Cloud**, y **facturación electrónica**.

---

## 2. De 13 calendarios a una agenda

### El modelo

```
Sede ──tiene 1–2──> Calendario ──aloja──> Cita ──cierra en──> Sesión clínica ──se cobra──> Factura
(13 lugares)         (sala/equipo)      (slot 10 min)        (el informe)                 (y pago)
   │                                        │                      │
horario propio                      doctor derivador        técnico ejecutor
+ feriados                          servicio · paciente     notas · adjuntos

                              Google Calendar (13 agendas actuales)
                                    ▲ al instante │ ▼ pull 06:00, +1 mes
                                         └── Cita ──┘
```

- **Sede** — el lugar físico. 13 filas con nombre, dirección y teléfono.
- **Calendario** — la agenda de un equipo o sala dentro de esa sede. Uno o dos sillones → uno o dos calendarios. **No hay entidad de sala aparte: el calendario _es_ la sala.**
- **Cita** — vive en un calendario. El dato del paciente se toca acá una sola vez.
- **Sesión clínica** — lo que se escribe cuando el estudio ya se hizo.

### El problema de los 15 minutos `LISTO`

Google Calendar deja programar 10 minutos pero pinta bloques de 15, y entonces cuatro OPT en
una hora desperdicia capacidad. InvokeIA tiene la duración del slot como preferencia:
`10 / 15 / 20 / 30 / 60` minutos, y por separado la altura de la hora (60–200 px).
Además cada servicio lleva su propia `duration_minutes`, así que al elegir el estudio la cita
toma esa duración sola.

### Ver las 13 sedes en un mismo lugar `LISTO`

Dos formas, ambas existentes:

- **Vista agrupada** — una columna por calendario (= por sede), todas en paralelo. También se
  puede agrupar por doctor en lugar de por sede.
- **Modo de agenda única** — una sola sede a pantalla completa, elegida desde el panel lateral.

Vistas: día, 2–6 días, semana, mes, año y lista. La lista tiene selección múltiple, que es lo
que habilita la reasignación masiva de doctor.

### Horarios variables y el segundo turno de Carrasco `LISTO`

Cada sede tiene horario por día de la semana, y por encima **excepciones**: un feriado que
cierra, o un día que abre con otro horario. El segundo turno que están agregando esta semana en
Carrasco es una excepción de un día, no un rediseño.

Con *bloquear fuera de horario* activado, la agenda pinta en gris y hace inclicable todo lo que
cae fuera del horario de esa sede.

### Los huecos, que es el problema del técnico `LISTO`

El desgaste que describió Javier — hora y media tranquilo y después tres pacientes encima —
tiene dos caras:

- El **panel de huecos** lista los espacios libres de cada agenda desde 10 minutos, los marca
  sobre el lienzo, y permite agendar con un clic dentro del hueco. La recepcionista ve dónde
  *falta* meter pacientes en lugar de apilarlos al final.
- Cuando dos citas se pisan, la agenda las dibuja **lado a lado en columnas** en vez de
  taparlas: el solapamiento se ve, no se descubre cuando llega el segundo paciente.

### Cómo se hace el corte `LISTO`

No hay que apagar Google Calendar el día uno. La sincronización va en los dos sentidos:

- **Salida, al instante** — cada cita creada, editada o borrada en InvokeIA se refleja en el
  Google Calendar de esa sede.
- **Entrada, diaria a las 06:00** — trae los eventos ya cargados en los 13 calendarios, con un
  mes de ventana hacia adelante.

> **Límite que conviene saber de entrada.** La entrada desde Google es una **ingesta, no un
> espejo permanente**: inserta lo que falta pero no actualiza ni borra lo que ya trajo, y los
> eventos que entran vienen con el texto del evento, **sin paciente vinculado** — porque en
> Google ese dato no existe como tal.
>
> Sirve perfecto para el corte. Lo que no conviene es operar meses con las dos puntas cargando
> en paralelo.

---

## 3. El ciclo de una cita

### Quién es el "doctor" de la cita — decisión de modelado

En Clínica Imagen hay dos profesionales por estudio. **El campo de doctor de la cita es el
odontólogo que derivó al paciente** — el cliente real de la clínica. El técnico que hizo el
estudio queda en la sesión clínica.

Con ese solo criterio se destraban tres cosas sin escribir código:

1. Los reportes de producción y cancelaciones salen **por derivador**.
2. La agenda se agrupa y filtra por derivador.
3. El odontólogo entra a Mi Consultorio y ve exactamente sus derivaciones y nada más.

### Los estados

```
pendiente ─recepción─> agendada ─paciente─> confirmada ─llega─> llegó ─al box─> en curso ─estudio─> completada
              │            │                     │                 ┆                                    ┆
              │            ▼ con motivo          ▼ no se presentó  ┆ llegó tarde                        ┆ atendida tarde
              │        cancelada                no vino            └──── insumo del reporte de puntualidad ────┘
              │            │
              └── reprogramada ──vuelve a agendarse──┘
```

Cancelar exige motivo — `tarde`, `en tiempo`, `sin aviso`, `por el doctor`, `por la clínica`,
`otro` — y de ahí sale el reporte de cancelaciones. Reprogramar no borra historia: cancela la
original con motivo `reagenda` y crea la nueva.

**`arrived_late` y `attended_late` ya se guardan hoy**, pero todavía no hay reporte que los
cruce. Es la customización de §10 con mejor relación esfuerzo/valor: el dato se acumula desde
el día uno, así que cuando el reporte exista va a tener historia.

### El cierre: la sesión clínica `LISTO`

Desde la propia cita se abre la sesión clínica, ligada a esa cita por `appointment_id`. Ahí van
procedimiento realizado, diagnóstico, notas clínicas, plan de próxima cita, el técnico ejecutor,
y los **archivos adjuntos** por drag & drop. Eso es hoy el informe.

> **Informe firmado** `DESARROLLO` — lo que existe es texto + adjuntos dentro de la sesión, más
> plantillas de impresión y email. Lo que **no** existe es el informe como documento estructurado
> por tipo de estudio, con estado borrador/validado/entregado y firma.

---

## 4. Mi Consultorio `LISTO`

Es el "portal del cliente" que Luis describió en la reunión, y ya está construido.

**Qué ve el odontólogo:**

- Su agenda, en modo de un día o de un período, con indicadores de citas de hoy, confirmadas, pendientes y completadas.
- Sus derivaciones, con el estado de cada una.
- El paciente en foco: alertas de alergias y condiciones, sesiones anteriores, odontograma, línea de tiempo de tratamientos, documentos.
- La sesión clínica del estudio (el informe) cuando ya se cargó.
- Notificaciones en vivo cuando una cita suya se agenda, reprograma, reasigna o completa.
- Un asistente clínico con IA.

Se refresca solo cada minuto. **Qué no ve:** facturación, caja, configuración, ni las agendas
de otras sedes. Su agenda se arma filtrando por su propio `doctor_id`.

> **Dos ajustes chicos antes de abrirlo a los doctores**
>
> `CUSTOM` **El visor de estudios no aparece.** Los ítems de menú "Estudios" y "Estudios
> compartidos" piden `DICOM_VIEW_STUDIES` / `DICOM_VIEW_SHARED_STUDIES`, y ningún rol los tiene
> por defecto. Es configuración de permisos, pero hay que hacerla o el doctor entra y no
> encuentra las imágenes.
>
> `CUSTOM` **La lista de pacientes no está acotada por doctor.** Quien tiene
> `PATIENTS_VIEW_LIST` ve el listado de toda la clínica. Para el derivador se resuelve no
> dándole ese permiso: llega a sus pacientes por la agenda, que sí está filtrada.

---

## 5. Portal de pacientes

- **Entra sin contraseña** — documento → código de 6 dígitos por email → adentro. Vence a los 10 minutos, cinco intentos.
- **Reserva su hora** — tres pasos: sede → horario → confirmar. Solo ofrece horas que existen según horario y feriados. La cita nace en `pending`, así que recepción la confirma. Un paciente nuevo puede registrarse y reservar en el mismo flujo.
- **QR + volante imprimible** para el mostrador de cada sede.
- **Ve lo suyo** — citas próximas (con reprogramar/cancelar), sus datos editables sin las notas internas, historia clínica en lectura, indicaciones médicas, documentos, y estado de cuenta.

> ### `BLOQUEANTE` Hay que cerrar esto antes de habilitar el portal
>
> `docs/patient-portal.md §1` marca un control obligatorio: verificar en cada consulta que el
> paciente que pide un dato es dueño de ese dato, o es personal de la clínica
> (`assert_self_or_staff`). **Ese control no está implementado en ningún flujo** — 0 hits en
> `docs/n8n-flows/` y `n8n-workflows/`. La propia doc lo dice: *"sin esto el portal es una fuga
> de datos y no se puede publicar"*.
>
> Sin él, un paciente autenticado podría pedir los datos de otro cambiando un identificador.
>
> **Recomendación:** el portal se habilita en la semana 2, después de cerrar esto. La agenda,
> Mi Consultorio y la sesión clínica no dependen de esto y arrancan sin esperar.
>
> Pendientes menores del mismo bloque: el botón Reservar dentro de `/my-profile` no consulta
> `online_booking_enabled` (solo se respeta en la landing), y falta rate-limit por IP en
> `/api/auth/patient/register`.

---

## 6. Reportes y tableros

### Ocupación de agenda `LISTO`

| Mide | Para qué sirve en Clínica Imagen |
| --- | --- |
| Total de citas y **duración promedio** | Ver si la duración cargada de cada estudio se parece a la realidad. Si la OPT está a 15 y el promedio real da 8, hay capacidad tirándose. |
| **Completadas** y tasa | Cuánto del día se ejecutó, por sede y período. |
| **Canceladas** y tasa | Dónde se rompe la agenda. Se cruza con el reporte de cancelaciones para el motivo. |
| **No vino** | El costo del hueco que nadie ocupó. Insumo para decidir el recordatorio automático. |
| **Sin atender** | Citas que pasaron de fecha sin cerrar: agenda sucia, o trabajo hecho sin registrar. |
| **Con presupuesto** / **con sesión** | El control que le interesa a Federico: de las citas hechas, cuántas tienen informe y cuántas llegaron a facturarse. |

Se agrupa por estado, doctor derivador, período y calendario (= por sede), con barras y torta
más la tabla cita por cita. Filtros: rango de fechas, doctor, estado, calendario, tiene
presupuesto, tiene sesión.

### Cancelaciones `LISTO`

Mismo reporte cortado por motivo, doctor, paciente, servicio, sede y período. Con un mes de
datos se ve si las cancelaciones son del paciente, del doctor o de la clínica.

### Exportación

CSV y Excel de verdad (multi-hoja cuando el reporte tiene varios cortes). El "exportar PDF" es
`window.print()` con encabezado y logo de la clínica: sirve para adjuntar, no es un generador.

### Lo que todavía no miden

- **Demoras y puntualidad** `CUSTOM` — `arrived_late` y `attended_late` se guardan pero ningún reporte los cruza.
- **Solapamientos y ocupación real vs. capacidad** `DESARROLLO` — requiere cruzar citas contra el horario de cada sede.
- **Filtro por sede** `CUSTOM` — hoy se filtra por `calendar_id`. Mitigación desde el día uno: convención de nombre `Carrasco · Sala 1`.

---

## 7. La vista del contador

Para Federico el punto es uno: **la cita es la fuente**.

| Eslabón | Qué registra | Cómo se enlaza |
| --- | --- | --- |
| **Cita** | Paciente, odontólogo derivador, estudio pedido, sede, fecha y hora, estado final. | Es el origen. Guarda su propio vínculo al presupuesto y a la factura. |
| **Sesión clínica** | Lo que se hizo: procedimiento, notas, adjuntos, técnico ejecutor. | Ligada a la cita. También puede ligarse a la factura. |
| **Presupuesto** | Lo cotizado por línea, con descuentos si la clínica los habilita. | Lleva cuánto se facturó, cuánto queda por facturar, cuánto se cobró y cuánto queda por cobrar. |
| **Factura** | El comprobante, con líneas y vencimiento. | Cuelga del presupuesto y se vincula a la cita desde el cobro. |
| **Pago** | Cobro directo, imputación de nota de crédito o de pago previo. Multimoneda con tipo de cambio. | Cuelga de la factura y del presupuesto, y arrastra el doctor. |

**Cobro Rápido** `LISTO` — desde la propia cita, un asistente resuelve paciente, tratamiento,
factura y pago en 2–4 pasos y deja la factura vinculada a esa cita. También se abre desde el
paciente, el presupuesto, la factura y la sesión clínica. El excedente queda como pago a cuenta.

**Lo que Federico va a querer abrir:** cuenta unificada del paciente · producción por doctor ·
cuentas corrientes y deudores con aging 0-30/31-60/61-90/90+ · facturación contra cobranza ·
estado de resultados y balance mensual por médico · gastos operativos · cierre de caja y cobros
del día por método · honorarios.

> ### El límite honesto: facturación electrónica
>
> InvokeIA gestiona la facturación pero **no emite CFE**. Javier lo planteó él mismo, y para su
> organización no es opcional. Dos caminos, ambos proyecto aparte:
>
> 1. Desarrollar la emisión de CFE.
> 2. **Integrarse con Facturap por su API** — ruta más corta: el comprobante fiscal se sigue
>    emitiendo donde hoy se emite, e InvokeIA le pasa los datos.
>
> Vale plantearlo el miércoles con Federico, que conoce el requerimiento normativo.

---

## 8. Trazabilidad

Javier fue claro en para qué la quiere: *"no porque queramos culpar a nadie, sino que solamente
queremos educar"*. Eso cambia el diseño: hace falta poder reconstruir qué pasó, no un tablero
de infracciones.

**Usuario por operador** `LISTO` — se crea con nombre, email y rol; el sistema manda un enlace
para que la persona ponga su propia contraseña. Roles armados: Administrador, Gerente,
Recepcionista, Doctor, Cajero, ajustables con matriz de permisos por módulo.

> **Dimensionar la licencia antes de crear los usuarios.** La licencia limita `maxDoctors`,
> `maxReceptionists`, `maxAdmins` y `maxMonthlyNewPatients`. Con 13 sedes hay que calcularlo
> antes: si se llega al tope, el alta se rechaza. Es el motivo por el que en §9 pedimos la lista
> de operadores con su rol.

**Registro de auditoría** `LISTO` — toda modificación queda con cuándo, quién, qué tabla, qué
registro, alta/cambio/baja, y valor anterior y nuevo. Más registro de accesos, de errores, e
historial por usuario.

> **Lo que hay que mejorar para que sea usable** `CUSTOM`
>
> - "Modificado por" muestra el identificador interno en lugar del nombre.
> - La pantalla solo pagina: no filtra por tabla, usuario ni fecha.
> - **En la ficha de la cita no se ve quién la agendó.** El dato existe en `audit_log` pero hay
>   que ir a buscarlo. Mostrar *"agendada por Fulana el martes 14:32, modificada por Mengana"*
>   ahí mismo es exactamente lo que Javier pidió: 1–3 días.

---

## 9. Qué necesitamos de ustedes

Campos en **negrita** son obligatorios. Todo en Google Sheets, salvo pacientes que van en CSV.

| Qué | Volumen | Campos |
| --- | --- | --- |
| **Sedes** | 13 filas | **nombre** · dirección · teléfono · email. El nombre es el que ve la recepción en la columna de la agenda: conviene el nombre corto de uso interno. |
| **Salas o equipos por sede** | 13–26 filas | **sede** · **nombre de la sala** · color. Cuántos puestos simultáneos hay en cada sede. Define cuántas columnas ve la recepción. |
| **Horarios** | una fila por sede y día | **sede** · **día** · **hora inicio** · **hora fin**. Incluir los segundos turnos permanentes. |
| **Feriados y excepciones** | lo que resta del año | **fecha** · **abre sí/no** · hora inicio · hora fin · nota. Días que cierran, y días con horario distinto. |
| **Google Calendars** | 13 identificadores | **sede o sala** · **calendar id** (tiene forma de email, se copia de la config del calendario en Google). Además hay que **compartir los 13 con la cuenta de servicio** que les pasamos, con permiso de edición. |
| **Doctores derivadores** | los que quieran habilitar | **nombre** · email · teléfono · documento · ¿acceso a Mi Consultorio? — va **email o teléfono**, al menos uno. No hace falta habilitar a todos de entrada. |
| **Servicios y estudios** | el catálogo | **nombre** · **categoría** · **precio** · **duración en minutos** · moneda · indicaciones · color. **La duración es el campo crítico de toda la lista**: es lo que hace que la OPT ocupe 10 minutos. |
| **Operadores** | quienes agendan y atienden | **nombre** · **email** · **rol** · sede habitual. Dimensiona la licencia, conviene tenerla completa antes de arrancar. |
| **Pacientes** | CSV, carga masiva | **nombre** · **documento de identidad** · email · teléfono · fecha de nacimiento · dirección. El documento es obligatorio porque es la llave con que el paciente entra al portal. |
| **Marca y datos de la clínica** | una vez | **razón social** · **logo** · RUT · dirección fiscal · teléfono. Van en reportes, comprobantes, emails y el volante con QR. |

> **Por qué se carga a mano y no todo por planilla.** La importación masiva hoy procesa
> **pacientes**. Las demás entidades tienen la pantalla pero el backend no las resuelve, y
> **doctores no tiene importación** en ningún caso.
>
> No frena nada: 13 sedes, ~20 salas, ~40 horarios y el catálogo de estudios se cargan en una
> jornada. El padrón de pacientes, que es el volumen real, entra por CSV.

---

## 10. Hoy, pasado mañana, en un mes

Luis y Javier coincidieron en la reunión en ir por fases y no intentar todo de una.

### HOY — solo configuración, cero código

13 sedes, salas, horarios y feriados · slots de 10 min y densidad regulable · catálogo de
estudios con duración propia · doctores derivadores y usuarios por operador con roles ·
sincronización con los 13 Google Calendars · agenda multi-sede en columnas paralelas · panel de
huecos y solapamientos visibles · estados de cita, cancelación con motivo, reprogramación ·
reasignación masiva de doctor · sesión clínica con informe y adjuntos · Mi Consultorio ·
recordatorios y notas sobre la agenda · pantalla de TV para sala de espera · reportes de
ocupación y cancelaciones con export · presupuesto, factura y pago ligados a la cita · Cobro
Rápido y caja multimoneda · plantillas de impresión, email y WhatsApp · registro de auditoría ·
carga masiva del padrón de pacientes.

### PASADO MAÑANA — ajustes de 1 a 3 días cada uno

1. **Cerrar el control de acceso del portal de pacientes.** Bloqueante: va primero, y sin esto el portal no se habilita.
2. Habilitar el visor de estudios al rol Doctor.
3. Mostrar **quién agendó y quién editó** en la ficha de la cita.
4. Nombre real y filtros en la pantalla de auditoría.
5. **Reporte de demoras y puntualidad**, con los estados que ya se guardan desde el día uno.
6. Filtro por sede en agenda y reportes.
7. Recordatorio automático por WhatsApp antes de la cita, con el motor de alertas existente.
8. Vocabulario de Clínica Imagen en toda la interfaz: estudio, derivador, sede, OPT.

### EN UN MES — desarrollo, por prioridad

1. **Orden web nativa** — el odontólogo genera la orden desde Mi Consultorio, la cita nace `pending`, y le entra un WhatsApp al paciente estando todavía en el consultorio. Es la meta que Javier puso para mayo.
2. **Drag & drop de citas** en la agenda.
3. Reporte de solapamientos y ocupación real contra capacidad.
4. **Integración con Image Cloud por API** — alta del paciente y del estudio desde InvokeIA, y estado del estudio de vuelta. Elimina el retipeo y el permiso manual caso por caso.
5. **Informe clínico como documento** — plantilla por tipo de estudio, estado borrador/validado/entregado, envío al derivador.
6. Campo propio de derivador, si hace falta separarlo del ejecutor en los reportes.
7. Importación masiva del resto de las entidades, y de doctores.
8. **Bot de atención** entrenado con el histórico de Watique, con derivación a operador y respuesta a la pregunta del doctor: *"¿en qué etapa está el estudio?"*.
9. **Facturación electrónica** — desarrollo propio o integración con Facturap.

### El orden que recomendamos

Arrancar por la agenda sola: es lo que Javier pidió y lo que tiene retorno inmediato — resuelve
la visibilidad de las 13 sedes, la trazabilidad y los 10 minutos de la OPT, y no depende de
nadie más. La sesión clínica y Mi Consultorio entran atrás casi sin costo porque cuelgan de la
misma cita. El portal de pacientes en la semana 2, después del control de acceso. Y la orden web
con WhatsApp automático — el verdadero premio, porque fideliza al odontólogo y descarga la
central telefónica — arranca cuando la agenda ya esté en producción con datos reales.

---

## 11. Cronograma de dos semanas

Javier lo dijo así: *"la agenda está semana a semana, en dos semanas no pasa nada"*. Ese es el
margen que hace viable el corte.

| Cuándo | Qué | Detalle |
| --- | --- | --- |
| **Miércoles 8:00, esta semana** | Reunión con Federico | Recorrido por atención al cliente y por la vista del contador (§7). En paralelo dejamos armado el ambiente de prueba y Dulce genera un usuario para revisar cómo se ve la agenda web. |
| **Días 1–2** | Nos pasan las planillas de §9 | Sedes, salas, horarios, feriados, calendar ids, doctores, catálogo y operadores. El padrón de pacientes puede venir después. |
| **Días 2–3** | Configuración completa y licencia dimensionada | 13 sedes con salas, horarios y feriados; catálogo con duraciones reales; doctores; usuarios con rol. Cada operador recibe su enlace para poner contraseña. |
| **Día 4** | Conexión con Google Calendar e importación | Se conectan los 13 calendarios y corre la primera ingesta. Desde acá, todo lo que se agende en InvokeIA aparece también en Google. |
| **Día 5** | Capacitación de recepción y central | Sobre datos reales: agendar, reprogramar, cancelar con motivo, panel de huecos, marcar llegada, cerrar la sesión clínica. Se explica por qué se marca "llegó tarde" — es lo que alimenta el reporte de demoras. |
| **Semana 2, días 1–3** | Operación en paralelo con soporte en vivo | Se agenda en InvokeIA y se mira en Google para comparar. Arrancan las customizaciones de fase 2, con el control de acceso del portal primero. |
| **Semana 2, día 4** | **Corte** | Se deja de cargar en Google Calendar. InvokeIA pasa a ser la agenda; Google queda recibiendo el reflejo. |
| **Semana 2, día 5** | Alta de doctores y del portal | Mi Consultorio a la primera tanda de derivadores — conviene empezar por los 30 que representan el 35% de la facturación, que Javier identificó como prioritarios. Y con el control de acceso cerrado, se abre el portal con su QR en cada mostrador. |

> **Sobre la resistencia interna.** Javier trajo el tema y vale dejarlo dicho, porque es la
> variable que más veces hunde una implementación buena: el temor de perder el contacto humano
> con el cliente.
>
> Nada de la fase 1 responde por nadie. La agenda, la sesión clínica y Mi Consultorio le quitan
> tipeo al equipo, no conversación. Lo único que responde solo es el recordatorio de cita — y
> eso es trabajo que hoy nadie quiere hacer. El bot de atención, que es lo que dispara la
> preocupación, está en fase 3 y con derivación a operador desde el primer día. Conviene que la
> capacitación del día 5 lo diga con esas palabras.

---

## 12. Anexo técnico

Todo lo afirmado arriba está verificado contra el código, no supuesto.

### Entidades y vínculos

| Concepto | Entidad | Notas |
| --- | --- | --- |
| Sede | `Sede` | `types.ts:893`. CRUD en `config/sedes/`, endpoints `/sedes` y `/sede`. |
| Sala / consultorio | `Calendar` | `types.ts:905`. No hay entidad de sala aparte. `sede_id` obligatorio en el form; `google_calendar_id` validado como email. |
| Cita | `Appointment` | `types.ts:630`. **Sin `sede_id`**: la sede se infiere por `calendar_source_id → Calendar.sede_id`. **Sin `created_by`/`updated_by`**. |
| Doctor derivador | `User` con `filter_type=DOCTOR` | No hay entidad doctor propia. `Appointment.doctorId`. Lectura por `/users/doctors`. |
| Estudio / servicio | `Service` | `types.ts:464`. `duration_minutes`, `service_type: single\|workflow`, `treatment_steps[]`. Categoría es string libre alimentado por `/misc_categories`. |
| Informe | `PatientSession` | `types.ts:981`. **`appointment_id`** es el vínculo a la cita. Además `quote_id`, `invoice_id`, `archivos_adjuntos[]`. |
| Horario de sede | `ClinicSchedule` / `ClinicException` | `types.ts:510,518`. `config/schedules/` y `config/holidays/`. |

### Configuración de agenda que cubre los dolores citados

| Ajuste | Dónde | Valores |
| --- | --- | --- |
| Duración de slot | `CalendarSettings.slot_duration` | `SLOT_DURATION_OPTIONS = [10,15,20,30,60]`, default 15 — `calendar-constants.ts:40` |
| Densidad vertical | `CalendarSettings.hour_height` | 60–200 px, 8 opciones. Piso por slot: `MIN_SLOT_HEIGHT=24` |
| Columnas paralelas | `CalendarGroupBy` | `'none' \| 'doctor' \| 'calendar'`. **`'sede'` aparece en `appointments/page.tsx:130` pero no está implementado** — usar 1 calendario por sede. |
| Bloqueo fuera de horario | `block_unavailable` | `calendar-blocked-overlay.tsx`, resuelto contra schedules + exceptions |
| Huecos | `calendar-gaps.ts` | `DEFAULT_MIN_GAP_MINUTES=10`, ventana por defecto 09:00–19:00 |
| Solapamiento | `getEventsWithLayout()` | `calendar-utils.ts:291-367` asigna `column`/`totalColumns`. Advertencia al crear, **no bloqueo**. |
| Agenda única | `CalendarSettings.mode` | `CALENDAR_MODES = ['invoke','custom']` |

### Sincronización con Google Calendar

Todo en `docs/n8n-flows/All Appointment Workflows.json`. No hay `googleapis` ni OAuth en el
frontend: la sync vive entera en n8n.

- **Salida** — `Create / Update / Delete GCal Event`, calendario tomado de
  `Get_calendar_data.google_calendar_id`. Disparado desde `appointments/upsert` y
  `appointments/delete`. `google_event_id` se persiste en la cita.
- **Entrada** — `Schedule Trigger` a las 06:00 → `Get_Active_Calendars` (`calendar_sources`
  activos con `google_calendar_id` no vacío) → `Loop_Calendars` → `Get_Calendar_Events`
  (`returnAll`, `timeMax = $now + 1 month`) → `Map_Events` → `Insert_If_Missing`.
- **Límite del insert** — `INSERT ... WHERE NOT EXISTS (google_event_id, calendar_source_id)`
  con columnas `calendar_source_id, google_event_id, summary, status, start_datetime,
  end_datetime, color, notes`. **Sin `patient_id`, sin update, sin delete.** Es ingesta
  idempotente, no espejo.

### Gaps con ubicación

| Gap | Estado | Evidencia |
| --- | --- | --- |
| Portal de pacientes sin `assert_self_or_staff` | `BLOQUEANTE` | 0 hits en `docs/n8n-flows/` y `n8n-workflows/`. `docs/patient-portal.md §1` lo marca obligatorio. Además el botón Reservar en `/my-profile` no consulta `online_booking_enabled`, y falta rate-limit por IP en `/api/auth/patient/register`. |
| Sin drag & drop de citas | `DESARROLLO` | Ninguna librería DnD en `package.json`; los `onDrop` del repo son dropzones de archivos. Existe reprogramación por diálogo y modo inline (`use-appointment-reschedule.ts`, `/appointments/reschedule`). |
| Quién agendó no visible en la cita | `CUSTOM` | `Appointment` sin `created_by`. Reconstruible desde `audit_log` por `table_name='appointments'` + `record_id`. `system/audit/page.tsx` muestra `changed_by` crudo y solo pagina. |
| Reporte de demoras | `CUSTOM` | `arrived_late` y `attended_late` existen en `constants/appointment-status.ts` y se persisten, pero ningún reporte los mide. |
| Sin filtro por sede en reportes | `CUSTOM` | 0 hits de sede en `src/app/[locale]/reports/`. Se filtra por `calendar_id`. Mitigación: convención `Sede · Sala`. |
| Visor de estudios sin permisos por defecto | `CUSTOM` | `nav.ts:146-147` pide `DICOM_VIEW_STUDIES` / `DICOM_VIEW_SHARED_STUDIES`; `default-role-permissions.ts` no los concede a ningún rol. |
| Importación masiva solo pacientes | `DESARROLLO` | `n8n-workflows/import-data.json`: el `Switch: Entidad` tiene una sola salida; el resto cae en "Entidad No Soportada" → `skipped`. `IMPORT_SCHEMAS` no tiene `doctors`. Tickets en `docs/import-tickets.md`. `CLINIC_HISTORY.USERS_IMPORT` declarado y sin uso. |
| Sin entidad estudio ni orden de estudio | `DESARROLLO` | `/studies` y `/shared-studies` son iframes de 19 líneas a `viewer.invokeia.com`. |
| Sin informe como entidad ni firma | `DESARROLLO` | 0 hits de "informe" en `es.json`. Lo que hay es `PatientSession` + `DocPrintTemplate` + `MedicalInstructionTemplate`. |
| Sin facturación electrónica | `DESARROLLO` | 0 rastros de CFE/DGI/timbrado. `InvoiceItem` sin campo de impuesto. Solo secuencias internas en `config/sequences`. |
| Sin especialidad ni matrícula del doctor | `DESARROLLO` | 0 hits de `specialty\|especialidad\|matricula\|license_number` en `src/`. |
| Sin recurrencia, lista de espera ni overbooking | `DESARROLLO` | La recurrencia solo existe en `AvailabilityRule`, no en citas. |
| Exportar PDF = `window.print()` | `DESARROLLO` | `hooks/use-report-export.ts`. CSV y Excel sí son reales (`xlsx` + `jszip`). No hay jsPDF ni puppeteer. |

### Enlace cita → facturación

- `Appointment.quote_id`, `quote_doc_no`, `invoice_id`, `treatment_seq_step_id`.
- `services/billing-links.ts`: `linkInvoiceToAppointment` (`/appointments/link_invoice`), `linkInvoiceToClinicSession`, `linkInvoiceToOdontogramSession`.
- `services/billing-preflight.ts`: `fetchAppointmentBillingState` relee `invoice_id`/`quote_id` antes de cobrar.
- Inversas: `/quote_appointments`, `/quote_clinic_sessions`. Agendar línea de presupuesto: `/quote/lines/schedule`.
- Cobro Rápido: `stores/billing-wizard-store.ts` — `BillingTriggerContext` acepta `appointmentId`. Doc: `docs/cobro-rapido-billing-wizard.md`.
- Ledger unificado: `lib/patient-ledger.ts`, `docs/patient-ledger-cuenta-unificada.md`.

### Aprovisionamiento y licencia

- Cinco variables en runtime vía `window.__INVOKEIA_RUNTIME_CONFIG__`: `NEXT_PUBLIC_API_URL`, `LICENSE_KEY`, `MASTER_SEC`, `CLIENT_ID`, `EVENT_PUSHER_KEY`. Siempre por `lib/runtime-config.ts`. Doc: `docs/runtime-config.md`.
- Overrides de vocabulario: `src/messages/overrides/<clientId>/{es,en}.json`, deep-merge en `src/i18n.ts:32`. Referencia existente: `overrides/bracketsup/`.
- Licencia: `LicensePayload` limita `maxDoctors`, `maxReceptionists`, `maxAdmins`, `maxSuperAdmins`, `maxMonthlyNewPatients`, `aiAccess`. `system/staff` valida cupo contra `/reports/users-by-role`. **Dimensionar antes de crear los usuarios de las 13 sedes.**
- No hay script de aprovisionamiento: base con Liquibase (`db:setup`) + `seed_default_role_permissions.sql` + scripts `0xx_*.sql`, instancia n8n con los flujos, contenedor con las 5 variables, licencia por `/system/licenses`.
- **Dos fuentes de verdad para permisos por defecto**: `src/constants/default-role-permissions.ts` está huérfano (0 usos) y la siembra real la hace `seed_default_role_permissions.sql` con ids fijos. Pueden divergir.

### Piezas para la fase 3

- **Orden web + WhatsApp** — el motor de alertas ya tiene reglas con `days_before/after` y plantillas por canal; `whatsapp-template-defaults.ts` trae `APPOINTMENT_REMINDER_WHATSAPP`. Envío por `/patients/send_whatsapp_template`. Falta el disparo desde la creación de la orden y la auto-reserva de slot.
- **Mecanismo de hooks** (`docs/hooks-mechanism.md`, script `069`) — útil para instrumentar la fase 3 sin tocar los flujos base. Catálogo actual: solo `invoice.before_upsert`, `invoice.after_upsert`, `appointment.after_create`. Ningún flujo productivo lo invoca todavía, no hay pantalla de `hook_execution_log` ni poda agendada.
- **Notificaciones en vivo** — SSE por `/events/stream` con `X-Api-Key`; requiere `CLIENT_ID` y `EVENT_PUSHER_KEY` o se desactiva en silencio. Canales por rol en `constants/notification-channels.ts`.
- `/communications/channels` usa datos mock de `lib/data.ts:121` — pantalla sin backend, **no mostrarla en la demo**.
