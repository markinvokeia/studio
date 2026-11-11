# Scripts de base de datos (DEV)

Dos scripts para dejar la base de **DEV** limpia y con datos de demo coherentes.
**Nunca** correrlos contra la base de un cliente.

| Script | Qué hace |
| --- | --- |
| `dev-cleanup.sql` | Borra datos importados, E2E y basura: todo lo transaccional, todos los usuarios salvo `__system__`, el agente de WhatsApp, `raidel@invokeia.com` (E2E_USER) y `markmm82@gmail.com`, el catálogo de servicios, padecimientos y medicamentos. Conserva la configuración (clínica, sedes, cajas, métodos de pago, roles, permisos, plantillas, alertas, feriados, calendarios). |
| `dev-seed.sql` | Crea servicios, 6 doctores y 2 recepcionistas, 155 pacientes (15 menores), agenda de −90 a +21 días, sesiones clínicas, odontogramas, periodontogramas, sesiones estéticas, presupuestos, órdenes, facturas, pagos y cajas diarias. Todo lleva `seed:` en `external_id` / `internal_id`. |
| `dev-seed-reports.sql` | Datos para los reportes: historia de ~15 meses antes del seed (agenda, sesiones, ventas en UYU y USD, pagos diferidos y deudas viejas), 40 pacientes inactivos (8 con alta médica) y 10 nuevos, presupuestos en todos los estados, servicios en flujo con planes de tratamiento, gastos operativos mensuales con su movimiento de caja, proveedores con facturas de compra, nómina (honorarios con % de productividad) y grupos de servicios. Recalcula el cierre de todas las cajas del seed. Si falta, crea la secuencia de numeración `miscellaneous`. |

Se pegan enteros en el **Query Tool de pgAdmin** y se ejecutan con F5, en este orden:

1. `dev-cleanup.sql`
2. `dev-seed.sql`
3. `dev-seed-reports.sql` (opcional; ~30 s)

Cada uno corre en una sola transacción (`BEGIN … COMMIT`) y termina con una consulta de resumen, que es lo que pgAdmin muestra en la grilla.

- Para probar sin aplicar, cambiar el `COMMIT` del final por `ROLLBACK` (el resumen del seed saldrá en cero porque se deshizo).
- Si una ejecución falla, la transacción queda abortada: ejecutar `ROLLBACK;` antes de reintentar.

Notas:

- El seed exige una base sin datos `seed:` previos: para regenerar, correr primero el cleanup.
- `dev-seed-reports.sql` exige que `dev-seed.sql` ya esté aplicado y que él mismo no se haya corrido antes (detecta citas `seed:hist:` o gastos con `tags = {seed}`).
- El seed desactiva solo `trigger_appointment_change` (pg_notify hacia la sincronización con Google Calendar) mientras inserta citas; los triggers financieros quedan activos, así `doc_no`, estados de pago y saldos (`user_balances`) se calculan igual que en la app.
- Correos `@example.com` (no entregables). Los teléfonos son inventados con formato uruguayo: si el envío automático de alertas por WhatsApp está activo en DEV, puede intentar escribirles.
- Los usuarios del seed no tienen contraseña; para entrar se usa `E2E_USER`.
