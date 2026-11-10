# Scripts de base de datos (DEV)

Dos scripts para dejar la base de **DEV** limpia y con datos de demo coherentes.
**Nunca** correrlos contra la base de un cliente.

| Script | Qué hace |
| --- | --- |
| `dev-cleanup.sql` | Borra datos importados, E2E y basura: todo lo transaccional, todos los usuarios salvo `__system__`, el agente de WhatsApp, `raidel@invokeia.com` (E2E_USER) y `markmm82@gmail.com`, el catálogo de servicios, padecimientos y medicamentos. Conserva la configuración (clínica, sedes, cajas, métodos de pago, roles, permisos, plantillas, alertas, feriados, calendarios). |
| `dev-seed.sql` | Crea servicios, 6 doctores y 2 recepcionistas, 155 pacientes (15 menores), agenda de −90 a +21 días, sesiones clínicas, odontogramas, periodontogramas, sesiones estéticas, presupuestos, órdenes, facturas, pagos y cajas diarias. Todo lleva `seed:` en `external_id` / `internal_id`. |

Se pegan enteros en el **Query Tool de pgAdmin** y se ejecutan con F5, en este orden:

1. `dev-cleanup.sql`
2. `dev-seed.sql`

Cada uno corre en una sola transacción (`BEGIN … COMMIT`) y termina con una consulta de resumen, que es lo que pgAdmin muestra en la grilla.

- Para probar sin aplicar, cambiar el `COMMIT` del final por `ROLLBACK` (el resumen del seed saldrá en cero porque se deshizo).
- Si una ejecución falla, la transacción queda abortada: ejecutar `ROLLBACK;` antes de reintentar.

Notas:

- El seed exige una base sin datos `seed:` previos: para regenerar, correr primero el cleanup.
- El seed desactiva solo `trigger_appointment_change` (pg_notify hacia la sincronización con Google Calendar) mientras inserta citas; los triggers financieros quedan activos, así `doc_no`, estados de pago y saldos (`user_balances`) se calculan igual que en la app.
- Correos `@example.com` (no entregables). Los teléfonos son inventados con formato uruguayo: si el envío automático de alertas por WhatsApp está activo en DEV, puede intentar escribirles.
- Los usuarios del seed no tienen contraseña; para entrar se usa `E2E_USER`.
