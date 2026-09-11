"use client"

import { useState, useEffect, type FormEvent } from "react"
import {
  KeyRound,
  Mail,
  Lock,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react"
import { forgotPasswordApi, verifyResetTokenApi, resetPasswordApi } from "@/lib/api-client"
import { cn } from "@/lib/utils"

type Step = "identifier" | "otp" | "newPassword" | "success"

type ForgotPasswordFlowProps = {
  onBackToLogin: () => void
}

export function ForgotPasswordFlow({ onBackToLogin }: ForgotPasswordFlowProps) {
  const [step, setStep] = useState<Step>("identifier")
  const [identifier, setIdentifier] = useState("")
  const [emailPreview, setEmailPreview] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 minutos (SCRUM-30)

  // Temporizador de vigencia del OTP de 15 minutos
  useEffect(() => {
    if (step !== "otp" && step !== "newPassword") return
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [step])

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Paso 1: Enviar solicitud de recuperación (HU4 - SCRUM-28)
  async function handleSendIdentifier(e: FormEvent) {
    e.preventDefault()
    if (!identifier.trim()) {
      setError("Por favor ingresa tu correo electrónico o número de DNI.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = (await forgotPasswordApi(identifier.trim())) as any
      setEmailPreview(res?.emailPreview || identifier.trim())
      // Si el backend devolvió devOtp en desarrollo
      if (res?.devOtp) {
        setOtpCode(res.devOtp)
      }
      setTimeLeft(15 * 60)
      setStep("otp")
    } catch (err: any) {
      setError(err?.message || "No se pudo procesar la solicitud. Inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  // Paso 2: Validar código OTP de 6 dígitos (HU4 - SCRUM-29)
  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault()
    if (otpCode.trim().length !== 6) {
      setError("El código de verificación debe tener exactamente 6 dígitos.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      await verifyResetTokenApi(identifier.trim(), otpCode.trim())
      setStep("newPassword")
    } catch (err: any) {
      setError(err?.message || "Código de verificación inválido o expirado.")
    } finally {
      setLoading(false)
    }
  }

  // Paso 3: Guardar nueva contraseña (HU4 - SCRUM-31/32)
  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden. Por favor verifícalas.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      await resetPasswordApi(identifier.trim(), otpCode.trim(), newPassword)
      setStep("success")
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar la contraseña.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen bg-brand-bg text-brand-text">
      {/* Columna Izquierda: Formulario interactivo */}
      <div className="flex w-full flex-col justify-center px-6 py-12 md:w-1/2 md:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={onBackToLogin}
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-brand-muted transition-colors duration-150 hover:text-brand-text"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio de sesión
          </button>

          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent/15 text-brand-accent">
              <KeyRound className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Recuperar contraseña</h1>
              <p className="text-xs text-brand-muted">Proceso seguro de validación bancaria</p>
            </div>
          </div>

          {/* PASO 1: Ingreso de correo o DNI */}
          {step === "identifier" && (
            <form onSubmit={handleSendIdentifier} className="flex flex-col gap-5" noValidate>
              <p className="text-sm leading-relaxed text-brand-muted">
                Ingresa tu correo electrónico registrado o número de DNI. Te enviaremos un código de seguridad de 6 dígitos.
              </p>

              <div className="flex flex-col gap-2">
                <label htmlFor="identifier" className="text-sm font-medium text-brand-light">
                  Correo electrónico o DNI
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-brand-muted" aria-hidden="true" />
                  <input
                    id="identifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="demo@peya.com o 48219032"
                    className="w-full rounded-xl border border-white/15 bg-brand-surface py-3 pl-10 pr-4 text-sm text-brand-text placeholder:text-brand-muted/60 outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-brand-negative/15 px-4 py-3 text-sm font-medium text-brand-negative">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-brand-accent px-4 py-3 text-sm font-bold text-brand-bg transition-colors duration-150 hover:bg-brand-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {loading ? "Enviando código..." : "Enviar código de seguridad"}
              </button>
            </form>
          )}

          {/* PASO 2: Ingreso de código OTP de 6 dígitos */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5" noValidate>
              <div className="rounded-xl border border-white/10 bg-brand-surface-2 p-4">
                <p className="text-sm text-brand-light">
                  Hemos generado un código de verificación para: <span className="font-semibold text-brand-accent">{emailPreview}</span>
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-brand-accent">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <span>Vigencia restante: {formatTimer(timeLeft)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="otpCode" className="text-sm font-medium text-brand-light">
                  Código de 6 dígitos
                </label>
                <input
                  id="otpCode"
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full tracking-widest text-center text-2xl font-bold rounded-xl border border-white/15 bg-brand-surface py-3 px-4 text-brand-accent placeholder:text-brand-muted/40 outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-brand-negative/15 px-4 py-3 text-sm font-medium text-brand-negative">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("identifier")}
                  className="btn-secondary flex-1"
                >
                  Cambiar correo
                </button>
                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6 || timeLeft === 0}
                  className="btn-primary flex-1 disabled:opacity-70"
                >
                  {loading ? "Validando..." : "Verificar código"}
                </button>
              </div>
            </form>
          )}

          {/* PASO 3: Restablecer nueva contraseña */}
          {step === "newPassword" && (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-5" noValidate>
              <p className="text-sm leading-relaxed text-brand-muted">
                Ingresa tu nueva contraseña para acceder a tu cuenta bancaria.
              </p>

              <div className="flex flex-col gap-2">
                <label htmlFor="newPassword" className="text-sm font-medium text-brand-light">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-brand-muted" aria-hidden="true" />
                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-xl border border-white/15 bg-brand-surface py-3 pl-10 pr-10 text-sm text-brand-text placeholder:text-brand-muted/60 outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-brand-muted hover:text-brand-text"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-brand-light">
                  Confirmar nueva contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-brand-muted" aria-hidden="true" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    className="w-full rounded-xl border border-white/15 bg-brand-surface py-3 pl-10 pr-4 text-sm text-brand-text placeholder:text-brand-muted/60 outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
                  />
                </div>
              </div>

              {newPassword && newPassword.length < 8 && (
                <p className="text-xs text-amber-400">⚠️ La contraseña debe tener al menos 8 caracteres.</p>
              )}
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-brand-negative">Las contraseñas no coinciden.</p>
              )}

              {error && (
                <p role="alert" className="rounded-xl bg-brand-negative/15 px-4 py-3 text-sm font-medium text-brand-negative">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {loading ? "Actualizando..." : "Guardar nueva contraseña"}
              </button>
            </form>
          )}

          {/* PASO 4: Éxito total */}
          {step === "success" && (
            <div className="rounded-2xl border border-brand-positive/30 bg-brand-surface p-8 text-center shadow-xl">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-positive/15 text-brand-positive">
                <CheckCircle2 className="h-12 w-12" strokeWidth={2.5} aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-xl font-bold text-brand-text">¡Contraseña restablecida!</h2>
              <p className="mt-2 text-sm text-brand-muted">
                Tu clave ha sido actualizada exitosamente en el sistema de Peya. Ahora puedes ingresar de forma segura.
              </p>
              <button
                type="button"
                onClick={onBackToLogin}
                className="btn-primary mt-6 w-full"
              >
                Iniciar sesión ahora
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Columna Derecha: Branding Corporativo */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-surface p-12 md:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-surface to-brand-bg" aria-hidden="true" />
        <div className="relative flex items-center gap-2 text-brand-accent">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          <span className="text-sm font-semibold">Seguridad Bancaria Cifrada</span>
        </div>
        <div className="relative">
          <KeyRound className="mb-6 h-16 w-16 text-brand-accent" aria-hidden="true" />
          <h2 className="max-w-sm text-3xl font-bold leading-tight text-balance">
            Protección y recuperación segura de tu cuenta.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-muted">
            Validamos cada solicitud con tokens criptográficos de un solo uso para proteger tus fondos e información personal.
          </p>
        </div>
        <div className="relative text-xs text-brand-muted">© {new Date().getFullYear()} Peya. Todos los derechos reservados.</div>
      </aside>
    </main>
  )
}
