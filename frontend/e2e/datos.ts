/** Datos de las pruebas. Los correos llevan sufijo para poder repetir la corrida. */
export const sufijo = process.env.E2E_SUFIJO ?? String(Date.now());
export const password = 'Belissa2026';

export const clienta = { nombre: 'Lucía', apellido: 'Paz', email: `lucia.paz.${sufijo}@belissa.com` };
export const otraClienta = { nombre: 'Sofía', apellido: 'Gil', email: `sofia.gil.${sufijo}@belissa.com` };
export const admin = { nombre: 'Carla', apellido: 'Méndez', email: `admin.e2e.${sufijo}@belissa.com` };

export const producto = {
  nombre: `Anillo Aurora ${sufijo}`,
  sku: `E2E-${sufijo}`,
  descripcion: 'Anillo de oro con circonia, ideal para regalar.',
  precio: 48900,
};

/** Producto para las pruebas de compra: tiene su propio stock para poder medir el descuento. */
export const collar = {
  nombre: `Collar Luna ${sufijo}`,
  sku: `E2E-C-${sufijo}`,
  precio: 20000,
  stockInicial: 5,
};

/** Producto de la prueba de compra completa: stock propio para no interferir con las demás pruebas. */
export const pulsera = {
  nombre: `Pulsera Sol ${sufijo}`,
  sku: `E2E-P-${sufijo}`,
  precio: 15000,
  stockInicial: 8,
};

/** Clienta que se registra en la prueba de compra completa. */
export const clientaCompleta = { nombre: 'Marina', apellido: 'Ferro', email: `marina.ferro.${sufijo}@belissa.com` };

export const envioCordoba = 5800;
export const direccion = {
  destinatario: 'Lucía Paz',
  telefono: '3511234567',
  calle: 'Belgrano',
  numero: '123',
  localidad: 'Córdoba',
  provincia: 'Córdoba',
  codigoPostal: '5000',
};
