# Plan de migración de npm a pnpm — Studio (Next.js 15)

## Contexto

El proyecto **studio** (clínica dental SaaS, Next.js 15.5.9 + React 18.3 + TS estricto + Tailwind + Genkit + Firebase) usa hoy **npm** con un `package-lock.json` de ~597 KB. Se quiere migrar a **pnpm** para:

- Reducir el tamaño de `node_modules` (symlinks vs copias).
- Acelerar instalaciones en CI y local.
- Aprovechar un store global compartido entre proyectos.
- Tener resolución estricta de peer deps (detecta más bugs de versiones).

La migración también es buena ocasión para corregir un **bug del Dockerfile**: actualmente hace `COPY package.json` y `RUN npm install` sin el lockfile — los builds no son reproducibles.

> **Nota sobre "reproducible" en un contexto multi-tenant.**
> Este proyecto usa **una imagen única por rama/commit** y recibe `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_LICENSE_KEY` y `NEXT_PUBLIC_MASTER_SEC` como configuración runtime desde el despliegue. Estas variables se inyectan en `window.__INVOKEIA_RUNTIME_CONFIG__`, por lo que ya no obligan a crear un build distinto por cliente.
>
> "Reproducible" aquí significa **determinismo de dependencias**: dos builds con los mismos inputs (lockfile + código) producen los mismos artefactos. Hoy, sin lockfile en la imagen, `npm install` puede resolver versiones distintas entre builds y nadie lo nota. Con `pnpm install --frozen-lockfile` + el lockfile copiado, eso se elimina.
>
> El patrón esperado para Docker es:
> ```bash
> docker build -t studio:runtime-test-<sha> .
> ```
> La URL de API y las claves públicas de licencia se pasan al contenedor en runtime, no como `--build-arg`.

### Hallazgos clave del diagnóstico

| Área | Estado actual |
|---|---|
| `package.json` | 50+ deps, sin `packageManager`, sin `engines`, sin `postinstall`. |
| `Dockerfile` líneas 6-12 | `COPY package.json` (sin lock) + `npm install` → builds no reproducibles. |
| `apphosting.yaml` | Firebase App Hosting. Históricamente soporta npm/yarn nativamente; pnpm requiere validación con `packageManager` declarado y posiblemente `node-linker=hoisted`. |
| `patch-package` en deps (`package.json:65`) | Declarado pero sin `postinstall` ni carpeta `patches/`. Código muerto — eliminar. |
| Referencias a `npm run …` | `CLAUDE.md` líneas 8-16, `AGENTS.md` líneas 9-21, 127-134, `db-manager.sh` líneas 25-26, 247-249, 473, 552-554. |
| `.gitignore` | Ya ignora `.pnpm-debug.log*`; falta `.pnpm-store/`. |
| No existe `.nvmrc` ni `.npmrc` | Fijar Node 20 (alineado con `node:20-alpine` del Dockerfile). |
| Versiones disponibles localmente | pnpm 10.18.3, Node 22.21.0, npm 11.12.1. |

### Riesgos identificados

1. **Hoisting estricto de pnpm.** Algunas libs (`genkit`, `firebase`, `@genkit-ai/next`, `react-odontogram@0.5.5`) podrían requerir `node-linker=hoisted` si rompen al no encontrar deps transitivas.
2. **Firebase App Hosting.** Su buildpack soporta npm/yarn nativamente; pnpm requiere validar con deploy preview antes del merge. Si el buildpack falla, el Plan B (Dockerfile como `runtime: dockerfile` en `apphosting.yaml`) cubre este caso.
3. **Cambio de gestor invalida cachés** de CI y `.next/`.

---

## Plan de migración

### Fase 0 — Prerrequisitos (10 min)

- [ ] Versión de pnpm a fijar: **`pnpm@11.2.2`** (última estable).
- [ ] Crear rama `chore/migrate-to-pnpm` desde `test`.
- [ ] Comunicar al equipo: pausar instalaciones de deps durante la migración.

### Fase 1 — Limpieza previa (5 min)

- [ ] Eliminar `patch-package` de `package.json:65` (no se usa).
- [ ] Limpieza local:
  ```bash
  rm -rf node_modules package-lock.json .next
  ```

### Fase 2 — Configuración de pnpm (15 min)

**Archivos a crear/modificar:**

- [ ] `package.json` — añadir:
  ```json
  "packageManager": "pnpm@11.2.2",
  "engines": { "node": ">=20.0.0", "pnpm": ">=11" }
  ```
- [ ] Crear `.npmrc`:
  ```
  engine-strict=true
  auto-install-peers=true
  strict-peer-dependencies=false
  # Activar si Firebase App Hosting o alguna dep rompe:
  # node-linker=hoisted
  ```
- [ ] Crear `.nvmrc` con contenido `20`.
- [ ] Actualizar `.gitignore`: añadir `.pnpm-store/`.

### Fase 3 — Instalación y verificación local (20 min)

```bash
pnpm install                # genera pnpm-lock.yaml
pnpm run typecheck
pnpm run lint
pnpm run build              # prueba crítica: detecta peer deps rotas
pnpm run dev                # smoke test manual en navegador
pnpm exec playwright test --reporter=line
```

**Smoke test manual obligatorio:**

- Login.
- Dashboard / Calendario.
- Página que use Genkit (IA).
- Formulario con `react-hook-form` + `react-day-picker`.
- Gráfica de `recharts`.
- `AppointmentPanel.tsx`.

**Si hay errores de módulos no encontrados:** activar `node-linker=hoisted` en `.npmrc`, borrar `node_modules`, reinstalar.

### Fase 4 — Dockerfile (15 min)

Reemplazar bloques `deps` y `builder` del `Dockerfile`:

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod=false

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# Stage `runner` queda igual (solo copia .next/standalone, no necesita pnpm).
```

**Beneficio adicional:** corrige el bug actual de no copiar el lockfile → builds reproducibles.

Validar: `docker build -t studio-test .` debe completar sin errores.

### Fase 5 — Firebase App Hosting (validación crítica, 30 min)

- [ ] Push de la rama y crear un **deploy preview** en App Hosting.
- [ ] Si el buildpack rechaza pnpm: activar `node-linker=hoisted` en `.npmrc`.
- [ ] **Plan B** si App Hosting no soporta pnpm: configurar `apphosting.yaml` con `runtime: dockerfile` — el contenedor de la Fase 4 ya está listo.

### Fase 6 — Documentación y scripts (15 min)

Reemplazar `npm run X` → `pnpm X` (o `pnpm run X` para scripts custom) en:

- [ ] `CLAUDE.md` líneas 8-13, 16.
- [ ] `AGENTS.md` líneas 9-21, 127-128, 134.
- [ ] `db-manager.sh` líneas 25-26, 247-249, 473, 552-554.
- [ ] `README.md` si menciona comandos de instalación.
- [ ] CI (`.github/workflows/*.yml` si existe):
  ```yaml
  - uses: pnpm/action-setup@v4
    with: { version: 11 }
  - uses: actions/setup-node@v4
    with:
      node-version: 20
      cache: 'pnpm'
  - run: pnpm install --frozen-lockfile
  ```

### Fase 7 — Commits y PR (10 min)

Dos commits para revisión clara:

1. `chore: add pnpm config (packageManager, .npmrc, .nvmrc, .gitignore)`
2. `chore: migrate from npm to pnpm` — incluye `pnpm-lock.yaml`, borra `package-lock.json`, actualiza Dockerfile y docs.

PR contra `main` con checklist de QA arriba.

---

## Verificación end-to-end

### Comandos (deben terminar exit 0)

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm exec playwright test
docker build -t studio-test .
```

### Validación manual de la app

- `pnpm run dev` arranca en http://0.0.0.0:3000.
- Login funciona.
- Dashboard carga sin errores en consola del navegador.
- Una página con Genkit IA responde.
- Formulario con `react-hook-form` + `react-day-picker` valida y envía.
- `AppointmentPanel.tsx` renderiza correctamente.
- Recharts dibuja una gráfica.

### Validación de despliegue

- Deploy preview a Firebase App Hosting completa sin error.
- La app es accesible y funcional en la URL del preview.

---

## Archivos críticos modificados

| Archivo | Cambio |
|---|---|
| `package.json` | Añadir `packageManager`, `engines`. Eliminar `patch-package`. |
| `.npmrc` | **Nuevo.** Config de pnpm. |
| `.nvmrc` | **Nuevo.** `20`. |
| `.gitignore` | Añadir `.pnpm-store/`. |
| `pnpm-lock.yaml` | **Nuevo.** Generado por `pnpm install`. |
| `package-lock.json` | **Borrar.** |
| `Dockerfile` | Usar `corepack` + `pnpm install --frozen-lockfile`. Corregir bug de lockfile faltante. |
| `CLAUDE.md`, `AGENTS.md`, `db-manager.sh` | Reemplazar `npm run` → `pnpm`. |
| `apphosting.yaml` | Solo si Firebase App Hosting requiere `runtime: dockerfile`. |

---

## Rollback

Si tras el merge surge un problema en producción:

```bash
git revert <commit-de-migración>
rm -rf node_modules pnpm-lock.yaml
npm ci
```

El `package-lock.json` queda en el historial de git — rollback trivial.
