"use client"

import { useEffect, useState } from "react"
import {
  X,
  Copy,
  Check,
  CreditCard,
  Wallet,
  PiggyBank,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getAccountDetailApi } from "@/lib/api-client"
import type { Account, Movement } from "@/lib/mock-api"

interface AccountDetailModalProps {
  open: boolean
  account: Account | null
  token: string
  onClose: () => void
  onTransferFromAccount?: (account: Account) => void
}

export function AccountDetailModal({
  open,
  account,
  token,
  onClose,
  onTransferFromAccount,
}: AccountDetailModalProps) {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [movements, setMovements] = useState<Movement[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [totalMovements, setTotalMovements] = useState(0)

  useEffect(() => {
    if (!open || !account) return
    let active = true
    setLoading(true)

    getAccountDetailApi(token, account.id, page)
      .then((res) => {
        if (!active) return
        setMovements(res.movements.items)
        setTotalPages(res.movements.totalPages || 1)
        setTotalMovements(res.movements.total || 0)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error cargando detalle de cuenta:", err)
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [open, account, token, page])

  if (!open || !account) return null

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Enmascaramiento según regla HU06 y HU07
  const rawCci = account.cci || "191-00000000-00"
  const parts = rawCci.split("-")
  const maskedCci = parts.length === 3 ? `${parts[0]}-****-${parts[2]}` : `****${rawCci.slice(-4)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl border border-white/10 bg-brand-surface p-6 shadow-2xl sm:p-7">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent/15 text-brand-accent">
              {account.type === "savings" ? (
                <PiggyBank className="h-6 w-6" />
              ) : account.type === "checking" ? (
                <Wallet className="h-6 w-6" />
              ) : (
                <CreditCard className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-brand-text">{account.label}</h2>
                <span className="rounded-full bg-brand-positive/15 px-2.5 py-0.5 text-xs font-semibold text-brand-positive">
                  Activa
                </span>
              </div>
              <p className="text-xs text-brand-muted">{account.subtitleDetail}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-brand-muted transition-colors hover:bg-white/5 hover:text-brand-text"
            aria-label="Cerrar detalle"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tarjeta de Resumen Financiero */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-brand-surface-2 to-brand-bg/80 p-5 shadow-inner">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-brand-muted">
                Saldo Disponible
              </span>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-brand-accent">
                {account.balance}
              </p>
              <p className="mt-1 text-xs text-brand-muted">
                Moneda oficial: <span className="font-semibold text-brand-text">{account.currency}</span>
              </p>
            </div>

            <div className="space-y-1.5 rounded-xl border border-white/10 bg-brand-bg/60 p-3 text-xs">
              <span className="text-brand-muted">Código de Cuenta Interbancaria (CCI):</span>
              <div className="flex items-center gap-2 font-mono font-bold text-brand-text">
                <span>{maskedCci}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(rawCci)}
                  className="rounded-lg p-1 text-brand-muted hover:bg-white/10 hover:text-brand-text"
                  title="Copiar CCI completo"
                >
                  {copied ? <Check className="h-4 w-4 text-brand-positive" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              {copied && <span className="text-[10px] text-brand-positive">¡CCI copiado al portapapeles!</span>}
            </div>
          </div>
        </div>

        {/* Sección: Movimientos Relacionados (HU07) */}
        <div className="mt-6 flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between pb-3">
            <h3 className="text-sm font-semibold text-brand-text">
              Movimientos recientes ({totalMovements})
            </h3>
            <span className="text-xs text-brand-muted">Ordenados por fecha más reciente</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-brand-muted">
                <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
                <span className="mt-2 text-xs">Cargando movimientos...</span>
              </div>
            ) : movements.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-brand-surface-2/40 py-10 text-center">
                <Calendar className="mx-auto h-8 w-8 text-brand-muted/40" />
                <p className="mt-2 text-sm font-medium text-brand-text">Sin movimientos</p>
                <p className="text-xs text-brand-muted">Esta cuenta aún no registra operaciones recientes.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {movements.map((mov) => {
                  const isPositive = mov.type === "positive" || (mov as any).tipo === "CREDITO"
                  return (
                    <div
                      key={mov.id}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-brand-surface-2/40 p-3 transition-colors hover:bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl",
                            isPositive ? "bg-brand-positive/15 text-brand-positive" : "bg-brand-negative/15 text-brand-negative",
                          )}
                        >
                          {isPositive ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-brand-text">{mov.name}</p>
                          <p className="text-xs text-brand-muted">{mov.description || mov.date}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={cn(
                            "text-sm font-bold",
                            isPositive ? "text-brand-positive" : "text-brand-text",
                          )}
                        >
                          {mov.amount}
                        </p>
                        <p className="text-[11px] text-brand-muted">{mov.date}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Paginación de Movimientos (HU07) */}
          {!loading && totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-brand-muted">
              <span>
                Página {page} de {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-white/10 p-1.5 hover:bg-white/5 disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-white/10 p-1.5 hover:bg-white/5 disabled:opacity-40"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer / Acciones */}
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
          {onTransferFromAccount && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onTransferFromAccount(account)
              }}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Transferir desde esta cuenta
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
