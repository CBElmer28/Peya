"use client"

import { useEffect, useState } from "react"
import {
  Search,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  FileText,
  X,
  CircleCheck,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { getAccountsApi, searchMovementsApi } from "@/lib/api-client"
import type { Account } from "@/lib/mock-api"

type OperationType = "all" | "CREDITO" | "DEBITO"
type Operation = Awaited<ReturnType<typeof searchMovementsApi>>["items"][number]

function formatOperationDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function formatOperationAmount(amount: string, currency: string, type: OperationType | Operation["type"]) {
  const value = Number(amount)
  const sign = type === "CREDITO" ? "+" : "-"
  if (!Number.isFinite(value)) return `${sign}${amount} ${currency}`

  try {
    return `${sign}${new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency,
    }).format(value)}`
  } catch {
    return `${sign}${currency} ${value.toFixed(2)}`
  }
}

function formatBalance(amount: string, currency: string) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return `${currency} ${amount}`
  try {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

export function MovementsView() {
  const { session } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [movements, setMovements] = useState<Operation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [accountsError, setAccountsError] = useState("")
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Filtros HU08
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAccountId, setSelectedAccountId] = useState("all")
  const [operationType, setOperationType] = useState<OperationType>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // Paginación HU08
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Cargar cuentas del usuario
  useEffect(() => {
    if (!session) {
      setAccounts([])
      setAccountsError("")
      return
    }
    getAccountsApi(session.token)
      .then((accs) => {
        setAccounts(accs)
        setAccountsError("")
      })
      .catch((err) => {
        console.error("Error cargando cuentas:", err)
        setAccountsError("No se pudieron cargar las cuentas para filtrar.")
      })
  }, [session])

  // Cargar movimientos con filtros
  useEffect(() => {
    if (!session) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError("")
    setSelectedOperationId(null)

    searchMovementsApi(session.token, {
      page,
      limit: 8,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      type: operationType,
      q: searchTerm.trim().length >= 2 ? searchTerm.trim() : undefined,
      accountId: selectedAccountId !== "all" ? selectedAccountId : undefined,
    })
      .then((res) => {
        if (!active) return
        setMovements(res.items)
        setTotalPages(res.totalPages || 1)
        setTotalCount(res.total || 0)
        setSelectedOperationId(res.items[0]?.id ?? null)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error buscando movimientos:", err)
        if (!active) return
        setMovements([])
        setTotalPages(1)
        setTotalCount(0)
        setError(err instanceof Error ? err.message : "No se pudieron cargar las operaciones.")
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session, page, searchTerm, selectedAccountId, operationType, dateFrom, dateTo, retryCount])

  // Limpiar filtros (HU08)
  function handleClearFilters() {
    setSearchTerm("")
    setSelectedAccountId("all")
    setOperationType("all")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  const hasActiveFilters = Boolean(
    searchTerm || selectedAccountId !== "all" || operationType !== "all" || dateFrom || dateTo,
  )
  const selectedOperation = movements.find((operation) => operation.id === selectedOperationId) ?? null
  const firstVisiblePage = Math.max(1, Math.min(page - 2, totalPages - 4))
  const visiblePages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstVisiblePage + index)

  return (
    <section aria-labelledby="movements-title" className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="movements-title" className="text-2xl font-bold tracking-tight text-brand-text md:text-3xl">
            Consulta de operaciones
          </h1>
          <p className="text-sm text-brand-muted">
            Revisa tus operaciones, filtra los resultados y consulta el detalle de cada movimiento.
          </p>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 self-start rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-brand-muted hover:bg-white/5 hover:text-brand-text transition-colors sm:self-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Barra de Filtros (HU08) */}
      <div className="rounded-3xl border border-white/10 bg-brand-surface p-5 shadow-xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Búsqueda por descripción o comercio */}
          <div className="lg:col-span-2">
            <label htmlFor="search-input" className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Buscar operación
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <input
                id="search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
                placeholder="Ej. Nómina, Falabella, Transferencia..."
                className="input-base pl-10"
              />
            </div>
            {searchTerm.trim().length === 1 && (
              <p className="mt-1 text-xs text-brand-muted">Escribe al menos 2 caracteres para buscar.</p>
            )}
          </div>

          {/* Filtro por tipo de operación */}
          <div>
            <label htmlFor="type-select" className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Tipo
            </label>
            <div className="relative mt-1.5">
              <select
                id="type-select"
                value={operationType}
                onChange={(e) => {
                  setOperationType(e.target.value as OperationType)
                  setPage(1)
                }}
                className="input-base appearance-none pr-10"
              >
                <option value="all">Todos los tipos</option>
                <option value="CREDITO">Ingresos (+)</option>
                <option value="DEBITO">Egresos (-)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            </div>
          </div>

          {/* Filtro por rango de fechas (Fecha Inicial) */}
          <div>
            <label htmlFor="date-from" className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Desde
            </label>
            <div className="relative mt-1.5">
              <input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(1)
                }}
                className="input-base py-2"
              />
            </div>
          </div>

          {/* Filtro por rango de fechas (Fecha Final) */}
          <div>
            <label htmlFor="date-to" className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Hasta
            </label>
            <div className="relative mt-1.5">
              <input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(1)
                }}
                className="input-base py-2"
              />
            </div>
          </div>
        </div>

        {/* Sub-barra: Filtro por cuenta y contador de resultados */}
        <div className="mt-4 flex flex-col justify-between gap-3 border-t border-white/5 pt-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-brand-muted">Filtrar por cuenta:</span>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-white/10 bg-brand-surface-2 px-3 py-1.5 text-xs font-medium text-brand-text outline-none focus:border-brand-accent"
            >
              <option value="all">Todas las cuentas asociadas</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.label} ({acc.currency})
                </option>
              ))}
            </select>
          </div>
          {accountsError && <p role="status" className="text-xs text-brand-negative">{accountsError}</p>}

          {/* Cantidad de resultados encontrados (HU08) */}
          <div className="text-xs font-medium text-brand-muted">
            Mostrando <span className="font-bold text-brand-text">{movements.length}</span> de{" "}
            <span className="font-bold text-brand-accent">{totalCount}</span> operaciones encontradas
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-2xl border border-brand-negative/30 bg-brand-negative/10 px-4 py-3 text-sm text-brand-text sm:flex-row sm:items-center"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="shrink-0 self-start rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 sm:self-auto"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Tabla de Resultados */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-brand-surface shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-brand-surface-2/60 text-xs uppercase tracking-wider text-brand-muted">
              <tr>
                <th className="px-6 py-4 font-semibold">Operación</th>
                <th className="px-6 py-4 font-semibold">Categoría</th>
                <th className="px-6 py-4 font-semibold">Fecha</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 text-right font-semibold">Monto</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4" colSpan={5}>
                      <div className="h-10 rounded-xl bg-brand-surface-2/60" />
                    </td>
                  </tr>
                ))
              ) : movements.length === 0 ? (
                /* Estado vacío cuando no existen resultados (HU08) */
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <FileText className="mx-auto h-12 w-12 text-brand-muted/30" />
                    <p className="mt-3 text-base font-bold text-brand-text">
                      No se encontraron operaciones
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-brand-muted">
                      No hay operaciones que coincidan con los filtros aplicados. Intenta modificar la búsqueda o el rango de fechas.
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="btn-secondary mt-5 text-xs"
                      >
                        Restablecer todos los filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                movements.map((mov) => {
                  const isPositive = mov.type === "CREDITO"
                  const isSelected = mov.id === selectedOperationId
                  return (
                    <tr
                      key={mov.id}
                      aria-selected={isSelected}
                      className={cn(
                        "transition-colors hover:bg-white/5",
                        isSelected && "bg-brand-accent/5",
                      )}
                    >
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedOperationId(mov.id)}
                          aria-pressed={isSelected}
                          className="flex items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                              isPositive ? "bg-brand-positive/15 text-brand-positive" : "bg-brand-negative/15 text-brand-negative",
                            )}
                          >
                            {isPositive ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-bold text-brand-text">{mov.description}</p>
                            <p className="text-xs text-brand-muted">{mov.accountMasked}</p>
                          </div>
                        </button>
                      </td>

                      <td className="px-6 py-4">
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-brand-muted">
                          {mov.category}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs font-medium text-brand-muted">
                        {formatOperationDate(mov.date)}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-positive/10 px-2.5 py-1 text-xs font-semibold text-brand-positive">
                          <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Registrada
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span
                          className={cn(
                            "text-sm font-extrabold tabular-nums tracking-tight",
                            isPositive ? "text-brand-positive" : "text-brand-text",
                          )}
                        >
                          {formatOperationAmount(mov.amount, mov.currency, mov.type)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {selectedOperation && !loading && (
          <section
            aria-labelledby="operation-detail-title"
            className="rounded-3xl border border-white/10 bg-brand-surface p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                  <Eye className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="operation-detail-title" className="text-base font-bold text-brand-text">
                    Detalle de la operación
                  </h2>
                  <p className="mt-0.5 text-sm text-brand-muted">{selectedOperation.category}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOperationId(null)}
                className="rounded-lg p-1.5 text-brand-muted hover:bg-white/10 hover:text-brand-text"
                aria-label="Cerrar detalle de operación"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Monto</dt>
                <dd
                  className={cn(
                    "mt-1 font-bold tabular-nums",
                    selectedOperation.type === "CREDITO" ? "text-brand-positive" : "text-brand-text",
                  )}
                >
                  {formatOperationAmount(
                    selectedOperation.amount,
                    selectedOperation.currency,
                    selectedOperation.type,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Fecha y hora</dt>
                <dd className="mt-1 text-sm text-brand-text">{formatOperationDate(selectedOperation.date)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Cuenta</dt>
                <dd className="mt-1 font-mono text-sm text-brand-text">{selectedOperation.accountMasked}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Saldo posterior</dt>
                <dd className="mt-1 text-sm font-semibold text-brand-text">
                  {formatBalance(selectedOperation.balanceAfter, selectedOperation.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Categoría</dt>
                <dd className="mt-1 text-sm text-brand-text">{selectedOperation.category}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Estado</dt>
                <dd className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-positive">
                  <CircleCheck className="h-4 w-4" aria-hidden="true" />
                  Registrada
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Código de operación</dt>
                <dd className="mt-1 break-all font-mono text-xs text-brand-text">{selectedOperation.id}</dd>
              </div>
            </dl>
          </section>
        )}

        {/* Paginación (HU08) */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 px-6 py-4 text-xs text-brand-muted sm:flex-row">
            <span>
              Página <span className="font-bold text-brand-text">{page}</span> de{" "}
              <span className="font-bold text-brand-text">{totalPages}</span>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 text-brand-text hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {visiblePages.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-colors",
                    page === p ? "bg-brand-accent text-brand-bg shadow-sm" : "hover:bg-white/5 text-brand-muted",
                  )}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 text-brand-text hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
