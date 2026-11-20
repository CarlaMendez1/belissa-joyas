import { test, expect } from '@playwright/test';
import { admin, clienta, otraClienta, password, producto, sufijo } from './datos';
import { iniciarSesion, iniciarSesionComoClienta } from './ayudas';

test.describe('Cuentas', () => {
  test('una clienta nueva se registra y después puede iniciar sesión', async ({ page }) => {
    const email = `nueva.${sufijo}@belissa.com`;
    await page.goto('/registro');
    await page.locator('input[name="nombre"]').fill('Julia');
    await page.locator('input[name="apellido"]').fill('Ramos');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('input[name="confirmPassword"]').fill(password);
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test('rechaza una contraseña incorrecta', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill(clienta.email);
    await page.locator('input[name="password"]').fill('incorrecta');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText('Email o contraseña incorrectos')).toBeVisible();
  });

  test('inicia sesión y muestra su nombre en el menú de la cuenta', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    await expect(page.getByText(`${clienta.nombre} ${clienta.apellido}`).first()).toBeVisible();
  });
});

test.describe('Catálogo', () => {
  test('muestra el producto con su precio', async ({ page }) => {
    await page.goto('/');
    const tarjeta = page.getByRole('link').filter({ hasText: producto.nombre });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText('48.900');
  });

  test('abre el detalle del producto', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link').filter({ hasText: producto.nombre }).click();
    await expect(page.getByRole('heading', { name: producto.nombre })).toBeVisible();
  });
});

test.describe('Favoritos', () => {
  test('sin sesión, el corazón lleva al login', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link').filter({ hasText: producto.nombre }).getByRole('button', { name: 'Agregar a favoritos' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('marca un favorito, ve el aviso y lo encuentra con precio y características', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    const tarjeta = page.getByRole('link').filter({ hasText: producto.nombre });
    await tarjeta.getByRole('button', { name: 'Agregar a favoritos' }).click();

    await expect(page.getByRole('status')).toContainText('Agregado a tus favoritos');
    await expect(tarjeta.getByRole('button', { name: 'Quitar de favoritos' })).toBeVisible();

    await page.getByRole('status').getByRole('link', { name: 'Ver favoritos' }).click();
    await expect(page).toHaveURL(/\/mi-cuenta\/favoritos/);
    await expect(page.getByRole('heading', { name: 'Mis favoritos' })).toBeVisible();
    const fav = page.getByRole('link').filter({ hasText: producto.nombre });
    await expect(fav).toContainText('48.900');
    await expect(fav).toContainText('Disponible');
    await expect(fav).toContainText('Oro 18k');
    await expect(fav).toContainText(producto.descripcion);
  });

  test('el favorito se conserva al volver a entrar', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    await expect(
      page.getByRole('link').filter({ hasText: producto.nombre }).getByRole('button', { name: 'Quitar de favoritos' }),
    ).toBeVisible();
  });

  test('los favoritos son de cada clienta', async ({ page }) => {
    await iniciarSesionComoClienta(page, otraClienta.email);
    await page.goto('/mi-cuenta/favoritos');
    await expect(page.getByText('Todavía no tenés favoritos')).toBeVisible();
  });

  test('quita el favorito y desaparece de la lista', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    await page.goto('/mi-cuenta/favoritos');
    await page.getByRole('button', { name: 'Quitar de favoritos' }).click();
    await expect(page.getByRole('status')).toContainText('Quitado de tus favoritos');
    await expect(page.getByText('Todavía no tenés favoritos')).toBeVisible();
  });
});

test.describe('Carrito', () => {
  test('agrega el producto al carrito y lo confirma', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    await page.goto('/');
    await page.getByRole('link').filter({ hasText: producto.nombre }).click();
    await page.getByRole('button', { name: /Agregar al carrito/ }).click();
    await expect(page.getByText(/agregado al carrito/i)).toBeVisible();
  });
});

test.describe('Panel de administración', () => {
  test('la administradora entra al panel y Pedidos carga sin errores', async ({ page }) => {
    await iniciarSesion(page, admin.email);
    await expect(page).toHaveURL(/\/admin/);
    await page.goto('/admin/pedidos');
    await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
    await expect(page.getByText('Unauthorized')).toHaveCount(0);
  });

  test('una clienta no puede ver el panel', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    await page.goto('/admin/pedidos');
    await expect(page.getByRole('heading', { name: 'Pedidos' })).toHaveCount(0);
  });
});
