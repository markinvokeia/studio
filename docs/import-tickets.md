# Tickets: Implementar importación masiva de entidades faltantes

El frontend ya tiene el wizard completo (6 pasos: selección, upload, preview, mapeo, validación, resultado) y los schemas definidos en `src/config/import-schemas.ts`. El backend n8n (`n8n-workflows/import-data.json`) tiene el flujo base con el loop y el `Switch: Entidad` funcionando para `patients`. Cada ticket agrega un nuevo `case` al switch con sus nodos de búsqueda, inserción y actualización.

> **Patrón base a replicar en cada ticket:**
> 1. Agregar output al nodo `Switch: Entidad` con la clave de la entidad
> 2. `Buscar X` → PostgreSQL SELECT para deduplicación
> 3. `¿X Existe?` → IF node
> 4. `Preparar Actualización X` → Code node que combina datos del loop con el id encontrado
> 5. `Actualizar X` → PostgreSQL UPDATE RETURNING id
> 6. `Marcar Actualizado X` → Code node que produce `{ _status: 'updated', ... }`
> 7. `Preparar Inserción X` → Code node que toma datos del loop
> 8. `Insertar X` → PostgreSQL INSERT RETURNING id
> 9. `Marcar Insertado X` → Code node que produce `{ _status: 'inserted', ... }`
> 10. Ambas ramas de "Marcar" se conectan al nodo `Agregar Resultados` existente

---

## TICKET 1 — Importar Servicios (`services`)

### Descripción
Implementar el branch `services` en el flujo n8n de importación masiva para crear o actualizar servicios del catálogo.

### Formato del CSV

| Columna | Tipo | Requerido | Notas |
|---|---|---|---|
| `name` | text | ✅ | Nombre del servicio |
| `category` | text | ✅ | Categoría (texto libre) |
| `price` | number | ✅ | Precio sin símbolo |
| `duration_minutes` | number | ✅ | Entero positivo |
| `currency` | enum | — | `USD` o `UYU` (default: UYU) |
| `description` | text | — | |
| `indications` | text | — | Indicaciones post-tratamiento |
| `color` | text | — | Formato `#RRGGBB` |
| `is_active` | boolean | — | `true`/`false` (default: true) |

**Ejemplo:**
```
name,category,price,duration_minutes,currency,description,is_active
Limpieza Dental,Preventivo,1500,45,UYU,Profilaxis completa,true
Extracción Simple,Cirugía,2000,30,UYU,,true
Implante Unitario,Implantología,800,90,USD,,true
```

### Tabla en BD
`catalogoservicios` (o la tabla que use el endpoint `/services`)

**Columnas relevantes:**
```sql
id              uuid  PK
name            text  NOT NULL
category        text  NOT NULL
price           numeric(12,2)
duration_minutes integer
currency        varchar(3)  DEFAULT 'UYU'
description     text
indications     text
color           varchar(7)
is_active       boolean     DEFAULT true
created_at      timestamptz DEFAULT now()
updated_at      timestamptz
```

### Validaciones (frontend — `StepValidate`)
- `name`: no puede estar vacío
- `category`: no puede estar vacío
- `price`: debe ser número ≥ 0
- `duration_minutes`: debe ser entero ≥ 1
- `currency`: si se provee, debe ser exactamente `USD` o `UYU`
- `color`: si se provee, debe coincidir con `/^#[0-9A-Fa-f]{6}$/`

### Backend n8n

**Deduplicación:** Por `name` (exacto, case-insensitive).

```sql
-- Buscar Servicio
SELECT id FROM catalogoservicios
WHERE LOWER(name) = LOWER($1)
LIMIT 1
```

```sql
-- Actualizar Servicio
UPDATE catalogoservicios SET
  category         = CASE WHEN $2 <> '' THEN $2        ELSE category         END,
  price            = CASE WHEN $3 <> '' THEN $3::numeric ELSE price           END,
  duration_minutes = CASE WHEN $4 <> '' THEN $4::int   ELSE duration_minutes  END,
  currency         = CASE WHEN $5 <> '' THEN $5        ELSE currency          END,
  description      = CASE WHEN $6 <> '' THEN $6        ELSE description       END,
  indications      = CASE WHEN $7 <> '' THEN $7        ELSE indications       END,
  color            = CASE WHEN $8 <> '' THEN $8        ELSE color             END,
  is_active        = CASE WHEN $9 <> '' THEN $9::boolean ELSE is_active       END,
  updated_at       = CURRENT_TIMESTAMP
WHERE id = $1::uuid
RETURNING id
```

```sql
-- Insertar Servicio
INSERT INTO catalogoservicios (name, category, price, duration_minutes, currency, description, indications, color, is_active)
VALUES ($1, $2, $3::numeric, $4::int, COALESCE(NULLIF($5,''),'UYU'), NULLIF($6,''), NULLIF($7,''), NULLIF($8,''), COALESCE(NULLIF($9,'')::boolean, true))
RETURNING id
```

**Campo `_name`** para el reporte de errores: usar `name`.

---

## TICKET 2 — Importar Presupuestos (`quotes`)

### Descripción
Implementar el branch `quotes` para importar presupuestos (cabecera + línea) desde CSV. Cada fila del CSV representa **una línea de presupuesto**. Si el paciente ya tiene un presupuesto en estado `draft` creado en la misma importación (mismo batch), las líneas subsiguientes se agregan a ese presupuesto. Si no, se crea uno nuevo.

> **Estrategia simplificada:** Cada fila crea una quote independiente (una cabecera + una línea). La agrupación multi-línea puede ser scope de una iteración futura.

### Formato del CSV

| Columna | Tipo | Requerido | Notas |
|---|---|---|---|
| `patient_name` | text | ✅ | Se resuelve a `user_id` |
| `service_name` | text | ✅ | Se resuelve a `service_id` |
| `quantity` | number | ✅ | Entero ≥ 1 |
| `unit_price` | number | ✅ | Precio por unidad |
| `currency` | enum | — | `USD` o `UYU` (default: UYU) |
| `tooth_number` | number | — | Número de diente ISO 3950 |
| `notes` | text | — | Notas de la línea |
| `status` | enum | — | `draft`/`sent`/`accepted`/`rejected`/`pending` (default: `draft`) |

**Ejemplo:**
```
patient_name,service_name,quantity,unit_price,currency,tooth_number,notes,status
Juan Pérez,Limpieza Dental,1,1500,UYU,,,draft
Ana García,Extracción Simple,1,2000,UYU,36,,draft
Carlos López,Implante Unitario,2,800,USD,,,sent
```

### Tablas en BD

**`quotes`** (cabecera):
```sql
id          uuid  PK
user_id     uuid  FK users
currency    varchar(3)
status      varchar(20)  DEFAULT 'draft'
notes       text
created_at  timestamptz
updated_at  timestamptz
```

**`quote_items`** (líneas):
```sql
id          uuid  PK
quote_id    uuid  FK quotes
service_id  uuid  FK catalogoservicios (nullable)
description text
quantity    integer
unit_price  numeric(12,2)
tooth_number integer
notes       text
```

### Validaciones (frontend)
- `patient_name`: no vacío
- `service_name`: no vacío
- `quantity`: entero ≥ 1
- `unit_price`: número ≥ 0
- `currency`: si se provee, `USD` o `UYU`
- `status`: si se provee, uno de los valores del enum
- `tooth_number`: si se provee, entero entre 11 y 85 (norma ISO 3950)

### Backend n8n

**Paso 1 — Resolver `patient_name` → `user_id`:**
```sql
SELECT id FROM users WHERE is_sales = true AND LOWER(name) = LOWER($1) LIMIT 1
```
Si no se encuentra: marcar fila como error `"Paciente '{name}' no encontrado"`.

**Paso 2 — Resolver `service_name` → `service_id`:**
```sql
SELECT id FROM catalogoservicios WHERE LOWER(name) = LOWER($1) LIMIT 1
```
Si no se encuentra: continuar con `service_id = NULL` y usar `service_name` como `description`.

**Paso 3 — Crear cabecera del presupuesto:**
```sql
INSERT INTO quotes (user_id, currency, status, notes)
VALUES ($1::uuid, COALESCE(NULLIF($2,''),'UYU'), COALESCE(NULLIF($3,''),'draft'), NULLIF($4,''))
RETURNING id
```

**Paso 4 — Crear línea del presupuesto:**
```sql
INSERT INTO quote_items (quote_id, service_id, description, quantity, unit_price, tooth_number, notes)
VALUES ($1::uuid, NULLIF($2,'')::uuid, $3, $4::int, $5::numeric, NULLIF($6,'')::int, NULLIF($7,''))
RETURNING id
```

**No hay UPDATE** en esta entidad — cada fila siempre crea un nuevo presupuesto.
**Campo `_name`** para el reporte de errores: usar `patient_name`.

---

## TICKET 3 — Importar Facturas (`invoices`)

### Descripción
Implementar el branch `invoices` para crear facturas con una línea de servicio. Equivale a una venta directa (sin orden previa). Cada fila del CSV = 1 factura + 1 ítem.

### Formato del CSV

| Columna | Tipo | Requerido | Notas |
|---|---|---|---|
| `patient_name` | text | ✅ | Se resuelve a `user_id` |
| `service_name` | text | ✅ | Se resuelve a `service_id` |
| `quantity` | number | ✅ | Entero ≥ 1 |
| `unit_price` | number | ✅ | Precio por unidad |
| `currency` | enum | — | `USD` o `UYU` (default: UYU) |
| `notes` | text | — | |
| `status` | enum | — | `draft`/`sent`/`paid`/`overdue` (default: `draft`) |

**Ejemplo:**
```
patient_name,service_name,quantity,unit_price,currency,notes,status
Juan Pérez,Limpieza Dental,1,1500,UYU,,paid
Ana García,Extracción Simple,1,2000,UYU,,draft
```

### Tablas en BD

**`invoices`** (cabecera):
```sql
id          uuid  PK
user_id     uuid  FK users
currency    varchar(3)
status      varchar(20)  DEFAULT 'draft'
notes       text
total       numeric(12,2)
created_at  timestamptz
updated_at  timestamptz
```

**`invoice_items`** (líneas):
```sql
id          uuid  PK
invoice_id  uuid  FK invoices
service_id  uuid  FK catalogoservicios (nullable)
description text
quantity    integer
unit_price  numeric(12,2)
total       numeric(12,2)
```

### Validaciones (frontend)
- Idénticas a Quotes excepto que `status` válidos son `draft`/`sent`/`paid`/`overdue`
- `unit_price`: número ≥ 0
- `quantity`: entero ≥ 1

### Backend n8n

**Paso 1 — Resolver `patient_name` → `user_id`:** igual que Quotes.
**Paso 2 — Resolver `service_name` → `service_id`:** igual que Quotes.

**Paso 3 — Calcular total:**
```javascript
const total = parseFloat(record.unit_price || 0) * parseInt(record.quantity || 1);
```

**Paso 4 — Crear cabecera de factura:**
```sql
INSERT INTO invoices (user_id, currency, status, notes, total)
VALUES ($1::uuid, COALESCE(NULLIF($2,''),'UYU'), COALESCE(NULLIF($3,''),'draft'), NULLIF($4,''), $5::numeric)
RETURNING id
```

**Paso 5 — Crear ítem de factura:**
```sql
INSERT INTO invoice_items (invoice_id, service_id, description, quantity, unit_price, total)
VALUES ($1::uuid, NULLIF($2,'')::uuid, $3, $4::int, $5::numeric, $6::numeric)
RETURNING id
```

**No hay UPDATE** — siempre se inserta.
**Campo `_name`** para el reporte de errores: usar `patient_name`.

---

## TICKET 4 — Importar Pagos (`payments`)

### Descripción
Implementar el branch `payments` para registrar pagos históricos. Se crean como prepagos (saldo a favor) vinculados al paciente, sin asociar a una factura específica. Si se requiere asociar a factura, puede ser scope futuro.

### Formato del CSV

| Columna | Tipo | Requerido | Notas |
|---|---|---|---|
| `patient_name` | text | ✅ | Se resuelve a `user_id` |
| `amount` | number | ✅ | Monto positivo |
| `payment_method` | text | ✅ | Se resuelve a `metodo_pago_id` por nombre |
| `date` | date | ✅ | Formato `YYYY-MM-DD` |
| `currency` | enum | — | `USD` o `UYU` (default: UYU) |
| `notes` | text | — | |

**Ejemplo:**
```
patient_name,amount,payment_method,date,currency,notes
Juan Pérez,2500,Efectivo,2024-03-15,UYU,Pago parcial consulta
Ana García,800,Transferencia,2024-03-20,USD,
```

### Tabla en BD

**`payments`** (o la tabla que use el endpoint `/all_payments`):
```sql
id                uuid  PK
user_id           uuid  FK users
metodo_pago_id    uuid  FK metodospago (nullable)
amount            numeric(12,2)
currency          varchar(3)
payment_date      date
notes             text
type              varchar(20)  DEFAULT 'prepago'
created_at        timestamptz
```

### Validaciones (frontend)
- `patient_name`: no vacío
- `amount`: número > 0
- `payment_method`: no vacío
- `date`: formato `YYYY-MM-DD`, no fecha futura
- `currency`: si se provee, `USD` o `UYU`

### Backend n8n

**Paso 1 — Resolver `patient_name` → `user_id`:** igual que Quotes.

**Paso 2 — Resolver `payment_method` → `metodo_pago_id`:**
```sql
SELECT id FROM metodospago WHERE LOWER(name) = LOWER($1) LIMIT 1
```
Si no se encuentra: continuar con `metodo_pago_id = NULL` (no bloquear la importación, guardar el nombre en `notes`).

**Paso 3 — Insertar pago:**
```sql
INSERT INTO payments (user_id, metodo_pago_id, amount, currency, payment_date, notes, type)
VALUES ($1::uuid, NULLIF($2,'')::uuid, $3::numeric, COALESCE(NULLIF($4,''),'UYU'), $5::date, NULLIF($6,''), 'prepago')
RETURNING id
```

**No hay UPDATE** — los pagos siempre se insertan como nuevos.
**Campo `_name`** para el reporte de errores: usar `patient_name`.

---

## TICKET 5 — Importar Citas (`appointments`)

### Descripción
Implementar el branch `appointments` para importar citas históricas o futuras. No se valida disponibilidad (eso es scope del flujo interactivo). Se crea directamente el evento.

### Formato del CSV

| Columna | Tipo | Requerido | Notas |
|---|---|---|---|
| `patient_name` | text | ✅ | Se resuelve a `user_id` |
| `doctor_name` | text | ✅ | Se resuelve a `doctor_id` |
| `date` | date | ✅ | Formato `YYYY-MM-DD` |
| `time` | text | ✅ | Formato `HH:mm` (24 horas) |
| `service_name` | text | — | Se resuelve a `service_id` |
| `calendar` | text | — | Nombre del calendario/consultorio |
| `notes` | text | — | |

**Ejemplo:**
```
patient_name,doctor_name,date,time,service_name,calendar,notes
Juan Pérez,Dr. García,2024-04-10,09:00,Limpieza Dental,Consultorio 1,
Ana García,Dr. Martínez,2024-04-10,10:30,Extracción Simple,Consultorio 2,Primera visita
```

### Tabla en BD

**`appointments`** (o la tabla del endpoint `/users_appointments`):
```sql
id              uuid  PK
patient_id      uuid  FK users
doctor_id       uuid  FK users
service_id      uuid  FK catalogoservicios (nullable)
calendar_id     uuid  FK calendars (nullable)
start_time      timestamptz
end_time        timestamptz
status          varchar(20)  DEFAULT 'confirmed'
notes           text
created_at      timestamptz
```

### Validaciones (frontend)
- `patient_name`: no vacío
- `doctor_name`: no vacío
- `date`: formato `YYYY-MM-DD`
- `time`: formato `HH:mm`, horas 0–23, minutos 0–59
- Combinación `date` + `time` debe ser una fecha/hora válida

### Backend n8n

**Paso 1 — Resolver `patient_name` → `patient_id`:**
```sql
SELECT id FROM users WHERE is_sales = true AND LOWER(name) = LOWER($1) LIMIT 1
```
Si no se encuentra: marcar fila como error.

**Paso 2 — Resolver `doctor_name` → `doctor_id`:**
```sql
SELECT id FROM users WHERE is_doctor = true AND LOWER(name) = LOWER($1) LIMIT 1
```
Si no se encuentra: marcar fila como error.

**Paso 3 — Resolver `service_name` → `service_id`** (opcional): igual que Quotes.

**Paso 4 — Resolver `calendar` → `calendar_id`** (opcional):
```sql
SELECT id FROM calendars WHERE LOWER(name) = LOWER($1) LIMIT 1
```

**Paso 5 — Construir `start_time`:**
```javascript
const startTime = `${record.date}T${record.time}:00`;
```

**Paso 6 — Insertar cita:**
```sql
INSERT INTO appointments (patient_id, doctor_id, service_id, calendar_id, start_time, status, notes)
VALUES ($1::uuid, $2::uuid, NULLIF($3,'')::uuid, NULLIF($4,'')::uuid, $5::timestamptz, 'confirmed', NULLIF($6,''))
RETURNING id
```

**No hay UPDATE** — las citas siempre se insertan.
**Campo `_name`** para el reporte de errores: usar `patient_name`.

---

## TICKET 6 — Importar Sesiones Clínicas (`clinical_sessions`)

### Descripción
Implementar el branch `clinical_sessions` para importar historial de sesiones de atención clínica de pacientes.

### Formato del CSV

| Columna | Tipo | Requerido | Notas |
|---|---|---|---|
| `patient_name` | text | ✅ | Se resuelve a `user_id` |
| `date` | date | ✅ | Fecha de la sesión, `YYYY-MM-DD` |
| `doctor_name` | text | — | Se resuelve a `doctor_id` |
| `diagnosis` | text | — | |
| `procedure` | text | — | Procedimiento realizado |
| `clinical_notes` | text | — | Notas clínicas libres |
| `next_appointment_plan` | text | — | Plan de próxima cita |
| `next_appointment_date` | date | — | Formato `YYYY-MM-DD` |

**Ejemplo:**
```
patient_name,date,doctor_name,diagnosis,procedure,clinical_notes,next_appointment_plan,next_appointment_date
Juan Pérez,2024-03-10,Dr. García,Caries grado II,Obturación resina,Sin complicaciones,Control en 6 meses,2024-09-10
Ana García,2024-03-11,Dr. Martínez,,Limpieza profunda,Paciente con sensibilidad,,
```

### Tabla en BD

**`patient_sessions`** (o `sesiones` según el endpoint `/sesiones/upsert`):
```sql
id                      uuid  PK
patient_id              uuid  FK users
doctor_id               uuid  FK users (nullable)
session_date            date
diagnosis               text
procedure_performed     text
clinical_notes          text
next_appointment_plan   text
next_appointment_date   date
created_at              timestamptz
updated_at              timestamptz
```

### Validaciones (frontend)
- `patient_name`: no vacío
- `date`: formato `YYYY-MM-DD`, no fecha futura
- `next_appointment_date`: si se provee, formato `YYYY-MM-DD` y debe ser posterior a `date`

### Backend n8n

**Paso 1 — Resolver `patient_name` → `patient_id`:** igual que Citas.

**Paso 2 — Resolver `doctor_name` → `doctor_id`** (opcional):
```sql
SELECT id FROM users WHERE is_doctor = true AND LOWER(name) = LOWER($1) LIMIT 1
```
Si no se encuentra: continuar con `doctor_id = NULL`.

**Paso 3 — Deduplicación** (evitar duplicar la misma sesión):
```sql
SELECT id FROM patient_sessions
WHERE patient_id = $1::uuid AND session_date = $2::date
LIMIT 1
```
Si ya existe: hacer UPDATE (agregar información si los campos nuevos no están vacíos).

**Paso 4 — Insertar sesión:**
```sql
INSERT INTO patient_sessions (patient_id, doctor_id, session_date, diagnosis, procedure_performed, clinical_notes, next_appointment_plan, next_appointment_date)
VALUES ($1::uuid, NULLIF($2,'')::uuid, $3::date, NULLIF($4,''), NULLIF($5,''), NULLIF($6,''), NULLIF($7,''), NULLIF($8,'')::date)
RETURNING id
```

**Paso 5 — Actualizar sesión** (si ya existe para ese paciente y fecha):
```sql
UPDATE patient_sessions SET
  doctor_id             = CASE WHEN $2 <> '' THEN $2::uuid ELSE doctor_id END,
  diagnosis             = CASE WHEN $3 <> '' THEN $3 ELSE diagnosis END,
  procedure_performed   = CASE WHEN $4 <> '' THEN $4 ELSE procedure_performed END,
  clinical_notes        = CASE WHEN $5 <> '' THEN $5 ELSE clinical_notes END,
  next_appointment_plan = CASE WHEN $6 <> '' THEN $6 ELSE next_appointment_plan END,
  next_appointment_date = CASE WHEN $7 <> '' THEN $7::date ELSE next_appointment_date END,
  updated_at            = CURRENT_TIMESTAMP
WHERE id = $1::uuid
RETURNING id
```

**Campo `_name`** para el reporte de errores: usar `patient_name`.

---

## Notas comunes para todos los tickets

- **Switch: Entidad** — agregar un output nuevo por entidad (`services`, `quotes`, `invoices`, `payments`, `appointments`, `clinical_sessions`). Todas las ramas fallback ya van al nodo `Entidad No Soportada` existente.
- **Resolución de nombres** — cuando un nombre no se encuentra en la BD, el comportamiento por defecto es marcar la fila como `error`. La excepción es `service_name` y `doctor_name` opcionales: se continúa con `NULL`.
- **`_name` en resultados** — todos los nodos "Marcar Insertado/Actualizado/Error" deben producir un `_name` legible para el reporte final (el campo más identificable de la entidad).
- **Nombres ambiguos** — si la búsqueda por nombre devuelve más de un resultado, tomar el primero (`LIMIT 1`). En el futuro se puede agregar un campo `identity_document` o `email` como desempate.
- **CSV de ejemplo** — actualizar `exampleCsvUrl` en `src/config/import-schemas.ts` para cada entidad una vez que se suba el archivo de ejemplo a Drive.
