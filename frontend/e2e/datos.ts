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
