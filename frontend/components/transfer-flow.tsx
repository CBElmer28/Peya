"use client"

import { useEffect, useState } from "react"
import {
  ArrowLeftRight,
  Check,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Users,
  Building2,
  Printer,
  Download,
  Share2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  Clock,
  ChevronRight,
  UserCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import {
  getAccountsApi,
  createInternalTransferApi,
  createThirdPartyTransferApi,
  validateDestinationCciApi,
  getRecentRecipientsApi,
  getReceiptApi,
  getAccountDetailApi,
} from "@/lib/api-client"
import type { Account, RecentRecipient, RecipientValidation, TransferReceipt, TransferResult } from "@/lib/mock-api"

type TransferMode = "internal" | "third-party"
type Step = 1 | 2 | 3

export function TransferFlow() {
  const { session } = useAuth()
  const [mode, setMode] = useState<TransferMode>("internal")
  const [step, setStep] = useState<Step>(1)

  // Cuentas del usuario
  const [userAccounts, setUserAccounts] = useState<Account[]>([])
  const [sourceAccountId, setSourceAccountId] = useState("")
  const [destinationAccountId, setDestinationAccountId] = useState("")

  // Transferencia a terceros (HU10 & HU11)
  const [destinationCci, setDestinationCci] = useState("")
  const [validatingCci, setValidatingCci] = useState(false)
  const [validatedRecipient, setValidatedRecipient] = useState<RecipientValidation | null>(null)
  const [recipientError, setRecipientError] = useState<string | null>(null)
  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)

  // Datos comunes
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  // Proceso & Resultados (HU12)
  const [submitting, setSubmitting] = useState(false)
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null)
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(false)
  // CCI completo de las cuentas propias para mostrarlo en la constancia
  const [fullCcis, setFullCcis] = useState<{ source?: string; destination?: string }>({})

  // Cargar cuentas del usuario
  useEffect(() => {
    if (!session) return
    getAccountsApi(session.token).then((accs) => {
      setUserAccounts(accs)
      if (accs.length > 0) {
        setSourceAccountId(accs[0].id)
        if (accs.length > 1) {
          setDestinationAccountId(accs[1].id)
        }
      }
    })
  }, [session])

  // Cargar destinatarios recientes (HU11)
  useEffect(() => {
    if (!session || mode !== "third-party") return
    setLoadingRecipients(true)
    getRecentRecipientsApi(session.token, 4)
      .then((items) => {
        setRecentRecipients(items)
        setLoadingRecipients(false)
      })
      .catch(() => setLoadingRecipients(false))
  }, [session, mode])

function parseBalanceNumber(balanceStr?: string): number {
  if (!balanceStr) return 0
  const cleaned = balanceStr.replace(/^[^\d]*/, "").replace(/,/g, "")
  const val = parseFloat(cleaned)
  return Number.isNaN(val) ? 0 : val
}

  // Cuenta origen seleccionada
  const sourceAccount = userAccounts.find((a) => a.id === sourceAccountId)
  // Cuenta destino propia seleccionada
  const destAccount = userAccounts.find((a) => a.id === destinationAccountId)

  // Saldo numérico origen correctamente parseado (ej. "S/. 12,480.50" -> 12480.50)
  const rawBalance = parseBalanceNumber(sourceAccount?.balance)

  // Validar CCI a terceros en vivo (HU10)
  async function handleValidateCci(cciToValidate: string) {
    const clean = cciToValidate.trim()
    if (!clean || clean.length < 10) {
      setValidatedRecipient(null)
      setRecipientError(null)
      return
    }

    if (clean.includes("*")) {
      setValidatedRecipient(null)
      setRecipientError("El número contiene asteriscos (*). Debes ingresar o pegar el CCI completo sin enmascarar.")
      return
    }

    if (!session) return
    setValidatingCci(true)
    setRecipientError(null)

    try {
      const res = await validateDestinationCciApi(session.token, clean)
      setValidatedRecipient(res)
    } catch (err: any) {
      setValidatedRecipient(null)
      const msg = err?.message || err?.body?.message
      if (msg === "USE_OWN_TRANSFER" || msg?.includes("tuya")) {
        setRecipientError("La cuenta destino te pertenece. Usa la pestaña 'Entre mis cuentas'.")
      } else {
        setRecipientError("No se encontró ninguna cuenta activa con este CCI. Verifica el número.")
      }
    } finally {
      setValidatingCci(false)
    }
  }

  // Seleccionar destinatario reciente (HU11)
  function handleSelectRecent(rec: RecentRecipient) {
    setDestinationCci(rec.destinationCci)
    void handleValidateCci(rec.destinationCci)
  }

  // Avanzar a confirmación (Paso 2)
  function handleContinue() {
    setFormError(null)
    const num = Number(amount)

    if (!sourceAccountId) {
      setFormError("Selecciona una cuenta de origen.")
      return
    }

    if (Number.isNaN(num) || num <= 0) {
      setFormError("Ingresa un monto válido mayor a 0.00.")
      return
    }

    if (num > rawBalance) {
      setFormError(`El monto solicitado supera el saldo disponible (${sourceAccount?.balance}).`)
      return
    }

    if (mode === "internal") {
      if (!destinationAccountId) {
        setFormError("Selecciona la cuenta propia de destino.")
        return
      }
      if (sourceAccountId === destinationAccountId) {
        setFormError("La cuenta de destino no puede ser la misma cuenta de origen.")
        return
      }
    } else {
      if (!destinationCci.trim()) {
        setFormError("Ingresa el número de CCI de destino.")
        return
      }
      if (!validatedRecipient) {
        setFormError("Debes validar la cuenta de destino antes de continuar.")
        return
      }
    }

    setStep(2)
  }

  // Ejecutar transferencia
  async function handleExecuteTransfer() {
    if (!session) return
    setSubmitting(true)
    setFormError(null)

    const num = Number(amount)
    const idempotencyKey = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    try {
      let res: TransferResult

      if (mode === "internal") {
        res = await createInternalTransferApi(
          session.token,
          {
            sourceAccountId,
            destinationAccountId,
            amount: num,
            description: description || "Transferencia entre cuentas propias",
          },
          idempotencyKey,
        )
      } else {
        res = await createThirdPartyTransferApi(
          session.token,
          {
            sourceAccountId,
            destinationCci: destinationCci.trim(),
            amount: num,
            description: description || "Transferencia a terceros",
          },
          idempotencyKey,
        )
      }

      setTransferResult(res)

      // Obtener el CCI completo de las cuentas propias (el listado lo trae enmascarado)
      const token = session.token
      const fetchFullCci = (id?: string) =>
        id ? getAccountDetailApi(token, id).then((d) => d.account.fullCci).catch(() => undefined) : Promise.resolve(undefined)
      void Promise.all([
        fetchFullCci(sourceAccount?.id),
        mode === "internal" ? fetchFullCci(destAccount?.id) : Promise.resolve(undefined),
      ]).then(([source, destination]) => setFullCcis({ source, destination }))

      // Cargar la constancia formal (HU12)
      setLoadingReceipt(true)
      const opId = res.transferId || res.reference || `TX-${Date.now().toString().slice(-6)}`
      getReceiptApi(session.token, opId)
        .then((rec) => {
          setReceipt(rec)
          setLoadingReceipt(false)
        })
        .catch(() => {
          // Fallback con datos directos si la llamada falla
          setReceipt({
            operationId: opId,
            reference: res.reference,
            type: mode === "internal" ? "Transferencia entre cuentas propias" : "Transferencia a terceros",
            dateTime: new Date().toISOString(),
            amount: num.toFixed(2),
            currency: sourceAccount?.currency || "PEN",
            amountFormatted: `${sourceAccount?.currency === "USD" ? "USD" : "S/."} ${num.toFixed(2)}`,
            status: "COMPLETADO",
            description: description || "Transferencia bancaria",
            source: {
              maskedNumber: sourceAccount?.cci || "191-****-89",
              holder: session.user.name,
            },
            destination: {
              maskedNumber: mode === "internal" ? (destAccount?.cci || "191-****-21") : (validatedRecipient?.maskedNumber || destinationCci),
              holder: mode === "internal" ? session.user.name : (validatedRecipient?.holder || "Destinatario"),
            },
          })
          setLoadingReceipt(false)
        })

      setStep(3)
    } catch (err: any) {
      console.error("Error al transferir:", err)
      const msg = err?.message || err?.body?.message || "Ocurrió un error al procesar la transferencia."
      setFormError(msg === "INSUFFICIENT_FUNDS" ? "Saldo insuficiente en la cuenta de origen." : msg)
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setAmount("")
    setDescription("")
    setDestinationCci("")
    setValidatedRecipient(null)
    setTransferResult(null)
    setReceipt(null)
    setFullCcis({})
    setFormError(null)
    setStep(1)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <section aria-labelledby="transfers-title" className="mx-auto max-w-3xl space-y-6">
      {/* Encabezado */}
      <div className="text-center sm:text-left">
        <h1 id="transfers-title" className="text-2xl font-bold tracking-tight text-brand-text md:text-3xl">
          Transferencias Bancarias
        </h1>
        <p className="mt-1 text-sm text-brand-muted">
          Transfiere dinero de forma inmediata entre tus cuentas propias o a cualquier otra cuenta bancaria.
        </p>
      </div>

      {/* Indicador de Pasos */}
      {step < 3 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                step >= 1 ? "bg-brand-accent text-brand-bg" : "bg-white/10 text-brand-muted",
              )}
            >
              1
            </span>
            <span className={cn("text-xs font-semibold", step >= 1 ? "text-brand-text" : "text-brand-muted")}>
              Datos de operación
            </span>
          </div>

          <div className={cn("h-0.5 w-12", step >= 2 ? "bg-brand-accent" : "bg-white/10")} />

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                step === 2 ? "bg-brand-accent text-brand-bg" : "bg-white/10 text-brand-muted",
              )}
            >
              2
            </span>
            <span className={cn("text-xs font-semibold", step === 2 ? "text-brand-text" : "text-brand-muted")}>
              Confirmación
            </span>
          </div>
        </div>
      )}

      {/* PASO 1: Formulario de Transferencia */}
      {step === 1 && (
        <div className="rounded-3xl border border-white/10 bg-brand-surface p-6 shadow-xl sm:p-8">
          {/* Pestañas de Modo (HU09 vs HU10) */}
          <div className="flex rounded-2xl border border-white/10 bg-brand-bg/50 p-1.5">
            <button
              type="button"
              onClick={() => {
                setMode("internal")
                setFormError(null)
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all sm:text-sm",
                mode === "internal"
                  ? "bg-brand-accent text-brand-bg shadow-md"
                  : "text-brand-muted hover:text-brand-text",
              )}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Entre mis cuentas (HU09)
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("third-party")
                setFormError(null)
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all sm:text-sm",
                mode === "third-party"
                  ? "bg-brand-accent text-brand-bg shadow-md"
                  : "text-brand-muted hover:text-brand-text",
              )}
            >
              <Users className="h-4 w-4" />
              A otros clientes / CCI (HU10)
            </button>
          </div>

          <div className="mt-6 space-y-5">
            {/* Cuenta de Origen */}
            <div>
              <label htmlFor="src-account" className="block text-xs font-bold uppercase tracking-wider text-brand-muted">
                Cuenta de origen
              </label>
              <select
                id="src-account"
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                className="input-base mt-1.5 font-medium"
              >
                {userAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label} ({acc.currency}) — Saldo: {acc.balance}
                  </option>
                ))}
              </select>
              {sourceAccount && (
                <p className="mt-1.5 text-xs text-brand-muted">
                  Saldo disponible:{" "}
                  <span className="font-bold text-brand-positive">{sourceAccount.balance}</span>
                </p>
              )}
            </div>

            {/* MODO A: Entre Cuentas Propias (HU09) */}
            {mode === "internal" && (
              <div>
                <label htmlFor="dst-account" className="block text-xs font-bold uppercase tracking-wider text-brand-muted">
                  Cuenta propia de destino
                </label>
                <select
                  id="dst-account"
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                  className="input-base mt-1.5 font-medium"
                >
                  <option value="">Selecciona cuenta de destino...</option>
                  {userAccounts
                    .filter((acc) => acc.id !== sourceAccountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.label} ({acc.currency}) — {acc.balance}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* MODO B: A Terceros (HU10 & HU11) */}
            {mode === "third-party" && (
              <div className="space-y-4">
                {/* Destinatarios Recientes (HU11) */}
                {recentRecipients.length > 0 && (
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-brand-muted">
                      Destinatarios recientes (HU11)
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recentRecipients.map((rec) => (
                        <button
                          key={rec.destinationCci}
                          type="button"
                          onClick={() => handleSelectRecent(rec)}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border border-white/10 bg-brand-surface-2/60 px-3 py-1.5 text-xs transition-colors hover:border-brand-accent/50 hover:bg-white/5",
                            destinationCci === rec.destinationCci && "border-brand-accent bg-brand-accent/10",
                          )}
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-accent/20 text-[10px] font-bold text-brand-accent">
                            {rec.holder.slice(0, 1)}
                          </div>
                          <div className="text-left">
                            <span className="font-semibold text-brand-text">{rec.holder}</span>
                            <span className="block text-[10px] text-brand-muted">{rec.maskedNumber}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input CCI Destino */}
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="dest-cci" className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                      CCI o Número de Cuenta Destino
                    </label>
                    <span className="text-[11px] text-brand-muted">10 a 25 dígitos</span>
                  </div>
                  <div className="relative mt-1.5">
                    <input
                      id="dest-cci"
                      type="text"
                      value={destinationCci}
                      onChange={(e) => {
                        setDestinationCci(e.target.value)
                        setValidatedRecipient(null)
                        setRecipientError(null)
                      }}
                      onBlur={() => handleValidateCci(destinationCci)}
                      placeholder="Ej. 191-4567890123-45"
                      className="input-base font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleValidateCci(destinationCci)}
                      disabled={validatingCci || !destinationCci.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-brand-accent/20 px-2.5 py-1 text-xs font-semibold text-brand-accent hover:bg-brand-accent/30 disabled:opacity-40"
                    >
                      {validatingCci ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Validar"}
                    </button>
                  </div>
                </div>

                {/* Banner de Titular Validado (HU10) */}
                {validatedRecipient && (
                  <div className="flex items-start gap-3 rounded-2xl border border-brand-positive/30 bg-brand-positive/10 p-4 text-xs text-brand-positive">
                    <UserCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-bold text-brand-text">Destinatario validado:</p>
                      <p className="mt-0.5 text-sm font-semibold text-brand-positive">
                        {validatedRecipient.holder}
                      </p>
                      <p className="text-[11px] text-brand-muted font-mono">
                        Cuenta {validatedRecipient.maskedNumber} · Moneda {validatedRecipient.currency}
                      </p>
                    </div>
                  </div>
                )}

                {/* Error de validación de CCI */}
                {recipientError && (
                  <div className="flex items-center gap-2 rounded-xl border border-brand-negative/30 bg-brand-negative/10 p-3 text-xs text-brand-negative">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{recipientError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Monto a transferir */}
            <div>
              <label htmlFor="transfer-amount" className="block text-xs font-bold uppercase tracking-wider text-brand-muted">
                Monto a transferir
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-brand-muted">
                  {sourceAccount?.currency === "USD" ? "$" : "S/."}
                </span>
                <input
                  id="transfer-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="input-base pl-12 text-lg font-bold"
                />
              </div>
            </div>

            {/* Motivo / Concepto */}
            <div>
              <label htmlFor="transfer-desc" className="block text-xs font-bold uppercase tracking-wider text-brand-muted">
                Concepto / Motivo (opcional)
              </label>
              <input
                id="transfer-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Alquiler, Ahorro mensual, Compra..."
                className="input-base mt-1.5"
              />
            </div>

            {/* Alerta de Error de Formulario */}
            {formError && (
              <div className="flex items-center gap-2 rounded-xl border border-brand-negative/30 bg-brand-negative/15 p-3.5 text-xs font-semibold text-brand-negative">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Botón de Continuar */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleContinue}
                className="btn-primary w-full py-3.5 font-bold shadow-lg shadow-brand-accent/20"
              >
                Revisar y Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 2: Confirmación Previa */}
      {step === 2 && (
        <div className="rounded-3xl border border-white/10 bg-brand-surface p-6 shadow-xl sm:p-8">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-xl font-bold text-brand-text">Confirmar Transferencia</h2>
            <p className="mt-1 text-xs text-brand-muted">
              Por favor revisa cuidadosamente los detalles antes de autorizar la transacción.
            </p>
          </div>

          <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-brand-surface-2/40 p-5">
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Tipo de operación:</span>
              <span className="font-bold text-brand-text">
                {mode === "internal" ? "Transferencia entre cuentas propias" : "Transferencia a terceros"}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Cuenta de origen:</span>
              <div className="text-right">
                <span className="font-bold text-brand-text">{sourceAccount?.label}</span>
                <span className="block font-mono text-xs text-brand-muted">{sourceAccount?.cci}</span>
              </div>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Destinatario / Destino:</span>
              <div className="text-right">
                <span className="font-bold text-brand-text">
                  {mode === "internal" ? destAccount?.label : validatedRecipient?.holder}
                </span>
                <span className="block font-mono text-xs text-brand-muted">
                  {mode === "internal" ? destAccount?.cci : destinationCci}
                </span>
              </div>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Concepto:</span>
              <span className="text-brand-text">{description || "Sin descripción"}</span>
            </div>

            <div className="flex justify-between border-t border-white/10 pt-3 text-sm">
              <span className="text-brand-muted">Comisión:</span>
              <span className="font-bold text-brand-positive">S/. 0.00 (Gratis)</span>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-base font-bold text-brand-text">Total a debitar:</span>
              <span className="text-2xl font-extrabold text-brand-accent">
                {sourceAccount?.currency === "USD" ? "$" : "S/."} {Number(amount).toFixed(2)}
              </span>
            </div>
          </div>

          {formError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-negative/30 bg-brand-negative/15 p-3.5 text-xs text-brand-negative">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={submitting}
              className="btn-secondary flex-1"
            >
              Modificar datos
            </button>
            <button
              type="button"
              onClick={handleExecuteTransfer}
              disabled={submitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-70 font-bold"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {submitting ? "Procesando..." : "Confirmar y Transferir"}
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Constancia Oficial de Transferencia (HU12) */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Tarjeta imprimible de constancia */}
          <div
            id="transfer-receipt-card"
            className="relative overflow-hidden rounded-3xl border border-white/15 bg-brand-surface p-6 shadow-2xl sm:p-8"
          >
            {/* Sello de agua decorativo */}
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-brand-accent/5 blur-3xl pointer-events-none" />

            {/* Encabezado formal de la constancia */}
            <div className="flex items-start justify-between border-b border-white/10 pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-accent font-black text-brand-bg text-sm">
                    P
                  </div>
                  <span className="text-xl font-bold tracking-tight text-brand-text">Peya Digital</span>
                </div>
                <h2 className="mt-2 text-lg font-bold text-brand-positive flex items-center gap-1.5">
                  <CheckCircle2 className="h-5 w-5" />
                  Transferencia Exitosa
                </h2>
                <p className="text-xs text-brand-muted">Constancia oficial de transferencia electrónica</p>
              </div>

              <div className="text-right">
                <span className="rounded-full bg-brand-positive/15 px-3 py-1 text-xs font-bold text-brand-positive">
                  COMPLETADO
                </span>
                <p className="mt-1 text-[11px] font-mono text-brand-muted">
                  N° Op: {receipt?.reference || transferResult?.reference}
                </p>
              </div>
            </div>

            {/* Monto destacado */}
            <div className="my-6 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
                Monto Transferido
              </span>
              <p className="mt-1 text-3xl sm:text-4xl font-black tracking-tight text-brand-accent">
                {receipt?.amountFormatted || `${sourceAccount?.currency === "USD" ? "$" : "S/."} ${Number(amount).toFixed(2)}`}
              </p>
            </div>

            {/* Grilla de Datos de la Operación (HU12) */}
            <div className="space-y-3 rounded-2xl border border-white/10 bg-brand-surface-2/40 p-5 text-xs">
              <div className="flex justify-between border-b border-white/5 pb-2.5">
                <span className="text-brand-muted">Fecha y hora:</span>
                <span className="font-semibold text-brand-text">
                  {receipt?.dateTime ? new Date(receipt.dateTime).toLocaleString("es-PE") : new Date().toLocaleString("es-PE")}
                </span>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2.5">
                <span className="text-brand-muted">Tipo de transferencia:</span>
                <span className="font-semibold text-brand-text">
                  {receipt?.type || (mode === "internal" ? "Entre cuentas propias" : "A terceros")}
                </span>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2.5">
                <span className="text-brand-muted">Cuenta de origen:</span>
                <div className="text-right">
                  <span className="font-bold text-brand-text">{receipt?.source.holder || session?.user.name}</span>
                  <span className="block font-mono text-brand-muted">CCI: {fullCcis.source || receipt?.source.maskedNumber || sourceAccount?.cci}</span>
                </div>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2.5">
                <span className="text-brand-muted">Cuenta de destino:</span>
                <div className="text-right">
                  <span className="font-bold text-brand-text">
                    {receipt?.destination.holder || (mode === "internal" ? session?.user.name : validatedRecipient?.holder)}
                  </span>
                  <span className="block font-mono text-brand-muted">
                    CCI: {mode === "internal" ? (fullCcis.destination || receipt?.destination.maskedNumber || destAccount?.cci) : (receipt?.destination.maskedNumber || destinationCci)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2.5">
                <span className="text-brand-muted">Concepto:</span>
                <span className="font-medium text-brand-text">{description || "Sin descripción"}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-brand-muted">Comisión por operación:</span>
                <span className="font-bold text-brand-positive">S/. 0.00</span>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-brand-muted">
              Esta constancia constituye una prueba fehaciente de la transferencia emitida conforme a las normas del sistema financiero.
            </p>
          </div>

          {/* Botones de Acción (HU12: Descargar/Imprimir & Nueva Operación) */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Nueva transferencia
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary flex items-center justify-center gap-2 font-bold"
            >
              <Printer className="h-4 w-4" />
              Imprimir / Guardar constancia
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
