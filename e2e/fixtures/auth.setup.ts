import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { expectNotOnLogin } from '../utils/helpers';

const AUTH_FILE = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER;
  const password = process.env.E2E_PASS;

  if (!email || !password) {
    throw new Error('E2E_USER y E2E_PASS deben estar en .env.local');
  }

  await page.goto('/login');

  // La página muestra un video de intro antes de mostrar el formulario.
  // Disparamos el evento 'ended' del video para saltar la espera.
  await page.waitForSelector('video', { timeout: 10_000 });
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) video.dispatchEvent(new Event('ended'));
  });

  // Esperar a que el formulario sea visible e interactivo
  await page.locator('#email').waitFor({ state: 'visible', timeout: 10_000 });

  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /iniciar sesión|sign in|ingresar|entrar/i }).click();

  // Esperar redirect fuera de /login
  await expectNotOnLogin(page);

  // Guardar auth state (cookies + localStorage con el JWT)
  await page.context().storageState({ path: AUTH_FILE });
});
