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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import {
  getAdminMetrics,
  getSupervisedAccounts,
  getClients,
  createClient,
  updateClient,
  deleteClient,
  type AdminMetric,
  type SupervisedAccount,
  type Client,
  type ClientRole,
  type ClientStatus,
} from "@/lib/mock-api"

type AdminTab = "dashboard" | "clients"

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
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: ClientModalMode
  initialClient: Client | null
  onClose: () => void
  onSubmit: (payload: ClientFormState) => Promise<void>
}) {
  const [form, setForm] = useState<ClientFormState>(getInitialForm())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setLoading(false)
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

  async function handleSubmit() {
    if (!form.name.trim()) {
      setError("Ingresa el nombre completo.")
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError("Ingresa un correo válido.")
      return
    }

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
    } catch {
      setError(mode === "create" ? "No se pudo crear el usuario." : "No se pudo actualizar el usuario.")
    } finally {
      setLoading(false)
    }
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

        <div className="mt-5 space-y-4">
          <label className="flex flex-col gap-1.5 text-sm text-brand-muted">
            Nombre completo
            <input
              ref={firstInputRef}
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className="input-base"
              placeholder="Nombre y apellido"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-brand-muted">
            Correo electrónico
            <input
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              className="input-base"
              placeholder="usuario@bankhub.com"
            />
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
      </div>
    </div>
  )
}

function DeleteClientDialog({
  open,
  client,
  onClose,
  onConfirm,
}: {
  open: boolean
  client: Client | null
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

        <div className="mt-6 flex items-center justify-end gap-3">
          <button ref={firstButtonRef} type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            className="rounded-xl bg-brand-negative px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:opacity-90"
          >
            Sí, eliminar
          </button>
        </div>
      </div>
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
    Promise.all([getAdminMetrics(session.token), getSupervisedAccounts(session.token)]).then(([m, a]) => {
      if (!active) return
      setMetrics(m)
      setAccounts(a)
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
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [focusReturnTarget, setFocusReturnTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)
    getClients(session.token).then((c) => {
      if (!active) return
      setClients(c)
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
    setSelectedClient(null)
    setModalMode("create")
    setModalOpen(true)
  }

  function openEditModal(client: Client, trigger: HTMLElement | null) {
    setFocusReturnTarget(trigger)
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
    setDeleteTarget(client)
  }

  function closeDeleteModal() {
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
      const created = await createClient(session.token, {
        name: payload.name,
        email: payload.email,
        role: payload.role,
      })
      setClients((prev) => prev.map((client) => (client.id === optimisticId ? created : client)))
    } catch {
      setClients((prev) => prev.filter((client) => client.id !== optimisticId))
      throw new Error("CREATE_FAILED")
    }
  }

  async function handleUpdate(payload: ClientFormState) {
    if (!session || !selectedClient) return
    const previous = selectedClient
    const optimistic: Client = { ...previous, ...payload }
    setClients((prev) => prev.map((client) => (client.id === previous.id ? optimistic : client)))
    try {
      const updated = await updateClient(session.token, previous.id, payload)
      setClients((prev) => prev.map((client) => (client.id === previous.id ? updated : client)))
    } catch {
      setClients((prev) => prev.map((client) => (client.id === previous.id ? previous : client)))
      throw new Error("UPDATE_FAILED")
    }
  }

  async function handleConfirmDelete() {
    if (!session || !deleteTarget) return
    setDeleteLoading(true)
    const target = deleteTarget
    setClients((prev) => prev.filter((client) => client.id !== target.id))
    try {
      await deleteClient(session.token, target.id)
      closeDeleteModal()
    } catch {
      setClients((prev) => [target, ...prev])
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
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export function AdminModule() {
  const [tab, setTab] = useState<AdminTab>("dashboard")

  return (
    <div className="space-y-6">
      <div className="flex gap-2 rounded-xl bg-brand-surface p-1.5">
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
      </div>

      {tab === "dashboard" ? <AdminDashboard /> : <ClientManagement />}
    </div>
  )
}
