# Guía de Administración de Licencias — InvokeIA

> **Audiencia:** Administradores InvokeIA (equipo interno).  
> **Propósito:** Crear, renovar y verificar licencias; entender dónde y cómo se aplican las restricciones en la plataforma.

---

## 1. Conceptos clave

| Concepto | Descripción |
|----------|-------------|
| **Licencia** | Blob cifrado (AES-256-GCM) que contiene los límites y fechas de la suscripción de una clínica. Se guarda en la base de datos del backend. |
| **Clave maestra (`NEXT_PUBLIC_MASTER_SEC`)** | Contraseña de acceso a la página de gestión de licencias. Es independiente del cifrado. Solo sirve para que personas no autorizadas no puedan entrar a crear o ver licencias. |
| **Clave de cifrado (`NEXT_PUBLIC_LICENSE_KEY`)** | Clave AES-256-GCM con la que se cifra y descifra el blob de la licencia. Debe mantenerse en secreto y configurarse en el servidor de cada clínica. |
| **Suscripción** | Registro histórico de cada licencia generada. Se guarda por separado en la tabla `subscriptions`. |

> **Importante:** La clave maestra y la clave de cifrado son dos valores distintos y con roles distintos.  
> — `NEXT_PUBLIC_MASTER_SEC` → autenticación en la UI.  
> — `NEXT_PUBLIC_LICENSE_KEY` → cifrado/descifrado del blob de licencia.

---

## 2. Variables de entorno requeridas

Configurar en el archivo `.env.local` del servidor donde corre InvokeIA:

```env
# Contraseña de acceso a la gestión de licencias (solo equipo InvokeIA)
NEXT_PUBLIC_MASTER_SEC=tu-contraseña-de-acceso

# Clave AES-256-GCM para cifrar y descifrar el blob de licencia
NEXT_PUBLIC_LICENSE_KEY=tu-clave-de-cifrado-secreta
```

> Ambas variables empiezan con `NEXT_PUBLIC_` porque se usan en el browser (Next.js). Esto significa que quedan expuestas en el bundle de cliente, por lo que el nivel de seguridad real proviene de la combinación con los **permisos de roles** del sistema.

---

## 3. Ubicación en la interfaz

### 3.1 Menú de Licencias

```
Sidebar → Sistema → Licencias
Ruta: /system/licenses
Permiso requerido: LICENSING_VIEW_MENU
```

### 3.2 Menú de Suscripciones (historial)

```
Sidebar → Sistema → Suscripciones
Ruta: /subscriptions
Permiso requerido: SUBSCRIPTIONS_VIEW_MENU
```

### 3.3 Permisos necesarios para gestionar licencias

| Permiso | Código | Descripción |
|---------|--------|-------------|
| Ver menú | `LICENSING_VIEW_MENU` | Muestra el ítem en el sidebar |
| Ver licencia | `LICENSING_VIEW` | Accede a la página |
| Generar licencia | `LICENSING_GENERATE` | Muestra el formulario de generación |
| Ver suscripciones | `SUBSCRIPTIONS_VIEW_MENU` + `SUBSCRIPTIONS_VIEW` | Accede al historial |

Los roles **Administrador** (id=4) y **Gerente** (id=37) tienen todos estos permisos asignados por defecto (ver `030_20260529_licensing-tables-and-permissions.sql`).

---

## 4. Flujo de acceso a la página de licencias

```
1. Usuario navega a /system/licenses
2. El sistema muestra un campo "Clave maestra"
3. El usuario ingresa la contraseña
4. El sistema compara contra NEXT_PUBLIC_MASTER_SEC
   ├── No coincide → mensaje "Clave incorrecta. Intente nuevamente."
   └── Coincide → continúa al paso 5
5. El sistema hace GET /license al backend
   ├── Sin licencia → muestra "Sin licencia activa" + formulario vacío
   └── Con licencia → descifra el blob con NEXT_PUBLIC_LICENSE_KEY
       ├── Descifrado ok → muestra datos de la licencia actual
       └── Descifrado falla → la clave de cifrado no coincide (ver §8)
6. Se muestra el formulario de generación precargado con los datos de la licencia actual
```

---

## 5. Crear una licencia nueva

### 5.1 Campos del formulario

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **Tipo de suscripción** | Select | `Mensual` / `Anual` / `Personalizado` |
| **Fecha de inicio** | Date | YYYY-MM-DD. En renovaciones se precarga con la fecha de fin de la licencia anterior |
| **Fecha de fin** | Date | YYYY-MM-DD. Vacío en renovaciones — debe completarse manualmente |
| **Máx. doctores** | Número | Cantidad máxima de doctores que se pueden crear |
| **Máx. recepcionistas** | Número | Cantidad máxima de recepcionistas |
| **Máx. admins** | Número | Cantidad máxima de administradores |
| **Máx. super admins** | Número | Cantidad máxima de super administradores |
| **Máx. nuevos pacientes/mes** | Número | Límite mensual de altas de pacientes nuevos |
| **Acceso IA** | Select | `Completo` / `Solo doctores` / `Sin acceso` |
| **Notas** | Texto | Opcional. Comentario interno sobre la suscripción |

### 5.2 Qué ocurre al presionar "Generar Licencia"

1. Se cifra el payload con `NEXT_PUBLIC_LICENSE_KEY` (AES-256-GCM) → se obtiene el blob
2. Se hace `POST /license` con `{ license_key: "<blob>" }` → se guarda en la BD
3. Se hace `POST /subscriptions` con todos los campos del payload → queda en el historial
4. El store Zustand se actualiza con la nueva licencia (activa de inmediato, sin recarga)
5. Se muestra el blob generado en un textarea copiable

### 5.3 Guardar el blob generado

Después de generar, la página muestra el blob completo. **Copiar y guardar** este blob es opcional porque ya se guardó en el backend, pero puede ser útil para registros manuales.

---

## 6. Renovar una licencia

La renovación es simplemente generar una nueva licencia que reemplaza a la anterior.

**Comportamiento de precarga automática:**

Al acceder a la página con una licencia existente, el formulario se precarga con:
- Todos los límites y configuración de la licencia actual
- `Fecha de inicio` = fecha de fin de la licencia anterior (renovación continua)
- `Fecha de fin` = **vacío** — el administrador debe ingresarla manualmente

**Pasos para renovar:**

```
1. Ingresar a /system/licenses con la clave maestra
2. Verificar los datos de la licencia actual (card superior)
3. Ajustar los campos del formulario según la nueva suscripción
   → La fecha de inicio ya viene precargada con el fin de la licencia anterior
   → Completar la nueva fecha de fin
   → Modificar límites si corresponde
4. Presionar "Generar Licencia"
5. La nueva licencia queda activa de inmediato
6. El historial en /subscriptions muestra ambas entradas
```

---

## 7. Verificar una licencia generada

El mecanismo de verificación es el propio cifrado AES-256-GCM:

- AES-256-GCM incluye un **authentication tag** de 16 bytes en el blob
- Cualquier modificación al blob o uso de la clave incorrecta hace que el descifrado falle con error de autenticación
- Si `loadLicense(blob, NEXT_PUBLIC_LICENSE_KEY)` tiene éxito → el blob es auténtico y no fue alterado

**Verificación manual desde consola del browser (para debugging):**

```javascript
// Pegar en DevTools Console mientras está cargada la app
const store = window.__ZUSTAND_STORE__; // solo en dev con devtools
// O acceder directamente:
const { license, isValid, isExpired, daysLeft } = useLicenseStore.getState();
console.log({ license, isValid, isExpired, daysLeft });
```

**Verificación en /subscriptions:**

La tabla de suscripciones muestra la licencia activa con un badge verde **"Activa"** en la columna Estado. La comparación se hace contra el `licenseId` del payload descifrado en el store.

---

## 8. Solución de problemas comunes

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| "NEXT_PUBLIC_MASTER_SEC no está configurado" | Falta la variable en `.env.local` | Agregarla y reiniciar el servidor |
| "Clave incorrecta" al ingresar | El valor ingresado no coincide con `NEXT_PUBLIC_MASTER_SEC` | Verificar el valor exacto en el archivo `.env.local` |
| Descifrado falla al cargar la licencia | `NEXT_PUBLIC_LICENSE_KEY` en el servidor no coincide con la usada al generar | Restaurar la clave original o generar una nueva licencia con la clave actual |
| Página muestra "Sin licencia activa" después de verificar | Backend no respondió o la clave de cifrado es incorrecta | Verificar `NEXT_PUBLIC_LICENSE_KEY` y el estado del backend n8n |
| La licencia no aparece en `/subscriptions` | El `POST /subscriptions` falló durante la generación | Verificar los logs del webhook n8n de subscriptions |

---

## 9. Validaciones en la UI (enforcement)

Cuando un usuario intenta crear un registro y se alcanzó el límite de la licencia, aparece un mensaje de error **dentro del dialog** (justo encima del botón de guardar). No se hace el request al backend.

### 9.1 Doctores (`/config/doctors`)

**Condición:** al intentar crear un doctor nuevo (no en edición), si `doctores_actuales >= maxDoctors`.

**Mensaje:**
> *"Tu suscripción permite hasta N doctores. Actualizá la licencia para agregar más."*

**Código:** `License.enforcement.doctorLimitReached` con `{ max: license.maxDoctors }`

---

### 9.2 Usuarios del sistema — Secretarias y Administración (`/system/users`)

**Condición:** al intentar crear un usuario nuevo, si `usuarios_actuales >= maxReceptionists + maxAdmins + maxSuperAdmins`.

> El límite es la **suma total** de recepcionistas + admins + super admins porque los roles se asignan después de crear el usuario.

**Mensaje:**
> *"Tu suscripción permite hasta N usuarios de sistema (secretarias y administración). Actualizá la licencia para agregar más."*

**Código:** `License.enforcement.userLimitReached` con `{ max: maxReceptionists + maxAdmins + maxSuperAdmins }`

---

### 9.3 Pacientes nuevos (`/patients`)

**Condición:** al intentar registrar un paciente nuevo (no en edición), si `nuevos_pacientes_este_mes >= maxMonthlyNewPatients`.

> El conteo mensual se obtiene del endpoint de reportes (`GET /reports/nuevos-pacientes`) filtrado al mes en curso.

**Mensaje:**
> *"Tu suscripción permite hasta N pacientes nuevos por mes. Se alcanzó el límite de este mes."*

**Código:** `License.enforcement.patientMonthlyLimitReached` con `{ max: license.maxMonthlyNewPatients }`

---

### 9.4 Resumen de límites por entidad

| Entidad | Campo en licencia | Dónde se verifica |
|---------|-------------------|-------------------|
| Doctores | `maxDoctors` | `/config/doctors` → `onSubmit` |
| Recepcionistas + Admins | `maxReceptionists + maxAdmins + maxSuperAdmins` | `/system/users` → `onSubmit` |
| Pacientes nuevos/mes | `maxMonthlyNewPatients` | `/patients` → `onSubmit` |
| Acceso IA | `aiAccess` | Consultar con `useLicenseStore.getState().hasAIAccess(userRole)` |

---

## 10. Pantallas automáticas por estado de licencia

### 10.1 Banner de vencimiento próximo

- **Cuándo aparece:** cuando restan **5 días o menos** para la fecha de fin
- **Dónde:** barra amarilla en la parte superior del contenido, en todas las páginas autenticadas
- **Componente:** `LicenseExpirationBanner` en `PrivateRoute.tsx`

### 10.2 Pantalla de licencia expirada

- **Cuándo aparece:** cuando la fecha de fin ya pasó (`daysLeft <= 0`)
- **Dónde:** overlay `absolute inset-0` sobre todo el contenido, en todas las páginas autenticadas
- **Excepción:** el usuario `system@invokeia.com` no ve el overlay y puede operar normalmente
- **Componente:** `LicenseExpiredScreen` en `PrivateRoute.tsx`

---

## 11. Arquitectura técnica (referencia)

```
src/
├── lib/
│   ├── license-crypto.ts        # encryptLicense / decryptLicense (AES-256-GCM)
│   └── types.ts                 # LicensePayload, CreateLicenseInput, Subscription
├── stores/
│   └── license-store.ts         # Zustand store global (loadLicense, canAddUserByRole, etc.)
├── components/
│   └── license/
│       ├── LicenseInitializer.tsx      # Carga la licencia al hacer login
│       ├── LicenseExpiredScreen.tsx    # Overlay de licencia vencida
│       └── LicenseExpirationBanner.tsx # Banner de aviso 5 días antes
└── app/[locale]/
    ├── system/licenses/page.tsx   # Gestión de licencias (requiere MASTER_SEC)
    └── subscriptions/page.tsx     # Historial de suscripciones

database/
└── scripts/
    └── 030_20260529_licensing-tables-and-permissions.sql

n8n-workflows/
├── license-get.json         # GET /license
├── license-save.json        # POST /license
├── subscriptions-list.json  # GET /subscriptions
└── subscriptions-create.json # POST /subscriptions
```

### Store Zustand — métodos principales

```typescript
// Verificar si se puede agregar un usuario por rol
useLicenseStore.getState().canAddUserByRole('doctor' | 'receptionist' | 'admin' | 'super_admin', currentCount)

// Verificar si se puede agregar un paciente nuevo este mes
useLicenseStore.getState().canAddMonthlyPatient(currentMonthlyCount)

// Verificar acceso a funciones de IA
useLicenseStore.getState().hasAIAccess(userRole?)

// Estado de la licencia
const { license, isValid, isExpired, isExpiringSoon, daysLeft } = useLicenseStore()
```

---

## 12. Checklist de deploy en un cliente nuevo

- [ ] Configurar `NEXT_PUBLIC_MASTER_SEC` en `.env.local`
- [ ] Configurar `NEXT_PUBLIC_LICENSE_KEY` en `.env.local`
- [ ] Ejecutar `030_20260529_licensing-tables-and-permissions.sql` en la base de datos
- [ ] Importar los 4 workflows de n8n (`license-get`, `license-save`, `subscriptions-list`, `subscriptions-create`)
- [ ] Configurar las credenciales de Postgres en cada workflow de n8n
- [ ] Activar los 4 workflows
- [ ] Ingresar a `/system/licenses` con la clave maestra y generar la primera licencia
- [ ] Verificar en `/subscriptions` que aparece la suscripción creada
- [ ] Confirmar que el store Zustand tiene la licencia cargada (badge "Activa" en `/subscriptions`)
