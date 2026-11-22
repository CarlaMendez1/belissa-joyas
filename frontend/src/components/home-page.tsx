"use client"

import { useState } from "react"
import { Gem, Search, ShoppingBag, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useCarrito } from '@/context/carrito-context';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { LogOut, LayoutDashboard, Crown, MapPin, Package, Heart } from "lucide-react"
import BotonFavorito from "@/components/boton-favorito"
import HeroDinamico from "@/components/hero-dinamico"
import Revelar from "@/components/revelar"

type Category = {
  id: string
  name: string
}

type Product = {
  id: string
  sku: string
  name: string
  description: string
  imagenes?: string[]
  precioDesde?: number | null
  variosPrecios?: boolean
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
  const { setAbierto, totalItems } = useCarrito();
  const { data: session } = useSession();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const filteredProducts = products.filter((p) => {
  const coincideTexto = `${p.name} ${p.description} ${p.sku}`.toLowerCase().includes(query.toLowerCase());
  const coincideSubcat = selectedSubcategory ? p.id === selectedSubcategory : true;
  
  return coincideTexto && coincideSubcat;
});

  return (
    <div className="min-h-screen bg-milk font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <span className="font-serif text-2xl font-semibold text-espresso-brown">Belissa Joyas</span>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#inicio" className="text-sm text-stone-600 transition-colors hover:text-espresso-brown">
              Inicio
            </a>
            <a href="#catalogo" className="text-sm text-stone-600 transition-colors hover:text-espresso-brown">
              Catálogo
            </a>
            <a href="#nosotros" className="text-sm text-stone-600 transition-colors hover:text-espresso-brown">
              Nosotros
            </a>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                type="button"
                aria-label="Cuenta de usuario"
                onClick={() => setMenuAbierto((v) => !v)}
                className="flex items-center gap-2 text-stone-600 transition-colors hover:text-espresso-brown"
              >
                <User className="h-5 w-5" />
                {session?.user && (
                  <span className="hidden sm:inline text-sm">
                    {session.user.name}
                  </span>
                )}
              </button>

              {menuAbierto && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuAbierto(false)}
                  />
                  <div className="absolute right-0 mt-3 w-56 bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    {session?.user ? (
                      <>
                        <div className="px-4 py-3 border-b border-stone-100">
                          <p className="text-sm font-medium text-espresso-brown truncate">
                            {session.user.name}
                          </p>
                          <p className="text-xs text-stone-400 truncate">
                            {session.user.email}
                          </p>
                        </div>
                        {(session.user as any).role === 'administrador' && (
                          <Link
                            href="/admin"
                            onClick={() => setMenuAbierto(false)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-600 hover:bg-blush-oat/40 transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            Panel de administración
                          </Link>
                        )}
                                                <Link
                          href="/mi-cuenta"
                          onClick={() => setMenuAbierto(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-600 hover:bg-blush-oat/40 transition-colors"
                        >
                          <Crown className="w-4 h-4" />
                          Nivel VIP
                        </Link>
                                                <Link
                          href="/mi-cuenta/direcciones"
                          onClick={() => setMenuAbierto(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-600 hover:bg-blush-oat/40 transition-colors"
                        >
                          <MapPin className="w-4 h-4" />
                          Mi direccion
                        </Link>
                                                <Link
                          href="/mi-cuenta/pedidos"
                          onClick={() => setMenuAbierto(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-600 hover:bg-blush-oat/40 transition-colors"
                        >
                          <Package className="w-4 h-4" />
                          Mis pedidos
                        </Link>
                        <Link
                          href="/mi-cuenta/favoritos"
                          onClick={() => setMenuAbierto(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-600 hover:bg-blush-oat/40 transition-colors"
                        >
                          <Heart className="w-4 h-4" />
                          Mis favoritos
                        </Link>
                        <button
                          onClick={() => {
                            setMenuAbierto(false);
                            signOut({ callbackUrl: '/' });
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Cerrar sesión
                        </button>
                      </>
                    ) : (
                      <Link
                        href="/login"
                        onClick={() => setMenuAbierto(false)}
                        className="block px-4 py-2.5 text-sm text-stone-600 hover:bg-blush-oat/40 transition-colors"
                      >
                        Iniciar sesión
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>

            <button onClick={() => setAbierto(true)} className="relative">
              <ShoppingBag className="h-5 w-5 text-stone-600 hover:text-cocoa-taupe" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-cocoa-taupe text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </nav>
      </header>

      <main>
        <HeroDinamico products={products} />

        {/* Colecciones */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="text-center font-serif text-3xl font-semibold text-espresso-brown">
            Colecciones
          </h2>
          <p className="mt-3 text-center text-stone-500">
            Explorá nuestras categorías destacadas.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {categories.map((category, idx) => {
              const isSelected = selectedCategory === category.id
              return (
                <Revelar key={category.id} retraso={idx * 80}>
                <button
                  type="button"
                  onClick={() => onSelectCategory?.(isSelected ? null : category.id)}
                  className="text-left"
                >
                  <Card
                    className={`flex flex-col items-center gap-4 border-stone-200 p-8 text-center transition-colors hover:border-dusty-rose ${
                      isSelected ? "border-cocoa-taupe bg-cocoa-taupe text-stone-50" : "bg-white"
                    }`}
                  >
                    <Gem className={isSelected ? "h-8 w-8 text-stone-50" : "h-8 w-8 text-dusty-rose"} />
                    <span
                      className={`font-medium ${isSelected ? "text-white" : "text-espresso-brown"}`}
                    >
                      {category.name}
                    </span>
                  </Card>
                </button>
                </Revelar>
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
      ? 'bg-espresso-brown text-white border-espresso-brown'
      : 'bg-white text-stone-600 border-stone-300 hover:border-dusty-rose'}`}
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
            <h2 className="text-center font-serif text-3xl font-semibold text-espresso-brown">
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
            {filteredProducts.map((product, idx) => (
              <Revelar key={product.id} retraso={(idx % 3) * 100}>
              <Link href={`/productos/${product.id}`}>
                <Card className="overflow-hidden rounded-xl border-stone-200 bg-white p-0 transition-all hover:-translate-y-1 hover:border-dusty-rose hover:shadow-xl cursor-pointer">
                <div className="relative aspect-square bg-blush-oat/30">
  <BotonFavorito idProducto={Number(product.id)} className="absolute right-3 top-3 z-10" />
  {product.imagenes?.[0] ? (
    <Image
      src={product.imagenes[0]}
      alt={product.name}
      fill
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className="object-cover"
    />
  ) : (
    <div className="flex h-full items-center justify-center">
      <Gem className="h-12 w-12 text-dusty-rose" />
    </div>
  )}
</div>
                  <div className="flex flex-col gap-2 p-6">
                    <span className="font-mono text-xs text-dusty-rose">{product.sku}</span>
                    <h3 className="font-serif text-xl text-espresso-brown">{product.name}</h3>
                    <p className="text-sm leading-relaxed text-stone-500">{product.description}</p>
                        {product.precioDesde != null && (
                      <p className="font-sans text-lg font-semibold text-espresso-brown">
                        {product.variosPrecios && <span className="mr-1 text-sm font-normal text-stone-400">Desde</span>}
                        ${Math.round(product.precioDesde).toLocaleString('es-AR')}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      className="mt-4 border-stone-300 text-espresso-brown hover:bg-blush-oat/40 hover:text-espresso-brown"
                    >
                      Ver producto
                    </Button>
                  </div>
                </Card>
              </Link>
              </Revelar>
            ))}

          </div>

          {filteredProducts.length === 0 && (
            <p className="mt-12 text-center text-stone-500">No se encontraron productos.</p>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer id="nosotros" className="bg-espresso-brown">
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