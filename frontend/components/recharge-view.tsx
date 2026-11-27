"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, RefreshCw, Wallet } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { getAccountDetailApi, getAccountsApi, rechargeAccountApi, type RechargeResult } from "@/lib/api-client"
import type { Account } from "@/lib/mock-api"

type AccountWithCci = Account & { fullCci: string }

function normalizeCci(value: string) {
  return value.replace(/\D/g, "")
}

export function RechargeView() {
  const { session } = useAuth()
  const [accounts, setAccounts] = useState<AccountWithCci[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [cci, setCci] = useState("")
  const [amount, setAmount] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [previewAccount, setPreviewAccount] = useState<AccountWithCci | null>(null)
  const [previewAmount, setPreviewAmount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<RechargeResult | null>(null)

  useEffect(() => {
    let active = true
    if (!session) {
      setAccounts([])
      setError("Inicia sesión para consultar tus cuentas.")
      setLoading(false)
      return () => {
        active = false
      }
    }

    setLoading(true)
    setError(null)
    getAccountsApi(session.token)
      .then(async (userAccounts) => {
        const activeAccounts = userAccounts.filter((account) => account.status === "active")
        const accountsWithCci = await Promise.all(
          activeAccounts.map(async (account) => {
            const detail = await getAccountDetailApi(session.token, account.id)
            const fullCci = detail.account.fullCci
            if (!fullCci) {
              throw new Error(`No se pudo consultar el CCI de la cuenta ${account.label}.`)
            }
            return { ...account, fullCci }
          }),
        )
        if (active) setAccounts(accountsWithCci)
      })
      .catch((loadError) => {
        console.error("Error cargando cuentas para recarga:", loadError)
        if (active) {
          setError("No pudimos cargar tus cuentas. Revisa tu conexión e inténtalo nuevamente.")
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session, retryCount])

  const matchingAccount = useMemo(() => {
    const normalizedCci = normalizeCci(cci)
    if (!normalizedCci) return null
    return accounts.find((account) => normalizeCci(account.fullCci) === normalizedCci) ?? null
  }, [accounts, cci])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setFormError(null)
    setPreviewAccount(null)
    setResult(null)

    const normalizedCci = normalizeCci(cci)
    if (!normalizedCci) {
      setFormError("Ingresa el CCI de la cuenta que quieres recargar.")
      return
    }
    if (!matchingAccount) {
      setFormError("No encontramos una cuenta propia activa con ese CCI. Verifica el número e inténtalo nuevamente.")
      return
    }

    const normalizedAmount = amount.trim()
    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      setFormError("Ingresa un monto válido con hasta dos decimales, por ejemplo 25.50.")
      return
    }
    const parsedAmount = Number(normalizedAmount)
    if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
      setFormError("El monto mínimo de recarga es 1.00.")
      return
    }
    if (parsedAmount > 20000) {
      setFormError("El monto máximo permitido por recarga es 20,000.00.")
      return
    }
    if (!session) {
      setFormError("Inicia sesión para recargar tu cuenta.")
      return
    }

    setSubmitting(true)
    try {
      const idempotencyKey = `rc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const recharge = await rechargeAccountApi(
        session.token,
        { cci: matchingAccount.fullCci, amount: parsedAmount },
        idempotencyKey,
      )
      setPreviewAccount(matchingAccount)
      setPreviewAmount(parsedAmount)
      setResult(recharge)
      setAmount("")
    } catch (err) {
      console.error("Error al recargar la cuenta:", err instanceof Error ? err.name : "error")
      setFormError(
        err instanceof Error && err.message ? err.message : "No pudimos completar la recarga. Inténtalo nuevamente.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6" aria-labelledby="recharge-title">
      <div>
        <h1 id="recharge-title" className="text-2xl font-bold text-brand-text">Recargar saldo</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Busca una de tus cuentas activas por su CCI e indica el monto que quieres recargar.
        </p>
      </div>

      <div className="rounded-xl border border-brand-accent/20 bg-brand-accent/10 p-4 text-sm text-brand-light">
        La recarga simula un depósito en cajero: acredita saldo en tu cuenta sin mover dinero real. El monto debe estar
        entre 1.00 y 20,000.00.
      </div>

      {loading ? (
        <div className="space-y-4 rounded-xl border border-white/10 bg-brand-surface p-5" role="status">
          <div className="h-10 animate-pulse rounded-lg bg-brand-surface-2" />
          <div className="h-10 animate-pulse rounded-lg bg-brand-surface-2" />
          <span className="sr-only">Cargando tus cuentas…</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-brand-negative/30 bg-brand-negative/10 p-5 text-center" role="alert">
          <p className="text-sm font-semibold text-brand-text">{error}</p>
          {session ? (
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-brand-text hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reintentar
            </button>
          ) : null}
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center">
          <Wallet className="mx-auto h-8 w-8 text-brand-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-brand-text">No tienes cuentas activas para recargar</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-xl border border-white/10 bg-brand-surface p-5">
          <div>
            <label htmlFor="recharge-cci" className="block text-sm font-medium text-brand-text">
              CCI de la cuenta
            </label>
            <input
              id="recharge-cci"
              name="cci"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={25}
              value={cci}
              onChange={(event) => {
                setCci(event.target.value)
                setFormError(null)
                setPreviewAccount(null)
                setResult(null)
              }}
              placeholder="Escribe el CCI completo"
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? "recharge-form-error" : "recharge-cci-help"}
              className="input-base mt-1"
            />
            <p id="recharge-cci-help" className="mt-1 text-xs text-brand-muted">
              Se aceptan espacios o guiones. Solo se buscarán tus cuentas activas.
            </p>
            {matchingAccount ? (
              <p className="mt-2 text-sm text-brand-positive">
                Cuenta encontrada: {matchingAccount.label} · {matchingAccount.currency}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="recharge-amount" className="block text-sm font-medium text-brand-text">
              Monto a recargar
            </label>
            <div className="mt-1 flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-white/10 bg-brand-surface-2 px-3 text-sm text-brand-muted">
                {matchingAccount?.currency ?? "Moneda"}
              </span>
              <input
                id="recharge-amount"
                name="amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value)
                  setFormError(null)
                  setPreviewAccount(null)
                  setResult(null)
                }}
                placeholder="0.00"
                aria-invalid={Boolean(formError)}
                aria-describedby={formError ? "recharge-form-error" : undefined}
                className="input-base rounded-l-none"
              />
            </div>
          </div>

          {formError ? (
            <p id="recharge-form-error" role="alert" className="flex items-start gap-2 rounded-lg border border-brand-negative/30 bg-brand-negative/10 px-3 py-2 text-sm text-brand-negative">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {formError}
            </p>
          ) : null}

          <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
            {submitting ? "Recargando…" : "Recargar"}
          </button>
        </form>
      )}

      {previewAccount && result ? (
        <section className="rounded-xl border border-white/10 bg-brand-surface p-5" aria-labelledby="recharge-preview-title">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-positive/15 text-brand-positive">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="recharge-preview-title" className="font-semibold text-brand-text">Recarga realizada</h2>
              <p className="text-xs text-brand-muted">El saldo de tu cuenta ya fue actualizado.</p>
            </div>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-brand-muted">Cuenta</dt>
              <dd className="mt-1 text-sm font-medium text-brand-text">{previewAccount.label}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-brand-muted">CCI</dt>
              <dd className="mt-1 break-all font-mono text-sm text-brand-text">{previewAccount.fullCci}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-brand-muted">Monto recargado</dt>
              <dd className="mt-1 text-lg font-bold text-brand-text">
                {new Intl.NumberFormat("es-PE", {
                  style: "currency",
                  currency: previewAccount.currency,
                }).format(previewAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-brand-muted">Nuevo saldo</dt>
              <dd className="mt-1 text-lg font-bold text-brand-positive">{result.newBalance}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </section>
  )
}
