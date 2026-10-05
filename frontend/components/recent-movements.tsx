"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { getMovementsApi } from "@/lib/api-client"
import type { Movement } from "@/lib/mock-api"

const CATEGORY_STYLES: Record<string, string> = {
  Ingreso: "bg-brand-positive/15 text-brand-positive",
  Comercio: "bg-amber-500/15 text-amber-400",
  Transferencia: "bg-sky-500/15 text-sky-400",
  Deuda: "bg-brand-negative/15 text-brand-negative",
  Servicios: "bg-brand-surface-2 text-brand-light/80",
  Retiro: "bg-brand-surface-2 text-brand-light/80",
}

export function RecentMovements() {
  const { session } = useAuth()
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    let active = true
    getMovementsApi(session.token)
      .then((data) => {
        if (!active) return
        setMovements(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error cargando movimientos:", err)
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session])

  return (
    <section
      aria-labelledby="movimientos-title"
      className="flex flex-col rounded-xl border border-white/10 bg-brand-surface p-5 shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="movimientos-title" className="text-lg font-bold text-brand-text">
            Movimientos recientes
          </h2>
          <p className="mt-1 text-xs text-brand-muted">Últimas 8 operaciones</p>
        </div>
        <a href="#" className="shrink-0 text-sm font-semibold text-brand-accent transition-opacity hover:opacity-80">
          Ver todos los movimientos
        </a>
      </div>

      {loading && movements.length === 0 ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-brand-surface-2" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-brand-muted">
                <th scope="col" className="pb-3 pr-4 font-semibold">
                  Fecha
                </th>
                <th scope="col" className="pb-3 pr-4 font-semibold">
                  Descripción
                </th>
                <th scope="col" className="pb-3 pr-4 font-semibold">
                  Categoría
                </th>
                <th scope="col" className="pb-3 text-right font-semibold">
                  Monto
                </th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-white/5 last:border-0">
                  <td className="whitespace-nowrap py-3 pr-4 text-brand-muted">{m.date}</td>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-brand-text">{m.name}</p>
                    <p className="text-xs text-brand-muted">{m.description}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-xl px-2 py-1 text-xs font-medium",
                        CATEGORY_STYLES[m.category] ?? "bg-brand-surface-2 text-brand-light",
                      )}
                    >
                      {m.category}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap py-3 text-right font-semibold tabular-nums",
                      m.type === "positive" ? "text-brand-positive" : "text-brand-negative",
                    )}
                  >
                    {m.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
