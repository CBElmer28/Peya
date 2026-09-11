"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { createAccountApi, getAccountsApi } from "@/lib/api-client"
import type { Account } from "@/lib/mock-api"

const PAGE_SIZE = 8

type NewAccountType = "savings" | "checking" | "usd"

type AccountOption = {
  value: NewAccountType
  label: string
  currency: "PEN" | "USD"
}

const ACCOUNT_OPTIONS: AccountOption[] = [
  { value: "savings", label: "Ahorros", currency: "PEN" },
  { value: "checking", label: "Corriente", currency: "PEN" },
  { value: "usd", label: "Cuenta en dólares", currency: "USD" },
]

function getAccountTypeLabel(type: Account["type"]): string {
  if (type === "savings") return "Ahorros"
  if (type === "checking") return "Corriente"
  return "Cuenta en dólares"
}

function getAccountTypeTone(type: Account["type"]): string {
  if (type === "savings") return "bg-brand-positive/15 text-brand-positive"
  if (type === "checking") return "bg-brand-surface-2 text-brand-light/80"
  return "bg-sky-500/15 text-sky-400"
}

function StatusBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-positive/15 px-2.5 py-1 text-xs font-semibold text-brand-positive">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-positive" aria-hidden="true" />
      Activo
    </span>
  )
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

function CreateAccountDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (type: NewAccountType) => void
}) {
  const [type, setType] = useState<NewAccountType>("savings")

  useEffect(() => {
    if (open) setType("savings")
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-brand-surface p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-brand-text">Abrir nueva cuenta</h3>
            <p className="mt-1 text-sm text-brand-muted">Selecciona el tipo de cuenta que deseas abrir.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-brand-muted transition-colors hover:bg-white/5 hover:text-brand-text"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="flex flex-col gap-1.5 text-sm text-brand-muted">
            Tipo de cuenta
            <div className="relative">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as NewAccountType)}
                className="input-base appearance-none pr-10"
                aria-label="Tipo de cuenta"
              >
                {ACCOUNT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
            </div>
          </label>

          <p className="rounded-xl border border-white/10 bg-brand-surface-2/60 px-4 py-3 text-sm text-brand-light/90">
            Se abrirá con saldo S/. 0.00
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="button" onClick={() => onConfirm(type)} className="btn-primary">
            Confirmar apertura
          </button>
        </div>
      </div>
    </div>
  )
}

export function AccountsView() {
  const { session } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingType, setPendingType] = useState<NewAccountType | null>(null)

  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)
    getAccountsApi(session.token)
      .then((items) => {
        if (!active) return
        setAccounts(items)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error cargando cuentas:", err)
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    setPage(1)
  }, [accounts.length])

  const totalPages = Math.ceil(accounts.length / PAGE_SIZE)
  const pagedAccounts = accounts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleConfirm(type: NewAccountType) {
    if (!session) return

    const option = ACCOUNT_OPTIONS.find((item) => item.value === type)
    if (!option) return

    setPendingType(type)
    setDialogOpen(false)

    const optimisticId = `temp-${Date.now()}`
    const optimisticAccount: Account = {
      id: optimisticId,
      label: option.label,
      type,
      balance: option.currency === "PEN" ? "S/. 0.00" : "USD 0.00",
      detail: "Cuenta recién abierta",
      subtitleDetail:
        type === "savings"
          ? "Interés anual: 3.5% TEA"
          : type === "checking"
            ? "Sin comisión de mantenimiento"
            : "TC referencial: S/. 3.78",
      icon: type === "savings" ? "savings" : type === "checking" ? "wallet" : "investment",
      currency: option.currency,
      cci: "Generando CCI...",
      status: "active",
      trendLabel: "0.0% este mes",
      trendDirection: "up",
    }

    setAccounts((prev) => [optimisticAccount, ...prev])

    try {
      const created = await createAccountApi(session.token, { type, currency: option.currency })
      setAccounts((prev) => prev.map((account) => (account.id === optimisticId ? created : account)))
    } catch {
      setAccounts((prev) => prev.filter((account) => account.id !== optimisticId))
    } finally {
      setPendingType(null)
    }
  }

  return (
    <section aria-labelledby="accounts-title" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="accounts-title" className="text-2xl font-bold text-brand-text">
            Mis cuentas
          </h1>
          <p className="text-sm text-brand-muted">Resumen completo de todas las cuentas activas.</p>
        </div>
        <button type="button" onClick={() => setDialogOpen(true)} className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" aria-hidden="true" />
          + Nueva cuenta
        </button>
      </div>

      <div className="rounded-xl bg-brand-surface2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-y border-white/10 text-xs uppercase tracking-wide text-brand-muted">
                <th className="px-4 py-3 font-semibold">CCI</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Saldo disponible</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Tendencia mensual</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <tr key={index} className="border-b border-white/5">
                    <td className="px-4 py-5" colSpan={5}>
                      <div className="h-12 animate-pulse rounded-lg bg-brand-surface" />
                    </td>
                  </tr>
                ))
              ) : pagedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-brand-muted">
                    No hay cuentas para mostrar.
                  </td>
                </tr>
              ) : (
                pagedAccounts.map((account) => (
                  <tr key={account.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                    <td className="px-4 py-4 align-middle">
                      <div className="space-y-1">
                        <p className="font-medium text-brand-text">{account.cci}</p>
                        <p className="text-xs text-brand-muted">{account.label}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", getAccountTypeTone(account.type))}>
                        {getAccountTypeLabel(account.type)}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-middle text-base font-bold text-brand-text">{account.balance}</td>
                    <td className="px-4 py-4 align-middle">
                      <StatusBadge />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-sm font-semibold",
                          account.trendDirection === "up" ? "text-brand-positive" : "text-brand-negative",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            account.trendDirection === "up" ? "bg-brand-positive" : "bg-brand-negative",
                          )}
                          aria-hidden="true"
                        />
                        {account.trendLabel}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && accounts.length > 0 ? (
          <Pagination page={page} totalPages={totalPages || 1} totalItems={accounts.length} onChange={setPage} />
        ) : null}
      </div>

      <CreateAccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={(type) => {
          void handleConfirm(type)
        }}
      />

      {pendingType ? <span className="sr-only">Procesando apertura de cuenta</span> : null}
    </section>
  )
}
