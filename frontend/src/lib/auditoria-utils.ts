// Nombres legibles para las entidades que aparecen en la auditoría
const NOMBRES_ENTIDAD: Record<string, string> = {
  NivelVip: 'Nivel VIP',
  ClienteVip: 'Cliente VIP',
  Configuracion: 'Configuración',
  TarifaEnvio: 'Tarifa de envío',
  Venta: 'Pedido',
  Opcion: 'Opción',
  Caracteristica: 'Característica',
  Subcategoria: 'Subcategoría',
  Categoria: 'Categoría',
};

// Nombres legibles para las claves de Configuración (mismos textos que ve el admin en Envíos)
const NOMBRES_CLAVE: Record<string, string> = {
  envio_precio_base: 'Precio base de envío',
  envio_gratis_desde: 'Envío gratis desde',
  retiro_local_activo: 'Permitir retiro en local',
  retiro_local_direccion: 'Dirección y horarios del local',
  tiempo_abandono_carrito_minutos: 'Tiempo para considerar un carrito abandonado',
};

// Si la clave no está en la lista, se muestra sin guiones bajos y con mayúscula inicial
export function nombreClave(clave: string) {
  if (NOMBRES_CLAVE[clave]) return NOMBRES_CLAVE[clave];
  const texto = clave.replace(/_/g, ' ').trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function nombreEntidad(entidad: string) {
  return NOMBRES_ENTIDAD[entidad] ?? entidad;
}

// Dato que identifica el cambio cuando no hay un id numérico:
// la clave en Configuración y la provincia en las tarifas de envío.
export function detalleDe(...datos: unknown[]): string | null {
  for (const d of datos) {
    if (!d || typeof d !== 'object') continue;
    const { clave, provincia } = d as { clave?: unknown; provincia?: unknown };
    if (typeof clave === 'string') return clave;
    if (typeof provincia === 'string') return provincia;
  }
  return null;
}

export function tituloRegistro(r: { entidad: string; id_entidad: number | null; detalle?: string | null }) {
  const base = `${nombreEntidad(r.entidad)}${r.id_entidad !== null ? ` #${r.id_entidad}` : ''}`;
  if (!r.detalle) return base;
  const detalle = r.entidad === 'Configuracion' ? nombreClave(r.detalle) : r.detalle;
  return `${base} · ${detalle}`;
}
