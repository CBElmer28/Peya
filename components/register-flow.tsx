"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, ChevronLeft, Loader2, ShieldCheck, Sparkles, Camera, RefreshCw } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { lookupDniApi, registerApi, verifyFaceApi, loginApi } from "@/lib/api-client"
import { type DniData, type FaceVerifyResult, type Session } from "@/lib/mock-api"
import { cn } from "@/lib/utils"

type Step = 1 | 2 | 3 | 4

type RegisterFlowProps = {
  onBackToLogin: () => void
}

const STEPS = [
  { id: 1, label: "DNI" },
  { id: 2, label: "Verificación facial" },
  { id: 3, label: "Contacto" },
  { id: 4, label: "Resultado" },
] as const

function getFullName(data: DniData | null): string {
  if (!data) return ""
  return `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "U"
}

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="mb-8 flex items-center">
      {STEPS.map((currentStep, index) => {
        const done = step > currentStep.id
        const current = step === currentStep.id
        return (
          <li key={currentStep.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors duration-150",
                  done && "border-brand-accent bg-brand-accent text-brand-bg",
                  current && "border-brand-accent bg-transparent text-brand-accent",
                  !done && !current && "border-white/20 bg-transparent text-brand-muted",
                )}
              >
                {done ? <Check className="h-5 w-5" aria-hidden="true" /> : currentStep.id}
              </span>
              <span className={cn("text-xs font-medium", current || done ? "text-brand-text" : "text-brand-muted")}>
                {currentStep.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span
                className={cn("mx-2 h-0.5 flex-1 rounded transition-colors", step > currentStep.id ? "bg-brand-accent" : "bg-white/15")}
                aria-hidden="true"
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-brand-light">
        {label}
      </label>
      {children}
    </div>
  )
}

export function RegisterFlow({ onBackToLogin }: RegisterFlowProps) {
  const { setSession } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [dni, setDni] = useState("")
  const [dniData, setDniData] = useState<DniData | null>(null)
  const [dniLoading, setDniLoading] = useState(false)
  const [dniError, setDniError] = useState<string | null>(null)

  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null)
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null)
  const [verifyingFace, setVerifyingFace] = useState(false)
  const [faceResult, setFaceResult] = useState<FaceVerifyResult | null>(null)
  const [faceAttempts, setFaceAttempts] = useState(0)
  const [faceAnnounce, setFaceAnnounce] = useState("")

  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerOutcome, setRegisterOutcome] = useState<"success" | "error" | null>(null)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [pendingSession, setPendingSession] = useState<Session | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const fullName = getFullName(dniData)
  const normalizedPhone = phone.replace(/\D/g, '').replace(/^51/, '')
  const canContinueDni = Boolean(dniData)
  const canCreateAccount =
    Boolean(dniData) &&
    email.trim().length > 0 &&
    normalizedPhone.length === 9 &&
    password.length >= 8 &&
    password === confirmPassword &&
    acceptedTerms &&
    !registerLoading

  useEffect(() => {
    if (step !== 2) {
      stopCameraStream()
      return
    }

    return () => {
      stopCameraStream()
    }
  }, [step])

  useEffect(() => {
    if (step !== 3) return
    setContactError(null)
  }, [step])

  function stopCameraStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  async function handleDniLookup() {
    const value = dni.replace(/\D/g, "")
    if (value.length !== 8) {
      setDniError("No se encontró información para este DNI.")
      setDniData(null)
      return
    }

    setDniLoading(true)
    setDniError(null)
    try {
      const data = await lookupDniApi(value)
      setDniData(data)
      setDni(value)
    } catch {
      setDniData(null)
      setDniError("No se encontró información para este DNI.")
    } finally {
      setDniLoading(false)
    }
  }

  function handleSelfieUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setSelfieDataUrl(String(reader.result))
      setFaceResult(null)
      setFaceAnnounce("Imagen cargada. Puedes verificar tu identidad.")
    }
    reader.readAsDataURL(file)
    event.target.value = ""
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermissionError("Tu navegador no soporta acceso a cámara. Puedes subir una imagen desde tu equipo.")
      return
    }

    setCameraLoading(true)
    setCameraPermissionError(null)

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setCameraLoading(false)
      })
      .catch(() => {
        setCameraLoading(false)
        setCameraPermissionError("No pudimos acceder a tu cámara. Puedes subir una imagen desde tu equipo.")
      })
  }

  function captureSelfie() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return

    const context = canvas.getContext("2d")
    if (!context) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    setSelfieDataUrl(canvas.toDataURL("image/jpeg", 0.92))
    setFaceResult(null)
    setFaceAnnounce("")
  }

  async function handleVerifyFace() {
    if (!selfieDataUrl) return
    setVerifyingFace(true)
    setFaceAnnounce("Comparando con tu DNI...")
    try {
      const result = await verifyFaceApi(selfieDataUrl, dniData?.dni)
      setFaceResult(result)
      setFaceAnnounce(result.match ? "Identidad verificada" : "No pudimos verificar tu identidad")
      if (!result.match) {
        setFaceAttempts((attempts) => attempts + 1)
      }
    } finally {
      setVerifyingFace(false)
    }
  }

  async function handleCreateAccount() {
    if (!dniData) return

    const normalizedPhoneValue = phone.replace(/\D/g, '').replace(/^51/, '')

    if (normalizedPhoneValue.length !== 9) {
      setContactError("Ingresa un teléfono móvil peruano válido para continuar.")
      return
    }

    if (password.length < 8 || password !== confirmPassword || !acceptedTerms) {
      setContactError("Revisa la contraseña y confirma los términos para continuar.")
      return
    }

    setRegisterLoading(true)
    setRegisterError(null)
    try {
      await registerApi({
        dni: dniData.dni,
        name: fullName,
        email: email.trim(),
        phone: normalizedPhoneValue,
        password,
        selfieUrl: selfieDataUrl ?? undefined,
      })

      // Iniciar sesión con token real emitido por el backend
      try {
        const loginResult = await loginApi(email.trim(), password, true)
        setPendingSession({
          token: loginResult.accessToken,
          user: {
            name: loginResult.user.name || fullName,
            email: loginResult.user.email || email.trim(),
          },
        })
      } catch {
        setPendingSession({
          token: `jwt-${Date.now()}`,
          user: {
            name: fullName,
            email: email.trim(),
          },
        })
      }

      setRegisterOutcome("success")
      setStep(4)
    } catch (err: any) {
      setRegisterOutcome("error")
      setRegisterError(err?.message || "No pudimos crear tu cuenta")
      setStep(4)
    } finally {
      setRegisterLoading(false)
    }
  }

  function retryFacePermission() {
    setStep(2)
    startCamera()
  }

  function handleContinueWithoutVerification() {
    if (faceAttempts >= 2) {
      setStep(3)
    }
  }

  function resetToLogin() {
    stopCameraStream()
    onBackToLogin()
  }

  return (
    <main className="flex min-h-screen bg-brand-bg text-brand-text">
      <div className="flex w-full flex-col justify-center px-6 py-12 md:w-1/2 md:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={resetToLogin}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-brand-muted transition-colors duration-150 hover:text-brand-text"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Volver al login
          </button>

          <div className="mb-8 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-brand-accent" aria-hidden="true" />
            <span className="text-lg font-bold tracking-tight">Peya</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-balance md:text-3xl">Crear cuenta</h1>
          <p className="mt-2 text-sm text-brand-muted">Completa tu registro con verificación de identidad.</p>

          <Stepper step={step} />

          {step === 1 && (
            <div className="rounded-xl border border-white/10 bg-brand-surface p-6 shadow-lg">
              <div className="space-y-5">
                <Field label="Número de DNI" htmlFor="dni">
                  <input
                    id="dni"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={dni}
                    onChange={(event) => setDni(event.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="8 dígitos"
                    className="input-base"
                  />
                </Field>

                <button
                  type="button"
                  onClick={handleDniLookup}
                  disabled={dniLoading || dni.replace(/\D/g, "").length !== 8}
                  className="btn-primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {dniLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Consultando...
                    </>
                  ) : (
                    "Buscar en RENIEC"
                  )}
                </button>

                {dniError && (
                  <p role="alert" className="rounded-xl bg-brand-negative/15 px-4 py-3 text-sm font-medium text-brand-negative">
                    No se encontró información para este DNI.
                  </p>
                )}

                {dniData ? (
                  <div className="rounded-xl border border-white/10 bg-brand-surface-2 p-4">
                    <div className="flex items-center gap-2 text-brand-positive">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <p className="text-sm font-semibold">Datos verificados con RENIEC</p>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <ReadOnlyField label="Nombres" value={dniData.nombres} />
                      <ReadOnlyField label="Apellidos" value={`${dniData.apellidoPaterno} ${dniData.apellidoMaterno}`} />
                      <ReadOnlyField label="Fecha de nacimiento" value={dniData.fechaNacimiento} />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex gap-3">
                <button type="button" onClick={resetToLogin} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="button" onClick={() => setStep(2)} disabled={!canContinueDni} className="btn-primary flex-1 disabled:opacity-70">
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="rounded-xl border border-white/10 bg-brand-surface p-6 shadow-lg">
              <p className="text-sm leading-relaxed text-brand-muted">
                Para tu seguridad, necesitamos verificar que eres tú. Puedes subir una foto de tu rostro desde tu equipo o usar tu cámara si está disponible.
              </p>

              <div className="mt-5 space-y-4">
                <div className="flex w-full flex-col gap-3 sm:flex-row">
                  <label className="btn-secondary flex flex-1 cursor-pointer items-center justify-center">
                    Subir imagen
                    <input type="file" accept="image/*" onChange={handleSelfieUpload} className="hidden" />
                  </label>
                  <button type="button" onClick={startCamera} disabled={cameraLoading} className="btn-secondary flex-1 disabled:opacity-70">
                    {cameraLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Activando cámara...
                      </span>
                    ) : (
                      "Usar cámara"
                    )}
                  </button>
                </div>

                {cameraPermissionError ? (
                  <div className="rounded-xl border border-brand-negative/20 bg-brand-negative/10 p-4">
                    <p className="text-sm font-medium text-brand-negative">{cameraPermissionError}</p>
                    <button type="button" onClick={retryFacePermission} className="mt-4 btn-secondary">
                      Reintentar cámara
                    </button>
                  </div>
                ) : null}

                <div className="flex flex-col items-center gap-4">
                  <div className="relative flex w-full max-w-sm items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-brand-bg/60 p-3">
                    <div className="relative aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/70">
                      {selfieDataUrl ? (
                        <img src={selfieDataUrl} alt="Selfie capturada" className="h-full w-full object-cover" />
                      ) : cameraLoading ? (
                        <div className="flex h-full items-center justify-center text-brand-muted">
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Activando cámara...
                          </span>
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-brand-muted">
                          {videoRef.current?.srcObject ? "Previsualización de cámara" : "Sube una imagen o usa la cámara para continuar"}
                        </div>
                      )}

                      {streamRef.current ? (
                        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
                      ) : null}

                      <div className="pointer-events-none absolute inset-4 rounded-[1.5rem] border border-brand-accent/60" aria-hidden="true" />
                      <div className="pointer-events-none absolute inset-x-0 top-4 text-center text-xs font-medium text-brand-accent">
                        Encadra tu rostro
                      </div>
                    </div>
                  </div>

                  <canvas ref={canvasRef} className="hidden" />

                  <div className="flex w-full flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={captureSelfie} disabled={!streamRef.current || cameraLoading} className="btn-secondary flex-1 disabled:opacity-70">
                      Capturar foto
                    </button>
                    <button type="button" onClick={handleVerifyFace} disabled={!selfieDataUrl || verifyingFace} className="btn-primary flex-1 disabled:opacity-70">
                      {verifyingFace ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Comparando con tu DNI...
                        </span>
                      ) : (
                        "Verificar identidad"
                      )}
                    </button>
                  </div>

                  {selfieDataUrl ? (
                    <button
                      type="button"
                      onClick={() => setSelfieDataUrl(null)}
                      className="inline-flex items-center gap-2 text-sm font-medium text-brand-muted transition-colors duration-150 hover:text-brand-text"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Cambiar imagen
                    </button>
                  ) : null}
                </div>

                <p aria-live="polite" className="min-h-5 text-sm text-brand-muted">
                  {faceAnnounce}
                </p>

                {faceResult?.match ? (
                  <div className="rounded-xl border border-brand-positive/20 bg-brand-positive/10 p-4">
                    <div className="flex items-center gap-2 text-brand-positive">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <p className="text-sm font-semibold">Identidad verificada</p>
                    </div>
                    <p className="mt-1 text-sm text-brand-light">Confianza: {Math.round(faceResult.confidence * 100)}%</p>
                    <button type="button" onClick={() => setStep(3)} className="btn-primary mt-4 w-full">
                      Continuar
                    </button>
                  </div>
                ) : null}

                {faceResult && !faceResult.match ? (
                  <div className="rounded-xl border border-brand-negative/20 bg-brand-negative/10 p-4">
                    <div className="flex items-center gap-2 text-brand-negative">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      <p className="text-sm font-semibold">No pudimos verificar tu identidad</p>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button type="button" onClick={() => setFaceResult(null)} className="btn-secondary flex-1">
                        Reintentar
                      </button>
                      <button
                        type="button"
                        onClick={handleContinueWithoutVerification}
                        disabled={faceAttempts < 2}
                        className="btn-primary flex-1 disabled:opacity-70"
                      >
                        Continuar sin verificar
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-brand-muted">Intentos fallidos: {faceAttempts}/2</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="rounded-xl border border-white/10 bg-brand-surface p-6 shadow-lg">
              <div className="rounded-xl border border-white/10 bg-brand-surface-2 p-4">
                <div className="flex items-center gap-2 text-brand-positive">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <p className="text-sm font-semibold">Datos verificados</p>
                </div>
                <p className="mt-2 text-sm text-brand-light">{fullName}</p>
                <p className="text-xs text-brand-muted">DNI {dniData?.dni}</p>
              </div>

              <div className="mt-5 space-y-4">
                <Field label="Correo electrónico" htmlFor="email">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="correo@peya.com"
                    className="input-base"
                  />
                </Field>

                <Field label="Teléfono" htmlFor="phone">
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+51 9XX XXX XXX"
                    className="input-base"
                  />
                </Field>

                <Field label="Contraseña" htmlFor="password">
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="input-base"
                  />
                </Field>

                <Field label="Confirmar contraseña" htmlFor="confirm-password">
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repite tu contraseña"
                    className="input-base"
                  />
                </Field>

                {password && password.length < 8 ? (
                  <p role="alert" className="rounded-xl bg-brand-negative/15 px-4 py-3 text-sm font-medium text-brand-negative">
                    La contraseña debe tener al menos 8 caracteres.
                  </p>
                ) : null}

                {password && confirmPassword && password !== confirmPassword ? (
                  <p role="alert" className="rounded-xl bg-brand-negative/15 px-4 py-3 text-sm font-medium text-brand-negative">
                    Las contraseñas no coinciden.
                  </p>
                ) : null}

                <label className="flex items-start gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-brand-light">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-brand-bg text-brand-accent focus:ring-brand-accent/40"
                  />
                  <span>
                    Acepto los Términos y Condiciones y la Política de Privacidad
                  </span>
                </label>

                {contactError ? (
                  <p role="alert" className="rounded-xl bg-brand-negative/15 px-4 py-3 text-sm font-medium text-brand-negative">
                    {contactError}
                  </p>
                ) : null}
              </div>

              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1">
                  Atrás
                </button>
                <button type="button" onClick={() => void handleCreateAccount()} disabled={!canCreateAccount} className="btn-primary flex-1 disabled:opacity-70">
                  {registerLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Creando cuenta...
                    </span>
                  ) : (
                    "Crear cuenta"
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 4 && registerOutcome === "success" && (
            <div className="rounded-xl border border-white/10 bg-brand-surface p-8 text-center shadow-lg">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-positive/15">
                <Check className="h-11 w-11 text-brand-positive" strokeWidth={3} aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-xl font-bold text-brand-text">¡Tu cuenta ha sido creada!</h2>
              <p className="mt-2 text-sm text-brand-muted">Bienvenido a Peya, {dniData?.nombres}</p>
              <button type="button" onClick={() => pendingSession && setSession(pendingSession)} className="btn-primary mt-6 w-full">
                Ir a mi dashboard
              </button>
            </div>
          )}

          {step === 4 && registerOutcome === "error" && (
            <div className="rounded-xl border border-white/10 bg-brand-surface p-8 text-center shadow-lg">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-negative/15">
                <AlertTriangle className="h-11 w-11 text-brand-negative" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-xl font-bold text-brand-text">No pudimos crear tu cuenta</h2>
              <p className="mt-2 text-sm text-brand-muted">Inténtalo nuevamente en unos segundos.</p>
              <button type="button" onClick={() => setStep(3)} className="btn-primary mt-6 w-full">
                Reintentar
              </button>
            </div>
          )}

          {registerError && registerOutcome === "error" ? (
            <p className="sr-only" aria-live="polite">
              {registerError}
            </p>
          ) : null}
        </div>
      </div>

      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-surface p-12 md:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-surface to-brand-bg" aria-hidden="true" />
        <div className="relative flex items-center gap-2 text-brand-accent">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          <span className="text-sm font-semibold">Banca protegida de extremo a extremo</span>
        </div>
        <div className="relative">
          <Camera className="mb-6 h-16 w-16 text-brand-accent" aria-hidden="true" />
          <h2 className="max-w-sm text-3xl font-bold leading-tight text-balance">
            Abre tu cuenta en minutos con una verificación segura.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-muted">
            Confirmamos tu identidad con RENIEC, rostro y tus datos de contacto para darte acceso inmediato.
          </p>
        </div>
        <div className="relative text-xs text-brand-muted">© {new Date().getFullYear()} Peya. Todos los derechos reservados.</div>
      </aside>
    </main>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-brand-text">{value}</p>
    </div>
  )
}
