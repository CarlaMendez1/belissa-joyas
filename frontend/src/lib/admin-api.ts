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
export async function crearOpcion(token: string, dto: { nombre: string }) {
  const res = await fetch(`${API}/opciones`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(dto),
  });
  return manejarRespuesta(res);
}

export async function actualizarOpcion(token: string, id: number, dto: { nombre?: string }) {
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