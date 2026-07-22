'use client';
import { useEffect, useState, useRef } from 'react';
import { getCategorias, getProductos } from '@/lib/api';
import HomePage from '@/components/home-page';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Page() {
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [subcategorias, setSubcategorias] = useState<any[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);
  const [subcategoriaSeleccionada, setSubcategoriaSeleccionada] = useState<string | null>(null);
  const prevCategoriaRef = useRef<string | null>(null);

  useEffect(() => {
    getCategorias().then(setCategorias);
    getProductos().then(setProductos);
  }, []);

  function handleSelectCategoria(id: string | null) {
    if (id === categoriaSeleccionada) return;
    setCategoriaSeleccionada(id);
    setSubcategoriaSeleccionada(null);
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
  }));

  const subcats = subcategorias.map((s: any) => ({
    id: String(s.id_subcategoria),
    name: s.nombre,
  }));

  const prods = productos.map((p: any) => ({
  id: String(p.id_subcategoria),
  sku: p.codigo_sku,
  name: p.nombre,
  description: p.descripcion || '',
}));

 
  return (
    <HomePage
      products={prods}
      categories={cats}
      subcategories={subcats}
      selectedCategory={categoriaSeleccionada}
      selectedSubcategory={subcategoriaSeleccionada}
      onSelectCategory={handleSelectCategoria}
      onSelectSubcategory={handleSelectSubcategoria}
    />
  );
}