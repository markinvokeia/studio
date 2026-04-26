# Database Migration System — InvokeIA Studio

Sistema integral de versionado y migración de base de datos PostgreSQL usando [Liquibase](https://www.liquibase.com/), ejecutado en Docker. No requiere instalación local de Java ni Liquibase.

---

## Arquitectura — Single Source of Truth

```
┌─────────────────────────────────────────────────────────┐
│                   InvokeIA Studio                        │
│                                                          │
│   Next.js Frontend  ──HTTP──►  n8n Webhooks  ──SQL──►  PostgreSQL
│                                                    ▲     │
│                                                    │     │
│                   db-manager.sh ──────────────────┘     │
│           (herramienta de DBA, no runtime de la app)     │
└─────────────────────────────────────────────────────────┘
```

La app Next.js **nunca** se conecta directamente a PostgreSQL — lo hace a través de n8n. `db-manager.sh` es una herramienta de desarrollo/despliegue que sí conecta directamente a PostgreSQL para gestionar el esquema.

El flujo de trabajo es:

```
DB local (DEV) ──── npm run db:snapshot ───► changelog_YYYYMMDD_HHMM.xml
                                                    │
                                              git commit & push
                                                    │
                                       npm run db:migrate (en cada entorno)
                                                    │
                                            DB staging / CLIENTE / PROD
```

---

## Prerrequisitos

| Requisito | Versión mínima | Notas |
|-----------|---------------|-------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Cualquier versión actual | Obligatorio. Liquibase corre dentro de Docker |
| curl | Incluido en macOS/Linux | Para descarga automática del driver JDBC |
| Acceso a PostgreSQL | — | Ver sección [Conexión a EasyPanel](#conexión-a-easypanel) |

**No se necesita** Java, Liquibase, ni ningún otro runtime adicional.

---

## Quick Start

```bash
# 1. Copia la plantilla de variables de entorno
cp database/.env.example database/.env

# 2. Edita database/.env con tus credenciales
#    DB_URL, DB_USER, DB_PASS, ENVIRONMENT

# 3. Verifica Docker, descarga el driver JDBC, valida la conexión
npm run db:setup

# 4. (Solo la primera vez) Genera el baseline desde la DB existente
npm run db:baseline
#    → Revisa database/changelogs/v1_baseline.xml
#    → Descomenta el <include> en changelog-master.xml
#    → Haz commit de ambos archivos
```

---

## Variables de Entorno

Configura `database/.env` (nunca se sube a git):

| Variable | Requerida | Descripción | Ejemplo |
|----------|-----------|-------------|---------|
| `DB_URL` | Sí | URL JDBC completa | `jdbc:postgresql://localhost:5432/studio` |
| `DB_USER` | Sí | Usuario de PostgreSQL | `postgres` |
| `DB_PASS` | Sí | Contraseña de PostgreSQL | `mysecret` |
| `DB_SCHEMA` | Sí | Schema de la aplicación | `public` |
| `DB_CHANGELOG_SCHEMA` | No | Schema para tablas de tracking de Liquibase | `public` |
| `ENVIRONMENT` | Sí | Entorno actual (controla seguridad y seed data) | `local` |
| `LIQUIBASE_IMAGE` | No | Imagen Docker de Liquibase (no cambiar sin probar) | `liquibase/liquibase:5.0` |

### Valores válidos para `ENVIRONMENT`

| Valor | Seed data corre | Confirmación requerida |
|-------|-----------------|------------------------|
| `local` | Sí | No |
| `dev` | Sí | No |
| `staging` | No | No |
| `CLIENTE` | No | **Sí — escribe "CONFIRMO"** |
| `PROD` | No | **Sí — escribe "CONFIRMO"** |

---

## Referencia de Comandos

### `npm run db:setup`

```bash
npm run db:setup
```

Verifica Docker, descarga el driver JDBC de PostgreSQL 42.7.4 si no existe, valida la conexión a la DB. Ejecutar en cada máquina nueva o después de limpiar `database/drivers/`.

---

### `npm run db:baseline` — Primera vez solamente

```bash
npm run db:baseline
```

Genera `database/changelogs/v1_baseline.xml` con el esquema actual de la DB y lo marca como "ya aplicado" en `DATABASECHANGELOG`. Ejecutar **una sola vez** por proyecto.

Después de ejecutarlo:
1. Abre `database/changelogs/v1_baseline.xml` y revísalo
2. Descomenta en `changelog-master.xml`:
   ```xml
   <include file="changelogs/v1_baseline.xml" relativeToChangelogFile="false"/>
   ```
3. Haz commit de ambos archivos

---

### `npm run db:snapshot` — Capturar cambios

```bash
npm run db:snapshot
```

Compara la DB actual contra los changelogs ya registrados y genera `database/changelogs/changelog_YYYYMMDD_HHMM.xml` con las diferencias.

Flujo después de ejecutarlo:
1. Revisa el XML generado y ajusta si es necesario
2. Agrega en `changelog-master.xml` (sección SECTION 1):
   ```xml
   <include file="changelogs/changelog_YYYYMMDD_HHMM.xml" relativeToChangelogFile="false"/>
   ```
3. Aplica con `npm run db:migrate`

---

### `npm run db:migrate` — Aplicar migraciones

```bash
# Previsualizar SQL sin aplicar nada
npm run db:migrate -- --dry-run

# Aplicar cambios pendientes
npm run db:migrate
```

Ejecuta `liquibase update` con el contexto del `ENVIRONMENT` configurado. Crea automáticamente un tag de rollback con timestamp (`deploy_YYYYMMDD_HHMMSS`).

Para ambientes `PROD` y `CLIENTE`: pausa y requiere escribir **CONFIRMO** antes de continuar.

---

### `npm run db:rollback` — Revertir cambios

```bash
# Revertir el último deploy (1 changeset)
npm run db:rollback

# Revertir hasta un tag específico
npm run db:rollback -- --tag=deploy_20260426_143000

# Revertir N changesets
npm run db:rollback -- --count=3
```

Para ambientes `PROD` y `CLIENTE`: requiere **CONFIRMO**.

Los tags de rollback son creados automáticamente por `db:migrate` con el formato `deploy_YYYYMMDD_HHMMSS`. Para ver todos los tags disponibles consulta la columna `TAG` de la tabla `DATABASECHANGELOG`.

---

## Flujo de Trabajo Diario (Dev)

### Escenario: un desarrollador hace cambios en su DB local

```bash
# 1. Modifica el esquema en tu DB de desarrollo
#    (crea tablas, agrega columnas, crea vistas, etc.)

# 2. Captura los cambios como un nuevo changelog
npm run db:snapshot
# → Genera database/changelogs/changelog_20260427_0930.xml

# 3. Revisa el archivo generado y ajústalo si necesario
code database/changelogs/changelog_20260427_0930.xml

# 4. Registra en changelog-master.xml (descomentar/agregar el <include>)

# 5. Previsualiza el SQL que se ejecutará
npm run db:migrate -- --dry-run

# 6. Aplica localmente para verificar
npm run db:migrate

# 7. Commit y push
git add database/changelogs/
git commit -m "feat(db): add appointment_reminders table"
git push
```

### Escenario: desplegar en un entorno externo

```bash
# Opción A: configurar database/.env con credenciales del entorno
DB_URL=jdbc:postgresql://prod-host:5432/studio
DB_USER=prod_user
DB_PASS=prod_password
ENVIRONMENT=PROD
npm run db:migrate

# Opción B: inyectar variables en línea (útil en CI/CD)
# Crea un archivo .env temporal en database/.env antes de correr el script
```

---

## Escribir Changesets

### Migraciones estructurales (`changelogs/`)

Archivos XML generados por `db:snapshot` o escritos manualmente:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
        http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-latest.xsd">

    <changeSet id="add-appointment-reminders-table" author="dev">
        <createTable tableName="appointment_reminders">
            <column name="id" type="BIGSERIAL">
                <constraints primaryKey="true"/>
            </column>
            <column name="appointment_id" type="BIGINT">
                <constraints nullable="false"/>
            </column>
            <column name="send_at" type="TIMESTAMPTZ">
                <constraints nullable="false"/>
            </column>
            <column name="sent" type="BOOLEAN" defaultValueBoolean="false"/>
        </createTable>
        <rollback>
            <dropTable tableName="appointment_reminders"/>
        </rollback>
    </changeSet>

</databaseChangeLog>
```

### Scripts de metadatos (`scripts/metadata/`)

Para vistas, funciones y datos de catálogo. Usa formato SQL de Liquibase:

```sql
--liquibase formatted sql
--changeset studio:view-v-active-appointments runOnChange:true
CREATE OR REPLACE VIEW v_active_appointments AS
    SELECT a.*, p.full_name AS patient_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    WHERE a.status NOT IN ('cancelled', 'no_show');
--rollback DROP VIEW IF EXISTS v_active_appointments;
```

Reglas:
- Usa `runOnChange:true` para vistas y funciones (se re-ejecutan si cambia el archivo)
- Para inserciones de catálogo, usa `ON CONFLICT DO NOTHING` para idempotencia
- Nombra los archivos con prefijo numérico para controlar el orden: `001_view_name.sql`, `002_function_name.sql`

### Scripts de seed (`scripts/seed/`)

Solo se ejecutan en entornos `local` y `dev`:

```sql
--liquibase formatted sql
--changeset studio:seed-clinics-demo context:dev,local
INSERT INTO clinics (name, city, phone) VALUES
    ('Clínica Demo Santiago', 'Santiago', '+56912345678'),
    ('Clínica Demo Valparaíso', 'Valparaíso', '+56987654321')
ON CONFLICT (name) DO NOTHING;
--rollback DELETE FROM clinics WHERE name IN ('Clínica Demo Santiago', 'Clínica Demo Valparaíso');
```

Reglas:
- **Siempre** incluye el atributo `context:dev,local` en el changeset header
- **Siempre** usa `ON CONFLICT DO NOTHING` para que sea idempotente
- **Siempre** incluye una instrucción `--rollback`
- Nunca incluyas datos personales reales o de producción

---

## Rollback y Troubleshooting

### El rollback falla porque no hay instrucción `--rollback`

Liquibase no puede revertir automáticamente operaciones complejas. Para estos casos, la solución manual es crear un nuevo changeset que deshaga el cambio:

```xml
<changeSet id="revert-remove-column-X" author="dev">
    <addColumn tableName="mi_tabla">
        <column name="columna_eliminada" type="VARCHAR(255)"/>
    </addColumn>
</changeSet>
```

### Lock atascado (el deploy se interrumpió a mitad)

Si `db:migrate` se interrumpió con `Ctrl+C` o por un error, puede quedar un lock en `DATABASECHANGELOGLOCK`. Para liberarlo:

```bash
docker run --rm \
  -v "$(pwd)/database:/liquibase/changelog" \
  -v "$(pwd)/database/drivers:/liquibase/lib" \
  liquibase/liquibase:5.0 \
  --url="$DB_URL" --username="$DB_USER" --password="$DB_PASS" \
  release-locks
```

### Error de checksum (alguien modificó un changeset ya aplicado)

```
Validation Failed: ... checksum 'X' != 'Y'
```

Nunca modifiques un changeset que ya fue aplicado. Si fue un error y es entorno de desarrollo, puedes limpiar manualmente:

```sql
-- Solo en DEV — busca el changeset con checksum incorrecto
DELETE FROM DATABASECHANGELOG WHERE id = 'id-del-changeset' AND author = 'autor';
```

Luego vuelve a ejecutar `npm run db:migrate`.

### `Cannot connect to database`

Verifica en orden:
1. ¿Está corriendo PostgreSQL? `pg_isready -h localhost`
2. ¿Son correctas las credenciales en `database/.env`?
3. ¿En macOS? El script reescribe `localhost` → `host.docker.internal` automáticamente.
4. ¿DB en EasyPanel? Ver sección siguiente sobre acceso externo.

---

## Conexión a EasyPanel

El PostgreSQL de producción corre dentro de la red de EasyPanel. Para acceder desde una laptop local:

### Opción 1: Habilitar puerto externo en EasyPanel

1. En el dashboard de EasyPanel, abre el servicio PostgreSQL
2. En la sección "Ports", expone el puerto `5432` hacia el exterior
3. EasyPanel asignará un puerto público (ej: `31234`)
4. Usa en `database/.env`:
   ```
   DB_URL=jdbc:postgresql://your-easypanel-host:31234/studio
   ```

### Opción 2: SSH Tunnel

```bash
# Abre un túnel SSH al servidor EasyPanel
ssh -L 5433:postgres:5432 user@your-easypanel-host

# En database/.env usa el puerto local del túnel
DB_URL=jdbc:postgresql://localhost:5433/studio
```

### Formato de URLs

| Contexto | Formato |
|----------|---------|
| Laptop local | `jdbc:postgresql://localhost:5432/studio` |
| EasyPanel externo | `jdbc:postgresql://HOST:PUERTO/DBNAME` |
| EasyPanel interno (CI) | `jdbc:postgresql://postgres:5432/studio` |

---

## Estructura del Directorio

```
database/
├── changelogs/
│   ├── changelog-master.xml    # Entrypoint — lista todos los changelogs
│   ├── v1_baseline.xml         # Generado por: npm run db:baseline (primera vez)
│   └── changelog_*.xml         # Generados por: npm run db:snapshot
│
├── scripts/
│   ├── metadata/               # Vistas, funciones, catálogos (todos los entornos)
│   │   └── 001_view_example.sql
│   └── seed/                   # Datos de prueba (solo local y dev)
│       └── 001_seed_clinics.sql
│
├── drivers/
│   └── postgresql-42.7.4.jar   # Auto-descargado. Gitignored.
│
├── .env.example                # Plantilla de variables (comprometido en git)
├── .env                        # Credenciales reales (gitignored — NO commit)
├── liquibase.properties        # Configuración Liquibase (comprometido)
└── README.md                   # Esta documentación
```

---

## CI/CD Integration

Para pipelines de CI/CD (GitHub Actions, etc.), crea el archivo `database/.env` durante el pipeline con las credenciales del entorno objetivo antes de ejecutar el comando:

```yaml
# .github/workflows/deploy.yml (ejemplo)
- name: Deploy DB migrations
  env:
    DB_URL: ${{ secrets.PROD_DB_URL }}
    DB_USER: ${{ secrets.PROD_DB_USER }}
    DB_PASS: ${{ secrets.PROD_DB_PASS }}
    DB_SCHEMA: public
    ENVIRONMENT: PROD
  run: |
    # Crear database/.env desde las variables del entorno CI
    cat > database/.env << EOF
    DB_URL=${DB_URL}
    DB_USER=${DB_USER}
    DB_PASS=${DB_PASS}
    DB_SCHEMA=${DB_SCHEMA}
    ENVIRONMENT=${ENVIRONMENT}
    EOF
    npm run db:migrate
```

> En CI, `ENVIRONMENT=PROD` activa el prompt de confirmación. Para saltarlo en pipelines automatizados, puedes pasar el flag adicional `-y` o modificar el script para detectar modo CI con `[ -n "${CI:-}" ]`.
