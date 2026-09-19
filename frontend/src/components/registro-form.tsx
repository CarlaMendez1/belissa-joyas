"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Gem, User, Mail, Lock, Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RegistroForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const nombre = String(formData.get("nombre") ?? "")
    const apellido = String(formData.get("apellido") ?? "")
    const email = String(formData.get("email") ?? "")
    const password = String(formData.get("password") ?? "")
    const confirmPassword = String(formData.get("confirmPassword") ?? "")

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setError(null)
    setCargando(true)

    try {
      const res = await fetch(`${API}/auth/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, apellido, email, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        if (res.status === 409) {
          setError('Ese email ya está registrado.')
        } else {
          setError(data?.message || 'No se pudo completar el registro.')
        }
        setCargando(false)
        return
      }

      // Registro exitoso — iniciamos sesión automáticamente con las mismas credenciales
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        // El registro anduvo bien pero el auto-login falló; mandamos al login normal
        router.push('/login')
        return
      }

      router.push('/')
    } catch {
      setError('No se pudo conectar con el servidor. Intentá de nuevo.')
      setCargando(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-border/60 shadow-xl shadow-primary/5">
      <CardHeader className="items-center space-y-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
          <Gem className="size-7" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <CardTitle className="font-serif text-3xl font-medium tracking-tight">
            Belissa Joyas
          </CardTitle>
          <CardDescription className="text-pretty">
            Creá tu cuenta para descubrir nuestras joyas
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="nombre"
                  name="nombre"
                  type="text"
                  autoComplete="given-name"
                  required
                  placeholder="María"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apellido">Apellido</Label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="apellido"
                  name="apellido"
                  type="text"
                  autoComplete="family-name"
                  required
                  placeholder="González"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@email.com"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={6}
                required
                placeholder="••••••••"
                className="px-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <Eye className="size-4" aria-hidden="true" />
                ) : (
                  <EyeOff className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo 6 caracteres.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                minLength={6}
                required
                placeholder="••••••••"
                className="px-9"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={
                  showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showConfirm ? (
                  <Eye className="size-4" aria-hidden="true" />
                ) : (
                  <EyeOff className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={cargando}
            className="w-full"
            style={{ backgroundColor: "#574949" }}
          >
            {cargando ? 'Creando cuenta...' : 'Registrarse'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {"¿Ya tenés cuenta? "}
          <a
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Iniciá sesión
          </a>
        </p>
      </CardContent>
    </Card>
  )
}