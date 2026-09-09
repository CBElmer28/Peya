"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { AlertTriangle, Check, ChevronLeft, Loader2, ShieldCheck, Sparkles, Camera, RefreshCw, Upload, Image as ImageIcon, ArrowRight, UserCheck } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { lookupDniApi as lookupDni, registerApi as registerUser, verifyFaceApi as verifyFace, checkDniApi, checkEmailApi } from "@/lib/api-client"
import { isDniRegistered, isEmailRegistered, type DniData, type FaceVerifyResult, type Session } from "@/lib/mock-api"
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
  const [dniAlreadyExists, setDniAlreadyExists] = useState(false)

  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null)
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null)
  const [verifyingFace, setVerifyingFace] = useState(false)
  const [faceResult, setFaceResult] = useState<FaceVerifyResult | null>(null)
  const [faceAttempts, setFaceAttempts] = useState(0)
  const [faceAnnounce, setFaceAnnounce] = useState("")
  const [cameraRetryCount, setCameraRetryCount] = useState(0)

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
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fullName = getFullName(dniData)
  const canContinueDni = Boolean(dniData) && !dniAlreadyExists

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const isEmailTaken = isEmailRegistered(email)
  const isPhoneValid = /^(?:\+?51)?\s?9\d{8}$/.test(phone.trim().replace(/[\s-]/g, "")) || phone.trim().replace(/\D/g, "").length >= 9
  const hasMinLength = password.length >= 8
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  const isPasswordStrong = hasMinLength && hasLetter && hasNumber
  const isPasswordMatch = password.length > 0 && password === confirmPassword

  const canCreateAccount =
    Boolean(dniData) &&
    isEmailValid &&
    !isEmailTaken &&
    isPhoneValid &&
    isPasswordStrong &&
    isPasswordMatch &&
    acceptedTerms &&
    !registerLoading

  useEffect(() => {
    if (step !== 2) {
      stopCameraStream()
      return
    }

    let active = true
    setCameraLoading(true)
    setCameraPermissionError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraLoading(false)
      setCameraPermissionError("Tu navegador no soporta acceso directo a la cámara.")
      return
    }

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setCameraLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setCameraLoading(false)
        const isDenied = err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
        setCameraPermissionError(
          isDenied
            ? "Permiso de cámara denegado. Permite el acceso a la cámara en tu navegador o sube una foto."
            : "No se detectó cámara web física o está en uso por otra aplicación.",
        )
      })

    return () => {
      active = false
      stopCameraStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cameraRetryCount])

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
      setDniError("El DNI debe contener exactamente 8 dígitos.")
      setDniData(null)
      setDniAlreadyExists(false)
      return
    }

    setDniLoading(true)
    setDniError(null)
    setDniAlreadyExists(false)
    try {
      const data = await lookupDni(value)
      setDniData(data)
      setDni(value)
    } catch (err) {
      setDniData(null)
      if (err instanceof Error && err.message === "DNI_ALREADY_REGISTERED") {
        setDniAlreadyExists(true)
      } else {
        setDniError("No se encontró información para este DNI en RENIEC.")
      }
    } finally {
      setDniLoading(false)
    }
  }

  function generateDemoSelfie() {
    const canvas = canvasRef.current || document.createElement("canvas")
    canvas.width = 320
    canvas.height = 420
    const ctx = canvas.getContext("2d")
    if (ctx) {
      // Fondo degradado
      const grad = ctx.createLinearGradient(0, 0, 0, 420)
      grad.addColorStop(0, "#2b3139")
      grad.addColorStop(1, "#181a20")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 320, 420)

      // Círculo de fondo
      ctx.fillStyle = "rgba(255, 184, 0, 0.15)"
      ctx.beginPath()
      ctx.arc(160, 180, 110, 0, Math.PI * 2)
      ctx.fill()

      // Cabeza
      ctx.fillStyle = "#e5b89a"
      ctx.beginPath()
      ctx.arc(160, 160, 60, 0, Math.PI * 2)
      ctx.fill()

      // Cabello
      ctx.fillStyle = "#2c1e19"
      ctx.beginPath()
      ctx.arc(160, 140, 62, Math.PI, Math.PI * 2)
      ctx.fill()

      // Ojos
      ctx.fillStyle = "#222222"
      ctx.beginPath()
      ctx.arc(142, 155, 5, 0, Math.PI * 2)
      ctx.arc(178, 155, 5, 0, Math.PI * 2)
      ctx.fill()

      // Sonrisa
      ctx.strokeStyle = "#8b4513"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(160, 175, 20, 0.2, Math.PI - 0.2)
      ctx.stroke()

      // Hombros / Traje
      ctx.fillStyle = "#ffb800"
      ctx.beginPath()
      ctx.ellipse(160, 340, 100, 70, 0, 0, Math.PI * 2)
      ctx.fill()

      // Etiqueta KYC
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 13px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("SELFIE DEMO BIOMÉTRICA", 160, 390)

      const url = canvas.toDataURL("image/jpeg", 0.92)
      setSelfieDataUrl(url)
      setFaceResult(null)
      setFaceAnnounce("Foto de demostración lista para verificar")
    }
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setSelfieDataUrl(dataUrl)
      setFaceResult(null)
      setFaceAnnounce("Foto cargada con éxito")
    }
    reader.readAsDataURL(file)
  }

  function captureSelfie() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video && canvas) {
      const width = video.videoWidth || video.clientWidth || 640
      const height = video.videoHeight || video.clientHeight || 480
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext("2d")
      if (context && video.videoWidth > 0) {
        context.drawImage(video, 0, 0, width, height)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95)
        setSelfieDataUrl(dataUrl)
        setFaceResult(null)
        setFaceAnnounce("Foto real capturada con tu cámara web")
        return
      }
    }
    // Fallback si la cámara no produce frames
    generateDemoSelfie()
  }

  async function handleVerifyFace() {
    if (!selfieDataUrl) return
    setVerifyingFace(true)
    setFaceAnnounce("Comparando con tu DNI...")
    try {
      const result = await verifyFace(selfieDataUrl)
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
    if (password.length < 8 || password !== confirmPassword || !acceptedTerms) {
      setContactError("Revisa la contraseña y confirma los términos para continuar.")
      return
    }

    setRegisterLoading(true)
    setRegisterError(null)
    try {
      const result = await registerUser({
        dni: dniData.dni,
        email: email.trim(),
        phone: phone.trim(),
        password,
      })
      setPendingSession({
        token: result.token,
        user: {
          name: fullName,
          email: email.trim(),
        },
      })
      setRegisterOutcome("success")
      setStep(4)
    } catch (err) {
      if (err instanceof Error && err.message === "EMAIL_ALREADY_REGISTERED") {
        setContactError("Este correo electrónico ya pertenece a una cuenta registrada. Usa otro correo o inicia sesión.")
        return
      }
      if (err instanceof Error && err.message === "DNI_ALREADY_REGISTERED") {
        setContactError("El DNI ya cuenta con una cuenta registrada en BankHub.")
        return
      }
      setRegisterOutcome("error")
      setRegisterError("No pudimos crear tu cuenta")
      setStep(4)
    } finally {
      setRegisterLoading(false)
    }
  }

  function retryFacePermission() {
    setCameraRetryCount((value) => value + 1)
    setStep(2)
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
            <span className="text-lg font-bold tracking-tight">BankHub</span>
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
                    onChange={(event) => {
                      setDni(event.target.value.replace(/\D/g, "").slice(0, 8))
                      setDniAlreadyExists(false)
                      setDniError(null)
                    }}
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

                {dniAlreadyExists ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-brand-accent mt-0.5" aria-hidden="true" />
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-semibold text-brand-text">Este DNI ya está registrado</p>
                          <p className="text-xs text-brand-muted mt-0.5 leading-relaxed">
                            El documento <strong className="text-brand-light">{dni}</strong> ya cuenta con una cuenta activa en BankHub. Si eres el titular, puedes ingresar directamente.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={resetToLogin}
                          className="btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3"
                        >
                          Iniciar sesión ahora →
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {dniError ? (
                  <p role="alert" className="rounded-xl bg-brand-negative/15 px-4 py-3 text-sm font-medium text-brand-negative">
                    {dniError}
                  </p>
                ) : null}

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
                Para tu seguridad, necesitamos verificar que eres tú. Activa tu cámara o sube una imagen de tu rostro.
              </p>

              {/* Input oculto para subir archivo de imagen o captura nativa */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleFileUpload}
              />

              <div className="mt-5 space-y-4">
                {cameraPermissionError && !selfieDataUrl ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <p className="text-sm font-medium text-amber-400">
                      {cameraPermissionError}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-primary inline-flex items-center gap-1.5 text-xs py-2"
                      >
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        Subir foto real
                      </button>
                      <button
                        type="button"
                        onClick={generateDemoSelfie}
                        className="btn-secondary inline-flex items-center gap-1.5 text-xs py-2"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-brand-accent" aria-hidden="true" />
                        Usar foto demo
                      </button>
                      <button
                        type="button"
                        onClick={retryFacePermission}
                        className="btn-secondary text-xs py-2"
                      >
                        Reintentar cámara
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col items-center gap-4">
                  <div className="relative flex w-full max-w-sm items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-brand-bg/60 p-3">
                    <div className="relative aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/70">
                      {/* El elemento video permanece siempre montado para recibir el feed de la cámara */}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn(
                          "h-full w-full object-cover",
                          (cameraLoading || Boolean(selfieDataUrl)) && "hidden",
                        )}
                      />

                      {cameraLoading && !selfieDataUrl ? (
                        <div className="flex h-full items-center justify-center text-brand-muted">
                          <span className="flex items-center gap-2 text-xs">
                            <Loader2 className="h-4 w-4 animate-spin text-brand-accent" aria-hidden="true" />
                            Iniciando cámara web...
                          </span>
                        </div>
                      ) : null}

                      {selfieDataUrl ? (
                        <img src={selfieDataUrl} alt="Selfie capturada" className="h-full w-full object-cover" />
                      ) : null}

                      <div className="pointer-events-none absolute inset-4 rounded-[1.5rem] border border-brand-accent/60" aria-hidden="true" />
                      <div className="pointer-events-none absolute inset-x-0 top-4 text-center text-xs font-medium text-brand-accent">
                        {selfieDataUrl ? "Rostro capturado" : "Encuadra tu rostro"}
                      </div>
                    </div>
                  </div>

                  <canvas ref={canvasRef} className="hidden" />

                  {/* Botones de acción para captura / carga */}
                  <div className="flex w-full flex-col gap-2.5">
                    <div className="flex w-full flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={captureSelfie}
                        disabled={cameraLoading}
                        className="btn-secondary flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                        <Camera className="h-4 w-4" aria-hidden="true" />
                        Capturar foto
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-secondary flex-1 inline-flex items-center justify-center gap-2"
                      >
                        <Upload className="h-4 w-4" aria-hidden="true" />
                        Subir foto
                      </button>
                      <button
                        type="button"
                        onClick={generateDemoSelfie}
                        className="btn-secondary flex-1 inline-flex items-center justify-center gap-2"
                      >
                        <Sparkles className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                        Foto demo
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleVerifyFace}
                      disabled={!selfieDataUrl || verifyingFace}
                      className="btn-primary w-full py-3 font-bold disabled:opacity-70"
                    >
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
                      onClick={() => {
                        setSelfieDataUrl(null)
                        setFaceResult(null)
                        setFaceAnnounce("")
                      }}
                      className="inline-flex items-center gap-2 text-sm font-medium text-brand-muted transition-colors duration-150 hover:text-brand-text"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Volver a tomar / cambiar foto
                    </button>
                  ) : null}
                </div>

                {faceAnnounce && !faceResult ? (
                  <p aria-live="polite" className="min-h-5 text-center text-sm font-medium text-brand-accent">
                    {faceAnnounce}
                  </p>
                ) : null}

                {faceResult?.match ? (
                  <div className="rounded-xl border border-brand-positive/20 bg-brand-positive/10 p-4">
                    <div className="flex items-center gap-2 text-brand-positive">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <p className="text-sm font-semibold">¡Identidad verificada exitosamente!</p>
                    </div>
                    <p className="mt-1 text-sm text-brand-light">Nivel de coincidencia biométrica: {Math.round(faceResult.confidence * 100)}%</p>
                    <button type="button" onClick={() => setStep(3)} className="btn-primary mt-4 w-full">
                      Continuar a datos de contacto
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

                {/* Opción rápida para omitir en desarrollo */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="text-xs text-brand-muted underline transition-colors hover:text-brand-text"
                  >
                    Omitir verificación biométrica (Modo Demo / Pruebas) →
                  </button>
                </div>
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
                    placeholder="correo@bankhub.com"
                    className={cn(
                      "input-base",
                      email && (!isEmailValid || isEmailTaken) && "border-brand-negative focus:border-brand-negative focus:ring-brand-negative/30",
                      email && isEmailValid && !isEmailTaken && "border-brand-positive/50 focus:border-brand-positive",
                    )}
                  />
                  {email && isEmailTaken ? (
                    <p className="text-xs font-medium text-amber-400">
                      ⚠️ Este correo ya pertenece a una cuenta registrada. Usa otro o inicia sesión.
                    </p>
                  ) : email && !isEmailValid ? (
                    <p className="text-xs text-brand-negative">Ingresa un correo electrónico válido (ej. usuario@dominio.com)</p>
                  ) : null}
                </Field>

                <Field label="Teléfono móvil" htmlFor="phone">
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="987 654 321"
                    className={cn(
                      "input-base",
                      phone && !isPhoneValid && "border-brand-negative focus:border-brand-negative focus:ring-brand-negative/30",
                      phone && isPhoneValid && "border-brand-positive/50 focus:border-brand-positive",
                    )}
                  />
                  {phone && !isPhoneValid ? (
                    <p className="text-xs text-brand-negative">Ingresa un número celular de 9 dígitos (ej. 987654321)</p>
                  ) : null}
                </Field>

                <Field label="Contraseña" htmlFor="password">
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo 8 caracteres, letras y números"
                    className={cn(
                      "input-base",
                      password && !isPasswordStrong && "border-amber-500/50",
                      password && isPasswordStrong && "border-brand-positive/50",
                    )}
                  />
                  {password ? (
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <span className={cn("inline-flex items-center gap-1", hasMinLength ? "text-brand-positive" : "text-brand-muted")}>
                        {hasMinLength ? "✓" : "•"} Mínimo 8 caracteres
                      </span>
                      <span className={cn("inline-flex items-center gap-1", hasLetter ? "text-brand-positive" : "text-brand-muted")}>
                        {hasLetter ? "✓" : "•"} Letras
                      </span>
                      <span className={cn("inline-flex items-center gap-1", hasNumber ? "text-brand-positive" : "text-brand-muted")}>
                        {hasNumber ? "✓" : "•"} Números
                      </span>
                    </div>
                  ) : null}
                </Field>

                <Field label="Confirmar contraseña" htmlFor="confirm-password">
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repite tu contraseña"
                    className={cn(
                      "input-base",
                      confirmPassword && !isPasswordMatch && "border-brand-negative focus:border-brand-negative focus:ring-brand-negative/30",
                      confirmPassword && isPasswordMatch && "border-brand-positive/50 focus:border-brand-positive",
                    )}
                  />
                  {confirmPassword && !isPasswordMatch ? (
                    <p role="alert" className="text-xs text-brand-negative">
                      Las contraseñas no coinciden.
                    </p>
                  ) : confirmPassword && isPasswordMatch ? (
                    <p className="text-xs text-brand-positive">
                      ✓ Las contraseñas coinciden correctamente.
                    </p>
                  ) : null}
                </Field>

                <label className="flex items-start gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-brand-light transition-colors hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-brand-bg text-brand-accent focus:ring-brand-accent/40"
                  />
                  <span>
                    Acepto los Términos y Condiciones y la Política de Privacidad de BankHub
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
              <p className="mt-2 text-sm text-brand-muted">Bienvenido a BankHub, {dniData?.nombres}</p>
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
        <div className="relative text-xs text-brand-muted">© {new Date().getFullYear()} BankHub. Todos los derechos reservados.</div>
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
