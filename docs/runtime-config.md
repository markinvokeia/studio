# Runtime Configuration — Variables de entorno en tiempo de ejecución

## Regla fundamental

**Nunca leer `process.env` ni `NEXT_PUBLIC_*` directamente en el código.** Siempre usar las funciones de `src/lib/runtime-config.ts`.

```ts
// ❌ Incorrecto — rompe el patrón de runtime config
process.env.NEXT_PUBLIC_API_URL

// ✅ Correcto
import { getApiUrl, getLicenseKey, getMasterSec } from '@/lib/runtime-config';
```

## Por qué existe este patrón

`NEXT_PUBLIC_*` en Next.js se **incrusta en el bundle durante el build** — no se pueden cambiar en producción sin recompilar. Este proyecto usa una sola imagen Docker por commit y necesita funcionar con distintas configuraciones por entorno (staging, producción, cliente A, B…).

La solución: el Server Component `src/app/[locale]/layout.tsx` lee las env vars en Node.js al procesar cada request y las inyecta en el HTML como un `<script>` inline **antes** de que cargue cualquier JS del cliente:

```html
<script>
  window.__INVOKEIA_RUNTIME_CONFIG__ = {"apiUrl":"https://...","licenseKey":"...","masterSec":"..."};
</script>
```

Así basta con reiniciar el contenedor con diferentes variables de entorno — sin rebuild.

## Flujo de resolución (orden de prioridad)

```
window.__INVOKEIA_RUNTIME_CONFIG__  →  process.env.NEXT_PUBLIC_*  →  fallback hardcodeado
```

| Contexto | Fuente usada |
|----------|-------------|
| Browser (cliente) | `window.__INVOKEIA_RUNTIME_CONFIG__` inyectado por el layout |
| Servidor SSR/SSG | `process.env.NEXT_PUBLIC_*` |
| Sin ninguna de las dos | Fallback hardcodeado en `runtime-config.ts` |

## API pública

```ts
import { getApiUrl, getWebhookBaseUrl, getLicenseKey, getMasterSec } from '@/lib/runtime-config';

getApiUrl()          // URL base del backend (n8n)
getWebhookBaseUrl()  // getApiUrl() + "/webhook"
getLicenseKey()      // Clave de cifrado de licencias
getMasterSec()       // Gate de administración de licencias
```

## Variables disponibles

| Variable de entorno | Getter | Uso |
|---------------------|--------|-----|
| `NEXT_PUBLIC_API_URL` | `getApiUrl()` | URL base del backend n8n |
| `NEXT_PUBLIC_LICENSE_KEY` | `getLicenseKey()` | Cifrado de licencias |
| `NEXT_PUBLIC_MASTER_SEC` | `getMasterSec()` | Gate admin de licencias |
| `NEXT_PUBLIC_CLIENT_ID` | `getClientId()` | Identificador de cliente para SSE |
| `NEXT_PUBLIC_EVENT_PUSHER_KEY` | `getEventPusherKey()` | API key para el stream de eventos SSE |

## Cómo añadir una nueva variable de entorno

1. Añadir el campo a `RuntimeConfig` en `src/lib/runtime-config.ts`
2. Leerla en `getRuntimeConfig()` desde `process.env`
3. Crear un getter público (`getXxx()`) con el mismo patrón: `getRuntimeConfig().xxx || process.env.NEXT_PUBLIC_XXX || ''`
4. Añadirla a `runtimeConfig` en `src/app/[locale]/layout.tsx`
5. Documentarla en este archivo y en `CLAUDE.md`
