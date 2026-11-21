import { test, expect, type Page } from '@playwright/test';
import { admin, clienta, collar, direccion, envioCordoba } from './datos';
import { consultar, iniciarSesion, iniciarSesionComoClienta, stockDe } from './ayudas';

const API = 'http://localhost:3001';
const SKU = `${collar.sku}-V1`;
const plata = (n: number) => `$${n.toLocaleString('es-AR')}`;

/** Simula el aviso que Mercado Pago le manda al sistema cuando un pago cambia de estado. */
async function avisarPago(page: Page, idVenta: number, estado: 'approved' | 'rejected') {
  const res = await page.request.post(`${API}/pago/webhook?type=payment&data.id=${idVenta}-${estado}`);
  expect(res.ok()).toBeTruthy();
}

/** Agrega el collar al carrito; el carrito se abre solo. */
async function agregarCollar(page: Page) {
  await page.goto('/');
  await page.getByRole('link').filter({ hasText: collar.nombre }).click();
  await page.getByRole('button', { name: /Agregar al carrito|Actualizar cantidad/ }).click();
  await expect(page.getByRole('heading', { name: 'Mi carrito' })).toBeVisible();
}

/** Aprieta "Finalizar compra" y devuelve el número de venta con el que vuelve de la pantalla de pago. */
async function finalizarCompra(page: Page): Promise<number> {
  await page.getByRole('button', { name: 'Finalizar compra' }).click();
  await expect(page).toHaveURL(/\/pago\/exito\?external_reference=\d+/);
  return Number(new URL(page.url()).searchParams.get('external_reference'));
}

async function estadoDeVenta(idVenta: number) {
  const [v] = await consultar<{ estado_compra: string; stock_descontado: boolean; estado_envio: string | null; costo_envio: string }>(
    `SELECT estado_compra, stock_descontado, estado_envio, costo_envio FROM venta WHERE id_venta = $1`,
    [idVenta],
  );
  return v;
}

test.describe.configure({ mode: 'serial' });

let ventaDomicilio = 0;
let ventaRetiro = 0;

test.describe('Compra con envío a domicilio', () => {
  test('la clienta carga su dirección de envío', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    await page.goto('/mi-cuenta/direcciones');
    await page.getByLabel('Quién recibe *').fill(direccion.destinatario);
    await page.getByLabel('Teléfono *').fill(direccion.telefono);
    await page.getByLabel('Calle *').fill(direccion.calle);
    await page.getByLabel('Número *').fill(direccion.numero);
    await page.getByLabel('Localidad *').fill(direccion.localidad);
    await page.getByLabel('Provincia *').selectOption({ label: direccion.provincia });
    await page.getByLabel('Código postal *').fill(direccion.codigoPostal);
    await page.getByRole('button', { name: 'Guardar dirección' }).click();
    await expect(page.getByText(`${direccion.calle} ${direccion.numero}`).first()).toBeVisible();
  });

  test('el resumen suma el envío de la provincia y el pago aprobado descuenta el stock una sola vez', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    expect(await stockDe(SKU)).toBe(collar.stockInicial);

    await agregarCollar(page);
    const sidebar = page.locator('div.fixed.right-0');
    await expect(sidebar).toContainText('Envío a domicilio');
    await expect(sidebar).toContainText(`Envío`);
    await expect(sidebar).toContainText(plata(envioCordoba));
    await expect(sidebar).toContainText(plata(collar.precio + envioCordoba));

    ventaDomicilio = await finalizarCompra(page);

    // Mientras el pago no se confirma, el stock no se toca
    expect(await stockDe(SKU)).toBe(collar.stockInicial);
    expect((await estadoDeVenta(ventaDomicilio)).stock_descontado).toBe(false);

    await avisarPago(page, ventaDomicilio, 'approved');
    expect(await stockDe(SKU)).toBe(collar.stockInicial - 1);
    const venta = await estadoDeVenta(ventaDomicilio);
    expect(venta.estado_compra).toBe('confirmada');
    expect(venta.stock_descontado).toBe(true);
    expect(Number(venta.costo_envio)).toBe(envioCordoba);

    // El mismo aviso repetido no descuenta de nuevo
    await avisarPago(page, ventaDomicilio, 'approved');
    expect(await stockDe(SKU)).toBe(collar.stockInicial - 1);
  });

  test('el pedido figura en Mis pedidos como "Preparando tu pedido"', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    await page.goto('/mi-cuenta/pedidos');
    await expect(page.getByText(`#${ventaDomicilio}`).first()).toBeVisible();
    await expect(page.getByText('Preparando tu pedido').first()).toBeVisible();
  });

  test('el carrito queda vacío después de pagar', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    await page.getByRole('button').filter({ has: page.locator('svg.lucide-shopping-bag') }).click();
    await expect(page.getByRole('button', { name: 'Finalizar compra' })).toHaveCount(0);
  });
});

test.describe('Envíos: seguimiento desde el panel', () => {
  test('la administradora despacha el pedido con transportista y seguimiento', async ({ page }) => {
    await iniciarSesion(page, admin.email);
    await expect(page).toHaveURL(/\/admin/);
    await page.goto('/admin/pedidos');
    await page.getByRole('button').filter({ hasText: `#${ventaDomicilio}` }).click();
    await page.getByPlaceholder('Transportista (ej: Correo Argentino)').fill('Correo Argentino');
    await page.getByPlaceholder('Número de seguimiento (opcional)').fill('AR123456789');
    await page.getByRole('button', { name: 'Marcar como despachado' }).click();
    await expect(async () => {
      expect((await estadoDeVenta(ventaDomicilio)).estado_envio).toBe('despachado');
    }).toPass();
  });

  test('la clienta ve su pedido "En camino" con el número de seguimiento', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    await page.goto('/mi-cuenta/pedidos');
    await expect(page.getByText('En camino').first()).toBeVisible();
    await page.getByRole('button').filter({ hasText: `#${ventaDomicilio}` }).click();
    await expect(page.getByText('Correo Argentino').first()).toBeVisible();
    await expect(page.getByText('AR123456789').first()).toBeVisible();
  });

  test('la administradora marca el pedido como entregado y la clienta lo ve', async ({ page }) => {
    await iniciarSesion(page, admin.email);
    await expect(page).toHaveURL(/\/admin/);
    await page.goto('/admin/pedidos');
    await page.getByRole('button', { name: 'Todos' }).click();
    await page.getByRole('button').filter({ hasText: `#${ventaDomicilio}` }).click();
    await page.getByRole('button', { name: 'Marcar como entregado' }).click();
    await expect(async () => {
      expect((await estadoDeVenta(ventaDomicilio)).estado_envio).toBe('entregado');
    }).toPass();

    await page.context().clearCookies();
    await iniciarSesionComoClienta(page, clienta.email);
    await page.goto('/mi-cuenta/pedidos');
    await expect(page.getByText('Entregado').first()).toBeVisible();
  });
});

test.describe('Retiro en local', () => {
  test('el retiro no cobra envío y el pedido se marca listo para retirar', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    const antes = await stockDe(SKU);

    await agregarCollar(page);
    const sidebar = page.locator('div.fixed.right-0');
    await sidebar.getByRole('button', { name: /Retiro en local/ }).click();
    await expect(sidebar).toContainText('Gratis');
    await expect(sidebar).toContainText(plata(collar.precio));

    ventaRetiro = await finalizarCompra(page);
    await avisarPago(page, ventaRetiro, 'approved');
    expect(await stockDe(SKU)).toBe(antes - 1);
    expect(Number((await estadoDeVenta(ventaRetiro)).costo_envio)).toBe(0);

    await page.context().clearCookies();
    await iniciarSesion(page, admin.email);
    await expect(page).toHaveURL(/\/admin/);
    await page.goto('/admin/pedidos');
    await page.getByRole('button').filter({ hasText: `#${ventaRetiro}` }).click();
    await page.getByRole('button', { name: 'Marcar listo para retirar' }).click();
    await expect(async () => {
      expect((await estadoDeVenta(ventaRetiro)).estado_envio).toBe('retiro_listo');
    }).toPass();

    await page.context().clearCookies();
    await iniciarSesionComoClienta(page, clienta.email);
    await page.goto('/mi-cuenta/pedidos');
    await expect(page.getByText('Listo para retirar').first()).toBeVisible();
  });
});

test.describe('Pago rechazado', () => {
  test('cancela la venta y no descuenta el stock', async ({ page }) => {
    await iniciarSesionComoClienta(page, clienta.email);
    const antes = await stockDe(SKU);

    await agregarCollar(page);
    await page.locator('div.fixed.right-0').getByRole('button', { name: /Retiro en local/ }).click();
    const venta = await finalizarCompra(page);

    await avisarPago(page, venta, 'rejected');
    expect((await estadoDeVenta(venta)).estado_compra).toBe('cancelada');
    expect(await stockDe(SKU)).toBe(antes);

    await page.goto('/mi-cuenta/pedidos');
    await expect(page.getByText(`#${venta}`)).toHaveCount(0);
  });
});
