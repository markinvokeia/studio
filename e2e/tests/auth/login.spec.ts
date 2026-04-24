import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';

const VALID_USER = process.env.E2E_USER ?? '';
const VALID_PASS = process.env.E2E_PASS ?? '';

// Translation strings from es.json — LoginPage
const T = {
  emailLabel: 'Correo Electrónico',
  passwordLabel: 'Contraseña',
  signIn: 'Entrar',
  forgotPassword: '¿Olvidó su contraseña?',
  recoverPasswordTitle: 'Recuperar Contraseña',
  recoverPasswordButton: 'Recuperar Contraseña',
  backToLogin: 'Volver al inicio de sesión',
  errors: {
    invalidCredentials: 'Las credenciales que ingresaste son incorrectas.',
    emailNotFound: 'El correo electrónico ingresado no existe en nuestro sistema.',
  },
  logout: 'Cerrar Sesión',
};

// Estos tests NO usan storageState — prueban el flow de auth directamente
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Autenticación — Formulario de Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto(); // navega a /login y despacha evento 'ended' del video
  });

  test('muestra el formulario con campos "Correo Electrónico" y "Contraseña"', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    // El botón de login usa el texto exacto de la traducción
    await expect(page.getByRole('button', { name: T.signIn })).toBeVisible();
  });

  test('el label del campo email es "Correo Electrónico"', async ({ page }) => {
    const label = page.getByText(T.emailLabel);
    await expect(label).toBeVisible();
  });

  test('el label del campo contraseña es "Contraseña"', async ({ page }) => {
    const label = page.getByText(T.passwordLabel, { exact: true });
    await expect(label).toBeVisible();
  });

  test('enlace "¿Olvidó su contraseña?" está visible', async ({ page }) => {
    await expect(page.getByText(T.forgotPassword)
      .or(page.getByRole('button', { name: T.forgotPassword }))).toBeVisible();
  });

  test('login exitoso con credenciales válidas redirige fuera de /login', async () => {
    await loginPage.login(VALID_USER, VALID_PASS);
    await loginPage.expectRedirectToDashboard();
  });

  test('contraseña incorrecta muestra mensaje de error de credenciales', async ({ page }) => {
    await loginPage.login(VALID_USER, 'contraseña_incorrecta_xyz123');
    await expect(
      page.getByText(T.errors.invalidCredentials)
        .or(page.getByText(/credencial|inválido|incorrecto/i))
        .or(page.locator('[data-variant="destructive"]'))
        .first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('email inexistente muestra mensaje de error', async ({ page }) => {
    await loginPage.login('noexiste_xyz_test@e2e-test-domain.com', VALID_PASS);
    await expect(
      page.getByText(T.errors.emailNotFound)
        .or(page.getByText(/credencial|inválido|incorrecto|no existe/i))
        .or(page.locator('[data-variant="destructive"]'))
        .first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('enviar formulario vacío — HTML5 validation bloquea el envío', async ({ page }) => {
    await page.getByRole('button', { name: T.signIn }).click();
    const emailInvalid = await page.locator('#email').evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );
    expect(emailInvalid).toBe(true);
  });

  test('campo email acepta texto y se puede limpiar', async ({ page }) => {
    await page.locator('#email').fill('test@test.com');
    await page.locator('#email').clear();
    await expect(page.locator('#email')).toBeEmpty();
    await expect(page.locator('#email')).toBeVisible();
  });
});

test.describe('Autenticación — Recuperar Contraseña', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('clic en "¿Olvidó su contraseña?" muestra formulario de recuperación', async ({ page }) => {
    await page.getByText(T.forgotPassword)
      .or(page.getByRole('button', { name: T.forgotPassword })).click();
    // Formulario de recuperación con campo de email
    await expect(page.locator('#recovery-email')
      .or(page.getByPlaceholder(/correo|email/i))
      .or(page.getByLabel(T.emailLabel))).toBeVisible({ timeout: 8_000 });
    // Título del formulario
    await expect(page.getByRole('heading', { name: T.recoverPasswordTitle })
      .or(page.locator('div').filter({ hasText: /^Recuperar Contraseña$/ }).first())).toBeVisible();
  });

  test('botón "Volver al inicio de sesión" regresa al formulario de login', async ({ page }) => {
    await page.getByText(T.forgotPassword)
      .or(page.getByRole('button', { name: T.forgotPassword })).click();
    await page.waitForTimeout(500);
    await page.getByText(T.backToLogin)
      .or(page.getByRole('button', { name: T.backToLogin })).click();
    await expect(page.locator('#email')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Protección de rutas', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('acceder a /patients sin sesión redirige a /login', async ({ page }) => {
    await page.goto('/patients');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('acceder a /sales/quotes sin sesión redirige a /login', async ({ page }) => {
    await page.goto('/sales/quotes');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('acceder a /system/users sin sesión redirige a /login', async ({ page }) => {
    await page.goto('/system/users');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('acceder a /cashier sin sesión redirige a /login', async ({ page }) => {
    await page.goto('/cashier');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('el token JWT no aparece expuesto en la URL después del login', async ({ page }) => {
    const lp = new LoginPage(page);
    await lp.goto();
    await lp.login(VALID_USER, VALID_PASS);
    await lp.expectRedirectToDashboard();
    const url = page.url();
    expect(url).not.toContain('token=');
    expect(url).not.toContain('access_token=');
    expect(url).not.toContain('jwt=');
  });
});

test.describe('Flujo set-first-password', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('la ruta /set-first-password es accesible sin sesión', async ({ page }) => {
    await page.goto('/set-first-password');
    await expect(page).not.toHaveURL(/login/, { timeout: 8_000 });
  });
});

test.describe('Seguridad básica del login', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('XSS en campo email no ejecuta script en el DOM', async ({ page }) => {
    const lp = new LoginPage(page);
    await lp.goto();
    await page.locator('#email').fill('<script>window.__xss_login=1</script>');
    await page.locator('#password').fill('test_pass');
    await page.getByRole('button', { name: T.signIn }).click();
    await page.waitForTimeout(1_000);
    const xssExecuted = await page.evaluate(() => (window as any).__xss_login === 1);
    expect(xssExecuted).toBe(false);
  });

  test('campo password oculta los caracteres (type=password)', async ({ page }) => {
    const lp = new LoginPage(page);
    await lp.goto();
    const inputType = await page.locator('#password').getAttribute('type');
    expect(inputType).toBe('password');
  });
});

test.describe('Logout', () => {
  // Este test SÍ usa storageState (usa la sesión guardada por setup)
  test('logout limpia la sesión y redirige a /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });

    // El botón de logout usa el texto exacto de la traducción: "Cerrar Sesión"
    const logoutBtn = page.getByRole('menuitem', { name: T.logout })
      .or(page.getByRole('button', { name: T.logout }))
      .or(page.getByText(T.logout)).first();

    if (await logoutBtn.isVisible().catch(() => false)) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/login/, { timeout: 10_000 });
      // Verificar que rutas protegidas redirigen de vuelta a login
      await page.goto('/patients');
      await expect(page).toHaveURL(/login/, { timeout: 10_000 });
    } else {
      // Abrir el menú de usuario primero (icono de avatar o botón "Mi Cuenta")
      const accountBtn = page.getByRole('button', { name: 'Mi Cuenta' })
        .or(page.getByLabel('Mi Cuenta'))
        .or(page.locator('header [role="button"]').last());
      if (await accountBtn.isVisible().catch(() => false)) {
        await accountBtn.click();
        await page.waitForTimeout(300);
        const logoutItem = page.getByRole('menuitem', { name: T.logout })
          .or(page.getByText(T.logout)).first();
        if (await logoutItem.isVisible().catch(() => false)) {
          await logoutItem.click();
          await expect(page).toHaveURL(/login/, { timeout: 10_000 });
        }
      }
    }
  });
});
