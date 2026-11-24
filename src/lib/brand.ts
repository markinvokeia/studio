import invokeiaLogo from '@/assets/brand/invokeia-logo.webp';

/**
 * Isotipo de Invoke IA, empaquetado con la app.
 *
 * Es un import estático: Next lo copia a `/_next/static/media/` con hash en el
 * nombre (caché inmutable) y trae `width`/`height`, así que se pasa tal cual a
 * `next/image`. Para un `<img>` o HTML armado a mano usar `INVOKEIA_LOGO.src`.
 *
 * Se usa en el shell de la app (sidebar, login, cambio de contraseña) y, en el
 * portal del paciente —donde el branding que manda es el de la clínica—, sólo
 * como fallback del logo de la clínica y en la marca "Powered by Invoke IA".
 */
export const INVOKEIA_LOGO = invokeiaLogo;
