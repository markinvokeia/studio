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

## Cubrir una pantalla (de a una, completa antes de pasar a la siguiente)

Las guías son **predefinidas y probadas**: el agente nunca arma pasos al vuelo, sólo
propone hasta 3 guías de la pantalla (la más parecida primero). Por eso cada pantalla
tiene que quedar cubierta entera:

1. Help ids en todo lo que una guía toca: filtros, botones, tabs, menús (también
   los ítems de menús contextuales y submenús), secciones y campos.
2. Ficha con `summary`, `purpose`, `tips` y `elements`: qué significa cada campo,
   botón, indicador o columna y qué cambia según lo que se elija.
3. Guías por tarea (crear, editar, filtrar, cambiar estado, borrar, leer la pantalla…).
   Mientras menos casos borde tenga la pantalla, menos guías; pueden ser largas.
4. Si la tarea es sobre un registro: primero filtrar/buscar, después **seleccionarlo**
   (paso `highlight` con `until` = el panel de detalle o su menú; la persona elige un
   registro real), y recién ahí el tab, el menú o el botón de la acción.
5. Correr cada guía en la app real (con y sin datos dictados) y sumarla a
   `SAMPLE_VALUES` (e2e) y `DEMO_VALUES` (videos).

### Propiedades de los pasos

- `navigate` (route): la guía va por el **menú lateral** como la persona, menú y
  submenú en un solo paso. Título: "Menú → Submenú". Si ya está en la pantalla, sigue.
- `until: "id"` o `["id", …]` (en `highlight`): sigue sola cuando aparece ese elemento.
  Para gestos que la guía no puede hacer: clic derecho, arrastrar, elegir un registro.
- `blocking: true`: la persona tiene que hacerlo; "Siguiente", "Saltar" e "Ir al final"
  quedan deshabilitados. Los pasos con `until` lo son siempre.
- `doneOnClose: true` (en `highlight` de una opción de menú): sigue cuando el menú se
  cierra, aunque haya elegido otra opción.
- `target` con `{{values.x}}` (sólo en pasos `optional`): con el dato (pruebas, videos)
  la guía elige esa opción; sin él el paso se salta y el siguiente le pide a la persona.
- `skipIfMissing`: el bloque depende de un permiso o de la configuración.
- `ask: true` (en `fill` opcional): sin dato igual se muestra y espera (preferencias que se
  explican una por una); sin `ask`, un opcional sin dato se salta.
- `autoClick: true` (en `highlight` con `until`): con datos (pruebas, videos) la guía pulsa
  sola (elige la cita, abre el diálogo); con una persona, espera a que lo haga.
- `onlyIf` / `unless`: el paso corre sólo si se cumple un estado de la app que registra
  HelpAssistant (`cash-session-open`, `cash-session-closed`) o si está en pantalla un help id.
  Con `@start` (`cash-session-open@start`) se usa el estado de cuando arrancó la guía: así
  "Abrir la caja" con la caja abierta guía primero el cierre completo y después la apertura.
  Los pasos que no aplican desde el arranque quedan `na`: no se cuentan ni se listan.
- `group` (en la guía, no en el paso): pantallas con muchas funciones (la ficha del
  paciente) agrupan sus guías por pestaña; «¿Qué es esto?» las muestra bajo ese título, en
  el orden de `useCases` de la ficha. Cada grupo empieza con un recorrido de la pestaña.
- Panel de detalle con tablas en sus pestañas (ítems, pagos, facturas): envolvé el contenido
  de las pestañas en `<HelpScopeProvider scope="<pantalla>.detail">`. Si no, sus filas y su
  «Crear» tienen el mismo id que el listado (`first-row`, `btn.new`) y la guía señala el
  equivocado. Las pestañas quedan con el scope de la pantalla; las tablas de adentro con
  `<pantalla>.detail.*` (declaralas en la ficha).
- Filas de `useFieldArray` (`name={`items.${index}.unit_price`}`): el id descarta el índice
  → `<scope>.field.items.unit_price` (el de la última fila visible). No confundir con
  `field.unit_price` de otro formulario de la misma pantalla.
- `pnpm knowledge:build` no reescribe el catálogo si hay errores: corregilos antes de
  mirar `src/generated/help-catalog.json`. Y no lo regeneres mientras corre una prueba en
  el dev server: la app lo importa y la recompilación corta la prueba.
- Tablas (`DataTable`): la primera fila es `<scope>.section.first-row` (la más reciente o la
  primera del orden) y el resto `<scope>.section.row`; para mostrar "el registro más cercano".
- Componentes compartidos entre pantallas (filtros de período, diálogos de sesión clínica,
  receta, ajustes de agenda): ids con el scope de la pantalla (`useHelpScope` +
  `composeHelpId`) y declarados en la ficha de cada pantalla (el extractor no los ve).

### Lo que la guía no puede hacer por la persona

Clic derecho, arrastrar y elegir un registro real los hace la persona: el paso señala
dónde (`highlight` con `until` del menú o panel que se abre) y no deja avanzar hasta
que lo hace. Mientras guía, la mascota deja pasar clics, clic derecho y arrastres a la
pantalla (está encima de lo que señala). Una opción de un menú se señala desde afuera
del menú, y la barra y la lista de pasos van alrededor del menú entero.

Pantallas con más de un modo (la agenda: modo personalizado con tarjeta flotante y
modo estándar con panel/diálogo): mismos help ids en los dos (`appointments.field.*`,
`appointments.btn.save`) y pasos `skipIfMissing` para lo que sólo existe en uno.

## Al agregar un paso al onboarding

Agregalo en `knowledge/onboarding/journey.json` **y** en
`help_onboarding_compute()` (nuevo script en `database/scripts/` con
`CREATE OR REPLACE FUNCTION`), con el mismo `id`.

## Workflows del asistente

`n8n-workflows/help-*.json` se generan con `pnpm n8n:help` desde
`scripts/n8n/generate-help-workflows.mjs`. No editar los JSON a mano.
