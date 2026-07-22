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