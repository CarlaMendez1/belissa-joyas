import { test, expect, type Page } from '@playwright/test';
import { admin, clientaCompleta as clienta, direccion, envioCordoba, password, producto, pulsera } from './datos';
import { consultar, iniciarSesion, stockDe } from './ayudas';

/**
 * PE2E-01 · Compra completa, de punta a punta.
 *
 * Un solo recorrido encadenado, con una clienta nueva, que atraviesa los contratos C1 a C9:
 * registro → búsqueda → carrito → resumen → pago → confirmación automática → nivel VIP → despacho.
 * Mercado Pago se simula: el aviso de pago se manda directamente al webhook, igual que lo haría Mercado Pago.
 */
const API = 'http://localhost:3001';
const SKU = `${pulsera.sku}-V1`;
const plata = (n: number) => `$${n.toLocaleString('es-AR')}`;

async function avisarPago(page: Page, idVenta: number, estado: 'approved' | 'rejected') {
  const res = await page.request.post(`${API}/pago/webhook?type=payment&data.id=${idVenta}-${estado}`);
  expect(res.ok()).toBeTruthy();
}

async function venta(idVenta: number) {
  const [v] = await consultar<{ estado_compra: string; stock_descontado: boolean; estado_envio: string | null; costo_envio: string }>(
    `SELECT estado_compra, stock_descontado, estado_envio, costo_envio FROM venta WHERE id_venta = $1`,
    [idVenta],
  );
  return v;
}

test('PE2E-01 · Compra completa: del registro al despacho', async ({ page }) => {
  test.setTimeout(180_000);
  let idVenta = 0;

  await test.step('C1 · La clienta se registra y queda con la sesión iniciada', async () => {
    await page.goto('/registro');
    await page.locator('input[name="nombre"]').fill(clienta.nombre);
    await page.locator('input[name="apellido"]').fill(clienta.apellido);
    await page.locator('input[name="email"]').fill(clienta.email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('input[name="confirmPassword"]').fill(password);
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await expect(page).toHaveURL(/\/(login)?$/);
    if (page.url().endsWith('/login')) await iniciarSesion(page, clienta.email);
    await expect(page).toHaveURL('http://localhost:3000/');
    const [u] = await consultar<{ rol: string }>(`SELECT rol FROM usuario WHERE email = $1`, [clienta.email]);
    expect(u.rol).toBe('cliente');
  });

  await test.step('Carga su dirección de envío', async () => {
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

  await test.step('C9 · Busca la pulsera y el catálogo muestra solo lo que coincide', async () => {
    await page.goto('/');
    await page.getByPlaceholder('Buscar productos...').fill(pulsera.nombre);
    await expect(page.getByRole('link').filter({ hasText: pulsera.nombre })).toBeVisible();
    await expect(page.getByRole('link').filter({ hasText: producto.nombre })).toHaveCount(0);
  });

  await test.step('C2 · La agrega al carrito', async () => {
    await page.getByRole('link').filter({ hasText: pulsera.nombre }).click();
    await page.getByRole('button', { name: /Agregar al carrito|Actualizar cantidad/ }).click();
    await expect(page.getByRole('heading', { name: 'Mi carrito' })).toBeVisible();
  });

  await test.step('C3 · El resumen suma el envío de la provincia y calcula el total', async () => {
    const sidebar = page.locator('div.fixed.right-0');
    await expect(sidebar).toContainText('Envío a domicilio');
    await expect(sidebar).toContainText(plata(envioCordoba));
    await expect(sidebar).toContainText(plata(pulsera.precio + envioCordoba));
  });

  await test.step('C4 · Inicia el pago: la venta y el pago quedan pendientes y el stock no se toca', async () => {
    await page.getByRole('button', { name: 'Finalizar compra' }).click();
    await expect(page).toHaveURL(/\/pago\/exito\?external_reference=\d+/);
    idVenta = Number(new URL(page.url()).searchParams.get('external_reference'));

    const v = await venta(idVenta);
    expect(v.estado_compra).toBe('pendiente');
    expect(v.stock_descontado).toBe(false);
    const [pago] = await consultar<{ estado_pago: string }>(`SELECT estado_pago FROM pago WHERE id_venta = $1`, [idVenta]);
    expect(pago.estado_pago).toBe('pendiente');
    expect(await stockDe(SKU)).toBe(pulsera.stockInicial);
  });

  await test.step('C5 · Mercado Pago avisa el pago aprobado: se confirma la venta y se descuenta el stock una sola vez', async () => {
    await avisarPago(page, idVenta, 'approved');
    const v = await venta(idVenta);
    expect(v.estado_compra).toBe('confirmada');
    expect(v.stock_descontado).toBe(true);
    expect(Number(v.costo_envio)).toBe(envioCordoba);
    expect(await stockDe(SKU)).toBe(pulsera.stockInicial - 1);

    // El aviso repetido no descuenta de nuevo
    await avisarPago(page, idVenta, 'approved');
    expect(await stockDe(SKU)).toBe(pulsera.stockInicial - 1);
  });

  await test.step('La compra figura en Mis pedidos y el carrito quedó vacío', async () => {
    await page.goto('/mi-cuenta/pedidos');
    await expect(page.getByText(`#${idVenta}`).first()).toBeVisible();
    await expect(page.getByText('Preparando tu pedido').first()).toBeVisible();
    await page.goto('/');
    await page.getByRole('button').filter({ has: page.locator('svg.lucide-shopping-bag') }).click();
    await expect(page.getByRole('button', { name: 'Finalizar compra' })).toHaveCount(0);
  });

  await test.step('C7 · Se recalculó el nivel VIP de la clienta', async () => {
    const [{ n }] = await consultar<{ n: string }>(`SELECT count(*) AS n FROM nivel_vip`);
    if (Number(n) === 0) {
      // Sin niveles cargados no hay nada que recalcular: se deja constancia y el recorrido sigue
      test.info().annotations.push({ type: 'aviso', description: 'La base de prueba no tiene niveles VIP: se omite C7' });
      return;
    }
    const [vip] = await consultar<{ n: string }>(
      `SELECT count(*) AS n FROM cliente_vip c JOIN usuario u ON u.id_usuario = c.id_usuario WHERE u.email = $1`,
      [clienta.email],
    );
    expect(Number(vip.n)).toBe(1);
    await page.goto('/mi-cuenta');
    await expect(page.getByRole('heading', { name: 'Mi nivel de fidelidad' })).toBeVisible();
  });

  await test.step('C8 · La administradora despacha el pedido con transportista y seguimiento', async () => {
    await page.context().clearCookies();
    await iniciarSesion(page, admin.email);
    await expect(page).toHaveURL(/\/admin/);
    await page.goto('/admin/pedidos');
    await page.getByRole('button').filter({ hasText: `#${idVenta}` }).click();
    await page.getByPlaceholder('Transportista (ej: Correo Argentino)').fill('Correo Argentino');
    await page.getByPlaceholder('Número de seguimiento (opcional)').fill('AR987654321');
    await page.getByRole('button', { name: 'Marcar como despachado' }).click();
    await expect(async () => {
      expect((await venta(idVenta)).estado_envio).toBe('despachado');
    }).toPass();
  });

  await test.step('La clienta ve su pedido "En camino" con el número de seguimiento', async () => {
    await page.context().clearCookies();
    await iniciarSesion(page, clienta.email);
    await expect(page).toHaveURL('http://localhost:3000/');
    await page.goto('/mi-cuenta/pedidos');
    await expect(page.getByText('En camino').first()).toBeVisible();
    await page.getByRole('button').filter({ hasText: `#${idVenta}` }).click();
    await expect(page.getByText('AR987654321').first()).toBeVisible();
  });
});
