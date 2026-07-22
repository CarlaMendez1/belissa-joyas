
"use client"

import { useState } from "react"
import { Gem, Search, ShoppingBag, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

type Category = {
  id: string
  name: string
}

type Product = {
  id: string
  sku: string
  name: string
  description: string
}

type Subcategory = {
  id: string
  name: string
}

type HomePageProps = {
  products?: Product[]
  categories?: Category[]
  subcategories?: Subcategory[]
  selectedCategory?: string | null
  selectedSubcategory?: string | null
  onSelectCategory?: (id: string | null) => void
  onSelectSubcategory?: (id: string | null) => void
}

export default function HomePage({
  products = [],
  categories = [],
  subcategories = [],
  selectedCategory = null,
  selectedSubcategory = null,
  onSelectCategory,
  onSelectSubcategory,
}: HomePageProps) {
  const [query, setQuery] = useState("")


  const filteredProducts = products.filter((p) => {
  const coincideTexto = `${p.name} ${p.description} ${p.sku}`.toLowerCase().includes(query.toLowerCase());
  const coincideSubcat = selectedSubcategory ? p.id === selectedSubcategory : true;

  return coincideTexto && coincideSubcat;
});

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <span className="font-serif text-2xl font-semibold text-stone-800">Belissa Joyas</span>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#inicio" className="text-sm text-stone-600 transition-colors hover:text-stone-900">
              Inicio
            </a>
            <a href="#catalogo" className="text-sm text-stone-600 transition-colors hover:text-stone-900">
              Catálogo
            </a>
            <a href="#nosotros" className="text-sm text-stone-600 transition-colors hover:text-stone-900">
              Nosotros
            </a>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Cuenta de usuario"
              className="text-stone-600 transition-colors hover:text-stone-900"
            >
              <User className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Carrito de compras"
              className="text-stone-600 transition-colors hover:text-stone-900"
            >
              <ShoppingBag className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section
          id="inicio"
          className="bg-stone-100"
        >
          <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
            <p className="text-sm font-medium uppercase tracking-widest text-stone-500">
              Joyería de lujo
            </p>
            <h1 className="mt-4 text-balance font-serif text-5xl font-semibold text-stone-800 md:text-6xl">
              Elevá tu elegancia
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-stone-500">
              Descubrí joyas atemporales perfectas para cualquier ocasión, diseñadas para
              acompañar tus momentos más especiales.
            </p>
            <div className="mt-10">
              <Button
                size="lg"
                className="rounded-full bg-stone-700 px-8 text-stone-50 hover:bg-stone-800"
                asChild
              >
                <a href="#catalogo">Ver catálogo</a>
              </Button>
            </div>
          </div>
        </section>

        {/* Colecciones */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="text-center font-serif text-3xl font-semibold text-stone-800">
            Colecciones
          </h2>
          <p className="mt-3 text-center text-stone-500">
            Explorá nuestras categorías destacadas.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {categories.map((category) => {
              const isSelected = selectedCategory === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onSelectCategory?.(isSelected ? null : category.id)}
                  className="text-left"
                >
  
        
                  <Card
                    className={`flex flex-col items-center gap-4 border-stone-200 p-8 text-center transition-colors hover:border-stone-400 ${
                      isSelected ? "border-stone-700 bg-stone-700 text-stone-50" : "bg-white"
                    }`}
                  >
                    <Gem className={isSelected ? "h-8 w-8 text-stone-50" : "h-8 w-8 text-stone-500"} />
                    <span
                      className={`font-medium ${isSelected ? "text-white" : "text-stone-700"}`}
                    >
                      {category.name}
                    </span>
                  </Card>
                </button>
              )
            })}
          </div>
          {subcategories.length > 0 && (
  <div className="mt-6 flex flex-wrap gap-3 justify-center">
    {subcategories.map((sub) => {
      const isSelected = selectedSubcategory === sub.id
      return (
        <button
  key={sub.id}
  type="button"
  onClick={() => {
    onSelectSubcategory?.(isSelected ? null : sub.id);
    if (!isSelected) {
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
    }
  }}
  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors
    ${isSelected
      ? 'bg-stone-700 text-white border-stone-700'
      : 'bg-white text-stone-600 border-stone-300 hover:border-stone-500'}`}
>
  {sub.name}
</button>
      )
      
 

    })}
  </div>
)}
        </section>
      
        {/* Catálogo */}
        <section id="catalogo" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8">
            <h2 className="text-center font-serif text-3xl font-semibold text-stone-800">
              Catálogo
            </h2>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar productos..."
                className="border-stone-200 bg-white pl-9 text-stone-700 placeholder:text-stone-400"
                aria-label="Buscar productos"
              />
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="overflow-hidden rounded-xl border-stone-200 bg-white p-0 transition-all hover:border-stone-400 hover:shadow-md"
              >
                <div className="flex h-48 items-center justify-center bg-stone-100">
                  <Gem className="h-12 w-12 text-stone-500" />
                </div>
                <div className="flex flex-col gap-2 p-6">
                  <span className="font-mono text-xs text-stone-500">{product.sku}</span>
                  <h3 className="font-serif text-xl text-stone-800">{product.name}</h3>
                  <p className="text-sm leading-relaxed text-stone-500">{product.description}</p>
                  <Button
                    variant="outline"
                    className="mt-4 border-stone-300 text-stone-700 hover:bg-stone-100 hover:text-stone-900"
                  >
                    Ver producto
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <p className="mt-12 text-center text-stone-500">No se encontraron productos.</p>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer id="nosotros" className="bg-stone-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-12 text-center sm:px-6 lg:px-8">
          <span className="font-serif text-2xl font-semibold text-stone-200">Belissa Joyas</span>
          <p className="text-sm text-stone-400">
            Joyería de lujo atemporal para cualquier ocasión.
          </p>
          <p className="text-sm text-stone-400">
            © {new Date().getFullYear()} Belissa Joyas. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
