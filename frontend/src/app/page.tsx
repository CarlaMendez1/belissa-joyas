'use client';
import { useEffect, useState, useRef } from 'react';
import { getCategorias, getProductos, getCarrusel } from '@/lib/api';
import HomePage from '@/components/home-page';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Page() {
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [carrusel, setCarrusel] = useState<any[]>([]);
  const [subcategorias, setSubcategorias] = useState<any[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);
  const [subcategoriaSeleccionada, setSubcategoriaSeleccionada] = useState<string | null>(null);
  const prevCategoriaRef = useRef<string | null>(null);

  useEffect(() => {
    getCategorias().then(setCategorias);
    getProductos().then(setProductos);
    getCarrusel().then((c) => setCarrusel(Array.isArray(c) ? c : [])).catch(() => {});
  }, []);

  function handleSelectCategoria(id: string | null) {
    if (id === categoriaSeleccionada) return;
    setCategoriaSeleccionada(id);
    setSubcategoriaSeleccionada(null);
    setSubcategorias([]);
    if (id) {
      fetch(`${API}/subcategorias/categoria/${id}`)
        .then(r => r.json())
        .then(setSubcategorias);
    } else {
      setSubcategorias([]);
    }
  }

  function handleSelectSubcategoria(id: string | null) {
    setSubcategoriaSeleccionada(id);
  }

  const cats = categorias.map((c: any) => ({
    id: String(c.id_categoria),
    name: c.nombre,
    image: c.imagen ?? null,
  }));

  const subcats = subcategorias.map((s: any) => ({
    id: String(s.id_subcategoria),
    name: s.nombre,
  }));

  const aProducto = (p: any) => ({
    id: String(p.id_producto),
    sku: p.codigo_sku,
    name: p.nombre,
    description: p.descripcion || '',
    imagenes: p.imagenes || [],
    precioDesde: p.precio_desde ?? null,
    variosPrecios: Boolean(p.varios_precios),
  });

  const prods = productos
    .filter((p: any) => {
      if (subcategoriaSeleccionada) return String(p.id_subcategoria) === subcategoriaSeleccionada;
      // Solo categoría elegida: productos de cualquiera de sus subcategorías
      if (categoriaSeleccionada) return subcategorias.some((s: any) => s.id_subcategoria === p.id_subcategoria);
      return true;
    })
    .map(aProducto);

  // Carrusel de la portada: el elegido en el admin o, si no hay, los productos sin filtrar.
  // No depende de la colección seleccionada, así la portada no cambia al filtrar el catálogo.
  const destacados = (carrusel.length > 0 ? carrusel : productos).map(aProducto);

  return (
    <HomePage
      products={prods}
      destacados={destacados}
      categories={cats}
      subcategories={subcats}
      selectedCategory={categoriaSeleccionada}
      selectedSubcategory={subcategoriaSeleccionada}
      onSelectCategory={handleSelectCategoria}
      onSelectSubcategory={handleSelectSubcategoria}
    />
  );
}