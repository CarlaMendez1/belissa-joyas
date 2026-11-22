"use client"

import { useEffect, useRef, useState } from "react"

/** Descripción de 2 líneas; si es más larga aparece "Ver más" para desplegarla. */
export default function DescripcionExpandible({ texto }: { texto?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [abierta, setAbierta] = useState(false)
  const [recortada, setRecortada] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (el && !abierta) setRecortada(el.scrollHeight > el.clientHeight + 1)
  }, [texto, abierta])

  if (!texto) return null

  return (
    <div>
      <p
        ref={ref}
        className={`text-sm leading-relaxed text-stone-500 ${abierta ? "" : "line-clamp-2"}`}
      >
        {texto}
      </p>
      {(recortada || abierta) && (
        <button
          type="button"
          onClick={(e) => {
            // La tarjeta entera es un enlace: acá solo se despliega el texto
            e.preventDefault()
            e.stopPropagation()
            setAbierta((a) => !a)
          }}
          className="mt-1 text-sm font-medium text-cocoa-taupe hover:text-espresso-brown hover:underline"
        >
          {abierta ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  )
}
