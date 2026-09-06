#!/usr/bin/env bash
# Crea las categorías vía API (/misc_categories/upsert) en lugar de SQL directo.
#   API_BASE=https://... API_TOKEN=<jwt> bash crear-categorias.sh
#
# OJO: el endpoint sólo acepta name/code/description/type/is_active. NO setea
# external_id, así que las categorías creadas por esta vía se resuelven después
# por nombre. El SQL contempla las dos formas (external_id o LOWER(name)).
set -euo pipefail
: "${API_BASE:?falta API_BASE}"
: "${API_TOKEN:?falta API_TOKEN}"

echo "→ RX-INTRA"
curl -sS -X POST "$API_BASE/misc_categories/upsert" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Radiografías intrabucales\",\"code\":\"RX-INTRA\",\"description\":\"Sección \\\"Radiografías intrabucales\\\" de la orden de estudio.\",\"type\":\"income\",\"is_active\":true}"
echo
echo "→ EST-EXTRA"
curl -sS -X POST "$API_BASE/misc_categories/upsert" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Otros estudios extraorales\",\"code\":\"EST-EXTRA\",\"description\":\"Sección \\\"Otros estudios extraorales\\\" de la orden de estudio.\",\"type\":\"income\",\"is_active\":true}"
echo
echo "→ RX-EXTRA"
curl -sS -X POST "$API_BASE/misc_categories/upsert" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Radiografías extraorales\",\"code\":\"RX-EXTRA\",\"description\":\"Sección \\\"Radiografías extraorales\\\" (documentación para ortodoncia).\",\"type\":\"income\",\"is_active\":true}"
echo
echo "→ CEFALO"
curl -sS -X POST "$API_BASE/misc_categories/upsert" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Estudios cefalométricos computarizados\",\"code\":\"CEFALO\",\"description\":\"Sección \\\"Estudios cefalométricos computarizados\\\" de la orden.\",\"type\":\"income\",\"is_active\":true}"
echo
echo "→ FOTO"
curl -sS -X POST "$API_BASE/misc_categories/upsert" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Fotografías\",\"code\":\"FOTO\",\"description\":\"Sección \\\"Fotografías\\\" de la orden de estudio.\",\"type\":\"income\",\"is_active\":true}"
echo
echo "→ MOD-DIG"
curl -sS -X POST "$API_BASE/misc_categories/upsert" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Modelos digitales\",\"code\":\"MOD-DIG\",\"description\":\"Sección \\\"Modelos digitales (con visualizador 3D)\\\" e impresión de modelos.\",\"type\":\"income\",\"is_active\":true}"
echo
echo "→ ALINEA"
curl -sS -X POST "$API_BASE/misc_categories/upsert" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Ortodoncia invisible (alineadores)\",\"code\":\"ALINEA\",\"description\":\"Sección \\\"Ortodoncia invisible (alineadores)\\\" de la orden.\",\"type\":\"income\",\"is_active\":true}"
echo
echo "→ CONEBEAM"
curl -sS -X POST "$API_BASE/misc_categories/upsert" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Tomografía computarizada volumétrica Cone Beam\",\"code\":\"CONEBEAM\",\"description\":\"Sección \\\"Tomografía computarizada volumétrica Cone Beam\\\" de la orden.\",\"type\":\"income\",\"is_active\":true}"
echo
echo "→ CIR-GUIA"
curl -sS -X POST "$API_BASE/misc_categories/upsert" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Cirugía guiada para implantes\",\"code\":\"CIR-GUIA\",\"description\":\"Sección \\\"Cirugía guiada para implantes\\\" de la orden.\",\"type\":\"income\",\"is_active\":true}"
echo
echo "→ M3DMIX"
curl -sS -X POST "$API_BASE/misc_categories/upsert" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Realidad virtual M3DMIX\",\"code\":\"M3DMIX\",\"description\":\"Sección \\\"Realidad virtual M3DMIX\\\" de la orden.\",\"type\":\"income\",\"is_active\":true}"
echo
echo "→ ECO"
curl -sS -X POST "$API_BASE/misc_categories/upsert" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Ecografías\",\"code\":\"ECO\",\"description\":\"Sección \\\"Ecografías\\\" del formulario web.\",\"type\":\"income\",\"is_active\":true}"
echo
echo "→ OTROS-SRV"
curl -sS -X POST "$API_BASE/misc_categories/upsert" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Otros servicios\",\"code\":\"OTROS-SRV\",\"description\":\"Sección \\\"Otros servicios\\\" de la orden de estudio.\",\"type\":\"income\",\"is_active\":true}"
echo
