---
name: ux-interaction-patterns
description: Use whenever UI code triggers a backend request or shows its result — submit/save/delete buttons, forms, dialogs and confirmations, per-row table actions, toggles/switches, status changes, search/filter fetches, list loading/empty/error states. Enforces in-flight locking against duplicate submissions (useAsyncAction + Button `loading`), request timeouts, dialogs that can't close mid-request, confirmation for destructive actions, consistent error/success feedback and protection against stale responses and lost edits.
---

# Skill: ux-interaction-patterns

## Propósito

Que cada interacción que toca el backend sea **segura** (no duplica datos, no pierde cambios, no deja la UI colgada) y **legible** (el usuario siempre sabe si está cargando, si salió bien o por qué falló).

El caso motivador: un usuario hace doble clic en "Guardar" (o Enter + clic, o clic mientras la red va lenta) y se crean dos facturas/pagos/citas. En una clínica eso es dinero y datos de pacientes duplicados.

## Primitivas del proyecto (usar siempre estas)

| Primitiva | Dónde | Para qué |
|---|---|---|
| `useAsyncAction(fn, opts)` | `@/hooks/use-async-action` | Bloqueo síncrono (ref) + `isPending` + toast de error estándar (incluye timeout) |
| `useKeyedAsyncAction(fn, opts)` | `@/hooks/use-async-action` | Igual, pero bloqueo **por fila/id** (`run(id, ...)`, `isPending(id)`) |
| `<Button loading>` | `@/components/ui/button` | Deshabilita, pone `aria-busy` y muestra spinner (en `size="icon"` reemplaza el icono) |
| `<ActionButton loading>` / `<CompactActionButton loading>` | `@/components/ui/action-button` | Cambia el icono por spinner y deshabilita |
| `api.*(…, { timeoutMs, signal })` | `@/services/api` | Timeout real (aborta el fetch) y cancelación |
| `REQUEST_TIMEOUT_MS.mutation` / `.longRunning` | `@/services/api` | 30 s CRUD / 120 s IA, exportaciones, operaciones masivas |
| `isTimeoutError(e)` / `isAbortError(e)` | `@/services/api` | Distinguir timeout (¡puede haberse guardado!) de cancelación (ignorar) |
| `getErrorMessage(e)` | `@/lib/error-utils` | Mensaje legible del backend |
| `DialogContent confirmOnClose isDirty` | `@/components/ui/dialog` | Confirmar antes de cerrar con cambios sin guardar |
| `DialogCancelButton` | `@/components/ui/dialog` | Cancelar respetando `confirmOnClose` |
| `useDebounce(value, ms)` | `@/hooks/use-debounce` | Búsquedas/filtros |

Claves i18n genéricas ya existentes: `Common.errorTitle`, `Common.genericError`, `Common.timeoutError`, `Common.loading`.

## Reglas obligatorias

### 1. Toda mutación se bloquea mientras está en vuelo

Cualquier acción que haga `POST/PUT/PATCH/DELETE` (o dispare efectos: enviar email/WhatsApp, facturar, cobrar, cambiar estado) debe:

- tener un **bloqueo síncrono** (ref), no solo `useState` — el estado no se aplica hasta el siguiente render y además `form.handleSubmit` valida *antes* de llamar a tu handler;
- mostrar **estado visible** (`loading`) en el botón que la disparó;
- liberarse **siempre** en `finally` (éxito, error o timeout).

`useAsyncAction` cumple las tres cosas:

```tsx
const save = useAsyncAction(
  (values: SedeFormValues) => upsertSede({ ...values, clinic_id: clinicId }),
  {
    onSuccess: async () => {
      toast({ title: t('SedesPage.toast.createSuccess') });
      await loadSedes();          // sigue "pending" hasta que la lista esté fresca
      setIsCreateDialogOpen(false);
    },
    onError: (error) => setSubmissionError(getErrorMessage(error)),
    showErrorToast: false,        // el error se muestra inline en el form
  }
);

<form onSubmit={form.handleSubmit(save.run)}>
  …
  <Button type="submit" loading={save.isPending}>{t('save')}</Button>
</form>
```

- `run` llamado mientras hay otra ejecución en curso devuelve `undefined` sin ejecutar nada.
- Deja el texto del botón igual y añade el spinner (menos salto de layout que cambiar a "Guardando…").
- Si el formulario es largo, deshabilita también los inputs con `disabled={save.isPending}` para que no se editen datos que ya se están enviando.

**Código existente con el patrón `isSaving` + `setIsSaving`:** al tocar ese flujo, migrarlo a `useAsyncAction`, o como mínimo añadir un `useRef` de guarda al inicio del handler. No refactorizar en masa flujos que no se están tocando.

### 2. Operaciones de varios pasos: un solo bloqueo para toda la secuencia

Si una acción encadena llamadas (crear presupuesto → facturar → registrar pago → notificar), todo va dentro de la misma `action`. Si falla un paso intermedio:

- informa qué **sí** se completó ("La factura se creó pero no se pudo registrar el pago") — no un "Error" genérico que invite a repetir todo;
- deja el estado local coherente con lo que el backend realmente tiene (recargar), nunca con lo que "debería" haber pasado.

### 3. Timeouts reales, nunca "desbloqueos" solo visuales

- Pasa `timeoutMs` en las mutaciones que escribas o toques: `api.post(API_ROUTES.X, data, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation })`. Para IA, exportaciones o procesos masivos usa `REQUEST_TIMEOUT_MS.longRunning`. Si la llamada vive en un service de `src/services/*`, el service acepta y reenvía un `options?: ApiRequestOptions`.
- **Prohibido** un `setTimeout` que reactive el botón mientras la petición sigue viva: es exactamente cómo se crean duplicados.
- Tras un timeout en una creación **no reintentes automáticamente**: el backend (n8n) puede haberla procesado. `useAsyncAction` ya muestra `Common.timeoutError`; en `onError`, si `isTimeoutError(error)`, recarga los datos para que el usuario vea si se creó.

### 4. Diálogos: no se cierran a mitad de petición, y solo se cierran en éxito

```tsx
<Dialog
  open={open}
  onOpenChange={(next) => {
    if (!next && save.isPending) return;   // Escape / clic fuera / X bloqueados
    setOpen(next);
  }}
>
  <DialogContent confirmOnClose isDirty={form.formState.isDirty}>
    …
    <DialogCancelButton disabled={save.isPending}>{t('cancel')}</DialogCancelButton>
    <Button type="submit" loading={save.isPending}>{t('save')}</Button>
```

- Cerrar en `onSuccess`, nunca antes del `await`.
- En error: el diálogo **queda abierto** y el formulario **conserva** lo que escribió el usuario (no `form.reset()` en el `catch`).
- Formularios con datos que cuesta reescribir (historia clínica, recetas, presupuestos): `confirmOnClose` + `isDirty`.

### 5. Confirmaciones (`AlertDialog`) para acciones destructivas o irreversibles

Borrar, anular, cancelar citas, cerrar caja, facturar, enviar comunicaciones al paciente → siempre `AlertDialog` que **nombre la entidad** afectada (`t('deleteDialog.description', { name })`) y botón con estilo destructivo cuando aplique.

`AlertDialogAction` cierra el diálogo al hacer clic por defecto. Para acciones async:

```tsx
const remove = useAsyncAction(() => deleteSede(deletingSede!.id), {
  onSuccess: async () => {
    toast({ title: t('SedesPage.toast.deleteSuccess') });
    setIsDeleteDialogOpen(false);
    await loadSedes();
  },
  errorTitle: t('SedesPage.toast.errorTitle'),
});

<AlertDialog open={isDeleteDialogOpen} onOpenChange={(next) => { if (!remove.isPending) setIsDeleteDialogOpen(next); }}>
  …
  <AlertDialogCancel disabled={remove.isPending}>{t('cancel')}</AlertDialogCancel>
  <AlertDialogAction
    onClick={(e) => { e.preventDefault(); remove.run(); }}
    disabled={remove.isPending}
    className="bg-destructive hover:bg-destructive/90"
  >
    {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
    {t('confirm')}
  </AlertDialogAction>
```

Ejemplo existente correcto: `src/components/patient-portal/patient-cancel-appointment-dialog.tsx`.

### 6. Acciones por fila, switches y menús

- Tablas/listas: `useKeyedAsyncAction` con el id de la fila. Solo esa fila muestra spinner y se bloquea; las demás siguen operables.

  ```tsx
  const toggleActive = useKeyedAsyncAction((row: Service) => updateService({ ...row, is_active: !row.is_active }), {
    onSuccess: () => loadServices(),
  });

  <Switch
    checked={row.is_active}
    disabled={toggleActive.isPending(row.id)}
    onCheckedChange={() => toggleActive.run(row.id, row)}
  />
  ```

- Switches/checkboxes que guardan al instante: o bien se muestran como pendientes hasta confirmar (preferido), o bien se actualizan de forma optimista **con rollback** en error. Nunca dejar el switch en un estado que el backend rechazó.
- **Tablas con `onRowClick`**: la celda de acciones va envuelta en `<div onClick={(e) => e.stopPropagation()}>`. El `DropdownMenuContent` se renderiza en un portal, pero en el árbol de React sigue siendo hijo de la fila, así que sin esto el clic en "Eliminar" también dispara `onRowClick` (p. ej. abre el diálogo de edición encima de la confirmación). Lo mismo aplica a botones, switches y checkboxes dentro de la fila.
- Ítems de `DropdownMenu` que disparan mutaciones: deshabilitar el trigger o el ítem mientras la acción de esa fila está pendiente.
- Si una acción masiva está en curso (`hasPending`), deshabilita también las acciones masivas/toolbar que operen sobre las mismas filas.

### 7. Feedback de error: siempre visible, específico y traducido

- Nunca `catch {}` silencioso en una acción del usuario. `useAsyncAction` ya muestra toast; si lo desactivas (`showErrorToast: false`) debes mostrar el error inline.
- **Formularios** → error inline (`submissionError` sobre el footer) para que siga visible mientras corrige. **Acciones sueltas** (borrar, cambiar estado) → toast destructivo.
- Mensaje: `getErrorMessage(error)` (trae el `message` del backend). Títulos siempre con `t()`; nada de strings en inglés hardcodeados.
- 400 = validación: si el backend indica campo, usa `form.setError(field, …)` además del mensaje general.

### 8. Feedback de éxito y datos frescos

- Toast de éxito con mensaje **específico** traducido ("Sede creada", no "OK").
- Después de mutar, recarga (o actualiza localmente) lo que se ve en pantalla. Si el siguiente paso de la UI depende de los datos nuevos, haz `await` dentro de `onSuccess` para que el botón siga pendiente hasta entonces.
- Tras crear desde un diálogo, selecciona/resalta el registro nuevo si la vista lo permite.

### 9. Estados de carga, vacío y error en lecturas

- **Primera carga**: skeleton o `DataTable isLoading` — nunca "No hay resultados" mientras carga.
- **Recarga** (refetch tras filtro/mutación): mantener los datos anteriores visibles con un indicador sutil (`isRefreshing`, spinner en el botón de refrescar). No vaciar la tabla.
- **Vacío** ≠ **error**: si la carga falla, mostrar el error con botón "Reintentar"; no un estado vacío que haga creer que no hay datos.
- Controles que dependen de datos aún no cargados (selectores, botón "Facturar" que necesita el paciente) → deshabilitados hasta tenerlos.

### 10. Búsquedas y filtros: debounce + ignorar respuestas viejas

```tsx
const debounced = useDebounce(search, 300);

React.useEffect(() => {
  const controller = new AbortController();
  setIsLoading(true);
  api.get(API_ROUTES.APPOINTMENTS_SEARCH, { q: debounced }, undefined, { signal: controller.signal })
    .then(setResults)
    .catch((error) => { if (!isAbortError(error)) setLoadError(getErrorMessage(error)); })
    .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
  return () => controller.abort();
}, [debounced]);
```

Sin esto, una respuesta lenta de "ju" puede pisar la de "juan". Mismo patrón para abrir detalles al hacer clic en filas en rápida sucesión (ver `eventClickAbortRef` en `appointments/page.tsx`).

### 11. No perder trabajo del usuario

- Diálogos con formularios → regla 4 (`confirmOnClose` + `isDirty`).
- Páginas/pestañas con edición inline → confirmar al salir con cambios (patrón `window.confirm(t('unsavedChangesConfirm'))` en `config/calendar-colors/page.tsx`).
- Nunca resetear un formulario por un error o por un refetch en segundo plano mientras el usuario está editando.

### 12. Accesibilidad e interacción

- `Button loading` ya pone `aria-busy`. Botones solo-icono: siempre `aria-label` / tooltip.
- Deshabilitado debe explicar por qué cuando no es obvio (tooltip). Si la causa es un permiso, seguir la skill `permissions-protection`.
- Enter en un form = mismo `run` que el botón; no añadir handlers `onKeyDown` paralelos que eviten el bloqueo.

## Anti-patrones detectados en el proyecto

| Anti-patrón | Consecuencia | Corrección |
|---|---|---|
| `<AlertDialogAction onClick={confirmDelete}>` sin `preventDefault` ni `disabled` | El diálogo se cierra antes de terminar; doble clic = doble DELETE; el error aparece sin contexto | Regla 5 |
| `setIsSaving(true)` como único bloqueo | Ventana entre clic y re-render (y durante la validación de RHF) | Regla 1 |
| Diálogo cerrable (Escape/Cancelar) con la petición en vuelo | El usuario reabre y reenvía | Regla 4 |
| `catch { }` o solo `console.error` en acciones de usuario | El usuario cree que se guardó | Regla 7 |
| Llamada sin timeout | Botón bloqueado indefinidamente si n8n se cuelga | Regla 3 |
| `toast({ title: 'Error' })` en inglés hardcodeado | Rompe i18n | Regla 7 |

## Checklist antes de terminar

- [ ] Cada botón que muta usa `useAsyncAction`/`useKeyedAsyncAction` (o guarda con `useRef`) y muestra `loading`.
- [ ] Las mutaciones nuevas/tocadas pasan `timeoutMs`; ningún `setTimeout` desbloquea la UI con la petición viva.
- [ ] Diálogos: no se cierran con la petición pendiente, se cierran solo en éxito y conservan los datos en error.
- [ ] Acciones destructivas tienen `AlertDialog` con `preventDefault`, `disabled` y nombre de la entidad.
- [ ] Errores visibles (inline en forms, toast en acciones), con `getErrorMessage` y títulos traducidos.
- [ ] Éxito: toast específico + datos recargados.
- [ ] Lecturas: skeleton en primera carga, datos visibles en recarga, error distinto de vacío.
- [ ] Búsquedas con `useDebounce` + `AbortController`.
- [ ] Todos los strings nuevos en `src/messages/en.json` **y** `src/messages/es.json`.
