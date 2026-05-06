import { type Page, expect } from '@playwright/test';
import { expectNotOnLogin } from '../utils/helpers';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/login');
    await this.skipIntroVideo();
  }

  /** Dispara el evento 'ended' del video de intro para mostrar el formulario de inmediato. */
  async skipIntroVideo() {
    await this.page.waitForSelector('video', { timeout: 10_000 });
    await this.page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.dispatchEvent(new Event('ended'));
    });
    // Esperar que el form sea interactivo
    await this.page.locator('#email').waitFor({ state: 'visible', timeout: 10_000 });
  }

  async login(email: string, password: string) {
    await this.page.locator('#email').fill(email);
    await this.page.locator('#password').fill(password);
    await this.page.getByRole('button', { name: /entrar|iniciar sesión|sign in|ingresar/i }).click();
  }

  async expectError(message?: string | RegExp) {
    // El error se muestra como toast destructive
    const pattern = message ?? /inválido|incorrecto|error|invalid|incorrect|credencial/i;
    await expect(
      this.page.getByText(pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i'))
    ).toBeVisible({ timeout: 8_000 });
  }

  async expectRedirectToDashboard() {
    await expectNotOnLogin(this.page);
  }
}
