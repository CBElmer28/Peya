"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { getAccounts, getAllMovements, type Account, type Movement } from "@/lib/mock-api"

const PAGE_SIZE = 8

type SortOption = "recent" | "oldest" | "smallest" | "largest"

const CATEGORY_STYLES: Record<string, string> = {
  Ingreso: "bg-brand-positive/15 text-brand-positive",
  Comercio: "bg-amber-500/15 text-amber-400",
  Transferencia: "bg-sky-500/15 text-sky-400",
  Deuda: "bg-brand-negative/15 text-brand-negative",
  Servicios: "bg-brand-surface-2 text-brand-light/80",
  Retiro: "bg-brand-surface-2 text-brand-light/80",
}

function Pagination({
  page,
  totalPages,
  totalItems,
  onChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  onChange: (nextPage: number) => void
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
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((nextPage) => (
          <button
            key={nextPage}
            type="button"
            onClick={() => onChange(nextPage)}
            aria-current={nextPage === page ? "page" : undefined}
            className={cn(
              "h-8 min-w-8 rounded-xl px-2 text-sm font-medium transition-colors duration-150",
              nextPage === page ? "bg-brand-accent text-brand-bg" : "text-brand-muted hover:bg-white/5 hover:text-brand-text",
            )}
          >
            {nextPage}
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

function parseAmount(amount: string): number {
  const cleaned = amount.replace(/[^0-9,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "")
  const normalized = cleaned.includes(",") && cleaned.includes(".") ? cleaned.replace(/,/g, "") : cleaned.replace(",", ".")
  return Number(normalized)
}

function parseDate(date: string): number {
  const [day, month, year] = date.split("/").map(Number)
  return new Date(year, month - 1, day).getTime()
}

function movementMatchesAccount(movement: Movement, account: Account | undefined): boolean {
  if (!account) return true
  const haystack = `${movement.name} ${movement.description}`.toLowerCase()
  return haystack.includes(account.label.toLowerCase()) || haystack.includes(account.type)
}

export function MovementsView() {
  const { session } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [accountFilter, setAccountFilter] = useState("all")
  const [sortBy, setSortBy] = useState<SortOption>("recent")
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)
    Promise.all([getAccounts(session.token), getAllMovements(session.token)]).then(([nextAccounts, nextMovements]) => {
      if (!active) return
      setAccounts(nextAccounts)
      setMovements(nextMovements)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    setPage(1)
  }, [accountFilter, sortBy])

  const displayedMovements = useMemo(() => {
    const selectedAccount = accounts.find((account) => account.label === accountFilter)

    const filtered = movements.filter((movement) => movementMatchesAccount(movement, selectedAccount))
    const sorted = [...filtered].sort((left, right) => {
      if (sortBy === "recent") return parseDate(right.date) - parseDate(left.date)
      if (sortBy === "oldest") return parseDate(left.date) - parseDate(right.date)

      const leftAmount = Math.abs(parseAmount(left.amount))
      const rightAmount = Math.abs(parseAmount(right.amount))
      return sortBy === "smallest" ? leftAmount - rightAmount : rightAmount - leftAmount
    })

    return sorted
  }, [accounts, movements, accountFilter, sortBy])

  const totalPages = Math.ceil(displayedMovements.length / PAGE_SIZE)
  const pagedMovements = displayedMovements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <section aria-labelledby="movements-view-title" className="space-y-4">
      <div>
        <h1 id="movements-view-title" className="text-2xl font-bold text-brand-text">
          Movimientos
        </h1>
        <p className="text-sm text-brand-muted">Historial completo de operaciones</p>
      </div>

      <div className="rounded-xl bg-brand-surface2">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="flex flex-col gap-1 text-xs text-brand-muted">
            Cuenta
            <div className="relative min-w-[220px]">
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="input-base appearance-none py-2 pr-10"
                aria-label="Filtrar por cuenta"
              >
                <option value="all">Todas las cuentas</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.label}>
                    {account.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
            </div>
          </label>

          <label className="flex flex-col gap-1 text-xs text-brand-muted">
            Ordenar por
            <div className="relative min-w-[220px]">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="input-base appearance-none py-2 pr-10"
                aria-label="Ordenar movimientos"
              >
                <option value="recent">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="smallest">Menor monto</option>
                <option value="largest">Mayor monto</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
            </div>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-brand-muted">
                <th scope="col" className="pb-3 pl-4 pr-4 font-semibold">
                  Fecha
                </th>
                <th scope="col" className="pb-3 pr-4 font-semibold">
                  Descripción
                </th>
                <th scope="col" className="pb-3 pr-4 font-semibold">
                  Categoría
                </th>
                <th scope="col" className="pb-3 pr-4 text-right font-semibold">
                  Monto
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={index} className="border-b border-white/5">
                    <td className="px-4 py-4" colSpan={4}>
                      <div className="h-12 animate-pulse rounded-lg bg-brand-surface" />
                    </td>
                  </tr>
                ))
              ) : pagedMovements.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-brand-muted">
                    No se encontraron movimientos con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                pagedMovements.map((movement) => (
                  <tr key={movement.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                    <td className="whitespace-nowrap px-4 py-3 text-brand-muted">{movement.date}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-brand-text">{movement.name}</p>
                      <p className="text-xs text-brand-muted">{movement.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-xl px-2 py-1 text-xs font-medium",
                          CATEGORY_STYLES[movement.category] ?? "bg-brand-surface-2 text-brand-light",
                        )}
                      >
                        {movement.category}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums",
                        movement.type === "positive" ? "text-brand-positive" : "text-brand-negative",
                      )}
                    >
                      {movement.amount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && displayedMovements.length > 0 ? (
          <Pagination page={page} totalPages={totalPages || 1} totalItems={displayedMovements.length} onChange={setPage} />
        ) : null}
      </div>
    </section>
  )
}
