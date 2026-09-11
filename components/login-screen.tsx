"use client"

import { useState, type FormEvent } from "react"
import { Landmark, Loader2, ShieldCheck, Lock, Mail, KeyRound } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { RegisterFlow } from "@/components/register-flow"
import { ForgotPasswordFlow } from "@/components/forgot-password-flow"

export function LoginScreen() {
  const { signIn } = useAuth()
  const [showRegister, setShowRegister] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password, rememberMe)
    } catch (err: any) {
      const msg = err?.message || err?.body?.message || "Acceso denegado (401): correo o contraseña incorrectos."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (showRegister) {
    return <RegisterFlow onBackToLogin={() => setShowRegister(false)} />
  }

  if (showForgotPassword) {
    return <ForgotPasswordFlow onBackToLogin={() => setShowForgotPassword(false)} />
  }

  return (
    <main className="flex min-h-screen bg-brand-bg text-brand-text">
      {/* Columna izquierda: formulario */}
      <div className="flex w-full flex-col justify-center px-6 py-12 md:w-1/2 md:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-2">
            <Landmark className="h-7 w-7 text-brand-accent" aria-hidden="true" />
            <span className="text-lg font-bold tracking-tight">Peya</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-balance md:text-3xl">Inicia sesión</h1>
          <p className="mt-2 text-sm text-brand-muted">Accede a tu banca en línea de forma segura.</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-brand-light">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-brand-muted" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo@peya.com"
                  className="w-full rounded-xl border border-white/15 bg-brand-surface py-3 pl-10 pr-4 text-sm text-brand-text placeholder:text-brand-muted/60 outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-brand-light">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs font-semibold text-brand-accent transition-colors hover:text-brand-accent-hover hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-brand-muted" aria-hidden="true" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full rounded-xl border border-white/15 bg-brand-surface py-3 pl-10 pr-4 text-sm text-brand-text placeholder:text-brand-muted/60 outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-brand-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-brand-surface text-brand-accent focus:ring-brand-accent/40"
              />
              <span>Recordar mi sesión en este dispositivo (30 días)</span>
            </label>

            {error && (
              <div role="alert" className="rounded-xl border border-brand-negative/30 bg-brand-negative/15 px-4 py-3 text-sm font-medium text-brand-negative">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-brand-accent px-4 py-3 text-sm font-bold text-brand-bg transition-colors duration-150 hover:bg-brand-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {loading ? "Verificando credenciales..." : "Ingresar"}
            </button>

            <p className="text-sm text-brand-muted">
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => setShowRegister(true)}
                className="font-semibold text-brand-accent transition-colors duration-150 hover:text-brand-accent-hover hover:underline"
              >
                Crear cuenta
              </button>
            </p>

            <div className="rounded-xl border border-white/10 bg-brand-surface-2 p-3 text-xs text-brand-muted">
              <span className="font-semibold text-brand-light">Acceso Demo:</span> demo@peya.com / 123456
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
        <div className="relative text-xs text-brand-muted">© {new Date().getFullYear()} Peya. Todos los derechos reservados.</div>
      </aside>
    </main>
  )
}
