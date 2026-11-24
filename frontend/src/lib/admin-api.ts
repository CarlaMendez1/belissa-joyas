const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function manejarRespuesta(res: Response) {
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || `Error ${res.status}`);
  }
  return res.json();
}

// --- Categorías ---
export async function crearCategoria(token: string, dto: { nombre: string; descripcion?: string }) {
  const res = await fetch(`${API}/categorias`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function actualizarCategoria(token: string, id: number, dto: { nombre?: string; descripcion?: string }) {
  const res = await fetch(`${API}/categorias/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function eliminarCategoria(token: string, id: number) {
  const res = await fetch(`${API}/categorias/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  return manejarRespuesta(res);
}

// --- Opciones ---
export async function crearOpcion(token: string, dto: { nombre: string; tipo_dato: 'texto' | 'numero'; unidad?: string; categorias?: number[] }) {
  const res = await fetch(`${API}/opciones`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function actualizarOpcion(token: string, id: number, dto: Partial<{ nombre: string; tipo_dato: 'texto' | 'numero'; unidad: string; categorias: number[] }>) {
  const res = await fetch(`${API}/opciones/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function eliminarOpcion(token: string, id: number) {
  const res = await fetch(`${API}/opciones/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  return manejarRespuesta(res);
}

// --- Características ---
export async function crearCaracteristica(token: string, dto: { id_opcion: number; valor: string }) {
  const res = await fetch(`${API}/caracteristicas`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function actualizarCaracteristica(token: string, id: number, dto: { valor?: string }) {
  const res = await fetch(`${API}/caracteristicas/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function eliminarCaracteristica(token: string, id: number) {
  const res = await fetch(`${API}/caracteristicas/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  return manejarRespuesta(res);
}

export async function getSubcategoriasPorCategoria(id_categoria: number) {
  const res = await fetch(`${API}/subcategorias/categoria/${id_categoria}`, { cache: 'no-store' });
  return res.json();
}
// --- Subcategorías ---
export async function crearSubcategoria(token: string, dto: { id_categoria: number; nombre: string; descripcion?: string }) {
  const res = await fetch(`${API}/subcategorias`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function actualizarSubcategoria(token: string, id: number, dto: { nombre?: string; descripcion?: string }) {
  const res = await fetch(`${API}/subcategorias/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function eliminarSubcategoria(token: string, id: number) {
  const res = await fetch(`${API}/subcategorias/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  return manejarRespuesta(res);
}

// --- Productos ---
export async function crearProducto(token: string, dto: { id_subcategoria: number; nombre: string; descripcion?: string }) {
  const res = await fetch(`${API}/productos`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function actualizarProducto(token: string, id: number, dto: { nombre?: string; descripcion?: string; id_subcategoria?: number }) {
  const res = await fetch(`${API}/productos/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function eliminarProducto(token: string, id: number) {
  const res = await fetch(`${API}/productos/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  return manejarRespuesta(res);
}

// --- Variantes ---
export async function crearVariante(token: string, dto: { id_producto: number; precio_venta: number; stock_disponible?: number; caracteristicas?: number[] }) {
  const res = await fetch(`${API}/variantes`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function actualizarVariante(token: string, id: number, dto: { precio_venta?: number; stock_disponible?: number; caracteristicas?: number[] }) {
  const res = await fetch(`${API}/variantes/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function eliminarVariante(token: string, id: number) {
  const res = await fetch(`${API}/variantes/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  return manejarRespuesta(res);
}

// --- Configuración ---
export async function getConfiguracion(token: string) {
  const res = await fetch(`${API}/configuracion`, {
    headers: headers(token),
  });
  return manejarRespuesta(res);
}

export async function actualizarConfiguracion(token: string, clave: string, valor: string) {
  const res = await fetch(`${API}/configuracion/${clave}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ valor }),
  });
  return manejarRespuesta(res);
}

// --- Niveles VIP ---
export async function actualizarNivelVip(token: string, id: number, dto: {
  monto_min_requerido?: number;
  cantidad_compras_min_requerida?: number;
  porcentaje_descuento?: number;
  beneficios?: string;
}) {
  const res = await fetch(`${API}/niveles-vip/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

// --- Imágenes de producto ---
export async function subirImagenProducto(token: string, id_producto: number, archivo: File) {
  const formData = new FormData();
  formData.append('imagen', archivo);

  const res = await fetch(`${API}/productos/${id_producto}/imagen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, // ojo: NO poner Content-Type acá, el navegador lo arma solo con el boundary correcto para FormData
    body: formData,
  });
  return manejarRespuesta(res);
}

// --- Imágenes de variante ---
export async function subirImagenVariante(token: string, id_variante: number, archivo: File) {
  const formData = new FormData();
  formData.append('imagen', archivo);

  const res = await fetch(`${API}/variantes/${id_variante}/imagen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return manejarRespuesta(res);
}

export async function eliminarImagenProducto(token: string, id_producto: number, url: string) {
  const res = await fetch(`${API}/productos/${id_producto}/imagen`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ url }),
  });
  return manejarRespuesta(res);
}


// --- Dashboard ---
export interface DashboardResumen {
  ventas_mes: { cantidad: number; monto: number; monto_anterior: number; variacion_porcentaje: number | null };
  usuarios_activos: { total: number; nuevos_mes: number };
  clientes_vip: { total: number; nuevos_mes: number };
  stock_critico: {
    umbral: number;
    total: number;
    sin_stock: number;
    items: { id_variante: number; id_producto: number; nombre: string; detalle: string; stock: number }[];
  };
  pedidos_por_despachar: {
    total: number;
    items: {
      id_venta: number;
      cliente: string;
      tipo_entrega: string;
      provincia: string | null;
      estado_envio: string;
      fecha: string;
    }[];
  };
  ultimas_ventas: {
    id_venta: number;
    cliente: string;
    producto: string | null;
    otros_productos: number;
    monto: number;
    fecha: string;
  }[];
  carritos_abandonados: {
    total: number;
    items: {
      id_carrito: number;
      cliente: string;
      productos: number;
      monto: number;
      mail_enviado: boolean;
      fecha: string;
    }[];
  };
  pedidos_entregados_mes: number;
  tasa_conversion: { carritos: number; porcentaje: number | null };
  ventas_30_dias: { dia: string; monto: number }[];
  ingresos_por_categoria: { categoria: string; monto: number }[];
}

export async function getDashboardResumen(token: string): Promise<DashboardResumen> {
  const res = await fetch(`${API}/dashboard/resumen`, { headers: headers(token), cache: 'no-store' });
  return manejarRespuesta(res);
}


// --- Auditoría ---
export interface RegistroAuditoria {
  id_log: number;
  accion: 'crear' | 'editar' | 'eliminar';
  entidad: string;
  id_entidad: number | null;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  fecha: string;
  usuario: string | null;
}

export interface RespuestaAuditoria {
  items: RegistroAuditoria[];
  total: number;
  pagina: number;
  limite: number;
}

export async function getAuditoria(
  token: string,
  filtros: { entidad?: string; accion?: string; desde?: string; hasta?: string; pagina?: number; limite?: number } = {},
): Promise<RespuestaAuditoria> {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== '') params.set(clave, String(valor));
  });
  const res = await fetch(`${API}/auditoria?${params.toString()}`, { headers: headers(token), cache: 'no-store' });
  return manejarRespuesta(res);
}

export async function getEntidadesAuditoria(token: string): Promise<string[]> {
  const res = await fetch(`${API}/auditoria/entidades`, { headers: headers(token), cache: 'no-store' });
  return manejarRespuesta(res);
}


// --- Envíos (tarifas por provincia) ---
export type TarifaEnvio = {
  id_tarifa: number;
  id_provincia: number;
  precio: string;
  plazo_dias: number | null;
  activa: boolean;
  provincia: { id_provincia: number; nombre: string };
};

export async function getTarifasEnvio(token: string): Promise<TarifaEnvio[]> {
  const res = await fetch(`${API}/envios/tarifas`, {
    headers: headers(token),
    cache: 'no-store',
  });
  return manejarRespuesta(res);
}

export async function actualizarTarifaEnvio(
  token: string,
  id: number,
  dto: { precio?: number; plazo_dias?: number | null; activa?: boolean },
): Promise<TarifaEnvio> {
  const res = await fetch(`${API}/envios/tarifas/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}


// --- Pedidos (envíos) ---
export type EstadoEnvio = 'pendiente_despacho' | 'despachado' | 'retiro_listo' | 'entregado';

export type Pedido = {
  id_venta: number;
  fecha_compra: string;
  cliente: string | null;
  email: string | null;
  tipo_entrega: 'domicilio' | 'retiro';
  estado_envio: EstadoEnvio;
  subtotal_productos: number;
  costo_envio: number;
  total: number;
  destino: string;
  transportista: string | null;
  numero_seguimiento: string | null;
  fecha_despacho: string | null;
  fecha_entrega: string | null;
};

export type PedidoDetalle = Pedido & {
  telefono_contacto: string | null;
  direccion: {
    destinatario: string | null;
    telefono: string | null;
    calle: string | null;
    numero: string | null;
    piso_depto: string | null;
    localidad: string | null;
    provincia: string | null;
    codigo_postal: string | null;
    observaciones: string | null;
  } | null;
  items: {
    id_detalle: number;
    producto: string;
    sku: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
};

export async function getPedidos(
  token: string,
  filtros: { estado_envio?: string; pagina?: number; limite?: number } = {},
): Promise<{ items: Pedido[]; total: number; pagina: number; limite: number }> {
  const params = new URLSearchParams();
  if (filtros.estado_envio) params.set('estado_envio', filtros.estado_envio);
  if (filtros.pagina) params.set('pagina', String(filtros.pagina));
  if (filtros.limite) params.set('limite', String(filtros.limite));
  const res = await fetch(`${API}/pedidos?${params.toString()}`, {
    headers: headers(token),
    cache: 'no-store',
  });
  return manejarRespuesta(res);
}

export async function getPedido(token: string, id: number): Promise<PedidoDetalle> {
  const res = await fetch(`${API}/pedidos/${id}`, {
    headers: headers(token),
    cache: 'no-store',
  });
  return manejarRespuesta(res);
}

export async function cambiarEstadoPedido(
  token: string,
  id: number,
  dto: { estado_envio: EstadoEnvio; transportista?: string; numero_seguimiento?: string },
): Promise<Pedido> {
  const res = await fetch(`${API}/pedidos/${id}/estado`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

// --- Estadísticas ---
export type Agrupacion = 'dia' | 'semana' | 'mes';

export type EstadisticasEnvios = {
  rango: { desde: string; hasta: string };
  por_tipo: { tipo: string; cantidad: number; monto_envio: number; con_envio_gratis: number }[];
  por_provincia: { provincia: string; cantidad: number; monto: number }[];
  por_estado: { estado: string; cantidad: number }[];
  horas_hasta_despacho: number | null;
  dias_hasta_entrega: number | null;
};

type Rango = { desde: string; hasta: string };
type Resumen = { cantidad: number; monto_total: number; ticket_promedio: number; pendientes: number };
type SeriePunto = { periodo: string; cantidad: number; monto: number };

export type PanelVentas = {
  rango: Rango;
  anterior: Rango;
  actual: Resumen;
  previo: Resumen;
  serie_actual: SeriePunto[];
  serie_anterior: SeriePunto[];
  estados: { estado: 'confirmada' | 'pendiente' | 'cancelada'; cantidad: number; importe: number }[];
};

export type PanelProductos = {
  rango: Rango;
  umbral: number;
  unidades_vendidas: number;
  productos_con_ventas: number;
  variantes_stock_bajo: number;
  variantes_sin_stock: number;
  mas_vendidos: { id_producto: number; nombre: string; unidades: number }[];
  menos_vendidos: { id_producto: number; nombre: string; unidades: number }[];
  variantes: {
    id_variante: number;
    producto: string;
    material: string;
    medida: string;
    stock: number;
    estado: 'ok' | 'stock_bajo' | 'sin_stock';
  }[];
};

export type PanelClientes = {
  rango: Rango;
  anterior: Rango;
  registrados: number;
  cumplen_vip: number;
  compraron: number;
  recurrentes: number;
  compraron_anterior: number;
  recurrentes_anterior: number;
  frecuencia: { etiqueta: string; clientes: number }[];
  por_nivel: { nivel: string; clientes: number; monto_min: number; compras_min: number }[];
  top_clientes: {
    id_usuario: number;
    nombre: string;
    nivel: string;
    compras: number;
    importe: number;
    proximo_nivel: string | null;
    faltan_compras: number;
    faltan_monto: number;
  }[];
};

type ResumenRescate = {
  abandonados: number;
  notificados: number;
  recuperados: number;
  monto_recuperado: number;
  tasa_recuperacion: number;
};

export type PanelRescate = {
  rango: Rango;
  anterior: Rango;
  actual: ResumenRescate;
  previo: ResumenRescate;
  ventas_recuperadas: { cliente: string; fecha_aviso: string; fecha_compra: string; monto: number }[];
};

export type PanelEstadisticas = {
  ventas: PanelVentas;
  productos: PanelProductos;
  clientes: PanelClientes;
  rescate: PanelRescate;
  envios: EstadisticasEnvios;
};

export type SeccionEstadisticas = keyof PanelEstadisticas;

const RUTAS_ESTADISTICAS: Record<SeccionEstadisticas, string> = {
  ventas: 'panel/ventas',
  productos: 'panel/productos',
  clientes: 'panel/clientes',
  rescate: 'panel/rescate',
  envios: 'envios',
};

export async function getEstadisticas<S extends SeccionEstadisticas>(
  token: string,
  seccion: S,
  rango: Rango,
): Promise<PanelEstadisticas[S]> {
  const res = await fetch(
    `${API}/estadisticas/${RUTAS_ESTADISTICAS[seccion]}?desde=${rango.desde}&hasta=${rango.hasta}`,
    { headers: headers(token), cache: 'no-store' },
  );
  return manejarRespuesta(res);
}

// --- Administradores ---
export type Administrador = {
  id_usuario: number;
  nombre: string;
  apellido: string;
  email: string;
  estado: string;
  fecha_registro: string;
};

export type ListaAdministradores = {
  puede_gestionar: boolean;
  administradores: (Administrador & { es_principal: boolean })[];
};

export async function getAdministradores(token: string): Promise<ListaAdministradores> {
  const res = await fetch(`${API}/administradores`, { headers: headers(token), cache: 'no-store' });
  return manejarRespuesta(res);
}

export async function agregarAdministrador(token: string, email: string): Promise<Administrador> {
  const res = await fetch(`${API}/administradores`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ email }),
  });
  return manejarRespuesta(res);
}

export async function quitarAdministrador(token: string, id: number): Promise<Administrador> {
  const res = await fetch(`${API}/administradores/${id}`, { method: 'DELETE', headers: headers(token) });
  return manejarRespuesta(res);
}

// --- Carrusel del inicio ---
export async function guardarCarrusel(token: string, ids_producto: number[]) {
  const res = await fetch(`${API}/carrusel`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ ids_producto }),
  });
  return manejarRespuesta(res);
}

// --- Foto de portada de categoría ---
export async function subirPortadaCategoria(token: string, id_categoria: number, archivo: File) {
  const formData = new FormData();
  formData.append('imagen', archivo);
  const res = await fetch(`${API}/categorias/${id_categoria}/portada`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return manejarRespuesta(res);
}

export async function quitarPortadaCategoria(token: string, id_categoria: number) {
  const res = await fetch(`${API}/categorias/${id_categoria}/portada`, {
    method: 'DELETE',
    headers: headers(token),
  });
  return manejarRespuesta(res);
}
