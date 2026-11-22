"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Gem } from "lucide-react"

type ProductoDestacado = {
  id: string
  name: string
  imagenes?: string[]
  precioDesde?: number | null
  variosPrecios?: boolean
}

const MAX_TARJETAS = 7

/** Inicio animado: texto que aparece escalonado, formas flotantes y carrusel 3D de productos. */
export default function HeroDinamico({ products }: { products: ProductoDestacado[] }) {
  const destacados = products.filter((p) => p.imagenes?.[0]).slice(0, MAX_TARJETAS)
  const total = destacados.length
  const [activo, setActivo] = useState(0)
  const [pausado, setPausado] = useState(false)

  const mover = useCallback(
    (paso: number) => setActivo((a) => (total ? (a + paso + total) % total : 0)),
    [total],
  )

  useEffect(() => {
    if (pausado || total < 2) return
    const id = setInterval(() => mover(1), 3800)
    return () => clearInterval(id)
  }, [pausado, total, mover])

  return (
    <section id="inicio" className="relative overflow-hidden bg-gradient-to-b from-blush-oat/60 via-blush-oat/30 to-milk">
      {/* Formas flotantes de fondo */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="anim-flotar absolute -left-24 top-10 h-72 w-72 rounded-full bg-dusty-rose/25 blur-3xl" />
        <div
          className="anim-flotar absolute -right-20 top-40 h-80 w-80 rounded-full bg-cocoa-taupe/15 blur-3xl"
          style={{ animationDelay: "-4s" }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 text-center sm:px-6 lg:px-8">
        <p className="anim-aparecer text-sm font-medium uppercase tracking-[0.3em] text-dusty-rose">
          Joyería de lujo
        </p>
        <h1
          className="anim-aparecer mt-4 text-balance font-serif text-5xl font-semibold md:text-7xl"
          style={{ animationDelay: "0.15s" }}
        >
          <span className="texto-brillo">Elevá tu elegancia</span>
        </h1>
        <div className="anim-aparecer mt-10" style={{ animationDelay: "0.3s" }}>
          <a
            href="#catalogo"
            className="inline-block rounded-full bg-espresso-brown px-8 py-3 text-sm font-medium text-stone-50 shadow-lg shadow-espresso-brown/20 transition-all hover:-translate-y-0.5 hover:bg-cocoa-taupe"
          >
            Ver catálogo
          </a>
        </div>

        {/* Carrusel 3D */}
        {total > 0 && (
          <div
            className="anim-aparecer relative mx-auto mt-12 h-[26rem] max-w-5xl"
            style={{ animationDelay: "0.6s", perspective: "1400px" }}
            onMouseEnter={() => setPausado(true)}
            onMouseLeave={() => setPausado(false)}
            role="region"
            aria-label="Productos destacados"
          >
            {destacados.map((p, i) => {
              let desfase = i - activo
              if (desfase > total / 2) desfase -= total
              if (desfase < -total / 2) desfase += total
              const dist = Math.abs(desfase)
              const visible = dist <= 2
              const central = desfase === 0
              const tarjeta = (
                <div
                  className={`relative h-80 w-56 overflow-hidden rounded-2xl border bg-white shadow-xl sm:w-64 ${
                    central ? "border-dusty-rose shadow-espresso-brown/25" : "border-white/70"
                  }`}
                >
                  <Image
                    src={p.imagenes![0]}
                    alt={p.name}
                    fill
                    sizes="256px"
                    className="object-cover"
                    priority={central}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-espresso-brown/85 to-transparent p-4 text-left text-stone-50">
                    <p className="truncate font-serif text-lg">{p.name}</p>
                    {p.precioDesde != null && (
                      <p className="text-sm text-stone-200">
                        {p.variosPrecios && "Desde "}${Math.round(p.precioDesde).toLocaleString("es-AR")}
                      </p>
                    )}
                  </div>
                </div>
              )
              return (
                <div
                  key={p.id}
                  className="absolute left-1/2 top-1/2 transition-all duration-700 ease-out"
                  style={{
                    transform: `translate(-50%, -50%) translateX(${desfase * 58}%) translateZ(${-dist * 140}px) rotateY(${-desfase * 32}deg) scale(${central ? 1.08 : 1})`,
                    opacity: visible ? 1 - dist * 0.25 : 0,
                    zIndex: 10 - dist,
                    pointerEvents: visible ? "auto" : "none",
                  }}
                >
                  {central ? (
                    <Link href={`/productos/${p.id}`} aria-label={`Ver ${p.name}`}>
                      {tarjeta}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActivo(i)}
                      aria-label={`Mostrar ${p.name}`}
                      tabIndex={visible ? 0 : -1}
                    >
                      {tarjeta}
                    </button>
                  )}
                </div>
              )
            })}

            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => mover(-1)}
                  aria-label="Anterior"
                  className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/80 p-2 text-espresso-brown shadow transition-colors hover:bg-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(1)}
                  aria-label="Siguiente"
                  className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/80 p-2 text-espresso-brown shadow transition-colors hover:bg-white"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center gap-2">
                  {destacados.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActivo(i)}
                      aria-label={`Ir a ${p.name}`}
                      className={`h-2 rounded-full transition-all ${
                        i === activo ? "w-6 bg-cocoa-taupe" : "w-2 bg-dusty-rose/50"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {total === 0 && (
          <Gem className="anim-flotar mx-auto mt-12 h-12 w-12 text-dusty-rose" aria-hidden />
        )}
      </div>
    </section>
  )
}
