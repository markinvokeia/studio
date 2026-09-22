# help_invokeia — videos demostrativos del Manual de Trabajo

Un video corto por pregunta del **Manual de Trabajo por Rol** (311 preguntas,
anclas `#q001`–`#q311`), grabado manejando la app real con Playwright, con un
overlay que muestra el título, los pasos, el cursor y el área resaltada.

No es una suite de QA. Vive aparte de `e2e/` y de `playwright.config.ts`, y no
los toca.

---

## Puesta en marcha

```bash
# 1. Servidor de producción en otra terminal (dejalo corriendo)
pnpm help:serve            # = pnpm build && pnpm start

# 2. Generar / actualizar el registro de preguntas
pnpm help:parse

# 3. Ver qué está cubierto y qué falta
pnpm help:audit

# 4. Grabar
pnpm help:record                                  # todo
pnpm help:record:p0                               # sólo PARTE 0
npx playwright test --config=playwright.help.config.ts \
  --project=demo -g "q022"                        # una sola pregunta
```

Los videos quedan en `videos/<id>-<slug>.webm`. Las tomas de tests fallidos van a
`videos/_rejected/` y **nunca** a `videos/`, así que es imposible publicar
metraje de un test roto.

> **Una corrida por vez.** No lances un dry-run mientras una grabación está en
> curso: el proyecto `setup` reescribe `.auth/demo-user.json`, y dos corridas
> simultáneas se pisan el `storageState`. El síntoma es confuso —specs que
> funcionaban fallan al abrir la ficha del paciente— y no tiene nada que ver con
> el spec. Sí se puede *escribir* el siguiente spec mientras graba; lo que no se
> puede es *ejecutarlo*.

> **Grabá contra producción, no contra `pnpm dev`.** En dev, Next compila cada
> ruta la primera vez que se visita — 3 a 8 segundos de pantalla congelada que
> quedan grabados — y además dibuja `<nextjs-portal>`, que ensucia los frames e
> intercepta los clics sobre el avatar. El setup avisa por consola si detecta que
> estás en dev.

---

## Cómo se escribe un spec

Un archivo por subsección del manual, un `demoTest()` por pregunta:

```ts
import { demoTest, expect } from '../../lib/demo.fixture';

demoTest('q014', async ({ demo, page }) => {
  await demo.intro('/preferences', 'Avatar → Idioma → Español / English');

  await demo.click(avatar(page), 'Pulsá tu avatar, abajo en la barra lateral');
  await demo.click(page.getByRole('button', { name: '🇺🇸 English' }), 'Elegí English');

  await demo.step('La dirección pasa de /es/ a /en/', async () => {
    await expect(page).toHaveURL(/\/en\//);
  });

  await demo.finish('Permiso: GLOBAL_CHANGE_LANGUAGE');
});
```

El id se valida contra `questions.json` al cargar el módulo: si no existe, el
archivo falla al colectarse y no después de grabar cuarenta videos.

### API de `demo`

| Método | Qué hace |
| --- | --- |
| `intro(ruta, subtítulo?)` | Cartel de apertura (≤1,5 s) y navegación |
| `click(locator, texto?)` | Subtítulo → cursor + resaltado → reposo → clic |
| `type(locator, valor, texto?)` | Igual, pero escribe tecla por tecla |
| `spotlight(locator, texto)` | Resalta sin interactuar |
| `note(texto)` | Sólo subtítulo |
| `step(texto, fn)` | Subtítulo + un paso del reporte HTML |
| `toast(texto?)` | Espera el toast, lo congela con el mouse encima y lo resalta |
| `redact(...locators)` | Tapa con desenfoque zonas con datos sensibles |
| `finish(subtítulo?)` | Cartel de cierre (≤1,5 s) |

### Reglas de estilo

- **Nada de programación defensiva.** Los specs de `e2e/tests/**` usan
  `if (!visible) return;` para tolerar estados variables del backend. Acá eso
  produciría metraje vacío sin fallar: si el elemento no está, que falle.
- **Los strings van en un bloque `const T`** al principio del archivo, copiados
  literales de `src/messages/es.json`, igual que en la suite de QA.
- **Nunca `fill()`** para algo que se ve en cámara: usá `demo.type()`.
- **Nombres legibles** en los datos que salen en pantalla (`demo.demoName()`),
  nunca `Date.now()`.

---

## El registro

`questions.json` es la única fuente de verdad y lo genera `pnpm help:parse` desde
`manual-rol.source.md`. La clasificación de filmabilidad es juicio humano y vive
en **`filmability.overrides.json`**, un archivo aparte: regenerar el parseo nunca
pisa esas decisiones.

| Categoría | Qué es | ¿Se filma? |
| --- | --- | --- |
| `ui` | Recorrido de solo lectura | Sí |
| `ui-mutating` | Escribe en la base de DEV | Sí, con limpieza |
| `setup-heavy` | Necesita un estado previo preparado | Sí, con seeding |
| `out-of-band` | El paso clave llega por email/WhatsApp | Sólo el tramo in-app |
| `conceptual` | Explicación sin recorrido | No |
| `diagnostic` | Hay que romper algo para mostrarlo | No |

---

## Publicación

```bash
# 1. Subir help_invokeia/videos/*.webm a Drive (a mano: no hay rclone en la máquina)
# 2. Anotar las URLs
cat > help_invokeia/video-links.json <<'JSON'
{ "q001": "https://drive.google.com/file/d/.../view" }
JSON

# 3. Generar el manual con los enlaces
pnpm help:links
pnpm help:links -- --out ~/Downloads/manual-rol.md

# 4. Regenerar el .docx
python3 ~/Downloads/generar-manual-rol-docx.py
```

`inject-video-links.mjs` **nunca edita el original**: siempre regenera desde
`manual-rol.source.md`, así que es idempotente y no acumula enlaces duplicados.
No toca la línea del encabezado, de modo que las anclas `{#qNNN}` —de las que
dependen la Referencia A y los «Ver también»— quedan intactas.

---

## Cuidado con

- **La base de DEV es compartida.** Los specs `ui-mutating` crean datos; deben
  borrar lo que crearon y nunca lo que no.
- **PII de pacientes en cámara.** Usá pacientes de demo, o `demo.redact()`.
- **`q004`** («¿Cómo cambio mi contraseña?») muestra el formulario y **cancela**:
  enviarlo cambiaría la contraseña de `E2E_USER` y rompería las dos suites.
- **El manual y la app no siempre coinciden.** Grabar es la forma más rápida de
  descubrirlo; ver `DRIFT.md`.
