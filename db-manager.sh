#!/usr/bin/env bash
# =============================================================================
# db-manager.sh — Liquibase Database Migration Manager
# Project: InvokeIA Studio (dental clinic SaaS)
# Database: PostgreSQL via n8n / EasyPanel
#
# Usage:
#   ./db-manager.sh <command> [options]
#
# Commands:
#   setup          Verify Docker, download JDBC driver, validate DB connection
#   init-baseline  Generate changelog from existing DB, save as v1_baseline.xml
#   snapshot       Diff DB vs changelogs, generate timestamped changelog file
#   deploy         Apply pending migrations (--dry-run for SQL preview only)
#   rollback       Undo last deploy, or rollback to a specific tag
#
# Examples:
#   ./db-manager.sh setup
#   ./db-manager.sh deploy --dry-run
#   ./db-manager.sh rollback
#   ./db-manager.sh rollback --tag=deploy_20260426_143000
#   ./db-manager.sh rollback --count=3
#
# Npm aliases:
#   npm run db:setup    npm run db:baseline  npm run db:snapshot
#   npm run db:migrate  npm run db:rollback
# =============================================================================
set -euo pipefail

# ── Path Resolution ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="${SCRIPT_DIR}/database"
DRIVERS_DIR="${DB_DIR}/drivers"
CHANGELOGS_DIR="${DB_DIR}/changelogs"
ENV_FILE="${DB_DIR}/.env"

# ── Pinned Versions ────────────────────────────────────────────────────────────
DEFAULT_LIQUIBASE_IMAGE="liquibase/liquibase:5.0"
PG_DRIVER_VERSION="42.7.4"
PG_DRIVER_JAR="postgresql-${PG_DRIVER_VERSION}.jar"
PG_DRIVER_URL="https://repo1.maven.org/maven2/org/postgresql/postgresql/${PG_DRIVER_VERSION}/${PG_DRIVER_JAR}"

# ── Color Output ───────────────────────────────────────────────────────────────
if command -v tput > /dev/null 2>&1 && [ -t 1 ] && tput colors > /dev/null 2>&1; then
  RED=$(tput setaf 1); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3)
  BLUE=$(tput setaf 4); CYAN=$(tput setaf 6); BOLD=$(tput bold); RESET=$(tput sgr0)
else
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
fi

_log()     { printf "%b[INFO]%b  %s\n"       "${GREEN}"        "${RESET}" "$*"; }
_warn()    { printf "%b[WARN]%b  %s\n"       "${YELLOW}"       "${RESET}" "$*"; }
_error()   { printf "%b[ERROR]%b %s\n"       "${RED}"          "${RESET}" "$*" >&2; }
_section() { printf "\n%b╔═ %s ═╗%b\n\n"    "${BLUE}${BOLD}"  "${RESET}" "$*"; }
_die()     { _error "$*"; exit 1; }

# ── .env Loading & Validation ──────────────────────────────────────────────────
_load_env() {
  if [ ! -f "${ENV_FILE}" ]; then
    _die "Archivo de configuración no encontrado: ${ENV_FILE}
       Copia la plantilla y llena tus credenciales:
         cp database/.env.example database/.env"
  fi

  # Source the .env file (safe: only sets variables)
  set -a
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
  set +a

  # Validate all required variables are present and non-empty
  local missing=""
  for var in DB_URL DB_USER DB_PASS DB_SCHEMA ENVIRONMENT; do
    if [ -z "${!var+x}" ] || [ -z "${!var}" ]; then
      missing="${missing}\n    - ${var}"
    fi
  done

  if [ -n "${missing}" ]; then
    printf "%b[ERROR]%b Variables requeridas faltantes en database/.env:%b%s%b\n" \
      "${RED}" "${RESET}" "${YELLOW}" "${missing}" "${RESET}" >&2
    exit 1
  fi

  # Apply image override from .env if set, otherwise use pinned default
  LIQUIBASE_IMAGE="${LIQUIBASE_IMAGE:-${DEFAULT_LIQUIBASE_IMAGE}}"

  _log "Entorno: ${BOLD}${ENVIRONMENT}${RESET}  |  DB: ${CYAN}${DB_URL}${RESET}"
}

# ── Safety Confirmation for PROD / CLIENTE ─────────────────────────────────────
_safety_check() {
  local action="${1:-operación}"

  if [ "${ENVIRONMENT}" = "PROD" ] || [ "${ENVIRONMENT}" = "CLIENTE" ]; then
    printf "\n"
    printf "%b╔══════════════════════════════════════════════════════════════╗%b\n" "${RED}${BOLD}" "${RESET}"
    printf "%b║                                                              ║%b\n" "${RED}${BOLD}" "${RESET}"
    printf "%b║   ⚠  ADVERTENCIA: Ambiente %-6s detectado               ⚠  ║%b\n" "${RED}${BOLD}" "${ENVIRONMENT}" "${RESET}"
    printf "%b║                                                              ║%b\n" "${RED}${BOLD}" "${RESET}"
    printf "%b║   Acción solicitada: %-41s║%b\n" "${RED}${BOLD}" "${action}" "${RESET}"
    printf "%b║   Esta operación MODIFICA la base de datos en producción.   ║%b\n" "${RED}${BOLD}" "${RESET}"
    printf "%b║   No se puede deshacer fácilmente una vez ejecutada.        ║%b\n" "${RED}${BOLD}" "${RESET}"
    printf "%b║                                                              ║%b\n" "${RED}${BOLD}" "${RESET}"
    printf "%b╚══════════════════════════════════════════════════════════════╝%b\n" "${RED}${BOLD}" "${RESET}"
    printf "\n"
    printf "  Para continuar, escribe exactamente %bCONFIRMO%b y presiona Enter:\n" "${BOLD}" "${RESET}"
    printf "  > "
    local confirmation
    read -r confirmation
    if [ "${confirmation}" != "CONFIRMO" ]; then
      printf "\n"
      _warn "Operación cancelada. No se realizaron cambios en la base de datos."
      exit 0
    fi
    printf "\n"
    _log "Confirmación recibida. Procediendo con '${action}' en ${ENVIRONMENT}..."
    printf "\n"
  fi
}

# ── Docker Availability Check ──────────────────────────────────────────────────
_check_docker() {
  if ! command -v docker > /dev/null 2>&1; then
    _die "Docker no está instalado.
       Descarga Docker Desktop desde: https://www.docker.com/products/docker-desktop/"
  fi
  if ! docker info > /dev/null 2>&1; then
    _die "Docker no está corriendo.
       Inicia Docker Desktop e intenta de nuevo."
  fi
  _log "Docker disponible: $(docker --version | head -1)"
}

# ── JDBC Driver Auto-Download ──────────────────────────────────────────────────
_ensure_driver() {
  local driver_path="${DRIVERS_DIR}/${PG_DRIVER_JAR}"

  if [ -f "${driver_path}" ]; then
    _log "Driver JDBC encontrado: ${PG_DRIVER_JAR}"
    return 0
  fi

  _warn "Driver JDBC no encontrado. Descargando ${PG_DRIVER_JAR}..."
  mkdir -p "${DRIVERS_DIR}"

  if ! command -v curl > /dev/null 2>&1; then
    _die "curl no está disponible. Descarga manualmente el driver:
         URL: ${PG_DRIVER_URL}
         Destino: ${DRIVERS_DIR}/"
  fi

  if ! curl -fL --progress-bar -o "${driver_path}" "${PG_DRIVER_URL}"; then
    rm -f "${driver_path}"
    _die "Error al descargar el driver JDBC.
       Verifica tu conexión a internet o descárgalo manualmente:
         URL: ${PG_DRIVER_URL}
         Destino: ${DRIVERS_DIR}/"
  fi

  _log "Driver descargado: ${driver_path}"
}

# ── Liquibase Docker Runner ────────────────────────────────────────────────────
# All Liquibase commands are executed inside the official Docker container.
# Volume mounts:
#   /liquibase/changelog  ← database/ directory (changelogs, scripts, properties)
#   /liquibase/lib        ← database/drivers/ (JDBC driver autodiscovery)
#
# macOS Docker Desktop fix: --network host is not supported on macOS.
# Rewrite localhost/127.0.0.1 → host.docker.internal so the container
# can reach a Postgres instance running on the host machine.
#
_run_liquibase() {
  local resolved_url="${DB_URL}"

  # macOS Docker Desktop: containers can't use --network host, so rewrite
  # localhost to the special Docker-for-Mac hostname
  if [[ "${OSTYPE}" == "darwin"* ]]; then
    resolved_url="${resolved_url/localhost/host.docker.internal}"
    resolved_url="${resolved_url/127.0.0.1/host.docker.internal}"
  fi

  docker run --rm \
    --network host \
    -v "${DB_DIR}:/liquibase/changelog" \
    -v "${DRIVERS_DIR}:/liquibase/lib" \
    "${LIQUIBASE_IMAGE}" \
    --url="${resolved_url}" \
    --username="${DB_USER}" \
    --password="${DB_PASS}" \
    --default-schema-name="${DB_SCHEMA}" \
    --liquibase-schema-name="${DB_CHANGELOG_SCHEMA:-${DB_SCHEMA}}" \
    --defaults-file=/liquibase/changelog/liquibase.properties \
    "$@"
}

# ── Connection Validation ──────────────────────────────────────────────────────
_validate_connection() {
  _log "Validando conexión a la base de datos..."

  if ! _run_liquibase execute-sql --sql="SELECT version()" > /dev/null 2>&1; then
    _die "No se puede conectar a la base de datos.
       Verifica en database/.env:
         DB_URL=${DB_URL}
         DB_USER=${DB_USER}
       Asegúrate de que PostgreSQL esté accesible desde tu máquina."
  fi

  _log "Conexión exitosa a la base de datos."
}

# ── Context Filter Helper ──────────────────────────────────────────────────────
# Maps ENVIRONMENT value → Liquibase context filter string.
# "prod" context causes Liquibase to skip all seed scripts (context="dev,local").
_get_context_filter() {
  case "${ENVIRONMENT}" in
    local)   printf "local" ;;
    dev)     printf "dev" ;;
    staging) printf "staging" ;;
    PROD)    printf "prod" ;;
    CLIENTE) printf "prod" ;;
    *)       printf "dev" ;;
  esac
}

# =============================================================================
# COMMAND: setup
# Verify prerequisites, download JDBC driver, validate DB connection.
# =============================================================================
cmd_setup() {
  _section "Setup — Verificando dependencias y conexión"

  _check_docker
  _load_env
  _ensure_driver

  _log "Descargando imagen Liquibase ${LIQUIBASE_IMAGE} (puede tardar en la primera vez)..."
  docker pull "${LIQUIBASE_IMAGE}"

  _validate_connection

  printf "\n"
  _log "${GREEN}${BOLD}Setup completado exitosamente.${RESET}"
  _log "Próximos pasos:"
  _log "  → Primera vez: ${BOLD}npm run db:baseline${RESET}  (genera changelog inicial desde la DB)"
  _log "  → Desplegar:   ${BOLD}npm run db:migrate${RESET}   (aplica migraciones pendientes)"
  _log "  → Ver SQL:     ${BOLD}npm run db:migrate -- --dry-run${RESET}"
}

# =============================================================================
# COMMAND: init-baseline  (Fase Cero — ejecutar solo una vez)
# Captures the current DB schema as v1_baseline.xml and marks it as applied.
# =============================================================================
cmd_init_baseline() {
  _section "Init Baseline — Capturando esquema actual de la base de datos"

  _check_docker
  _load_env
  _ensure_driver

  local baseline_file="changelogs/v1_baseline.xml"
  local baseline_path="${CHANGELOGS_DIR}/v1_baseline.xml"
  local master_xml="${CHANGELOGS_DIR}/changelog-master.xml"

  if [ -f "${baseline_path}" ]; then
    printf "\n"
    _warn "${baseline_path} ya existe."
    printf "  ¿Sobreescribir el baseline existente? [s/N]: "
    local overwrite
    read -r overwrite
    if [ "${overwrite}" != "s" ] && [ "${overwrite}" != "S" ]; then
      _warn "Operación cancelada."
      exit 0
    fi
    # SOLUCIÓN: Eliminamos el archivo para que Liquibase no necesite sobreescribirlo
    rm -f "${baseline_path}"
  fi

  _log "Generando changelog desde el esquema actual de la base de datos..."
  _log "Archivo de salida: ${baseline_path}"

  _run_liquibase generate-changelog \
    --changelog-file="${baseline_file}" \
    --include-schema=false \
    --include-catalog=false

  if [ ! -f "${baseline_path}" ]; then
    _die "El archivo baseline no fue generado. Verifica la conexión y los permisos."
  fi

  _log "Baseline generado: ${baseline_path}"

  # Sync: mark all changesets in the baseline as already applied
  _log "Ejecutando changelog-sync para marcar el baseline como aplicado..."
  _run_liquibase changelog-sync \
    --changelog-file="${baseline_file}"

  _log "Sincronización completada. La DB está registrada en DATABASECHANGELOG."
  printf "\n"
  _warn "ACCIÓN REQUERIDA:"
  _warn "  Descomenta la siguiente línea en ${master_xml}:"
  printf "    %b<include file=\"changelogs/v1_baseline.xml\" relativeToChangelogFile=\"false\"/>%b\n" "${CYAN}" "${RESET}"
  _warn "  Luego haz commit de ambos archivos:"
  printf "    git add database/changelogs/v1_baseline.xml database/changelogs/changelog-master.xml\n"
  printf "    git commit -m 'chore(db): add Liquibase baseline from existing schema'\n"
}

# =============================================================================
# COMMAND: snapshot  (Capturar cambios — flujo diario usando Shadow DB)
# =============================================================================
cmd_snapshot() {
  _section "Snapshot — Generando changelog diferencial (Shadow DB Mode)"

  _check_docker
  _load_env
  _ensure_driver

  mkdir -p "${DB_DIR}/scripts/metadata"
  mkdir -p "${DB_DIR}/scripts/seed"

  local timestamp
  timestamp=$(date '+%Y%m%d_%H%M')
  local snapshot_filename="changelog_${timestamp}.xml"
  local snapshot_file="changelogs/${snapshot_filename}"
  local snapshot_path="${CHANGELOGS_DIR}/${snapshot_filename}"

  rm -f "${snapshot_path}"

  # ── 1. LEVANTAR SHADOW DB ────────────────────────────────────────────────────
  _log "1/4 Levantando Base de Datos temporal (Shadow DB)..."
  docker rm -f liquibase_shadow_db >/dev/null 2>&1 || true
  
  # Levantamos Postgres SIN exponer puertos al host (no es necesario)
  docker run -d --name liquibase_shadow_db \
    -e POSTGRES_PASSWORD=shadow \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_DB=shadow_db \
    postgres:15-alpine >/dev/null

  _log "Esperando a que Postgres arranque..."
  sleep 5

  # URL local limpia porque Liquibase compartirá la red del contenedor
  local shadow_url="jdbc:postgresql://localhost:5432/shadow_db"
  
  # URL de tu base DEV (resolviendo localhost para Mac si aplica)
  local resolved_dev_url="${DB_URL}"
  if [[ "${OSTYPE}" == "darwin"* ]]; then
    resolved_dev_url="${resolved_dev_url/localhost/host.docker.internal}"
    resolved_dev_url="${resolved_dev_url/127.0.0.1/host.docker.internal}"
  fi

  # ── 2. CONSTRUIR ESTADO DEL PROYECTO ─────────────────────────────────────────
  _log "2/4 Construyendo el estado actual del código en la Shadow DB..."
  # Usamos --network container:liquibase_shadow_db para conexión directa
  # Quitamos el >/dev/null para poder ver si hay errores
  docker run --rm \
    --network container:liquibase_shadow_db \
    -v "${DB_DIR}:/liquibase/changelog" \
    -v "${DRIVERS_DIR}:/liquibase/lib" \
    "${LIQUIBASE_IMAGE}" \
    --url="${shadow_url}" \
    --username="postgres" \
    --password="shadow" \
    --defaults-file=/liquibase/changelog/liquibase.properties \
    update \
    --changelog-file=changelogs/changelog-master.xml

  # ── 3. COMPARAR (DIFF) ───────────────────────────────────────────────────────
  _log "3/4 Comparando DEV viva vs Shadow DB..."
  rm -f "${snapshot_path}"

  docker run --rm \
    --network container:liquibase_shadow_db \
    -v "${DB_DIR}:/liquibase/changelog" \
    -v "${DRIVERS_DIR}:/liquibase/lib" \
    "${LIQUIBASE_IMAGE}" \
    --reference-url="${resolved_dev_url}" \
    --reference-username="${DB_USER}" \
    --reference-password="${DB_PASS}" \
    --url="${shadow_url}" \
    --username="postgres" \
    --password="shadow" \
    --defaults-file=/liquibase/changelog/liquibase.properties \
    --include-catalog=false \
    --include-schema=false \
    --diff-types="tables,columns,indexes,foreignkeys,primarykeys,uniqueconstraints" \
    diff-changelog \
    --changelog-file="${snapshot_file}"

  # ── 4. LIMPIEZA ──────────────────────────────────────────────────────────────
  _log "4/4 Destruyendo Shadow DB..."
  docker rm -f liquibase_shadow_db >/dev/null 2>&1

  if [ ! -f "${snapshot_path}" ]; then
    _warn "No se generó ningún archivo. Puede que no haya diferencias o hubo un error."
    exit 0
  fi

  if ! grep -q "<changeSet" "${snapshot_path}" 2>/dev/null; then
    _log "No se encontraron diferencias de esquema entre la DB y el código."
    rm -f "${snapshot_path}"
    exit 0
  fi

  _log "Snapshot generado exitosamente: ${snapshot_path}"
  printf "\n"
  _warn "PRÓXIMOS PASOS:"
  _warn "  1. Revisa el archivo generado: code database/changelogs/${snapshot_filename}"
  _warn "  2. Añádelo al master: <include file=\"changelogs/${snapshot_filename}\" relativeToChangelogFile=\"false\"/>"
}

# =============================================================================
# COMMAND: deploy  (Migración a entornos)
# Applies pending changesets. Supports --dry-run to preview SQL.
# Auto-tags the DB after a successful deploy for easy rollback.
# =============================================================================
cmd_deploy() {
  local dry_run=false

  for arg in "$@"; do
    case "${arg}" in
      --dry-run) dry_run=true ;;
    esac
  done

  if [ "${dry_run}" = true ]; then
    _section "Deploy (DRY RUN) — Previsualizando SQL sin aplicar cambios"
  else
    _section "Deploy — Aplicando migraciones pendientes"
  fi

  _check_docker
  _load_env
  _ensure_driver

  local context_filter
  context_filter=$(_get_context_filter)

  if [ "${dry_run}" = false ]; then
    _safety_check "deploy / liquibase update"
  fi

  _log "Contexto Liquibase: ${BOLD}${context_filter}${RESET}"

  if [ "${dry_run}" = true ]; then
    _log "Generando SQL preview (no se aplica ningún cambio)..."
    printf "\n%b─────────────── SQL PREVIEW ───────────────%b\n\n" "${CYAN}" "${RESET}"
    _run_liquibase update-sql \
      --changelog-file=changelogs/changelog-master.xml \
      --context-filter="${context_filter}"
    printf "\n%b─────────────────────────────────────────%b\n" "${CYAN}" "${RESET}"
    _log "Dry run completado. Ningún cambio fue aplicado."
  else
    _log "Aplicando migraciones pendientes..."
    _run_liquibase update \
      --changelog-file=changelogs/changelog-master.xml \
      --context-filter="${context_filter}"

    _log "Migraciones aplicadas exitosamente."

    # Auto-tag so rollback always has an anchor point
    local tag
    tag="deploy_$(date '+%Y%m%d_%H%M%S')"
    _log "Creando tag de rollback: ${BOLD}${tag}${RESET}"
    _run_liquibase tag \
      --tag="${tag}" || _warn "No se pudo crear el tag (no crítico — rollback por count aún funciona)."

    printf "\n"
    _log "${GREEN}${BOLD}Deploy completado.${RESET}"
    _log "Para revertir: ${BOLD}npm run db:rollback -- --tag=${tag}${RESET}"
  fi
}

# =============================================================================
# COMMAND: rollback  (Red de seguridad)
# Reverts the last deploy or rolls back to a specific tag.
# Flags:
#   --tag=TAG     rollback to a specific tag
#   --count=N     rollback N changesets (default: 1)
# =============================================================================
cmd_rollback() {
  _section "Rollback — Revirtiendo cambios de base de datos"

  _check_docker
  _load_env
  _ensure_driver

  local rollback_tag=""
  local rollback_count=1

  for arg in "$@"; do
    case "${arg}" in
      --tag=*)   rollback_tag="${arg#--tag=}" ;;
      --count=*) rollback_count="${arg#--count=}" ;;
    esac
  done

  _safety_check "rollback"

  if [ -n "${rollback_tag}" ]; then
    _log "Revirtiendo hasta el tag: ${BOLD}${rollback_tag}${RESET}"
    _run_liquibase rollback \
      --changelog-file=changelogs/changelog-master.xml \
      --tag="${rollback_tag}"
  else
    _log "Revirtiendo los últimos ${BOLD}${rollback_count}${RESET} changeset(s)..."
    _run_liquibase rollback-count \
      --changelog-file=changelogs/changelog-master.xml \
      --count="${rollback_count}"
  fi

  _log "${GREEN}${BOLD}Rollback completado exitosamente.${RESET}"
}

# =============================================================================
# USAGE
# =============================================================================
_usage() {
  printf "\n"
  printf "%b╔══════════════════════════════════════════════════════════════╗%b\n" "${BLUE}${BOLD}" "${RESET}"
  printf "%b║        db-manager.sh — Gestor de Migraciones Liquibase      ║%b\n" "${BLUE}${BOLD}" "${RESET}"
  printf "%b╚══════════════════════════════════════════════════════════════╝%b\n" "${BLUE}${BOLD}" "${RESET}"
  printf "\n"
  printf "  %bUso:%b  ./db-manager.sh <comando> [opciones]\n\n" "${BOLD}" "${RESET}"
  printf "  %bComandos disponibles:%b\n\n" "${BOLD}" "${RESET}"
  printf "    %bsetup%b\n" "${GREEN}" "${RESET}"
  printf "        Verifica Docker, descarga driver JDBC PostgreSQL,\n"
  printf "        y valida la conexión a la base de datos.\n\n"
  printf "    %binit-baseline%b\n" "${GREEN}" "${RESET}"
  printf "        (Primera vez solamente) Genera v1_baseline.xml desde\n"
  printf "        el esquema actual de la DB y lo marca como aplicado.\n\n"
  printf "    %bsnapshot%b\n" "${GREEN}" "${RESET}"
  printf "        Genera un changelog diferencial comparando la DB actual\n"
  printf "        contra los changelogs registrados.\n\n"
  printf "    %bdeploy%b [%b--dry-run%b]\n" "${GREEN}" "${RESET}" "${CYAN}" "${RESET}"
  printf "        Aplica todos los changesets pendientes.\n"
  printf "        Con --dry-run: muestra el SQL sin ejecutarlo.\n\n"
  printf "    %brollback%b [%b--tag=TAG%b] [%b--count=N%b]\n" "${GREEN}" "${RESET}" "${CYAN}" "${RESET}" "${CYAN}" "${RESET}"
  printf "        Revierte el último deploy (por defecto: --count=1).\n"
  printf "        --tag=TAG:   revierte hasta un deploy específico.\n"
  printf "        --count=N:   revierte N changesets.\n\n"
  printf "  %bEjemplos:%b\n\n" "${BOLD}" "${RESET}"
  printf "    ./db-manager.sh setup\n"
  printf "    ./db-manager.sh deploy --dry-run\n"
  printf "    ./db-manager.sh deploy\n"
  printf "    ./db-manager.sh rollback --tag=deploy_20260426_143000\n"
  printf "    ./db-manager.sh rollback --count=2\n\n"
  printf "  %bNpm scripts:%b\n\n" "${BOLD}" "${RESET}"
  printf "    npm run db:setup     npm run db:baseline  npm run db:snapshot\n"
  printf "    npm run db:migrate   npm run db:migrate -- --dry-run\n"
  printf "    npm run db:rollback  npm run db:rollback -- --tag=TAG\n\n"
}

# =============================================================================
# COMMAND: sync (Registrar sin ejecutar)
# Marca todos los cambios del código como "ya aplicados" en la DDBB actual.
# =============================================================================
cmd_sync() {
  _section "Sync — Sincronizando historial de Liquibase"

  _check_docker
  _load_env
  _ensure_driver

  _log "Marcando todos los changesets en changelog-master.xml como ejecutados..."
  
  _run_liquibase changelog-sync \
    --changelog-file=changelogs/changelog-master.xml

  _log "${GREEN}${BOLD}Sincronización completada.${RESET}"
}

# =============================================================================
# MAIN DISPATCH
# =============================================================================
main() {
  if [ $# -eq 0 ]; then
    _usage
    exit 0
  fi

  local command="${1}"
  shift

  case "${command}" in
    setup)          cmd_setup "$@" ;;
    init-baseline)  cmd_init_baseline "$@" ;;
    snapshot)       cmd_snapshot "$@" ;;
    deploy)         cmd_deploy "$@" ;;
    rollback)       cmd_rollback "$@" ;;
    sync)           cmd_sync "$@" ;; 
    help|--help|-h) _usage ;;
    *)
      _error "Comando desconocido: '${command}'"
      _usage
      exit 1
      ;;
  esac
}

main "$@"
