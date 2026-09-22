/**
 * Datos de marca que aparecen en los carteles de apertura y cierre de cada video.
 *
 * Están centralizados acá porque quedan grabados en ~270 archivos: cambiar un
 * dato es cambiar una línea y regrabar, no editar 270 specs.
 */

export const BRAND = {
  name: 'Invoke IA',
  email: 'info@invokeia.com',
  site: 'invokeia.com',
  whatsapp: '+598 94 024 661',
  copyright:
    '© 2026 Invoke IA · Todos los derechos reservados · Distribución privada: prohibida su reproducción o difusión sin autorización',
} as const;

/** La línea de contacto tal como se compone en el footer del cartel. */
export const BRAND_CONTACT = `${BRAND.email}  ·  ${BRAND.site}  ·  WhatsApp ${BRAND.whatsapp}`;
