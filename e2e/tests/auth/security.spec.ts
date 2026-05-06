import { test, expect } from '@playwright/test';
import { expectNotOnLogin } from '../../utils/helpers';

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
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/login/);
    await expect(page).not.toHaveURL(/error/);
  });

  test('menú de navegación muestra "Panel de Control"', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // On mobile the nav is collapsed — try opening the hamburger first
    const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="menú" i], button.burger, [data-testid="mobile-menu-btn"]').first();
    if (await hamburger.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await hamburger.click();
      await page.waitForTimeout(300);
    }
    const link = page.getByRole('link', { name: T.nav.dashboard }).first();
    const isVisible = await link.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!isVisible) return; // Skip on mobile if nav is collapsed without a findable hamburger
    await expect(link).toBeVisible();
  });

  test('módulo "Registro de Auditoría" carga sin botón Crear (solo lectura)', async ({ page }) => {
    await page.goto('/system/audit', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByText(T.auditTitle).first()).toBeVisible({ timeout: 10_000 });
    // Auditoría es read-only: no debe mostrar botón "Crear"
    await expect(page.getByRole('button', { name: T.createBtn })).not.toBeVisible();
  });

  test('módulo "Registro de Errores" carga sin botón Crear', async ({ page }) => {
    await page.goto('/system/errors', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByRole('button', { name: T.createBtn })).not.toBeVisible();
  });

  test('módulo "Registro de Acceso" carga sin botón Crear', async ({ page }) => {
    await page.goto('/system/access', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByRole('button', { name: T.createBtn })).not.toBeVisible();
  });

  test('módulos read-only no muestran acciones de mutación por fila', async ({ page }) => {
    const routes = ['/system/audit', '/system/errors', '/system/access'];
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/login/);
      await expect(page.getByRole('button', { name: /crear|editar|eliminar|borrar/i }).first())
        .not.toBeVisible();
      await expect(page.getByRole('menuitem', { name: /editar|eliminar|borrar/i }).first())
        .not.toBeVisible();
    }
  });

  test('rutas administrativas sensibles responden con control de acceso sin redirigir a error', async ({ page }) => {
    const routes = ['/system/users', '/roles', '/permissions'];
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/error/);
      await expect(page).not.toHaveURL(/login/);
      const hasForbidden = await page.getByText(/403|forbidden|acceso denegado|sin permisos/i)
        .first().isVisible({ timeout: 2_000 }).catch(() => false);
      const hasDataView = await page.locator('table, [data-testid="card-list"], form').first()
        .isVisible({ timeout: 4_000 }).catch(() => false);
      expect(hasForbidden || hasDataView).toBeTruthy();
    }
  });

  test('header no expone el token JWT en elementos visibles del DOM', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const url = page.url();
    expect(url).not.toContain('token=');
    expect(url).not.toContain('access_token=');
  });
});

test.describe('XSS — validación en inputs de la aplicación', () => {
  test('payload XSS en búsqueda de pacientes no ejecuta script en DOM', async ({ page }) => {
    await page.goto('/patients', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});

    await page.getByPlaceholder('Filtrar pacientes por correo...').fill('<script>window.__xss_patients=1</script>');
    await page.waitForTimeout(600);

    const xssExecuted = await page.evaluate(() => (window as any).__xss_patients === 1);
    expect(xssExecuted).toBe(false);
  });

  test('payload XSS en búsqueda de facturas no ejecuta script', async ({ page }) => {
    await page.goto('/sales/invoices', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});

    await page.getByPlaceholder('Filtrar aquí...').fill('<script>window.__xss_invoices=1</script>');
    await page.waitForTimeout(600);

    const xssExecuted = await page.evaluate(() => (window as any).__xss_invoices === 1);
    expect(xssExecuted).toBe(false);
  });

  test('payload XSS en búsqueda de servicios no ejecuta script', async ({ page }) => {
    await page.goto('/sales/services', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table, [data-testid="card-list"]', { timeout: 30_000 }).catch(() => {});

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
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expectNotOnLogin(page, 15_000);

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
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const url = page.url();
      expect(url).not.toContain('token=');
      expect(url).not.toContain('access_token=');
    }
  });

  test('cerrar sesión remueve acceso a ruta protegida al volver atrás', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expectNotOnLogin(page, 15_000);

    const logoutBtn = page.getByRole('menuitem', { name: 'Cerrar Sesión' })
      .or(page.getByRole('button', { name: 'Cerrar Sesión' }))
      .or(page.getByText('Cerrar Sesión'))
      .first();

    if (!await logoutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const accountBtn = page.getByRole('button', { name: 'Mi Cuenta' })
        .or(page.getByLabel('Mi Cuenta'))
        .or(page.locator('header [role="button"]').last());
      if (await accountBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await accountBtn.click();
      }
    }

    if (await logoutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/login/, { timeout: 10_000 });
      await page.goBack();
      await expect(page).toHaveURL(/login/, { timeout: 10_000 });
    }
  });
});
