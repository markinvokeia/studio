---
name: help-catalog
description: Mantiene al día el mapa del producto que usa el asistente guiado (help ids, fichas de pantalla, guías paso a paso y recorrido de onboarding). Úsala siempre que agregues, cambies de ruta o modifiques una página, un formulario, un botón, un tab o un ítem del menú, y cuando escribas o cambies una guía del asistente.
---

# Mapa del producto y guías del asistente

Referencia completa: `docs/onboarding-asistente.md`.

## Al cambiar una pantalla

1. **Help ids**: los formularios de React Hook Form, botones `type="submit"`, toolbar
   del `DataTable` y tabs ya reciben `data-help-id` solos (`<scope>.<kind>.<name>`,
   scope = ruta con puntos). Para todo lo demás que una guía tenga que tocar
   (inputs sueltos, botones de acción, secciones) poné un literal:
   `data-help-id="config.clinics.btn.save"`.
2. **Nunca renombres un help id ni un `name` de `FormField` usado en
   `knowledge/use-cases/`** sin actualizar la guía en el mismo commit.
3. Dos formularios con los mismos campos en una pantalla, o un componente
   montado en muchas pantallas: envolvelo en `<HelpScopeProvider scope="...">`.
4. Actualizá la ficha `knowledge/screens/<scope>.json` (crea una si la pantalla
   es nueva y está en el menú): `summary`, `purpose`, `prerequisites`, `tips`,
   `elements` con la descripción de los campos nuevos. Dejá `status: "draft"`;
   `validated` lo pone soporte/QA.
5. `pnpm knowledge:build` y revisá avisos y errores. El pre-commit lo corre igual
   y bloquea el commit si una guía quedó rota.

## Al escribir una guía (`knowledge/use-cases/<id>.json`)

- Pasos: `navigate` (route) · `click` · `fill` (value, admite `{{values.x}}`) ·
  `highlight` (la persona lo hace) · `confirm` · `wait`.
- El paso que guarda o crea **siempre** es `confirm`: el asistente nunca guarda por la persona.
- Declará en `inputs` los datos que se pueden dictar, con formato (horas `HH:MM`,
  días como lista con la convención de ese formulario, montos como número).
- Campos opcionales: `"optional": true` (sin valor dictado, se saltan). La burbuja
  muestra Obligatorio/Opcional según esto.
- `details` en cada paso: 1–2 frases sobre para qué sirve y qué cambia según lo
  que se elija (p. ej. "Si lo marcás, suma al arqueo de caja"). Es lo que se lee
  junto a la manito; sin `details` se usa la descripción del elemento en la ficha.
- Todo paso del recorrido de onboarding tiene guía: "Llevarme y guiarme" es la
  acción principal de la checklist.
- Sumá la guía a `useCases` de la ficha de su pantalla y, si es un paso del
  onboarding, a `knowledge/onboarding/journey.json`.
- Agregá datos de ejemplo en `e2e/tests/help/help-guides.spec.ts`.

## Al agregar un paso al onboarding

Agregalo en `knowledge/onboarding/journey.json` **y** en
`help_onboarding_compute()` (nuevo script en `database/scripts/` con
`CREATE OR REPLACE FUNCTION`), con el mismo `id`.

## Workflows del asistente

`n8n-workflows/help-*.json` se generan con `pnpm n8n:help` desde
`scripts/n8n/generate-help-workflows.mjs`. No editar los JSON a mano.
