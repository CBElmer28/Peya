"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Eye,
  ShieldCheck,
  Pencil,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  X,
  UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import {
  getProfileApi,
  getClientsApi,
  createClientApi,
  updateClientApi,
  deleteClientApi,
  getAdminMetricsApi,
  getSupervisedAccountsApi,
} from "@/lib/api-client"
import type {
  AdminMetric,
  SupervisedAccount,
  Client,
  ClientRole,
  ClientStatus,
} from "@/lib/mock-api"
import type { ProfileResponse } from "@/lib/api-client"

type AdminTab = "dashboard" | "clients" | "subadmins"

type SubadminRole = "SOPORTE"

type SubadminDraft = {
  id: number
  name: string
  email: string
  role: SubadminRole
}

const PERMITTED_SUBADMIN_ROLES: { value: SubadminRole; label: string; description: string }[] = [
  { value: "SOPORTE", label: "Soporte", description: "Consulta de clientes y cuentas supervisadas" },
]

const PAGE_SIZE = 5

function StatusBadge({ label, tone }: { label: string; tone: "positive" | "negative" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "positive"
          ? "bg-brand-positive/15 text-brand-positive"
          : "bg-brand-negative/15 text-brand-negative",
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", tone === "positive" ? "bg-brand-positive" : "bg-brand-negative")}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
  totalItems,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
  totalItems: number
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:flex-row">
      <p className="text-xs text-brand-muted">
        {totalItems} registros · Página {page} de {totalPages || 1}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
           className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 text-brand-text transition-colors duration-150 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
                "h-8 min-w-8 rounded-xl px-2 text-sm font-medium transition-colors duration-150",
              p === page ? "bg-brand-accent text-brand-bg" : "text-brand-muted hover:bg-white/5 hover:text-brand-text",
            )}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
           className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 text-brand-text transition-colors duration-150 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

const ACCOUNT_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "active", label: "Activas" },
  { key: "blocked", label: "Bloqueadas" },
  { key: "recent", label: "Recientes" },
] as const

type AccountFilter = (typeof ACCOUNT_FILTERS)[number]["key"]

const ROLE_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "client", label: "Clientes" },
  { key: "admin", label: "Administradores" },
] as const

type RoleFilter = (typeof ROLE_FILTERS)[number]["key"]

type ClientFormState = {
  name: string
  email: string
  role: ClientRole
  status: ClientStatus
}

type ClientModalMode = "create" | "edit"

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}

function RoleBadge({ role }: { role: ClientRole }) {
  const isAdmin = role === "admin"
  const Icon = isAdmin ? ShieldCheck : User

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        isAdmin ? "bg-brand-accent/15 text-brand-accent" : "bg-brand-surface-2 text-brand-light/80",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {isAdmin ? "Administrador" : "Cliente"}
    </span>
  )
}

function getClientRoleLabel(role: ClientRole): string {
  return role === "admin" ? "Administrador" : "Cliente"
}

function getRoleDescription(role: ClientRole): string {
  return role === "admin" ? "Acceso al panel de administración" : "Acceso a su banca personal"
}

function getInitialForm(): ClientFormState {
  return { name: "", email: "", role: "client", status: "active" }
}

function ClientDialog({
  open,
  mode,
  initialClient,
  existingClients,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: ClientModalMode
  initialClient: Client | null
  existingClients: Client[]
  onClose: () => void
  onSubmit: (payload: ClientFormState) => Promise<void>
}) {
  const [form, setForm] = useState<ClientFormState>(getInitialForm())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({})
  const [confirmSensitive, setConfirmSensitive] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setLoading(false)
    setFieldErrors({})
    setConfirmSensitive(false)
    setForm(
      initialClient
        ? { name: initialClient.name, email: initialClient.email, role: initialClient.role, status: initialClient.status }
        : getInitialForm(),
    )
    queueMicrotask(() => firstInputRef.current?.focus())
  }, [open, initialClient])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!open) return
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab") return

      const focusable = getFocusableElements(dialogRef.current)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  function updateField<K extends keyof ClientFormState>(key: K, value: ClientFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function saveForm() {
    setLoading(true)
    setError(null)
    try {
      await onSubmit({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        status: form.status,
      })
      onClose()
    } catch (err) {
      console.error(mode === "create" ? "Error creando cliente:" : "Error actualizando cliente:", err)
      setError(
        err instanceof Error
          ? err.message
          : mode === "create"
            ? "No se pudo crear el cliente. Revisa los datos e inténtalo nuevamente."
            : "No se pudo actualizar el cliente. Revisa los datos e inténtalo nuevamente.",
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    const name = form.name.trim()
    const email = form.email.trim()
    const nextErrors: { name?: string; email?: string } = {}
    if (!name) nextErrors.name = "Ingresa el nombre completo."
    else if (name.length < 2) nextErrors.name = "El nombre debe tener al menos 2 caracteres."
    else if (name.length > 100) nextErrors.name = "El nombre no puede superar los 100 caracteres."
    if (!email) nextErrors.email = "Ingresa el correo electrónico."
    else if (email.length > 255) nextErrors.email = "El correo no puede superar los 255 caracteres."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Ingresa un correo electrónico válido."
    else if (existingClients.some((client) =>
      client.id !== initialClient?.id && client.email.toLowerCase() === email.toLowerCase(),
    )) {
      nextErrors.email = "Ya existe un usuario registrado con este correo."
    }
    setFieldErrors(nextErrors)
    setError(null)
    if (Object.keys(nextErrors).length > 0) return

    const sensitiveChange = mode === "edit" && initialClient !== null &&
      (form.role !== initialClient.role || form.status !== initialClient.status)
    if (sensitiveChange) {
      setConfirmSensitive(true)
      return
    }
    await saveForm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" aria-label="Cerrar modal" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-dialog-title"
        className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/10 bg-brand-surface2 p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="client-dialog-title" className="text-lg font-bold text-brand-text">
              {mode === "create" ? "Crear nuevo usuario" : "Editar usuario"}
            </h3>
            <p className="mt-1 text-sm text-brand-muted">
              {mode === "create" ? "Completa los datos básicos para dar acceso al sistema." : "Actualiza los datos y el estado del usuario."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-brand-muted transition-colors duration-150 hover:bg-white/5 hover:text-brand-text"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {confirmSensitive ? (
          <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4" role="alertdialog" aria-labelledby="client-sensitive-change-title">
            <h4 id="client-sensitive-change-title" className="font-semibold text-brand-text">
              Confirma los cambios sensibles
            </h4>
            <p className="mt-2 text-sm text-brand-muted">
              {initialClient && form.role !== initialClient.role
                ? `El rol cambiará de ${getClientRoleLabel(initialClient.role)} a ${getClientRoleLabel(form.role)}. `
                : ""}
              {initialClient && form.status !== initialClient.status
                ? `El estado cambiará de ${initialClient.status === "active" ? "Activo" : "Inactivo"} a ${form.status === "active" ? "Activo" : "Inactivo"}.`
                : ""}
              {" "}Este cambio puede modificar el acceso del usuario.
            </p>
            {error ? (
              <p role="alert" className="mt-3 rounded-xl bg-brand-negative/15 px-4 py-3 text-sm font-medium text-brand-negative">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => { setConfirmSensitive(false); setError(null) }} disabled={loading} className="btn-secondary">
                Volver a editar
              </button>
              <button type="button" onClick={() => void saveForm()} disabled={loading} className="btn-primary disabled:opacity-70">
                {loading ? "Guardando…" : "Confirmar y guardar"}
              </button>
            </div>
          </div>
        ) : (
        <>
        <div className="mt-5 space-y-4">
          <label className="flex flex-col gap-1.5 text-sm text-brand-muted">
            Nombre completo
            <input
              ref={firstInputRef}
              value={form.name}
              onChange={(event) => {
                updateField("name", event.target.value)
                setFieldErrors((current) => ({ ...current, name: undefined }))
              }}
              maxLength={100}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "client-name-error" : undefined}
              className="input-base"
              placeholder="Nombre y apellido"
            />
            {fieldErrors.name ? <span id="client-name-error" className="text-xs text-brand-negative">{fieldErrors.name}</span> : null}
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-brand-muted">
            Correo electrónico
            <input
              type="email"
              value={form.email}
              onChange={(event) => {
                updateField("email", event.target.value)
                setFieldErrors((current) => ({ ...current, email: undefined }))
              }}
              maxLength={255}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "client-email-error" : undefined}
              className="input-base"
              placeholder="usuario@peya.com"
            />
            {fieldErrors.email ? <span id="client-email-error" className="text-xs text-brand-negative">{fieldErrors.email}</span> : null}
          </label>

          <div>
            <p className="text-sm text-brand-muted">Rol</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {(["client", "admin"] as const).map((role) => {
                const selected = form.role === role
                const Icon = role === "admin" ? ShieldCheck : User
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => updateField("role", role)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-colors duration-150",
                      selected ? "border-brand-accent bg-brand-accent/10" : "border-white/10 bg-brand-surface hover:bg-white/5",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          selected ? "bg-brand-accent/15 text-brand-accent" : "bg-brand-surface-2 text-brand-light/80",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-semibold text-brand-text">{getClientRoleLabel(role)}</p>
                        <p className="mt-1 text-xs text-brand-muted">{getRoleDescription(role)}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {mode === "edit" ? (
            <label className="flex flex-col gap-1.5 text-sm text-brand-muted">
              Estado
              <select
                value={form.status}
                onChange={(event) => updateField("status", event.target.value as ClientStatus)}
                className="input-base"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-xl bg-brand-negative/15 px-4 py-3 text-sm font-medium text-brand-negative">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="button" onClick={() => void handleSubmit()} disabled={loading} className="btn-primary disabled:opacity-70">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Creando...
              </span>
            ) : mode === "create" ? (
              "Crear usuario"
            ) : (
              "Guardar cambios"
            )}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  )
}

function DeleteClientDialog({
  open,
  client,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean
  client: Client | null
  loading: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const firstButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => firstButtonRef.current?.focus())
  }, [open])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!open) return
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab") return

      const focusable = getFocusableElements(dialogRef.current)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open || !client) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" aria-label="Cerrar confirmación" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-client-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-brand-surface2 p-5 shadow-2xl"
      >
        <h3 id="delete-client-title" className="text-lg font-bold text-brand-text">
          ¿Eliminar a {client.name}?
        </h3>
        <p className="mt-2 text-sm text-brand-muted">Esta acción no se puede deshacer.</p>
        {client.role === "admin" ? (
          <div className="mt-4 rounded-xl border border-brand-accent/20 bg-brand-accent/10 px-4 py-3 text-sm text-brand-accent">
            Estás eliminando una cuenta de administrador.
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-brand-negative/15 px-4 py-3 text-sm font-medium text-brand-negative">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button ref={firstButtonRef} type="button" onClick={onClose} disabled={loading} className="btn-secondary disabled:opacity-60">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            className="rounded-xl bg-brand-negative px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ClientDetailsDialog({
  client,
  onClose,
  onEdit,
}: {
  client: Client | null
  onClose: () => void
  onEdit: (client: Client) => void
}) {
  useEffect(() => {
    if (!client) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [client, onClose])

  if (!client) return null

  const registeredAt = client.registeredAt
    ? new Date(`${client.registeredAt}T00:00:00`).toLocaleDateString("es-PE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "No disponible"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" aria-label="Cerrar detalle" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-details-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-brand-surface2 p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="client-details-title" className="text-lg font-bold text-brand-text">Detalle del cliente</h3>
            <p className="mt-1 text-sm text-brand-muted">Información de la cuenta seleccionada.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg border border-white/10 p-2 text-brand-muted hover:bg-white/5">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-brand-muted">Nombre completo</dt>
            <dd className="mt-1 break-words text-sm font-medium text-brand-text">{client.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-brand-muted">Correo electrónico</dt>
            <dd className="mt-1 break-words text-sm font-medium text-brand-text">{client.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-brand-muted">Rol</dt>
            <dd className="mt-1"><RoleBadge role={client.role} /></dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-brand-muted">Estado</dt>
            <dd className="mt-1">
              <StatusBadge label={client.status === "active" ? "Activo" : "Inactivo"} tone={client.status === "active" ? "positive" : "negative"} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-brand-muted">Fecha de registro</dt>
            <dd className="mt-1 text-sm font-medium capitalize text-brand-text">{registeredAt}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-brand-muted">Identificador</dt>
            <dd className="mt-1 break-all font-mono text-xs text-brand-light">{client.id}</dd>
          </div>
        </dl>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Cerrar</button>
          <button
            type="button"
            onClick={() => onEdit(client)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Editar cliente
          </button>
        </div>
      </section>
    </div>
  )
}

function AdminDashboard() {
  const { session } = useAuth()
  const [metrics, setMetrics] = useState<AdminMetric[]>([])
  const [accounts, setAccounts] = useState<SupervisedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<AccountFilter>("all")
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)
    Promise.all([getAdminMetricsApi(session.token), getSupervisedAccountsApi(session.token)])
      .then(([m, a]) => {
        if (!active) return
        setMetrics(m)
        setAccounts(a)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error cargando dashboard:", err)
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session])

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const matchesSearch =
        a.client.toLowerCase().includes(search.toLowerCase()) ||
        a.number.toLowerCase().includes(search.toLowerCase())
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && a.status === "active") ||
        (filter === "blocked" && a.status === "blocked") ||
        (filter === "recent" && a.recent)
      return matchesSearch && matchesFilter
    })
  }, [accounts, search, filter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [search, filter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Panel administrativo</h1>
        <p className="text-sm text-brand-muted">Supervisión general de cuentas y actividad del sistema.</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-brand-surface2" />
            ))
          : metrics.map((m) => (
              <div key={m.id} className="rounded-xl bg-brand-surface2 p-5">
                <p className="text-sm text-brand-muted">{m.label}</p>
                <p className="mt-2 text-3xl font-bold text-brand-text">{m.value}</p>
                <span
                  className={cn(
                    "mt-3 inline-flex items-center gap-1 text-sm font-semibold",
                    m.trend === "up" ? "text-brand-positive" : "text-brand-negative",
                  )}
                >
                  {m.trend === "up" ? (
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                  )}
                  {m.growth} vs. mes anterior
                </span>
              </div>
            ))}
      </div>

      {/* Filtros + tabla */}
      <div className="rounded-xl bg-brand-surface2">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente o cuenta..."
              className="input-base pl-9"
              aria-label="Buscar cuenta"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  filter === f.key
                    ? "bg-brand-accent text-brand-bg"
                    : "border border-white/15 text-brand-muted hover:bg-white/5 hover:text-brand-text",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-y border-white/10 text-xs uppercase tracking-wide text-brand-muted">
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">N° Cuenta</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Saldo</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-brand-muted">
                    Cargando cuentas...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-brand-muted">
                    No se encontraron cuentas con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                paged.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-brand-text">{a.client}</td>
                    <td className="px-4 py-3 text-brand-light">{a.number}</td>
                    <td className="px-4 py-3 text-brand-light">{a.type}</td>
                    <td className="px-4 py-3 font-semibold text-brand-text">{a.balance}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={a.status === "active" ? "Activa" : "Bloqueada"}
                        tone={a.status === "active" ? "positive" : "negative"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-light transition-colors hover:bg-white/10"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Ver
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-accent transition-colors hover:bg-brand-accent/10"
                        >
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          Supervisar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} />
        )}
      </div>
    </div>
  )
}

function ClientManagement() {
  const { session } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")
  const [dateSort, setDateSort] = useState<"recent" | "oldest">("recent")
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ClientModalMode>("create")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [detailsClient, setDetailsClient] = useState<Client | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [operationResult, setOperationResult] = useState<{ tone: "success" | "error"; message: string } | null>(null)
  const [focusReturnTarget, setFocusReturnTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)
    getClientsApi(session.token)
      .then((c) => {
        if (!active) return
        setClients(c)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error cargando clientes:", err)
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session])

  const filtered = useMemo(() => {
    const result = clients.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === "all" || c.status === statusFilter
      const matchesRole = roleFilter === "all" || c.role === roleFilter
      return matchesSearch && matchesStatus && matchesRole
    })
    return result.sort((a, b) =>
      dateSort === "recent"
        ? b.registeredAt.localeCompare(a.registeredAt)
        : a.registeredAt.localeCompare(b.registeredAt),
    )
  }, [clients, search, statusFilter, roleFilter, dateSort])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, roleFilter, dateSort])

  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
    setRoleFilter("all")
    setDateSort("recent")
  }

  function openCreateModal(trigger: HTMLElement | null) {
    setFocusReturnTarget(trigger)
    setOperationResult(null)
    setSelectedClient(null)
    setModalMode("create")
    setModalOpen(true)
  }

  function openEditModal(client: Client, trigger: HTMLElement | null) {
    setFocusReturnTarget(trigger)
    setOperationResult(null)
    setSelectedClient(client)
    setModalMode("edit")
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setSelectedClient(null)
    queueMicrotask(() => focusReturnTarget?.focus())
  }

  function openDeleteModal(client: Client, trigger: HTMLElement | null) {
    setFocusReturnTarget(trigger)
    setDeleteError(null)
    setOperationResult(null)
    setDeleteTarget(client)
  }

  function closeDeleteModal() {
    setDeleteError(null)
    setDeleteTarget(null)
    queueMicrotask(() => focusReturnTarget?.focus())
  }

  async function handleCreate(payload: ClientFormState) {
    if (!session) return
    const optimisticId = `temp-${Date.now()}`
    const optimisticClient: Client = {
      id: optimisticId,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      status: "active",
      registeredAt: new Date().toISOString().slice(0, 10),
    }
    setClients((prev) => [optimisticClient, ...prev])
    try {
      const created = await createClientApi(session.token, {
        name: payload.name,
        email: payload.email,
        role: payload.role,
      })
      setClients((prev) => prev.map((client) => (client.id === optimisticId ? created : client)))
      setOperationResult({ tone: "success", message: `Se creó correctamente el usuario ${created.name}.` })
    } catch (err) {
      setClients((prev) => prev.filter((client) => client.id !== optimisticId))
      console.error("Error creando cliente:", err)
      const message = "No se pudo crear el cliente. Verifica los datos y vuelve a intentarlo."
      setOperationResult({ tone: "error", message })
      throw new Error(message)
    }
  }

  async function handleUpdate(payload: ClientFormState) {
    if (!session || !selectedClient) return
    const previous = selectedClient
    const optimistic: Client = { ...previous, ...payload }
    setClients((prev) => prev.map((client) => (client.id === previous.id ? optimistic : client)))
    try {
      const updated = await updateClientApi(session.token, previous.id, payload)
      setClients((prev) => prev.map((client) => (client.id === previous.id ? updated : client)))
      setOperationResult({ tone: "success", message: `Se actualizaron correctamente los datos de ${updated.name}.` })
    } catch (err) {
      setClients((prev) => prev.map((client) => (client.id === previous.id ? previous : client)))
      console.error("Error actualizando cliente:", err)
      const message = "No se pudieron guardar los cambios. Verifica los datos y vuelve a intentarlo."
      setOperationResult({ tone: "error", message })
      throw new Error(message)
    }
  }

  async function handleConfirmDelete() {
    if (!session || !deleteTarget) return
    setDeleteLoading(true)
    const target = deleteTarget
    setDeleteError(null)
    setClients((prev) => prev.filter((client) => client.id !== target.id))
    try {
      await deleteClientApi(session.token, target.id)
      setOperationResult({ tone: "success", message: `Se eliminó correctamente el usuario ${target.name}.` })
      closeDeleteModal()
    } catch (err) {
      setClients((prev) => [target, ...prev])
      console.error("Error eliminando cliente:", err)
      const message = "No se pudo eliminar el usuario. La lista se restauró; puedes intentarlo nuevamente."
      setDeleteError(message)
      setOperationResult({ tone: "error", message })
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Gestión de usuarios</h1>
          <p className="text-sm text-brand-muted">Administra cuentas de clientes y administradores del sistema.</p>
        </div>
        <button type="button" onClick={(event) => openCreateModal(event.currentTarget)} className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" aria-hidden="true" />
          + Nuevo usuario
        </button>
      </div>

      {operationResult ? (
        <div
          role={operationResult.tone === "error" ? "alert" : "status"}
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            operationResult.tone === "success"
              ? "border-brand-positive/30 bg-brand-positive/10 text-brand-positive"
              : "border-brand-negative/30 bg-brand-negative/10 text-brand-negative",
          )}
        >
          {operationResult.message}
        </div>
      ) : null}

      <div className="rounded-xl bg-brand-surface2">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="input-base pl-9"
              aria-label="Buscar cliente"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-brand-muted">
              Estado
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="input-base py-2"
                aria-label="Filtrar por estado"
              >
                <option value="all">Todos</option>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-brand-muted">
              Rol
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                className="input-base py-2"
                aria-label="Filtrar por rol"
              >
                {ROLE_FILTERS.map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-brand-muted">
              Fecha de registro
              <select
                value={dateSort}
                onChange={(e) => setDateSort(e.target.value as typeof dateSort)}
                className="input-base py-2"
                aria-label="Ordenar por fecha"
              >
                <option value="recent">Más recientes</option>
                <option value="oldest">Más antiguos</option>
              </select>
            </label>
            <button type="button" onClick={clearFilters} className="btn-secondary py-2">
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-y border-white/10 text-xs uppercase tracking-wide text-brand-muted">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Correo electrónico</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-brand-muted">
                    Cargando clientes...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-brand-muted">
                    No se encontraron clientes.
                  </td>
                </tr>
              ) : (
                paged.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-brand-text">{c.name}</td>
                    <td className="px-4 py-3 text-brand-light">{c.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={c.role} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={c.status === "active" ? "Activo" : "Inactivo"}
                        tone={c.status === "active" ? "positive" : "negative"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailsClient(c)}
                          aria-label={`Ver detalle de ${c.name}`}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-light transition-colors hover:bg-white/10"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={(event) => openEditModal(c, event.currentTarget)}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-light transition-colors hover:bg-white/10"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={(event) => openDeleteModal(c, event.currentTarget)}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-negative transition-colors hover:bg-brand-negative/10"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} />
        )}
      </div>

      <ClientDialog
        open={modalOpen}
        mode={modalMode}
        initialClient={selectedClient}
        existingClients={clients}
        onClose={closeModal}
        onSubmit={async (payload) => {
          if (modalMode === "create") {
            await handleCreate(payload)
          } else {
            await handleUpdate(payload)
          }
        }}
      />

      <DeleteClientDialog
        open={deleteTarget !== null}
        client={deleteTarget}
        loading={deleteLoading}
        error={deleteError}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
      />
      <ClientDetailsDialog
        client={detailsClient}
        onClose={() => setDetailsClient(null)}
        onEdit={(client) => {
          setDetailsClient(null)
          openEditModal(client, null)
        }}
      />
    </div>
  )
}

function SubadminManagement() {
  const { session } = useAuth()
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profileError, setProfileError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<SubadminRole | "">("")
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; role?: string }>({})
  const [drafts, setDrafts] = useState<SubadminDraft[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!session) {
      setProfile(null)
      setProfileError(true)
      setLoadingProfile(false)
      return () => {
        active = false
      }
    }

    setLoadingProfile(true)
    setProfileError(false)
    getProfileApi(session.token)
      .then((data) => {
        if (active) setProfile(data)
      })
      .catch((error) => {
        console.error("Error verificando permisos de subadministradores:", error)
        if (active) setProfileError(true)
      })
      .finally(() => {
        if (active) setLoadingProfile(false)
      })

    return () => {
      active = false
    }
  }, [session, retryCount])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors: typeof fieldErrors = {}
    const cleanName = name.trim()
    const cleanEmail = email.trim()
    if (!cleanName) errors.name = "Ingresa el nombre completo."
    else if (cleanName.length < 2) errors.name = "El nombre debe tener al menos 2 caracteres."
    if (!cleanEmail) errors.email = "Ingresa el correo electrónico."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = "Escribe un correo válido, por ejemplo nombre@dominio.com."
    }
    if (!role || !PERMITTED_SUBADMIN_ROLES.some((option) => option.value === role)) {
      errors.role = "Selecciona uno de los roles habilitados."
    }
    if (drafts.some((draft) => draft.email.toLowerCase() === cleanEmail.toLowerCase())) {
      errors.email = "Ya existe un borrador con este correo."
    }
    setFieldErrors(errors)
    setNotice(null)
    if (Object.keys(errors).length > 0 || !role) return

    setDrafts((current) => [
      ...current,
      { id: Date.now(), name: cleanName, email: cleanEmail, role },
    ])
    setName("")
    setEmail("")
    setRole("")
    setFieldErrors({})
    setNotice("Borrador agregado. Aún no se creó una cuenta ni se guardaron los cambios en el servidor.")
  }

  if (loadingProfile) {
    return (
      <div className="rounded-xl border border-white/10 bg-brand-surface p-6" role="status">
        <div className="h-24 animate-pulse rounded-lg bg-brand-surface-2" />
        <span className="sr-only">Verificando permisos de administrador…</span>
      </div>
    )
  }

  if (profileError) {
    return (
      <div className="rounded-xl border border-brand-negative/30 bg-brand-negative/10 p-5 text-center" role="alert">
        <p className="text-sm font-semibold text-brand-text">
          {session ? "No pudimos verificar tus permisos." : "Inicia sesión para gestionar subadministradores."}
        </p>
        {session ? (
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-brand-text hover:bg-white/5"
          >
            Reintentar
          </button>
        ) : null}
      </div>
    )
  }

  if (profile?.role !== "admin") {
    return (
      <div className="rounded-xl border border-brand-negative/30 bg-brand-negative/10 p-5" role="alert">
        <h2 className="font-semibold text-brand-text">Acceso restringido</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Solo un administrador autenticado puede registrar subadministradores y asignar roles.
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-6" aria-labelledby="subadmins-title">
      <div>
        <h2 id="subadmins-title" className="text-2xl font-bold text-brand-text">
          Gestión de subadministradores
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          Prepara el registro y asigna únicamente roles disponibles para tu cuenta.
        </p>
      </div>

      <div className="rounded-xl border border-brand-accent/20 bg-brand-accent/10 p-4 text-sm text-brand-light">
        El servicio actual no ofrece un endpoint para registrar subadministradores ni asignarles roles. Los registros de
        esta pantalla son borradores locales y no se guardan en el servidor.
      </div>

      <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-white/10 bg-brand-surface p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent/15 text-brand-accent">
            <UserPlus className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-semibold text-brand-text">Registrar subadministrador</h3>
            <p className="text-xs text-brand-muted">Completa sus datos y selecciona un rol permitido.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="subadmin-name" className="block text-sm font-medium text-brand-text">
              Nombre completo
            </label>
            <input
              id="subadmin-name"
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "subadmin-name-error" : undefined}
              className="input-base mt-1"
              placeholder="Nombre y apellido"
            />
            {fieldErrors.name ? <p id="subadmin-name-error" className="mt-1 text-xs text-brand-negative">{fieldErrors.name}</p> : null}
          </div>

          <div>
            <label htmlFor="subadmin-email" className="block text-sm font-medium text-brand-text">
              Correo electrónico
            </label>
            <input
              id="subadmin-email"
              type="email"
              autoComplete="email"
              maxLength={255}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "subadmin-email-error" : undefined}
              className="input-base mt-1"
              placeholder="usuario@peya.com"
            />
            {fieldErrors.email ? <p id="subadmin-email-error" className="mt-1 text-xs text-brand-negative">{fieldErrors.email}</p> : null}
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-brand-text">Rol asignado</legend>
          {fieldErrors.role ? <p className="mt-1 text-xs text-brand-negative">{fieldErrors.role}</p> : null}
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {PERMITTED_SUBADMIN_ROLES.map((option) => {
              const selected = role === option.value
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                    selected ? "border-brand-accent bg-brand-accent/10" : "border-white/10 bg-brand-bg hover:bg-white/5",
                  )}
                >
                  <input
                    type="radio"
                    name="subadmin-role"
                    value={option.value}
                    checked={selected}
                    onChange={() => {
                      setRole(option.value)
                      setFieldErrors((current) => ({ ...current, role: undefined }))
                    }}
                    className="mt-1 accent-brand-accent"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-brand-text">{option.label}</span>
                    <span className="mt-1 block text-xs text-brand-muted">{option.description}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {notice ? (
          <p role="status" className="mt-4 rounded-lg border border-brand-accent/20 bg-brand-accent/10 px-3 py-2 text-sm text-brand-light">
            {notice}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button type="submit" className="btn-primary inline-flex items-center gap-2">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Agregar borrador
          </button>
        </div>
      </form>

      <section className="rounded-xl border border-white/10 bg-brand-surface p-5" aria-labelledby="subadmin-drafts-title">
        <h3 id="subadmin-drafts-title" className="font-semibold text-brand-text">Borradores de esta sesión</h3>
        {drafts.length === 0 ? (
          <p className="mt-3 text-sm text-brand-muted">Aún no hay subadministradores preparados.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {drafts.map((draft) => (
              <li key={draft.id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-brand-text">{draft.name}</p>
                  <p className="text-sm text-brand-muted">{draft.email}</p>
                </div>
                <span className="inline-flex w-fit items-center rounded-full bg-brand-accent/15 px-2.5 py-1 text-xs font-semibold text-brand-accent">
                  {PERMITTED_SUBADMIN_ROLES.find((option) => option.value === draft.role)?.label ?? draft.role}
                  {" · Pendiente de integración"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

export function AdminModule() {
  const [tab, setTab] = useState<AdminTab>("dashboard")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5 rounded-xl bg-brand-surface p-1.5 sm:flex-row">
        <button
          type="button"
          onClick={() => setTab("dashboard")}
          className={cn(
            "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
            tab === "dashboard" ? "bg-brand-accent text-brand-bg" : "text-brand-muted hover:text-brand-text",
          )}
        >
          Panel administrativo
        </button>
        <button
          type="button"
          onClick={() => setTab("clients")}
          className={cn(
            "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
            tab === "clients" ? "bg-brand-accent text-brand-bg" : "text-brand-muted hover:text-brand-text",
          )}
        >
          Gestión de usuarios
        </button>
        <button
          type="button"
          onClick={() => setTab("subadmins")}
          aria-current={tab === "subadmins" ? "page" : undefined}
          className={cn(
            "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
            tab === "subadmins" ? "bg-brand-accent text-brand-bg" : "text-brand-muted hover:text-brand-text",
          )}
        >
          Subadministradores
        </button>
      </div>

      {tab === "dashboard" ? <AdminDashboard /> : tab === "clients" ? <ClientManagement /> : <SubadminManagement />}
    </div>
  )
}
