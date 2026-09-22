/**
 * PARTE 0 — Para todos · Tu configuración personal
 *
 * Todo lo de esta subsección vive en el menú del avatar (barra lateral, abajo)
 * y en /preferences.
 */
import { demoTest, expect } from '../../lib/demo.fixture';

// Strings literales de src/messages/es.json — misma convención que e2e/tests/**
const T = {
  // Header.*
  myAccount: 'Mi Cuenta',
  preferences: 'Preferencias',
  changePassword: 'Cambiar Contraseña',
  toggleTheme: 'Cambiar tema',
  logout: 'Cerrar Sesión',
  // Botones literales del menú (no vienen de es.json: están hardcodeados en sidebar.tsx)
  langEs: '🇺🇾 Español',
  langEn: '🇺🇸 English',
  themeInvoke: 'Invoke',
  themeClaro: 'Claro',
  themeOscuro: 'Oscuro',
};

/**
 * El disparador del menú de cuenta: botón redondo con la inicial del usuario.
 * Por rol no sirve — su nombre accesible es el nombre del usuario logueado, que
 * varía por entorno; de ahí el data-testid en sidebar.tsx.
 */
const avatar = (page: import('@playwright/test').Page) =>
  page.getByTestId('sidebar-avatar-trigger');

demoTest('q014', async ({ demo, page }) => {
  await demo.intro('/preferences', 'Avatar → Idioma → Español / English');

  await demo.click(avatar(page), 'Pulsá tu avatar, abajo en la barra lateral');

  await demo.spotlight(
    page.getByRole('button', { name: T.langEn }),
    'Al pie del menú está el selector de Idioma',
  );

  await demo.click(
    page.getByRole('button', { name: T.langEn }),
    'Elegí English: el cambio es inmediato',
  );

  await demo.step('La dirección pasa de /es/ a /en/', async () => {
    await expect(page).toHaveURL(/\/en\//);
  });

  // Dejamos la sesión como estaba: el storageState se comparte entre demos.
  await demo.click(avatar(page), 'Volvemos a Español para dejarlo como estaba');
  await demo.click(page.getByRole('button', { name: T.langEs }));
  await expect(page).toHaveURL(/\/es\//);

  await demo.finish('Permiso: GLOBAL_CHANGE_LANGUAGE');
});

demoTest('q015', async ({ demo, page }) => {
  await demo.intro('/preferences', 'Avatar → Tema');

  await demo.click(avatar(page), 'Abrí el menú de tu avatar');

  await demo.spotlight(
    page.getByRole('button', { name: T.themeOscuro }),
    'La app ofrece tres temas: Invoke, Claro y Oscuro',
  );

  await demo.click(page.getByRole('button', { name: T.themeOscuro }), 'Elegí Oscuro');

  await demo.step('Toda la interfaz cambia al instante', async () => {
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  // El menú sigue abierto: a diferencia del idioma, cambiar el tema no navega.
  // Por eso se elige el otro tema directamente, sin volver a pulsar el avatar.
  await demo.click(
    page.getByRole('button', { name: T.themeInvoke }),
    'Volvemos al tema Invoke desde el mismo menú',
  );

  await demo.finish('Permiso: GLOBAL_CHANGE_THEME');
});

demoTest('q016', async ({ demo, page }) => {
  await demo.intro('/', 'Avatar → Preferencias');

  await demo.click(avatar(page), 'Abrí el menú de tu avatar');
  await demo.click(page.getByRole('menuitem', { name: T.preferences }), 'Entrá a Preferencias');

  await demo.step('Esta pantalla es tuya: no afecta a nadie más', async () => {
    await expect(page).toHaveURL(/\/preferences/);
  });

  await demo.finish();
});
