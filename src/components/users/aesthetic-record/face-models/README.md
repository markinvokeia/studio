# Modelos faciales de la ficha estética

`face-illustration.tsx` dibuja las caras femenina y masculina, de frente y de perfil,
con tres fototipos (`light`, `medium`, `dark`). Es la primera versión vectorial que
salió del prototipo de UX (`prototipo-estetica.html`).

## Reglas para reemplazarla por los SVG de un ilustrador médico

- **Mismo espacio de coordenadas** que las plantillas de `../map-templates.ts`:
  `viewBox="0 0 300 380"` para el frente y para el perfil.
- **Mismo contorno y mismos rasgos**: ojos, nariz, boca y mentón tienen que quedar
  donde los ubica `FRONT_TEMPLATE` / `PROFILE_TEMPLATE`. Las zonas (polígonos con
  código estable: `forehead`, `glabella`, `crowsFeet.left`…) y todas las marcas
  guardadas están en coordenadas normalizadas (0..1) sobre esa plantilla: si la cara
  se corre, las marcas viejas quedan en otro lugar.
- **El perfil izquierdo es el derecho en espejo** (`mirrorTransform`), igual que su
  plantilla. Sólo se dibuja el perfil derecho (nariz hacia la derecha del que mira).
- **Capas**: base (piel, pelo, ropa) → rasgos → zonas. Las zonas las dibuja el mapa
  encima; el SVG del modelo no tiene que traerlas.
- Sin textura fotográfica; pelo recogido o corto para no tapar la frente ni la línea
  mandibular; orejas visibles en el perfil.
