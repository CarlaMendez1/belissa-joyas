import { expect, type Page } from '@playwright/test';
import { password } from './datos';

export async function iniciarSesion(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

export async function iniciarSesionComoClienta(page: Page, email: string) {
  await iniciarSesion(page, email);
  await expect(page).toHaveURL('http://localhost:3000/');
}
