/**
 * Reemplaza el SDK de Mercado Pago SOLO cuando corren las pruebas de punta a punta
 * (se carga con NODE_OPTIONS=--require). No toca el código del sistema.
 *
 * - Crear la preferencia devuelve una "página de pago" simulada: la pantalla de éxito del sitio.
 * - Consultar un pago interpreta su id como "<idVenta>-<estado>" (por ejemplo "12-approved"),
 *   de modo que cada prueba decide si el pago se aprueba o se rechaza.
 */
const Module = require('module');
const originalLoad = Module._load;

class MercadoPagoConfig {
  constructor(opciones) {
    this.opciones = opciones;
  }
}

class Preference {
  async create({ body }) {
    const venta = body.external_reference;
    return {
      id: `sim-pref-${venta}`,
      init_point: `http://localhost:3000/pago/exito?external_reference=${venta}&payment_id=${venta}`,
    };
  }
}

class Payment {
  async get({ id }) {
    const [venta, estado] = String(id).split('-');
    if (!estado) throw new Error('Pago simulado inexistente');
    return {
      id: Number(venta) * 1000 + 7,
      status: estado,
      external_reference: venta,
      payment_method_id: 'visa',
    };
  }
}

Module._load = function (request, ...resto) {
  if (request === 'mercadopago') return { MercadoPagoConfig, Preference, Payment };
  return originalLoad.call(this, request, ...resto);
};
