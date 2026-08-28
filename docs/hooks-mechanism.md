# Mecanismo de Customizaciones (hooks / Event Handlers)

## 1. Por qué

Cuando un cliente pide un comportamiento propio —mandar un WhatsApp al facturar, validar
algo antes de guardar, recalcular un campo con su propia regla— la salida fácil es
bifurcar el flujo de n8n. A la tercera bifurcación, cada fix hay que replicarlo en cuatro
lugares y el mantenimiento se come el beneficio.

Este mecanismo replica los **Event Handler de Openbravo**: el flujo común es **idéntico en
todas las instalaciones** y, en puntos definidos, llama a un **dispatcher genérico** que
consulta en Postgres qué customizaciones tiene registradas *este* cliente para ese evento y
las ejecuta en orden.

La propiedad que lo hace viable:

> **Sin implementaciones registradas, el dispatcher devuelve el payload intacto y el flujo
> se comporta exactamente como antes de instrumentarlo.**

Por eso se puede meter el nodo en flujos productivos sin cambiar nada para los clientes que
no usan la customización.

Es la misma filosofía que [`docs/i18n-overrides.md`](./i18n-overrides.md), un piso más
abajo: los overrides customizan el **texto**, los hooks customizan el **comportamiento**.

## 2. Piezas

```
  ┌──────────────────────────────────────┐
  │  Flujo común (idéntico en todos)     │
  │  ej. webhook invoices/upsert         │
  │                                      │
  │   … escribe la factura y las líneas  │
  │              │                       │
  │              ▼                       │
  │   ┌────────────────────────────┐     │
  │   │ Execute Sub-workflow        │    │   ← el único nodo que se agrega
  │   │ "Hook: invoice.after_upsert"│    │
  │   └────────────┬───────────────┘     │
  └────────────────┼─────────────────────┘
                   ▼
       ┌───────────────────────────┐        ┌──────────────────┐
       │   Hooks Dispatcher         │──────▶│  hook_registry   │  ¿qué hay
       │   (sub-workflow genérico)  │◀──────│  hook_events     │   registrado?
       └───────────┬───────────────┘        └──────────────────┘
                   │  por cada fila, en orden de seq
                   ▼
       ┌───────────────────────────┐        ┌──────────────────────┐
       │  Hook del cliente          │──────▶│ hook_execution_log   │
       │  (sub-workflow n8n propio) │       └──────────────────────┘
       └───────────────────────────┘
```

| Pieza | Qué es | Dónde |
| --- | --- | --- |
| `hook_events` | Catálogo: qué puntos de extensión ofrece el producto | [`database/scripts/069_…sql`](../database/scripts/069_20260828_hooks-registry-and-permissions.sql) |
| `hook_registry` | Implementaciones: qué sub-workflow se engancha a qué evento. **Esto es lo que varía por cliente** | ídem |
| `hook_execution_log` | Traza de cada ejecución | ídem |
| Hooks Dispatcher | El sub-workflow genérico | [`n8n-workflows/hooks-dispatcher.json`](../n8n-workflows/hooks-dispatcher.json) |
| Hook de ejemplo | `invoice.after_upsert` → recalcular descuentos | [`n8n-workflows/hook-example-invoice-recalc-discounts.json`](../n8n-workflows/hook-example-invoice-recalc-discounts.json) |
| Webhooks CRUD | Alimentan la ventana | `n8n-workflows/hooks-events-*.json`, `hooks-registry-*.json` |
| Ventana | Sistema → Customizaciones | [`src/app/[locale]/system/customizations/`](../src/app/%5Blocale%5D/system/customizations/) |

Permisos (`CUSTOMIZATIONS_*`), concedidos **sólo al rol Administrador (id 4)**. Se excluye
a Gerente a propósito: registrar aquí un hook es inyectar código que corre dentro de una
operación de facturación, no una tarea de gestión.

## 3. El contrato del envelope

Esto es lo que **hay que congelar**. En Openbravo, lo que hace que el mecanismo sea una
maravilla no es el dispatcher: es que el catálogo de eventos es estable. Si los nombres o
los payloads cambian cada dos meses, las customizaciones de cada cliente se rompen y
volvemos al mantenimiento que queríamos evitar.

### Entrada al hook (`hook_envelope_version: 1`)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `hook_envelope_version` | number | Siempre `1`. Sólo sube en un cambio incompatible del sobre |
| `event_code` | string | `invoice.after_upsert` |
| `timing` | string | `before` \| `after` |
| `payload` | object | Según el `payload_schema` del evento |
| `context` | object | `{ user_id, clinic_id, source, correlation_id }` |
| `config` | object | El `config` de la registración, tal cual |
| `registry_id` | uuid | Qué registración está corriendo |
| `depth` | number | ≥1 dentro de un hook. El guard corta en 5 |
| `hook_path` | string[] | Los **`event_code`** ya recorridos en esta cadena — no workflows. Guard de ciclos |

> `hook_path` **no** es el id del workflow. El id del sub-workflow a ejecutar es
> `handler_ref`, y sale de `hook_registry`: el dispatcher lo lee de la base y lo inyecta en
> el `workflowId` del nodo Execute. `hook_path` es la traza de eventos: un flujo común
> siempre llama con `hook_path: []` y `depth: 0`, y el dispatcher le añade su propio
> `event_code` antes de invocar cada hook. Si el `event_code` entrante ya figura en la
> lista, hay un ciclo y no se ejecuta nada.
>
> Ojo: como rastrea eventos y no workflows, un hook de `invoice.after_upsert` que cree
> legítimamente otra factura verá su `invoice.after_upsert` anidado saltado. Es
> intencional —desde el dispatcher es indistinguible de una recursión infinita— pero es un
> límite real a tener en cuenta al diseñar una customización.

### Salida del hook

Exactamente un item:

```json
{ "ok": true, "patch": { }, "message": "", "data": { } }
```

- `patch` **sólo se honra con `timing: "before"` y `mode: "sync"`**. Merge **superficial**,
  en orden de `seq`, gana el último. No es un deep merge: mezclar arrays es donde este tipo
  de mecanismo se vuelve impredecible.
- No devolver nada, o `[]`, equivale a `{ ok: true, patch: {} }`.
- Un `throw` lo captura la salida de error del dispatcher → `{ ok: false, error }`.

> **Anidamiento.** Un hook que a su vez llame al dispatcher **debe reenviar `depth`,
> `hook_path` y `correlation_id` tal como los recibió** (los tres están en su envelope;
> `correlation_id` viene dentro de `context`). El dispatcher incrementa `depth` y añade el
> `event_code`.
>
> - No reenviar `depth` / `hook_path` es la única forma de armar un bucle infinito.
> - No reenviar `correlation_id` no rompe nada, pero parte la traza: el dispatcher cae al
>   fallback `$execution.id` y esa rama queda con un hilo propio, sin manera de asociarla a
>   la operación que la originó.

### Salida del dispatcher

Una única forma para todos los caminos, incluido "no había nada que ejecutar":

```json
{
  "ok": true, "event_code": "invoice.after_upsert",
  "executed": 2, "succeeded": 2, "failed": 0,
  "skipped": 0, "skipped_reason": null,
  "patch": { }, "payload": { },
  "results": [ { "registry_id": "…", "name": "…", "seq": 100, "ok": true, "duration_ms": 42 } ],
  "duration_ms": 55, "correlation_id": "…"
}
```

`skipped_reason` es `null`, `"max_depth"` o `"cycle"`.

> En un evento `before`, el nodo siguiente del flujo llamante debe seguir con
> **`$json.payload`** (que ya viene fusionado), **nunca** con `{...body, ...patch}`. El
> merge ocurre en un solo lugar: el dispatcher.

## 4. Cómo instrumentar un flujo existente

Se agrega **un nodo** al flujo común, en el punto donde se quiere el enganche. Snippet
copiable (pegar dentro del array `nodes` del JSON del flujo):

```json
{
  "parameters": {
    "workflowId": {
      "__rl": true,
      "value": "HOOKS_DISPATCHER_WORKFLOW_ID",
      "mode": "list",
      "cachedResultName": "Hooks Dispatcher"
    },
    "workflowInputs": {
      "mappingMode": "defineBelow",
      "value": {
        "event_code":     "invoice.after_upsert",
        "payload":        "={{ { invoice_id: $json.id, doc_no: $json.doc_no, is_update: false, total: $json.total } }}",
        "context":        "={{ { user_id: $('invoices/upsert').first().json.jwtPayload.userId, source: 'invoices/upsert' } }}",
        "depth":          "={{ 0 }}",
        "hook_path":      "={{ [] }}",
        "clinic_id":      "={{ null }}",
        "correlation_id": "={{ $execution.id }}"
      },
      "matchingColumns": [],
      "schema": [],
      "attemptToConvertTypes": false,
      "convertFieldsToString": false
    },
    "options": { "waitForSubWorkflow": true }
  },
  "type": "n8n-nodes-base.executeWorkflow",
  "typeVersion": 1.3,
  "position": [0, 0],
  "id": "REEMPLAZAR-POR-UUID-NUEVO",
  "name": "Hook: invoice.after_upsert",
  "onError": "continueErrorOutput",
  "alwaysOutputData": true
}
```

Y la entrada correspondiente en `connections`, intercalando el nodo entre los dos que ya
estaban conectados. Por ejemplo, para meterlo en `invoices/upsert` de
`docs/n8n-flows/All Sales Quote endpoints.json` entre `Recalculate Invoice Total3` y
`Format Invoice Upsert Output1`:

```jsonc
// ANTES
"Recalculate Invoice Total3": {
  "main": [[{ "node": "Format Invoice Upsert Output1", "type": "main", "index": 0 }]]
}

// DESPUÉS
"Recalculate Invoice Total3": {
  "main": [[{ "node": "Hook: invoice.after_upsert", "type": "main", "index": 0 }]]
},
"Hook: invoice.after_upsert": {
  "main": [
    [{ "node": "Format Invoice Upsert Output1", "type": "main", "index": 0 }],
    [{ "node": "Format Invoice Upsert Output1", "type": "main", "index": 0 }]
  ]
}
```

(La segunda rama es la salida de error: aquí se manda al mismo sitio porque el hook es
`after` y su fallo no debe afectar a la factura. En un `before` con hooks `on_error=fail`,
esa rama va al responder de error del flujo.)

### Checklist

1. **Reemplazar `HOOKS_DISPATCHER_WORKFLOW_ID`** por el id real del dispatcher en esta
   instalación. Ese id es estable por instalación y va en el runbook de instalación.
2. **Generar un `id` de nodo nuevo** (un UUID). Repetir el de otro nodo rompe el import.
3. **`convertFieldsToString` DEBE quedar en `false`.** Con `true` (que es lo que suele
   escribir el editor de n8n) `payload` y `context` llegan al dispatcher como strings JSON.
   El dispatcher los tolera, pero es una fuente de confusión evitable.
4. **En un evento `before`, el nodo siguiente lee `$json.payload`**, no `$json.patch`.
5. **Cablear la salida de error** (`onError: "continueErrorOutput"` ya está en el snippet)
   al responder de error del flujo. Si no, un hook con `on_error='fail'` hace que el cliente
   reciba un 500 crudo de n8n en vez del envelope de error normal del flujo.
6. **Re-exportar el flujo** a `docs/n8n-flows/` después de probarlo.

## 5. Cómo escribir un hook

Copiar [`hook-example-invoice-recalc-discounts.json`](../n8n-workflows/hook-example-invoice-recalc-discounts.json)
y adaptarlo. Reglas:

- El trigger es `executeWorkflowTrigger` y declara **los nueve campos del envelope**.
- Options > Settings del workflow: permitir que lo llamen otros workflows.
- Devolver **siempre un item** con la forma del contrato.
- **Nunca lanzar para decir "no había nada que hacer".** Devolver `{ ok: true, patch: {} }`
  con un `message` explicativo; si no, `hook_execution_log` se llena de errores que no lo son.
- Los objetos del envelope pueden llegar como strings: usar el helper `asObj` del ejemplo.
- Un hook `after` **debe ser idempotente**: corre fuera de la transacción del llamante y
  re-ejecutar la operación padre lo vuelve a ejecutar.

## 6. Runbook: agregar un evento nuevo

1. **Migración** `0NN_YYYYMMDD_….sql` que inserta en `hook_events` con su `payload_schema`
   (`ON CONFLICT (code) DO NOTHING`). Los eventos que entrega el producto van con
   `is_system = true`.
2. **Intercalar el nodo** del §4 en el flujo común, en el punto exacto, y re-exportar el
   flujo a `docs/n8n-flows/`.
3. **Documentar el payload aquí**, en la tabla del §8.
4. Si es un `before_*`, **decir qué claves puede sobrescribir legítimamente el patch**.
5. Si aparece un módulo nuevo, no hace falta tocar traducciones: el módulo se muestra tal
   cual como badge.

Alternativa para un evento propio de un cliente: crearlo desde la ventana (queda con
`is_system = false`). Pero si además hay que tocar el flujo para dispararlo, conviene que
vaya por migración, para que el catálogo y el flujo viajen juntos.

## 7. Semántica y límites

| Regla | Detalle |
| --- | --- |
| Orden | Los hooks corren por `seq` ascendente; cada uno ve el payload parcheado por los anteriores |
| Merge del patch | **Superficial**. Gana el de `seq` más alto |
| `async` no puede parchear | n8n no espera al sub-workflow, así que el nodo devuelve su propia entrada |
| `before` no admite `async` | Sería un fallo silencioso: parecería validar sin hacerlo. Rechazado al registrar |
| `on_error='fail'` | Aborta el dispatcher y propaga al flujo llamante |
| `timeout_ms` | **Orientativo.** n8n no puede cortar un sub-workflow desde el nodo que lo llama. Un hook colgado cuelga al llamante |
| Profundidad | Máximo 5 |
| Ciclos | Detectados por `hook_path`, que acumula los `event_code` recorridos. Un hook que llama al dispatcher **debe reenviar `depth` y `hook_path` tal como los recibió** |
| Dónde se ven los saltos | Sólo en el **retorno** del dispatcher (`skipped_reason`: `max_depth`, `cycle` o `lookup_error`). **No** se escribe fila en `hook_execution_log`: ese camino no pasa por el nodo de log. La tabla admite `status = 'skipped'` para cuando se quiera registrarlos |
| Registry ilegible | Si falla el `SELECT` a `hook_registry` (BD caída, permisos), el dispatcher **no rompe la operación**: devuelve el payload intacto con `skipped_reason: "lookup_error"` y `ok: false`. Conviene alertar sobre ese valor: a simple vista es indistinguible de "no había nada registrado" |
| Hooks `after` | Corren **fuera** de la transacción del llamante. Un fallo deja la operación commiteada y el hook fallido |
| `handler_ref` | Es un id de workflow **por instalación**. Una registración exportada de un cliente no sirve en otro; por eso `hook_registry` no lleva datos semilla |

## 8. Catálogo de eventos

| `code` | Módulo | Momento | Se dispara |
| --- | --- | --- | --- |
| `invoice.before_upsert` | billing | before | Al inicio de `invoices/upsert`, antes de escribir nada. El patch reescribe el cuerpo de la factura; `ok:false` con `on_error='fail'` la rechaza |
| `invoice.after_upsert` | billing | after | Al final de `invoices/upsert`, con factura y líneas ya escritas y los totales consolidados |
| `appointment.after_create` | appointments | after | Al confirmarse el alta de una cita. `context.source` distingue `staff` / `portal` / `ai` |

El `payload_schema` completo de cada uno está en la migración 069 y se ve en la ventana.

Sobre `invoice.*`: el convenio de importes del [script 068](../database/scripts/068_20260814_clinic-preferences-and-discounts.sql)
sigue vigente — `total` es siempre el **neto** y `gross_total` el bruto, y debe cumplirse
`invoices.total = SUM(invoice_items.total)`. Cualquier hook que toque importes tiene que
preservarlo.

## 9. Operación

**Traza.** Qué corrió y qué falló:

```sql
SELECT executed_at, event_code, handler_ref, status, duration_ms, error_message
FROM public.hook_execution_log
WHERE executed_at > now() - interval '1 day'
ORDER BY executed_at DESC
LIMIT 100;
```

Todos los hooks de una misma operación de negocio comparten `correlation_id`.

**Poda.** `hook_execution_log` crece sin límite si nadie la poda. **Hay que agendarla** —
un flujo n8n con schedule trigger diario que llame:

```sql
SELECT public.prune_hook_execution_log(30);
```

Para un hook colgado de un evento de alta frecuencia, además está `log_enabled = false` en
la registración ("Registrar ejecuciones" en la ventana). El dispatcher ya trunca
`input`/`output` a ~8 KB.

**Apagar una customización.** Desactivar la registración (`is_active = false`) es preferible
a borrarla: se conserva la configuración y el histórico sigue enlazado.

## 10. Verificación

Antes de instrumentar ningún flujo productivo, importar el dispatcher y ejecutarlo con
datos pineados:

| Entrada | Resultado esperado |
| --- | --- |
| Sin filas en `hook_registry` | `executed: 0`, `patch: {}`, `ok: true`, y no toca nada |
| `depth: 9` | `skipped_reason: "max_depth"` |
| `hook_path: ["invoice.after_upsert"]` | `skipped_reason: "cycle"` |
| Con el hook de ejemplo registrado | `executed: 1` y una fila `success` en `hook_execution_log` |
| Ese hook en `mode='async'` | Retorna al instante, `patch` vacío, el hook igual corrió |
| `on_error='fail'` + `handler_ref` inexistente | Fila `error` en el log y aborto |

El primero es el más importante: es la prueba de la propiedad de seguridad de la que depende
todo lo demás.

Para el hook de ejemplo, la prueba de más valor no necesita n8n — correr su SQL a mano
dentro de `BEGIN; … ROLLBACK;` y comprobar el invariante:

```sql
SELECT i.id, i.total, COALESCE(SUM(ii.total), 0) AS items
FROM public.invoices i
LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
GROUP BY i.id, i.total
HAVING i.total <> COALESCE(SUM(ii.total), 0);
```

Debe devolver el mismo conjunto (idealmente vacío) antes y después.
