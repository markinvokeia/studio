/**
 * Imagen del servicio — límites y tamaño recomendado.
 *
 * Vive acá, y no en el componente que la sube, porque tres lugares tienen que
 * coincidir: la validación del archivo, el texto que le dice a la clínica qué
 * subir, y el ancho con el que se previsualiza en Ventas → Servicios para que
 * vea exactamente lo que va a ver el paciente.
 */

/** 1 MB, el mismo límite que el logo de la clínica y la firma del doctor. */
export const MAX_SERVICE_IMAGE_BYTES = 1024 * 1024;
export const MAX_SERVICE_IMAGE_MB = 1;
export const SERVICE_IMAGE_ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';

/**
 * Ancho máximo, en px CSS, que la tarjeta del servicio llega a ocupar en el
 * portal. Sale de medir los contenedores reales: la grilla va de una a tres
 * columnas y las vistas que alojan la reserva le dan el ancho completo, así que
 * el caso más grande ronda los ~370px (landing de escritorio a tres columnas, y
 * móvil a una sola columna).
 *
 * Es el ancho con el que se previsualiza la imagen al subirla: sirve de poco
 * una vista previa más grande o más chica que el destino real.
 */
export const SERVICE_IMAGE_MAX_RENDER_PX = 380;

/**
 * Tamaño recomendado: **1200 × 675 (16:9)**.
 *
 * El ancho es ~3× el máximo en pantalla, así que se ve nítida incluso en
 * pantallas de alta densidad, y a la vez entra holgada en 1 MB como JPG o WEBP.
 *
 * La proporción se recomienda —no se impone— porque la imagen se muestra a todo
 * el ancho sin recortar: el alto sale de la proporción de cada archivo. Si todos
 * los servicios usan la misma, las tarjetas quedan alineadas en la grilla de dos
 * columnas; si se mezclan, las filas quedan desparejas. Nada se rompe, se ve
 * menos ordenado.
 */
export const RECOMMENDED_SERVICE_IMAGE = {
  width: 1200,
  height: 675,
  /** Para `aspect-ratio` de CSS, mientras la imagen todavía no cargó. */
  cssRatio: '16 / 9',
} as const;
