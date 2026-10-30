# Moneda configurable — qué hay que tocar en el backend

El frontend ya es agnóstico de la moneda: no queda ni un `'UYU'` escrito a mano
en `src/`. Toda la UI lee la moneda de `clinic.currency` (principal) y
`clinic.secondary_currency` (secundaria, opcional), y manda el código ISO de 3
letras que corresponda. **El contrato de la API no cambia**: los campos
`currency`, `source_currency`, `moneda` y `exchange_rate` siguen llamándose
igual y llevando lo mismo.

Lo que queda pendiente es del lado de n8n y la base de datos. Nada de esto rompe
hoy: con una clínica en UYU el comportamiento es idéntico al actual. Lo de abajo
es lo que hace falta para que una clínica en EUR (o MXN, o la que sea) funcione
de punta a punta.

---

## 1. Migración de base de datos — obligatoria

`database/scripts/092_20260923_clinic-secondary-currency.sql`

Añade `clinic.secondary_currency VARCHAR(3) NULL` con su CHECK de formato, y
marca `secondary_currency = 'USD'` en las clínicas que hoy tienen
`currency = 'UYU'`, para conservar exactamente el comportamiento actual.

Sin esta migración, el selector de moneda secundaria de Configuración → Datos de
la Clínica guarda contra una columna que no existe.

## 2. `clinic/update` — obligatorio

Workflow **"Web APIs"**, flujo `clinic/update`. Hay **dos** nodos Postgres de
upsert sobre `public.clinic`, porque el flujo se bifurca según venga logo o no:

- `Update Clinic Info` (sin logo)
- `Update Clinic Info1` (con logo)

Los dos mapean las columnas una a una, así que hay que añadir en **ambos**:

```
secondary_currency = {{ $('clinic/update').item.json.body.secondary_currency }}
```

más su entrada en el array `schema` del nodo (tipo `string`, no requerida).

El frontend manda el campo **siempre**, y vacío (`''`) cuando se quiere volver a
moneda única — conviene normalizar `'' → NULL` antes del upsert.

El `GET /clinic` devuelve la fila entera, así que la lectura no necesita cambios.

## 2bis. `cash-session/open` — obligatorio (ya corregido en el repo)

El nodo **`Code in JavaScript1`** creaba siempre **dos filas fijas** en
`cash_session_currencies`, UYU y USD, leyendo `opening_amount.UYU` y
`opening_amount.USD`:

```js
return [
  { json: { …, currency: 'UYU', opening_amount: body.opening_amount.UYU, date_rate: 1 } },
  { json: { …, currency: 'USD', opening_amount: body.opening_amount.USD, date_rate: body.date_rate } },
];
```

Con una clínica en euros eso abría la caja con dos monedas que no usa —ambas en
`undefined`— y sin la suya, aunque el frontend mandara
`opening_amount: { "EUR": 905, "USD": 0 }`.

La versión corregida está en
[`n8n-workflows/cash-session-open.json`](../n8n-workflows/cash-session-open.json):
genera **una fila por cada moneda presente en `opening_amount`**, y da
`date_rate = 1` a la moneda principal de la sesión (`body.currency`) y el tipo
de cambio enviado a las demás — que es exactamente el criterio que ya tenía UYU.

Para el par UYU/USD el resultado es idéntico al de antes, así que no hay
regresión. **Hay que importar ese workflow en n8n**; el JSON del repo no se
aplica solo.

> El export incluía `pinData` con un JWT real de sesión. Se eliminó antes de
> versionarlo: no se commitean tokens.

## 3. Defaults `'UYU'` cableados — recomendado

Estos no rompen, pero hacen que un registro sin moneda explícita aterrice en UYU
en una clínica que no trabaja en UYU. El criterio correcto es tomar
`clinic.currency` en vez del literal.

### Escrituras (las que más importan: fijan la moneda del registro)

| Workflow | Nodo | Expresión |
| --- | --- | --- |
| `Payment.json` | `Validar Entrada` | `input.payment_currency \|\| query?.payment_currency \|\| 'UYU'` |
| `Payment.json` | `Registrar Pago` | `…json.currency \|\| 'UYU'` |
| `Payment.json` | `Registrar Movimiento Caja` | `…json.currency \|\| 'UYU'` |
| `All Sales Quote endpoints.json` | `Insert`, `Update` | `$json.body.currency \|\| 'UYU'` |
| `All Sales Quote endpoints.json` | `Create allocations` | `…json.currency \|\| 'UYU'` |
| `Quote Confirmation or Rejection.json` | `Crear Orden` | `…json.currency \|\| 'UYU'` |

### Lecturas y reportes (afectan a lo que se muestra, no a lo guardado)

| Workflow | Nodo | Expresión |
| --- | --- | --- |
| `dashboard/dashboard-gerencial.json` | `Query Executive Summary`, `Query Produccion Sucursal`, `Query Ventas Por Servicio`, `Query Evolucion Mensual` | `COALESCE($n::varchar, 'UYU') AS mon` |
| `reports/reports-produccion.json` | `Query Produccion Doctor`, `Query Comparativo`, `Query Honorarios` | `COALESCE(i.currency, 'UYU') AS currency` |
| `reports/reports-ingresos.json` | `Query Deudores` | `query?.currency \|\| 'UYU'` |

En los dashboards y reportes el frontend ya manda siempre el parámetro
`currency`, así que el `COALESCE` solo actúa como red de seguridad — pero una
red que apunta a la moneda equivocada.

## 4. Lógica de conversión que asume que UYU es la moneda local — importante

Esto sí es un error real fuera de Uruguay, no solo un default feo.

**`Payment.json`, nodo `list_payments`:**

```js
if (invoiceCurrency !== currency && invoiceCurrency !== 'UYU') {
  convertedAmount = paidAmount / exchangeRate;
}
```

**`Payment.json`, nodos `Insert payment allocations` / `Insert invoice allocations`:**

```js
$('Validar Entrada').first().json.invoice_currency !== 'UYU'
  ? $json.amount / ($json.exchange_rate || 1)
  : $json.amount
```

La comparación contra `'UYU'` es en realidad "¿es esta la moneda principal de la
clínica?". El frontend ya resolvió esto con un único helper,
`convertAmount(amount, from, to, rate, primaryCurrency)` en
[`src/lib/currency.ts`](../src/lib/currency.ts), con este criterio:

> `exchange_rate` son unidades de la moneda **principal** por cada unidad de la
> secundaria. Pasar de secundaria a principal es **multiplicar**; de principal a
> secundaria, **dividir**.

Conviene replicar ese mismo criterio en n8n, sustituyendo `'UYU'` por la moneda
principal de la clínica.

**`reports/reports-pacientes.json`, `Query Pacientes Inactivos`:** agrega la
deuda en columnas fijas `debt_uyu` / `debt_usd`:

```sql
COALESCE(SUM(CASE WHEN currency = 'UYU' THEN total - paid_amount ELSE 0 END), 0) AS debt_uyu
```

Debería agrupar por `currency` en vez de tener una columna por moneda.

## 5. Cierre de caja — revisar el workflow, muy probablemente roto

> **Pendiente de verificar.** El flujo de cierre no está versionado en el repo,
> así que no se pudo auditar. Pero el de apertura resultó tener dos filas UYU/USD
> cableadas (§2bis), y el cierre es su espejo: actualiza `cash_session_currencies`
> con los importes declarados. **Es muy probable que tenga el mismo fallo** —
> leer `declared_cash_uyu` / `declared_cash_usd` fijos en vez de recorrer las
> monedas de la sesión. Conviene exportarlo y revisarlo antes de cerrar una caja
> abierta en otra moneda.

Del lado del contrato, el frontend ya es compatible:

`POST /cashier/sessions/close` recibía `declared_cash_uyu` y
`declared_cash_usd`. Ahora el frontend manda **un campo por moneda de la
sesión**, con el mismo patrón de nombre:

```
declared_cash_<código en minúsculas>   →  declared_cash_uyu, declared_cash_eur, …
```

Para una clínica en UYU+USD esto produce **exactamente los mismos dos campos que
antes**, así que el backend actual sigue funcionando sin tocar nada.

Además se manda `declared_cash` como objeto JSON (`{"EUR": 1234.5}`), para que
el backend pueda dejar de depender de los campos por moneda. Lo mismo con
`closing_denominations` y `bank_deposit_denominations`, que ya usaban claves por
moneda en minúsculas (`uyu`, `usd`) y ahora simplemente traen las que haya.

## 6. Lo que se deja como está

`docs/n8n-flows/BROU USD-UYU Exchange Rate (Gemini AI).json` — el scraper de
cotizaciones del BROU. Es específico de Uruguay por definición y solo alimenta
el par UYU/USD.

El frontend ya lo trata así: `useCurrencySettings().hasAutoRate` es `true` solo
cuando el par configurado es UYU/USD. Con cualquier otro par se oculta el
historial de cotizaciones y el tipo de cambio se carga a mano al abrir la caja,
que es como ya funcionaba `date_rate`.

## 7. Los `defaultValue="UYU"` del baseline

`database/changelogs/v1_baseline.xml` tiene `defaultValue="UYU"` en 10 columnas
`currency VARCHAR(3)` (líneas 447, 615, 894, 940, 1112, 1243, 1270, 1316, 1408,
1787). El tipo ya admite cualquier ISO, así que no bloquean nada.

No se tocan en esta entrega: cambiarlos es una decisión de producto (¿el default
debe pasar a NULL y exigirse siempre desde el cliente?) y, si se hace, va por una
migración nueva en `database/scripts/`, nunca editando el baseline.
