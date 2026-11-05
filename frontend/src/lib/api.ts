const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function getCategorias() {
  const res = await fetch(`${API}/categorias`, { cache: 'no-store' });
  return res.json();
}

export async function getProductos() {
  const res = await fetch(`${API}/productos`, { cache: 'no-store' });
  return res.json();
}

export async function getProducto(id: number) {
  const res = await fetch(`${API}/productos/${id}`, { cache: 'no-store' });
  return res.json();
}

export async function getVariantesPorProducto(id: number) {
  const res = await fetch(`${API}/variantes/producto/${id}`, { cache: 'no-store' });
  return res.json();
}

export async function getOpciones() {
  const res = await fetch(`${API}/opciones`, { cache: 'no-store' });
  return res.json();
}

export async function getCaracteristicasPorOpcion(id_opcion: number) {
  const res = await fetch(`${API}/caracteristicas?id_opcion=${id_opcion}`, { cache: 'no-store' });
  return res.json();
}

export async function getSubcategoriasPorCategoria(id_categoria: number) {
  const res = await fetch(`${API}/subcategorias/categoria/${id_categoria}`, { cache: 'no-store' });
  return res.json();
}

export async function getSubcategorias() {
  const res = await fetch(`${API}/subcategorias`, { cache: 'no-store' });
  return res.json();
}

export async function getNivelesVip() {
  const res = await fetch(`${API}/niveles-vip`, { cache: 'no-store' });
  return res.json();
}

export async function getOpcionesPorCategoria(id_categoria: number) {
  const res = await fetch(`${API}/categorias/${id_categoria}/opciones`, { cache: 'no-store' });
  return res.json();
}

export async function getMiNivelVip(token: string) {
  const res = await fetch(`${API}/cliente-vip/mi-nivel`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || `Error ${res.status}`);
  }
  return res.json();
}



// ---------------------------------------------------------------------
// Envíos
// ---------------------------------------------------------------------
export type Provincia = { id_provincia: number; nombre: string };

export type Direccion = {
  id_direccion: number;
  nombre_destinatario: string;
  telefono: string;
  calle: string;
  numero: string;
  piso_depto: string | null;
  localidad: string;
  id_provincia: number;
  codigo_postal: string;
  observaciones: string | null;
  es_predeterminada: boolean;
  provincia?: Provincia;
};

export type DireccionInput = {
  nombre_destinatario: string;
  telefono: string;
  calle: string;
  numero: string;
  piso_depto?: string;
  localidad: string;
  id_provincia: number;
  codigo_postal: string;
  observaciones?: string;
  es_predeterminada?: boolean;
};

export type OpcionesEntrega = {
  retiro_local_activo: boolean;
  retiro_local_direccion: string;
  envio_gratis_desde: number;
};

export type TipoEntrega = 'domicilio' | 'retiro';

export type ResumenCheckout = {
  descuento_vip_porcentaje: number;
  subtotal_productos: number;
  costo_envio: number;
  envio_gratis: boolean;
  plazo_dias: number | null;
  detalle_envio: string;
  total: number;
};

async function pedirConToken(token: string, ruta: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${ruta}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const mensaje = Array.isArray(data?.message) ? data.message.join('. ') : data?.message;
    throw new Error(mensaje || `Error ${res.status}`);
  }
  return res.json();
}

export async function getProvincias(): Promise<Provincia[]> {
  const res = await fetch(`${API}/envios/provincias`, { cache: 'no-store' });
  return res.json();
}

export async function getOpcionesEntrega(): Promise<OpcionesEntrega> {
  const res = await fetch(`${API}/envios/opciones`, { cache: 'no-store' });
  return res.json();
}

export function getMisDirecciones(token: string): Promise<Direccion[]> {
  return pedirConToken(token, '/direcciones');
}

export function crearDireccion(token: string, dto: DireccionInput): Promise<Direccion> {
  return pedirConToken(token, '/direcciones', { method: 'POST', body: JSON.stringify(dto) });
}

export function actualizarDireccion(token: string, id: number, dto: Partial<DireccionInput>): Promise<Direccion> {
  return pedirConToken(token, `/direcciones/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
}

// Lo que va a pagar el cliente (productos con descuento VIP + envío), calculado por el servidor
export function getResumenCheckout(
  token: string,
  dto: { tipo_entrega: TipoEntrega; id_direccion?: number },
): Promise<ResumenCheckout> {
  return pedirConToken(token, '/pago/resumen', { method: 'POST', body: JSON.stringify(dto) });
}


// ---------------------------------------------------------------------
// Mis pedidos
// ---------------------------------------------------------------------
export type EstadoEnvioPedido = 'pendiente_despacho' | 'despachado' | 'retiro_listo' | 'entregado';

export type MiPedido = {
  id_venta: number;
  fecha_compra: string;
  // null en las compras anteriores al módulo de envíos
  tipo_entrega: 'domicilio' | 'retiro' | null;
  estado_envio: EstadoEnvioPedido | null;
  subtotal_productos: number;
  costo_envio: number;
  total: number;
  destino: string | null;
  transportista: string | null;
  numero_seguimiento: string | null;
  fecha_despacho: string | null;
  fecha_entrega: string | null;
  items: { id_detalle: number; producto: string; cantidad: number; precio_unitario: number; subtotal: number }[];
};

export function getMisPedidos(token: string): Promise<MiPedido[]> {
  return pedirConToken(token, '/mis-pedidos');
}
