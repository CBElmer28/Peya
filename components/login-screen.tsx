"use client"

import { useState, type FormEvent } from "react"
import { Landmark, Loader2, ShieldCheck, Eye, EyeOff, Lock, Mail, AlertCircle } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { RegisterFlow } from "@/components/register-flow"
import { cn } from "@/lib/utils"

export function LoginScreen() {
  const { signIn } = useAuth()
  const [showRegister, setShowRegister] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState(false)

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canSubmit = isEmailValid && password.trim().length > 0 && !loading

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setForgotPasswordNotice(false)

    if (!isEmailValid) {
      setError("Por favor ingresa un formato de correo electrónico válido.")
      return
    }

    if (!password.trim()) {
      setError("Por favor ingresa tu contraseña.")
      return
    }

    setLoading(true)
    try {
      // Delega en el auth-service simulado a través del contexto y persiste la sesión según rememberMe.
      await signIn(email, password, rememberMe)
    } catch (err) {
      // El auth-service devuelve 401 cuando las credenciales son inválidas.
      const is401 = err instanceof Error && err.message === "401"
      setError(
        is401
          ? "Acceso denegado (401): correo o contraseña incorrectos. Verifica tus datos e inténtalo nuevamente."
          : "No se pudo conectar con el servidor de autenticación.",
      )
    } finally {
      setLoading(false)
    }
  }

  if (showRegister) {
    return <RegisterFlow onBackToLogin={() => setShowRegister(false)} />
  }

  return (
    <main className="flex min-h-screen bg-brand-bg text-brand-text">
      {/* Columna izquierda: formulario */}
      <div className="flex w-full flex-col justify-center px-6 py-12 md:w-1/2 md:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent text-brand-bg shadow-md shadow-brand-accent/20">
              <Landmark className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="text-xl font-bold tracking-tight text-brand-text">BankHub</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-balance md:text-3xl text-brand-text">Inicia sesión</h1>
          <p className="mt-2 text-sm text-brand-muted">Accede a tu banca en línea de forma rápida y protegida.</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-brand-light">
                Correo electrónico
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError(null)
                  }}
                  placeholder="demo@bankhub.com"
                  className={cn(
                    "w-full rounded-xl border border-white/15 bg-brand-surface px-4 py-3 pl-11 text-sm text-brand-text placeholder:text-brand-muted/60 outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30",
                    email && !isEmailValid && "border-brand-negative focus:border-brand-negative focus:ring-brand-negative/30",
                  )}
                />
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
              </div>
              {email && !isEmailValid ? (
                <p className="text-xs text-brand-negative">Formato de correo no válido (ej. usuario@dominio.com)</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-brand-light">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setForgotPasswordNotice(true)}
                  className="text-xs font-semibold text-brand-accent transition-colors hover:text-brand-accent-hover"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(null)
                  }}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/15 bg-brand-surface px-4 py-3 pl-11 pr-11 text-sm text-brand-text placeholder:text-brand-muted/60 outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
                />
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted transition-colors hover:text-brand-text"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {forgotPasswordNotice ? (
              <div className="rounded-xl border border-brand-accent/30 bg-brand-accent/10 p-3 text-xs text-brand-light leading-relaxed">
                ℹ️ Para recuperar tu contraseña, utiliza el flujo de recuperación (HU4) o comunícate con soporte de BankHub.
              </div>
            ) : null}

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none text-brand-light/90">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-brand-surface text-brand-accent focus:ring-brand-accent/40"
                />
                <span className="text-xs">Recordar sesión en este equipo</span>
              </label>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-brand-negative/30 bg-brand-negative/15 p-3.5 text-xs font-medium text-brand-negative leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-brand-accent px-4 py-3 text-sm font-bold text-brand-bg transition-all duration-150 hover:bg-brand-accent-hover hover:shadow-lg hover:shadow-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {loading ? "Verificando credenciales..." : "Ingresar"}
            </button>

            <p className="text-sm text-center text-brand-muted">
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => setShowRegister(true)}
                className="font-semibold text-brand-accent transition-colors duration-150 hover:text-brand-accent-hover"
              >
                Crear cuenta
              </button>
            </p>

            <div className="rounded-xl border border-white/10 bg-brand-surface-2/40 p-3 text-center">
              <p className="text-xs text-brand-muted">
                Credenciales Demo: <span className="font-semibold text-brand-light">demo@bankhub.com</span> /{" "}
                <span className="font-semibold text-brand-light">123456</span>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Columna derecha: espacio corporativo / marca */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-surface p-12 md:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-surface to-brand-bg" aria-hidden="true" />
        <div className="relative flex items-center gap-2 text-brand-accent">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          <span className="text-sm font-semibold">Banca protegida de extremo a extremo</span>
        </div>
        <div className="relative">
          <Landmark className="mb-6 h-16 w-16 text-brand-accent" aria-hidden="true" />
          <h2 className="max-w-sm text-3xl font-bold leading-tight text-balance">
            Gestiona tus cuentas, movimientos y ahorros en un solo lugar.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-muted">
            Una plataforma financiera moderna diseñada para darte control total sobre tu dinero.
          </p>
        </div>
        <div className="relative text-xs text-brand-muted">© {new Date().getFullYear()} BankHub. Todos los derechos reservados.</div>
      </aside>
    </main>
  )
}
