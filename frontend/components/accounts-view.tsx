"use client"

import { useEffect, useState } from "react"
import {
  Plus,
  Copy,
  Check,
  CreditCard,
  Wallet,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ExternalLink,
  Layers,
  LayoutGrid,
  List,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { createAccountApi, getAccountsApi } from "@/lib/api-client"
import { AccountDetailModal } from "@/components/account-detail-modal"
import type { Account } from "@/lib/mock-api"

type NewAccountType = "savings" | "checking" | "usd"

type AccountOption = {
  value: NewAccountType
  label: string
  currency: "PEN" | "USD"
  description: string
  benefit: string
  minBalance: string
  color: string
}

const ACCOUNT_OPTIONS: AccountOption[] = [
  {
    value: "savings",
    label: "Cuenta de Ahorros",
    currency: "PEN",
    description: "Ideal para guardar tu dinero y generar rentabilidad día a día.",
    benefit: "3.50% TEA sin cobro de mantenimiento",
    minBalance: "S/. 0.00",
    color: "from-emerald-900/60 to-emerald-950/90 border-emerald-500/30 text-emerald-400",
  },
  {
    value: "checking",
    label: "Cuenta Corriente",
    currency: "PEN",
    description: "Diseñada para tu flujo diario, pagos de servicios y transferencias.",
    benefit: "Transferencias interbancarias inmediatas gratis",
    minBalance: "S/. 0.00",
    color: "from-amber-900/60 to-amber-950/90 border-amber-500/30 text-amber-400",
  },
  {
    value: "usd",
    label: "Cuenta en Dólares",
    currency: "USD",
    description: "Ahorra y transfiere en moneda extranjera protegiéndote de la devaluación.",
    benefit: "Tipo de cambio preferencial garantizado",
    minBalance: "$ 0.00",
    color: "from-sky-900/60 to-sky-950/90 border-sky-500/30 text-sky-400",
  },
]

function maskCci(rawCci: string): string {
  if (!rawCci) return "191-****-00"
  const parts = rawCci.split("-")
  if (parts.length === 3) {
    return `${parts[0]}-****-${parts[2]}`
  }
  return `****${rawCci.slice(-4)}`
}

/**
 * Modal completo para apertura de nueva cuenta (HU05)
 */
function CreateAccountModal({
  open,
  onClose,
  onSuccess,
  token,
}: {
  open: boolean
  onClose: () => void
  onSuccess: (newAccount: Account) => void
  token: string
}) {
  const [selectedType, setSelectedType] = useState<NewAccountType>("savings")
  const [step, setStep] = useState<"form" | "confirm" | "success">("form")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdAccount, setCreatedAccount] = useState<Account | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedType("savings")
      setStep("form")
      setError(null)
      setCreatedAccount(null)
    }
  }, [open])

  if (!open) return null

  const currentOption = ACCOUNT_OPTIONS.find((opt) => opt.value === selectedType)!

  async function handleCreate() {
    setLoading(true)
    setError(null)

    const idempotencyKey = `open-acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    try {
      const created = await createAccountApi(
        token,
        {
          type: currentOption.value,
          currency: currentOption.currency,
        },
        idempotencyKey,
      )

      setCreatedAccount(created)
      setStep("success")
      onSuccess(created)
    } catch (err: any) {
      console.error("Error al abrir cuenta:", err)
      const msg = err?.message || err?.body?.message || "No se pudo procesar la apertura de la cuenta. Intenta nuevamente."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/10 bg-brand-surface p-6 shadow-2xl sm:p-7">
        {step === "form" && (
          <div>
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-bold text-brand-text">Apertura de nueva cuenta</h2>
                <p className="mt-1 text-xs text-brand-muted">Selecciona el tipo de cuenta que mejor se adapte a ti.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 p-2 text-brand-muted hover:bg-white/5 hover:text-brand-text"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {ACCOUNT_OPTIONS.map((opt) => {
                const isSelected = selectedType === opt.value
                return (
                  <div
                    key={opt.value}
                    onClick={() => setSelectedType(opt.value)}
                    className={cn(
                      "cursor-pointer rounded-2xl border p-4 transition-all",
                      isSelected
                        ? "border-brand-accent bg-brand-accent/10 shadow-lg shadow-brand-accent/5 ring-1 ring-brand-accent"
                        : "border-white/10 bg-brand-surface-2/40 hover:border-white/20 hover:bg-white/5",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl",
                            isSelected ? "bg-brand-accent text-brand-bg font-bold" : "bg-white/10 text-brand-muted",
                          )}
                        >
                          {opt.value === "savings" ? (
                            <PiggyBank className="h-5 w-5" />
                          ) : opt.value === "checking" ? (
                            <Wallet className="h-5 w-5" />
                          ) : (
                            <CreditCard className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-brand-text">{opt.label}</span>
                            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-muted">
                              {opt.currency}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-brand-muted">{opt.description}</p>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border",
                          isSelected ? "border-brand-accent bg-brand-accent text-brand-bg" : "border-white/20",
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5 text-xs">
                      <span className="text-brand-positive flex items-center gap-1 font-medium">
                        <Sparkles className="h-3.5 w-3.5" />
                        {opt.benefit}
                      </span>
                      <span className="text-brand-muted">Saldo mín: {opt.minBalance}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>
              <button type="button" onClick={() => setStep("confirm")} className="btn-primary">
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div>
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-xl font-bold text-brand-text">Confirmar solicitud de apertura</h2>
              <p className="mt-1 text-xs text-brand-muted">Revisa las condiciones antes de formalizar la apertura.</p>
            </div>

            <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-brand-surface-2/40 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-brand-muted">Tipo de cuenta:</span>
                <span className="font-bold text-brand-text">{currentOption.label}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-brand-muted">Moneda:</span>
                <span className="font-bold text-brand-text">{currentOption.currency === "PEN" ? "Soles (PEN)" : "Dólares Americanos (USD)"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-brand-muted">Saldo inicial de apertura:</span>
                <span className="font-bold text-brand-positive">S/. 0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-brand-muted">Comisión de mantenimiento:</span>
                <span className="font-bold text-brand-text">S/. 0.00 (Gratuita)</span>
              </div>
              <div className="rounded-xl border border-brand-accent/20 bg-brand-accent/10 p-3 text-xs text-brand-accent">
                Al confirmar, se creará tu nueva cuenta con un Código de Cuenta Interbancaria (CCI) asignado inmediatamente para recibir transferencias.
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-negative/30 bg-brand-negative/15 p-3 text-xs text-brand-negative">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setStep("form")}
                disabled={loading}
                className="btn-secondary"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="btn-primary flex items-center gap-2 disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {loading ? "Creando cuenta..." : "Confirmar apertura"}
              </button>
            </div>
          </div>
        )}

        {step === "success" && createdAccount && (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-positive/20 text-brand-positive">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <h2 className="mt-4 text-2xl font-bold text-brand-text">¡Cuenta abierta con éxito!</h2>
            <p className="mt-1 text-xs text-brand-muted">
              Tu nueva <span className="font-semibold text-brand-text">{createdAccount.label}</span> ya se encuentra activa y disponible para su uso.
            </p>

            <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-brand-surface-2/60 p-4 text-left text-xs">
              <div className="flex justify-between">
                <span className="text-brand-muted">Tipo de Cuenta:</span>
                <span className="font-bold text-brand-text">{createdAccount.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">CCI Asignado:</span>
                <span className="font-mono font-bold text-brand-accent">{createdAccount.cci}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Saldo Inicial:</span>
                <span className="font-bold text-brand-positive">{createdAccount.balance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Estado:</span>
                <span className="text-brand-positive font-semibold">Activa</span>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <button type="button" onClick={onClose} className="btn-primary w-full sm:w-auto px-8">
                Ir a mis cuentas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Vista Principal de Cuentas (HU06 + Integración HU05 y HU07)
 */
export function AccountsView() {
  const { session } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards")
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    let active = true
    setLoading(true)
    setError(null)

    getAccountsApi(session.token)
      .then((items) => {
        if (!active) return
        setAccounts(items)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error cargando cuentas:", err)
        if (!active) return
        setError("No se pudieron cargar las cuentas bancarias.")
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session])

  function handleAccountCreated(newAcc: Account) {
    setAccounts((prev) => [newAcc, ...prev])
  }

  async function handleCopy(acc: Account, e: React.MouseEvent) {
    e.stopPropagation()
    let textToCopy = acc.fullCci || acc.cci
    if ((!acc.fullCci || acc.cci.includes("*")) && session) {
      try {
        const detail = await getAccountDetailApi(session.token, acc.id)
        if (detail?.account?.fullCci) {
          textToCopy = detail.account.fullCci
        } else if (detail?.account?.cci && !detail.account.cci.includes("*")) {
          textToCopy = detail.account.cci
        }
      } catch {
        // Mantener fallback si no hay conexión
      }
    }
    await navigator.clipboard.writeText(textToCopy)
    setCopiedId(acc.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <section aria-labelledby="accounts-title" className="space-y-6">
      {/* Header con acciones */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="accounts-title" className="text-2xl font-bold tracking-tight text-brand-text md:text-3xl">
            Mis Cuentas Bancarias
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            Gestiona tus cuentas, visualiza saldos y consulta el detalle de tus movimientos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-white/10 bg-brand-surface p-1">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                viewMode === "cards" ? "bg-brand-accent text-brand-bg" : "text-brand-muted hover:text-brand-text",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Tarjetas
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                viewMode === "table" ? "bg-brand-accent text-brand-bg" : "text-brand-muted hover:text-brand-text",
              )}
            >
              <List className="h-3.5 w-3.5" />
              Tabla
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="btn-primary flex items-center gap-2 shadow-lg shadow-brand-accent/20"
          >
            <Plus className="h-4 w-4" />
            Nueva cuenta
          </button>
        </div>
      </div>

      {/* Manejo de error si falla la carga */}
      {error && (
        <div className="rounded-2xl border border-brand-negative/30 bg-brand-negative/15 p-4 text-sm text-brand-negative">
          {error}
        </div>
      )}

      {/* Estado de carga con Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-3xl border border-white/10 bg-brand-surface/60 p-6"
            />
          ))}
        </div>
      )}

      {/* Estado vacío cuando no hay cuentas */}
      {!loading && accounts.length === 0 && (
        <div className="rounded-3xl border border-dashed border-white/15 bg-brand-surface/40 p-12 text-center">
          <Wallet className="mx-auto h-12 w-12 text-brand-muted/40" />
          <h3 className="mt-3 text-lg font-bold text-brand-text">No tienes cuentas bancarias activas</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-brand-muted">
            Abre tu primera cuenta en soles o dólares en cuestión de segundos y comienza a operar.
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="btn-primary mt-6 inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Abrir mi primera cuenta
          </button>
        </div>
      )}

      {/* Vista de TARJETAS (Dashboard HU06) */}
      {!loading && accounts.length > 0 && viewMode === "cards" && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const isUsd = account.currency === "USD" || account.type === "usd"
            const masked = maskCci(account.cci)

            return (
              <div
                key={account.id}
                onClick={() => setSelectedAccountForDetail(account)}
                className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-surface to-brand-surface-2 p-6 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:border-brand-accent/50 hover:shadow-2xl hover:shadow-brand-accent/10"
              >
                {/* Chip superior & tipo */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
                        account.type === "savings"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : account.type === "checking"
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-sky-500/15 text-sky-400",
                      )}
                    >
                      {account.label}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-brand-muted">
                      {account.currency}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand-positive animate-pulse" />
                    <span className="text-xs font-medium text-brand-positive">Activa</span>
                  </div>
                </div>

                {/* Número CCI Enmascarado (HU06) */}
                <div className="mt-5 flex items-center justify-between rounded-xl bg-brand-bg/50 px-3 py-2 text-xs font-mono">
                  <span className="text-brand-muted tracking-wider">{masked}</span>
                  <button
                    type="button"
                    onClick={(e) => void handleCopy(account, e)}
                    className="p-1 text-brand-muted hover:text-brand-text transition-colors"
                    title="Copiar CCI completo"
                  >
                    {copiedId === account.id ? (
                      <Check className="h-3.5 w-3.5 text-brand-positive" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Saldo Disponible */}
                <div className="mt-5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-brand-muted">
                    Saldo disponible
                  </span>
                  <p className="text-2xl font-extrabold tracking-tight text-brand-text group-hover:text-brand-accent transition-colors">
                    {account.balance}
                  </p>
                </div>

                {/* Footer de la tarjeta con acción rápida */}
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
                  <span className="text-brand-muted truncate max-w-[170px]">{account.subtitleDetail}</span>
                  <span className="flex items-center gap-1 font-semibold text-brand-accent group-hover:underline">
                    Ver detalle
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Vista de TABLA Alternativa */}
      {!loading && accounts.length > 0 && viewMode === "table" && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-brand-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-brand-surface-2/60 text-xs uppercase tracking-wider text-brand-muted">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Cuenta / CCI</th>
                  <th className="px-5 py-3.5 font-semibold">Tipo</th>
                  <th className="px-5 py-3.5 font-semibold">Saldo Disponible</th>
                  <th className="px-5 py-3.5 font-semibold">Estado</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {accounts.map((acc) => (
                  <tr
                    key={acc.id}
                    onClick={() => setSelectedAccountForDetail(acc)}
                    className="cursor-pointer transition-colors hover:bg-white/5"
                  >
                    <td className="px-5 py-4">
                      <p className="font-bold text-brand-text">{acc.label}</p>
                      <p className="font-mono text-xs text-brand-muted">{maskCci(acc.cci)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-brand-light">
                        {acc.type} ({acc.currency})
                      </span>
                    </td>
                    <td className="px-5 py-4 text-base font-bold text-brand-accent">{acc.balance}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-positive/15 px-2 py-0.5 text-xs font-semibold text-brand-positive">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-positive" />
                        Activa
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedAccountForDetail(acc)
                        }}
                        className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold text-brand-text hover:bg-white/10"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Cuenta (HU07) */}
      <AccountDetailModal
        open={Boolean(selectedAccountForDetail)}
        account={selectedAccountForDetail}
        token={session?.token ?? ""}
        onClose={() => setSelectedAccountForDetail(null)}
      />

      {/* Modal de Apertura de Nueva Cuenta (HU05) */}
      <CreateAccountModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleAccountCreated}
        token={session?.token ?? ""}
      />
    </section>
  )
}
