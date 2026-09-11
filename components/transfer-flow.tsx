"use client"

import { useState } from "react"
import { Check, AlertTriangle, ArrowLeftRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { createTransferApi } from "@/lib/api-client"
import {
  SOURCE_ACCOUNTS,
  TRANSACTION_TYPES,
  type TransferResult,
} from "@/lib/mock-api"

type Step = 1 | 2 | 3

type FormState = {
  transactionType: string
  sourceAccountId: string
  destinationAccount: string
  amount: string
  description: string
}

const INITIAL_FORM: FormState = {
  transactionType: TRANSACTION_TYPES[0].id,
  sourceAccountId: SOURCE_ACCOUNTS[0].id,
  destinationAccount: "",
  amount: "",
  description: "",
}

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" })

const STEPS = [
  { id: 1, label: "Datos" },
  { id: 2, label: "Confirmación" },
  { id: 3, label: "Resultado" },
] as const

export function TransferFlow() {
  const { session } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<TransferResult | null>(null)
  const [failure, setFailure] = useState<{ balance: number; amount: number } | null>(null)

  const source = SOURCE_ACCOUNTS.find((a) => a.id === form.sourceAccountId)!
  const typeLabel = TRANSACTION_TYPES.find((t) => t.id === form.transactionType)?.label ?? ""
  const amountNumber = Number(form.amount)

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleContinue() {
    // Validación de cliente antes de avanzar al paso de confirmación.
    if (!form.destinationAccount.trim()) {
      setFormError("Ingresa una cuenta de destino.")
      return
    }
    if (!form.amount || Number.isNaN(amountNumber) || amountNumber <= 0) {
      setFormError("Ingresa un monto válido mayor a cero.")
      return
    }
    setFormError(null)
    setStep(2)
  }

  async function handleTransfer() {
    setSubmitting(true)
    try {
      const res = await createTransferApi(session?.token ?? "", {
        transactionType: form.transactionType,
        sourceAccountId: form.sourceAccountId,
        destinationAccount: form.destinationAccount.trim(),
        amount: amountNumber,
        description: form.description.trim(),
      })
      setResult(res)
      setFailure(null)
    } catch (err) {
      // Escenario B: saldo insuficiente (respuesta 422 del backend).
      const message = err instanceof Error ? err.message : "unknown"
      if (message === "INSUFFICIENT_FUNDS") {
        setFailure({ balance: source.balance, amount: amountNumber })
      } else {
        setFailure({ balance: source.balance, amount: amountNumber })
      }
      setResult(null)
    } finally {
      setSubmitting(false)
      setStep(3)
    }
  }

  function resetFlow() {
    setForm(INITIAL_FORM)
    setResult(null)
    setFailure(null)
    setFormError(null)
    setStep(1)
  }

  function retry() {
    // Vuelve al paso 1 conservando los datos para corregir el monto.
    setResult(null)
    setFailure(null)
    setStep(1)
  }

  return (
    <section className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-text">
          <ArrowLeftRight className="h-6 w-6 text-brand-accent" aria-hidden="true" />
          Transferencias
        </h1>
        <p className="mt-1 text-sm text-brand-muted">Envía dinero de forma rápida y segura.</p>
      </header>

      {/* Indicador visual de pasos */}
      <ol className="mb-8 flex items-center">
        {STEPS.map((s, i) => {
          const done = step > s.id
          const current = step === s.id
          return (
            <li key={s.id} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    done && "border-brand-accent bg-brand-accent text-brand-bg",
                    current && "border-brand-accent bg-transparent text-brand-accent",
                    !done && !current && "border-white/20 bg-transparent text-brand-muted",
                  )}
                >
                  {done ? <Check className="h-5 w-5" aria-hidden="true" /> : s.id}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    current || done ? "text-brand-text" : "text-brand-muted",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className={cn(
                    "mx-2 h-0.5 flex-1 rounded transition-colors",
                    step > s.id ? "bg-brand-accent" : "bg-white/15",
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>

      {/* Paso 1 · Ingreso de datos */}
      {step === 1 && (
        <div className="rounded-2xl border border-white/10 bg-brand-surface2 p-6 shadow-lg">
          <div className="space-y-5">
            <Field label="Tipo de transacción" htmlFor="tx-type">
              <select
                id="tx-type"
                value={form.transactionType}
                onChange={(e) => updateField("transactionType", e.target.value)}
                className="input-base"
              >
                {TRANSACTION_TYPES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-brand-surface2 text-brand-text">
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Cuenta origen" htmlFor="src-account">
              <select
                id="src-account"
                value={form.sourceAccountId}
                onChange={(e) => updateField("sourceAccountId", e.target.value)}
                className="input-base"
              >
                {SOURCE_ACCOUNTS.map((a) => (
                  <option key={a.id} value={a.id} className="bg-brand-surface2 text-brand-text">
                    {a.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-sm text-brand-muted">
                Saldo disponible:{" "}
                <span className="font-semibold text-brand-success">{currency.format(source.balance)}</span>
              </p>
            </Field>

            <Field label="Cuenta destino" htmlFor="dest-account">
              <input
                id="dest-account"
                type="text"
                inputMode="numeric"
                placeholder="Número de cuenta o CLABE"
                value={form.destinationAccount}
                onChange={(e) => updateField("destinationAccount", e.target.value)}
                className="input-base"
              />
            </Field>

            <Field label="Monto" htmlFor="amount">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted">
                  $
                </span>
                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => updateField("amount", e.target.value)}
                  className="input-base pl-7"
                />
              </div>
            </Field>

            <Field label="Descripción (opcional)" htmlFor="description">
              <input
                id="description"
                type="text"
                placeholder="Ej. Pago de renta"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                className="input-base"
              />
            </Field>

            {formError && (
              <p role="alert" className="rounded-lg bg-brand-danger/15 px-3 py-2 text-sm text-brand-danger">
                {formError}
              </p>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={resetFlow} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="button" onClick={handleContinue} className="btn-primary flex-1">
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Paso 2 · Confirmación */}
      {step === 2 && (
        <div className="rounded-2xl border border-white/10 bg-brand-surface2 p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold text-brand-text">Revisa los datos</h2>
          <dl className="divide-y divide-white/10">
            <Row label="Tipo de transacción" value={typeLabel} />
            <Row label="Cuenta origen" value={source.label} />
            <Row label="Cuenta destino" value={form.destinationAccount} />
            <Row label="Monto" value={currency.format(amountNumber)} highlight />
            <Row label="Descripción" value={form.description || "—"} />
          </dl>

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1" disabled={submitting}>
              Atrás
            </button>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={submitting}
              className="btn-primary flex-1 disabled:opacity-70"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Procesando...
                </span>
              ) : (
                "Transferir"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Paso 3 · Resultado */}
      {step === 3 && result && (
        <div className="rounded-2xl border border-white/10 bg-brand-surface2 p-8 text-center shadow-lg">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-success/15">
            <Check className="h-11 w-11 text-brand-success" strokeWidth={3} aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-brand-text">Transacción realizada con éxito</h2>
          <p className="mt-2 text-sm text-brand-muted">
            Se transfirieron <span className="font-semibold text-brand-text">{currency.format(amountNumber)}</span> a la
            cuenta {form.destinationAccount}.
          </p>
          <dl className="mx-auto mt-6 max-w-xs space-y-2 rounded-xl bg-brand-bg/40 p-4 text-left">
            <div className="flex justify-between text-sm">
              <dt className="text-brand-muted">Referencia</dt>
              <dd className="font-mono font-medium text-brand-text">{result.reference}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-brand-muted">Saldo restante</dt>
              <dd className="font-semibold text-brand-success">{currency.format(result.newBalance)}</dd>
            </div>
          </dl>
          <button type="button" onClick={resetFlow} className="btn-primary mt-6 w-full">
            Inicio
          </button>
        </div>
      )}

      {step === 3 && failure && (
        <div className="rounded-2xl border border-white/10 bg-brand-surface2 p-8 text-center shadow-lg">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-danger/15">
            <AlertTriangle className="h-11 w-11 text-brand-danger" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-brand-text">Transacción rechazada</h2>
          <p className="mt-2 text-sm text-brand-muted">El monto solicitado supera el saldo disponible.</p>
          <dl className="mx-auto mt-6 max-w-xs space-y-2 rounded-xl bg-brand-bg/40 p-4 text-left">
            <div className="flex justify-between text-sm">
              <dt className="text-brand-muted">Saldo actual</dt>
              <dd className="font-semibold text-brand-text">{currency.format(failure.balance)}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-brand-muted">Monto solicitado</dt>
              <dd className="font-semibold text-brand-danger">{currency.format(failure.amount)}</dd>
            </div>
          </dl>
          <button type="button" onClick={retry} className="btn-primary mt-6 w-full">
            Volver a intentar
          </button>
        </div>
      )}
    </section>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-brand-text">
        {label}
      </label>
      {children}
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-brand-muted">{label}</dt>
      <dd className={cn("text-right text-sm font-medium", highlight ? "text-brand-accent" : "text-brand-text")}>
        {value}
      </dd>
    </div>
  )
}
