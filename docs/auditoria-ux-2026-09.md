# Auditoría de UX: interacciones con el backend

_Fecha: 2026-09-23 · Rama: `test` · Referencia: skill [`ux-interaction-patterns`](../.claude/skills/ux-interaction-patterns/SKILL.md)_

Revisión de todo `src/` buscando los problemas descritos en la skill: acciones que se pueden disparar dos veces, diálogos que se cierran a mitad de una petición, errores que no se muestran, textos sin traducir y cargas fallidas que parecen listas vacías.

## Resumen

| # | Problema | Casos | Archivos | Severidad |
|---|---|---:|---:|---|
| 1 | Confirmaciones (`AlertDialogAction`) async sin bloqueo | 51 | 45 | Alta |
| 2 | Botones de envío de formulario sin bloqueo | 24 | 23 | Alta |
| 3 | Botones de acción async sin bloqueo | 24 | 18 | Alta |
| 4 | Diálogos de formulario que se cierran con la petición en curso | 12 | 9 | Media |
| 5 | Fallos silenciosos (acción o paso intermedio falla sin avisar) | 24 | 19 | Alta / media |
| 6 | Claves i18n inexistentes (el usuario ve la clave cruda) | 38 | 19 | Media |
| 7 | Errores de carga mostrados como "sin datos" | 300 | 118 | Media |
| 8 | Mutaciones sin timeout | 342 | — | Media |
| 9 | Búsquedas/filtros sin descartar respuestas viejas | 78 | 40 | Baja |
| 10 | Toasts con texto hardcodeado (sin i18n) | 75 | 22 | Baja |
| 11 | Clic de fila que atraviesa menús de acciones | 0 | 0 | Resuelto |

### Prioridad 0: dinero, caja y facturación

Estos casos pueden **duplicar movimientos económicos** con un doble clic o con una red lenta. Conviene corregirlos primero:

| Qué puede duplicarse | Dónde | Problema |
|---|---|---|
| Pago anticipado (ventas) | [sales/payments/page.tsx:873](../src/app/[locale]/sales/payments/page.tsx#L873) | Confirmación sin `preventDefault` ni `disabled` |
| Pago anticipado (diálogo de ventas) | [components/sales/payments/PrepaidFormDialog.tsx:312](../src/components/sales/payments/PrepaidFormDialog.tsx#L312) | Confirmación sin `preventDefault` ni `disabled` |
| Pago anticipado (compras) | [components/purchases/payments/PurchasePrepaidFormDialog.tsx:313](../src/components/purchases/payments/PurchasePrepaidFormDialog.tsx#L313) | Confirmación sin `preventDefault` ni `disabled` |
| Pago inteligente | [components/sales/payments/SmartPaymentFormDialog.tsx:502](../src/components/sales/payments/SmartPaymentFormDialog.tsx#L502) | Tiene `disabled`, pero el diálogo se cierra antes de terminar y el error queda sin contexto |
| Pago sobre una factura | [components/appointments/InvoiceDetailSheet.tsx:733](../src/components/appointments/InvoiceDetailSheet.tsx#L733) | Botón "Añadir pago" sin bloqueo |
| Confirmar factura de venta | [sales/invoices/page.tsx:1061](../src/app/[locale]/sales/invoices/page.tsx#L1061) | Confirmación sin bloqueo |
| Confirmar factura de compra | [purchases/invoices/page.tsx:1093](../src/app/[locale]/purchases/invoices/page.tsx#L1093) | Confirmación sin bloqueo |
| Confirmar factura (ficha del paciente) | [components/users/user-invoices.tsx:1032](../src/components/users/user-invoices.tsx#L1032), [components/users/user-invoices.tsx:1292](../src/components/users/user-invoices.tsx#L1292) | Botón sin bloqueo |
| Facturar una orden | [components/tables/orders-table.tsx:421](../src/components/tables/orders-table.tsx#L421), [components/users/user-orders.tsx:529](../src/components/users/user-orders.tsx#L529) | Botón sin bloqueo |
| Facturar un presupuesto de compra | [purchases/quotes/page.tsx:1443](../src/app/[locale]/purchases/quotes/page.tsx#L1443) | Botón sin bloqueo |
| Aprobar/rechazar un presupuesto | [sales/quotes/page.tsx:2781](../src/app/[locale]/sales/quotes/page.tsx#L2781), [purchases/quotes/page.tsx:2232](../src/app/[locale]/purchases/quotes/page.tsx#L2232) | Botón sin bloqueo |
| Cierre de caja | [cashier/page.tsx:1243](../src/app/[locale]/cashier/page.tsx#L1243) | Botón "Cerrar sesión de caja" sin bloqueo |
| Plan de tratamiento | [components/appointments/TreatmentPlanReviewDialog.tsx:615](../src/components/appointments/TreatmentPlanReviewDialog.tsx#L615) | Si la creación falla, **muestra un plan simulado (mock) como si se hubiera creado** |

## Método y límites

- Un script de análisis estático recorrió los 585 `.tsx` de `src/` buscando cada patrón de la skill.
- Las categorías 1 a 6 se revisaron a mano: se excluyeron falsos positivos (handlers síncronos, callbacks que solo cierran, `try/catch` de parseo de fechas) y se confirmaron muestras de cada una.
- Las categorías 7 a 10 son conteos del script, con muestras verificadas. Sirven para dimensionar el trabajo, no como lista exacta.
- No se probó nada en el navegador. Las líneas corresponden al estado de la rama `test` en la fecha indicada.

## 1. Confirmaciones async sin bloqueo

`AlertDialogAction` cierra el diálogo al hacer clic. Si el handler es async y no llama a `e.preventDefault()` ni usa `disabled`, pasan tres cosas:

- el diálogo desaparece antes de que termine la petición;
- un doble clic dispara la acción dos veces;
- si falla, el error aparece sin contexto.

**Corrección:** skill, regla 5. Ejemplo correcto en el proyecto: `patient-portal/patient-cancel-appointment-dialog.tsx`.

| Ubicación | Handler | Detalle |
|---|---|---|
| [purchases/invoices/page.tsx:1093](../src/app/[locale]/purchases/invoices/page.tsx#L1093) **(P0)** | `handleConfirmInvoice` | sin `preventDefault` ni `disabled` |
| [sales/invoices/page.tsx:1061](../src/app/[locale]/sales/invoices/page.tsx#L1061) **(P0)** | `handleConfirmInvoice` | sin `preventDefault` ni `disabled` |
| [sales/payments/page.tsx:873](../src/app/[locale]/sales/payments/page.tsx#L873) **(P0)** | `handleConfirmPrepaid` | sin `preventDefault` ni `disabled` |
| [components/purchases/payments/PurchasePrepaidFormDialog.tsx:313](../src/components/purchases/payments/PurchasePrepaidFormDialog.tsx#L313) **(P0)** | `handleConfirm` | sin `preventDefault` ni `disabled` |
| [components/sales/payments/PrepaidFormDialog.tsx:312](../src/components/sales/payments/PrepaidFormDialog.tsx#L312) **(P0)** | `handleConfirm` | sin `preventDefault` ni `disabled` |
| [components/sales/payments/SmartPaymentFormDialog.tsx:502](../src/components/sales/payments/SmartPaymentFormDialog.tsx#L502) **(P0)** | `handleConfirm` | tiene `disabled`, pero sin `preventDefault` |
| [appointments/page.tsx:5786](../src/app/[locale]/appointments/page.tsx#L5786) | `confirmDeleteAppointment` | sin `preventDefault` ni `disabled` |
| [cashier/cash-points/page.tsx:413](../src/app/[locale]/cashier/cash-points/page.tsx#L413) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [cashier/miscellaneous-categories/page.tsx:393](../src/app/[locale]/cashier/miscellaneous-categories/page.tsx#L393) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [clinic-catalog/ailments/page.tsx:332](../src/app/[locale]/clinic-catalog/ailments/page.tsx#L332) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [clinic-catalog/dental-conditions/page.tsx:334](../src/app/[locale]/clinic-catalog/dental-conditions/page.tsx#L334) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [clinic-catalog/dental-surfaces/page.tsx:301](../src/app/[locale]/clinic-catalog/dental-surfaces/page.tsx#L301) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [clinic-catalog/medications/page.tsx:355](../src/app/[locale]/clinic-catalog/medications/page.tsx#L355) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [clinic-history/[user_id]/page.tsx:1308](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L1308) | `handleConfirmDelete` | sin `preventDefault` ni `disabled` |
| [clinic-history/[user_id]/page.tsx:1725](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L1725) | `confirmDeleteDocument` | sin `preventDefault` ni `disabled` |
| [clinic-history/[user_id]/page.tsx:2433](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L2433) | `handleConfirmDeleteSession` | sin `preventDefault` ni `disabled` |
| [config/availability-exceptions/page.tsx:457](../src/app/[locale]/config/availability-exceptions/page.tsx#L457) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [config/calendars/page.tsx:477](../src/app/[locale]/config/calendars/page.tsx#L477) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [config/clinics/page.tsx:657](../src/app/[locale]/config/clinics/page.tsx#L657) | `confirmDeleteSede` | sin `preventDefault` ni `disabled` |
| [config/doctor-availability/page.tsx:574](../src/app/[locale]/config/doctor-availability/page.tsx#L574) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [config/holidays/page.tsx:596](../src/app/[locale]/config/holidays/page.tsx#L596) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [config/medical-instruction-templates/page.tsx:425](../src/app/[locale]/config/medical-instruction-templates/page.tsx#L425) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [config/mutual-societies/page.tsx:397](../src/app/[locale]/config/mutual-societies/page.tsx#L397) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [config/patient-groups/page.tsx:493](../src/app/[locale]/config/patient-groups/page.tsx#L493) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [config/prescription-templates/page.tsx:428](../src/app/[locale]/config/prescription-templates/page.tsx#L428) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [config/provider-groups/page.tsx:400](../src/app/[locale]/config/provider-groups/page.tsx#L400) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [config/schedules/page.tsx:422](../src/app/[locale]/config/schedules/page.tsx#L422) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [config/sedes/page.tsx:410](../src/app/[locale]/config/sedes/page.tsx#L410) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [config/sequences/page.tsx:769](../src/app/[locale]/config/sequences/page.tsx#L769) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [config/services/page.tsx:585](../src/app/[locale]/config/services/page.tsx#L585) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [permissions/page.tsx:516](../src/app/[locale]/permissions/page.tsx#L516) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [purchases/invoices/page.tsx:1074](../src/app/[locale]/purchases/invoices/page.tsx#L1074) | `confirmDeleteItem` | sin `preventDefault` ni `disabled` |
| [purchases/quotes/page.tsx:2009](../src/app/[locale]/purchases/quotes/page.tsx#L2009) | `confirmDeleteQuote` | sin `preventDefault` ni `disabled` |
| [purchases/quotes/page.tsx:2209](../src/app/[locale]/purchases/quotes/page.tsx#L2209) | `confirmDeleteQuoteItem` | sin `preventDefault` ni `disabled` |
| [purchases/services/page.tsx:557](../src/app/[locale]/purchases/services/page.tsx#L557) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [roles/page.tsx:429](../src/app/[locale]/roles/page.tsx#L429) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [sales/invoices/page.tsx:1042](../src/app/[locale]/sales/invoices/page.tsx#L1042) | `confirmDeleteItem` | sin `preventDefault` ni `disabled` |
| [sales/payment-methods/page.tsx:330](../src/app/[locale]/sales/payment-methods/page.tsx#L330) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [sales/quotes/page.tsx:2559](../src/app/[locale]/sales/quotes/page.tsx#L2559) | `confirmDeleteQuote` | sin `preventDefault` ni `disabled` |
| [sales/quotes/page.tsx:2758](../src/app/[locale]/sales/quotes/page.tsx#L2758) | `confirmDeleteQuoteItem` | sin `preventDefault` ni `disabled` |
| [sales/services/page.tsx:1074](../src/app/[locale]/sales/services/page.tsx#L1074) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [system/alert-categories/page.tsx:501](../src/app/[locale]/system/alert-categories/page.tsx#L501) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [system/alert-rules/page.tsx:1137](../src/app/[locale]/system/alert-rules/page.tsx#L1137) | `confirmDelete` | tiene `disabled`, pero sin `preventDefault` |
| [system/communication-templates/page.tsx:952](../src/app/[locale]/system/communication-templates/page.tsx#L952) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [system/config/page.tsx:369](../src/app/[locale]/system/config/page.tsx#L369) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [components/medical-instructions/patient-instructions-section.tsx:183](../src/components/medical-instructions/patient-instructions-section.tsx#L183) | `handleDelete` | sin `preventDefault` ni `disabled` |
| [components/medical-instructions/patient-prescriptions-section.tsx:240](../src/components/medical-instructions/patient-prescriptions-section.tsx#L240) | `handleDelete` | sin `preventDefault` ni `disabled` |
| [components/roles/role-users.tsx:316](../src/components/roles/role-users.tsx#L316) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [components/users/doctor-availability-exceptions.tsx:273](../src/components/users/doctor-availability-exceptions.tsx#L273) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [components/users/doctor-availability.tsx:368](../src/components/users/doctor-availability.tsx#L368) | `confirmDelete` | sin `preventDefault` ni `disabled` |
| [components/users/signature-uploader.tsx:249](../src/components/users/signature-uploader.tsx#L249) | `handleDelete` | sin `preventDefault` ni `disabled` |

**A revisar:** estos casos cierran el diálogo y delegan la acción en un callback del padre. El problema, si existe, está en el padre:

- [components/appointments/AppointmentPanel.tsx:1574](../src/components/appointments/AppointmentPanel.tsx#L1574)
- [components/users/user-treatment-plans.tsx:353](../src/components/users/user-treatment-plans.tsx#L353)
- [components/users/user-treatment-plans.tsx:455](../src/components/users/user-treatment-plans.tsx#L455)
- [components/users/user-treatment-plans.tsx:541](../src/components/users/user-treatment-plans.tsx#L541)
- [components/users/dental-record/session-timeline.tsx:155](../src/components/users/dental-record/session-timeline.tsx#L155)

## 2. Botones de envío de formulario sin bloqueo

Son `<Button type="submit">` sin `disabled` ni `loading` cuyo `onSubmit` es async. Un doble clic o Enter + clic **crea el registro dos veces**.

**Corrección:** skill, regla 1 (`useAsyncAction` + `<Button loading>`).

| Ubicación | Nota |
|---|---|
| [components/appointments/InvoiceDetailSheet.tsx:733](../src/components/appointments/InvoiceDetailSheet.tsx#L733) | **P0**: pago sobre factura |
| [cashier/cash-points/page.tsx:392](../src/app/[locale]/cashier/cash-points/page.tsx#L392) |  |
| [cashier/miscellaneous-categories/page.tsx:372](../src/app/[locale]/cashier/miscellaneous-categories/page.tsx#L372) |  |
| [config/availability-exceptions/page.tsx:443](../src/app/[locale]/config/availability-exceptions/page.tsx#L443) |  |
| [config/doctor-availability/page.tsx:560](../src/app/[locale]/config/doctor-availability/page.tsx#L560) |  |
| [config/doctors/page.tsx:946](../src/app/[locale]/config/doctors/page.tsx#L946) |  |
| [config/sequences/page.tsx:748](../src/app/[locale]/config/sequences/page.tsx#L748) |  |
| [config/services/page.tsx:568](../src/app/[locale]/config/services/page.tsx#L568) |  |
| [patients/page.tsx:1816](../src/app/[locale]/patients/page.tsx#L1816) |  |
| [permissions/page.tsx:499](../src/app/[locale]/permissions/page.tsx#L499) |  |
| [purchases/invoices/page.tsx:1224](../src/app/[locale]/purchases/invoices/page.tsx#L1224) | Diálogo de línea de factura |
| [purchases/providers/page.tsx:1292](../src/app/[locale]/purchases/providers/page.tsx#L1292) |  |
| [purchases/services/page.tsx:542](../src/app/[locale]/purchases/services/page.tsx#L542) |  |
| [roles/page.tsx:412](../src/app/[locale]/roles/page.tsx#L412) |  |
| [sales/invoices/page.tsx:1235](../src/app/[locale]/sales/invoices/page.tsx#L1235) | Diálogo de línea de factura |
| [sales/services/page.tsx:1059](../src/app/[locale]/sales/services/page.tsx#L1059) |  |
| [system/staff/page.tsx:1362](../src/app/[locale]/system/staff/page.tsx#L1362) |  |
| [system/users/page.tsx:894](../src/app/[locale]/system/users/page.tsx#L894) |  |
| [components/roles/role-users.tsx:299](../src/components/roles/role-users.tsx#L299) |  |
| [components/sidebar.tsx:431](../src/components/sidebar.tsx#L431) | Cambio de contraseña |
| [components/sidebar.tsx:948](../src/components/sidebar.tsx#L948) | Cambio de contraseña |
| [components/tables/orders-table.tsx:616](../src/components/tables/orders-table.tsx#L616) |  |
| [components/users/doctor-availability-exceptions.tsx:258](../src/components/users/doctor-availability-exceptions.tsx#L258) |  |
| [components/users/doctor-availability.tsx:353](../src/components/users/doctor-availability.tsx#L353) |  |

**Descartados:** `PrepaidFormDialog`, `PurchasePrepaidFormDialog`, `SmartPaymentFormDialog` y `sales/payments` usan un submit síncrono que solo abre la confirmación; el riesgo está en esa confirmación (sección 1). `ReminderFormDialog` delega en `handleSaveReminder`, que es optimista (revisar).

**Aparte:** [communications/page.tsx:146](../src/app/[locale]/communications/page.tsx#L146) y [communications/channels/page.tsx:138](../src/app/[locale]/communications/channels/page.tsx#L138) tienen un botón submit **sin formulario** (no hace nada) y textos en inglés hardcodeados ("Create Conversation", "Cancel"). Parece una página a medio construir.

## 3. Botones de acción async sin bloqueo

Son botones sueltos (fuera de formularios) que ejecutan una mutación async sin `disabled` ni `loading`.

| Ubicación | Acción |
|---|---|
| [cashier/page.tsx:1243](../src/app/[locale]/cashier/page.tsx#L1243) **(P0)** | `handleCloseSession()` |
| [purchases/quotes/page.tsx:1443](../src/app/[locale]/purchases/quotes/page.tsx#L1443) **(P0)** | `handleInvoiceFromQuote()` |
| [components/tables/orders-table.tsx:421](../src/components/tables/orders-table.tsx#L421) **(P0)** | `handleConfirmInvoice()` |
| [components/users/user-invoices.tsx:1032](../src/components/users/user-invoices.tsx#L1032) **(P0)** | `handleConfirm()` |
| [components/users/user-invoices.tsx:1292](../src/components/users/user-invoices.tsx#L1292) **(P0)** | `handleConfirm()` |
| [components/users/user-orders.tsx:529](../src/components/users/user-orders.tsx#L529) **(P0)** | `handleConfirmInvoice()` |
| [alerts/page.tsx:909](../src/app/[locale]/alerts/page.tsx#L909) | `markAsCompleted()` |
| [alerts/page.tsx:1038](../src/app/[locale]/alerts/page.tsx#L1038) | `markAsIgnored()` |
| [clinic-history/[user_id]/page.tsx:200](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L200) | `handleSave()` |
| [config/doctors/page.tsx:634](../src/app/[locale]/config/doctors/page.tsx#L634) | `handleSendInitialPassword()` |
| [purchases/providers/page.tsx:861](../src/app/[locale]/purchases/providers/page.tsx#L861) | `handleToggleActivate()` |
| [purchases/quotes/page.tsx:2232](../src/app/[locale]/purchases/quotes/page.tsx#L2232) | `handleConfirmQuoteAction()` |
| [sales/quotes/page.tsx:2781](../src/app/[locale]/sales/quotes/page.tsx#L2781) | `handleConfirmQuoteAction()` |
| [system/alerts-config/page.tsx:235](../src/app/[locale]/system/alerts-config/page.tsx#L235) | `handleSaveChanges()` |
| [system/staff/page.tsx:964](../src/app/[locale]/system/staff/page.tsx#L964) | `handleSendInitialPassword()` |
| [system/users/page.tsx:677](../src/app/[locale]/system/users/page.tsx#L677) | `handleSendInitialPassword()` |
| [components/patient-portal/patient-assistant.tsx:131](../src/components/patient-portal/patient-assistant.tsx#L131) | `handleSend()` |
| [components/users/clinic-history-viewer.tsx:2892](../src/components/users/clinic-history-viewer.tsx#L2892) | `confirmDeleteSession()` |
| [components/users/clinic-history-viewer.tsx:3583](../src/components/users/clinic-history-viewer.tsx#L3583) | `confirmDeleteDocument()` |
| [components/users/user-invoices.tsx:1848](../src/components/users/user-invoices.tsx#L1848) | `handleConfirmDeleteItem()` |
| [components/users/user-quotes.tsx:2215](../src/components/users/user-quotes.tsx#L2215) | `handleDeleteQuote()` |
| [components/users/user-quotes.tsx:2322](../src/components/users/user-quotes.tsx#L2322) | `handleConfirmDeleteItem()` |
| [components/users/user-roles.tsx:279](../src/components/users/user-roles.tsx#L279) | `handleAssignRoles()` |
| [components/users/user-services.tsx:293](../src/components/users/user-services.tsx#L293) | `handleAssignServices()` |

Riesgo menor: estos botones precargan datos antes de abrir un diálogo, así que un doble clic hace dos peticiones de lectura:

- [sales/quotes/page.tsx:1802](../src/app/[locale]/sales/quotes/page.tsx#L1802): `handleOpenBillingDialog()`
- [components/appointments/InvoiceDetailSheet.tsx:481](../src/components/appointments/InvoiceDetailSheet.tsx#L481): `handleOpenPaymentDialog()`
- [components/users/user-invoices.tsx:1298](../src/components/users/user-invoices.tsx#L1298): `loadInvoices()`
- [components/users/user-quotes.tsx:1339](../src/components/users/user-quotes.tsx#L1339): `handleOpenBillingDialog()`
- [components/users/user-quotes.tsx:1599](../src/components/users/user-quotes.tsx#L1599): `handleOpenBillingDialog()`

Tres botones `handleSendInitialPassword` (médicos, staff y usuarios) pueden enviar **dos correos** de contraseña inicial al mismo usuario.

## 4. Diálogos de formulario que se cierran con la petición en curso

`onOpenChange={setX}` sin comprobar si hay una petición pendiente: Escape, clic fuera o Cancelar cierran el diálogo mientras se guarda. El usuario reabre, reenvía y se duplica el registro. (Las confirmaciones con este problema ya están en la sección 1.)

**Corrección:** skill, regla 4.

- [clinic-history/[user_id]/page.tsx:961](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L961): `<Dialog onOpenChange={setIsPersonalHistoryDialogOpen}>`
- [clinic-history/[user_id]/page.tsx:1037](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L1037): `<Dialog onOpenChange={setIsFamilyHistoryDialogOpen}>`
- [clinic-history/[user_id]/page.tsx:1122](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L1122): `<Dialog onOpenChange={setIsAllergyDialogOpen}>`
- [clinic-history/[user_id]/page.tsx:1173](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L1173): `<Dialog onOpenChange={setIsMedicationDialogOpen}>`
- [patients/page.tsx:1574](../src/app/[locale]/patients/page.tsx#L1574): `<Dialog onOpenChange={setIsDialogOpen}>`
- [purchases/providers/page.tsx:1144](../src/app/[locale]/purchases/providers/page.tsx#L1144): `<Dialog onOpenChange={setIsDialogOpen}>`
- [sales/services/page.tsx:1040](../src/app/[locale]/sales/services/page.tsx#L1040): `<Dialog onOpenChange={setIsCreateDialogOpen}>`
- [system/staff/page.tsx:1195](../src/app/[locale]/system/staff/page.tsx#L1195): `<Dialog onOpenChange={setIsDialogOpen}>`
- [system/users/page.tsx:788](../src/app/[locale]/system/users/page.tsx#L788): `<Dialog onOpenChange={setIsDialogOpen}>`
- [components/ui/misc-category-selector.tsx:199](../src/components/ui/misc-category-selector.tsx#L199): `<Dialog onOpenChange={setIsCreateOpen}>`
- [components/users/user-invoices.tsx:1758](../src/components/users/user-invoices.tsx#L1758): `<Dialog onOpenChange={setIsItemDialogOpen}>`
- [components/users/user-quotes.tsx:2224](../src/components/users/user-quotes.tsx#L2224): `<Dialog onOpenChange={setIsItemDialogOpen}>`

## 5. Fallos silenciosos

### 5.1 La acción del usuario falla sin ningún aviso

El error solo va a la consola. El usuario cree que se guardó.

- [components/appointments/TreatmentPlanReviewDialog.tsx:615](../src/components/appointments/TreatmentPlanReviewDialog.tsx#L615): **Crear plan de tratamiento: si falla, carga un plan simulado como si fuera real**
- [components/appointments/AppointmentFormDialog.tsx:554](../src/components/appointments/AppointmentFormDialog.tsx#L554): Crear servicio desde la cita
- [components/ui/service-selector.tsx:191](../src/components/ui/service-selector.tsx#L191): Crear servicio desde el selector
- [components/calendar/inline-service-picker.tsx:76](../src/components/calendar/inline-service-picker.tsx#L76): Crear servicio desde el calendario
- [components/calendar/calendar-settings-form.tsx:175](../src/components/calendar/calendar-settings-form.tsx#L175): Guardar la configuración del calendario
- [components/users/user-treatment-plans.tsx:974](../src/components/users/user-treatment-plans.tsx#L974): Guardar una sesión desde un paso del plan
- [components/dashboard/doctor-ai-panel.tsx:135](../src/components/dashboard/doctor-ai-panel.tsx#L135): Generar el resumen clínico con IA

### 5.2 Fallo parcial en operaciones de varios pasos

El registro principal se crea, pero un paso posterior falla y **no se avisa** (skill, regla 2). El usuario ve "creado con éxito" y asume que todo quedó bien.

- [patients/page.tsx:1135](../src/app/[locale]/patients/page.tsx#L1135): Paciente creado, pero **mutualista no asignada**
- [patients/page.tsx:1509](../src/app/[locale]/patients/page.tsx#L1509): Sesión creada, pero **no vinculada al paso del plan de tratamiento**
- [components/patients/patient-info-tab.tsx:386](../src/components/patients/patient-info-tab.tsx#L386): Paciente creado, pero **grupos no asignados**
- [purchases/providers/page.tsx:683](../src/app/[locale]/purchases/providers/page.tsx#L683): Proveedor creado, pero **grupos no asignados**
- [system/users/page.tsx:538](../src/app/[locale]/system/users/page.tsx#L538): Usuario creado, pero **rol por defecto no asignado**
- [system/staff/page.tsx:706](../src/app/[locale]/system/staff/page.tsx#L706): Staff creado, pero **rol no asignado**
- [components/users/dental-record/dental-record-viewer.tsx:355](../src/components/users/dental-record/dental-record-viewer.tsx#L355): Sesión guardada, pero **el alta no se registra**
- [system/users/page.tsx:546](../src/app/[locale]/system/users/page.tsx#L546): Usuario creado, pero el correo de contraseña inicial falla (se puede reintentar desde el panel)
- [system/staff/page.tsx:714](../src/app/[locale]/system/staff/page.tsx#L714): Igual que el anterior (staff)
- [config/doctors/page.tsx:524](../src/app/[locale]/config/doctors/page.tsx#L524): Igual que el anterior (médicos)
- [alerts/page.tsx:433](../src/app/[locale]/alerts/page.tsx#L433): Comunicación enviada, pero la alerta no se marca como completada
- [config/templates/page.tsx:379](../src/app/[locale]/config/templates/page.tsx#L379): Restablecer plantilla: el borrado en el backend puede fallar y la UI muestra el valor por defecto igualmente (también en L386 y L395)

### 5.3 Error de carga mostrado como dato vacío en flujos de cobro

- [billing-wizard/steps/step-payment.tsx:392](../src/components/billing-wizard/steps/step-payment.tsx#L392) y [step-invoice-select.tsx:185](../src/components/billing-wizard/steps/step-invoice-select.tsx#L185): si falla la carga del detalle de una factura, se muestra **sin líneas y sin pagos**. En el asistente de cobro eso puede inducir a cobrar mal.
- [appointments/page.tsx:2733](../src/app/[locale]/appointments/page.tsx#L2733): las facturas del paciente se muestran como lista vacía si falla la carga.

## 6. Claves i18n inexistentes

`t()` con una clave que no existe en `en.json`: el usuario ve el texto crudo (p. ej. `CashierPage.toast.error`). En varios casos la clave correcta existe con otro nombre: `QuotesPage.errors.cannotEdit` → `cannotEditQuote`.

| Ubicación | Clave |
|---|---|
| [cashier/page.tsx:232](../src/app/[locale]/cashier/page.tsx#L232) | `CashierPage.toast.error` |
| [cashier/sessions/page.tsx:295](../src/app/[locale]/cashier/sessions/page.tsx#L295) | `CashSessionsPage.reconciliation.notes` |
| [clinic-history/[user_id]/page.tsx:473](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L473) | `ClinicHistoryPage.anamnesis.toast.invalidAilment` |
| [clinic-history/[user_id]/page.tsx:504](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L504) | `ClinicHistoryPage.anamnesis.toast.personalError` |
| [clinic-history/[user_id]/page.tsx:520](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L520) | `ClinicHistoryPage.anamnesis.toast.requiredFields` |
| [clinic-history/[user_id]/page.tsx:551](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L551) | `ClinicHistoryPage.anamnesis.toast.familyError` |
| [clinic-history/[user_id]/page.tsx:580](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L580) | `ClinicHistoryPage.anamnesis.toast.allergyError` |
| [clinic-history/[user_id]/page.tsx:624](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L624) | `ClinicHistoryPage.anamnesis.toast.medicationError` |
| [clinic-history/[user_id]/page.tsx:733](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L733) | `ClinicHistoryPage.anamnesis.toast.genericError` |
| [clinic-history/[user_id]/page.tsx:749](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L749) | `ClinicHistoryPage.anamnesis.toast.deleteError` |
| [clinic-history/[user_id]/page.tsx:2047](../src/app/[locale]/clinic-history/[user_id]/page.tsx#L2047) | `ClinicHistoryPage.timeline.toast.deleteError` |
| [permissions/page.tsx:211](../src/app/[locale]/permissions/page.tsx#L211) | `PermissionsPage.toast.deleteError` |
| [permissions/page.tsx:247](../src/app/[locale]/permissions/page.tsx#L247) | `PermissionsPage.toast.editSuccess` |
| [purchases/invoices/page.tsx:301](../src/app/[locale]/purchases/invoices/page.tsx#L301) | `InvoicesPage.columns.historical` |
| [purchases/providers/page.tsx:876](../src/app/[locale]/purchases/providers/page.tsx#L876) | `<root>.ProviderColumns.activate` |
| [sales/invoices/page.tsx:300](../src/app/[locale]/sales/invoices/page.tsx#L300) | `InvoicesPage.columns.historical` |
| [sales/quotes/page.tsx:1042](../src/app/[locale]/sales/quotes/page.tsx#L1042) | `QuotesPage.errors.cannotEdit` |
| [sales/quotes/page.tsx:1042](../src/app/[locale]/sales/quotes/page.tsx#L1042) | `QuotesPage.errors.cannotEditDetail` |
| [sales/quotes/page.tsx:1091](../src/app/[locale]/sales/quotes/page.tsx#L1091) | `QuotesPage.errors.cannotDelete` |
| [sales/quotes/page.tsx:1091](../src/app/[locale]/sales/quotes/page.tsx#L1091) | `QuotesPage.errors.cannotDeleteDetail` |
| [system/access/page.tsx:147](../src/app/[locale]/system/access/page.tsx#L147) | `AccessLogPage.noAccess` |
| [system/alert-rules/page.tsx:396](../src/app/[locale]/system/alert-rules/page.tsx#L396) | `AlertRulesPage.toast.deleteErrorDescription` |
| [system/alert-rules/page.tsx:568](../src/app/[locale]/system/alert-rules/page.tsx#L568) | `AlertRulesPage.noAccess` |
| [system/audit/page.tsx:301](../src/app/[locale]/system/audit/page.tsx#L301) | `AuditLog.noAccess` |
| [system/communication-templates/page.tsx:545](../src/app/[locale]/system/communication-templates/page.tsx#L545) | `CommunicationTemplatesPage.noAccess` |
| [system/config/page.tsx:231](../src/app/[locale]/system/config/page.tsx#L231) | `ConfigurationsPage.noAccess` |
| [system/errors/page.tsx:150](../src/app/[locale]/system/errors/page.tsx#L150) | `ErrorLogPage.noAccess` |
| [system/execution-history/page.tsx:129](../src/app/[locale]/system/execution-history/page.tsx#L129) | `ExecutionHistoryPage.noAccess` |
| [system/execution-history/page.tsx:84](../src/app/[locale]/system/execution-history/page.tsx#L84) | `ExecutionHistoryPage.columns.rulesProcessed` |
| [components/appointments/AppointmentFormDialog.tsx:1787](../src/components/appointments/AppointmentFormDialog.tsx#L1787) | `AppointmentsPage.toasts.pendingSessionTitle` |
| [components/appointments/AppointmentFormDialog.tsx:1788](../src/components/appointments/AppointmentFormDialog.tsx#L1788) | `AppointmentsPage.toasts.pendingSessionDesc` |
| [components/permissions/permission-users.tsx:98](../src/components/permissions/permission-users.tsx#L98) | `UserColumns.filterByPatient` |
| [components/sales/quotes/financial-summary.tsx:55](../src/components/sales/quotes/financial-summary.tsx#L55) | `QuotesPage.summary.total` |
| [components/sales/quotes/financial-summary.tsx:64](../src/components/sales/quotes/financial-summary.tsx#L64) | `QuotesPage.summary.paid` |
| [components/sales/quotes/financial-summary.tsx:73](../src/components/sales/quotes/financial-summary.tsx#L73) | `QuotesPage.summary.balance` |
| [components/users/dental-record/session-timeline.tsx:108](../src/components/users/dental-record/session-timeline.tsx#L108) | `DentalRecord.newSessionLabel` |
| [components/users/dental-record/session-timeline.tsx:125](../src/components/users/dental-record/session-timeline.tsx#L125) | `DentalRecord.stopCompare` |
| [components/users/dental-record/session-timeline.tsx:125](../src/components/users/dental-record/session-timeline.tsx#L125) | `DentalRecord.compare` |

Patrón repetido: 8 páginas de `system/*` usan `t('noAccess')` sin tener esa clave en su namespace.

## 7. Errores de carga mostrados como "sin datos"

Hay **300 funciones** de carga (`get*`, `fetch*`, `load*`) en 118 archivos que capturan el error, lo registran en consola y devuelven `[]`, `null` o nada. El usuario no distingue entre "no hay datos" y "falló la carga", y no tiene opción de reintentar (skill, regla 9). Ejemplo típico: `getMiscellaneousTransactions` en transacciones misceláneas.

Archivos con más casos:

| Archivo | Casos |
|---|---:|
| [app/[locale]/appointments/page.tsx](../src/app/[locale]/appointments/page.tsx) | 14 |
| [app/[locale]/clinic-history/[user_id]/page.tsx](../src/app/[locale]/clinic-history/[user_id]/page.tsx) | 11 |
| [app/[locale]/sales/quotes/page.tsx](../src/app/[locale]/sales/quotes/page.tsx) | 10 |
| [app/[locale]/purchases/quotes/page.tsx](../src/app/[locale]/purchases/quotes/page.tsx) | 9 |
| [components/users/user-quotes.tsx](../src/components/users/user-quotes.tsx) | 9 |
| [components/billing-wizard/billing-wizard-modal.tsx](../src/components/billing-wizard/billing-wizard-modal.tsx) | 8 |
| [components/odontogram/index.tsx](../src/components/odontogram/index.tsx) | 8 |
| [app/[locale]/alerts/page.tsx](../src/app/[locale]/alerts/page.tsx) | 7 |
| [app/[locale]/system/alert-rules/page.tsx](../src/app/[locale]/system/alert-rules/page.tsx) | 7 |
| [components/appointments/AppointmentFormDialog.tsx](../src/components/appointments/AppointmentFormDialog.tsx) | 7 |
| [components/tables/invoices-table.tsx](../src/components/tables/invoices-table.tsx) | 7 |
| [app/[locale]/patients/page.tsx](../src/app/[locale]/patients/page.tsx) | 5 |

**Corrección sugerida:** que las funciones de carga relancen el error y que la vista muestre un estado de error con botón "Reintentar". Se puede hacer por módulo a medida que se toquen.

## 8. Mutaciones sin timeout

De **345 llamadas** `api.post/put/patch/delete`, solo 3 pasan `timeoutMs` (las de transacciones misceláneas, ya corregidas). Si n8n se cuelga, el botón queda bloqueado indefinidamente o el usuario recarga y reintenta a ciegas.

**Opciones:** (a) añadir `timeoutMs` a medida que se toque cada flujo (skill, regla 3), o (b) poner un timeout por defecto para mutaciones en `api.ts`, revisando antes las operaciones largas (IA, exportaciones, importaciones).

## 9. Búsquedas y filtros sin descartar respuestas viejas

El script detectó **78 efectos** de búsqueda/filtro con debounce en 40 archivos sin `AbortController` ni control de petición vigente. Una respuesta lenta de "ju" puede pisar la de "juan" (skill, regla 10). Es heurístico y puede incluir efectos sin riesgo real.

- [components/tables/invoices-table.tsx](../src/components/tables/invoices-table.tsx) (8)
- [app/[locale]/cashier/miscellaneous-transactions/page.tsx](../src/app/[locale]/cashier/miscellaneous-transactions/page.tsx) (4)
- [app/[locale]/clinic-history/[user_id]/page.tsx](../src/app/[locale]/clinic-history/[user_id]/page.tsx) (4)
- [app/[locale]/cashier/cash-points/page.tsx](../src/app/[locale]/cashier/cash-points/page.tsx) (3)
- [app/[locale]/config/doctor-availability/page.tsx](../src/app/[locale]/config/doctor-availability/page.tsx) (3)
- [components/patients/patient-group-patients-tab.tsx](../src/components/patients/patient-group-patients-tab.tsx) (3)
- [components/patients/patient-group-services-tab.tsx](../src/components/patients/patient-group-services-tab.tsx) (3)
- [components/patients/patient-info-tab.tsx](../src/components/patients/patient-info-tab.tsx) (3)
- [components/providers/provider-group-providers-tab.tsx](../src/components/providers/provider-group-providers-tab.tsx) (3)
- [app/[locale]/cashier/miscellaneous-categories/page.tsx](../src/app/[locale]/cashier/miscellaneous-categories/page.tsx) (2)

## 10. Toasts con texto hardcodeado

Hay **75 toasts** en 22 archivos con `title`/`description` literal. La mayoría son `"Error"` (inocuo en español), pero hay textos en inglés visibles para el usuario, como `"Invoice Confirmed"`, `"Please fill all fields."` o `"Upload Successful"`.

- [app/[locale]/purchases/invoices/page.tsx](../src/app/[locale]/purchases/invoices/page.tsx) (12)
- [app/[locale]/sales/invoices/page.tsx](../src/app/[locale]/sales/invoices/page.tsx) (11)
- [app/[locale]/cashier/page.tsx](../src/app/[locale]/cashier/page.tsx) (7)
- [components/users/user-invoices.tsx](../src/components/users/user-invoices.tsx) (7)
- [app/[locale]/clinic-history/[user_id]/page.tsx](../src/app/[locale]/clinic-history/[user_id]/page.tsx) (6)
- [app/[locale]/purchases/payments/page.tsx](../src/app/[locale]/purchases/payments/page.tsx) (4)
- [app/[locale]/sales/payments/page.tsx](../src/app/[locale]/sales/payments/page.tsx) (4)
- [app/[locale]/system/staff/page.tsx](../src/app/[locale]/system/staff/page.tsx) (3)
- [components/roles/role-users.tsx](../src/components/roles/role-users.tsx) (3)
- [components/users/clinic-history-viewer.tsx](../src/components/users/clinic-history-viewer.tsx) (3)

## 11. Clic de fila que atraviesa menús de acciones

Se revisaron todas las tablas con `onRowClick`. El único caso, transacciones misceláneas (al eliminar se abría también el diálogo de edición), ya está corregido. El resto define sus columnas en `columns.tsx` con `stopPropagation`.

## Plan de corrección sugerido

1. **P0, dinero y caja** (tabla del inicio): unos 13 puntos, cada uno con cambios pequeños y localizados. También el plan de tratamiento simulado.
2. **Confirmaciones de borrado** (sección 1): patrón idéntico en unas 40 páginas CRUD de configuración y catálogo. Se corrige de forma mecánica con `useAsyncAction`.
3. **Submits y diálogos de formulario** (secciones 2 y 4), empezando por pacientes, usuarios, staff y proveedores.
4. **Fallos parciales** (5.2): avisar con un toast de advertencia qué paso falló.
5. **i18n** (sección 6): correcciones rápidas de claves.
6. **Timeout global y errores de carga** (secciones 7 y 8): decisión de arquitectura; luego, por módulo.
7. **Búsquedas y toasts** (secciones 9 y 10): al tocar cada archivo.
