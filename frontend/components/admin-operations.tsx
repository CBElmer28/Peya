"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import {
  getOperationsApi,
  type OperationItem,
  type OperationsFilters,
  type OperationsPage,
} from "@/lib/api-client"

const PAGE_SIZE = 10

type TypeFilter = NonNullable<OperationsFilters["type"]>

interface FormState {
  q: string
  type: TypeFilter
  from: string
  to: string
  minAmount: string
  maxAmount: string
}

const EMPTY_FORM: FormState = { q: "", type: "TODOS", from: "", to: "", minAmount: "", maxAmount: "" }

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function validateForm(form: FormState): string | null {
  if (form.from && form.to && form.from > form.to) return "La fecha inicial no puede ser mayor que la final."
  const min = form.minAmount === "" ? null : Number(form.minAmount)
  const max = form.maxAmount === "" ? null : Number(form.maxAmount)
  if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0))) {
    return "Los montos deben ser números mayores o iguales a cero."
  }
  if (min !== null && max !== null && min > max) return "El monto mínimo no puede ser mayor que el máximo."
  return null
}

export function AdminOperations() {
  const { session } = useAuth()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [applied, setApplied] = useState<FormState>(EMPTY_FORM)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<OperationsPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [selected, setSelected] = useState<OperationItem | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const load = useCallback(async () => {
    if (!session) {
      setLoading(false)
      setError("Inicia sesión para consultar las operaciones.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await getOperationsApi(session.token, { ...applied, page, pageSize: PAGE_SIZE }))
    } catch (err) {
      console.error("Error consultando operaciones:", err instanceof Error ? err.name : "error")
      setError(err instanceof Error && err.message ? err.message : "No pudimos cargar las operaciones.")
    } finally {
      setLoading(false)
    }
  }, [session, applied, page])

  useEffect(() => {
    void load()
  }, [load, retryCount])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problem = validateForm(form)
    setFormError(problem)
    if (problem) return
    setPage(1)
    setApplied({ ...form, q: form.q.trim() })
  }

  function clearFilters() {
    setForm(EMPTY_FORM)
    setApplied(EMPTY_FORM)
    setFormError(null)
    setPage(1)
  }

  const totalPages = data?.totalPages ?? 1

  return (
    <section className="space-y-6" aria-labelledby="operations-title">
      <div>
        <h2 id="operations-title" className="text-2xl font-bold text-brand-text">
          Operaciones realizadas
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          Consulta de solo lectura de los movimientos del sistema. Esta vista no modifica ninguna operación.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-4 rounded-xl border border-white/10 bg-brand-surface p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="op-q" className="block text-sm font-medium text-brand-text">
            Buscar
          </label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
            <input
              id="op-q"
              type="search"
              maxLength={100}
              value={form.q}
              onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))}
              placeholder="DNI, nombre, CCI o descripción"
              className="input-base pl-9"
            />
          </div>
        </div>

        <div>
          <label htmlFor="op-type" className="block text-sm font-medium text-brand-text">
            Tipo
          </label>
          <select
            id="op-type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TypeFilter }))}
            className="input-base mt-1"
          >
            <option value="TODOS">Todos</option>
            <option value="CREDITO">Crédito</option>
            <option value="DEBITO">Débito</option>
          </select>
        </div>
        <div>
          <label htmlFor="op-from" className="block text-sm font-medium text-brand-text">
            Desde
          </label>
          <input
            id="op-from"
            type="date"
            value={form.from}
            onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
            className="input-base mt-1"
          />
        </div>
        <div>
          <label htmlFor="op-to" className="block text-sm font-medium text-brand-text">
            Hasta
          </label>
          <input
            id="op-to"
            type="date"
            value={form.to}
            onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
            className="input-base mt-1"
          />
        </div>
        <div>
          <label htmlFor="op-min" className="block text-sm font-medium text-brand-text">
            Monto mínimo
          </label>
          <input
            id="op-min"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.minAmount}
            onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))}
            className="input-base mt-1"
          />
        </div>
        <div>
          <label htmlFor="op-max" className="block text-sm font-medium text-brand-text">
            Monto máximo
          </label>
          <input
            id="op-max"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.maxAmount}
            onChange={(e) => setForm((f) => ({ ...f, maxAmount: e.target.value }))}
            className="input-base mt-1"
          />
        </div>

        {formError ? (
          <p role="alert" className="text-sm text-brand-negative sm:col-span-2 lg:col-span-3">
            {formError}
          </p>
        ) : null}

        <div className="flex gap-3 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="btn-primary">
            Aplicar filtros
          </button>
          <button type="button" onClick={clearFilters} className="btn-secondary">
            Limpiar
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-white/10 bg-brand-surface">
        {loading ? (
          <div className="space-y-3 p-5" role="status">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-brand-surface-2" />
            ))}
            <span className="sr-only">Cargando operaciones…</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center" role="alert">
            <p className="text-sm font-semibold text-brand-text">{error}</p>
            <button
              type="button"
              onClick={() => setRetryCount((c) => c + 1)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-brand-text hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        ) : !data || data.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-brand-muted">No se encontraron operaciones con los filtros aplicados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-brand-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Cuenta</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.items.map((op) => (
                  <tr key={op.id} className="hover:bg-white/5">
                    <td className="whitespace-nowrap px-4 py-3 text-brand-light">{formatDate(op.date)}</td>
                    <td className="px-4 py-3 text-brand-text">{op.clientName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-brand-light">{op.accountMasked}</td>
                    <td className="px-4 py-3 text-brand-light">{op.description}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          op.type === "CREDITO"
                            ? "bg-brand-positive/15 text-brand-positive"
                            : "bg-brand-negative/15 text-brand-negative",
                        )}
                      >
                        {op.type === "CREDITO" ? "Crédito" : "Débito"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-brand-text">{op.amount}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(op)}
                        className="text-xs font-semibold text-brand-accent hover:opacity-80"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 && !error ? (
          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-brand-muted">
            <span>
              {data.total} registros · Página {data.page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                aria-label="Página anterior"
                className="rounded-lg border border-white/10 p-1.5 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                aria-label="Página siguiente"
                className="rounded-lg border border-white/10 p-1.5 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="operation-detail-title"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-white/10 bg-brand-surface p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="operation-detail-title" className="text-base font-bold text-brand-text">
                Detalle de la operación
              </h3>
              <button type="button" onClick={() => setSelected(null)} aria-label="Cerrar detalle" className="text-brand-muted hover:text-brand-text">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              {[
                ["Fecha", formatDate(selected.date)],
                ["Cliente", `${selected.clientName} · DNI ${selected.clientDni}`],
                ["Cuenta", selected.accountMasked],
                ["Tipo", selected.type === "CREDITO" ? "Crédito" : "Débito"],
                ["Categoría", selected.category],
                ["Descripción", selected.description],
                ["Monto", selected.amount],
                ["Saldo posterior", selected.balanceAfter],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-brand-muted">{label}</dt>
                  <dd className="break-words font-medium text-brand-light">{value}</dd>
                </div>
              ))}
            </dl>
            <button type="button" onClick={() => setSelected(null)} className="btn-secondary mt-6 w-full">
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
