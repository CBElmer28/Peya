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

export function ProfileView() {
  const { session } = useAuth()
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({})
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)
  const [weeklySummary, setWeeklySummary] = useState(true)

  useEffect(() => {
    let active = true

    if (!session) {
      setProfile(null)
      setError(true)
      setLoading(false)
      return () => {
        active = false
      }
    }

    setLoading(true)
    setError(false)
    getProfileApi(session.token)
      .then((data) => {
        if (active) setProfile(data)
      })
      .catch((err) => {
        console.error("Error cargando el perfil:", err)
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session, retryCount])

  const fullName = profile?.name ?? ""
  const initials = getInitials(fullName)
  const unavailable = "No disponible"
  const registeredAt = profile?.registeredAt
    ? new Date(`${profile.registeredAt}T00:00:00`).toLocaleDateString("es-PE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : unavailable

  function openEditor() {
      if (!profile) return
      setEditName(profile.name)
      setEditEmail(profile.email)
      setFieldErrors({})
      setEditError(null)
      setSaved(false)
      setEditing(true)
  }

  function closeEditor() {
      setEditing(false)
      setFieldErrors({})
      setEditError(null)
  }

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      if (!profile || !session) return

      const nextErrors: { name?: string; email?: string } = {}
      const name = editName.trim()
      const email = editEmail.trim()
      if (!name) nextErrors.name = "Ingresa tu nombre completo."
      else if (name.length < 2) nextErrors.name = "El nombre debe tener al menos 2 caracteres."
      if (!email) nextErrors.email = "Ingresa tu correo electrónico."
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        nextErrors.email = "Escribe un correo válido, por ejemplo nombre@dominio.com."
      }

      setFieldErrors(nextErrors)
      setEditError(null)
      setSaved(false)
      if (Object.keys(nextErrors).length > 0) return

      setSaving(true)
      try {
        const updatedProfile = await updateProfileApi(session.token, profile.id, { name, email })
        setProfile(updatedProfile)
        setEditing(false)
        setSaved(true)
      } catch (err) {
        console.error("Error actualizando el perfil:", err)
        const statusCode = typeof err === "object" && err !== null && "statusCode" in err
          ? err.statusCode
          : undefined
        setEditError(
          statusCode === 401 || statusCode === 403
            ? "No tienes permisos para guardar estos cambios. Contacta con soporte si necesitas actualizar tus datos."
            : err instanceof Error
              ? `No se pudieron guardar los cambios: ${err.message}`
              : "No se pudieron guardar los cambios. Inténtalo nuevamente.",
        )
      } finally {
        setSaving(false)
      }
  }

  return (
    <section className="space-y-6" aria-labelledby="profile-title">
      <div>
        <h1 id="profile-title" className="text-2xl font-bold text-brand-text">
          Mi perfil
        </h1>
        <p className="text-sm text-brand-muted">Administra tu información y preferencias de cuenta</p>
      </div>

      {loading ? (
        <div className="space-y-6" role="status" aria-label="Cargando perfil">
          <div className="h-32 animate-pulse rounded-xl border border-white/10 bg-brand-surface" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-52 animate-pulse rounded-xl border border-white/10 bg-brand-surface" />
            <div className="h-52 animate-pulse rounded-xl border border-white/10 bg-brand-surface" />
          </div>
          <span className="sr-only">Cargando datos del perfil…</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-brand-negative/30 bg-brand-negative/10 p-5 text-center" role="alert">
          <p className="text-sm font-semibold text-brand-text">
            {session ? "No pudimos cargar tus datos personales." : "Inicia sesión para consultar tu perfil."}
          </p>
          {session ? (
            <>
              <p className="mt-1 text-xs text-brand-muted">Revisa tu conexión e inténtalo nuevamente.</p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-white/5"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Reintentar
              </button>
            </>
          ) : null}
        </div>
      ) : profile ? (
        <>
          <section className="rounded-xl border border-white/10 bg-brand-surface p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-accent text-2xl font-bold text-brand-bg">
                  {initials}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-brand-text">{profile.name || unavailable}</h2>
                    <span className="inline-flex items-center rounded-full bg-brand-positive/15 px-2.5 py-1 text-xs font-semibold text-brand-positive">
                      {profile.role === "admin" ? "Administrador" : "Cliente"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-brand-muted">{profile.email || unavailable}</p>
                </div>
              </div>

              {!editing ? (
                <button type="button" onClick={openEditor} className="btn-secondary inline-flex items-center gap-2 self-start sm:self-auto">
                  <User className="h-4 w-4" aria-hidden="true" />
                  Editar perfil
                </button>
              ) : null}
            </div>
            {editing ? (
              <form onSubmit={handleProfileSubmit} noValidate className="mt-6 border-t border-white/10 pt-5">
                <h3 className="text-base font-semibold text-brand-text">Editar datos personales</h3>
                <p className="mt-1 text-sm text-brand-muted">
                  Actualiza tu nombre y correo. El DNI no se puede modificar; el teléfono no está habilitado para edición.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="profile-edit-name" className="block text-sm font-medium text-brand-text">
                      Nombre completo
                    </label>
                    <input
                      id="profile-edit-name"
                      name="name"
                      autoComplete="name"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      onBlur={() => {
                        const value = editName.trim()
                        setFieldErrors((current) => ({
                          ...current,
                          name: !value
                            ? "Ingresa tu nombre completo."
                            : value.length < 2
                              ? "El nombre debe tener al menos 2 caracteres."
                              : undefined,
                        }))
                      }}
                      maxLength={150}
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={fieldErrors.name ? "profile-edit-name-error" : undefined}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
                    />
                    {fieldErrors.name ? (
                      <p id="profile-edit-name-error" className="mt-1 text-xs text-brand-negative">{fieldErrors.name}</p>
                    ) : null}
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
                        const value = editEmail.trim()
                        setFieldErrors((current) => ({
                          ...current,
                          email: !value
                            ? "Ingresa tu correo electrónico."
                            : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                              ? "Escribe un correo válido, por ejemplo nombre@dominio.com."
                              : undefined,
                        }))
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
                      value={profile.phone || unavailable}
                      readOnly
                      aria-describedby="profile-edit-phone-help"
                      className="mt-1 w-full cursor-not-allowed rounded-lg border border-white/10 bg-brand-surface-2 px-3 py-2 text-sm text-brand-muted"
                    />
                    <p id="profile-edit-phone-help" className="mt-1 text-xs text-brand-muted">
                      El servicio de perfil actual no permite actualizar este dato.
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
                    onClick={closeEditor}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-brand-text transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Cancelar
                  </button>
                </div>
              </form>
            ) : null}
          </section>
          {saved ? (
            <p role="status" className="flex items-center gap-2 rounded-lg border border-brand-positive/30 bg-brand-positive/10 px-4 py-3 text-sm text-brand-positive">
              <Check className="h-4 w-4" aria-hidden="true" />
              Tus datos se actualizaron correctamente.
            </p>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Datos personales">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-brand-muted">Nombre completo</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-brand-text">{profile.name || unavailable}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-brand-muted">DNI</dt>
                  <dd className="mt-1 text-sm font-medium text-brand-text">{profile.dni || unavailable}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-brand-muted">Correo electrónico</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-brand-text">{profile.email || unavailable}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs font-medium text-brand-muted">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    Teléfono
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-brand-text">{profile.phone || unavailable}</dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard title="Información de cuenta">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-brand-muted">Tipo de usuario</dt>
                  <dd className="mt-1 text-sm font-medium text-brand-text">
                    {profile.role === "admin" ? "Administrador" : "Cliente"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-brand-muted">Estado de la cuenta</dt>
                  <dd className="mt-1 text-sm font-medium text-brand-text">
                    {profile.status === "active" ? "Activa" : profile.status === "inactive" ? "Inactiva" : unavailable}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-brand-muted">Fecha de registro</dt>
                  <dd className="mt-1 text-sm font-medium capitalize text-brand-text">{registeredAt}</dd>
                </div>
              </dl>
            </SectionCard>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center">
          <User className="mx-auto h-8 w-8 text-brand-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-brand-text">No hay datos de perfil disponibles</p>
        </div>
      )}

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
