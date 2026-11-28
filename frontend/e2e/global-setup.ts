import { Client } from 'pg';
import { admin, clienta, collar, pulsera, envioCordoba, otraClienta, password, producto, sufijo } from './datos';

const API = 'http://localhost:3001';

async function registrar(u: { nombre: string; apellido: string; email: string }) {
  const res = await fetch(`${API}/auth/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...u, password }),
  });
  if (!res.ok) throw new Error(`No se pudo registrar a ${u.email}: ${res.status} ${await res.text()}`);
}

/**
 * Antes de las pruebas: crea las cuentas y un producto con variante y características,
 * directamente en la base de prueba. Corre con el backend ya levantado.
 */
export default async function globalSetup() {
  await registrar(clienta);
  await registrar(otraClienta);
  await registrar(admin);

  const db = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'belissa_test',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASS ?? '',
  });
  await db.connect();
  try {
    await db.query(`UPDATE usuario SET rol = 'administrador' WHERE email = $1`, [admin.email]);

    const cat = await db.query(`INSERT INTO categoria (nombre) VALUES ($1) RETURNING id_categoria`, [`Anillos E2E ${sufijo}`]);
    const sub = await db.query(
      `INSERT INTO subcategoria (id_categoria, nombre) VALUES ($1, $2) RETURNING id_subcategoria`,
      [cat.rows[0].id_categoria, `Compromiso E2E ${sufijo}`],
    );
    const prod = await db.query(
      `INSERT INTO producto (id_subcategoria, codigo_sku, nombre, descripcion) VALUES ($1, $2, $3, $4) RETURNING id_producto`,
      [sub.rows[0].id_subcategoria, producto.sku, producto.nombre, producto.descripcion],
    );
    const vari = await db.query(
      `INSERT INTO variante (id_producto, codigo_sku, precio_venta, stock_disponible) VALUES ($1, $2, $3, 10) RETURNING id_variante`,
      [prod.rows[0].id_producto, `${producto.sku}-V1`, producto.precio],
    );
    const opc = await db.query(`INSERT INTO opcion (nombre) VALUES ($1) RETURNING id_opcion`, [`Material E2E ${sufijo}`]);
    const car = await db.query(`INSERT INTO caracteristica (id_opcion, valor) VALUES ($1, 'Oro 18k') RETURNING id_caracteristica`, [
      opc.rows[0].id_opcion,
    ]);
    await db.query(`INSERT INTO variante_caracteristica (id_variante, id_caracteristica) VALUES ($1, $2)`, [
      vari.rows[0].id_variante,
      car.rows[0].id_caracteristica,
    ]);
    // Producto para las pruebas de compra
    const prod2 = await db.query(
      `INSERT INTO producto (id_subcategoria, codigo_sku, nombre) VALUES ($1, $2, $3) RETURNING id_producto`,
      [sub.rows[0].id_subcategoria, collar.sku, collar.nombre],
    );
    await db.query(
      `INSERT INTO variante (id_producto, codigo_sku, precio_venta, stock_disponible) VALUES ($1, $2, $3, $4)`,
      [prod2.rows[0].id_producto, `${collar.sku}-V1`, collar.precio, collar.stockInicial],
    );

    // Producto para la prueba de compra completa
    const prod3 = await db.query(
      `INSERT INTO producto (id_subcategoria, codigo_sku, nombre) VALUES ($1, $2, $3) RETURNING id_producto`,
      [sub.rows[0].id_subcategoria, pulsera.sku, pulsera.nombre],
    );
    await db.query(
      `INSERT INTO variante (id_producto, codigo_sku, precio_venta, stock_disponible) VALUES ($1, $2, $3, $4)`,
      [prod3.rows[0].id_producto, `${pulsera.sku}-V1`, pulsera.precio, pulsera.stockInicial],
    );

    // Envío: provincia con tarifa activa, y retiro en local habilitado
    let prov = await db.query(`SELECT id_provincia FROM provincia WHERE nombre = 'Córdoba'`);
    if (!prov.rows.length) prov = await db.query(`INSERT INTO provincia (nombre) VALUES ('Córdoba') RETURNING id_provincia`);
    await db.query(`DELETE FROM tarifa_envio WHERE id_provincia = $1`, [prov.rows[0].id_provincia]);
    await db.query(`INSERT INTO tarifa_envio (id_provincia, precio, plazo_dias, activa) VALUES ($1, $2, 3, true)`, [
      prov.rows[0].id_provincia,
      envioCordoba,
    ]);
    for (const [clave, valor] of [
      ['retiro_local_activo', 'true'],
      ['retiro_local_direccion', 'Av. Colón 100, Córdoba'],
      ['envio_gratis_desde', '0'],
    ]) {
      await db.query(
        `INSERT INTO configuracion (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
        [clave, valor],
      );
    }
    process.env.E2E_MATERIAL = `Material E2E ${sufijo}`;
  } finally {
    await db.end();
  }
}
