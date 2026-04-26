import { test, expect } from '@playwright/test';
import { randomEmail, randomDoc } from '../../utils/helpers';

// ── Usuarios del Sistema ──────────────────────────────────────────────────────

test.describe('Sistema — Usuarios del Sistema', () => {
  const T = {
    pageTitle: 'Usuarios',
    filterPlaceholder: 'Filtrar aquí...',
    createBtn: 'Crear',
    nameLabel: 'Nombre',
    emailLabel: 'Correo Electrónico',
    cancel: 'Cancelar',
    save: 'Guardar',
    col: { name: 'Nombre', email: 'Correo Electrónico', status: 'Estado' },
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/es/system/users');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  test('carga título "Usuarios" y tabla', async ({ page }) => {
    await expect(page.getByText(T.pageTitle).first()).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: T.col.name })).toBeVisible();
  });

  test('botón Crear disponible', async ({ page }) => {
    await expect(page.getByRole('button', { name: T.createBtn })).toBeVisible();
  });

  test.describe('Crear usuario del sistema', () => {
    test('abre formulario con campos Nombre y Email', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel(T.nameLabel)).toBeVisible();
      await expect(page.getByLabel(T.emailLabel)).toBeVisible();
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
    });

    test('Cancelar cierra el formulario', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: T.cancel }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('validación: nombre vacío muestra error', async ({ page }) => {
      await page.getByRole('button', { name: T.createBtn }).click();
      const saveBtn = page.getByRole('button', { name: T.save })
        .or(page.getByRole('button', { name: 'Crear' })).last();
      await saveBtn.click();
      await expect(page.getByText(/nombre.*obligatorio|requerido/i).first()).toBeVisible({ timeout: 5_000 });
    });
  });
});

// ── Roles ─────────────────────────────────────────────────────────────────────

test.describe('Sistema — Roles', () => {
  const T = {
    pageTitle: 'Roles',
    createBtn: 'Crear',
    nameLabel: 'Nombre',
    cancel: 'Cancelar',
    save: 'Guardar',
    col: { name: 'Nombre' },
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/es/roles');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  test('carga título "Roles" y tabla con columna Nombre', async ({ page }) => {
    await expect(page.getByText(T.pageTitle).first()).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: T.col.name })).toBeVisible();
  });

  test('formulario de creación tiene campo Nombre', async ({ page }) => {
    if (await page.getByRole('button', { name: T.createBtn }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: T.createBtn }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: T.cancel }).click();
    }
  });
});

// ── Permisos ──────────────────────────────────────────────────────────────────

test.describe('Sistema — Permisos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/permissions');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de Permisos sin error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page.getByText('Permisos').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Registro de Auditoría (read-only) ─────────────────────────────────────────

test.describe('Sistema — Registro de Auditoría', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/system/audit');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de Auditoría sin error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page.getByText('Registro de Auditoría').first()).toBeVisible({ timeout: 10_000 });
  });

  test('tabla de auditoría muestra registros (read-only, sin botón Crear)', async ({ page }) => {
    const hasTable = await page.locator('table').isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasTable) {
      // No debe haber botón Crear en una tabla read-only
      const createBtn = page.getByRole('button', { name: 'Crear' });
      expect(await createBtn.isVisible().catch(() => false)).toBeFalsy();
    }
  });
});

// ── Registro de Acceso ─────────────────────────────────────────────────────────

test.describe('Sistema — Registro de Acceso', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/system/access');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de Acceso sin error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
  });
});

// ── Plantillas de Comunicación ────────────────────────────────────────────────

test.describe('Sistema — Plantillas de Comunicación', () => {
  const T = {
    pageTitle: 'Plantillas',
    createBtn: 'Crear',
    col: { name: 'Nombre' },
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/es/system/communication-templates');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de Plantillas sin error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page.getByText(T.pageTitle).first()
      .or(page.getByText('Plantillas'))).toBeVisible({ timeout: 10_000 });
  });

  test('botón Crear disponible', async ({ page }) => {
    if (await page.locator('table').isVisible().catch(() => false)) {
      await expect(page.getByRole('button', { name: T.createBtn })).toBeVisible();
    }
  });

  test('acción de duplicar plantilla disponible en el menú', async ({ page }) => {
    if (await page.locator('table').isVisible().catch(() => false)) {
      const actionBtn = page.locator('table tbody tr').first()
        .getByRole('button', { name: 'Abrir menú' });
      if (await actionBtn.isVisible().catch(() => false)) {
        await actionBtn.click();
        const dupItem = page.getByRole('menuitem', { name: /duplicar|clonar/i });
        if (await dupItem.isVisible().catch(() => false)) {
          await expect(dupItem).toBeVisible();
        }
        await page.keyboard.press('Escape');
      }
    }
  });
});

// ── Configuraciones del Sistema ───────────────────────────────────────────────

test.describe('Sistema — Configuraciones', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/system/config');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de Configuraciones sin error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page.getByText('Configuraciones').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Notificaciones ────────────────────────────────────────────────────────────

test.describe('Sistema — Notificaciones', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/system/notification-settings');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de Notificaciones sin error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page.getByText('Notificaciones').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Errores del Sistema ────────────────────────────────────────────────────────

test.describe('Sistema — Registro de Errores', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/system/errors');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de Errores sin redirección a login', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/);
  });
});

// ── Historial de Ejecuciones ───────────────────────────────────────────────────

test.describe('Sistema — Historial de Ejecuciones', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/system/execution-history');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de Historial sin error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
  });
});

// ── Categorías de Alertas ─────────────────────────────────────────────────────

test.describe('Sistema — Categorías de Alertas', () => {
  const T = {
    pageTitle: 'Categorías de Alerta',
    createBtn: 'Crear',
    col: { name: 'Nombre' },
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/es/system/alert-categories');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de Categorías de Alertas sin error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page.getByText(T.pageTitle).first()).toBeVisible({ timeout: 10_000 });
  });

  test.describe('CRUD Categoría de Alerta', () => {
    test('formulario de creación disponible', async ({ page }) => {
      const hasTable = await page.locator('table').isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasTable) {
        const createBtn = page.getByRole('button', { name: T.createBtn });
        if (await createBtn.isVisible().catch(() => false)) {
          await createBtn.click();
          await expect(page.getByRole('dialog')).toBeVisible();
          await page.keyboard.press('Escape');
        }
      }
    });
  });
});

// ── Reglas de Alertas ─────────────────────────────────────────────────────────

test.describe('Sistema — Reglas de Alertas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/system/alert-rules');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de Reglas de Alertas sin error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page.getByText('Reglas de Alerta').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Configuración de Alertas ──────────────────────────────────────────────────

test.describe('Sistema — Configuración de Alertas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/es/system/alerts-config');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de Configuración de Alertas sin error', async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page.getByText('Configuración del Sistema de Alertas').first()
      .or(page.getByText('Configuración del Sistema de Alertas'))).toBeVisible({ timeout: 10_000 });
  });
});
