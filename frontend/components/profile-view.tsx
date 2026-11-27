"use client"

import { useEffect, useState } from "react"
import { CalendarDays, Check, CreditCard, Mail, Phone, RefreshCw, ShieldCheck, Smartphone, Laptop, User, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { getProfileApi, updateProfileApi, type ProfileResponse } from "@/lib/api-client"

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U"
}

function Switch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={[
        "inline-flex h-7 w-12 items-center rounded-full p-1 transition-colors duration-150",
        enabled ? "bg-brand-accent" : "bg-brand-surface-2",
      ].join(" ")}
    >
      <span
        className={[
          "h-5 w-5 rounded-full bg-brand-bg shadow-sm transition-transform duration-150",
          enabled ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-brand-surface p-5">
      <h2 className="text-base font-semibold text-brand-text">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

const UNAVAILABLE = "No disponible"
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldErrors = { email?: string; password?: string }

const UPDATE_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CURRENT_PASSWORD: "La contraseña actual es incorrecta.",
  CURRENT_PASSWORD_REQUIRED: "Para cambiar el correo debes indicar tu contraseña actual.",
  EMAIL_IN_USE: "Ese correo electrónico ya está en uso por otro usuario.",
  NO_CHANGES: "No hay cambios para guardar.",
  PROFILE_CONFLICT: "Tu perfil se modificó desde otra sesión. Recargamos tus datos: revisa e inténtalo de nuevo.",
  FIELD_NOT_EDITABLE: "Alguno de los datos enviados no se puede modificar desde tu perfil.",
}

const STATUS_LABELS: Record<string, string> = { active: "Activa", inactive: "Inactiva" }

function orUnavailable(value: string | null | undefined): string {
  return value || UNAVAILABLE
}

function formatRole(role: string | undefined): string {
  return role === "admin" ? "Administrador" : "Cliente"
}

function formatStatus(status: string | undefined): string {
  return STATUS_LABELS[status ?? ""] ?? UNAVAILABLE
}

function formatRegisteredAt(date: string | null | undefined): string {
  if (!date) return UNAVAILABLE
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
}

function validateEmailFormat(rawEmail: string): string | undefined {
  const value = rawEmail.trim()
  if (!value) return "Ingresa tu correo electrónico."
  if (!EMAIL_PATTERN.test(value)) return "Escribe un correo válido, por ejemplo nombre@dominio.com."
  return undefined
}

function getErrorField<T>(err: unknown, field: string): T | undefined {
  if (typeof err !== "object" || err === null || !(field in err)) return undefined
  return (err as Record<string, unknown>)[field] as T
}

function getUpdateErrorCode(err: unknown): string | undefined {
  return getErrorField<{ error?: string }>(err, "body")?.error
}

// Mensajes por codigo de error del backend (HU15); el texto del servidor nunca incluye tus datos.
function describeUpdateError(err: unknown): string {
  const known = UPDATE_ERROR_MESSAGES[getUpdateErrorCode(err) ?? ""]
  if (known) return known
  const statusCode = getErrorField<number>(err, "statusCode")
  if (statusCode === 401 || statusCode === 403) {
    return "No tienes permisos para guardar estos cambios. Contacta con soporte si necesitas actualizar tus datos."
  }
  return err instanceof Error
    ? `No se pudieron guardar los cambios: ${err.message}`
    : "No se pudieron guardar los cambios. Inténtalo nuevamente."
}

type EditValidation = { errors: FieldErrors; noChanges: boolean }

function validateProfileEdit(email: string, password: string, currentEmail: string): EditValidation {
  const emailError = validateEmailFormat(email)
  if (emailError) return { errors: { email: emailError }, noChanges: false }
  if (email.toLowerCase() === currentEmail.toLowerCase()) return { errors: {}, noChanges: true }
  if (!password) return { errors: { password: "Ingresa tu contraseña actual para confirmar el cambio." }, noChanges: false }
  return { errors: {}, noChanges: false }
}

function ProfileSkeleton() {
  return (
        <div className="space-y-6" role="status" aria-label="Cargando perfil">
          <div className="h-32 animate-pulse rounded-xl border border-white/10 bg-brand-surface" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-52 animate-pulse rounded-xl border border-white/10 bg-brand-surface" />
            <div className="h-52 animate-pulse rounded-xl border border-white/10 bg-brand-surface" />
          </div>
          <span className="sr-only">Cargando datos del perfil…</span>
        </div>
  )
}

function ProfileLoadError({ hasSession, onRetry }: { hasSession: boolean; onRetry: () => void }) {
  return (
        <div className="rounded-xl border border-brand-negative/30 bg-brand-negative/10 p-5 text-center" role="alert">
          <p className="text-sm font-semibold text-brand-text">
            {hasSession ? "No pudimos cargar tus datos personales." : "Inicia sesión para consultar tu perfil."}
          </p>
          {hasSession ? (
            <>
              <p className="mt-1 text-xs text-brand-muted">Revisa tu conexión e inténtalo nuevamente.</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-white/5"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Reintentar
              </button>
            </>
          ) : null}
        </div>
  )
}

type ProfileEditFormProps = {
  profile: ProfileResponse
  editEmail: string
  setEditEmail: (value: string) => void
  editPassword: string
  setEditPassword: (value: string) => void
  fieldErrors: FieldErrors
  setFieldErrors: React.Dispatch<React.SetStateAction<FieldErrors>>
  editError: string | null
  saving: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}

function ProfileEditForm({
  profile,
  editEmail,
  setEditEmail,
  editPassword,
  setEditPassword,
  fieldErrors,
  setFieldErrors,
  editError,
  saving,
  onSubmit,
  onCancel,
}: ProfileEditFormProps) {
  return (
              <form onSubmit={onSubmit} noValidate className="mt-6 border-t border-white/10 pt-5">
                <h3 className="text-base font-semibold text-brand-text">Editar datos personales</h3>
                <p className="mt-1 text-sm text-brand-muted">
                  Por ahora solo puedes actualizar tu correo electrónico. Tu nombre, DNI y teléfono no se pueden modificar desde aquí.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="profile-edit-name" className="block text-sm font-medium text-brand-text">
                      Nombre completo
                    </label>
                    <input
                      id="profile-edit-name"
                      value={orUnavailable(profile.name)}
                      readOnly
                      aria-describedby="profile-edit-name-help"
                      className="mt-1 w-full cursor-not-allowed rounded-lg border border-white/10 bg-brand-surface-2 px-3 py-2 text-sm text-brand-muted"
                    />
                    <p id="profile-edit-name-help" className="mt-1 text-xs text-brand-muted">
                      Se toma de tu identidad (RENIEC) y no se puede modificar.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="profile-edit-email" className="block text-sm font-medium text-brand-text">
                      Correo electrónico
                    </label>
                    <input
                      id="profile-edit-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={editEmail}
                      onChange={(event) => setEditEmail(event.target.value)}
                      onBlur={() => {
                        setFieldErrors((current) => ({ ...current, email: validateEmailFormat(editEmail) }))
                      }}
                      maxLength={255}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? "profile-edit-email-error" : undefined}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
                    />
                    {fieldErrors.email ? (
                      <p id="profile-edit-email-error" className="mt-1 text-xs text-brand-negative">{fieldErrors.email}</p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="profile-edit-phone" className="block text-sm font-medium text-brand-text">
                      Teléfono
                    </label>
                    <input
                      id="profile-edit-phone"
                      value={orUnavailable(profile.phone)}
                      readOnly
                      aria-describedby="profile-edit-phone-help"
                      className="mt-1 w-full cursor-not-allowed rounded-lg border border-white/10 bg-brand-surface-2 px-3 py-2 text-sm text-brand-muted"
                    />
                    <p id="profile-edit-phone-help" className="mt-1 text-xs text-brand-muted">
                      Este dato no está habilitado para edición.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="profile-edit-password" className="block text-sm font-medium text-brand-text">
                      Contraseña actual
                    </label>
                    <input
                      id="profile-edit-password"
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      value={editPassword}
                      onChange={(event) => setEditPassword(event.target.value)}
                      maxLength={128}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby="profile-edit-password-help"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
                    />
                    <p id="profile-edit-password-help" className={fieldErrors.password ? "mt-1 text-xs text-brand-negative" : "mt-1 text-xs text-brand-muted"}>
                      {fieldErrors.password ?? "Necesaria para confirmar el cambio de correo."}
                    </p>
                  </div>
                </div>
                {editError ? (
                  <p role="alert" className="mt-4 rounded-lg border border-brand-negative/30 bg-brand-negative/10 px-3 py-2 text-sm text-brand-negative">
                    {editError}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-brand-text transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Cancelar
                  </button>
                </div>
              </form>
  )
}

function ProfileDetails({ profile }: { profile: ProfileResponse }) {
  const registeredAt = formatRegisteredAt(profile.registeredAt)
  return (
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Datos personales">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-brand-muted">Nombre completo</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-brand-text">{orUnavailable(profile.name)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-brand-muted">DNI</dt>
                  <dd className="mt-1 text-sm font-medium text-brand-text">{orUnavailable(profile.dni)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-brand-muted">Correo electrónico</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-brand-text">{orUnavailable(profile.email)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs font-medium text-brand-muted">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    Teléfono
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-brand-text">{orUnavailable(profile.phone)}</dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard title="Información de cuenta">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-brand-muted">Tipo de usuario</dt>
                  <dd className="mt-1 text-sm font-medium text-brand-text">
                    {formatRole(profile.role)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-brand-muted">Estado de la cuenta</dt>
                  <dd className="mt-1 text-sm font-medium text-brand-text">
                    {formatStatus(profile.status)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-brand-muted">Fecha de registro</dt>
                  <dd className="mt-1 text-sm font-medium capitalize text-brand-text">{registeredAt}</dd>
                </div>
              </dl>
            </SectionCard>
          </div>
  )
}

function ProfileEmpty() {
  return (
        <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center">
          <User className="mx-auto h-8 w-8 text-brand-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-brand-text">No hay datos de perfil disponibles</p>
        </div>
  )
}

function useProfile(token: string | undefined, retryCount: number) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    const whenActive = (fn: () => void) => {
      if (active) fn()
    }

    if (!token) {
      setProfile(null)
      setError(true)
      setLoading(false)
      return () => {
        active = false
      }
    }

    setLoading(true)
    setError(false)
    getProfileApi(token)
      .then((data) => whenActive(() => setProfile(data)))
      .catch((err) => {
        console.error("Error cargando el perfil:", err)
        whenActive(() => setError(true))
      })
      .finally(() => whenActive(() => setLoading(false)))

    return () => {
      active = false
    }
  }, [token, retryCount])

  return { profile, setProfile, loading, error }
}

export function ProfileView() {
  const { session, setSession } = useAuth()
  const [retryCount, setRetryCount] = useState(0)
  const { profile, setProfile, loading, error } = useProfile(session?.token, retryCount)
  const [editing, setEditing] = useState(false)
  const [editEmail, setEditEmail] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)
  const [weeklySummary, setWeeklySummary] = useState(true)

  const retry = () => setRetryCount((count) => count + 1)

  function openEditor() {
    if (!profile) return
    setEditEmail(profile.email)
    setEditPassword("")
    setFieldErrors({})
    setEditError(null)
    setSaved(false)
    setEditing(true)
  }

  function closeEditor() {
    setEditing(false)
    setEditPassword("")
    setFieldErrors({})
    setEditError(null)
  }

  async function saveProfile(current: ProfileResponse, token: string, email: string) {
    setSaving(true)
    try {
      const updatedProfile = await updateProfileApi(token, {
        email,
        currentPassword: editPassword,
        expectedUpdatedAt: current.updatedAt,
      })
      setProfile(updatedProfile)
      setSession(session ? { ...session, user: { ...session.user, email: updatedProfile.email } } : session)
      setEditing(false)
      setEditPassword("")
      setSaved(true)
    } catch (err) {
      console.error("Error actualizando el perfil:", err instanceof Error ? err.name : "error")
      if (getUpdateErrorCode(err) === "PROFILE_CONFLICT") {
        setEditing(false)
        retry()
      }
      setEditError(describeUpdateError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile || !session) return

    const email = editEmail.trim()
    const { errors, noChanges } = validateProfileEdit(email, editPassword, profile.email)
    setFieldErrors(errors)
    setSaved(false)
    if (noChanges) {
      setEditError("No hay cambios para guardar: el correo es igual al actual.")
      return
    }
    setEditError(null)
    if (Object.keys(errors).length > 0) return

    await saveProfile(profile, session.token, email)
  }

  function renderProfile(current: ProfileResponse) {
    return (
      <>
        <section className="rounded-xl border border-white/10 bg-brand-surface p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-accent text-2xl font-bold text-brand-bg">
                {getInitials(current.name ?? "")}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-brand-text">{orUnavailable(current.name)}</h2>
                  <span className="inline-flex items-center rounded-full bg-brand-positive/15 px-2.5 py-1 text-xs font-semibold text-brand-positive">
                    {formatRole(current.role)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-brand-muted">{orUnavailable(current.email)}</p>
              </div>
            </div>

            {editing ? null : (
              <button type="button" onClick={openEditor} className="btn-secondary inline-flex items-center gap-2 self-start sm:self-auto">
                <User className="h-4 w-4" aria-hidden="true" />
                Editar perfil
              </button>
            )}
          </div>
          {editing ? (
            <ProfileEditForm
              profile={current}
              editEmail={editEmail}
              setEditEmail={setEditEmail}
              editPassword={editPassword}
              setEditPassword={setEditPassword}
              fieldErrors={fieldErrors}
              setFieldErrors={setFieldErrors}
              editError={editError}
              saving={saving}
              onSubmit={handleProfileSubmit}
              onCancel={closeEditor}
            />
          ) : null}
        </section>
        {saved ? (
          <p role="status" className="flex items-center gap-2 rounded-lg border border-brand-positive/30 bg-brand-positive/10 px-4 py-3 text-sm text-brand-positive">
            <Check className="h-4 w-4" aria-hidden="true" />
            Tus datos se actualizaron correctamente.
          </p>
        ) : null}
        <ProfileDetails profile={current} />
      </>
    )
  }

  function renderContent() {
    if (loading) return <ProfileSkeleton />
    if (error) return <ProfileLoadError hasSession={Boolean(session)} onRetry={retry} />
    if (profile) return renderProfile(profile)
    return <ProfileEmpty />
  }

  return (
    <section className="space-y-6" aria-labelledby="profile-title">
      <div>
        <h1 id="profile-title" className="text-2xl font-bold text-brand-text">
          Mi perfil
        </h1>
        <p className="text-sm text-brand-muted">Administra tu información y preferencias de cuenta</p>
      </div>

      {renderContent()}

      <div className="space-y-6">
        <SectionCard title="Seguridad">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">Contraseña</p>
                  <p className="text-xs text-brand-muted">Actualiza tu clave de acceso</p>
                </div>
              </div>
              <button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-brand-text transition-colors duration-150 hover:bg-white/5">
                Cambiar
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">Verificación en dos pasos</p>
                  <p className="text-xs text-brand-muted">Protege tu acceso con un paso extra</p>
                </div>
              </div>
              <Switch enabled={twoFactorEnabled} onToggle={() => setTwoFactorEnabled((value) => !value)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Preferencias de notificaciones">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">Notificaciones por correo</p>
                  <p className="text-xs text-brand-muted">Alertas sobre movimientos y seguridad</p>
                </div>
              </div>
              <Switch enabled={emailNotifications} onToggle={() => setEmailNotifications((value) => !value)} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <Smartphone className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">Notificaciones push</p>
                  <p className="text-xs text-brand-muted">Recibe avisos en el móvil</p>
                </div>
              </div>
              <Switch enabled={pushNotifications} onToggle={() => setPushNotifications((value) => !value)} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">Resumen semanal</p>
                  <p className="text-xs text-brand-muted">Reporte breve de tu actividad</p>
                </div>
              </div>
              <Switch enabled={weeklySummary} onToggle={() => setWeeklySummary((value) => !value)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Sesiones activas">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <Laptop className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">Chrome · Windows · Lima, Perú</p>
                  <p className="text-xs text-brand-muted">Sesión actual</p>
                </div>
              </div>
              <button type="button" className="text-sm font-medium text-brand-negative transition-colors duration-150 hover:opacity-80">
                Cerrar sesión
              </button>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <Smartphone className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">App móvil · iOS · Lima, Perú</p>
                  <p className="text-xs text-brand-muted">Activa hace 2 días</p>
                </div>
              </div>
              <button type="button" className="text-sm font-medium text-brand-negative transition-colors duration-150 hover:opacity-80">
                Cerrar sesión
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </section>
  )
}
