/**
 * PARTE 0 — Para todos · Entrar y salir
 *
 * Fuera del triaje:
 *  - q002 (out-of-band): el enlace de primera contraseña llega por email.
 *  - q006 (conceptual): el aterrizaje según permisos exige dos roles en pantalla.
 *
 * q001, q003 y q005 corren con `auth: 'anonymous'`: necesitan empezar sin sesión.
 */
import { demoTest, expect } from '../../lib/demo.fixture';

const T = {
  // LoginPage
  emailId: '#email',
  passwordId: '#password',
  submit: /iniciar sesión|entrar|ingresar/i,
  forgot: /olvidó su contraseña|olvidaste tu contraseña|olvidé mi contraseña/i,
  // Header.*
  changePassword: 'Cambiar Contraseña',
  logout: 'Cerrar Sesión',
  // Header.logoutConfirmation.*
  cashSessionTitle: 'Sesión de Caja Activa',
  logoutAnyway: 'Cerrar de Todos Modos',
};

const avatar = (page: import('@playwright/test').Page) => page.getByTestId('sidebar-avatar-trigger');

demoTest(
  'q001',
  async ({ demo, page }) => {
    await demo.intro('/login', 'Correo y contraseña en /login');

    await demo.note('Al abrir la aplicación se reproduce el video de presentación');

    const email = process.env.DEMO_USER ?? process.env.E2E_USER ?? '';
    await demo.type(page.locator(T.emailId), email, 'Escribí tu correo electrónico');

    await demo.type(
      page.locator(T.passwordId),
      process.env.DEMO_PASS ?? process.env.E2E_PASS ?? '',
      'Y tu contraseña',
    );

    await demo.click(page.getByRole('button', { name: T.submit }), 'Entrá');

    await demo.step('El sistema te lleva a la primera pantalla a la que tenés acceso', async () => {
      await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 25_000 });
    });

    await demo.note('Si el correo no existe o la contraseña no coincide, el sistema lo dice con precisión');

    await demo.finish();
  },
  { auth: 'anonymous' },
);

demoTest(
  'q003',
  async ({ demo, page }) => {
    await demo.intro('/login', '«¿Olvidó su contraseña?» en la pantalla de acceso');

    await demo.click(
      page.getByRole('button', { name: T.forgot }),
      'Pulsá «¿Olvidó su contraseña?», debajo del formulario',
    );

    await demo.step('El formulario se transforma: ahora sólo pide el correo', async () => {
      // No hay navegación: la propia pantalla de login cambia de vista.
      await expect(page.locator(T.passwordId)).toHaveCount(0);
    });

    await demo.type(
      page.getByRole('textbox').first(),
      'tu.correo@clinica.com',
      'Ingresá el correo con el que entrás al sistema',
    );

    await demo.note('Recibís un enlace de restablecimiento por correo. Si vence, pedís uno nuevo');

    await demo.finish('Mínimo 8 caracteres, una mayúscula y un número');
  },
  { auth: 'anonymous' },
);

demoTest('q004', async ({ demo, page }) => {
  await demo.intro('/', 'Avatar → Cambiar Contraseña');

  await demo.click(avatar(page), 'Abrí el menú de tu avatar');
  await demo.click(
    page.getByRole('menuitem', { name: T.changePassword }),
    'Elegí Cambiar Contraseña',
  );

  await demo.step('Se abre el formulario con validación en vivo', async () => {
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  await demo.note('La nueva contraseña necesita 8 caracteres, una mayúscula y un número');

  // NO se envía: cambiar la contraseña de este usuario rompería la suite entera.
  await demo.click(
    page.getByRole('button', { name: /^cancelar$/i }).first(),
    'Acá cerramos sin guardar: es sólo la demostración',
  );

  await demo.finish('Permiso: PROFILE_CHANGE_PASSWORD');
});

demoTest('q005', async ({ demo, page }) => {
  await demo.intro('/', 'Avatar → Cerrar Sesión');

  await demo.click(avatar(page), 'Abrí el menú de tu avatar');

  await demo.click(
    page.getByRole('menuitem', { name: T.logout }),
    'Elegí Cerrar Sesión, al pie del menú',
  );

  // Protección deliberada del sistema: si quedó caja abierta, avisa antes de salir.
  // Puede o no aparecer según el estado del usuario, así que se contempla.
  const cashWarning = page.getByRole('alertdialog').filter({ hasText: T.cashSessionTitle });
  if (await cashWarning.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await demo.spotlight(
      cashWarning,
      'Si te quedó una sesión de caja abierta, el sistema te frena acá',
    );
    await demo.click(
      page.getByRole('button', { name: T.logoutAnyway }),
      'Podés ir a cerrarla, o salir de todos modos',
    );
  } else {
    await demo.note('Si tuvieras una sesión de caja abierta, el sistema te avisaría antes de salir');
  }

  await demo.step('Se cierra la sesión y ya no estás dentro del sistema', async () => {
    await expect(page.getByTestId('sidebar-avatar-trigger')).toHaveCount(0, { timeout: 25_000 });
  });

  await demo.finish();
});
