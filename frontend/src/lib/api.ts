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