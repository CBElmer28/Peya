"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Search,
  Filter,
  Calendar,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { getAccountsApi, searchMovementsApi } from "@/lib/api-client"
import type { Account, Movement } from "@/lib/mock-api"

type OperationType = "all" | "CREDITO" | "DEBITO"

export function MovementsView() {
  const { session } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)

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
    if (!session) return
    getAccountsApi(session.token)
      .then((accs) => setAccounts(accs))
      .catch((err) => console.error("Error cargando cuentas:", err))
  }, [session])

  // Cargar movimientos con filtros
  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)

    searchMovementsApi(session.token, {
      page,
      limit: 8,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      type: operationType,
      q: searchTerm || undefined,
      accountId: selectedAccountId !== "all" ? selectedAccountId : undefined,
    })
      .then((res) => {
        if (!active) return
        setMovements(res.items)
        setTotalPages(res.totalPages || 1)
        setTotalCount(res.total || 0)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error buscando movimientos:", err)
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session, page, searchTerm, selectedAccountId, operationType, dateFrom, dateTo])

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

  return (
    <section aria-labelledby="movements-title" className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="movements-title" className="text-2xl font-bold tracking-tight text-brand-text md:text-3xl">
            Historial de Movimientos
          </h1>
          <p className="text-sm text-brand-muted">
            Consulta tus ingresos y gastos, aplica filtros por fecha o busca operaciones específicas.
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

          {/* Cantidad de resultados encontrados (HU08) */}
          <div className="text-xs font-medium text-brand-muted">
            Mostrando <span className="font-bold text-brand-text">{movements.length}</span> de{" "}
            <span className="font-bold text-brand-accent">{totalCount}</span> operaciones encontradas
          </div>
        </div>
      </div>

      {/* Tabla de Resultados */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-brand-surface shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-brand-surface-2/60 text-xs uppercase tracking-wider text-brand-muted">
              <tr>
                <th className="px-6 py-4 font-semibold">Operación</th>
                <th className="px-6 py-4 font-semibold">Categoría</th>
                <th className="px-6 py-4 font-semibold">Fecha</th>
                <th className="px-6 py-4 text-right font-semibold">Monto</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4" colSpan={4}>
                      <div className="h-10 rounded-xl bg-brand-surface-2/60" />
                    </td>
                  </tr>
                ))
              ) : movements.length === 0 ? (
                /* Estado vacío cuando no existen resultados (HU08) */
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <FileText className="mx-auto h-12 w-12 text-brand-muted/30" />
                    <p className="mt-3 text-base font-bold text-brand-text">
                      No se encontraron movimientos
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-brand-muted">
                      No hay operaciones que coincidan con los filtros aplicados. Intenta modificar el término de búsqueda o rango de fechas.
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
                  const isPositive = mov.type === "positive" || (mov as any).tipo === "CREDITO"
                  return (
                    <tr key={mov.id} className="transition-colors hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                              isPositive ? "bg-brand-positive/15 text-brand-positive" : "bg-brand-negative/15 text-brand-negative",
                            )}
                          >
                            {isPositive ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-bold text-brand-text">{mov.name}</p>
                            <p className="text-xs text-brand-muted">{mov.description}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-brand-muted">
                          {mov.category}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs text-brand-muted font-medium">
                        {mov.date}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span
                          className={cn(
                            "text-sm font-extrabold tabular-nums tracking-tight",
                            isPositive ? "text-brand-positive" : "text-brand-text",
                          )}
                        >
                          {mov.amount}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

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

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
