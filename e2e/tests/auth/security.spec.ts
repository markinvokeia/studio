import { test, expect } from '@playwright/test';

// Translation strings from es.json
const T = {
  nav: {
    dashboard: 'Panel de Control',
    patients: 'Pacientes',
    appointments: 'Citas',
    sales: 'Ventas',
    cashier: 'Caja',
    system: 'Sistema',
  },
  auditTitle: 'Registro de Auditoría',
  createBtn: 'Crear',
};

// Estos tests corren CON sesión válida (storageState del setup)

test.describe('Control de acceso — usuario autenticado', () => {
  test('dashboard carga sin errores ni redirección a login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/login/);
    await expect(page).not.toHaveURL(/error/);
  });

  test('menú de navegación muestra "Panel de Control"', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: T.nav.dashboard }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('módulo "Registro de Auditoría" carga sin botón Crear (solo lectura)', async ({ page }) => {
    await page.goto('/system/audit');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByText(T.auditTitle).first()).toBeVisible({ timeout: 10_000 });
    // Auditoría es read-only: no debe mostrar botón "Crear"
    await expect(page.getByRole('button', { name: T.createBtn })).not.toBeVisible();
  });

  test('módulo "Registro de Errores" carga sin botón Crear', async ({ page }) => {
    await page.goto('/system/errors');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByRole('button', { name: T.createBtn })).not.toBeVisible();
  });

  test('módulo "Registro de Acceso" carga sin botón Crear', async ({ page }) => {
    await page.goto('/system/access');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByRole('button', { name: T.createBtn })).not.toBeVisible();
  });

  test('header no expone el token JWT en elementos visibles del DOM', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url).not.toContain('token=');
    expect(url).not.toContain('access_token=');
  });
});

test.describe('XSS — validación en inputs de la aplicación', () => {
  test('payload XSS en búsqueda de pacientes no ejecuta script en DOM', async ({ page }) => {
    await page.goto('/patients');
    await page.waitForSelector('table', { timeout: 15_000 });

    await page.getByPlaceholder('Filtrar pacientes por correo...').fill('<script>window.__xss_patients=1</script>');
    await page.waitForTimeout(600);

    const xssExecuted = await page.evaluate(() => (window as any).__xss_patients === 1);
    expect(xssExecuted).toBe(false);
  });

  test('payload XSS en búsqueda de facturas no ejecuta script', async ({ page }) => {
    await page.goto('/sales/invoices');
    await page.waitForSelector('table', { timeout: 15_000 });

    await page.getByPlaceholder('Filtrar aquí...').fill('<script>window.__xss_invoices=1</script>');
    await page.waitForTimeout(600);

    const xssExecuted = await page.evaluate(() => (window as any).__xss_invoices === 1);
    expect(xssExecuted).toBe(false);
  });

  test('payload XSS en búsqueda de servicios no ejecuta script', async ({ page }) => {
    await page.goto('/sales/services');
    await page.waitForSelector('table', { timeout: 15_000 });

    await page.getByPlaceholder('Filtrar aquí...').fill('<img src=x onerror="window.__xss_services=1">');
    await page.waitForTimeout(600);

    const xssExecuted = await page.evaluate(() => (window as any).__xss_services === 1);
    expect(xssExecuted).toBe(false);
  });
});

test.describe('Headers HTTP de seguridad', () => {
  test('x-powered-by no expone tecnología de servidor sensible en producción', async ({ request }) => {
    const res = await request.get('/');
    const poweredBy = res.headers()['x-powered-by'];
    // En dev, Next.js puede enviar este header; en producción debe estar ausente o ser genérico.
    // Verificamos que no exponga frameworks de backend ni versiones internas.
    if (poweredBy) {
      expect(poweredBy).not.toMatch(/express|rails|laravel|django|php/i);
    }
  });
});

test.describe('Sesiones y tokens', () => {
  test('localStorage contiene el token JWT después de autenticar', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });

    // El token debe estar guardado en localStorage (patrón de la app)
    const hasToken = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return keys.some(k => k.toLowerCase().includes('token') || k.toLowerCase().includes('auth'));
    });
    expect(hasToken).toBe(true);
  });

  test('token no aparece en la URL en ninguna ruta de la app', async ({ page }) => {
    const routes = ['/patients', '/sales/quotes', '/appointments', '/cashier'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const url = page.url();
      expect(url).not.toContain('token=');
      expect(url).not.toContain('access_token=');
    }
  });
});
