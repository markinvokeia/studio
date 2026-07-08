# Overrides de traducción por cliente (i18n)

## Qué resuelve

Permite que un cliente (o varios) tenga **textos distintos** para ciertas claves de traducción sin duplicar todo el archivo de mensajes ni meter condicionales en el código. Cada cliente define **solo las claves que cambian**; todo lo demás se toma del base compartido.

Ejemplo real: el cliente `bracketsup` muestra los estados de cita con otra redacción ("Vino a la Cita" en vez de "Completada", "Llegó a la sala de espera" en vez de "Llegó", etc.) sin afectar al resto de los clientes.

## Cómo funciona

Los mensajes que consume `next-intl` son el objeto que devuelve [`src/i18n.ts`](../src/i18n.ts). Ahí se carga el base del locale y, si el cliente actual tiene un archivo de override, se hace un **deep-merge**: el override pisa solo las claves que trae y el resto cae al base.

```ts
// src/i18n.ts (resumido)
const base = (await import(`./messages/${locale}.json`)).default;

const client = process.env.NEXT_PUBLIC_CLIENT_ID?.trim();
let messages = base;
if (client) {
  try {
    const override = (await import(`./messages/overrides/${client}/${locale}.json`)).default;
    messages = deepMerge(base, override); // el override solo tiene los deltas
  } catch {
    // Sin override para este cliente/locale → se usa el base tal cual.
  }
}
```

El cliente se selecciona con **`NEXT_PUBLIC_CLIENT_ID`**, la misma variable que usa el resto de la [runtime config](./runtime-config.md). Como `getRequestConfig` corre en el servidor, la lee de `process.env` en tiempo de request (consistente con el patrón de runtime config: sin rebuild, basta reiniciar el contenedor con otra variable).

Si `NEXT_PUBLIC_CLIENT_ID` no está definido, o el cliente no tiene carpeta de override, se sirve el base sin cambios.

## Estructura de archivos

```
src/messages/
  es.json                      ← base (todas las claves)
  en.json
  overrides/
    <clientId>/
      es.json                  ← SOLO las claves que ese cliente pisa
      en.json
```

## Cómo agregar un override para un cliente

1. Crear la carpeta `src/messages/overrides/<clientId>/` (el `<clientId>` debe coincidir con el valor de `NEXT_PUBLIC_CLIENT_ID` del deployment de ese cliente).
2. Crear `es.json` y/o `en.json` con **solo las claves a sobreescribir**, respetando la jerarquía de namespaces del base.
3. Setear `NEXT_PUBLIC_CLIENT_ID=<clientId>` en el entorno del deployment.

No hace falta tocar código: `src/i18n.ts` ya resuelve cualquier carpeta bajo `overrides/`.

### Ejemplo — cliente `bracketsup`

`src/messages/overrides/bracketsup/es.json` (solo deltas):

```json
{
  "AppointmentStatus": {
    "completed": "Vino a la Cita",
    "arrived": "Llegó a la sala de espera",
    "no_show": "Faltó"
  },
  "CancellationReason": {
    "late": "Canceló Tarde",
    "in_time": "Canceló con Tiempo",
    "no_notice": "Canceló sin aviso",
    "by_doctor": "Canceló el Doctor",
    "by_clinic": "Canceló la clínica"
  }
}
```

Las claves no listadas (`confirmed`, `scheduled`, otros namespaces…) siguen tomándose del base.

## Notas

- El override es **parcial**: incluí únicamente lo que cambia. Cuanto más chico, mejor de mantener.
- El deep-merge es recursivo por namespace, así que podés sobreescribir una sola clave dentro de un objeto sin repetir el resto.
- **Prueba local:** agregá `NEXT_PUBLIC_CLIENT_ID=<clientId>` a tu `.env.local` y reiniciá el dev server. Sin esa variable ves el base. Evitá commitear ese cambio en `.env.local` (forzaría el cliente para todos).
- El `import()` con path variable hace que webpack empaquete todos los archivos bajo `overrides/`; el `try/catch` cubre el caso de que un cliente no tenga override.
